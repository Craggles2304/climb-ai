import type {Match} from '../types';
import type {ProEvidence,ProMatchAnalysis,ProMetric} from './proAnalysis';

const MAX_PLAUSIBLE_CS_PER_MINUTE=20;

function evidenceCs(item:ProEvidence){
  const match=/(-?\d+(?:\.\d+)?)\s*CS\b/i.exec(String(item.detail||''));
  if(!match)return null;
  const value=Number(match[1]);
  return Number.isFinite(value)?value:null;
}

function unreliableCurve(match:Match,curve:ProMetric){
  const totalCs=Number(match.metrics.cs);
  if(!Number.isFinite(totalCs)||totalCs<=0||curve.status!=='MEASURED')return false;
  const duration=Math.max(1,Number(match.durationSeconds)||1);
  const points=(curve.evidence??[])
    .map(item=>({at:Number(item.atSeconds),cs:evidenceCs(item)}))
    .filter((item):item is {at:number;cs:number}=>Number.isFinite(item.at)&&item.cs!==null)
    .sort((a,b)=>a.at-b.at);
  if(!points.length)return false;

  // A labelled checkpoint cannot exist after the match has already ended.
  if(points.some(point=>point.at>duration+5))return true;

  // Farm is cumulative. It cannot go backwards or jump at an impossible rate.
  for(let index=1;index<points.length;index++){
    const previous=points[index-1],current=points[index];
    if(current.cs<previous.cs)return true;
    const minutes=(current.at-previous.at)/60;
    if(minutes>0&&(current.cs-previous.cs)/minutes>MAX_PLAUSIBLE_CS_PER_MINUTE)return true;
  }

  const last=points[points.length-1];
  const remainingMinutes=Math.max(0,(duration-last.at)/60);
  if(totalCs<last.cs)return true;
  if(totalCs>last.cs){
    if(remainingMinutes<=0)return true;
    if((totalCs-last.cs)/remainingMinutes>MAX_PLAUSIBLE_CS_PER_MINUTE)return true;
  }

  return false;
}

export function reconcileFarmEvidence(match:Match):Match{
  const analysis=match.proAnalysis;
  const curve=analysis?.metrics?.cs_curve;
  if(!analysis||!curve||!unreliableCurve(match,curve))return match;

  const totalCs=Math.max(0,Math.round(Number(match.metrics.cs)||0));
  const csPerMin=Number.isFinite(Number(match.metrics.csPerMin))
    ?Number(match.metrics.csPerMin)
    :totalCs/Math.max((Number(match.durationSeconds)||1)/60,1/60);
  const finalAt=Math.max(0,Number(match.durationSeconds)||0);
  const repaired:ProMetric={
    ...curve,
    score:null,
    value:`${totalCs} final CS · ${csPerMin.toFixed(2)} CS/min`,
    status:'BUILDING',
    confidence:'HIGH',
    summary:'Final farm is verified from the completed match. Exact 5/10/15-minute checkpoint telemetry was not captured closely enough, so OP CLIMB will not invent a CS curve.',
    evidence:[{
      atSeconds:finalAt,
      label:'Final farm',
      detail:`${totalCs} CS (${csPerMin.toFixed(2)} CS/min) at game end.`,
    }],
  };
  const nextAnalysis:ProMatchAnalysis={...analysis,metrics:{...analysis.metrics,cs_curve:repaired}};
  return {...match,proAnalysis:nextAnalysis};
}
