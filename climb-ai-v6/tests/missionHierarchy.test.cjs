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

test('My Climb shows one tracked mission for each DNA strand',()=>{
  assert.ok(ilp.includes('Six {viewRole} strands. One mission on each.'));
  assert.ok(ilp.includes('currentGameDnaMissions'));
  assert.ok(ilp.includes('6 active'));
  assert.ok(ilp.includes('games completed'));
  assert.ok(!ilp.includes('WATCHLIST · NOT EXTRA MISSIONS'));
  assert.ok(!ilp.includes('CORE MISSION · THE ONLY SCORED FOCUS'));
});

test('legacy Mission Lab stays redirected into My Climb',()=>{
  assert.ok(legacyMissions.includes("redirect('/ilp')"));
  assert.ok(!legacyMissions.includes('Mission Lab'));
});

test('Companion shows all six DNA missions with game trackers',()=>{
  assert.ok(companion.includes("+' MISSION').toUpperCase()"));
  assert.ok(companion.includes('3/3 moves this strand to its next mission.'));
  assert.ok(companion.includes('Only ${roleLabel} games progress these six strands.'));
  assert.ok(!companion.includes('WATCH FOCUS'));
  assert.ok(!companion.includes('CORE MISSION'));
  assert.ok(api.includes('const missionLimit=6'));
});

test('Game DNA stays role-specific in My Climb and Companion',()=>{
  assert.ok(ilp.includes('Game DNA is role-specific.'));
  assert.ok(ilp.includes('Only games played in ${viewRole}'));
  assert.ok(dnaClient.includes("roleLabel+' GAME DNA'"));
  assert.ok(companion.includes('playerDnaRoleTitle'));
  assert.ok(companion.includes('only ${roleLabel} games progress these six strands'));
  assert.ok(companion.includes("roleLabel+' · '+String(dna?.label"));
});

test('Coach is conversation-first and keeps progression out of the conversation view',()=>{
  assert.ok(coach.includes("useState<CoachTab>('ASK')"));
  assert.ok(coach.includes('COACH · DIAGNOSE AND DECIDE'));
  assert.ok(coach.includes('OPEN GAME DNA'));
  assert.ok(coach.includes('YOUR PLAN LIVES IN MY CLIMB'));
  assert.ok(coach.includes('Your interactive player identity'));
  assert.ok(!coach.includes("tab==='DNA'"));
  assert.ok(!coach.includes('<ClientGameDna'));
});

test('interactive Game DNA is a first-class product page',()=>{
  assert.ok(gameDna.includes('<ClientGameDna'));
  assert.ok(gameDna.includes('GAME DNA · YOUR PLAYER IDENTITY'));
  assert.ok(gameDna.includes('<DnaRoleSwitcher'));
  assert.ok(gameDna.includes('gameDnaClientMissions'));
  assert.ok(appShell.includes("['Game DNA','/game-dna'"));
  assert.ok(coach.includes('href="/game-dna"'));
});

