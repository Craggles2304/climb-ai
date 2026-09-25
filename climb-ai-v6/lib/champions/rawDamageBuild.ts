import type {ChampionStatBlock} from './ddragon';
import type {ChampionAbilityDataset} from './abilityDamage';
import {abilityDamageRows,buildAbilityContext} from './abilityDamage';
import {combatProfile,emptyStats,addStats,type ItemStats} from './dps';
import {MAX_BUILD_SIZE,type BuildItem} from './build';

export interface RawDamageBuild{
  items:BuildItem[];
  gold:number;
  autoDps:number;
  comboDamage:number;
  threeSecondDamage:number;
  score:number;
  evaluated:number;
  note:string;
}

interface State{
  ids:number[];
  stats:ItemStats;
  score:number;
  autoDps:number;
  comboDamage:number;
  threeSecondDamage:number;
  gold:number;
}

const DEFAULT_BEAM=180;

export function bestRawDamageBuild(
  base:ChampionStatBlock,
  level:number,
  catalogue:BuildItem[],
  abilityData:ChampionAbilityDataset|null|undefined,
  size=MAX_BUILD_SIZE,
  beamWidth=DEFAULT_BEAM,
):RawDamageBuild{
  const targetSize=Math.max(1,Math.min(MAX_BUILD_SIZE,size));
  const relevant=catalogue.filter(item=>affectsPossibleDamage(item));
  const byId=new Map(catalogue.map(item=>[item.id,item]));
  let evaluated=0;

  const start=rawDamageSnapshot(base,level,emptyStats(),abilityData);
  let beam:State[]=[{ids:[],stats:emptyStats(),gold:0,...start}];

  for(let depth=0;depth<targetSize;depth++){
    const next:State[]=[];
    for(const state of beam){
      const highest=state.ids.length?state.ids[state.ids.length-1]:-1;
      for(const item of relevant){
        if(item.id<=highest)continue;
        const stats=addStats(state.stats,item.stats);
        const result=rawDamageSnapshot(base,level,stats,abilityData);
        evaluated++;
        next.push({
          ids:[...state.ids,item.id],
          stats,
          gold:state.gold+item.gold,
          ...result,
        });
      }
    }
    if(!next.length)break;
    next.sort((a,b)=>b.score-a.score||a.gold-b.gold);
    beam=next.slice(0,beamWidth);
  }

  const winner=beam[0]??{ids:[],gold:0,...start};
  return{
    items:winner.ids.map(id=>byId.get(id)!).filter(Boolean),
    gold:winner.gold,
    autoDps:winner.autoDps,
    comboDamage:winner.comboDamage,
    threeSecondDamage:winner.threeSecondDamage,
    score:winner.score,
    evaluated,
    note:abilityData
      ?'Optimised for a 3-second raw-damage window using legally available ability ranks at the selected champion level, calculable spell damage and sustained basic attacks. Item passives, target resistances and conditional mechanics are not invented.'
      :'Ability formulas are unavailable, so this falls back to sustained basic-attack damage.',
  };
}

export function rawDamageSnapshot(
  base:ChampionStatBlock,
  level:number,
  stats:ItemStats,
  abilityData:ChampionAbilityDataset|null|undefined,
){
  const combat=combatProfile(base,level,stats);
  const rows=abilityData
    ?abilityDamageRows(abilityData,buildAbilityContext(base,level,stats))
    :[];

  const ranks=damageMaxRanks(rows,level);
  const bestBySlot=new Map<string,number>();
  for(const row of rows){
    const rank=ranks.get(row.slot)??0;
    if(rank<=0)continue;
    const value=row.ranks[Math.min(rank,row.ranks.length)-1]?.value??0;
    if(value<=0)continue;
    const current=bestBySlot.get(row.slot)??0;
    if(value>current)bestBySlot.set(row.slot,value);
  }
  const comboDamage=[...bestBySlot.values()].reduce((sum,value)=>sum+value,0);
  const threeSecondDamage=round(comboDamage+combat.dps*3);

  return{
    autoDps:combat.dps,
    comboDamage:round(comboDamage),
    threeSecondDamage,
    score:threeSecondDamage,
  };
}

function damageMaxRanks(
  rows:ReturnType<typeof abilityDamageRows>,
  level:number,
):Map<string,number>{
  const bySlot=new Map<string,number[]>();
  for(const row of rows){
    if(!['Q','W','E','R'].includes(row.slot))continue;
    const values=row.ranks.map(rank=>rank.value??0);
    const existing=bySlot.get(row.slot);
    if(!existing){
      bySlot.set(row.slot,values);
      continue;
    }
    const maxLength=Math.max(existing.length,values.length);
    bySlot.set(row.slot,Array.from({length:maxLength},(_,i)=>Math.max(existing[i]??0,values[i]??0)));
  }

  const ranks=new Map<string,number>([['Q',0],['W',0],['E',0],['R',0]]);
  const ultRanks=[6,11,16].filter(gate=>level>=gate).length;
  if(bySlot.has('R'))ranks.set('R',Math.min(ultRanks,bySlot.get('R')!.length));

  let points=Math.max(0,level-(ranks.get('R')??0));
  const basicCap=Math.min(5,Math.ceil(level/2));
  while(points>0){
    let bestSlot:string|null=null;
    let bestGain=-Infinity;
    for(const slot of ['Q','W','E']){
      const values=bySlot.get(slot);
      if(!values?.length)continue;
      const current=ranks.get(slot)??0;
      const cap=Math.min(basicCap,values.length);
      if(current>=cap)continue;
      const before=current>0?(values[current-1]??0):0;
      const after=values[current]??before;
      const gain=after-before;
      if(gain>bestGain){bestGain=gain;bestSlot=slot}
    }
    if(!bestSlot)break;
    ranks.set(bestSlot,(ranks.get(bestSlot)??0)+1);
    points--;
  }
  return ranks;
}

function affectsPossibleDamage(item:BuildItem){
  const s=item.stats;
  return s.attackDamage>0||
    s.abilityPower>0||
    s.attackSpeedRatio>0||
    s.critChance>0||
    s.health>0||
    s.mana>0||
    s.armor>0||
    s.magicResist>0;
}

const round=(value:number)=>Math.round(value*10)/10;
