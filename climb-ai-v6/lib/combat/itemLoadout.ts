import type {DataDragonItemFull} from '@/lib/champions/source';
import {addStats,emptyStats,parseItemStats,type ItemStats} from '@/lib/champions/dps';

export type MatchupItem=DataDragonItemFull&{
  description?:string;
  plaintext?:string;
  image?:{full?:string};
};

/**
 * Stats derived from the items a player actually selected in Matchup Lab.
 * Visible item stat lines are deterministic. Item actives/passives are kept
 * separate until a mechanic has an explicit model; they are never silently
 * converted into fake flat stats.
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
  approximations:string[];
}

export const emptyLoadoutStats=():LoadoutStats=>({
  ...emptyStats(),
  abilityHaste:0,
  lethality:0,
  mana:0,
  flatMagicPen:0,
  percentMagicPen:0,
  percentArmorPen:0,
});

export function buildLoadout(
  catalogue:Record<string,MatchupItem>,
  ids:number[],
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
      id,
      name:item.name,
      gold:item.gold?.total??0,
      image:item.image?.full??null,
      tags:item.tags??[],
    });
  }

  if(items.some(i=>hasCombatPassive(catalogue[String(i.id)])))
    approximations.push('Selected item passives/actives are not yet included unless their effect is represented by a published stat line.');

  return {
    stats,
    items,
    totalGold:items.reduce((sum,item)=>sum+item.gold,0),
    approximations,
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

export function itemSummary(id:number,item:MatchupItem){
  const stats=statsFromItem(item);
  const kind=(item.tags??[]).includes('Boots')
    ?'BOOTS'
    :item.into?.length
      ?'COMPONENT'
      :item.from?.length
        ?'COMPLETED'
        :'STARTER';
  return {
    id,
    name:item.name,
    gold:item.gold?.total??0,
    image:item.image?.full??null,
    tags:item.tags??[],
    kind,
    stats:{
      attackDamage:stats.attackDamage,
      abilityPower:stats.abilityPower,
      attackSpeedPercent:round(stats.attackSpeedRatio*100),
      critPercent:round(stats.critChance*100),
      health:stats.health,
      armor:stats.armor,
      magicResist:stats.magicResist,
      mana:stats.mana,
      abilityHaste:stats.abilityHaste,
      lethality:stats.lethality,
      moveSpeed:stats.flatMoveSpeed,
    },
  };
}

function addLoadoutStats(a:LoadoutStats,b:LoadoutStats):LoadoutStats{
  const visible=addStats(a,b);
  return {
    ...visible,
    abilityHaste:a.abilityHaste+b.abilityHaste,
    lethality:a.lethality+b.lethality,
    mana:a.mana+b.mana,
    flatMagicPen:a.flatMagicPen+b.flatMagicPen,
    percentMagicPen:combinePercentPen(a.percentMagicPen,b.percentMagicPen),
    percentArmorPen:combinePercentPen(a.percentArmorPen,b.percentArmorPen),
  };
}

function plainText(item:MatchupItem):string{
  return `${item.plaintext??''} ${item.description??''}`
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;|&amp;/g,' ')
    .replace(/\s+/g,' ');
}

function namedNumber(text:string,label:string):number{
  const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${escaped}`,'i'));
  return match?Number(match[1]):0;
}

function namedPercent(text:string,label:string):number{
  const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=text.match(new RegExp(`(\\d+(?:\\.\\d+)?)%\\s*${escaped}`,'i'));
  return match?Number(match[1])/100:0;
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
  return /<passive|<active|unique passive|unique active/i.test(item.description);
}

const round=(n:number)=>Math.round(n*10)/10;
