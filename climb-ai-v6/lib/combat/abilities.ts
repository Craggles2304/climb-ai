import {
  CombatStats,SpellDataValue,evaluateCalculation,
} from './formula';
import {NormalisedSpell} from './importSpells';
import {DamageComponent,DamageType} from './damage';
import type {ChampionInfo} from '../champions/ddragon';
import {AbilityModel,AbilitySlot} from './combos';
import {ConfidenceReport,assessConfidence,combineConfidence} from './confidence';

/**
 * Assembles Q/W/E/R from Riot identity data + CommunityDragon formula data.
 *
 * Damage type is resolved at ability level whenever either source says what the
 * damage actually is. Champion attack/magic rating is now only a conservative
 * fallback rather than being stamped onto every Q/W/E/R.
 */
export interface DataDragonSpell{
  id:string;
  name:string;
  maxrank?:number;
  cooldown?:number[];
  cost?:number[];
  range?:number[];
  description?:string;
  tooltip?:string;
}

export const SLOTS:AbilitySlot[]=['Q','W','E','R'];

const VARIANT=/maximum|minimum|\bmax\b|\bmin\b|monster|minion|empowered|crit|handle|secondary|bonus|total.*tt$|tooltip/i;
const DAMAGE_NAME=/damage|dmg/i;

export interface AbilityCalculation{
  name:string;
  value:number|null;
  unmodelled:string[];
  primary:boolean;
}

export type AbilityDamageTypeSource=
  |'CALCULATION_NAME'
  |'SPELL_TEXT'
  |'CHAMPION_FALLBACK'
  |'NONE';

export interface AbilityDamageTypeResolution{
  type:DamageType|null;
  source:AbilityDamageTypeSource;
  approximations:string[];
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
  calculations:AbilityCalculation[];
  /** Damage type of the primary damage component; null for non-damaging spells. */
  damageType:DamageType|null;
  damageTypeSource:AbilityDamageTypeSource;
  /** Human-readable evidence/fallback warning when useful. */
  damageTypeNote?:string;
  confidence:ConfidenceReport;
  variantNote?:string;
}

export interface AssembleOptions{
  caster:CombatStats;
  level:number;
  ranks:Partial<Record<AbilitySlot,number>>;
  /** Champion-level fallback used only when spell-level evidence is ambiguous. */
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
    confidence:combineConfidence(Object.values(abilities).map(a=>a.confidence)),
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

  const typeResolution=resolveAbilityDamageType(dd,primary,opts.damageType);
  const damage:DamageComponent[]=primary&&typeResolution.type
    ?[{
      label:primary.name,
      type:typeResolution.type,
      raw:primary.value,
      unmodelled:primary.unmodelled,
    }]
    :[];

  const unsummed=calculations.filter(c=>!c.primary&&c.value!==null);
  const formulaConfidence=assessConfidence({
    unmodelled:calculations.length?calculations.flatMap(c=>c.unmodelled):[],
  });
  const typeConfidence=assessConfidence({
    approximations:typeResolution.approximations,
  });

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
    damageType:typeResolution.type,
    damageTypeSource:typeResolution.source,
    damageTypeNote:typeResolution.approximations[0]
      ??damageTypeEvidenceNote(typeResolution),
    confidence:combineConfidence([formulaConfidence,typeConfidence]),
    variantNote:unsummed.length
      ?`${dd.name} also publishes ${unsummed.map(c=>c.name).join(', ')}. Those are alternatives to the figure shown, not additions to it, so they are not summed.`
      :undefined,
  };
}

function choosePrimary(calculations:AbilityCalculation[]):AbilityCalculation|null{
  const resolved=calculations.filter(c=>c.value!==null);
  const pool=resolved.length?resolved:calculations;
  if(!pool.length)return null;
  return pool.find(c=>DAMAGE_NAME.test(c.name)&&!VARIANT.test(c.name))
    ??pool.find(c=>!VARIANT.test(c.name))
    ??pool[0];
}

/**
 * Resolve the resistance bucket for the primary ability component.
 *
 * Priority is deliberately strict:
 * 1. Explicit CommunityDragon calculation name such as MagicDamage.
 * 2. Exactly one explicit type in Riot spell markup/text.
 * 3. Champion-level fallback, with an approximation reason.
 *
 * If the spell names several damage types we do not choose whichever appears
 * first. The current primary-formula model cannot safely split that formula into
 * separate typed components, so confidence is lowered instead.
 */
export function resolveAbilityDamageType(
  dd:DataDragonSpell,
  primary:Pick<AbilityCalculation,'name'>|null,
  fallback:DamageType,
):AbilityDamageTypeResolution{
  if(!primary)return {type:null,source:'NONE',approximations:[]};

  const calculationTypes=explicitTypes(primary.name);
  if(calculationTypes.length===1){
    return {type:calculationTypes[0],source:'CALCULATION_NAME',approximations:[]};
  }
  if(calculationTypes.length>1){
    return fallbackResolution(
      dd,fallback,
      `${dd.name} calculation "${primary.name}" names multiple damage types. The current single-primary-component model cannot split them safely, so ${fallbackLabel(fallback)} is used as a fallback.`,
    );
  }

  const spellText=[dd.description,dd.tooltip].filter(Boolean).join(' ');
  const textTypes=explicitTypes(spellText);
  if(textTypes.length===1){
    return {type:textTypes[0],source:'SPELL_TEXT',approximations:[]};
  }
  if(textTypes.length>1){
    return fallbackResolution(
      dd,fallback,
      `${dd.name} names multiple damage types in Riot spell text (${textTypes.map(labelType).join(' + ')}). The current primary formula cannot be split confidently, so ${fallbackLabel(fallback)} is used for this component.`,
    );
  }

  return fallbackResolution(
    dd,fallback,
    `${dd.name} does not expose an unambiguous per-ability damage type in its calculation name or Riot spell text. ${fallbackLabel(fallback)} is used from the champion-level fallback.`,
  );
}

function explicitTypes(value:string):DamageType[]{
  if(!value)return [];
  const found=new Set<DamageType>();
  const compact=value.toLowerCase().replace(/[^a-z]/g,'');
  if(compact.includes('physicaldamage'))found.add('PHYSICAL');
  if(compact.includes('magicdamage'))found.add('MAGIC');
  if(compact.includes('truedamage'))found.add('TRUE');

  // Data Dragon commonly uses semantic markup such as <magicDamage> as well as
  // natural-language "magic damage". compact detection catches both forms.
  return [...found];
}

function fallbackResolution(
  _dd:DataDragonSpell,
  fallback:DamageType,
  reason:string,
):AbilityDamageTypeResolution{
  return {type:fallback,source:'CHAMPION_FALLBACK',approximations:[reason]};
}

function damageTypeEvidenceNote(result:AbilityDamageTypeResolution):string|undefined{
  if(!result.type)return undefined;
  if(result.source==='CALCULATION_NAME')return `${labelType(result.type)} damage type resolved from the CommunityDragon calculation name.`;
  if(result.source==='SPELL_TEXT')return `${labelType(result.type)} damage type resolved from Riot spell text.`;
  return undefined;
}

const labelType=(type:DamageType)=>type==='TRUE'?'true':type==='MAGIC'?'magic':'physical';
const fallbackLabel=(type:DamageType)=>`${labelType(type)} damage`;

export const DAMAGE_TYPE_NOTE=
  'Ability damage type is resolved per spell from explicit CommunityDragon calculation names or Riot spell text. Champion-level attack/magic rating is used only when spell-level evidence is missing or ambiguous; mixed-type abilities remain approximate until one formula can be split into typed components.';

const pick=(values:number[]|undefined,index:number):number|null=>{
  if(!Array.isArray(values)||!values.length)return null;
  const safe=Math.min(values.length-1,Math.max(0,index));
  const value=values[safe];
  return typeof value==='number'&&Number.isFinite(value)?value:null;
};

const clamp=(n:number,lo:number,hi:number)=>
  Math.min(hi,Math.max(lo,Number.isFinite(n)?Math.round(n):lo));

/** Champion rating is retained only as a last-resort ability-type fallback. */
export function combatDamageType(info:ChampionInfo):{
  type:Exclude<DamageType,'TRUE'>;
  approximations:string[];
}{
  if(info.attack>info.magic)return {type:'PHYSICAL',approximations:[]};
  if(info.magic>info.attack)return {type:'MAGIC',approximations:[]};
  return {
    type:'MAGIC',
    approximations:[
      `Riot rates this champion equally for attack and magic (${info.attack}/10 each), so the champion-level fallback has no clear resistance signal. Magic is used only where spell-level evidence also cannot resolve the type.`,
    ],
  };
}

/**
 * Ranks a champion would have at a level: ultimate at 6/11/16, basics maxed in
 * Q, W, E order. Kept for older callers; Matchup Lab normally uses skillRanks.
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
