import type {DecisionBehaviourKey} from './decisionTwin';
import {rankCareerMatrixSignals,type CareerMatrixSignal} from './climbCareerMatrix';
import {runClimbCareerMatrixLongitudinalBench,type ClimbCareerMatrixLongitudinalReport} from './climbCareerMatrixLongitudinalBench';

export type CareerMatrixBenchCategory=
  |'FREQUENCY_TRAP'
  |'SEVERITY_TRAP'
  |'RECENCY_TRAP'
  |'PREREQUISITE_TRAP'
  |'TRANSFER_DISCIPLINE'
  |'DEFERRED_RECOVERY'
  |'COACHING_RESTRAINT';

export interface CareerMatrixBenchCaseResult{
  id:string;
  category:CareerMatrixBenchCategory;
  expected:DecisionBehaviourKey|null;
  actual:DecisionBehaviourKey|null;
  pass:boolean;
  detail:string;
}

export interface ClimbCareerMatrixBenchReport{
  version:1;
  cases:number;
  passed:number;
  selectionAccuracy:number;
  rootCauseAccuracy:number;
  prerequisiteDiscipline:number;
  stabilityAccuracy:number;
  transferDiscipline:number;
  deferredRecovery:number;
  coachingRestraint:number;
  results:CareerMatrixBenchCaseResult[];
  longitudinal:ClimbCareerMatrixLongitudinalReport;
  failures:string[];
  boundary:string;
}

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

const BOUNDARY='Career Matrix Bench uses explicit gold-standard multi-skill cases to test which skill receives the single coaching slot. These cases are deterministic regressions, not claims that one coaching order is universally optimal for every real player.';

function signal(
  key:DecisionBehaviourKey,
  severity:number,
  recurrence:number,
  confidence:CareerMatrixSignal['confidence'],
  prioritySignal:number,
  extra:Partial<CareerMatrixSignal>={},
):CareerMatrixSignal{
  return{
    key,
    label:LABELS[key],
    currentScore:100-severity,
    severity,
    recurrence,
    impact:IMPACT[key],
    prioritySignal,
    confidence,
    regressionRisk:0,
    locallyMastered:false,
    transferStrength:0,
    principleOwned:false,
    strictPrerequisite:null,
    prerequisiteSatisfied:true,
    evidence:'Synthetic gold-standard benchmark evidence.',
    ...extra,
  };
}

const CASES:Array<{
  id:string;
  category:CareerMatrixBenchCategory;
  expected:DecisionBehaviourKey|null;
  signals:CareerMatrixSignal[];
  detail:string;
}>=[
  {
    id:'frequency-does-not-beat-upstream-leverage',
    category:'FREQUENCY_TRAP',
    expected:'THREAT_ADAPTATION',
    signals:[
      signal('DEATH_RECOVERY',45,100,'HIGH',85),
      signal('THREAT_ADAPTATION',65,55,'HIGH',75),
      signal('FIGHT_SELECTION',72,80,'HIGH',92),
    ],
    detail:'A more frequent weakness must not beat an observed upstream skill that explains a larger development surface.',
  },
  {
    id:'visible-severity-does-not-beat-root-cause',
    category:'SEVERITY_TRAP',
    expected:'THREAT_ADAPTATION',
    signals:[
      signal('THREAT_ADAPTATION',52,55,'HIGH',72),
      signal('FIGHT_SELECTION',82,85,'HIGH',98),
      signal('CARRY_PRESERVATION',70,65,'HIGH',90),
    ],
    detail:'The most visibly severe downstream symptom should lose when a verified upstream skill can unlock both downstream behaviours.',
  },
  {
    id:'one-game-recency-does-not-steal-curriculum',
    category:'RECENCY_TRAP',
    expected:'FIGHT_SELECTION',
    signals:[
      signal('DEATH_RECOVERY',95,12,'LOW',100),
      signal('FIGHT_SELECTION',60,70,'HIGH',80),
    ],
    detail:'A dramatic low-evidence one-off must stay dormant behind a repeated high-confidence limiter.',
  },
  {
    id:'locked-objective-yields-to-foundation',
    category:'PREREQUISITE_TRAP',
    expected:'FARM_VS_SETUP',
    signals:[
      signal('OBJECTIVE_READINESS',90,80,'HIGH',100,{strictPrerequisite:'FARM_VS_SETUP',prerequisiteSatisfied:false}),
      signal('FARM_VS_SETUP',45,50,'MEDIUM',55),
    ],
    detail:'Objective Arrival cannot own the coaching slot while Farm vs Setup is an unstable prerequisite.',
  },
  {
    id:'local-mastery-requires-transfer-test',
    category:'TRANSFER_DISCIPLINE',
    expected:'CARRY_PRESERVATION',
    signals:[
      signal('CARRY_PRESERVATION',16,85,'HIGH',55,{locallyMastered:true,transferStrength:20}),
      signal('DEATH_RECOVERY',35,45,'MEDIUM',50),
    ],
    detail:'Local mastery should create a transfer test rather than falsely graduating the principle.',
  },
  {
    id:'deferred-real-weakness-returns',
    category:'DEFERRED_RECOVERY',
    expected:'RESET_DISCIPLINE',
    signals:[
      signal('RESET_DISCIPLINE',40,70,'HIGH',60),
      signal('FIGHT_SELECTION',50,65,'HIGH',70),
      signal('POWER_SPIKE_CONVERSION',50,60,'HIGH',65),
    ],
    detail:'A legitimate deferred foundation must eventually return once accumulated curriculum debt makes further postponement irrational.',
  },
  {
    id:'coach-can-choose-nothing',
    category:'COACHING_RESTRAINT',
    expected:null,
    signals:[
      signal('DEATH_RECOVERY',92,12,'LOW',95),
    ],
    detail:'A single low-confidence observation should not consume the active coaching slot merely because it looks severe.',
  },
];

function pct(passed:number,total:number){return total?Math.round(passed/total*1000)/10:100}
function categoryRate(results:CareerMatrixBenchCaseResult[],categories:CareerMatrixBenchCategory[]){
  const selected=results.filter(result=>categories.includes(result.category));
  return pct(selected.filter(result=>result.pass).length,selected.length);
}

export function runClimbCareerMatrixBench():ClimbCareerMatrixBenchReport{
  let previousForDebt:any=null;
  const results:CareerMatrixBenchCaseResult[]=[];

  for(const benchCase of CASES){
    let matrix;
    if(benchCase.category==='DEFERRED_RECOVERY'){
      previousForDebt=rankCareerMatrixSignals(benchCase.signals,{gamesAnalyzed:10});
      const priorReset=previousForDebt.candidates.find((item:any)=>item.key==='RESET_DISCIPLINE');
      if(priorReset)priorReset.curriculumDebt=72;
      matrix=rankCareerMatrixSignals(benchCase.signals,{gamesAnalyzed:11,previous:previousForDebt});
    }else{
      matrix=rankCareerMatrixSignals(benchCase.signals,{gamesAnalyzed:10});
    }
    const actual=matrix.recommendedSkill;
    results.push({
      id:benchCase.id,
      category:benchCase.category,
      expected:benchCase.expected,
      actual,
      pass:actual===benchCase.expected,
      detail:benchCase.detail,
    });
  }

  const passed=results.filter(result=>result.pass).length;
  const longitudinal=runClimbCareerMatrixLongitudinalBench();
  const failures=[
    ...results.filter(result=>!result.pass).map(result=>result.id+': expected '+String(result.expected)+' but received '+String(result.actual)),
    ...longitudinal.failures,
  ];
  return{
    version:1,
    cases:results.length,
    passed,
    selectionAccuracy:pct(passed,results.length),
    rootCauseAccuracy:categoryRate(results,['FREQUENCY_TRAP','SEVERITY_TRAP']),
    prerequisiteDiscipline:categoryRate(results,['PREREQUISITE_TRAP']),
    stabilityAccuracy:categoryRate(results,['RECENCY_TRAP']),
    transferDiscipline:categoryRate(results,['TRANSFER_DISCIPLINE']),
    deferredRecovery:categoryRate(results,['DEFERRED_RECOVERY']),
    coachingRestraint:categoryRate(results,['COACHING_RESTRAINT']),
    results,
    longitudinal,
    failures,
    boundary:BOUNDARY,
  };
}

export const CLIMB_CAREER_MATRIX_BENCH_BOUNDARY=BOUNDARY;
