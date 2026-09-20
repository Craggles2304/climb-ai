import {buildDecisionTwin,type DecisionBehaviourKey,type DecisionPatternState,type DecisionSituationPattern,type DecisionSituationTag} from './decisionTwin';
import type {HistoryAnalysisRow} from './riot/proHistory';

export type LearningTimelineEventType=
  |'PATTERN_DISCOVERED'
  |'COACHING_STARTED'
  |'FIRST_EXECUTION'
  |'IMPROVING'
  |'MASTERED'
  |'REGRESSED'
  |'FOCUS_SELECTED'
  |'FOCUS_CHANGED';

export interface LearningTimelineEvent{
  id:string;
  type:LearningTimelineEventType;
  at:string;
  gameNumber:number;
  title:string;
  detail:string;
  behaviourKey:DecisionBehaviourKey|null;
  behaviourLabel:string|null;
  situationTag:DecisionSituationTag|null;
  patternId:string|null;
  state:DecisionPatternState|null;
  evidence:{
    decisions?:number;
    failures?:number;
    failureRate?:number|null;
    priorFailureRate?:number|null;
    recentFailureRate?:number|null;
    coachedDecisions?:number;
    coachedExecuted?:number;
    coachedExecutionRate?:number|null;
  };
}

export interface LearningJourney{
  version:1;
  generatedAt:string;
  gamesAnalyzed:number;
  stage:'BUILDING'|'LEARNING'|'PROVING'|'MASTERING';
  headline:string;
  currentFocus:{
    key:DecisionBehaviourKey;
    label:string;
    recentScore:number|null;
    state:string;
  }|null;
  summary:{
    verifiedPatterns:number;
    improvingPatterns:number;
    masteredPatterns:number;
    regressingPatterns:number;
    coachedDecisions:number;
    coachedExecuted:number;
    coachedMissed:number;
    coachingExecutionRate:number|null;
  };
  events:LearningTimelineEvent[];
}

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function pct(value:number|null|undefined){return typeof value==='number'?value+'%':'building'}
function displayTag(tag:DecisionSituationTag|null|undefined){return clean(tag).replaceAll('_',' ').toLowerCase()}
function stateEvent(type:LearningTimelineEventType,pattern:DecisionSituationPattern,at:string,gameNumber:number,detail:string):LearningTimelineEvent{
  return{
    id:[type,pattern.id,gameNumber].join(':').toLowerCase(),
    type,
    at,
    gameNumber,
    title:type==='PATTERN_DISCOVERED'
      ?'Pattern discovered · '+pattern.behaviourLabel
      :type==='COACHING_STARTED'
        ?'Coaching started · '+pattern.behaviourLabel
        :type==='FIRST_EXECUTION'
          ?'First verified execution · '+pattern.behaviourLabel
          :type==='IMPROVING'
            ?'Pattern improving · '+pattern.behaviourLabel
            :type==='MASTERED'
              ?'Pattern mastered · '+pattern.behaviourLabel
              :'Regression detected · '+pattern.behaviourLabel,
    detail,
    behaviourKey:pattern.behaviourKey,
    behaviourLabel:pattern.behaviourLabel,
    situationTag:pattern.tag,
    patternId:pattern.id,
    state:pattern.state,
    evidence:{
      decisions:pattern.decisions,
      failures:pattern.failures,
      failureRate:pattern.failureRate,
      priorFailureRate:pattern.priorFailureRate,
      recentFailureRate:pattern.recentFailureRate,
      coachedDecisions:pattern.coachedDecisions,
      coachedExecuted:pattern.coachedExecuted,
      coachedExecutionRate:pattern.coachedExecutionRate,
    },
  };
}

function focusEvent(type:'FOCUS_SELECTED'|'FOCUS_CHANGED',focus:NonNullable<ReturnType<typeof buildDecisionTwin>['currentLimiter']>,at:string,gameNumber:number,previousLabel?:string):LearningTimelineEvent{
  return{
    id:[type,focus.key,gameNumber].join(':').toLowerCase(),
    type,
    at,
    gameNumber,
    title:type==='FOCUS_SELECTED'?'Primary limiter selected · '+focus.label:'Next limiter selected · '+focus.label,
    detail:type==='FOCUS_SELECTED'
      ?'Repeated evidence promoted '+focus.label.toLowerCase()+' into the current Decision Twin limiter.'
      :(previousLabel?previousLabel+' stopped being the strongest current limiter; '+focus.label+' became the next behaviour to train.':focus.label+' became the next behaviour to train.'),
    behaviourKey:focus.key,
    behaviourLabel:focus.label,
    situationTag:null,
    patternId:null,
    state:null,
    evidence:{},
  };
}

function coachingTotals(rows:HistoryAnalysisRow[]){
  let coachedDecisions=0,coachedExecuted=0,coachedMissed=0;
  const seen=new Set<string>();
  rows.forEach((row,rowIndex)=>{
    const nodes=row.analysis?.decisionGraph?.nodes??[];
    nodes.forEach((node:any,nodeIndex:number)=>{
      const response=clean(node?.coachingResponse?.status).toUpperCase();
      if(response!=='EXECUTED'&&response!=='MISSED')return;
      const key=(row.createdAt||String(rowIndex))+'|'+clean(node?.id||nodeIndex);
      if(seen.has(key))return;seen.add(key);
      coachedDecisions++;
      if(response==='EXECUTED')coachedExecuted++;
      else coachedMissed++;
    });
  });
  return{coachedDecisions,coachedExecuted,coachedMissed,coachingExecutionRate:coachedDecisions?Math.round(coachedExecuted/coachedDecisions*100):null};
}

function journeyStage(input:{games:number;mastered:number;coached:number;verified:number}):LearningJourney['stage']{
  if(input.mastered>0)return'MASTERING';
  if(input.coached>=3)return'PROVING';
  if(input.verified>0)return'LEARNING';
  return'BUILDING';
}

export function buildLearningJourney(rows:HistoryAnalysisRow[],generatedAt=new Date().toISOString()):LearningJourney{
  const ordered=[...rows].filter(row=>row.analysis?.version===1).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).slice(-50);
  const events:LearningTimelineEvent[]=[];
  const previousStates=new Map<string,DecisionPatternState>();
  const previousCoached=new Map<string,number>();
  const previousExecuted=new Map<string,number>();
  let previousFocus:DecisionBehaviourKey|null=null;
  let previousFocusLabel='';

  ordered.forEach((_,index)=>{
    const prefix=ordered.slice(0,index+1);
    const at=ordered[index].createdAt;
    const twin=buildDecisionTwin(prefix,at);
    const gameNumber=index+1;

    if(twin.currentLimiter?.key&&twin.currentLimiter.key!==previousFocus){
      events.push(focusEvent(previousFocus?'FOCUS_CHANGED':'FOCUS_SELECTED',twin.currentLimiter,at,gameNumber,previousFocusLabel));
      previousFocus=twin.currentLimiter.key;
      previousFocusLabel=twin.currentLimiter.label;
    }

    for(const pattern of twin.situationPatterns.filter(item=>item.tag!=='GENERAL')){
      const before=previousStates.get(pattern.id);
      if(pattern.state==='ACTIVE'&&before!=='ACTIVE'&&before!=='IMPROVING'&&before!=='MASTERED'&&before!=='REGRESSING'){
        events.push(stateEvent('PATTERN_DISCOVERED',pattern,at,gameNumber,
          pattern.failures+' of '+pattern.decisions+' comparable '+displayTag(pattern.tag)+' decisions were graded for improvement ('+pattern.failureRate+'%).'));
      }
      if(pattern.state==='IMPROVING'&&before!=='IMPROVING'){
        events.push(stateEvent('IMPROVING',pattern,at,gameNumber,
          'Failure rate moved from '+pct(pattern.priorFailureRate)+' in the prior window to '+pct(pattern.recentFailureRate)+' recently.'));
      }
      if(pattern.state==='MASTERED'&&before!=='MASTERED'){
        events.push(stateEvent('MASTERED',pattern,at,gameNumber,
          pattern.recentSuccesses+'/'+pattern.recentDecisions+' recent comparable decisions were clean after a prior '+pct(pattern.priorFailureRate)+' failure rate.'));
      }
      if(pattern.state==='REGRESSING'&&before!=='REGRESSING'){
        events.push(stateEvent('REGRESSED',pattern,at,gameNumber,
          'A previously cleaner pattern moved from '+pct(pattern.priorFailureRate)+' prior failures to '+pct(pattern.recentFailureRate)+' recently.'));
      }

      const coachedBefore=previousCoached.get(pattern.id)??0;
      if(pattern.coachedDecisions>0&&coachedBefore===0){
        events.push(stateEvent('COACHING_STARTED',pattern,at,gameNumber,
          'OP CLIMB showed a verified pre-game cue and this game produced the first comparable decision that could be measured afterwards.'));
      }
      const executedBefore=previousExecuted.get(pattern.id)??0;
      if(pattern.coachedExecuted>0&&executedBefore===0){
        events.push(stateEvent('FIRST_EXECUTION',pattern,at,gameNumber,
          'The trained cue was executed in a verified comparable decision. This records transfer after coaching, not proof that the cue caused the result.'));
      }

      previousStates.set(pattern.id,pattern.state);
      previousCoached.set(pattern.id,pattern.coachedDecisions);
      previousExecuted.set(pattern.id,pattern.coachedExecuted);
    }
  });

  const twin=buildDecisionTwin(ordered,generatedAt);
  const totals=coachingTotals(ordered);
  const verified=twin.situationPatterns.filter(pattern=>pattern.tag!=='GENERAL'&&pattern.state!=='BUILDING').length;
  const stage=journeyStage({games:ordered.length,mastered:twin.masteredSituations.length,coached:totals.coachedDecisions,verified});
  const headline=stage==='MASTERING'
    ?'OP CLIMB has verified at least one behaviour you learned and is moving the model forward.'
    :stage==='PROVING'
      ?'The coach is now measuring whether pre-game cues transfer into repeated in-game decisions.'
      :stage==='LEARNING'
        ?'Your Decision Twin has found repeatable situations and is building the evidence needed to coach them.'
        :'OP CLIMB is still collecting enough comparable decisions to build a trustworthy learning history.';

  return{
    version:1,
    generatedAt,
    gamesAnalyzed:ordered.length,
    stage,
    headline,
    currentFocus:twin.currentLimiter?{
      key:twin.currentLimiter.key,
      label:twin.currentLimiter.label,
      recentScore:twin.currentLimiter.recentScore,
      state:twin.currentLimiter.state,
    }:null,
    summary:{
      verifiedPatterns:verified,
      improvingPatterns:twin.situationPatterns.filter(pattern=>pattern.state==='IMPROVING').length,
      masteredPatterns:twin.situationPatterns.filter(pattern=>pattern.state==='MASTERED').length,
      regressingPatterns:twin.situationPatterns.filter(pattern=>pattern.state==='REGRESSING').length,
      ...totals,
    },
    events:events.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||b.gameNumber-a.gameNumber).slice(0,24),
  };
}
