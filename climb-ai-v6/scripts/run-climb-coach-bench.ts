import {runClimbCoachBench} from '../lib/climbCoachBench';

const requested=Number(process.argv[2]);
const gamesPerCareer=Number.isFinite(requested)&&requested>0?Math.floor(requested):120;
const report=runClimbCoachBench({gamesPerCareer});

console.log('\nCLIMB COACH BENCH');
console.log('=================');
console.log('Synthetic games:',report.totalSyntheticGames);
console.log('Seeds:',report.seeds.join(', '));
console.log('');
console.table(report.policies.map(policy=>({
  policy:policy.policyId,
  score:policy.metrics.score,
  eligible:policy.selectionEligible,
  disqualifiedBy:policy.disqualifications.join(', ')||'—',
  cleanRate:policy.metrics.cleanDecisionRate+'%',
  supportRate:policy.metrics.supportRate+'%',
  autonomyCareers:policy.metrics.autonomyCareerRate+'%',
  principleOwned:policy.metrics.principleOwnedRate+'%',
  difficultyChangesPer100:policy.metrics.difficultyChangesPer100,
  falsePromotions:policy.metrics.falsePromotionCount,
  falseRegressions:policy.metrics.falseRegressionCount,
  unsafeFades:policy.metrics.unsafeFadeCount,
  experiments:policy.metrics.experimentsScheduled,
  experimentCompletion:policy.metrics.experimentCompletionRate===null?'n/a':policy.metrics.experimentCompletionRate+'%',
})));
console.log('');
console.log('MULTI-SKILL CAREER MATRIX');
console.table(report.careerMatrix.results.map(item=>({case:item.id,category:item.category,expected:item.expected??'NONE',actual:item.actual??'NONE',pass:item.pass})));
console.log('Selection accuracy:',report.careerMatrix.selectionAccuracy+'%');
console.log('Root-cause accuracy:',report.careerMatrix.rootCauseAccuracy+'%');
console.log('Prerequisite discipline:',report.careerMatrix.prerequisiteDiscipline+'%');
console.log('Transfer discipline:',report.careerMatrix.transferDiscipline+'%');
console.log('Longitudinal careers:',report.careerMatrix.longitudinal.careers,'· games:',report.careerMatrix.longitudinal.totalGames);
console.log('Longitudinal exact selection:',report.careerMatrix.longitudinal.exactSelectionRate+'%');
console.log('Wrong switches / 100:',report.careerMatrix.longitudinal.wrongSwitchesPer100);
console.log('Deferred return:',report.careerMatrix.longitudinal.deferredReturnRate+'%');
console.log('');
console.log('AUTONOMOUS CURRICULUM V6');
console.table(report.autonomousCurriculum.results.map(item=>({case:item.id,expected:item.expected,actual:item.actual,pass:item.pass})));
console.log('Lifecycle accuracy:',report.autonomousCurriculum.lifecycleAccuracy+'%');
console.log('Contract continuity:',report.autonomousCurriculum.contractContinuity+'%');
console.log('Transfer discipline:',report.autonomousCurriculum.transferDiscipline+'%');
console.log('Interruption discipline:',report.autonomousCurriculum.interruptionDiscipline+'%');
console.log('');
console.table(report.guardrails.map(item=>({guardrail:item.key,pass:item.pass,detail:item.detail})));
console.log('\nSelection-eligible winner:',report.winner);
console.log('Raw score leader:',report.scoreLeader);
console.log('\n'+report.summary);
console.log(report.boundary);

if(report.invariantViolations.length){
  console.error('\nInvariant violations:');
  report.invariantViolations.slice(0,40).forEach(item=>console.error('-',item));
  process.exitCode=1;
}
if(report.guardrails.some(item=>!item.pass))process.exitCode=1;
