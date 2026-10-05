const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

const ilp=fs.readFileSync(path.join(root,'app','ilp','page.tsx'),'utf8');
const legacyMissions=fs.readFileSync(path.join(root,'app','missions','page.tsx'),'utf8');
const companion=fs.readFileSync(path.join(root,'companion','electron','renderer.js'),'utf8');
const api=fs.readFileSync(path.join(root,'app','api','live','companion-home','route.ts'),'utf8');
const coach=fs.readFileSync(path.join(root,'app','coach','page.tsx'),'utf8');
const gameDna=fs.readFileSync(path.join(root,'app','game-dna','page.tsx'),'utf8');
const appShell=fs.readFileSync(path.join(root,'components','AppShell.tsx'),'utf8');
const dnaClient=fs.readFileSync(path.join(root,'public','client','dna.js'),'utf8');

test('My DNA shows one tracked mission for each DNA strand',()=>{
  assert.ok(ilp.includes('Six {viewRole} strands. One mission on each.'));
  assert.ok(ilp.includes('currentGameDnaMissions'));
  assert.ok(ilp.includes('6 active'));
  assert.ok(ilp.includes('games completed'));
  assert.ok(!ilp.includes('WATCHLIST · NOT EXTRA MISSIONS'));
  assert.ok(!ilp.includes('CORE MISSION · THE ONLY SCORED FOCUS'));
});

test('legacy Mission Lab stays redirected into My DNA',()=>{
  assert.ok(legacyMissions.includes("redirect('/ilp')"));
  assert.ok(!legacyMissions.includes('Mission Lab'));
});

test('Companion shows one priority mission plus five background-tracked DNA missions',()=>{
  assert.ok(companion.includes('PRIORITY MISSION'));
  assert.ok(companion.includes('BACKGROUND · TRACKED AUTOMATICALLY'));
  assert.ok(companion.includes('FOCUS THIS NEXT GAME'));
  assert.ok(companion.includes('No permanent DNA missions until baseline 3/3.'));
  assert.ok(companion.includes('PROVISIONAL COACHING'));
  assert.ok(!companion.includes('WATCH FOCUS'));
  assert.ok(!companion.includes('CORE MISSION'));
  assert.ok(api.includes('const missionLimit=6'));
  assert.ok(api.includes('priorityMission'));
});

test('Game DNA stays role-specific in My DNA and Companion',()=>{
  assert.ok(ilp.includes('Game DNA is role-specific.'));
  assert.ok(ilp.includes('Only games played in ${viewRole}'));
  assert.ok(dnaClient.includes("roleLabel+' GAME DNA'"));
  assert.ok(companion.includes('playerDnaRoleTitle'));
  assert.ok(companion.includes('only ${roleLabel} games progress these six strands'));
  assert.ok(companion.includes("String(dna?.label||mission.domain||'DNA')"));
});

test('Coach is conversation-first and hands development back to My DNA',()=>{
  assert.ok(coach.includes("useState<CoachTab>('ASK')"));
  assert.ok(coach.includes('COACH · DIAGNOSE AND DECIDE'));
  assert.ok(coach.includes('OPEN MY DNA'));
  assert.ok(coach.includes('YOUR DEVELOPMENT LIVES IN MY DNA'));
  assert.ok(coach.includes('Your interactive player identity'));
  assert.ok(coach.includes('href="/ilp"'));
  assert.ok(!coach.includes("tab==='DNA'"));
  assert.ok(!coach.includes('<ClientGameDna'));
});

test('My DNA is the single first-class DNA destination',()=>{
  assert.ok(gameDna.includes("redirect(role?'/ilp?role='"));
  assert.ok(ilp.includes('<ClientGameDna'));
  assert.ok(ilp.includes('MY DNA · YOUR PLAYER IDENTITY'));
  assert.ok(ilp.includes('gameDnaClientMissions'));
  assert.ok(appShell.includes("['My DNA','/ilp'"));
  assert.equal(appShell.includes("['Game DNA','/game-dna'"),false);
  assert.ok(coach.includes('href="/ilp"'));
});
