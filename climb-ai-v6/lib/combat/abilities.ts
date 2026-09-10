import {
  CombatStats,SpellDataValue,evaluateCalculation,
} from './formula';
import {NormalisedSpell} from './importSpells';
import {DamageComponent,DamageType} from './damage';
import type {ChampionInfo} from '../champions/ddragon';
import {AbilityModel,AbilitySlot} from './combos';
import {ConfidenceReport,assessConfidence,combineConfidence} from './confidence';

/**
 * Assembles Q/W/E/R from the two data sources.
 *
 * Data Dragon gives the slot order, names, cooldowns, costs and ranges —
 * authoritative, simple, and already fetched for everything else in the app.
 * CommunityDragon gives the damage formulas, which Data Dragon does not publish.
 *
 * The bridge between them is exact: Data Dragon's spell `id` equals the last
 * segment of the CommunityDragon spell path. Checked across the whole roster —
 * 692 of 692 spells, all four slots on all 173 champions — so no per-champion
 * mapping table is needed and none should be added.
 */

export interface DataDragonSpell{
  id:string;
  name:string;
  maxrank?:number;
  cooldown?:number[];
  cost?:number[];
  range?:number[];
}

export const SLOTS:AbilitySlot[]=['Q','W','E','R'];

/**
 * Names that mark a calculation as an alternative to the primary one rather
 * than an addition to it.
 *
 * This matters more than it looks. Darius Q publishes BladeDamage and
 * HandleDamage — the outer and inner hit of the same swing, never both — and his
 * R publishes Damage and MaximumDamage, the same execute at zero and five
 * stacks. Summing either pair doubles his damage. So exactly one calculation is
 * chosen per ability and the rest are reported separately, unsummed.
 */
const VARIANT=/maximum|minimum|\bmax\b|\bmin\b|monster|minion|empowered|crit|handle|secondary|bonus|total.*tt$|tooltip/i;

const DAMAGE_NAME=/damage|dmg/i;

export interface AbilityCalculation{
  name:string;
  value:number|null;
  unmodelled:string[];
  /** True for the one folded into this ability's damage. */
  primary:boolean;
}

export interface AssembledAbility{
  slot:AbilitySlot;
  name:string;
  rank:number;
  maxRank:number;
  cooldownSeconds:number;
  cost:number;
  rangeUnits:number|null;
  castTimeSeconds:number;
  damage:DamageComponent[];
  /** Every calculation on the ability, primary or not. */
  calculations:AbilityCalculation[];
  confidence:ConfidenceReport;
  /** Set when the ability has calculations this does not fold into damage. */
  variantNote?:string;
}

export interface AssembleOptions{
  caster:CombatStats;
  level:number;
  /** Rank per slot. Clamped to the ability's own max rank. */
  ranks:Partial<Record<AbilitySlot,number>>;
  /** Riot rates damage type per champion, not per ability; see the note below. */
  damageType:DamageType;
}

export interface AssembledKit{
  abilities:Partial<Record<AbilitySlot,AssembledAbility>>;
  models:Partial<Record<AbilitySlot,AbilityModel>>;
  confidence:ConfidenceReport;
}

export function assembleKit(
  dataDragonSpells:DataDragonSpell[],
  gameFileSpells:NormalisedSpell[],
  opts:AssembleOptions,
):AssembledKit{
  const byName=new Map(gameFileSpells.map(s=>[s.name.toLowerCase(),s]));
  const abilities:Partial<Record<AbilitySlot,AssembledAbility>>={};
  const models:Partial<Record<AbilitySlot,AbilityModel>>={};

  SLOTS.forEach((slot,index)=>{
    const dd=dataDragonSpells[index];
    if(!dd)return;
    const game=byName.get(String(dd.id).toLowerCase());
    const assembled=assembleAbility(slot,dd,game,opts);
    abilities[slot]=assembled;
    models[slot]={
      slot,
      name:assembled.name,
      rank:assembled.rank,
      cooldownSeconds:assembled.cooldownSeconds,
      cost:assembled.cost,
      castTimeSeconds:assembled.castTimeSeconds,
      damage:assembled.damage,
    };
  });

  return {
    abilities,
    models,
    confidence:combineConfidence(
      Object.values(abilities).map(a=>a.confidence)),
  };
}

function assembleAbility(
  slot:AbilitySlot,
  dd:DataDragonSpell,
  game:NormalisedSpell|undefined,
  opts:AssembleOptions,
):AssembledAbility{
  const maxRank=dd.maxrank??(slot==='R'?3:5);
  const rank=clamp(opts.ranks[slot]??1,1,maxRank);

  // Data Dragon's per-rank arrays are 0-indexed by rank, unlike the game files.
  const cooldown=pick(dd.cooldown,rank-1)??0;
  const cost=pick(dd.cost,rank-1)??0;
  const range=pick(dd.range,rank-1)??null;

  const calculations:AbilityCalculation[]=[];
  const dataValues:SpellDataValue[]=game?.dataValues??[];

  if(game){
    for(const [name,calculation] of Object.entries(game.calculations)){
      const result=evaluateCalculation(calculation,{
        caster:opts.caster,
        level:opts.level,
        rank,
        dataValues,
        calculations:game.calculations,
        effectAmounts:game.effectAmounts,
      });
      // Rounded here rather than at display time so the figure the UI shows and
      // the figure the combo sums are the same number. A tenth of a point of
      // damage is below the precision any of this data justifies anyway.
      calculations.push({
        name,
        value:result.value===null?null:Math.round(result.value*10)/10,
        unmodelled:result.unmodelled,
        primary:false,
      });
    }
  }

  const primary=choosePrimary(calculations);
  if(primary)primary.primary=true;

  const damage:DamageComponent[]=primary
    ?[{
      label:primary.name,
      type:opts.damageType,
      raw:primary.value,
      unmodelled:primary.unmodelled,
    }]
    :[];

  const unsummed=calculations.filter(c=>!c.primary&&c.value!==null);

  return {
    slot,
    name:dd.name||slot,
    rank,maxRank,
    cooldownSeconds:cooldown,
    cost,
    rangeUnits:range,
    castTimeSeconds:game?.castTime??0.25,
    damage,
    calculations,
    /*
     * Confidence covers EVERY calculation on the ability, not just the chosen
     * one.
     *
     * choosePrimary prefers a calculation that resolves, which means an ability
     * carrying one good figure and one stack-scaling figure it could not resolve
     * would otherwise report HIGH — quietly dropping the mechanic the champion
     * is built around. Kindred did exactly that: her marks scaling is what the
     * engine cannot model, and reading only the primary made her look fully
     * simulated.
     *
     * Erring conservative is the right direction. The causes name themselves, so
     * a player sees which mechanic is missing rather than just a lower rating.
     */
    confidence:assessConfidence({
      unmodelled:calculations.length
        ?calculations.flatMap(c=>c.unmodelled)
        :[],
    }),
    variantNote:unsummed.length
      ?`${dd.name} also publishes ${unsummed.map(c=>c.name).join(', ')}. Those are alternatives to the figure shown, not additions to it, so they are not summed.`
      :undefined,
  };
}

/**
 * One calculation per ability, never a sum.
 *
 * Preference order: a name that reads as damage and is not a variant, then any
 * non-variant, then anything at all. A damageless ability — Darius's Apprehend —
 * correctly yields nothing.
 */
function choosePrimary(calculations:AbilityCalculation[]):AbilityCalculation|null{
  const resolved=calculations.filter(c=>c.value!==null);
  const pool=resolved.length?resolved:calculations;
  if(!pool.length)return null;

  return pool.find(c=>DAMAGE_NAME.test(c.name)&&!VARIANT.test(c.name))
    ??pool.find(c=>!VARIANT.test(c.name))
    ??pool[0];
}

/**
 * Riot publishes a damage rating per champion, not per ability, so every
 * ability on a champion is typed the same way here. That is a real
 * simplification — a physical champion with one magic ability will have that
 * ability mitigated by the wrong resistance — and it is why the damage type is
 * an explicit input rather than something this module decides quietly.
 */
export const DAMAGE_TYPE_NOTE=
  'Damage type is taken from Riot\'s per-champion rating, because the files do '+
  'not label it per ability. A champion with one off-type ability will have '+
  'that ability mitigated by the wrong resistance.';

const pick=(values:number[]|undefined,index:number):number|null=>{
  if(!Array.isArray(values)||!values.length)return null;
  const safe=Math.min(values.length-1,Math.max(0,index));
  const value=values[safe];
  return typeof value==='number'&&Number.isFinite(value)?value:null;
};

const clamp=(n:number,lo:number,hi:number)=>
  Math.min(hi,Math.max(lo,Number.isFinite(n)?Math.round(n):lo));

/**
 * Riot's champion rating can be MIXED. A damage instance cannot be — it is
 * mitigated by armour or by magic resist, not by an average of the two.
 *
 * So a mixed champion is resolved to whichever rating is higher, and when the
 * two are equal there is genuinely no signal in the data and the caller is told
 * so rather than being handed a coin flip dressed as a fact. A champion with one
 * off-type ability is mitigated by the wrong resistance either way, which is
 * what DAMAGE_TYPE_NOTE exists to say.
 */
export function combatDamageType(info:ChampionInfo):{
  type:Exclude<DamageType,'TRUE'>;
  approximations:string[];
}{
  if(info.attack>info.magic)return {type:'PHYSICAL',approximations:[]};
  if(info.magic>info.attack)return {type:'MAGIC',approximations:[]};
  return {
    type:'MAGIC',
    approximations:[
      `Riot rates this champion equally for attack and magic (${info.attack}/10 each), `+
      'so the files give no signal for which resistance their abilities are '+
      'mitigated by. Magic is assumed.',
    ],
  };
}

/**
 * Ranks a champion would have at a level: ultimate at 6/11/16, basics maxed in
 * Q, W, E order. A caller may override any of them.
 */
export function defaultRanks(level:number):Partial<Record<AbilitySlot,number>>{
  const basics:Record<'Q'|'W'|'E',number>={Q:0,W:0,E:0};
  let ult=0;
  const order:('Q'|'W'|'E')[]=['Q','W','E'];

  for(let l=1;l<=Math.min(18,Math.max(1,level));l++){
    if((l===6||l===11||l===16)&&ult<3){ult++;continue}
    if(l<=3){basics[order[l-1]]++;continue}
    const next=order.find(slot=>basics[slot]<5);
    if(next)basics[next]++;
  }

  return {
    Q:Math.max(1,basics.Q),
    W:Math.max(1,basics.W),
    E:Math.max(1,basics.E),
    R:Math.max(1,ult),
  };
}
