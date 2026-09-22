import test from 'node:test';
import assert from 'node:assert/strict';
import {runClimbSimulationLab} from '../lib/climbSimulationLab';

test('CLIMB Simulation Lab runs 540 full synthetic career games without breaking learning invariants',()=>{
  const report=runClimbSimulationLab({gamesPerCareer:90,seed:23042026});
  assert.equal(report.totalGames,540);
  assert.equal(report.careers.length,6);
  assert.deepEqual(report.invariantViolations,[],report.invariantViolations.slice(0,12).join('\n'));

  const byId=Object.fromEntries(report.careers.map(career=>[career.archetype,career]));
  console.log(report.careers.map(career=>({
    archetype:career.archetype,
    maxLevel:career.maxLevel,
    finalLevel:career.finalLevel,
    promotions:career.promotions,
    demotions:career.demotions,
    notObserved:career.notObserved,
    memory:career.finalMemoryState,
    transfer:career.finalTransferState,
    principleOwned:career.principleOwned,
    finalSkill:career.finalSkill,
  })));
  assert.equal(byId.FAST_LEARNER.maxLevel,5,'Fast learner should reach the hardest transfer rep.');
  assert.ok(byId.STEADY_LEARNER.maxLevel>=4,'Steady learner should reach adaptive/transfer testing.');
  assert.ok(byId.STUBBORN_REPEATER.maxLevel<=3,'Stubborn repeater should not be promoted into transfer without evidence.');
  assert.equal(byId.CONTEXT_MEMORIZER.principleOwned,false,'Context memorizer should not be called principle-owned.');
  assert.ok(byId.REGRESSION_CASE.demotions>=1,'Regression case should trigger at least one deliberate difficulty reduction.');
  assert.ok(byId.SPARSE_EVIDENCE.notObserved>=20,'Sparse evidence career should contain substantial neutral NOT_OBSERVED games.');
});

test('Rep Ladder does not thrash difficulty across synthetic careers',()=>{
  const seeds=[101,202,303,404,505];
  for(const seed of seeds){
    const report=runClimbSimulationLab({gamesPerCareer:120,seed});
    assert.deepEqual(report.invariantViolations,[],report.invariantViolations.slice(0,12).join('\n'));
    for(const career of report.careers){
      const changes=career.promotions+career.demotions;
      assert.ok(
        changes<=12,
        career.archetype+' thrashed difficulty '+String(changes)+' times across 120 games at seed '+String(seed)+' · transitions '+JSON.stringify(
          career.events
            .filter(event=>event.repLevel!==null&&event.postRepLevel!==null&&event.repLevel!==event.postRepLevel)
            .map(event=>({game:event.game,from:event.repLevel,to:event.postRepLevel,outcome:event.outcome,phase:event.curriculumPhase,postPhase:event.postCurriculumPhase,transfer:event.transferState}))
        ),
      );
    }
  }
});

test('Simulation Lab keeps frozen pre-game missions aligned with post-game Decision Graph review',()=>{
  const report=runClimbSimulationLab({gamesPerCareer:45,seed:88});
  for(const career of report.careers){
    assert.equal(career.invariants.length,0,career.invariants.join('\n'));
    const frozen=career.events.filter(event=>event.missionStatus==='READY');
    assert.ok(frozen.length>0,career.archetype+' should eventually receive at least one frozen match mission.');
    assert.ok(frozen.some(event=>event.missionReview==='EXECUTED'||event.missionReview==='MISSED'||event.missionReview==='NOT_OBSERVED'));
  }
});

test('Coaching Strategy changes support mode across synthetic careers without breaking frozen evidence',()=>{
  const report=runClimbSimulationLab({gamesPerCareer:90,seed:23042026});
  assert.deepEqual(report.invariantViolations,[],report.invariantViolations.slice(0,12).join('\n'));

  const events=report.careers.flatMap(career=>career.events).filter(event=>event.missionStatus==='READY');
  const modes=new Set(events.map(event=>event.strategyMode).filter(Boolean));
  assert.ok(modes.has('TEACH'),'Synthetic careers should include explicit teaching.');
  assert.ok(modes.has('REINFORCE'),'Synthetic careers should include light reinforcement.');
  assert.ok(modes.has('FADE'),'At least one learner should earn a faded-support autonomy test.');
  assert.ok(modes.has('DIAGNOSE'),'At least one repeated-miss/retest career should trigger diagnosis.');

  const faded=events.filter(event=>event.strategyMode==='FADE');
  assert.ok(faded.length>0);
  assert.ok(faded.every(event=>event.strategyIntervened===false),'FADE must never keep the adaptive Coach Twin overlay active.');
  assert.ok(faded.every(event=>event.coachMethod===null),'FADE must preserve the mission while removing Coach Twin delivery.');

  for(const event of events){
    if(event.missionReview==='NOT_OBSERVED')assert.equal(event.strategyReview,'NOT_OBSERVED');
  }
});

test('Intent Gap keeps knowledge and execution as separate signals across synthetic careers',()=>{
  const report=runClimbSimulationLab({gamesPerCareer:90,seed:23042026});
  assert.deepEqual(report.invariantViolations,[],report.invariantViolations.slice(0,12).join('\n'));
  const events=report.careers.flatMap(career=>career.events).filter(event=>event.missionStatus==='READY');

  const knowledge=events.filter(event=>event.intentDiagnosis==='KNOWLEDGE_GAP');
  const execution=events.filter(event=>event.intentDiagnosis==='EXECUTION_GAP');
  const aligned=events.filter(event=>event.intentDiagnosis==='ALIGNED');
  assert.ok(knowledge.length>0,'Synthetic careers should produce genuine pre-cue knowledge gaps.');
  assert.ok(execution.length>0,'Synthetic careers should produce correct-intent execution gaps.');
  assert.ok(aligned.length>0,'Synthetic careers should also produce aligned intent + execution.');

  for(const event of events){
    if(event.missionReview==='MISSED'&&event.intentCorrect===true)assert.equal(event.intentDiagnosis,'EXECUTION_GAP');
    if(event.missionReview==='MISSED'&&event.intentCorrect===false)assert.equal(event.intentDiagnosis,'KNOWLEDGE_GAP');
    if(event.missionReview==='NOT_OBSERVED')assert.equal(event.intentDiagnosis,'NO_EVIDENCE');
  }
});

