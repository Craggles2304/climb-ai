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
console.table(report.guardrails.map(item=>({guardrail:item.key,pass:item.pass,detail:item.detail})));
console.log('\n'+report.summary);
console.log(report.boundary);

if(report.invariantViolations.length){
  console.error('\nInvariant violations:');
  report.invariantViolations.slice(0,40).forEach(item=>console.error('-',item));
  process.exitCode=1;
}
if(report.guardrails.some(item=>!item.pass))process.exitCode=1;
