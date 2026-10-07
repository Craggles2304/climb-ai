const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

const ilp=fs.readFileSync(path.join(root,'app','ilp','page.tsx'),'utf8');
const missionsPage=fs.readFileSync(path.join(root,'app','missions','page.tsx'),'utf8');
const companion=fs.readFileSync(path.join(root,'companion','electron','renderer.js'),'utf8');
const api=fs.readFileSync(path.join(root,'app','api','live','companion-home','route.ts'),'utf8');
const coach=fs.readFileSync(path.join(root,'app','coach','page.tsx'),'utf8');
const gameDna=fs.readFileSync(path.join(root,'app','game-dna','page.tsx'),'utf8');
const appShell=fs.readFileSync(path.join(root,'components','AppShell.tsx'),'utf8');
const dnaClient=fs.readFileSync(path.join(root,'public','client','dna.js'),'utf8');

test('My DNA keeps six strands but marks exactly two missions as scored this game',()=>{
  assert.ok(ilp.includes('YOUR 6 DNA STRANDS · 2 GAME MISSIONS'));
  assert.ok(ilp.includes('Two jobs per game. Six strands over time.'));
  assert.ok(ilp.includes('gameMissionFocusPair'));
  assert.ok(ilp.includes('YOUR JOB NEXT GAME'));
  assert.ok(ilp.includes('HOW YOU PROVE IT'));
  assert.ok(ilp.includes('games completed'));
  assert.ok(!ilp.includes('WATCHLIST · NOT EXTRA MISSIONS'));
  assert.ok(!ilp.includes('CORE MISSION · THE ONLY SCORED FOCUS'));
});

test('Missions page selects two scored missions while keeping six DNA strands available',()=>{
  assert.ok(missionsPage.includes('currentGameDnaMissions'));
  assert.ok(missionsPage.includes('gameMissionFocusPair'));
  assert.ok(missionsPage.includes('FOCUS {index+1} OF 2'));
  assert.ok(missionsPage.includes('OTHER 4 DNA STRANDS'));
  assert.ok(missionsPage.includes('missionComparisonForMatch(task,latestMatch?.id)'));
  assert.ok(missionsPage.includes('comparison.events'));
  assert.ok(appShell.includes("['Missions','/missions'"));
});

test('Companion shows exactly two scored missions for the next game',()=>{
  assert.ok(companion.includes('TWO GAME MISSIONS'));
  assert.ok(companion.includes('FOCUS '+"'"+'+focusOrder+'+"'"+' OF 2'));
  assert.ok(companion.includes('Only these two missions can bank a proven rep'));
  assert.ok(companion.includes('No permanent DNA missions until baseline 3/3.'));
  assert.ok(companion.includes('PROVISIONAL COACHING'));
  assert.ok(api.includes('const missionLimit=2'));
  assert.ok(api.includes('gameMissionFocusPair'));
  assert.ok(api.includes('priorityMission'));
});

test('Game DNA stays role-specific in My DNA and Companion',()=>{
  assert.ok(ilp.includes('Every tracked {viewRole} game updates the evidence behind these six strands'));
  assert.ok(ilp.includes('accountMatches.filter(match=>canonicalLeagueRole(match.role)===viewRole)'));
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
