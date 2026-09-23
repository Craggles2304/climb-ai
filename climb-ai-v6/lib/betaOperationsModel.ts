export type BetaOpsEvent={
  user_id:string|null;
  anon_id:string;
  event:string;
  props:Record<string,unknown>|null;
  occurred_at:string;
};

export type BetaParticipantProfile={
  id:string;
  gameName:string|null;
  tagline:string|null;
  region:string|null;
  role:string|null;
  rank:string|null;
  isFounder:boolean;
  createdAt:string;
};

export type BetaParticipantState=
  |'NO_ACTIVATION_TELEMETRY'
  |'NEEDS_FIRST_VALUE'
  |'NEEDS_COMPANION'
  |'NEEDS_TRACKED_GAME'
  |'NEEDS_SESSION'
  |'SESSION_IN_PROGRESS'
  |'COACHING_REVIEW'
  |'NEEDS_CAREER'
  |'RETENTION_RISK'
  |'LOOP_COMPLETE';

export type BetaMetricKey=
  |'activationToGradePct'
  |'companionAdoptionPct'
  |'trackedGameAfterCompanionPct'
  |'sessionCompletionPct'
  |'careerAdoptionPct'
  |'usefulFeedbackPct'
  |'day1ReturnPct'
  |'day7ReturnPct';

export interface BetaParticipantOperation{
  id:string;
  label:string;
  state:BetaParticipantState;
  priority:number;
  blocker:string;
  nextAction:string;
  surface:string;
  lastActivityAt:string|null;
  hoursSinceActivity:number|null;
  latestBuild:string|null;
  contactable:boolean;
  milestones:{
    signup:boolean;
    firstValue:boolean;
    companion:boolean;
    trackedGame:boolean;
    sessionStarted:boolean;
    sessionCompleted:boolean;
    careerViewed:boolean;
  };
}

export interface BetaExperimentRecommendation{
  metricKey:BetaMetricKey;
  title:string;
  hypothesis:string;
  targetDelta:number;
  blocker:BetaParticipantState;
  affectedPlayers:number;
  reason:string;
}

export interface BetaOperationsSnapshot{
  participants:BetaParticipantOperation[];
  rescueQueue:BetaParticipantOperation[];
  healthyPlayers:number;
  blockedPlayers:number;
  stateCounts:Record<BetaParticipantState,number>;
  topBlocker:{state:BetaParticipantState;players:number;surface:string}|null;
  recommendedExperiment:BetaExperimentRecommendation|null;
  buildCoverage:{stampedEvents:number;unstampedEvents:number;latestBuild:string|null};
}

const STATE_META:Record<BetaParticipantState,{priority:number;surface:string;blocker:string;action:string;metric:BetaMetricKey;experiment:string;hypothesis:string;delta:number}>={
  NO_ACTIVATION_TEMETRY_PLACEHOLDER:null as never,
} as never;

const META:Record<BetaParticipantState,{priority:number;surface:string;blocker:string;action:string;metric:BetaMetricKey;experiment:string;hypothesis:string;delta:number}>={
  NO_ACTIVATION_TELEMETRY:{priority:78,surface:'ONBOARDING',blocker:'Profile exists but the current activation journey has not been observed.',action:'Run or repair the current onboarding path so this player produces a measurable activation trail.',metric:'activationToGradePct',experiment:'Repair measurable first-value activation',hypothesis:'If the current onboarding path reaches a useful first coaching read without a dead end, more activated players will reach their first OP Grade.',delta:15},
  NEEDS_FIRST_VALUE:{priority:80,surface:'ACTIVATION',blocker:'Signup happened, but the player never reached a first useful coaching read.',action:'Inspect the exact activation step after signup and remove the first-value delay or dead end.',metric:'activationToGradePct',experiment:'Shorten time to first coaching value',hypothesis:'If the first analysis is clearer and faster, more activated players will reach their first OP Grade.',delta:15},
  NEEDS_COMPANION:{priority:82,surface:'COMPANION SETUP',blocker:'The player received coaching value but never connected the Windows Companion.',action:'Rescue Companion install/pairing and remove the first setup point that creates hesitation.',metric:'companionAdoptionPct',experiment:'Improve Companion activation',hypothesis:'If Companion setup is one obvious action with clearer recovery, more activated players will connect a PC.',delta:15},
  NEEDS_TRACKED_GAME:{priority:88,surface:'COMPANION CAPTURE',blocker:'The Companion connected, but no tracked game completed.',action:'Verify League detection, recording start/end and upload recovery for this player.',metric:'trackedGameAfterCompanionPct',experiment:'Improve first tracked-game completion',hypothesis:'If capture starts and finishes reliably after pairing, more connected players will complete a tracked game.',delta:15},
  NEEDS_SESSION:{priority:74,surface:'CLIMB SESSION',blocker:'The player has a tracked coaching loop but never started a deliberate three-game block.',action:'Make the transition from first review to a three-game Climb Session explicit and compelling.',metric:'sessionCompletionPct',experiment:'Increase deliberate-session starts',hypothesis:'If the first review clearly hands the player one job for three games, more players will enter and complete a Climb Session.',delta:12},
  SESSION_IN_PROGRESS:{priority:92,surface:'SESSION COMPLETION',blocker:'A three-game Climb Session was started but not banked.',action:'Find the abandonment point inside the session and remove friction between games or at session banking.',metric:'sessionCompletionPct',experiment:'Reduce Climb Session abandonment',hypothesis:'If the session keeps one visible lesson and gives a clear next-game path, more started sessions will be completed.',delta:15},
  COACHING_REVIEW:{priority:100,surface:'COACHING QUALITY',blocker:'The latest explicit coaching feedback was negative.',action:'Review the rejected diagnosis and its evidence before exposing that coaching pattern to more players.',metric:'usefulFeedbackPct',experiment:'Raise coaching usefulness',hypothesis:'If rejected coaching reads are corrected at the evidence/reasoning layer, a larger share of explicit feedback will be useful.',delta:10},
  NEEDS_CAREER:{priority:62,surface:'DEVELOPMENT CAREER',blocker:'The player completed the coaching block but has not opened the long-term Development Career.',action:'Make the post-session career progression payoff visible immediately after banking the block.',metric:'careerAdoptionPct',experiment:'Increase Development Career adoption',hypothesis:'If a completed session visibly changes the player development map, more coached players will open the Career view.',delta:15},
  RETENTION_RISK:{priority:90,surface:'RETENTION',blocker:'The player completed the core loop but has gone quiet for more than 72 hours.',action:'Identify whether the next objective, Companion return path or perceived coaching value failed to create a reason to come back.',metric:'day7ReturnPct',experiment:'Improve repeat coaching usage',hypothesis:'If the next objective is immediately actionable after a completed loop, more eligible players will return during the next week.',delta:10},
  LOOP_COMPLETE:{priority:10,surface:'HEALTHY',blocker:'The player has completed the measured coaching loop and remains active.',action:'No rescue required. Keep observing repeat usage and coaching usefulness.',metric:'day7ReturnPct',experiment:'Protect healthy repeat usage',hypothesis:'Healthy players should continue returning without extra friction.',delta:5},
};

const meaningful=new Set(['dashboard_view','career_viewed','companion_game_completed','climb_session_started','climb_session_completed','coach_message_sent','analysis_completed','mission_completed','feedback_given']);

function latest(rows:Array<{event:string;at:number;props:Record<string,unknown>|null}>,event:string){
  return rows.filter(x=>x.event===event).sort((a,b)=>b.at-a.at)[0]??null;
}

function explicitUseful(row:{props:Record<string,unknown>|null}|null){
  if(!row)return null;
  const value=row.props?.useful??row.props?.helpful;
  return typeof value==='boolean'?value:null;
}

export function buildBetaOperationsSnapshot(events:BetaOpsEvent[],profiles:BetaParticipantProfile[],nowMs=Date.now()):BetaOperationsSnapshot{
  const anonOwner=new Map<string,string>();
  for(const event of events)if(event.user_id)anonOwner.set(event.anon_id,event.user_id);
  const identity=(event:BetaOpsEvent)=>event.user_id||anonOwner.get(event.anon_id)||`anon:${event.anon_id}`;

  const byIdentity=new Map<string,Array<{event:string;at:number;props:Record<string,unknown>|null}>>();
  let stampedEvents=0,unstampedEvents=0,latestBuild:string|null=null,latestBuildAt=-Infinity;

  for(const event of events){
    const at=Date.parse(event.occurred_at);
    if(!Number.isFinite(at))continue;
    const id=identity(event);
    const rows=byIdentity.get(id)??[];
    rows.push({event:event.event,at,props:event.props});
    byIdentity.set(id,rows);
    const build=typeof event.props?.buildCommit==='string'?event.props.buildCommit:null;
    if(build){stampedEvents++;if(at>latestBuildAt){latestBuildAt=at;latestBuild=build}}else unstampedEvents++;
  }

  const profileMap=new Map(profiles.map(profile=>[profile.id,profile]));
  const ids=new Set<string>([...profileMap.keys(),...byIdentity.keys()]);
  const participants:BetaParticipantOperation[]=[];

  for(const id of ids){
    const profile=profileMap.get(id);
    const rows=(byIdentity.get(id)??[]).sort((a,b)=>a.at-b.at);
    const has=(event:string)=>rows.some(row=>row.event===event);
    const last=rows.at(-1)??null;
    const latestFeedback=latest(rows,'feedback_given');
    const useful=explicitUseful(latestFeedback);
    const lastSessionStart=latest(rows,'climb_session_started')?.at??null;
    const lastSessionComplete=latest(rows,'climb_session_completed')?.at??null;
    const latestMeaningful=rows.filter(row=>meaningful.has(row.event)).at(-1)??last;
    const careerViewed=has('career_viewed');

    let state:BetaParticipantState;
    if(!has('signup_completed'))state='NO_ACTIVATION_TELEMETRY';
    else if(!has('op_grade_viewed'))state='NEEDS_FIRST_VALUE';
    else if(useful===false)state='COACHING_REVIEW';
    else if(!has('companion_connected'))state='NEEDS_COMPANION';
    else if(!has('companion_game_completed'))state='NEEDS_TRACKED_GAME';
    else if(!lastSessionStart)state='NEEDS_SESSION';
    else if(!lastSessionComplete||lastSessionStart>lastSessionComplete)state='SESSION_IN_PROGRESS';
    else if(!careerViewed)state='NEEDS_CAREER';
    else if(latestMeaningful&&nowMs-latestMeaningful.at>72*60*60*1000)state='RETENTION_RISK';
    else state='LOOP_COMPLETE';

    const meta=META[state];
    const buildRows=rows.filter(row=>typeof row.props?.buildCommit==='string');
    const build=buildRows.at(-1)?.props?.buildCommit;
    participants.push({
      id,
      label:profile?.gameName?profile.gameName+(profile.tagline?`#${profile.tagline}`:''):(id.startsWith('anon:')?'Anonymous beta browser':'Beta player'),
      state,
      priority:meta.priority,
      blocker:meta.blocker,
      nextAction:meta.action,
      surface:meta.surface,
      lastActivityAt:last?new Date(last.at).toISOString():profile?.createdAt??null,
      hoursSinceActivity:last?Math.max(0,Math.round((nowMs-last.at)/3_600_000)):null,
      latestBuild:typeof build==='string'?build:null,
      contactable:Boolean(profile),
      milestones:{
        signup:has('signup_completed'),
        firstValue:has('op_grade_viewed'),
        companion:has('companion_connected'),
        trackedGame:has('companion_game_completed'),
        sessionStarted:Boolean(lastSessionStart),
        sessionCompleted:Boolean(lastSessionComplete&&lastSessionStart&&lastSessionComplete>=lastSessionStart),
        careerViewed,
      },
    });
  }

  participants.sort((a,b)=>b.priority-a.priority||(b.hoursSinceActivity??0)-(a.hoursSinceActivity??0));
  const stateCounts={} as Record<BetaParticipantState,number>;
  for(const state of Object.keys(META) as BetaParticipantState[])stateCounts[state]=0;
  for(const participant of participants)stateCounts[participant.state]++;

  const blockedStates=(Object.keys(META) as BetaParticipantState[]).filter(state=>state!=='LOOP_COMPLETE');
  const ranked=blockedStates
    .map(state=>({state,count:stateCounts[state],score:stateCounts[state]*META[state].priority}))
    .filter(row=>row.count>0)
    .sort((a,b)=>b.score-a.score);
  const winner=ranked[0]??null;
  const topBlocker=winner?{state:winner.state,players:winner.count,surface:META[winner.state].surface}:null;
  const recommendedExperiment=winner?{
    metricKey:META[winner.state].metric,
    title:META[winner.state].experiment,
    hypothesis:META[winner.state].hypothesis,
    targetDelta:META[winner.state].delta,
    blocker:winner.state,
    affectedPlayers:winner.count,
    reason:`${winner.count} beta player${winner.count===1?'':'s'} currently map to ${META[winner.state].surface}. This is the highest weighted rescue state in the live cohort.`,
  }:null;

  return{
    participants,
    rescueQueue:participants.filter(p=>p.state!=='LOOP_COMPLETE'),
    healthyPlayers:stateCounts.LOOP_COMPLETE,
    blockedPlayers:participants.length-stateCounts.LOOP_COMPLETE,
    stateCounts,
    topBlocker,
    recommendedExperiment,
    buildCoverage:{stampedEvents,unstampedEvents,latestBuild},
  };
}
