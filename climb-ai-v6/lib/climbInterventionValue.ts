import type {HistoryAnalysisRow} from './riot/proHistory';
import type {DecisionBehaviourKey} from './decisionTwin';
import type {ClimbMatchMissionReview} from './climbMissionDesign';
import type {ClimbCoachingStrategyReview} from './climbCoachingStrategy';

export type ClimbInterventionValueState=
  |'BUILDING'
  |'NO_CLEAR_DIFFERENCE'
  |'SUPPORT_ASSOCIATED_LIFT'
  |'STRONG_SUPPORT_ASSOCIATED_LIFT'
  |'FADE_ASSOCIATED_BETTER';

export type ClimbInterventionValueConfidence='LOW'|'MEDIUM'|'HIGH';
export type ClimbInterventionNextTest='MORE_MATCHED_REPS'|'FADE_HOLDOUT'|'SUPPORTED_RETEST'|'KEEP_COMPARING';

export interface ClimbInterventionCell{
  key:string;
  targetTag:string;
  repLevel:number;
  supportedGames:number;
  fadedGames:number;
  comparablePairs:number;
  supportedResponseRate:number;
  fadedResponseRate:number;
  responseDifference:number;
}

export interface ClimbInterventionValueCard{
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  state:ClimbInterventionValueState;
  confidence:ClimbInterventionValueConfidence;
  matchedCells:number;
  comparablePairs:number;
  supportedObserved:number;
  fadedObserved:number;
  supportedResponseRate:number|null;
  fadedResponseRate:number|null;
  matchedResponseDifference:number|null;
  supportingCells:number;
  neutralCells:number;
  fadeBetterCells:number;
  consistency:number|null;
  nextTest:ClimbInterventionNextTest;
  evidence:string;
  interpretation:string;
  cells:ClimbInterventionCell[];
}

export interface ClimbInterventionValueProfile{
  version:1;
  generatedAt:string;
  gamesAnalyzed:number;
  behavioursProfiled:number;
  supportLiftSignals:number;
  strongSupportLiftSignals:number;
  fadeBetterSignals:number;
  cards:ClimbInterventionValueCard[];
  summary:string;
  boundary:string;
}

interface Rep{
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  targetTag:string;
  repLevel:number;
  intervened:boolean;
  mode:string;
  score:number;
}

const BOUNDARY='CLIMB Intervention Value compares repeated supported and faded reps within the same player, behaviour, situation tag and Rep Ladder difficulty. It reports matched response differences, not causal treatment effects. A higher supported response rate does not prove the coaching caused the improvement; assignment is adaptive rather than randomized, and small samples remain BUILDING. NOT OBSERVED games are neutral.';

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function mean(values:number[]){return values.length?Math.round(values.reduce((sum,value)=>sum+value,0)/values.length):null}
function score(review:ClimbCoachingStrategyReview){
  if(review.status==='CLEAN')return 100;
  if(review.status==='MISSED')return 0;
  if(review.status==='MIXED'&&review.matchedMoments>0)return Math.round(review.cleanMoments/review.matchedMoments*100);
  return null;
}
function rowsToReps(rows:HistoryAnalysisRow[]):Rep[]{
  const out:Rep[]=[];
  for(const row of [...rows].filter(item=>item.analysis?.version===1).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).slice(-50)){
    const summary=(row.analysis as any)?.decisionGraph?.summary;
    const strategy=summary?.coachingStrategy as ClimbCoachingStrategyReview|undefined;
    const mission=summary?.climbMission as ClimbMatchMissionReview|undefined;
    if(!strategy?.version||!strategy.active||!strategy.behaviourKey)continue;
    if(!mission?.version||!mission.active||mission.behaviourKey!==strategy.behaviourKey)continue;
    const response=score(strategy);
    if(response===null)continue;
    out.push({
      behaviourKey:strategy.behaviourKey,
      behaviourLabel:clean(strategy.behaviourLabel)||strategy.behaviourKey,
      targetTag:clean(strategy.targetTag||mission.targetTag||'GENERAL').toUpperCase(),
      repLevel:Number(mission.repLevel||1),
      intervened:Boolean(strategy.intervened),
      mode:clean(strategy.mode).toUpperCase(),
      score:response,
    });
  }
  return out;
}
function cellKey(rep:Rep){return rep.targetTag+'|L'+String(rep.repLevel)}
function cellFor(items:Rep[]):ClimbInterventionCell|null{
  const supported=items.filter(item=>item.intervened);
  const faded=items.filter(item=>!item.intervened&&item.mode==='FADE');
  if(!supported.length||!faded.length)return null;
  const supportedRate=mean(supported.map(item=>item.score))??0;
  const fadedRate=mean(faded.map(item=>item.score))??0;
  return{
    key:cellKey(items[0]!),
    targetTag:items[0]!.targetTag,
    repLevel:items[0]!.repLevel,
    supportedGames:supported.length,
    fadedGames:faded.length,
    comparablePairs:Math.min(supported.length,faded.length),
    supportedResponseRate:supportedRate,
    fadedResponseRate:fadedRate,
    responseDifference:supportedRate-fadedRate,
  };
}
function stateFor(input:{
  supportedObserved:number;
  fadedObserved:number;
  comparablePairs:number;
  matchedCells:number;
  difference:number|null;
  consistency:number|null;
}):ClimbInterventionValueState{
  if(input.supportedObserved<3||input.fadedObserved<3||input.comparablePairs<3||input.matchedCells<1||input.difference===null)return'BUILDING';
  if(input.difference>=25&&input.comparablePairs>=5&&(input.consistency??0)>=67)return'STRONG_SUPPORT_ASSOCIATED_LIFT';
  if(input.difference>=15)return'SUPPORT_ASSOCIATED_LIFT';
  if(input.difference<=-15)return'FADE_ASSOCIATED_BETTER';
  return'NO_CLEAR_DIFFERENCE';
}
function confidenceFor(state:ClimbInterventionValueState,pairs:number,cells:number,consistency:number|null):ClimbInterventionValueConfidence{
  if(state==='BUILDING')return'LOW';
  if(pairs>=8&&cells>=2&&(consistency??0)>=75)return'HIGH';
  if(pairs>=5)return'MEDIUM';
  return'LOW';
}
function nextTestFor(input:{
  state:ClimbInterventionValueState;
  supportedObserved:number;
  fadedObserved:number;
}):ClimbInterventionNextTest{
  if(input.state==='BUILDING'){
    if(input.supportedObserved>=3&&input.fadedObserved<3)return'FADE_HOLDOUT';
    if(input.fadedObserved>=3&&input.supportedObserved<3)return'SUPPORTED_RETEST';
    return'MORE_MATCHED_REPS';
  }
  return'KEEP_COMPARING';
}
function evidenceFor(input:{
  state:ClimbInterventionValueState;
  supportedObserved:number;
  fadedObserved:number;
  supportedRate:number|null;
  fadedRate:number|null;
  difference:number|null;
  pairs:number;
  cells:number;
}){
  if(input.state==='BUILDING')return 'Matched intervention evidence is still building: '+String(input.supportedObserved)+' supported and '+String(input.fadedObserved)+' faded observed reps are available across '+String(input.cells)+' matched cell'+(input.cells===1?'':'s')+'.';
  return 'Across '+String(input.pairs)+' matched comparison pair'+(input.pairs===1?'':'s')+', supported response is '+String(input.supportedRate??0)+'% versus '+String(input.fadedRate??0)+'% faded; the matched response difference is '+String(input.difference??0)+' points.';
}
function interpretationFor(state:ClimbInterventionValueState){
  if(state==='STRONG_SUPPORT_ASSOCIATED_LIFT')return 'Support is repeatedly associated with materially cleaner execution in matched reps. Treat this as a strong within-player signal, not proof of causation; keep testing faded reps so useful support does not become permanent dependency.';
  if(state==='SUPPORT_ASSOCIATED_LIFT')return 'Support is associated with cleaner execution in the current matched evidence. The signal is useful for coaching policy, but it is not strong enough to stop holdout testing.';
  if(state==='FADE_ASSOCIATED_BETTER')return 'Faded reps are currently as good or better in the matched evidence. Extra intervention may be unnecessary or may be arriving after the decision model is already owned; keep support minimal while monitoring regression.';
  if(state==='NO_CLEAR_DIFFERENCE')return 'Supported and faded reps are currently too similar to justify claiming meaningful intervention value. Prefer the least intrusive support compatible with learning and keep comparing.';
  return 'OP CLIMB needs more matched supported-versus-faded reps before it can estimate whether intervention is associated with a meaningful response difference.';
}

export function buildClimbInterventionValueProfile(rows:HistoryAnalysisRow[],generatedAt=new Date().toISOString()):ClimbInterventionValueProfile{
  const reps=rowsToReps(rows);
  const keys=[...new Set(reps.map(item=>item.behaviourKey))];
  const cards:ClimbInterventionValueCard[]=keys.map(behaviourKey=>{
    const subset=reps.filter(item=>item.behaviourKey===behaviourKey);
    const groups=new Map<string,Rep[]>();
    for(const rep of subset){
      const key=cellKey(rep);
      const current=groups.get(key)??[];
      current.push(rep);
      groups.set(key,current);
    }
    const cells=[...groups.values()].map(cellFor).filter((item):item is ClimbInterventionCell=>Boolean(item));
    const supportedScores=cells.flatMap(cell=>{
      const items=groups.get(cell.key)??[];
      return items.filter(item=>item.intervened).map(item=>item.score);
    });
    const fadedScores=cells.flatMap(cell=>{
      const items=groups.get(cell.key)??[];
      return items.filter(item=>!item.intervened&&item.mode==='FADE').map(item=>item.score);
    });
    const comparablePairs=cells.reduce((sum,cell)=>sum+cell.comparablePairs,0);
    const weightedDiff=comparablePairs
      ?Math.round(cells.reduce((sum,cell)=>sum+cell.responseDifference*cell.comparablePairs,0)/comparablePairs)
      :null;
    const directional=cells.filter(cell=>Math.abs(cell.responseDifference)>=10);
    const dominantPositive=directional.filter(cell=>cell.responseDifference>0).length;
    const dominantNegative=directional.filter(cell=>cell.responseDifference<0).length;
    const consistency=directional.length
      ?Math.round(Math.max(dominantPositive,dominantNegative)/directional.length*100)
      :null;
    const state=stateFor({
      supportedObserved:supportedScores.length,
      fadedObserved:fadedScores.length,
      comparablePairs,
      matchedCells:cells.length,
      difference:weightedDiff,
      consistency,
    });
    const confidence=confidenceFor(state,comparablePairs,cells.length,consistency);
    const supportedRate=mean(supportedScores);
    const fadedRate=mean(fadedScores);
    const nextTest=nextTestFor({state,supportedObserved:supportedScores.length,fadedObserved:fadedScores.length});
    return{
      behaviourKey,
      behaviourLabel:subset[0]?.behaviourLabel??behaviourKey,
      state,
      confidence,
      matchedCells:cells.length,
      comparablePairs,
      supportedObserved:supportedScores.length,
      fadedObserved:fadedScores.length,
      supportedResponseRate:supportedRate,
      fadedResponseRate:fadedRate,
      matchedResponseDifference:weightedDiff,
      supportingCells:cells.filter(cell=>cell.responseDifference>=10).length,
      neutralCells:cells.filter(cell=>Math.abs(cell.responseDifference)<10).length,
      fadeBetterCells:cells.filter(cell=>cell.responseDifference<=-10).length,
      consistency,
      nextTest,
      evidence:evidenceFor({
        state,
        supportedObserved:supportedScores.length,
        fadedObserved:fadedScores.length,
        supportedRate,
        fadedRate,
        difference:weightedDiff,
        pairs:comparablePairs,
        cells:cells.length,
      }),
      interpretation:interpretationFor(state),
      cells:cells.sort((a,b)=>b.comparablePairs-a.comparablePairs||Math.abs(b.responseDifference)-Math.abs(a.responseDifference)),
    };
  }).sort((a,b)=>{
    const order:Record<ClimbInterventionValueState,number>={
      STRONG_SUPPORT_ASSOCIATED_LIFT:0,
      SUPPORT_ASSOCIATED_LIFT:1,
      FADE_ASSOCIATED_BETTER:2,
      NO_CLEAR_DIFFERENCE:3,
      BUILDING:4,
    };
    return order[a.state]-order[b.state]||b.comparablePairs-a.comparablePairs;
  });

  const strong=cards.filter(card=>card.state==='STRONG_SUPPORT_ASSOCIATED_LIFT').length;
  const lift=cards.filter(card=>card.state==='SUPPORT_ASSOCIATED_LIFT'||card.state==='STRONG_SUPPORT_ASSOCIATED_LIFT').length;
  const fadeBetter=cards.filter(card=>card.state==='FADE_ASSOCIATED_BETTER').length;
  const summary=!cards.length
    ?'Intervention Value is building. OP CLIMB needs matched supported and faded decision reps before it can compare response.'
    :strong
      ?String(strong)+' behaviour'+(strong===1?' has':'s have')+' a strong repeated within-player support-associated response signal. This is not a causal claim.'
      :lift
        ?String(lift)+' behaviour'+(lift===1?' has':'s have')+' a support-associated lift signal that should keep being tested against faded reps.'
        :fadeBetter
          ?String(fadeBetter)+' behaviour'+(fadeBetter===1?' is':'s are')+' currently as clean or cleaner without adaptive support in matched evidence.'
          :'No behaviour currently shows a clear matched support-versus-fade response difference.';

  return{
    version:1,
    generatedAt,
    gamesAnalyzed:[...rows].filter(row=>row.analysis?.version===1).slice(-50).length,
    behavioursProfiled:cards.length,
    supportLiftSignals:lift,
    strongSupportLiftSignals:strong,
    fadeBetterSignals:fadeBetter,
    cards,
    summary,
    boundary:BOUNDARY,
  };
}

export const CLIMB_INTERVENTION_VALUE_BOUNDARY=BOUNDARY;
