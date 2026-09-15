type Evidence={label?:string;detail?:string;atSeconds?:number};
type Point={atSeconds?:number;opponent?:string;you?:{level?:number}};
type FightReview={outcome?:string;atSeconds?:number;why?:string[]};

export type StoredLiveMetricFallback={
  opponent?:string;
  items?:string[];
  csAt10?:number;
  csAt15?:number;
  laneCsPerMin?:number;
  post15CsPerMin?:number;
  levelAt15?:number;
  deathsPre10?:number;
  deaths10to20?:number;
  deathsPost20?:number;
  soloDeaths?:number;
  teamfightDeaths?:number;
  firstItemMinute?:number;
  secondItemMinute?:number;
  thirdItemMinute?:number;
};

/** Rehydrate exact structured metrics from evidence already stored for live games. */
export function deriveStoredLiveMetrics(raw:unknown,durationSeconds:number,finalCs:number):StoredLiveMetricFallback{
  if(!raw||typeof raw!=='object')return{};
  const root=raw as any;
  const proMetrics=root?.proAnalysis?.metrics&&typeof root.proAnalysis.metrics==='object'?root.proAnalysis.metrics:{};
  const summary=root?.summary&&typeof root.summary==='object'?root.summary:{};

  const csEvidence=Array.isArray(proMetrics?.cs_curve?.evidence)?proMetrics.cs_curve.evidence as Evidence[]:[];
  const csAt10=evidenceValue(csEvidence,'10 minute CS');
  const csAt15=evidenceValue(csEvidence,'15 minute CS');
  const laneCsPerMin=typeof csAt15==='number'&&csAt15>=0?round(csAt15/15,2):undefined;
  const postWindowMinutes=durationSeconds>900?(durationSeconds-900)/60:0;
  const post15CsPerMin=typeof csAt15==='number'&&postWindowMinutes>0&&finalCs>=csAt15
    ?round((finalCs-csAt15)/postWindowMinutes,2)
    :undefined;

  const points=Array.isArray(summary?.points)?summary.points as Point[]:[];
  const opponent=mode(points.map(point=>text(point?.opponent)).filter(Boolean));
  const nearest15=points
    .filter(point=>finite(point?.atSeconds)&&finite(point?.you?.level))
    .sort((a,b)=>Math.abs(Number(a.atSeconds)-900)-Math.abs(Number(b.atSeconds)-900))[0];
  const levelAt15=nearest15&&Math.abs(Number(nearest15.atSeconds)-900)<=90?Number(nearest15.you?.level):undefined;

  const reviews=Array.isArray(summary?.fightReviews)?summary.fightReviews as FightReview[]:[];
  const deaths=reviews.filter(review=>String(review?.outcome||'').toUpperCase()==='DEATH'&&finite(review?.atSeconds));
  const deathTimes=deaths.map(review=>Number(review.atSeconds));
  const deathsPre10=deathTimes.length?deathTimes.filter(time=>time<600).length:undefined;
  const deaths10to20=deathTimes.length?deathTimes.filter(time=>time>=600&&time<1200).length:undefined;
  const deathsPost20=deathTimes.length?deathTimes.filter(time=>time>=1200).length:undefined;
  const assistance=deaths.map(review=>assisterCount(review.why)).filter((value):value is number=>value!==undefined);
  const soloDeaths=assistance.length===deaths.length&&deaths.length?assistance.filter(value=>value===0).length:undefined;
  const teamfightDeaths=assistance.length===deaths.length&&deaths.length?assistance.filter(value=>value>=2).length:undefined;

  const rawSpikes=Array.isArray(proMetrics?.power_spike_conversion?.evidence)?proMetrics.power_spike_conversion.evidence as Evidence[]:[];
  const spikeEvidence=rawSpikes
    .filter(item=>text(item?.label)&&!/^level\s+\d+/i.test(text(item.label))&&finite(item?.atSeconds))
    .sort((a,b)=>Number(a.atSeconds)-Number(b.atSeconds));
  const items=unique(spikeEvidence.map(item=>text(item.label)).filter(Boolean));
  const itemMinutes=spikeEvidence.map(item=>round(Number(item.atSeconds)/60,1));

  return {
    opponent:opponent||undefined,
    items:items.length?items:undefined,
    csAt10,
    csAt15,
    laneCsPerMin,
    post15CsPerMin,
    levelAt15,
    deathsPre10,
    deaths10to20,
    deathsPost20,
    soloDeaths,
    teamfightDeaths,
    firstItemMinute:itemMinutes[0],
    secondItemMinute:itemMinutes[1],
    thirdItemMinute:itemMinutes[2],
  };
}

function evidenceValue(evidence:Evidence[],label:string){
  const entry=evidence.find(item=>text(item?.label).toLowerCase()===label.toLowerCase());
  if(!entry)return undefined;
  const match=text(entry.detail).match(/-?\d+(?:\.\d+)?/);
  return match?Number(match[0]):undefined;
}
function assisterCount(lines:unknown){
  const line=Array.isArray(lines)?lines.map(text).find(value=>/\bassister/i.test(value)):'';
  if(!line)return undefined;
  const match=line.match(/\b(\d+)\s+assister/i);
  return match?Number(match[1]):undefined;
}
function mode(values:string[]){
  if(!values.length)return'';
  const counts=new Map<string,number>();
  for(const value of values)counts.set(value,(counts.get(value)||0)+1);
  return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
}
function unique(values:string[]){return [...new Set(values)]}
function finite(value:unknown){return Number.isFinite(Number(value))}
function round(value:number,places:number){const scale=10**places;return Math.round(value*scale)/scale}
function text(value:unknown){return typeof value==='string'?value.trim():''}
