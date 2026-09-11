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
 * A spell may now carry several independently typed damage components. We only
 * sum them when the source proves they are separate components; alternative
 * maximum/minimum/empowered/crit variants remain unsummed.
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

/** Alternative calculations which must never be automatically added together. */
const HARD_VARIANT=/maximum|minimum|\bmax\b|\bmin\b|monster|minion|empowered|crit|handle|secondary|tooltip/i;
const VARIANT=/maximum|minimum|\bmax\b|\bmin\b|monster|minion|empowered|crit|handle|secondary|bonus|total.*tt$|tooltip/i;
const DAMAGE_NAME=/damage|dmg/i;

export interface AbilityCalculation{
  name:string;
  value:number|null;
  unmodelled:string[];
  /** True when this calculation is folded into the ability damage total. */
  primary:boolean;
}

export type AbilityDamageTypeSource=
  |'CALCULATION_NAME'
  |'SPELL_TEXT'
  |'MULTI_COMPONENT'
  |'CHAMPION_FALLBACK'
  |'NONE';

export interface AbilityDamageTypeResolution{
  type:DamageType|null;
  source:AbilityDamageTypeSource;
  approximations:string[];
}

export interface AbilityDamageComponentResolution{
  calculation:AbilityCalculation;
  type:DamageType;
  source:'CALCULATION_NAME'|'SPELL_TEXT'|'CHAMPION_FALLBACK';
}

export interface AbilityDamageComponentsResolution{
  components:AbilityDamageComponentResolution[];
  approximations:string[];
  mixed:boolean;
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
  /** Single damage type when homogeneous; null for non-damaging or mixed spells. */
  damageType:DamageType|null;
  /** All resistance buckets represented by included damage components. */
  damageTypes:DamageType[];
  damageTypeSource:AbilityDamageTypeSource;
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
      rangeUnits:assembled.rangeUnits,
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

  const componentResolution=resolveAbilityDamageComponents(dd,calculations,opts.damageType);
  for(const component of componentResolution.components)component.calculation.primary=true;

  const damage:DamageComponent[]=componentResolution.components.map(component=>({
    label:component.calculation.name,
    type:component.type,
    raw:component.calculation.value,
    unmodelled:component.calculation.unmodelled,
  }));

  const damageTypes=[...new Set(componentResolution.components.map(c=>c.type))];
  const damageType=damageTypes.length===1?damageTypes[0]:null;
  const damageTypeSource:AbilityDamageTypeSource=componentResolution.mixed
    ?'MULTI_COMPONENT'
    :componentResolution.components[0]?.source??'NONE';

  const unsummed=calculations.filter(c=>!c.primary&&c.value!==null);
  const formulaConfidence=assessConfidence({
    unmodelled:calculations.length?calculations.flatMap(c=>c.unmodelled):[],
  });
  const typeConfidence=assessConfidence({
    approximations:componentResolution.approximations,
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
    damageType,
    damageTypes,
    damageTypeSource,
    damageTypeNote:componentResolution.approximations[0]
      ??damageComponentEvidenceNote(componentResolution),
    confidence:combineConfidence([formulaConfidence,typeConfidence]),
    variantNote:unsummed.length
      ?`${dd.name} also publishes ${unsummed.map(c=>c.name).join(', ')}. Those calculations are not added because the engine cannot prove they are extra simultaneous damage components rather than variants or auxiliary values.`
      :undefined,
  };
}

/**
 * Resolve every damage component we can prove belongs to the same cast.
 *
 * Multi-component inclusion is intentionally strict. A spell becomes mixed only
 * when at least two different damage types are attached to separate calculations
 * by one of these strong signals:
 *   - the calculation name itself says PhysicalDamage/MagicDamage/TrueDamage; or
 *   - Riot semantic tooltip markup binds that calculation variable inside the
 *     corresponding <physicalDamage>/<magicDamage>/<trueDamage> tag.
 *
 * We never split a single total formula merely because prose says "physical and
 * magic damage". Without separate formula values there is no mathematically safe
 * way to know how much belongs in each resistance bucket.
 */
export function resolveAbilityDamageComponents(
  dd:DataDragonSpell,
  calculations:AbilityCalculation[],
  fallback:DamageType,
):AbilityDamageComponentsResolution{
  if(!calculations.length)return {components:[],approximations:[],mixed:false};

  const bindings=semanticDamageBindings([dd.description,dd.tooltip].filter(Boolean).join(' '));
  const strong:AbilityDamageComponentResolution[]=[];

  for(const calculation of calculations){
    if(HARD_VARIANT.test(calculation.name))continue;

    const nameTypes=explicitTypes(calculation.name);
    if(nameTypes.length===1){
      strong.push({calculation,type:nameTypes[0],source:'CALCULATION_NAME'});
      continue;
    }
    if(nameTypes.length>1)continue;

    const bound=bindings.get(normaliseKey(calculation.name));
    if(bound){
      strong.push({calculation,type:bound,source:'SPELL_TEXT'});
    }
  }

  const distinctTypes=[...new Set(strong.map(c=>c.type))];
  if(distinctTypes.length>=2){
    const components:AbilityDamageComponentResolution[]=[];
    for(const type of distinctTypes){
      const options=strong.filter(c=>c.type===type);
      const chosen=chooseStrongComponent(options);
      if(chosen)components.push(chosen);
    }
    return {components,approximations:[],mixed:true};
  }

  const primary=choosePrimary(calculations);
  if(!primary)return {components:[],approximations:[],mixed:false};
  const single=resolveAbilityDamageType(dd,primary,fallback);
  if(!single.type)return {components:[],approximations:single.approximations,mixed:false};
  return {
    components:[{calculation:primary,type:single.type,source:single.source==='CHAMPION_FALLBACK'?'CHAMPION_FALLBACK':single.source==='SPELL_TEXT'?'SPELL_TEXT':'CALCULATION_NAME'}],
    approximations:single.approximations,
    mixed:false,
  };
}

function chooseStrongComponent(
  options:AbilityDamageComponentResolution[],
):AbilityDamageComponentResolution|undefined{
  if(!options.length)return undefined;
  const resolved=options.filter(o=>o.calculation.value!==null);
  const pool=resolved.length?resolved:options;
  return pool.find(o=>!VARIANT.test(o.calculation.name))??pool[0];
}

function choosePrimary(calculations:AbilityCalculation[]):AbilityCalculation|null{
  const resolved=calculations.filter(c=>c.value!==null);
  const pool=resolved.length?resolved:calculations;
  if(!pool.length)return null;
  return pool.find(c=>DAMAGE_NAME.test(c.name)&&!VARIANT.test(c.name))
    ??pool.find(c=>!VARIANT.test(c.name))
    ??pool[0];
}

/** Resolve the resistance bucket for a single damage calculation. */
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
      fallback,
      `${dd.name} calculation "${primary.name}" names multiple damage types. One formula cannot be split safely, so ${fallbackLabel(fallback)} is used as a fallback.`,
    );
  }

  const bindings=semanticDamageBindings([dd.description,dd.tooltip].filter(Boolean).join(' '));
  const bound=bindings.get(normaliseKey(primary.name));
  if(bound)return {type:bound,source:'SPELL_TEXT',approximations:[]};

  const spellText=[dd.description,dd.tooltip].filter(Boolean).join(' ');
  const textTypes=explicitTypes(spellText);
  if(textTypes.length===1){
    return {type:textTypes[0],source:'SPELL_TEXT',approximations:[]};
  }
  if(textTypes.length>1){
    return fallbackResolution(
      fallback,
      `${dd.name} names multiple damage types in Riot spell text (${textTypes.map(labelType).join(' + ')}), but does not expose separate typed formulas the engine can bind confidently. ${fallbackLabel(fallback)} is used for this component.`,
    );
  }

  return fallbackResolution(
    fallback,
    `${dd.name} does not expose an unambiguous per-ability damage type in its calculation name or Riot spell text. ${fallbackLabel(fallback)} is used from the champion-level fallback.`,
  );
}

/**
 * Map Riot semantic tooltip variables to resistance buckets, e.g.
 * <magicDamage>{{ magicdamage }}</magicDamage>.
 */
function semanticDamageBindings(value:string):Map<string,DamageType>{
  const out=new Map<string,DamageType>();
  const tags:{name:string;type:DamageType}[]=[
    {name:'physicaldamage',type:'PHYSICAL'},
    {name:'magicdamage',type:'MAGIC'},
    {name:'truedamage',type:'TRUE'},
  ];

  for(const tag of tags){
    const regex=new RegExp(`<${tag.name}[^>]*>([\\s\\S]*?)<\\/${tag.name}>`,'gi');
    let match:RegExpExecArray|null;
    while((match=regex.exec(value))!==null){
      const body=match[1]??'';
      const variable=/\{\{\s*([^}|]+?)(?:\|[^}]*)?\s*\}\}/g;
      let token:RegExpExecArray|null;
      while((token=variable.exec(body))!==null){
        const key=normaliseKey(token[1]??'');
        if(key)out.set(key,tag.type);
      }
    }
  }
  return out;
}

function explicitTypes(value:string):DamageType[]{
  if(!value)return [];
  const found=new Set<DamageType>();
  const compact=value.toLowerCase().replace(/[^a-z]/g,'');
  if(compact.includes('physicaldamage'))found.add('PHYSICAL');
  if(compact.includes('magicdamage'))found.add('MAGIC');
  if(compact.includes('truedamage'))found.add('TRUE');
  return [...found];
}

function fallbackResolution(
  fallback:DamageType,
  reason:string,
):AbilityDamageTypeResolution{
  return {type:fallback,source:'CHAMPION_FALLBACK',approximations:[reason]};
}

function damageComponentEvidenceNote(result:AbilityDamageComponentsResolution):string|undefined{
  if(result.components.length>1){
    return `Mixed damage resolved as ${result.components.map(c=>`${c.calculation.name}: ${labelType(c.type)}`).join(' + ')}; each component is mitigated independently.`;
  }
  const component=result.components[0];
  if(!component)return undefined;
  if(component.source==='CALCULATION_NAME')return `${labelType(component.type)} damage type resolved from the CommunityDragon calculation name.`;
  if(component.source==='SPELL_TEXT')return `${labelType(component.type)} damage type resolved from Riot spell text.`;
  return undefined;
}

const normaliseKey=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
const labelType=(type:DamageType)=>type==='TRUE'?'true':type==='MAGIC'?'magic':'physical';
const fallbackLabel=(type:DamageType)=>`${labelType(type)} damage`;

export const DAMAGE_TYPE_NOTE=
  'Ability damage is split into independently mitigated physical, magic and true components when CommunityDragon calculation names or Riot semantic tooltip bindings prove separate formulas belong to the same cast. Ambiguous mixed prose is never numerically split; champion-level damage type is only a fallback.';

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
