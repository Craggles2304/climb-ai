import type {DecisionBehaviourKey,DecisionTwinConfidence} from './decisionTwin';
import {rankCareerMatrixSignals,type CareerMatrixSignal,type ClimbCareerMatrix} from './climbCareerMatrix';

export type LongitudinalCareerKind=
  |'ROOT_CAUSE_CHAIN'
  |'PREREQUISITE_CHAIN'
  |'NOISE_RESISTANCE'
  |'TRANSFER_HANDOFF'
  |'DEFERRED_RETURN';

export interface CareerMatrixLongitudinalEvent{
  game:number;
  expected:DecisionBehaviourKey|null;
  actual:DecisionBehaviourKey|null;
  switched:boolean;
  goldChanged:boolean;
  lowConfidenceSteal:boolean;
  prerequisiteViolation:boolean;
}

export interface CareerMatrixLongitudinalCareer{
  id:string;
  kind:LongitudinalCareerKind;
  seed:number;
  games:number;
  decisions:number;
  correct:number;
  exactSelectionRate:number;
  wrongSwitches:number;
  lowConfidenceSteals:number;
  prerequisiteViolations:number;
  targetTransitions:number;
  completed:boolean;
  deferredReturned:boolean|null;
  events:CareerMatrixLongitudinalEvent[];
}

export interface ClimbCareerMatrixLongitudinalReport{
  version:1;
  gamesPerCareer:number;
  seeds:number[];
  careers:number;
  totalGames:number;
  totalDecisions:number;
  exactSelectionRate:number;
  wrongSwitchesPer100:number;
  lowConfidenceSteals:number;
  prerequisiteViolations:number;
  completedCareers:number;
  deferredReturnRate:number;
  careersDetail:CareerMatrixLongitudinalCareer[];
  failures:string[];
  boundary:string;
}

type SkillState={
  skill:number;
  transfer:number;
  owned:boolean;
};

type CareerModel={
  kind:LongitudinalCareerKind;
  order:DecisionBehaviourKey[];
  states:Partial<Record<DecisionBehaviourKey,SkillState>>;
};

const LABELS:Record<DecisionBehaviourKey,string>={
  FIGHT_SELECTION:'Fight Selection',
  DEATH_RECOVERY:'Recovery After Death',
  LEAD_PROTECTION:'Lead Protection',
  RESET_DISCIPLINE:'Reset Discipline',
  OBJECTIVE_READINESS:'Objective Arrival',
  FARM_VS_SETUP:'Farm vs Setup',
  THREAT_ADAPTATION:'Threat Adaptation',
  CARRY_PRESERVATION:'Carry Preservation',
  POWER_SPIKE_CONVERSION:'Power-Spike Conversion',
  SURVIVAL_VALUE:'Survival Value',
};

const IMPACT:Record<DecisionBehaviourKey,number>={
  FIGHT_SELECTION:88,
  DEATH_RECOVERY:82,
  LEAD_PROTECTION:84,
  RESET_DISCIPLINE:80,
  OBJECTIVE_READINESS:86,
  FARM_VS_SETUP:78,
  THREAT_ADAPTATION:84,
  CARRY_PRESERVATION:90,
  POWER_SPIKE_CONVERSION:86,
  SURVIVAL_VALUE:88,
};

const PREREQUISITE:Partial<Record<DecisionBehaviourKey,DecisionBehaviourKey>>={
  OBJECTIVE_READINESS:'FARM_VS_SETUP',
  LEAD_PROTECTION:'FIGHT_SELECTION',
  POWER_SPIKE_CONVERSION:'RESET_DISCIPLINE',
  CARRY_PRESERVATION:'THREAT_ADAPTATION',
  SURVIVAL_VALUE:'CARRY_PRESERVATION',
};

const BOUNDARY='Longitudinal Career Matrix Bench is a deterministic synthetic causal arena. Each career declares a hidden development order so the benchmark can detect wrong target selection, noisy focus theft and prerequisite violations. Hidden simulator state never becomes live player evidence and the benchmark does not claim that one universal skill order applies to every real player.';

function clamp(value:number,min=0,max=100){return Math.max(min,Math.min(max,Math.round(value)))}
function clamp01(value:number){return Math.max(0,Math.min(1,value))}
function round(value:number,digits=1){const f=10**digits;return Math.round(value*f)/f}
function pct(value:number,total:number){return total?round(value/total*100,1):100}
function rng(seed:number){
  let state=(seed>>>0)||1;
  return()=>{
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    return state/0x1_0000_0000;
  };
}
function noise(random:()=>number,amplitude:number){
  return (random()*2-1)*amplitude;
}
function skill(skill:number,transfer=0):SkillState{
  return{skill,transfer,owned:transfer>=85};
}
function confidence(game:number):DecisionTwinConfidence{
  return game>=6?'HIGH':game>=3?'MEDIUM':'LOW';
}
function model(kind:LongitudinalCareerKind):CareerModel{
  if(kind==='ROOT_CAUSE_CHAIN')return{
    kind,
    order:['THREAT_ADAPTATION','FIGHT_SELECTION','CARRY_PRESERVATION'],
    states:{
      THREAT_ADAPTATION:skill(.34),
      FIGHT_SELECTION:skill(.42),
      CARRY_PRESERVATION:skill(.46),
    },
  };
  if(kind==='PREREQUISITE_CHAIN')return{
    kind,
    order:['FARM_VS_SETUP','OBJECTIVE_READINESS'],
    states:{
      FARM_VS_SETUP:skill(.36),
      OBJECTIVE_READINESS:skill(.24),
    },
  };
  if(kind==='NOISE_RESISTANCE')return{
    kind,
    order:['FIGHT_SELECTION'],
    states:{
      FIGHT_SELECTION:skill(.38),
      DEATH_RECOVERY:skill(.82,90),
    },
  };
  if(kind==='TRANSFER_HANDOFF')return{
    kind,
    order:['CARRY_PRESERVATION','DEATH_RECOVERY'],
    states:{
      THREAT_ADAPTATION:skill(.9,90),
      CARRY_PRESERVATION:skill(.84,15),
      DEATH_RECOVERY:skill(.58),
    },
  };
  return{
    kind,
    order:['FIGHT_SELECTION','RESET_DISCIPLINE'],
    states:{
      FIGHT_SELECTION:skill(.36),
      RESET_DISCIPLINE:skill(.52),
    },
  };
}
function expectedTarget(career:CareerModel){
  for(const key of career.order){
    if(!career.states[key]?.owned)return key;
  }
  return null;
}
function prerequisiteSatisfied(career:CareerModel,key:DecisionBehaviourKey){
  const prerequisite=PREREQUISITE[key];
  if(!prerequisite)return true;
  return Boolean(career.states[prerequisite]?.owned);
}
function baseRecurrence(key:DecisionBehaviourKey,game:number,career:CareerModel){
  const state=career.states[key];
  if(!state)return 0;
  if(state.owned)return 30;
  return clamp(48+game*2.2+(1-state.skill)*25);
}
function signalFor(input:{
  key:DecisionBehaviourKey;
  game:number;
  career:CareerModel;
  random:()=>number;
}):CareerMatrixSignal{
  const state=input.career.states[input.key]!;
  const isNoiseSpike=input.career.kind==='NOISE_RESISTANCE'&&input.key==='DEATH_RECOVERY'&&input.game%7===0;
  const confidenceValue:isNoiseSpike extends true ? never : never = null as never;
  void confidenceValue;
  const signalConfidence:DecisionTwinConfidence=isNoiseSpike?'LOW':confidence(input.game+5);
  const rawSeverity=(1-state.skill)*100+noise(input.random,isNoiseSpike?4:5)+(isNoiseSpike?72:0);
  const severity=clamp(rawSeverity);
  const recurrence=isNoiseSpike?12:baseRecurrence(input.key,input.game,input.career);
  const strictPrerequisite=PREREQUISITE[input.key]??null;
  return{
    key:input.key,
    label:LABELS[input.key],
    currentScore:clamp(100-severity),
    severity,
    recurrence,
    impact:IMPACT[input.key],
    prioritySignal:clamp(severity*.72+recurrence*.28),
    confidence:signalConfidence,
    regressionRisk:0,
    locallyMastered:state.skill>=.82,
    transferStrength:clamp(state.transfer),
    principleOwned:state.owned,
    strictPrerequisite,
    prerequisiteSatisfied:prerequisiteSatisfied(input.career,input.key),
    evidence:'Synthetic longitudinal causal career evidence.',
  };
}
function signalsFor(career:CareerModel,game:number,random:()=>number){
  return (Object.keys(career.states) as DecisionBehaviourKey[]).map(key=>signalFor({key,game,career,random}));
}
function train(career:CareerModel,key:DecisionBehaviourKey|null,random:()=>number){
  if(!key)return;
  const state=career.states[key];
  if(!state||state.owned)return;

  if(state.skill<.82){
    const gain=.065+random()*.025;
    state.skill=clamp01(state.skill+gain);
    if(key==='THREAT_ADAPTATION'){
      const fight=career.states.FIGHT_SELECTION;
      const carry=career.states.CARRY_PRESERVATION;
      if(fight&&!fight.owned)fight.skill=clamp01(fight.skill+.012);
      if(carry&&!carry.owned)carry.skill=clamp01(carry.skill+.014);
    }
    if(key==='FARM_VS_SETUP'){
      const objective=career.states.OBJECTIVE_READINESS;
      if(objective&&!objective.owned)objective.skill=clamp01(objective.skill+.01);
    }
    return;
  }

  state.transfer=Math.min(100,state.transfer+18+random()*6);
  if(state.transfer>=85)state.owned=true;
}
function allCompleted(career:CareerModel){
  return career.order.every(key=>career.states[key]?.owned);
}

const KINDS:LongitudinalCareerKind[]=[
  'ROOT_CAUSE_CHAIN',
  'PREREQUISITE_CHAIN',
  'NOISE_RESISTANCE',
  'TRANSFER_HANDOFF',
  'DEFERRED_RETURN',
];

function runCareer(kind:LongitudinalCareerKind,seed:number,games:number):CareerMatrixLongitudinalCareer{
  const random=rng(seed);
  const career=model(kind);
  let previous:ClimbCareerMatrix|null=null;
  let active:DecisionBehaviourKey|null=null;
  let previousExpected:DecisionBehaviourKey|null=null;
  let previousActual:DecisionBehaviourKey|null=null;
  let decisions=0,correct=0,wrongSwitches=0,lowConfidenceSteals=0,prerequisiteViolations=0,targetTransitions=0;
  let resetReturnGame:number|null=null;
  let fightOwnedGame:number|null=null;
  const events:CareerMatrixLongitudinalEvent[]=[];

  for(let game=1;game<=games;game++){
    const expected=expectedTarget(career);
    if(previousExpected!==null&&expected!==previousExpected)targetTransitions++;
    if(kind==='DEFERRED_RETURN'&&career.states.FIGHT_SELECTION?.owned&&fightOwnedGame===null)fightOwnedGame=game;

    const signals=signalsFor(career,game,random);
    const matrix=rankCareerMatrixSignals(signals,{
      generatedAt:new Date(Date.UTC(2026,0,1)+(game-1)*86_400_000).toISOString(),
      gamesAnalyzed:game+5,
      activeBehaviourKey:active,
      previous,
    });
    const actual=matrix.recommendedSkill;
    const switched=previousActual!==null&&actual!==previousActual;
    const goldChanged=previousExpected!==null&&expected!==previousExpected;
    const actualSignal=signals.find(item=>item.key===actual)??null;
    const lowConfidenceSteal=Boolean(actual&&actual!==expected&&actualSignal?.confidence==='LOW');
    const prerequisiteViolation=Boolean(actual&&!prerequisiteSatisfied(career,actual));

    if(expected!==null){
      decisions++;
      if(actual===expected)correct++;
    }
    if(switched&&!goldChanged&&actual!==expected)wrongSwitches++;
    if(lowConfidenceSteal)lowConfidenceSteals++;
    if(prerequisiteViolation)prerequisiteViolations++;
    if(kind==='DEFERRED_RETURN'&&actual==='RESET_DISCIPLINE'&&resetReturnGame===null)resetReturnGame=game;

    events.push({
      game,
      expected,
      actual,
      switched,
      goldChanged,
      lowConfidenceSteal,
      prerequisiteViolation,
    });

    train(career,actual,random);
    previous=matrix;
    active=actual;
    previousExpected=expected;
    previousActual=actual;
  }

  const deferredReturned=kind==='DEFERRED_RETURN'
    ?Boolean(fightOwnedGame!==null&&resetReturnGame!==null&&resetReturnGame>=fightOwnedGame&&resetReturnGame-fightOwnedGame<=4)
    :null;

  return{
    id:kind+'-'+String(seed),
    kind,
    seed,
    games,
    decisions,
    correct,
    exactSelectionRate:pct(correct,decisions),
    wrongSwitches,
    lowConfidenceSteals,
    prerequisiteViolations,
    targetTransitions,
    completed:allCompleted(career),
    deferredReturned,
    events,
  };
}

export function runClimbCareerMatrixLongitudinalBench(input:{
  gamesPerCareer?:number;
  seeds?:number[];
}={}):ClimbCareerMatrixLongitudinalReport{
  const gamesPerCareer=Math.max(36,Math.floor(input.gamesPerCareer??48));
  const seeds=input.seeds?.length?input.seeds:[11,23,47,89,131];
  const careersDetail:CareerMatrixLongitudinalCareer[]=[];
  seeds.forEach((seed,seedIndex)=>{
    KINDS.forEach((kind,kindIndex)=>{
      careersDetail.push(runCareer(kind,seed+seedIndex*1009+kindIndex*7919,gamesPerCareer));
    });
  });

  const totalGames=careersDetail.reduce((sum,career)=>sum+career.games,0);
  const totalDecisions=careersDetail.reduce((sum,career)=>sum+career.decisions,0);
  const correct=careersDetail.reduce((sum,career)=>sum+career.correct,0);
  const wrongSwitches=careersDetail.reduce((sum,career)=>sum+career.wrongSwitches,0);
  const lowConfidenceSteals=careersDetail.reduce((sum,career)=>sum+career.lowConfidenceSteals,0);
  const prerequisiteViolations=careersDetail.reduce((sum,career)=>sum+career.prerequisiteViolations,0);
  const completedCareers=careersDetail.filter(career=>career.completed).length;
  const deferred=careersDetail.filter(career=>career.kind==='DEFERRED_RETURN');
  const deferredReturned=deferred.filter(career=>career.deferredReturned).length;
  const exactSelectionRate=pct(correct,totalDecisions);
  const wrongSwitchesPer100=totalGames?round(wrongSwitches/totalGames*100,2):0;
  const deferredReturnRate=pct(deferredReturned,deferred.length);
  const failures:string[]=[];

  if(exactSelectionRate<94)failures.push('Longitudinal exact target selection fell below 94%: '+String(exactSelectionRate)+'%.');
  if(wrongSwitchesPer100>1)failures.push('Wrong focus switching exceeded 1 per 100 games: '+String(wrongSwitchesPer100)+'.');
  if(lowConfidenceSteals>0)failures.push('Low-confidence noise stole the active target '+String(lowConfidenceSteals)+' time(s).');
  if(prerequisiteViolations>0)failures.push('Locked prerequisite was violated '+String(prerequisiteViolations)+' time(s).');
  if(completedCareers<careersDetail.length)failures.push(String(careersDetail.length-completedCareers)+' synthetic career(s) failed to complete their declared development sequence.');
  if(deferredReturnRate<100)failures.push('Deferred weakness return rate was '+String(deferredReturnRate)+'%, expected 100%.');

  return{
    version:1,
    gamesPerCareer,
    seeds,
    careers:careersDetail.length,
    totalGames,
    totalDecisions,
    exactSelectionRate,
    wrongSwitchesPer100,
    lowConfidenceSteals,
    prerequisiteViolations,
    completedCareers,
    deferredReturnRate,
    careersDetail,
    failures,
    boundary:BOUNDARY,
  };
}

export const CLIMB_CAREER_MATRIX_LONGITUDINAL_BOUNDARY=BOUNDARY;
