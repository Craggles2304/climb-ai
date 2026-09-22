import {
  DEFAULT_SIMULATION_ARCHETYPES,
  runSimulationCareer,
  type SimulationArchetype,
  type SimulationCareerReport,
  type SimulationGameEvent,
  type SimulationPolicyId,
} from './climbSimulationLab';
import {runClimbCareerMatrixBench,type ClimbCareerMatrixBenchReport} from './climbCareerMatrixBench';
import {runClimbAutonomousCurriculumBench,type ClimbAutonomousCurriculumBenchReport} from './climbAutonomousCurriculumBench';

export interface ClimbCoachBenchMetrics{
  careers:number;
  games:number;
  observedMissionReps:number;
  cleanDecisionRate:number;
  supportRate:number;
  fadeRate:number;
  autonomyCareerRate:number;
  principleOwnedRate:number;
  medianFirstAutonomyGame:number|null;
  medianFirstLevel5Game:number|null;
  medianFirstPrincipleOwnedGame:number|null;
  difficultyChangesPer100:number;
  falsePromotionCount:number;
  falseRegressionCount:number;
  unsafeFadeCount:number;
  supportEfficiency:number;
  experimentsScheduled:number;
  experimentsCompleted:number;
  experimentsNotObserved:number;
  experimentPolicyMismatches:number;
  experimentCompletionRate:number|null;
  score:number;
}

export interface ClimbCoachBenchPolicyReport{
  policyId:SimulationPolicyId;
  label:string;
  metrics:ClimbCoachBenchMetrics;
  selectionEligible:boolean;
  disqualifications:string[];
  careerReports:SimulationCareerReport[];
}

export interface ClimbCoachBenchGuardrail{
  key:string;
  pass:boolean;
  detail:string;
}

export interface ClimbCoachBenchReport{
  version:1;
  gamesPerCareer:number;
  seeds:number[];
  archetypes:string[];
  totalSyntheticGames:number;
  policies:ClimbCoachBenchPolicyReport[];
  careerMatrix:ClimbCareerMatrixBenchReport;
  autonomousCurriculum:ClimbAutonomousCurriculumBenchReport;
  guardrails:ClimbCoachBenchGuardrail[];
  scoreLeader:SimulationPolicyId;
  winner:SimulationPolicyId;
  invariantViolations:string[];
  summary:string;
  boundary:string;
}

const LABELS:Record<SimulationPolicyId,string>={
  PRODUCT:'OP CLIMB production policy',
  ALWAYS_SCAFFOLD:'Always scaffold baseline',
  EARLY_FADE:'Early fade baseline',
};

const BOUNDARY='CLIMB Coach Bench is a deterministic synthetic policy benchmark. It may use hidden simulated skill to detect benchmark-only false promotion/regression, but hidden simulator state never becomes player evidence and never changes live coaching. Composite score is a regression signal, not proof that a policy is optimal for every real player. Raw metrics and hard safety guardrails take priority over score.';

function pct(value:number){return Math.round(value*1000)/10}
function round(value:number,digits=2){
  const factor=10**digits;
  return Math.round(value*factor)/factor;
}
function median(values:number[]){
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  const mid=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[mid]!:round((sorted[mid-1]!+sorted[mid]!)/2,1);
}
function firstGame(events:SimulationGameEvent[],predicate:(event:SimulationGameEvent)=>boolean){
  return events.find(predicate)?.game??null;
}
function rate(numerator:number,denominator:number){
  return denominator?numerator/denominator:0;
}
function policyScore(input:{
  cleanDecisionRate:number;
  principleOwnedRate:number;
  autonomyCareerRate:number;
  supportRate:number;
  difficultyChangesPer100:number;
  unsafeFadeCount:number;
  observedMissionReps:number;
  falsePromotionCount:number;
  falseRegressionCount:number;
}){
  const stability=Math.max(0,1-input.difficultyChangesPer100/12);
  const safety=1-Math.min(1,(input.unsafeFadeCount+input.falsePromotionCount+input.falseRegressionCount)/Math.max(1,input.observedMissionReps));
  const supportEconomy=1-input.supportRate;
  return round(
    input.cleanDecisionRate*35+
    input.principleOwnedRate*20+
    input.autonomyCareerRate*20+
    supportEconomy*10+
    stability*10+
    safety*5,
    2,
  );
}
function policyMetrics(careers:SimulationCareerReport[]):ClimbCoachBenchMetrics{
  const events=careers.flatMap(career=>career.events);
  const missionEvents=events.filter(event=>event.missionStatus==='READY');
  const observed=missionEvents.filter(event=>event.outcome!=='NOT_OBSERVED');
  const clean=observed.filter(event=>event.outcome==='GOOD');
  const supported=missionEvents.filter(event=>event.strategyIntervened===true);
  const faded=missionEvents.filter(event=>event.strategyMode==='FADE'&&event.strategyIntervened===false);
  const autonomousCareers=careers.filter(career=>career.events.some(event=>event.autonomyState==='AUTONOMOUS'));
  const principleOwnedCareers=careers.filter(career=>career.principleOwned);
  const firstAutonomy=careers.map(career=>firstGame(career.events,event=>event.autonomyState==='AUTONOMOUS')).filter((value):value is number=>value!==null);
  const firstL5=careers.map(career=>firstGame(career.events,event=>event.postRepLevel===5)).filter((value):value is number=>value!==null);
  const firstOwned=careers.map(career=>firstGame(career.events,event=>event.transferState==='PRINCIPLE_OWNED'||event.curriculumPhase==='GRADUATED')).filter((value):value is number=>value!==null);

  let falsePromotionCount=0;
  let falseRegressionCount=0;
  let unsafeFadeCount=0;
  for(const event of missionEvents){
    const pre=event.repLevel;
    const post=event.postRepLevel;
    // Synthetic-ground-truth diagnostics only. These thresholds never flow into the product.
    if(pre!==null&&post!==null&&post>pre&&event.latentSkill<.58)falsePromotionCount++;
    if(pre!==null&&post!==null&&post<pre&&event.postCurriculumPhase!=='REOPEN')falseRegressionCount++;
    const repeatedPriorGap=(event.strategyIntentEvidenceStreak??0)>=2&&(
      event.strategyIntentDiagnosis==='KNOWLEDGE_GAP'||event.strategyIntentDiagnosis==='EXECUTION_GAP'
    );
    if(event.strategyMode==='FADE'&&(
      event.repLevel!==null&&event.repLevel<3||
      repeatedPriorGap
    ))unsafeFadeCount++;
  }

  const experiments=missionEvents.filter(event=>Boolean(event.experimentType));
  const experimentsCompleted=experiments.filter(event=>event.experimentReview==='COMPLETED').length;
  const experimentsNotObserved=experiments.filter(event=>event.experimentReview==='NOT_OBSERVED').length;
  const experimentPolicyMismatches=experiments.filter(event=>event.experimentReview==='POLICY_MISMATCH').length;
  const promotions=careers.reduce((sum,career)=>sum+career.promotions,0);
  const demotions=careers.reduce((sum,career)=>sum+career.demotions,0);
  const games=careers.reduce((sum,career)=>sum+career.games,0);
  const cleanDecisionRate=rate(clean.length,observed.length);
  const supportRate=rate(supported.length,missionEvents.length);
  const autonomyCareerRate=rate(autonomousCareers.length,careers.length);
  const principleOwnedRate=rate(principleOwnedCareers.length,careers.length);
  const difficultyChangesPer100=games?((promotions+demotions)/games)*100:0;
  const supportEfficiency=rate(clean.filter(event=>event.strategyIntervened===true).length,supported.filter(event=>event.outcome!=='NOT_OBSERVED').length);

  const base={
    careers:careers.length,
    games,
    observedMissionReps:observed.length,
    cleanDecisionRate,
    supportRate,
    fadeRate:rate(faded.length,missionEvents.length),
    autonomyCareerRate,
    principleOwnedRate,
    medianFirstAutonomyGame:median(firstAutonomy),
    medianFirstLevel5Game:median(firstL5),
    medianFirstPrincipleOwnedGame:median(firstOwned),
    difficultyChangesPer100,
    falsePromotionCount,
    falseRegressionCount,
    unsafeFadeCount,
    supportEfficiency,
    experimentsScheduled:experiments.length,
    experimentsCompleted,
    experimentsNotObserved,
    experimentPolicyMismatches,
    experimentCompletionRate:experiments.length?rate(experimentsCompleted,experiments.length):null,
  };
  return{
    ...base,
    cleanDecisionRate:pct(base.cleanDecisionRate),
    supportRate:pct(base.supportRate),
    fadeRate:pct(base.fadeRate),
    autonomyCareerRate:pct(base.autonomyCareerRate),
    principleOwnedRate:pct(base.principleOwnedRate),
    difficultyChangesPer100:round(base.difficultyChangesPer100,2),
    supportEfficiency:pct(base.supportEfficiency),
    experimentCompletionRate:base.experimentCompletionRate===null?null:pct(base.experimentCompletionRate),
    score:policyScore(base),
  };
}

export function runClimbCoachBench(input:{
  gamesPerCareer?:number;
  seeds?:number[];
  archetypes?:SimulationArchetype[];
  policies?:SimulationPolicyId[];
}={}):ClimbCoachBenchReport{
  const gamesPerCareer=Math.max(40,Math.floor(input.gamesPerCareer??120));
  const seeds=input.seeds?.length?input.seeds:[101,202,303,404,505];
  const archetypes=input.archetypes??DEFAULT_SIMULATION_ARCHETYPES;
  const policies=input.policies??['PRODUCT','ALWAYS_SCAFFOLD','EARLY_FADE'];

  const reports:ClimbCoachBenchPolicyReport[]=policies.map(policyId=>{
    const careerReports:SimulationCareerReport[]=[];
    seeds.forEach((seed,seedIndex)=>{
      archetypes.forEach((archetype,archetypeIndex)=>{
        careerReports.push(runSimulationCareer({
          archetype,
          games:gamesPerCareer,
          seed:seed+seedIndex*100003+archetypeIndex*7919,
          policy:policyId,
          policyAffectsOutcomes:true,
        }));
      });
    });
    const metrics=policyMetrics(careerReports);
    const disqualifications:string[]=[];
    if(careerReports.some(career=>career.invariants.length>0))disqualifications.push('LEARNING_INVARIANT_VIOLATION');
    if(metrics.experimentPolicyMismatches>0)disqualifications.push('EXPERIMENT_POLICY_MISMATCH');
    if(metrics.falseRegressionCount>0)disqualifications.push('FALSE_REGRESSION');
    if(metrics.unsafeFadeCount>0)disqualifications.push('UNSAFE_FADE');
    return{
      policyId,
      label:LABELS[policyId],
      metrics,
      selectionEligible:disqualifications.length===0,
      disqualifications,
      careerReports,
    };
  });

  const byId=Object.fromEntries(reports.map(report=>[report.policyId,report])) as Partial<Record<SimulationPolicyId,ClimbCoachBenchPolicyReport>>;
  const product=byId.PRODUCT;
  const scaffold=byId.ALWAYS_SCAFFOLD;
  const earlyFade=byId.EARLY_FADE;
  const invariantViolations=reports.flatMap(report=>report.careerReports.flatMap(career=>career.invariants.map(error=>report.policyId+': '+error)));

  const careerMatrix=runClimbCareerMatrixBench();
  const autonomousCurriculum=runClimbAutonomousCurriculumBench();
  const guardrails:ClimbCoachBenchGuardrail[]=[{
    key:'MULTI_SKILL_CAREER_MATRIX',
    pass:careerMatrix.failures.length===0,
    detail:'Production must choose the gold-standard coaching target across frequency, severity, recency, prerequisite, transfer, deferred-skill and restraint traps.',
  },{
    key:'AUTONOMOUS_CURRICULUM_V6',
    pass:autonomousCurriculum.failures.length===0,
    detail:'V6 must preserve one learning contract through teach, practise, fade, transfer, interruption, graduation and replacement without inventing progress.',
  }];
  if(product){
    guardrails.push({
      key:'PRODUCT_INVARIANTS',
      pass:product.careerReports.every(career=>career.invariants.length===0),
      detail:'Production policy must keep every existing synthetic learning invariant.',
    });
    guardrails.push({
      key:'NO_POLICY_MISMATCH',
      pass:product.metrics.experimentPolicyMismatches===0,
      detail:'Production experiments must never be counted under a different support condition.',
    });
    guardrails.push({
      key:'NO_UNSAFE_FADE',
      pass:product.metrics.unsafeFadeCount===0,
      detail:'Production must not fade during early reps or a repeated pre-existing knowledge/execution gap.',
    });
    guardrails.push({
      key:'NO_FALSE_REGRESSION',
      pass:product.metrics.falseRegressionCount===0,
      detail:'A difficulty demotion must correspond to the verified REOPEN regression state.',
    });
  }
  if(product&&scaffold){
    guardrails.push({
      key:'LESS_SUPPORT_THAN_ALWAYS_SCAFFOLD',
      pass:product.metrics.supportRate+5<=scaffold.metrics.supportRate,
      detail:'Production should use materially less scaffolding than the always-support baseline.',
    });
    guardrails.push({
      key:'MORE_AUTONOMY_THAN_ALWAYS_SCAFFOLD',
      pass:product.metrics.autonomyCareerRate>=scaffold.metrics.autonomyCareerRate+20,
      detail:'Adaptive fading should create materially more independently verified careers than always scaffolding.',
    });
  }
  if(product&&earlyFade){
    guardrails.push({
      key:'CLEAN_RATE_VS_EARLY_FADE',
      pass:product.metrics.cleanDecisionRate+2>=earlyFade.metrics.cleanDecisionRate,
      detail:'Production clean-decision rate may not trail unsafe early fading by more than two percentage points.',
    });
    guardrails.push({
      key:'SAFER_THAN_EARLY_FADE',
      pass:product.metrics.unsafeFadeCount<earlyFade.metrics.unsafeFadeCount,
      detail:'Production must produce fewer unsafe faded reps than the early-fade baseline.',
    });
  }

  const ranked=[...reports].sort((a,b)=>b.metrics.score-a.metrics.score||a.policyId.localeCompare(b.policyId));
  const scoreLeader=ranked[0]?.policyId??'PRODUCT';
  const eligible=ranked.filter(report=>report.selectionEligible);
  const winner=eligible[0]?.policyId??'PRODUCT';
  const totalSyntheticGames=reports.reduce((sum,report)=>sum+report.metrics.games,0);
  const failed=guardrails.filter(item=>!item.pass);

  return{
    version:1,
    gamesPerCareer,
    seeds,
    archetypes:archetypes.map(item=>item.id),
    totalSyntheticGames,
    policies:reports,
    careerMatrix,
    autonomousCurriculum,
    guardrails,
    scoreLeader,
    winner,
    invariantViolations,
    summary:failed.length
      ?'CLIMB Coach Bench found '+String(failed.length)+' failed coaching-policy guardrail'+(failed.length===1?'':'s')+' across '+String(totalSyntheticGames)+' synthetic games.'
      :'CLIMB Coach Bench passed '+String(guardrails.length)+' production guardrails across '+String(totalSyntheticGames)+' synthetic games. Selection-eligible winner: '+winner+'. Raw score leader: '+scoreLeader+(scoreLeader===winner?'.':' (disqualified by hard safety/evidence gates).'),
    boundary:BOUNDARY,
  };
}

export const CLIMB_COACH_BENCH_BOUNDARY=BOUNDARY;
