const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const loader=fs.readFileSync('companion/electron/review-v2.js','utf8');
const focus=fs.readFileSync('companion/electron/remember-v14-focus-layout.js','utf8');

test('live focus layout loads after the deep coaching modules',()=>{
  assert.ok(loader.includes("load('remember-v14-focus-layout.js')"));
  assert.ok(loader.indexOf('remember-v14-focus-layout.js')>loader.indexOf('remember-v13-decision-principle-engine.js'));
});

test('live board keeps the win path while surfacing three measurable targets',()=>{
  for(const copy of ['YOUR 3 GAME TARGETS','FARM / RESOURCE MISSION','YOUR POWER SPIKE','OBJECTIVE MISSION','PERSONAL CLIMB MISSION']){
    assert.ok(focus.includes(copy),copy);
  }
  assert.ok(focus.includes("path.insertAdjacentElement('afterend',root)"));
  assert.ok(focus.includes("'2 COMPLETED ITEMS'"));
  assert.ok(focus.includes("'95 CS BY 15'"));
  assert.ok(focus.includes("'90+ CS BY 15'"));
  assert.ok(focus.includes("'LEAVE FARM 45S BEFORE'"));
});

test('deep coach systems are collapsed instead of forming a live wall of text',()=>{
  assert.ok(focus.includes('id=\'opDeepCoachDrawer\'')||focus.includes("drawer.id='opDeepCoachDrawer'"));
  for(const id of ['opMatchOs','opPlayerCoachingIdentity','opAdaptiveCoachingSession','opLearningVelocity','opSkillTransferGraph','opDecisionPrinciple']){
    assert.ok(focus.includes(id),id);
  }
  assert.ok(focus.includes('DEEP COACH · WHY / MEMORY / EVIDENCE / LEARNING'));
  assert.ok(focus.includes('DEEP COACH · WHY THIS FITS YOU'));
});
