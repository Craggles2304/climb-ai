import type {TftContested,TftMatch,TftReviewAssessment} from './types';

export const TFT_SKILL_KEYS=['ECONOMY','TEMPO','BOARD_BUILDING','FLEXIBILITY','ITEMS_AUGMENTS','CONVERSION'] as const;
export type TftSkillKey=typeof TFT_SKILL_KEYS[number];
export interface TftSkillScore{
  key:TftSkillKey;label:string;score:number|null;evidenceCount:number;rationale:string;
  basis:'SELF_REVIEW'|'NOT_OBSERVED';
}
export interface TftIlpTask{
  id:string;skill:TftSkillKey;title:string;why:string;target:string;progress:number;goal:number;priority:number;
  verifiedProgress:number;reviewedGames:number;
}
export interface TftTacticianProfile{
  grade:number|null;primaryLeak:TftSkillScore|null;skills:TftSkillScore[];ilp:TftIlpTask[];
  gradingBasis:'SELF_REVIEW'|'NOT_OBSERVED';
}
const labels:Record<TftSkillKey,string>={ECONOMY:'Economy',TEMPO:'Tempo',BOARD_BUILDING:'Board Building',FLEXIBILITY:'Flexibility',ITEMS_AUGMENTS:'Items & Augments',CONVERSION:'Endgame Decisions'};
const rules:Record<TftSkillKey,string>={
  ECONOMY:'Before spending, state the upgrade you want and the condition that will stop your spending.',
  TEMPO:'Name your next level or roll checkpoint before reaching it, then review the decision after the game.',
  BOARD_BUILDING:'Before changing the board, name the frontline, damage or synergy problem the change should solve.',
  FLEXIBILITY:'Keep a second item-compatible direction open and review the point at which you committed.',
  ITEMS_AUGMENTS:'Explain what the item or augment solves for your current board before choosing it.',
  CONVERSION:'Before a late-game spend or reposition, name the concrete improvement you are trying to create.',
};
export function tftSkillRule(skill:TftSkillKey){return rules[skill]}

/** A result, gold total or level cannot establish whether a decision was correct.
 * A timestamped player review is useful reflection, but never verified skill transfer.
 * Legacy dropdowns without a decision explanation do not become graded evidence.
 */
export function tftAssessment(match:TftMatch,skill:TftSkillKey):TftReviewAssessment|null{
  const a=match.decisionReview?.assessments?.[skill];
  if(!a||!/^[1-9]\d?-[0-9]\d?$/.test(a.round)||typeof a.reason!=='string'||a.reason.trim().length<10||a.reason.length>500||!['HELPED','HURT','UNCERTAIN'].includes(a.verdict))return null;
  return a;
}
function uniqueMatches(matches:TftMatch[]){
  const seen=new Set<string>();
  return [...matches].sort((a,b)=>Date.parse(b.playedAt)-Date.parse(a.playedAt)).filter(m=>{
    if(!m.id||seen.has(m.id))return false;seen.add(m.id);return true;
  }).slice(0,20);
}
export function buildTacticianProfile(matches:TftMatch[]):TftTacticianProfile{
  const sample=uniqueMatches(matches);
  const skills:TftSkillScore[]=TFT_SKILL_KEYS.map(key=>{
    const reviews=sample.map(m=>tftAssessment(m,key)).filter((a):a is TftReviewAssessment=>!!a&&a.verdict!=='UNCERTAIN');
    const helped=reviews.filter(a=>a.verdict==='HELPED').length;
    return{key,label:labels[key],score:reviews.length?Math.round(helped/reviews.length*100):null,
      evidenceCount:reviews.length,
      basis:reviews.length?'SELF_REVIEW':'NOT_OBSERVED',
      rationale:reviews.length
        ?`${helped}/${reviews.length} explained player reviews marked this decision as helpful. Self-reported; not independently verified.`
        :'No explained decision review yet. Placement, final level and leftover gold do not prove decision quality.'};
  });
  const known=skills.filter(s=>s.score!==null);
  const ranked=[...skills].sort((a,b)=>(a.score??101)-(b.score??101)||TFT_SKILL_KEYS.indexOf(a.key)-TFT_SKILL_KEYS.indexOf(b.key));
  const primaryLeak=ranked.find(s=>s.score!==null&&s.score<75)??known[0]??null;
  const ilp=ranked.map((skill,index)=>{
    const reviews=sample.filter(m=>tftAssessment(m,skill.key)?.verdict==='HELPED');
    return{id:`tft-${skill.key.toLowerCase()}`,skill:skill.key,title:labels[skill.key].toUpperCase()+' DECISION PRACTICE',
      why:skill.rationale,target:rules[skill.key],progress:Math.min(3,reviews.length),goal:3,priority:index+1,
      reviewedGames:skill.evidenceCount,verifiedProgress:0};
  });
  return{grade:known.length?Math.round(known.reduce((s,k)=>s+k.score!,0)/known.length):null,
    primaryLeak,skills,ilp,gradingBasis:known.length?'SELF_REVIEW':'NOT_OBSERVED'};
}

export type DecisionStage='2-1'|'2-5'|'3-2'|'3-5'|'4-1'|'4-2'|'4-5'|'5-1+';
export type BoardStrength='WEAK'|'EVEN'|'STRONG';
export type StreakState='LOSS_3_PLUS'|'LOSS_1_2'|'NONE'|'WIN_1_2'|'WIN_3_PLUS';

export interface TftDecisionReplayInput{
  stage:DecisionStage;
  hp:number;
  gold:number;
  level:number;
  boardStrength:BoardStrength;
  streak:StreakState;
  contested:TftContested;
  upgradesNeeded:number;
}

export interface TftDecisionReplayResult{
  call:'ROLL / STABILISE'|'PUSH LEVEL / TEMPO'|'HOLD ECON'|'PIVOT LINE'|'SMALL ROLL / REASSESS';
  urgency:'LOW'|'MEDIUM'|'HIGH';
  score:number;
  reasons:string[];
  checkpoint:string;
}

export function analyseDecisionReplay(input:TftDecisionReplayInput):TftDecisionReplayResult{
  const reasons:string[]=[];
  const lateStage=['4-1','4-2','4-5','5-1+'].includes(input.stage);
  const danger=input.hp<=45;
  const critical=input.hp<=30;
  const weak=input.boardStrength==='WEAK';
  const strong=input.boardStrength==='STRONG';
  const losing=input.streak==='LOSS_3_PLUS';
  const winning=input.streak==='WIN_3_PLUS';

  if(input.contested==='HEAVY'&&input.upgradesNeeded>=2){
    reasons.push('The line is heavily contested while multiple upgrades are still missing.');
    if(lateStage)reasons.push('The later the stage, the more expensive it becomes to wait for the same shared unit pool.');
    return{call:'PIVOT LINE',urgency:danger?'HIGH':'MEDIUM',score:danger?92:82,reasons,checkpoint:'In the replay, identify the first shop/augment/item point where a second viable line was still open.'};
  }

  if((critical||danger&&losing)&&weak){
    reasons.push(`HP was ${input.hp}, so future economy had less value than immediate board strength.`);
    reasons.push('The board was weak and already under loss-streak pressure.');
    if(input.gold>=20)reasons.push(`${input.gold} gold meant there was still enough resource to buy meaningful stabilisation.`);
    return{call:'ROLL / STABILISE',urgency:'HIGH',score:95,reasons,checkpoint:'Replay the roll-down: what exact upgrades or trait breakpoints would have made you stop rolling?'};
  }

  if(strong&&input.gold>=40&&(winning||input.hp>=70)){
    reasons.push('The board was already strong enough to preserve HP.');
    reasons.push(`${input.gold} gold gave room to convert economy into level/tempo without an emergency roll.`);
    return{call:'PUSH LEVEL / TEMPO',urgency:'LOW',score:86,reasons,checkpoint:'Check whether leveling created a real unit/trait breakpoint; if it did not, holding economy may have been better.'};
  }

  if(!lateStage&&input.hp>=60&&input.gold>=40&&!weak){
    reasons.push('HP and board strength were stable enough that an emergency spend was not forced.');
    reasons.push('Preserving interest kept more future options open.');
    return{call:'HOLD ECON',urgency:'LOW',score:80,reasons,checkpoint:'Define the next forced decision point: level breakpoint, HP threshold or a specific upgrade pair.'};
  }

  if(weak&&input.gold>=20){
    reasons.push('The board was weak, but the state was not yet an automatic all-in.');
    reasons.push('A controlled roll can test upgrade density before committing the full bank.');
    return{call:'SMALL ROLL / REASSESS',urgency:danger?'HIGH':'MEDIUM',score:78,reasons,checkpoint:'Set a stop condition before rolling: target upgrades, minimum gold floor and the board strength required to stop.'};
  }

  reasons.push('No single emergency signal dominates this replay state.');
  reasons.push('The best decision depends on the next concrete breakpoint rather than spending by habit.');
  return{call:strong?'PUSH LEVEL / TEMPO':'HOLD ECON',urgency:'MEDIUM',score:70,reasons,checkpoint:'Name the next real breakpoint before spending: level, trait, two-star upgrade, item completion or HP danger threshold.'};
}
