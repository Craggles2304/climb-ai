import 'server-only';
import {getSupabaseAdmin} from './supabaseAdmin';

export const ACTIVATION_STEPS=[
  {event:'signup_completed',label:'Signup completed'},
  {event:'riot_profile_added',label:'Player profile completed'},
  {event:'first_match_added',label:'First match added'},
  {event:'op_grade_viewed',label:'First OP Grade viewed'},
  {event:'fix_ladder_viewed',label:'Fix Ladder viewed'},
  {event:'development_hq_entered',label:'Development HQ entered'},
] as const;

type ActivationEvent=typeof ACTIVATION_STEPS[number]['event'];

type EventRow={
  user_id:string|null;
  anon_id:string;
  event:string;
  props:Record<string,unknown>|null;
  occurred_at:string;
};

export interface ActivationStepMetric{
  event:ActivationEvent;
  label:string;
  players:number;
  fromPrevious:number;
  fromSignup:number;
  dropOff:number;
}

export interface ActivationFunnel{
  windowDays:number;
  players:number;
  steps:ActivationStepMetric[];
  medianTimeToGradeSeconds:number|null;
  p75TimeToGradeSeconds:number|null;
  under60Seconds:number|null;
  manualFirstMatches:number;
  riotFirstMatches:number;
  latestEventAt:string|null;
  error?:string;
}

const pct=(n:number,d:number)=>d?Math.round(n/d*100):0;

function percentile(values:number[],p:number):number|null{
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  const index=Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*p)-1));
  return Math.round(sorted[index]);
}

export async function getActivationFunnel(windowDays=30):Promise<ActivationFunnel>{
  const db=getSupabaseAdmin();
  const empty:ActivationFunnel={
    windowDays,players:0,
    steps:ACTIVATION_STEPS.map(step=>({...step,players:0,fromPrevious:0,fromSignup:0,dropOff:0})),
    medianTimeToGradeSeconds:null,p75TimeToGradeSeconds:null,under60Seconds:null,
    manualFirstMatches:0,riotFirstMatches:0,latestEventAt:null,
  };
  if(!db)return {...empty,error:'Supabase admin storage is not configured.'};

  const since=new Date(Date.now()-windowDays*86_400_000).toISOString();
  const {data,error}=await db.from('analytics_events')
    .select('user_id,anon_id,event,props,occurred_at')
    .gte('occurred_at',since)
    .in('event',ACTIVATION_STEPS.map(s=>s.event))
    .order('occurred_at',{ascending:true})
    .limit(10000);

  if(error)return {...empty,error:error.message};
  const rows=(data||[]) as EventRow[];
  if(!rows.length)return empty;

  // When a browser later becomes authenticated, use that user id to join its
  // earlier pseudonymous activation events into one timeline.
  const anonOwner=new Map<string,string>();
  for(const row of rows)if(row.user_id)anonOwner.set(row.anon_id,row.user_id);
  const identity=(row:EventRow)=>row.user_id||anonOwner.get(row.anon_id)||`anon:${row.anon_id}`;

  const timelines=new Map<string,Map<string,number>>();
  const firstMatchSource=new Map<string,string>();
  let latestEventAt:string|null=null;

  for(const row of rows){
    const key=identity(row);
    const stamp=Date.parse(row.occurred_at);
    if(!Number.isFinite(stamp))continue;
    let timeline=timelines.get(key);
    if(!timeline){timeline=new Map();timelines.set(key,timeline)}
    const prior=timeline.get(row.event);
    if(prior===undefined||stamp<prior)timeline.set(row.event,stamp);
    if(row.event==='first_match_added'&&!firstMatchSource.has(key)){
      const source=typeof row.props?.source==='string'?row.props.source:'unknown';
      firstMatchSource.set(key,source);
    }
    if(!latestEventAt||row.occurred_at>latestEventAt)latestEventAt=row.occurred_at;
  }

  const ids=[...timelines.keys()];
  const counts:number[]=[];
  for(let i=0;i<ACTIVATION_STEPS.length;i++){
    let count=0;
    for(const id of ids){
      const line=timelines.get(id)!;
      let previous=-Infinity;
      let qualifies=true;
      for(let j=0;j<=i;j++){
        const stamp=line.get(ACTIVATION_STEPS[j].event);
        if(stamp===undefined||stamp<previous){qualifies=false;break}
        previous=stamp;
      }
      if(qualifies)count++;
    }
    counts.push(count);
  }

  const signupCount=counts[0]||0;
  const steps=ACTIVATION_STEPS.map((step,i)=>({
    ...step,
    players:counts[i],
    fromPrevious:i===0?(counts[i]?100:0):pct(counts[i],counts[i-1]),
    fromSignup:pct(counts[i],signupCount),
    dropOff:i===0?0:Math.max(0,counts[i-1]-counts[i]),
  }));

  const timeToGrade:number[]=[];
  for(const line of timelines.values()){
    const start=line.get('signup_completed');
    const grade=line.get('op_grade_viewed');
    if(start!==undefined&&grade!==undefined&&grade>=start)timeToGrade.push((grade-start)/1000);
  }

  const under60=timeToGrade.length?pct(timeToGrade.filter(s=>s<=60).length,timeToGrade.length):null;
  let manualFirstMatches=0,riotFirstMatches=0;
  for(const source of firstMatchSource.values()){
    if(source==='manual')manualFirstMatches++;
    if(source==='riot')riotFirstMatches++;
  }

  return {
    windowDays,
    players:ids.length,
    steps,
    medianTimeToGradeSeconds:percentile(timeToGrade,.5),
    p75TimeToGradeSeconds:percentile(timeToGrade,.75),
    under60Seconds:under60,
    manualFirstMatches,riotFirstMatches,latestEventAt,
  };
}
