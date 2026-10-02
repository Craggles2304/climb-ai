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

test('Game DNA is visibly role-specific across web and Companion',()=>{
  assert.ok(ilp.includes('Game DNA is role-specific.'));
  assert.ok(ilp.includes('Only games played in ${viewRole}'));
  assert.ok(coach.includes('{dnaRole} GAME DNA · PRO'));
  assert.ok(coach.includes('every other role builds its own separate DNA'));
  assert.ok(dnaClient.includes("roleLabel+' GAME DNA'"));
  assert.ok(companion.includes('playerDnaRoleTitle'));
  assert.ok(companion.includes('only ${roleLabel} games progress these six strands'));
  assert.ok(companion.includes("roleLabel+' · '+String(dna?.label"));
});