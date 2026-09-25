import {coachingTierFor,type CoachingTier} from './coachingLevel';

export type MissionRankBand='IRON'|'BRONZE'|'SILVER'|'GOLD'|'PLATINUM'|'EMERALD'|'DIAMOND'|'MASTER';
type Direction='MIN'|'MAX';

export interface MissionBenchmark{
  rank:MissionRankBand;
  metric:string;
  target:number;
  direction:Direction;
  targetText:string;
  barText:string;
}

const ORDER:MissionRankBand[]=['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER'];

const TABLE:Record<string,{direction:Direction;values:number[];format:(value:number)=>string}> = {
  laneCsPerMin:{direction:'MIN',values:[4.8,5.1,5.4,5.7,6.0,6.2,6.4,6.6],format:v=>v.toFixed(1)+'+ lane CS/min'},
  post15CsPerMin:{direction:'MIN',values:[4.0,4.3,4.6,5.0,5.3,5.6,5.9,6.1],format:v=>v.toFixed(1)+'+ post-15 CS/min'},
  csPerMin:{direction:'MIN',values:[4.7,5.0,5.3,5.6,5.9,6.1,6.3,6.5],format:v=>v.toFixed(1)+'+ CS/min'},
  deathsPost20:{direction:'MAX',values:[3,3,3,2,2,2,2,1],format:v=>'≤'+v+' deaths after 20m'},
  deaths:{direction:'MAX',values:[7,6,6,5,5,5,4,4],format:v=>'≤'+v+' deaths'},
  secondItemMinute:{direction:'MAX',values:[27,26,25.5,25,24.5,24,23.5,23],format:v=>'second item by '+clock(v)},
  objectiveParticipation:{direction:'MIN',values:[.48,.52,.56,.60,.63,.66,.69,.72],format:v=>Math.round(v*100)+'%+ objective involvement'},
  damageShare:{direction:'MIN',values:[.18,.19,.20,.22,.23,.24,.25,.26],format:v=>Math.round(v*100)+'%+ damage share'},
  killParticipation:{direction:'MIN',values:[.48,.52,.55,.58,.60,.62,.64,.66],format:v=>Math.round(v*100)+'%+ kill participation'},
  visionScore:{direction:'MIN',values:[24,27,30,34,38,42,46,50],format:v=>Math.round(v)+'+ vision score'},
  deathsPre10:{direction:'MAX',values:[1,1,1,0,0,0,0,0],format:v=>v===0?'0 deaths before 10m':'≤'+v+' death before 10m'},
  csAt10:{direction:'MIN',values:[42,47,52,56,59,61,64,67],format:v=>Math.round(v)+'+ CS at 10m'},
  csAt15:{direction:'MIN',values:[68,75,82,88,92,96,100,104],format:v=>Math.round(v)+'+ CS at 15m'},
};

export function missionRankBand(rank?:string|null):MissionRankBand{
  const tier=coachingTierFor(rank) as CoachingTier;
  if(tier==='CHALLENGER'||tier==='GRANDMASTER'||tier==='MASTER')return'MASTER';
  return ORDER.includes(tier as MissionRankBand)?tier as MissionRankBand:'SILVER';
}

export function missionBenchmark(metric:string,rank?:string|null):MissionBenchmark|null{
  const spec=TABLE[String(metric||'')];
  if(!spec)return null;
  const band=missionRankBand(rank);
  const target=spec.values[ORDER.indexOf(band)]!;
  const barText=spec.format(target);
  return{
    rank:band,
    metric,
    target,
    direction:spec.direction,
    barText,
    targetText:band+' target · '+barText+' · 3 proven games',
  };
}

export function benchmarkPass(metric:string,value:number,rank?:string|null){
  const benchmark=missionBenchmark(metric,rank);
  if(!benchmark||!Number.isFinite(value))return null;
  return benchmark.direction==='MIN'?value>=benchmark.target:value<=benchmark.target;
}

export function benchmarkProgress(metric:string,value:number,rank?:string|null){
  const benchmark=missionBenchmark(metric,rank);
  if(!benchmark||!Number.isFinite(value))return null;
  if(benchmark.direction==='MIN'){
    if(benchmark.target<=0)return value>=benchmark.target?100:0;
    return clamp(value/benchmark.target*100);
  }
  if(benchmark.target===0)return value<=0?100:clamp(100-value*55);
  if(value<=benchmark.target)return 100;
  return clamp(benchmark.target/value*100);
}

export function benchmarkTargetText(metric:string,rank?:string|null,fallback?:string){
  return missionBenchmark(metric,rank)?.targetText||fallback||'3 proven games';
}

export function benchmarkBarText(metric:string,rank?:string|null,fallback?:string){
  return missionBenchmark(metric,rank)?.barText||fallback||'mission bar';
}

function clamp(value:number){return Math.max(0,Math.min(100,Math.round(value)))}
function clock(value:number){
  const minutes=Math.floor(value);
  const seconds=Math.round((value-minutes)*60);
  return minutes+':'+String(seconds).padStart(2,'0');
}
