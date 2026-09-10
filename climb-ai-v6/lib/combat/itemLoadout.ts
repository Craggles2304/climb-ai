import type {DataDragonItemFull} from '@/lib/champions/source';
import {addStats,emptyStats,parseItemStats,type ItemStats} from '@/lib/champions/dps';
import type {OnHitEffect} from './effects';

export type MatchupItem=DataDragonItemFull&{
  description?:string;
  plaintext?:string;
  image?:{full?:string};
};

/**
 * Stats and deterministic attack effects derived from the items the player
 * selected. Item text that cannot be resolved cleanly is kept as an explicit
 * approximation rather than guessed into the damage total.
 */
export interface LoadoutStats extends ItemStats{
  abilityHaste:number;
  lethality:number;
  mana:number;
  flatMagicPen:number;
  percentMagicPen:number;
  percentArmorPen:number;
}

export interface LoadoutItem{
  id:number;
  name:string;
  gold:number;
  image:string|null;
  tags:string[];
}

export interface LoadoutResult{
  stats:LoadoutStats;
  items:LoadoutItem[];
  totalGold:number;
  onHits:OnHitEffect[];
  approximations:string[];
}

export const emptyLoadoutStats=():LoadoutStats=>({
  ...emptyStats(),abilityHaste:0,lethality:0,mana:0,
  flatMagicPen:0,percentMagicPen:0,percentArmorPen:0,
});

export function buildLoadout(
  catalogue:Record<string,MatchupItem>,ids:number[],casterAbilityPower=0,
):LoadoutResult{
  let stats=emptyLoadoutStats();
  const items:LoadoutItem[]=[];
  const approximations:string[]=[];

  for(const id of ids.slice(0,6)){
    const item=catalogue[String(id)];
    if(!item){
      approximations.push(`Item ${id} was not found in this patch and was ignored.`);
      continue;
    }
    stats=addLoadoutStats(stats,statsFromItem(item));
    items.push({
      id,name:item.name,gold:item.gold?.total??0,
      image:item.image?.full??null,tags:item.tags??[],
    });
  }

  // AP has to be known after the whole build is summed because Nashor-like
  // effects scale from total AP rather than the AP of the item itself.
  const finalAp=casterAbilityPower+stats.abilityPower;
  const onHits:OnHitEffect[]=[];
  for(const selected of items){
    const item=catalogue[String(selected.id)];
    if(!item)continue;
    const parsed=parseOnHit(item,finalAp);
    if(parsed.length)onHits.push(...parsed);
    else if(hasCombatPassive(item))
      approximations.push(`${item.name} has a combat passive/active that is not yet included in the deterministic damage total.`);
  }

  return {
    stats,items,totalGold:items.reduce((sum,item)=>sum+item.gold,0),
    onHits,approximations,
  };
}

export function statsFromItem(item:MatchupItem):LoadoutStats{
  const base=parseItemStats(item.stats);
  const raw=item.stats??{};
  const text=plainText(item);
  const value=(key:string)=>Number.isFinite(raw[key])?raw[key]:0;

  return {
    ...base,
    abilityHaste:namedNumber(text,'Ability Haste'),
    lethality:namedNumber(text,'Lethality'),
    mana:value('FlatMPPoolMod'),
    flatMagicPen:value('FlatMagicPenetrationMod')||namedNumber(text,'Magic Penetration'),
    percentMagicPen:normaliseRatio(value('PercentMagicPenetrationMod')||namedPercent(text,'Magic Penetration')),
    percentArmorPen:normaliseRatio(value('PercentArmorPenetrationMod')||namedPercent(text,'Armor Penetration')),
  };
}

/**
 * Models the common item wording Riot exposes with concrete numbers:
 *   "Attacks deal 15 bonus physical damage On-Hit"
 *   "Attacks deal 15 (+20% AP) bonus magic damage On-Hit"
 *   "Attacks deal 8% of the target's current Health ... On-Hit"
 *
 * Mechanics whose public text hides the number behind a named calculation, or
 * which need stacks/missing-health state, deliberately fall through.
 */
export function parseOnHit(item:MatchupItem,abilityPower:number):OnHitEffect[]{
  const text=plainText(item);
  const effects:OnHitEffect[]=[];

  const flat=text.match(/Attacks?\s+(?:deal|apply)(?:\s+an\s+additional)?\s+(\d+(?:\.\d+)?)\s*(?:\(\s*\+?(\d+(?:\.\d+)?)%\s*(?:AP|Ability Power)\s*\))?\s*(?:bonus\s+)?(physical|magic)\s+damage\s+On-Hit/i);
  if(flat){
    const base=Number(flat[1])||0;
    const apRatio=(Number(flat[2])||0)/100;
    effects.push({
      label:`${item.name} on-hit`,
      type:flat[3].toUpperCase() as 'PHYSICAL'|'MAGIC',
      flatDamage:round(base+apRatio*Math.max(0,abilityPower)),
      appliesFromAbility:true,
    });
  }

  const current=text.match(/Attacks?\s+(?:deal|apply)(?:\s+an\s+additional)?\s+(\d+(?:\.\d+)?)%\s+(?:of\s+)?(?:the\s+)?(?:target'?s|enemy'?s?)\s+current\s+Health\s+as\s+(?:bonus\s+)?(physical|magic)\s+damage\s+On-Hit/i);
  if(current){
    effects.push({
      label:`${item.name} current-health on-hit`,
      type:current[2].toUpperCase() as 'PHYSICAL'|'MAGIC',
      targetCurrentHealthRatio:(Number(current[1])||0)/100,
      appliesFromAbility:true,
    });
  }

  return dedupeEffects(effects);
}

export function itemSummary(id:number,item:MatchupItem){
  const stats=statsFromItem(item);
  const kind=(item.tags??[]).includes('Boots')
    ?'BOOTS':item.into?.length?'COMPONENT':item.from?.length?'COMPLETED':'STARTER';
  return {
    id,name:item.name,gold:item.gold?.total??0,image:item.image?.full??null,
    tags:item.tags??[],kind,
    stats:{
      attackDamage:stats.attackDamage,abilityPower:stats.abilityPower,
      attackSpeedPercent:round(stats.attackSpeedRatio*100),
      critPercent:round(stats.critChance*100),health:stats.health,armor:stats.armor,
      magicResist:stats.magicResist,mana:stats.mana,abilityHaste:stats.abilityHaste,
      lethality:stats.lethality,moveSpeed:stats.flatMoveSpeed,
    },
  };
}

function addLoadoutStats(a:LoadoutStats,b:LoadoutStats):LoadoutStats{
  const visible=addStats(a,b);
  return {
    ...visible,abilityHaste:a.abilityHaste+b.abilityHaste,
    lethality:a.lethality+b.lethality,mana:a.mana+b.mana,
    flatMagicPen:a.flatMagicPen+b.flatMagicPen,
    percentMagicPen:combinePercentPen(a.percentMagicPen,b.percentMagicPen),
    percentArmorPen:combinePercentPen(a.percentArmorPen,b.percentArmorPen),
  };
}

function plainText(item:MatchupItem):string{
  return `${item.plaintext??''} ${item.description??''}`
    .replace(/<br\s*\/?\s*>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;|&amp;/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function namedNumber(text:string,label:string):number{
  const escaped=escapeRegex(label);
  const after=text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${escaped}`,'i'));
  if(after)return Number(after[1])||0;
  const before=text.match(new RegExp(`${escaped}\\s*[:+]?\\s*(\\d+(?:\\.\\d+)?)`,'i'));
  return before?Number(before[1])||0:0;
}

function namedPercent(text:string,label:string):number{
  const escaped=escapeRegex(label);
  const after=text.match(new RegExp(`(\\d+(?:\\.\\d+)?)%\\s*${escaped}`,'i'));
  if(after)return (Number(after[1])||0)/100;
  const before=text.match(new RegExp(`${escaped}\\s*[:+]?\\s*(\\d+(?:\\.\\d+)?)%`,'i'));
  return before?(Number(before[1])||0)/100:0;
}

function normaliseRatio(value:number):number{
  if(!Number.isFinite(value)||value<=0)return 0;
  return value>1?value/100:value;
}

function combinePercentPen(a:number,b:number):number{
  return 1-(1-Math.max(0,Math.min(1,a)))*(1-Math.max(0,Math.min(1,b)));
}

function hasCombatPassive(item:MatchupItem|undefined):boolean{
  if(!item?.description)return false;
  return /<passive|<active|unique passive|unique active|On-Hit|Attacking a champion|Attacks deal/i.test(item.description);
}

function dedupeEffects(effects:OnHitEffect[]):OnHitEffect[]{
  const seen=new Set<string>();
  return effects.filter(effect=>{
    const key=JSON.stringify(effect);
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}

const escapeRegex=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const round=(n:number)=>Math.round(n*10)/10;