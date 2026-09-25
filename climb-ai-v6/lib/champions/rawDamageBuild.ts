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
      ?'Optimised for a 3-second raw-damage window: calculable spell damage plus sustained basic attacks. Item passives, target resistances and conditional mechanics are not invented.'
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

  const bestBySlot=new Map<string,number>();
  for(const row of rows){
    const best=Math.max(0,...row.ranks.map(rank=>rank.value??0));
    if(best<=0)continue;
    const current=bestBySlot.get(row.slot)??0;
    if(best>current)bestBySlot.set(row.slot,best);
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
