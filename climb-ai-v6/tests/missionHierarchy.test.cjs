const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

const ilp=fs.readFileSync(path.join(root,'app','ilp','page.tsx'),'utf8');
const missionsPage=fs.readFileSync(path.join(root,'app','missions','page.tsx'),'utf8');
const companion=fs.readFileSync(path.join(root,'companion','electron','home-view.js'),'utf8');
const api=fs.readFileSync(path.join(root,'app','api','live','companion-home','route.ts'),'utf8');
const coach=fs.readFileSync(path.join(root,'app','coach','page.tsx'),'utf8');
const gameDna=fs.readFileSync(path.join(root,'app','game-dna','page.tsx'),'utf8');
const appShell=fs.readFileSync(path.join(root,'components','AppShell.tsx'),'utf8');
const dnaClient=fs.readFileSync(path.join(root,'public','client','dna.js'),'utf8');

test('My DNA keeps six equal strands and marks the two player-unlocked trees',()=>{
  assert.ok(ilp.includes('YOUR 6 DNA STRANDS · PLAYER PLAN'));
  assert.ok(ilp.includes('One primary Climb. Two live missions. Six strands developing.'));
  assert.ok(ilp.includes('gameMissionFocusPair'));
  assert.ok(ilp.includes('YOUR JOB NEXT GAME'));
  assert.ok(ilp.includes('HOW YOU PROVE IT'));
  assert.ok(ilp.includes('games completed'));
  assert.ok(!ilp.includes('WATCHLIST · NOT EXTRA MISSIONS'));
  assert.ok(!ilp.includes('CORE MISSION · THE ONLY SCORED FOCUS'));
});

test('Missions page keeps six equal trees and lets the player unlock exactly two',()=>{
  assert.ok(missionsPage.includes('currentGameDnaMissions'));
  assert.ok(missionsPage.includes('setDnaFocusDomains'));
  assert.ok(missionsPage.includes('missions-six-grid'));
  assert.ok(missionsPage.includes('Choose your two DNA trees'));
  assert.ok(missionsPage.includes('UNLOCK THIS TREE'));
  assert.ok(missionsPage.includes('replaceActiveTree'));
  assert.ok(missionsPage.includes('Which one should this replace?'));
  assert.ok(missionsPage.includes('Changes save instantly'));
  assert.ok(missionsPage.includes('missionComparisonForMatch(task,latestMatch?.id)'));
  assert.ok(missionsPage.includes('comparison.events'));
  assert.ok(appShell.includes("['Missions','/missions'"));
});

test('Companion shows the two player-unlocked DNA missions for the next game',()=>{
  assert.ok(companion.includes('Your two unlocked trees'));
  assert.ok(companion.includes('Unlocked tree ${num(mission.focusOrder,index+1)} of 2'));
  assert.ok(companion.includes('missionsOf=home=>(Array.isArray(home?.missions)?home.missions:[]).slice(0,2)'));
  assert.ok(companion.includes('Only the two DNA trees you unlocked can bank a proven rep'));
  assert.ok(companion.includes('No permanent DNA missions until baseline 3/3.'));
  assert.ok(companion.includes('Provisional coaching'));
  assert.ok(api.includes('const missionLimit=2'));
  assert.ok(api.includes('gameMissionFocusPair'));
  assert.ok(api.includes('priorityMission'));
});

test('Game DNA stays role-specific in My DNA and Companion',()=>{
  assert.ok(ilp.includes('Every tracked {viewRole} game updates the evidence behind these six strands'));
  assert.ok(ilp.includes('accountMatches.filter(match=>canonicalLeagueRole(match.role)===viewRole)'));
  assert.ok(dnaClient.includes("roleLabel+' GAME DNA'"));
  assert.ok(companion.includes('Game DNA</span>'));
  assert.ok(companion.includes('Only ${esc(role)} games progress these six strands'));
  assert.ok(companion.includes("esc(strand?.label||titleCase(domain.replace('_',' '))||'DNA')"));
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
