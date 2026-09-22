import type {HistoryAnalysisRow} from './riot/proHistory';
import type {DecisionBehaviourKey} from './decisionTwin';
import type {ClimbMatchMissionReview} from './climbMissionDesign';
import type {ClimbCoachingStrategyReview} from './climbCoachingStrategy';
import type {ClimbIntentGapReview} from './climbIntentGap';

export type ClimbAutonomyState='BUILDING'|'SCAFFOLDED'|'EMERGING'|'AUTONOMOUS'|'SUPPORT_DEPENDENT'|'REGRESSION_WATCH';
export type ClimbAutonomySupportNeed='UNKNOWN'|'FULL'|'LIGHT'|'DIAGNOSTIC'|'MINIMAL';

export interface ClimbAutonomyCard{
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  state:ClimbAutonomyState;
  observedGames:number;
  supportedGames:number;
  supportedCleanRate:number|null;
  fadedGames:number;
  fadedCleanRate:number|null;
  fadedCleanStreak:number;
  preCueObserved:number;
  preCueCorrectRate:number|null;
  independentAlignedGames:number;
  independentAlignedStreak:number;
  independentContexts:number;
  autonomyStrength:number|null;
  supportDependenceGap:number|null;
  supportNeed:ClimbAutonomySupportNeed;
  evidence:string;
  nextTest:string;
}

export interface ClimbAutonomyProfile{
  version:1;
  generatedAt:string;
  gamesAnalyzed:number;
  behavioursProfiled:number;
  autonomous:number;
  supportDependent:number;
  regressionWatch:number;
  cards:ClimbAutonomyCard[];
  summary:string;
  boundary:string;
}

interface ObservedAutonomyRep{
  createdAt:string;
  champion:string;
  strategy:ClimbCoachingStrategyReview;
  mission:ClimbMatchMissionReview;
  intent:ClimbIntentGapReview|null;
}

const BOUNDARY='CLIMB Autonomy separates scaffolded execution from independent execution. Clean decisions made with coaching support are valuable learning evidence but are not counted as autonomy. AUTONOMOUS requires repeated observed clean FADE reps plus evidence that the player identified the correct branch before the adaptive cue. One clean faded game can never create autonomy, and NOT OBSERVED games are neutral.';

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function pct(cleanCount:number,total:number){return total?Math.round(cleanCount/total*100):null}
function labelFor(key:DecisionBehaviourKey,reps:ObservedAutonomyRep[]){
  return reps.find(rep=>clean(rep.strategy.behaviourLabel))?.strategy.behaviourLabel
    ??key.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,m=>m.toUpperCase());
}
function streak<T>(items:T[],test:(item:T)=>boolean){
  let total=0;
  for(let i=items.length-1;i>=0;i--){
    if(!test(items[i]!))break;
    total++;
  }
  return total;
}
function observedRows(rows:HistoryAnalysisRow[]):ObservedAutonomyRep[]{
  const out:ObservedAutonomyRep[]=[];
  for(const row of [...rows].filter(item=>item.analysis?.version===1).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).slice(-50)){
    const summary=(row.analysis as any)?.decisionGraph?.summary;
    const strategy=summary?.coachingStrategy as ClimbCoachingStrategyReview|undefined;
    const mission=summary?.climbMission as ClimbMatchMissionReview|undefined;
    const intent=summary?.intentGap as ClimbIntentGapReview|undefined;
    if(!strategy?.version||!strategy.active||!strategy.behaviourKey)continue;
    if(!mission?.version||!mission.active||mission.behaviourKey!==strategy.behaviourKey)continue;
    if(!['CLEAN','MISSED','MIXED'].includes(clean(strategy.status).toUpperCase()))continue;
    out.push({
      createdAt:row.createdAt,
      champion:clean(row.champion)||'Unknown',
      strategy,
      mission,
      intent:intent?.version===1&&intent.active&&intent.behaviourKey===strategy.behaviourKey?intent:null,
    });
  }
  return out;
}
function stateFor(input:{
  supportedGames:number;
  supportedCleanRate:number|null;
  faded:ObservedAutonomyRep[];
  fadedCleanRate:number|null;
  preCueObserved:number;
  preCueCorrectRate:number|null;
  independentAlignedGames:number;
  independentAlignedStreak:number;
}):ClimbAutonomyState{
  const lastTwo=input.faded.slice(-2);
  const prior=input.faded.slice(0,-2);
  const priorCleanRate=pct(prior.filter(rep=>rep.strategy.status==='CLEAN').length,prior.length);
  const recentFadeRegression=input.faded.length>=4&&lastTwo.length===2&&lastTwo.every(rep=>rep.strategy.status==='MISSED')&&(priorCleanRate??0)>=75;
  if(recentFadeRegression)return'REGRESSION_WATCH';

  if(
    input.faded.length>=3&&
    (input.fadedCleanRate??0)>=80&&
    input.preCueObserved>=3&&
    (input.preCueCorrectRate??0)>=75&&
    input.independentAlignedGames>=3&&
    input.independentAlignedStreak>=2
  )return'AUTONOMOUS';

  if(
    input.supportedGames>=3&&
    (input.supportedCleanRate??0)>=70&&
    input.faded.length>=2&&
    (input.fadedCleanRate??100)<50
  )return'SUPPORT_DEPENDENT';

  if(input.faded.length>=2&&(input.fadedCleanRate??0)>=50&&input.independentAlignedGames>=1)return'EMERGING';
  if(input.supportedGames>=3&&(input.supportedCleanRate??0)>=60)return'SCAFFOLDED';
  return'BUILDING';
}
function supportNeedFor(state:ClimbAutonomyState):ClimbAutonomySupportNeed{
  if(state==='AUTONOMOUS')return'MINIMAL';
  if(state==='REGRESSION_WATCH')return'LIGHT';
  if(state==='SUPPORT_DEPENDENT')return'DIAGNOSTIC';
  if(state==='EMERGING')return'LIGHT';
  if(state==='SCAFFOLDED')return'LIGHT';
  return'UNKNOWN';
}
function autonomyStrength(input:{
  fadedGames:number;
  fadedCleanRate:number|null;
  preCueObserved:number;
  preCueCorrectRate:number|null;
  independentAlignedGames:number;
  independentContexts:number;
}){
  if(input.fadedGames<2)return null;
  const fadeExecution=input.fadedCleanRate??0;
  const preCue=input.preCueObserved>=2?(input.preCueCorrectRate??0):0;
  const aligned=Math.min(100,Math.round(input.independentAlignedGames/4*100));
  const breadth=Math.min(100,Math.round(input.independentContexts/3*100));
  return Math.round(fadeExecution*.5+preCue*.25+aligned*.15+breadth*.10);
}
function evidenceFor(card:Omit<ClimbAutonomyCard,'evidence'|'nextTest'>){
  if(card.state==='AUTONOMOUS')return String(card.independentAlignedGames)+' clean unscaffolded reps were also correct before the cue; recent independent execution is holding across '+String(card.independentContexts)+' context'+(card.independentContexts===1?'':'s')+'.';
  if(card.state==='SUPPORT_DEPENDENT')return 'Supported execution is '+String(card.supportedCleanRate??0)+'% clean, but faded execution is '+String(card.fadedCleanRate??0)+'% across '+String(card.fadedGames)+' observed autonomy tests.';
  if(card.state==='REGRESSION_WATCH')return 'Independent execution was previously strong, but the last two observed faded reps were missed. Prior learning is retained while support is reintroduced.';
  if(card.state==='EMERGING')return 'Independent execution has started to appear ('+String(card.fadedCleanRate??0)+'% clean across '+String(card.fadedGames)+' faded tests) but is not yet repeated enough to call owned.';
  if(card.state==='SCAFFOLDED')return 'The branch is executing with support ('+String(card.supportedCleanRate??0)+'% clean across '+String(card.supportedGames)+' supported reps), but there is not enough clean faded evidence to call it independent.';
  return 'There is not enough observed support-vs-fade evidence to measure independent decision ownership yet.';
}
function nextTestFor(card:Omit<ClimbAutonomyCard,'evidence'|'nextTest'>){
  if(card.state==='AUTONOMOUS')return 'Keep support minimal and test the same principle in a novel champion or context. Autonomy is not the same as universal transfer.';
  if(card.state==='SUPPORT_DEPENDENT')return 'Diagnose what disappears when the cue is removed. Do not increase rep difficulty until independent execution improves.';
  if(card.state==='REGRESSION_WATCH')return 'Restore one short scaffold, then schedule another faded rep after the branch stabilises. Do not erase prior mastery from one regression window.';
  if(card.state==='EMERGING')return 'Schedule another faded rep. One more supported success is less informative than another verified independent test.';
  if(card.state==='SCAFFOLDED')return 'When repeated clean execution holds, remove the adaptive cue for a verified autonomy test.';
  return 'Build repeated verified mission evidence first; autonomy should not be guessed before the skill can be tested cleanly.';
}

export function buildClimbAutonomyProfile(rows:HistoryAnalysisRow[],generatedAt=new Date().toISOString()):ClimbAutonomyProfile{
  const reps=observedRows(rows);
  const keys=[...new Set(reps.map(rep=>rep.strategy.behaviourKey).filter((value):value is DecisionBehaviourKey=>Boolean(value)))];
  const cards:ClimbAutonomyCard[]=keys.map(behaviourKey=>{
    const subset=reps.filter(rep=>rep.strategy.behaviourKey===behaviourKey);
    const supported=subset.filter(rep=>rep.strategy.intervened);
    const faded=subset.filter(rep=>rep.strategy.mode==='FADE'&&!rep.strategy.intervened);
    const supportedCleanRate=pct(supported.filter(rep=>rep.strategy.status==='CLEAN').length,supported.length);
    const fadedCleanRate=pct(faded.filter(rep=>rep.strategy.status==='CLEAN').length,faded.length);

    const intentObserved=subset.filter(rep=>rep.intent&&typeof rep.intent.intentCorrect==='boolean');
    const preCueCorrectRate=pct(intentObserved.filter(rep=>rep.intent?.intentCorrect===true).length,intentObserved.length);

    const independentAligned=faded.filter(rep=>rep.strategy.status==='CLEAN'&&rep.intent?.intentCorrect===true);
    const independentAlignedStreak=streak(faded,rep=>rep.strategy.status==='CLEAN'&&rep.intent?.intentCorrect===true);
    const fadedCleanStreak=streak(faded,rep=>rep.strategy.status==='CLEAN');
    const contexts=new Set(independentAligned.map(rep=>String(rep.strategy.targetTag||rep.mission.targetTag||'GENERAL')+'|'+rep.champion));

    const state=stateFor({
      supportedGames:supported.length,
      supportedCleanRate,
      faded,
      fadedCleanRate,
      preCueObserved:intentObserved.length,
      preCueCorrectRate,
      independentAlignedGames:independentAligned.length,
      independentAlignedStreak,
    });
    const base:Omit<ClimbAutonomyCard,'evidence'|'nextTest'>={
      behaviourKey,
      behaviourLabel:labelFor(behaviourKey,subset),
      state,
      observedGames:subset.length,
      supportedGames:supported.length,
      supportedCleanRate,
      fadedGames:faded.length,
      fadedCleanRate,
      fadedCleanStreak,
      preCueObserved:intentObserved.length,
      preCueCorrectRate,
      independentAlignedGames:independentAligned.length,
      independentAlignedStreak,
      independentContexts:contexts.size,
      autonomyStrength:autonomyStrength({
        fadedGames:faded.length,
        fadedCleanRate,
        preCueObserved:intentObserved.length,
        preCueCorrectRate,
        independentAlignedGames:independentAligned.length,
        independentContexts:contexts.size,
      }),
      supportDependenceGap:supported.length>=2&&faded.length>=2&&supportedCleanRate!==null&&fadedCleanRate!==null
        ?supportedCleanRate-fadedCleanRate
        :null,
      supportNeed:supportNeedFor(state),
    };
    return{...base,evidence:evidenceFor(base),nextTest:nextTestFor(base)};
  }).sort((a,b)=>{
    const order:Record<ClimbAutonomyState,number>={SUPPORT_DEPENDENT:0,REGRESSION_WATCH:1,EMERGING:2,SCAFFOLDED:3,BUILDING:4,AUTONOMOUS:5};
    return order[a.state]-order[b.state]||(b.observedGames-a.observedGames);
  });

  const autonomous=cards.filter(card=>card.state==='AUTONOMOUS').length;
  const supportDependent=cards.filter(card=>card.state==='SUPPORT_DEPENDENT').length;
  const regressionWatch=cards.filter(card=>card.state==='REGRESSION_WATCH').length;
  const summary=!cards.length
    ?'Autonomy is still building. OP CLIMB has not yet collected enough observed support-vs-fade reps to separate coached execution from independent ownership.'
    :supportDependent
      ?String(supportDependent)+' behaviour'+(supportDependent===1?' is':'s are')+' currently cleaner with coaching support than without it. OP CLIMB will treat that as a support-dependence signal, not as mastery.'
      :regressionWatch
        ?String(regressionWatch)+' previously independent behaviour'+(regressionWatch===1?' is':'s are')+' on regression watch. Support can return without deleting earlier learning.'
        :autonomous
          ?String(autonomous)+' behaviour'+(autonomous===1?' has':'s have')+' repeated evidence of correct pre-cue intent plus clean faded execution.'
          :'Independent ownership is emerging, but no behaviour has yet cleared the repeated autonomy gate.';

  return{
    version:1,
    generatedAt,
    gamesAnalyzed:[...rows].filter(row=>row.analysis?.version===1).slice(-50).length,
    behavioursProfiled:cards.length,
    autonomous,
    supportDependent,
    regressionWatch,
    cards,
    summary,
    boundary:BOUNDARY,
  };
}

export const CLIMB_AUTONOMY_BOUNDARY=BOUNDARY;
