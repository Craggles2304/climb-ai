const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const ilp=fs.readFileSync(path.join(root,'app','ilp','page.tsx'),'utf8');
const impact=fs.readFileSync(path.join(root,'components','MyClimbGameImpact.tsx'),'utf8');
const dashboard=fs.readFileSync(path.join(root,'app','dashboard','page.tsx'),'utf8');
const css=fs.readFileSync(path.join(root,'app','visual-depth.css'),'utf8');

test('My Climb makes the six DNA missions clear beside last-game evidence',()=>{
  assert.ok(ilp.includes('MyClimbGameImpact'));
  assert.ok(ilp.includes('currentGameDnaMissions'));
  assert.ok(ilp.includes('Six {viewRole} strands. One mission on each.'));
  assert.ok(impact.includes('DNA MISSION FROM THIS GAME'));
  assert.ok(impact.includes('WHAT CHANGED THIS GAME'));
  assert.ok(impact.includes('WHAT YOU DID WELL'));
  assert.ok(impact.includes('KEY MOMENTS'));
  assert.ok(css.includes('.mc-impact-grid{'));
  assert.ok(css.includes('.mc-mission{'));
});

test('My Climb explains the game in readable language before technical proof',()=>{
  assert.ok(impact.includes('WHAT YOU DID'));
  assert.ok(impact.includes('WHY IT MATTERED'));
  assert.ok(impact.includes('HOW YOU PASS'));
  assert.ok(impact.includes('SHOW THE PROOF'));
  assert.ok(impact.includes('3 moments worth remembering.'));
  assert.ok(css.includes('.mc-explain'));
  assert.ok(css.includes('.mc-game-example')||css.includes('.mc-moment-list'));
});

test('dashboard keeps one spotlight while the underlying plan contains all six DNA missions',()=>{
  assert.ok(dashboard.includes('currentGameDnaMissions(tasks,active.role)'));
  assert.ok(dashboard.includes('const activeMission=planMissions[0]??leadTask'));
  assert.ok(dashboard.includes('YOUR NEXT GAME PLAN'));
  assert.ok(dashboard.includes('plainLanguageFocus'));
  assert.ok(dashboard.includes('YOUR RANKED SNAPSHOT'));
});

test('dashboard hierarchy cannot regress to three equal-priority mission cards',()=>{
  assert.ok(!dashboard.includes('hq-game-missions'));
  assert.ok(dashboard.includes('activeMission=planMissions[0]??leadTask'));
  assert.ok(dashboard.includes('missionPlain=activeMission?plainLanguageFocus(activeMission):null'));
  assert.ok(css.includes('.mission'));
});

test('coach is a readable workspace rather than neon chat bubbles across the whole screen',()=>{
  const coach=fs.readFileSync(path.join(root,'app','coach','page.tsx'),'utf8');
  assert.ok(coach.includes('vf-coach-workspace'));
  assert.ok(coach.includes('vf-coach-context'));
  assert.ok(coach.includes('vf-coach-rail'));
  assert.ok(coach.includes('vf-coach-answer-copy'));
  assert.ok(css.includes('.vf-message.user'));
  assert.ok(css.includes('border-right:3px solid #b6f66b'));
  assert.ok(css.includes('.vf-message.ai'));
  assert.ok(css.includes('font-size:15px'));
  assert.ok(!coach.includes('collapseAt='));
});