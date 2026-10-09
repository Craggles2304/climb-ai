const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const read=file=>fs.readFileSync(file,'utf8');
const shell=read('components/AppShell.tsx');
const dashboard=read('app/dashboard/page.tsx');
const live=read('components/LiveCommandCenter.tsx');
const coach=read('app/coach/page.tsx');
const review=read('app/analyse/[match]/page.tsx');
const ilp=read('app/ilp/page.tsx');
const companion=read('companion/electron/renderer.js');
const companionHome=read('companion/electron/home-view.js');
const companionUi=read('companion/electron/oc-ui.js');
const companionApi=read('app/api/live/companion-home/route.ts');

test('core website pages share one explicit journey status',()=>{
  assert.ok(shell.includes('op-journey-status'));
  assert.ok(shell.includes('buildJourneyState'));
  assert.ok(dashboard.includes('buildJourneyState'));
  assert.ok(shell.includes('REVEAL MY DNA'));
  assert.ok(shell.includes('PROVISIONAL COACHING ONLY'));
});

test('baseline language never pretends provisional coaching is a permanent mission',()=>{
  assert.ok(live.includes('PROVISIONAL COACHING'));
  assert.ok(live.includes('PERMANENT MISSIONS UNLOCK'));
  assert.ok(review.includes('NOT A PERMANENT DNA MISSION YET'));
  assert.ok(review.includes('PROVISIONAL COACHING'));
  assert.ok(coach.includes('coaching is provisional until game 3'));
  assert.equal(live.includes('personalised challenge'),false);
  assert.equal(coach.includes('personalised challenge'),false);
});

test('DNA reveal is a mandatory visible step before active mission coaching',()=>{
  assert.ok(ilp.includes('Checking your DNA journey'));
  assert.ok(shell.includes('Your Game DNA is ready.'));
  // Companion: baseline -> reveal -> active, with the reveal as its own step.
  assert.ok(companionUi.includes("return{stage:revealed?'active':'reveal'"));
  assert.ok(companionHome.includes('Your ${esc(role)} Game DNA is ready'));
  assert.ok(companionHome.includes('Reveal my Game DNA'));
  assert.ok(companionHome.includes("stage.stage==='reveal')return{label:'Reveal your Game DNA'"));
});

test('active mission phase shows exactly two player-unlocked DNA missions',()=>{
  assert.ok(companionHome.includes('Your two unlocked trees'));
  assert.ok(companionHome.includes('Unlocked tree ${num(mission.focusOrder,index+1)} of 2'));
  assert.ok(companionHome.includes('Only the two DNA trees you unlocked can bank a proven rep'));
  assert.ok(companionApi.includes('priorityMission'));
  assert.ok(companionApi.includes('gameMissionFocusPair'));
  assert.ok(companionApi.includes('const missionLimit=2'));
});

test('player-facing postgame wording uses proven games instead of rep jargon',()=>{
  const review=read('companion/electron/review-view.js');
  assert.ok(review.includes('Proven this game'));
  assert.ok(review.includes('Proven games'));
  assert.ok(companionHome.includes('proven games'));
  for(const source of [review,companionHome,companion]){
    assert.equal(source.includes('PROVEN REP BANKED'),false);
    assert.equal(source.includes('No personalised challenge yet'),false);
  }
});
