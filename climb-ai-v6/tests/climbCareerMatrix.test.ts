import test from 'node:test';
import assert from 'node:assert/strict';
import {rankCareerMatrixSignals,type CareerMatrixSignal} from '../lib/climbCareerMatrix';
import {runClimbCareerMatrixBench} from '../lib/climbCareerMatrixBench';

const impact:any={
  FIGHT_SELECTION:88,DEATH_RECOVERY:82,LEAD_PROTECTION:84,RESET_DISCIPLINE:80,OBJECTIVE_READINESS:86,
  FARM_VS_SETUP:78,THREAT_ADAPTATION:84,CARRY_PRESERVATION:90,POWER_SPIKE_CONVERSION:86,SURVIVAL_VALUE:88,
};
function signal(key:any,severity:number,recurrence:number,confidence:any,prioritySignal:number,extra:any={}):CareerMatrixSignal{
  return{
    key,label:String(key),currentScore:100-severity,severity,recurrence,impact:impact[key],prioritySignal,confidence,
    regressionRisk:0,locallyMastered:false,transferStrength:0,principleOwned:false,
    strictPrerequisite:null,prerequisiteSatisfied:true,evidence:'test',...extra,
  };
}

test('career matrix chooses upstream Threat Adaptation over more frequent or more severe downstream symptoms',()=>{
  const matrix=rankCareerMatrixSignals([
    signal('DEATH_RECOVERY',45,100,'HIGH',85),
    signal('THREAT_ADAPTATION',65,55,'HIGH',75),
    signal('FIGHT_SELECTION',72,80,'HIGH',92),
    signal('CARRY_PRESERVATION',66,65,'HIGH',88),
  ],{gamesAnalyzed:10});
  assert.equal(matrix.recommendedSkill,'THREAT_ADAPTATION');
  const threat=matrix.candidates.find(item=>item.key==='THREAT_ADAPTATION');
  assert.ok(threat);
  assert.ok((threat?.rootCauseLeverage??0)>=60);
  assert.match(threat?.whyNow||'',/upstream/i);
});

test('low-evidence recency spike stays dormant instead of stealing the coaching slot',()=>{
  const matrix=rankCareerMatrixSignals([
    signal('DEATH_RECOVERY',95,12,'LOW',100),
    signal('FIGHT_SELECTION',60,70,'HIGH',80),
  ],{gamesAnalyzed:10});
  assert.equal(matrix.recommendedSkill,'FIGHT_SELECTION');
  assert.equal(matrix.candidates.find(item=>item.key==='DEATH_RECOVERY')?.state,'DORMANT');
});

test('locked downstream skill cannot beat its unstable prerequisite',()=>{
  const matrix=rankCareerMatrixSignals([
    signal('OBJECTIVE_READINESS',90,80,'HIGH',100,{strictPrerequisite:'FARM_VS_SETUP',prerequisiteSatisfied:false}),
    signal('FARM_VS_SETUP',45,50,'MEDIUM',55),
  ],{gamesAnalyzed:10});
  assert.equal(matrix.recommendedSkill,'FARM_VS_SETUP');
  assert.equal(matrix.candidates.find(item=>item.key==='OBJECTIVE_READINESS')?.state,'LOCKED');
});

test('local mastery becomes a transfer test rather than a graduation',()=>{
  const matrix=rankCareerMatrixSignals([
    signal('CARRY_PRESERVATION',16,85,'HIGH',55,{locallyMastered:true,transferStrength:20}),
    signal('DEATH_RECOVERY',35,45,'MEDIUM',50),
  ],{gamesAnalyzed:10});
  assert.equal(matrix.recommendedSkill,'CARRY_PRESERVATION');
  assert.equal(matrix.candidates.find(item=>item.key==='CARRY_PRESERVATION')?.state,'TRANSFER_TEST');
});

test('curriculum debt rises only when a new game arrives and can recover a deferred skill',()=>{
  const signals=[
    signal('RESET_DISCIPLINE',40,70,'HIGH',60),
    signal('FIGHT_SELECTION',50,65,'HIGH',70),
    signal('POWER_SPIKE_CONVERSION',50,60,'HIGH',65),
  ];
  const first=rankCareerMatrixSignals(signals,{gamesAnalyzed:10});
  const reset=first.candidates.find(item=>item.key==='RESET_DISCIPLINE');
  assert.ok(reset);
  if(reset)reset.curriculumDebt=72;
  const sameGame=rankCareerMatrixSignals(signals,{gamesAnalyzed:10,previous:first});
  assert.equal(sameGame.candidates.find(item=>item.key==='RESET_DISCIPLINE')?.curriculumDebt,72);
  const nextGame=rankCareerMatrixSignals(signals,{gamesAnalyzed:11,previous:sameGame});
  assert.ok((nextGame.candidates.find(item=>item.key==='RESET_DISCIPLINE')?.curriculumDebt??0)>72);
  assert.equal(nextGame.recommendedSkill,'RESET_DISCIPLINE');
});

test('coaching restraint allows no active recommendation when evidence is only a one-off',()=>{
  const matrix=rankCareerMatrixSignals([
    signal('DEATH_RECOVERY',92,12,'LOW',95),
  ],{gamesAnalyzed:2});
  assert.equal(matrix.recommendedSkill,null);
  assert.equal(matrix.candidates[0]?.state,'DORMANT');
});

test('multi-skill gold-standard Coach Bench cases all pass',()=>{
  const report=runClimbCareerMatrixBench();
  assert.equal(report.cases,7);
  assert.equal(report.selectionAccuracy,100);
  assert.equal(report.rootCauseAccuracy,100);
  assert.equal(report.prerequisiteDiscipline,100);
  assert.equal(report.stabilityAccuracy,100);
  assert.equal(report.transferDiscipline,100);
  assert.equal(report.deferredRecovery,100);
  assert.equal(report.coachingRestraint,100);
  assert.equal(report.longitudinal.careers,25);
  assert.equal(report.longitudinal.totalGames,1200);
  assert.ok(report.longitudinal.exactSelectionRate>=94,`Longitudinal selection rate ${report.longitudinal.exactSelectionRate}%`);
  assert.ok(report.longitudinal.wrongSwitchesPer100<=1,`Wrong switches ${report.longitudinal.wrongSwitchesPer100}/100 games`);
  assert.equal(report.longitudinal.lowConfidenceSteals,0);
  assert.equal(report.longitudinal.prerequisiteViolations,0);
  assert.equal(report.longitudinal.completedCareers,25);
  assert.equal(report.longitudinal.deferredReturnRate,100);
  assert.deepEqual(report.failures,[]);
});
