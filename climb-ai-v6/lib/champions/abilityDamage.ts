import type {ChampionStatBlock} from './ddragon';
import {combatProfile,type ItemStats} from './dps';
import {statsAtLevel} from './ddragon';

export type AbilitySlot='P'|'Q'|'W'|'E'|'R';

export interface AbilityModifier{
  values:number[];
  units:string[];
}

export interface AbilityLeveling{
  attribute:string;
  modifiers:AbilityModifier[];
}

export interface AbilityEffect{
  description:string;
  leveling:AbilityLeveling[];
}

export interface ChampionAbility{
  name:string;
  icon:string;
  effects:AbilityEffect[];
  cooldown?:{modifiers:AbilityModifier[];affectedByCdr?:boolean}|null;
  cost?:{modifiers:AbilityModifier[]}|null;
  targeting?:string|null;
  damageType?:string|null;
  blurb?:string|null;
  notes?:string|null;
}

export interface ChampionAbilityDataset{
  source:'MERAKI';
  patchLastChanged?:string|null;
  abilities:Partial<Record<AbilitySlot,ChampionAbility[]>>;
}

export interface AbilityDamageContext{
  level:number;
  abilityPower:number;
  totalAttackDamage:number;
  baseAttackDamage:number;
  bonusAttackDamage:number;
  maxHealth:number;
  bonusHealth:number;
  armor:number;
  bonusArmor:number;
  magicResistance:number;
  bonusMagicResistance:number;
  maxMana:number;
  bonusMana:number;
  attackSpeed:number;
  bonusAttackSpeedPercent:number;
  critChancePercent:number;
}

export interface AbilityDamageCell{
  rank:number;
  value:number|null;
  exact:boolean;
  unresolved:string[];
}

export interface AbilityDamageRow{
  id:string;
  slot:AbilitySlot;
  ability:string;
  icon:string;
  damageType:string;
  attribute:string;
  ranks:AbilityDamageCell[];
}

const DAMAGE_ATTRIBUTE=/damage/i;
const NOT_DAMAGE=/(damage reduction|damage taken|damage received|damage amp|damage amplification|reduced damage)/i;

export function buildAbilityContext(
  base:ChampionStatBlock,
  level:number,
  bonuses:ItemStats,
):AbilityDamageContext{
  const baseLevel=statsAtLevel(base,level);
  const current=combatProfile(base,level,bonuses);
  return {
    level,
    abilityPower:current.abilityPower,
    totalAttackDamage:current.attackDamage,
    baseAttackDamage:baseLevel.attackDamage,
    bonusAttackDamage:Math.max(0,current.attackDamage-baseLevel.attackDamage),
    maxHealth:baseLevel.hp+bonuses.health,
    bonusHealth:Math.max(0,bonuses.health),
    armor:baseLevel.armor+bonuses.armor,
    bonusArmor:Math.max(0,bonuses.armor),
    magicResistance:baseLevel.magicResist+bonuses.magicResist,
    bonusMagicResistance:Math.max(0,bonuses.magicResist),
    maxMana:baseLevel.mana,
    bonusMana:0,
    attackSpeed:current.attackSpeed,
    bonusAttackSpeedPercent:Math.max(0,(baseLevel.bonusAttackSpeedRatio+bonuses.attackSpeedRatio)*100),
    critChancePercent:current.critChance*100,
  };
}

export function abilityDamageRows(
  dataset:ChampionAbilityDataset|undefined|null,
  context:AbilityDamageContext,
):AbilityDamageRow[]{
  if(!dataset)return[];
  const rows:AbilityDamageRow[]=[];
  const slots:AbilitySlot[]=['P','Q','W','E','R'];

  for(const slot of slots){
    const variants=dataset.abilities[slot]??[];
    variants.forEach((ability,variantIndex)=>{
      ability.effects?.forEach((effect,effectIndex)=>{
        effect.leveling?.forEach((leveling,levelIndex)=>{
          if(!DAMAGE_ATTRIBUTE.test(leveling.attribute)||NOT_DAMAGE.test(leveling.attribute))return;
          const rankCount=Math.max(1,...(leveling.modifiers??[]).map(mod=>mod.values?.length??0));
          const ranks:Array<AbilityDamageCell>=[];
          for(let rank=1;rank<=rankCount;rank++){
            const result=evaluateLeveling(leveling,rank,context);
            ranks.push({rank,...result});
          }
          rows.push({
            id:`${slot}-${variantIndex}-${effectIndex}-${levelIndex}-${leveling.attribute}`,
            slot,
            ability:ability.name,
            icon:ability.icon,
            damageType:String(ability.damageType||'').replaceAll('_',' '),
            attribute:leveling.attribute,
            ranks,
          });
        });
      });
    });
  }
  return rows;
}

function evaluateLeveling(
  leveling:AbilityLeveling,
  rank:number,
  context:AbilityDamageContext,
):Omit<AbilityDamageCell,'rank'>{
  let total=0;
  let hasKnown=false;
  const unresolved:string[]=[];

  for(const modifier of leveling.modifiers??[]){
    const index=Math.min(Math.max(0,rank-1),Math.max(0,(modifier.values?.length??1)-1));
    const raw=Number(modifier.values?.[index]);
    if(!Number.isFinite(raw))continue;
    const unit=String(modifier.units?.[index]??modifier.units?.[0]??'').trim();
    const resolved=resolveModifier(raw,unit,context);
    if(resolved.value!==null){
      total+=resolved.value;
      hasKnown=true;
    }
    if(!resolved.exact&&unit)unresolved.push(unit);
  }

  return {
    value:hasKnown?round(total):null,
    exact:unresolved.length===0,
    unresolved:[...new Set(unresolved)],
  };
}

function resolveModifier(
  amount:number,
  unit:string,
  context:AbilityDamageContext,
):{value:number|null;exact:boolean}{
  const u=normaliseUnit(unit);
  if(!u)return{value:amount,exact:true};

  // Anything based on the enemy, stacks, marks, distance, missing health or
  // another conditional game state is deliberately not guessed.
  if(
    /target|enemy|missing health|current health|per stack|stacks|distance|charge|marks|souls|mist|feathers|chimes|level of|number of/i.test(u)
  )return{value:null,exact:false};

  const percent=(stat:number)=>amount/100*stat;

  if(matches(u,['% ap','% ability power']))return{value:percent(context.abilityPower),exact:true};
  if(matches(u,['% bonus ad','% bonus attack damage']))return{value:percent(context.bonusAttackDamage),exact:true};
  if(matches(u,['% base ad','% base attack damage']))return{value:percent(context.baseAttackDamage),exact:true};
  if(matches(u,['% ad','% total ad','% attack damage','% total attack damage']))return{value:percent(context.totalAttackDamage),exact:true};
  if(matches(u,['% bonus health']))return{value:percent(context.bonusHealth),exact:true};
  if(matches(u,['% maximum health','% max health','% health']))return{value:percent(context.maxHealth),exact:true};
  if(matches(u,['% bonus armor']))return{value:percent(context.bonusArmor),exact:true};
  if(matches(u,['% armor','% total armor']))return{value:percent(context.armor),exact:true};
  if(matches(u,['% bonus magic resistance','% bonus mr']))return{value:percent(context.bonusMagicResistance),exact:true};
  if(matches(u,['% magic resistance','% total magic resistance','% mr']))return{value:percent(context.magicResistance),exact:true};
  if(matches(u,['% maximum mana','% max mana','% mana']))return{value:percent(context.maxMana),exact:true};
  if(matches(u,['% bonus mana']))return{value:percent(context.bonusMana),exact:true};
  if(matches(u,['% bonus attack speed']))return{value:percent(context.bonusAttackSpeedPercent),exact:true};
  if(matches(u,['% attack speed']))return{value:percent(context.attackSpeed*100),exact:true};
  if(matches(u,['% critical strike chance','% crit chance']))return{value:percent(context.critChancePercent),exact:true};

  // Some exports use a plain multiplier suffix for a stat instead of a
  // percentage. These are uncommon but safe to support.
  if(matches(u,['ap']))return{value:amount*context.abilityPower,exact:true};
  if(matches(u,['bonus ad','bonus attack damage']))return{value:amount*context.bonusAttackDamage,exact:true};
  if(matches(u,['ad','total ad','attack damage']))return{value:amount*context.totalAttackDamage,exact:true};

  return{value:null,exact:false};
}

const normaliseUnit=(unit:string)=>unit.toLowerCase().replace(/\s+/g,' ').trim();
const matches=(unit:string,values:string[])=>values.includes(unit);
const round=(value:number)=>Math.round(value*10)/10;
