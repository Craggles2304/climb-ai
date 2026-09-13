import {analyseTftBoard,type TftBoardContext,type TftBoardMetric,type TftBoardRead,type TftBoardUnit} from './boardLab';

export interface TftBoardSnapshot{
  name:string;
  capturedAt:string;
  stage:string;
  level:number;
  hp:number;
  gold:number;
  unusedComponents:number;
  completedItemsBench:number;
  augments:string[];
  units:TftBoardUnit[];
}

export interface TftBoardMetricDelta{
  key:TftBoardMetric['key'];
  label:string;
  a:number;
  b:number;
  delta:number;
  winner:'A'|'B'|'EVEN';
}

export interface TftBoardCompareRead{
  readA:TftBoardRead;
  readB:TftBoardRead;
  strengthDelta:number;
  verdict:'BOARD B CLEARLY STRONGER'|'BOARD B SLIGHTLY STRONGER'|'STRUCTURALLY EVEN'|'BOARD A SLIGHTLY STRONGER'|'BOARD A CLEARLY STRONGER';
  confidence:number;
  metrics:TftBoardMetricDelta[];
  gainedUnits:string[];
  lostUnits:string[];
  upgradedUnits:string[];
  downgradedUnits:string[];
  gainedTraits:string[];
  lostTraits:string[];
  explanations:string[];
  tradeoffs:string[];
  question:string;
}

const unitKey=(u:TftBoardUnit)=>u.championId||u.name;

function unitMap(units:TftBoardUnit[]){
  const out=new Map<string,TftBoardUnit>();
  units.forEach(u=>out.set(unitKey(u),u));
  return out;
}

function activeTraitMap(read:TftBoardRead){
  return new Map(read.activeTraits.map(t=>[t.name,t.breakpoint]));
}

export function compareTftBoards(a:TftBoardSnapshot,b:TftBoardSnapshot,traitDefinitions:TftBoardContext['traitDefinitions']):TftBoardCompareRead{
  const readA=analyseTftBoard({...a,traitDefinitions});
  const readB=analyseTftBoard({...b,traitDefinitions});
  const strengthDelta=readB.boardStrength-readA.boardStrength;
  const verdict:TftBoardCompareRead['verdict']=strengthDelta>=9?'BOARD B CLEARLY STRONGER':strengthDelta>=3?'BOARD B SLIGHTLY STRONGER':strengthDelta<=-9?'BOARD A CLEARLY STRONGER':strengthDelta<=-3?'BOARD A SLIGHTLY STRONGER':'STRUCTURALLY EVEN';

  const bMetrics=new Map(readB.metrics.map(m=>[m.key,m]));
  const metrics:TftBoardMetricDelta[]=readA.metrics.map(metric=>{
    const other=bMetrics.get(metric.key)!;
    const delta=other.score-metric.score;
    return{key:metric.key,label:metric.label,a:metric.score,b:other.score,delta,winner:delta>=3?'B':delta<=-3?'A':'EVEN'};
  });

  const mapA=unitMap(a.units);
  const mapB=unitMap(b.units);
  const gainedUnits=b.units.filter(u=>!mapA.has(unitKey(u))).map(u=>`${u.name} ${'★'.repeat(u.star)}`);
  const lostUnits=a.units.filter(u=>!mapB.has(unitKey(u))).map(u=>`${u.name} ${'★'.repeat(u.star)}`);
  const upgradedUnits:string[]=[];
  const downgradedUnits:string[]=[];
  for(const [key,ua] of mapA){
    const ub=mapB.get(key);if(!ub)continue;
    if(ub.star>ua.star)upgradedUnits.push(`${ua.name} ${'★'.repeat(ua.star)} → ${'★'.repeat(ub.star)}`);
    if(ub.star<ua.star)downgradedUnits.push(`${ua.name} ${'★'.repeat(ua.star)} → ${'★'.repeat(ub.star)}`);
  }

  const traitsA=activeTraitMap(readA);
  const traitsB=activeTraitMap(readB);
  const gainedTraits:string[]=[];
  const lostTraits:string[]=[];
  for(const [name,bp] of traitsB){
    const old=traitsA.get(name)||0;
    if(bp>old)gainedTraits.push(`${name} ${old?`${old} → `:''}${bp}`);
  }
  for(const [name,bp] of traitsA){
    const next=traitsB.get(name)||0;
    if(next<bp)lostTraits.push(`${name} ${bp}${next?` → ${next}`:' → inactive'}`);
  }

  const sorted=[...metrics].sort((x,y)=>Math.abs(y.delta)-Math.abs(x.delta));
  const explanations:string[]=[];
  for(const metric of sorted.slice(0,3)){
    if(Math.abs(metric.delta)<3)continue;
    explanations.push(`${metric.label}: Board B is ${metric.delta>0?'+':''}${metric.delta} (${metric.a} → ${metric.b}).`);
  }
  if(b.level>a.level){
    if(strengthDelta<=0)explanations.unshift(`Board B is level ${b.level}, but the extra level did not produce a stronger structural read than level ${a.level}.`);
    else explanations.push(`The level ${a.level} → ${b.level} transition converted into ${strengthDelta>0?`+${strengthDelta}`:strengthDelta} Board Strength.`);
  }
  if(gainedUnits.length)explanations.push(`Board B adds ${gainedUnits.slice(0,3).join(', ')}.`);
  if(upgradedUnits.length)explanations.push(`Upgrades gained: ${upgradedUnits.slice(0,3).join(', ')}.`);
  if(!explanations.length)explanations.push('The two boards are close enough that matchup-specific positioning and opponent targeting may matter more than raw structure.');

  const tradeoffs:string[]=[];
  const gains=metrics.filter(m=>m.delta>=5).sort((x,y)=>y.delta-x.delta);
  const losses=metrics.filter(m=>m.delta<=-5).sort((x,y)=>x.delta-y.delta);
  if(gains.length&&losses.length)tradeoffs.push(`Board B gains ${gains.map(x=>x.label).slice(0,2).join(' + ')}, but gives up ${losses.map(x=>x.label).slice(0,2).join(' + ')}.`);
  if(gainedTraits.length&&readB.metrics.find(m=>m.key==='TRAITS')!.score<=readA.metrics.find(m=>m.key==='TRAITS')!.score)tradeoffs.push('Board B activates additional trait breakpoints, but the overall trait-efficiency score does not improve; more traits is not automatically a better board.');
  if(b.level>a.level&&metrics.find(m=>m.key==='UPGRADES')!.delta<=-5)tradeoffs.push('The higher-level board loses upgrade density. The extra slot is currently being paid for with weaker unit quality.');
  if(metrics.find(m=>m.key==='DAMAGE')!.delta>0&&metrics.find(m=>m.key==='FRONTLINE')!.delta<0)tradeoffs.push('Board B increases damage but reduces frontline time; the carry upgrade only matters if the board survives long enough to cast/attack.');
  if(metrics.find(m=>m.key==='FRONTLINE')!.delta>0&&metrics.find(m=>m.key==='DAMAGE')!.delta<0)tradeoffs.push('Board B is harder to kill but loses damage concentration; check whether fights now time out rather than collapse instantly.');
  if(!tradeoffs.length)tradeoffs.push('No major cross-axis tradeoff is detected; the stronger board improves without an obvious structural sacrifice.');

  const confidence=Math.round((readA.confidence+readB.confidence)/2);
  const question=strengthDelta>0?'What did Board B change that creates repeatable strength—and was that change affordable at the real game state?':strengthDelta<0?'Why were you considering Board B if it weakens the entered structure—was there a matchup-specific reason not represented here?':'If these boards are structurally even, which one preserves more economy, flexibility and matchup-specific positioning options?';

  return{readA,readB,strengthDelta,verdict,confidence,metrics,gainedUnits,lostUnits,upgradedUnits,downgradedUnits,gainedTraits,lostTraits,explanations:explanations.slice(0,5),tradeoffs:tradeoffs.slice(0,4),question};
}
