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
  assert.ok(companion.includes('DNA READY · 3/3'));
  assert.ok(companion.includes('REVEAL MY DNA ↗'));
  assert.ok(companion.includes("phase:'DNA_REVEAL'"));
});

test('active mission phase shows exactly two focus missions',()=>{
  assert.ok(companion.includes('TWO GAME MISSIONS'));
  assert.ok(companion.includes("'FOCUS '+focusOrder+' OF 2'"));
  assert.ok(companion.includes('Only these two missions can bank a proven rep'));
  assert.ok(companionApi.includes('priorityMission'));
  assert.ok(companionApi.includes('gameMissionFocusPair'));
  assert.ok(companionApi.includes('const missionLimit=2'));
});

test('player-facing postgame wording uses proven games instead of rep jargon',()=>{
  assert.ok(companion.includes('PROVEN GAME ✓'));
  assert.ok(companion.includes('proven games'));
  assert.equal(companion.includes('PROVEN REP BANKED ✓'),false);
  assert.equal(companion.includes('No personalised challenge yet'),false);
});
