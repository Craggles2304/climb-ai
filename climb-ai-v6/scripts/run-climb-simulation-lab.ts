import {runClimbSimulationLab} from '../lib/climbSimulationLab';

const requested=Number(process.argv[2]);
const gamesPerCareer=Number.isFinite(requested)&&requested>0?Math.floor(requested):120;
const report=runClimbSimulationLab({gamesPerCareer});

console.log('\nCLIMB SIMULATION LAB');
console.log('====================');
console.log(report.summary);
console.log('');
for(const career of report.careers){
  console.log([
    career.archetype.padEnd(18),
    ('games '+career.games).padEnd(11),
    ('max L'+career.maxLevel).padEnd(8),
    ('final '+(career.finalLevel===null?'—':'L'+career.finalLevel)).padEnd(10),
    ('promote '+career.promotions).padEnd(11),
    ('demote '+career.demotions).padEnd(10),
    ('not-observed '+career.notObserved).padEnd(16),
    ('memory '+(career.finalMemoryState??'—')).padEnd(22),
    'transfer '+(career.finalTransferState??'—'),
  ].join(' | '));
}
console.log('');
console.log('Total promotions:',report.totalPromotions);
console.log('Total demotions:',report.totalDemotions);
console.log('Total NOT_OBSERVED:',report.totalNotObserved);
if(report.invariantViolations.length){
  console.error('\nINVARIANT VIOLATIONS');
  for(const violation of report.invariantViolations.slice(0,50))console.error('-',violation);
  process.exitCode=1;
}
