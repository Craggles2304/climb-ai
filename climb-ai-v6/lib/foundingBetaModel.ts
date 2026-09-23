export const FOUNDING_BETA_TARGETS={
  minimumActivatedPlayers:10,
  activationToGradePct:70,
  companionAdoptionPct:50,
  trackedGameAfterCompanionPct:60,
  sessionCompletionPct:50,
  usefulFeedbackPct:70,
  minimumFeedbackResponses:5,
  day1ReturnPct:40,
  minimumDay1Eligible:5,
  day7ReturnPct:25,
  minimumDay7Eligible:5,
} as const;

export const FOUNDING_BETA_MILESTONES=[
  {event:'signup_completed',label:'Account activated',parent:null},
  {event:'op_grade_viewed',label:'First coaching value',parent:'signup_completed'},
  {event:'companion_connected',label:'Companion connected',parent:'signup_completed'},
  {event:'companion_game_completed',label:'Tracked game completed',parent:'companion_connected'},
  {event:'climb_session_started',label:'Deliberate session started',parent:'op_grade_viewed'},
  {event:'climb_session_completed',label:'3-game session completed',parent:'climb_session_started'},
  {event:'career_viewed',label:'Development Career viewed',parent:'op_grade_viewed'},
] as const;

type MilestoneEvent=typeof FOUNDING_BETA_MILESTONES[number]['event'];

export type BetaEventRow={
  user_id:string|null;
  anon_id:string;
  event:string;
  props:Record<string,unknown>|null;
  occurred_at:string;
};

export interface BetaMilestoneMetric{
  event:MilestoneEvent;
  label:string;
  players:number;
  parentPlayers:number;
  fromParent:number;
  fromActivated:number;
  dropOff:number;
}

export interface RetentionMetric{
  eligible:number;
  returned:number;
  rate:number|null;
}

export interface FoundingBetaValidation{
  windowDays:number;
  identities:number;
  activatedPlayers:number;
  milestones:BetaMilestoneMetric[];
  activationToGradePct:number;
  companionAdoptionPct:number;
  trackedGameAfterCompanionPct:number;
  sessionCompletionPct:number;
  careerAdoptionPct:number;
  usefulFeedback:{responses:number;useful:number;rate:number|null};
  day1:RetentionMetric;
  day7:RetentionMetric;
  medianSecondsToGrade:number|null;
  medianSecondsToCompanion:number|null;
  medianSecondsToSessionComplete:number|null;
  largestLeak:{label:string;fromParent:number;dropOff:number}|null;
  gateStatus:'INSUFFICIENT_SAMPLE'|'BLOCKED'|'VALIDATING'|'TARGETS_MET';
  gates:Array<{key:string;label:string;met:boolean|null;actual:string;target:string}>;
  latestEventAt:string|null;
  error?:string;
}

const RELEVANT_EVENTS=[
  ...FOUNDING_BETA_MILESTONES.map(step=>step.event),
  'dashboard_view','coach_message_sent','analysis_completed','mission_completed','feedback_given',
] as const;

const pct=(n:number,d:number)=>d?Math.round(n/d*100):0;
const hours=(n:number)=>n*60*60*1000;
const days=(n:number)=>n*24*60*60*1000;

function percentile(values:number[],p:number){
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  return Math.round(sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*p)-1))]);
}

function boolProp(props:Record<string,unknown>|null,key:string){
  return typeof props?.[key]==='boolean'?props[key] as boolean:null;
}

export function summarizeFoundingBeta(rows:BetaEventRow[],nowMs=Date.now(),windowDays=45):FoundingBetaValidation{
  const empty:FoundingBetaValidation={
    windowDays,identities:0,activatedPlayers:0,
    milestones:FOUNDING_BETA_MILESTONES.map(step=>({...step,parentPlayers:0,players:0,fromParent:0,fromActivated:0,dropOff:0})),
    activationToGradePct:0,companionAdoptionPct:0,trackedGameAfterCompanionPct:0,sessionCompletionPct:0,careerAdoptionPct:0,
    usefulFeedback:{responses:0,useful:0,rate:null},
    day1:{eligible:0,returned:0,rate:null},day7:{eligible:0,returned:0,rate:null},
    medianSecondsToGrade:null,medianSecondsToCompanion:null,medianSecondsToSessionComplete:null,
    largestLeak:null,gateStatus:'INSUFFICIENT_SAMPLE',gates:[],latestEventAt:null,
  };
  if(!rows.length)return {...empty,gates:buildGates(empty)};

  const anonOwner=new Map<string,string>();
  for(const row of rows)if(row.user_id)anonOwner.set(row.anon_id,row.user_id);
  const identity=(row:BetaEventRow)=>row.user_id||anonOwner.get(row.anon_id)||`anon:${row.anon_id}`;

  const timelines=new Map<string,Map<string,number>>();
  const eventsByIdentity=new Map<string,Array<{event:string,at:number,props:Record<string,unknown>|null}>>();
  let latestEventAt:string|null=null;

  for(const row of rows){
    const at=Date.parse(row.occurred_at);
    if(!Number.isFinite(at))continue;
    const id=identity(row);
    const line=timelines.get(id)??new Map<string,number>();
    const prior=line.get(row.event);
    if(prior===undefined||at<prior)line.set(row.event,at);
    timelines.set(id,line);
    const all=eventsByIdentity.get(id)??[];
    all.push({event:row.event,at,props:row.props});
    eventsByIdentity.set(id,all);
    if(!latestEventAt||row.occurred_at>latestEventAt)latestEventAt=row.occurred_at;
  }

  const activatedIds=[...timelines.entries()].filter(([,line])=>line.has('signup_completed')).map(([id])=>id);
  const activated=activatedIds.length;
  const milestoneCounts=new Map<string,number>();

  for(const step of FOUNDING_BETA_MILESTONES){
    let count=0;
    for(const id of activatedIds){
      const line=timelines.get(id)!;
      const signup=line.get('signup_completed')!;
      const at=line.get(step.event);
      if(at===undefined||at<signup)continue;
      if(step.parent){
        const parentAt=line.get(step.parent);
        if(parentAt===undefined||at<parentAt)continue;
      }
      count++;
    }
    milestoneCounts.set(step.event,count);
  }

  const milestones=FOUNDING_BETA_MILESTONES.map(step=>{
    const players=milestoneCounts.get(step.event)??0;
    const parentPlayers=step.parent?(milestoneCounts.get(step.parent)??0):activated;
    return{
      event:step.event,label:step.label,players,parentPlayers,
      fromParent:pct(players,parentPlayers),
      fromActivated:pct(players,activated),
      dropOff:Math.max(0,parentPlayers-players),
    };
  });

  const timeBetween=(to:string)=>{
    const values:number[]=[];
    for(const id of activatedIds){
      const line=timelines.get(id)!;
      const start=line.get('signup_completed'),end=line.get(to);
      if(start!==undefined&&end!==undefined&&end>=start)values.push((end-start)/1000);
    }
    return percentile(values,.5);
  };

  const meaningful=new Set(['dashboard_view','career_viewed','companion_game_completed','climb_session_started','climb_session_completed','coach_message_sent','analysis_completed','mission_completed']);
  const retention=(minAge:number,from:number,to:number):RetentionMetric=>{
    let eligible=0,returned=0;
    for(const id of activatedIds){
      const signup=timelines.get(id)!.get('signup_completed')!;
      if(nowMs-signup<minAge)continue;
      eligible++;
      const yes=(eventsByIdentity.get(id)??[]).some(event=>meaningful.has(event.event)&&event.at>=signup+from&&event.at<=signup+to);
      if(yes)returned++;
    }
    return{eligible,returned,rate:eligible?pct(returned,eligible):null};
  };

  let feedbackResponses=0,feedbackUseful=0;
  for(const id of activatedIds){
    const signup=timelines.get(id)!.get('signup_completed')!;
    for(const event of eventsByIdentity.get(id)??[]){
      if(event.event!=='feedback_given'||event.at<signup)continue;
      const useful=boolProp(event.props,'useful')??boolProp(event.props,'helpful');
      if(useful===null)continue;
      feedbackResponses++;
      if(useful)feedbackUseful++;
    }
  }

  const metric=(event:string)=>milestones.find(item=>item.event===event)?.players??0;
  const grade=metric('op_grade_viewed');
  const connected=metric('companion_connected');
  const tracked=metric('companion_game_completed');
  const sessionStarted=metric('climb_session_started');
  const sessionCompleted=metric('climb_session_completed');
  const career=metric('career_viewed');
  const day1=retention(hours(24),hours(20),hours(72));
  const day7=retention(days(7),days(6),days(10));

  const draft:FoundingBetaValidation={
    ...empty,
    identities:timelines.size,
    activatedPlayers:activated,
    milestones,
    activationToGradePct:pct(grade,activated),
    companionAdoptionPct:pct(connected,activated),
    trackedGameAfterCompanionPct:pct(tracked,connected),
    sessionCompletionPct:pct(sessionCompleted,sessionStarted),
    careerAdoptionPct:pct(career,grade),
    usefulFeedback:{responses:feedbackResponses,useful:feedbackUseful,rate:feedbackResponses?pct(feedbackUseful,feedbackResponses):null},
    day1,day7,
    medianSecondsToGrade:timeBetween('op_grade_viewed'),
    medianSecondsToCompanion:timeBetween('companion_connected'),
    medianSecondsToSessionComplete:timeBetween('climb_session_completed'),
    largestLeak:milestones
      .filter(item=>item.event!=='signup_completed'&&item.parentPlayers>0)
      .sort((a,b)=>a.fromParent-b.fromParent)[0]??null,
    latestEventAt,
    gateStatus:'VALIDATING',
    gates:[],
  };
  draft.gates=buildGates(draft);
  const enough=draft.activatedPlayers>=FOUNDING_BETA_TARGETS.minimumActivatedPlayers;
  const measurable=draft.gates.filter(g=>g.met!==null);
  const allMet=enough&&measurable.length===draft.gates.length&&measurable.every(g=>g.met);
  draft.gateStatus=!enough?'INSUFFICIENT_SAMPLE':allMet?'TARGETS_MET':measurable.some(g=>g.met===false)?'BLOCKED':'VALIDATING';
  return draft;
}

function buildGates(v:FoundingBetaValidation):FoundingBetaValidation['gates']{
  const t=FOUNDING_BETA_TARGETS;
  return[
    {key:'sample',label:'Activated founding players',met:v.activatedPlayers>=t.minimumActivatedPlayers,actual:String(v.activatedPlayers),target:`≥${t.minimumActivatedPlayers}`},
    {key:'activation',label:'Signup → first useful coaching',met:v.activatedPlayers? v.activationToGradePct>=t.activationToGradePct:null,actual:`${v.activationToGradePct}%`,target:`≥${t.activationToGradePct}%`},
    {key:'companion',label:'Companion adoption',met:v.activatedPlayers? v.companionAdoptionPct>=t.companionAdoptionPct:null,actual:`${v.companionAdoptionPct}%`,target:`≥${t.companionAdoptionPct}%`},
    {key:'tracked',label:'Connected → tracked game complete',met:v.milestones.find(x=>x.event==='companion_connected')?.players? v.trackedGameAfterCompanionPct>=t.trackedGameAfterCompanionPct:null,actual:`${v.trackedGameAfterCompanionPct}%`,target:`≥${t.trackedGameAfterCompanionPct}%`},
    {key:'session',label:'3-game session completion',met:v.milestones.find(x=>x.event==='climb_session_started')?.players? v.sessionCompletionPct>=t.sessionCompletionPct:null,actual:`${v.sessionCompletionPct}%`,target:`≥${t.sessionCompletionPct}%`},
    {key:'useful',label:'Coaching marked useful',met:v.usefulFeedback.responses>=t.minimumFeedbackResponses&&v.usefulFeedback.rate!==null?v.usefulFeedback.rate>=t.usefulFeedbackPct:null,actual:v.usefulFeedback.rate===null?'NO DATA':`${v.usefulFeedback.rate}% (${v.usefulFeedback.responses})`,target:`≥${t.usefulFeedbackPct}% · ≥${t.minimumFeedbackResponses} responses`},
    {key:'d1',label:'Day-1 return',met:v.day1.eligible>=t.minimumDay1Eligible&&v.day1.rate!==null?v.day1.rate>=t.day1ReturnPct:null,actual:v.day1.rate===null?'NO ELIGIBLE COHORT':`${v.day1.rate}% (${v.day1.eligible})`,target:`≥${t.day1ReturnPct}% · ≥${t.minimumDay1Eligible} eligible`},
    {key:'d7',label:'Day-7 return',met:v.day7.eligible>=t.minimumDay7Eligible&&v.day7.rate!==null?v.day7.rate>=t.day7ReturnPct:null,actual:v.day7.rate===null?'NO ELIGIBLE COHORT':`${v.day7.rate}% (${v.day7.eligible})`,target:`≥${t.day7ReturnPct}% · ≥${t.minimumDay7Eligible} eligible`},
  ];
}
