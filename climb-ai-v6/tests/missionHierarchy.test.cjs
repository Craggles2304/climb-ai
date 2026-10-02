const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

const ilp=fs.readFileSync(path.join(root,'app','ilp','page.tsx'),'utf8');
const legacyMissions=fs.readFileSync(path.join(root,'app','missions','page.tsx'),'utf8');
const companion=fs.readFileSync(path.join(root,'companion','electron','renderer.js'),'utf8');

test('My Climb has one scored mission and background watch focuses',()=>{
  assert.ok(ilp.includes('CORE MISSION · THE ONLY SCORED FOCUS'));
  assert.ok(ilp.includes('WATCHLIST · NOT EXTRA MISSIONS'));
  assert.ok(ilp.includes('displayCoreTask'));
  assert.ok(ilp.includes('displayWatchTasks'));
  assert.ok(ilp.includes('AnimatedBar value={repProgress}'));
  assert.ok(!ilp.includes('SIDE MISSIONS'));
  assert.ok(!ilp.includes('SUPPORT 0'));
});

test('legacy Mission Lab no longer creates a second mission workspace',()=>{
  assert.ok(legacyMissions.includes("redirect('/ilp')"));
  assert.ok(!legacyMissions.includes('Mission Lab'));
});

test('Companion distinguishes the core mission from watch focuses',()=>{
  assert.ok(companion.includes("isCore?'CORE MISSION':'WATCH FOCUS'"));
  assert.ok(companion.includes('No extra rep tracker.'));
  assert.ok(companion.includes('CURRENT PLAN'));
  assert.ok(!companion.includes('SUPPORT MISSION'));
  assert.ok(!companion.includes('2 MORE ACTIVE MISSIONS'));
});
