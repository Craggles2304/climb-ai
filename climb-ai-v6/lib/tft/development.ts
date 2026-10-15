import {buildTacticianProfile,tftAssessment,tftSkillRule,type TftSkillKey} from './advancedCoach';
import {analyzeTftTimeline,type TftTelemetryPoint} from './timeline';
import type {TftMatch,TftDecisionReview} from './types';

export interface TftMission{
  id:string;domain:TftSkillKey;title:string;nextGame:string;cues:string[];
  progress:number;goal:number;status:'BASELINE'|'EVIDENCE_BUILDING'|'REVIEW_READY';
  progressLabel:string;verifiedMastery:false;
}
export interface TftRecordedReview{
  id:string;matchId:string;startedAt:string;points:TftTelemetryPoint[];
  mission?:Pick<TftMission,'id'|'domain'>|null;
  assessments?:TftDecisionReview['assessments'];
}
export function hasTftObservation(points:TftTelemetryPoint[],domain:TftSkillKey){
  const valid=points.filter(p=>Number.isFinite(Date.parse(p.at))&&/^\d{1,2}-\d{1,2}$/.test(p.round));
  // These gates prove only that a decision can be reviewed, never that it was good.
  if(domain==='ECONOMY')return new Set(valid.filter(p=>Number.isFinite(p.gold)).map(p=>p.round)).size>=2;
  if(domain==='TEMPO')return valid.some((p,i)=>i>0&&p.level!==undefined&&valid[i-1].level!==undefined&&p.level!==valid[i-1].level)
    ||valid.some(p=>(p.shopRefreshes??0)>0);
  if(domain==='BOARD_BUILDING')return valid.some(p=>p.boardUnits!==undefined||p.boardPower!==undefined);
  if(domain==='ITEMS_AUGMENTS')return valid.some(p=>p.completedItems!==undefined||p.heldComponents!==undefined);
  // Own HUD/shop capture cannot prove scouting, pivot quality or endgame choices.
  return false;
}
export function buildTftDevelopment(matches:TftMatch[],recordings:TftRecordedReview[]){
  const sessionReviews:TftMatch[]=recordings.filter(r=>r.assessments).map(r=>({
    id:r.matchId,riotAccountId:'',playedAt:r.startedAt,gameLengthSeconds:0,gameVersion:'',placement:0,
    augments:[],traits:[],units:[],compSignature:'',decisionReview:{assessments:r.assessments},
  }));
  const profile=buildTacticianProfile([...sessionReviews,...matches]);
  const domain=profile.primaryLeak?.key??'ECONOMY';
  const id=`tft-${domain.toLowerCase()}-evidence-v2`;
  const unique=[...new Map(recordings.map(r=>[r.id,r])).values()];
  const reviewable=(r:TftRecordedReview)=>{
    const input=sessionReviews.find(m=>m.id===r.matchId);
    const assessment=input?tftAssessment(input,domain):null;
    return hasTftObservation(r.points,domain)||!!assessment&&r.points.some(p=>p.round===assessment.round);
  };
  const observed=unique.filter(r=>r.mission?.id===id&&reviewable(r));
  const progress=Math.min(3,observed.length);
  const mission:TftMission={id,domain,title:profile.primaryLeak?`${profile.primaryLeak.label.toUpperCase()} DECISION PRACTICE`:'BUILD YOUR TFT EVIDENCE',
    nextGame:tftSkillRule(domain),cues:['Name the purpose before the decision.','Review the recorded moment after the match.'],
    progress,goal:3,status:progress>=3?'REVIEW_READY':unique.length||matches.length?'EVIDENCE_BUILDING':'BASELINE',
    progressLabel:'Recorded games with observations or an explained self-review for this mission, within your latest 20 recordings. This does not certify correct play or mastery.',verifiedMastery:false};
  const recorded=unique.map(r=>({id:r.id,matchId:r.matchId,startedAt:r.startedAt,pointCount:r.points.length,
    mission:r.mission,reviewableForMission:r.mission?.id===id&&reviewable(r),
    findings:analyzeTftTimeline({version:1,source:'local-player',matchId:r.matchId,points:r.points})}));
  return{profile,mission,recorded,recordedGames:unique.length,
    evidenceBoundary:'Recorded observations describe visible actions. DNA scores are explained player self-reviews, not verified decision quality. Results alone never grade a skill.'};
}
export type TftDevelopment=ReturnType<typeof buildTftDevelopment>;
