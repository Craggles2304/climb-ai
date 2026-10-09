const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const ilp=fs.readFileSync(path.join(root,'app','ilp','page.tsx'),'utf8');
const impact=fs.readFileSync(path.join(root,'components','MyClimbGameImpact.tsx'),'utf8');
const dashboard=fs.readFileSync(path.join(root,'app','dashboard','page.tsx'),'utf8');
const liveCenter=fs.readFileSync(path.join(root,'components','LiveCommandCenter.tsx'),'utf8');
const css=fs.readFileSync(path.join(root,'app','visual-depth.css'),'utf8');

test('My DNA owns long-term development while Match Room owns the game',()=>{
  assert.ok(ilp.includes('currentGameDnaMissions'));
  assert.ok(ilp.includes('<DnaHelix'));
  assert.ok(ilp.includes('MY DNA · YOUR PLAYER IDENTITY'));
  assert.ok(ilp.includes('Game DNA is the centre of OP CLIMB.'));
  assert.ok(liveCenter.includes('MATCH ROOM · LAST GAME'));
  assert.ok(liveCenter.includes('WHAT HURT YOU'));
  assert.ok(liveCenter.includes('WHAT YOU DID WELL'));
  assert.ok(liveCenter.includes('KEY MOMENTS'));
  assert.ok(liveCenter.includes('NEXT GAME · TWO UNLOCKED DNA TREES'));
  assert.ok(liveCenter.includes('SEE MY DNA'));
});

test('My DNA explains development in readable language before technical proof',()=>{
  assert.ok(impact.includes('WHAT YOU DID'));
  assert.ok(impact.includes('WHY IT MATTERED'));
  assert.ok(impact.includes('HOW YOU PASS'));
  assert.ok(impact.includes('SHOW THE PROOF'));
  assert.ok(impact.includes('3 moments worth remembering.'));
  assert.ok(css.includes('.mc-explain'));
  assert.ok(css.includes('.mc-game-example')||css.includes('.mc-moment-list'));
});

// Arena V2.1 Home: player identity, then one next mission, then Game DNA, then evidence.
const missionPanel=fs.readFileSync(path.join(root,'components','dashboard','MissionPanel.tsx'),'utf8');
const dnaOverview=fs.readFileSync(path.join(root,'components','dashboard','GameDnaOverview.tsx'),'utf8');
const dashboardModel=fs.readFileSync(path.join(root,'lib','dashboard','model.ts'),'utf8');

test('Home leads with the player, then one next mission, then Game DNA',()=>{
  const order=['<PlayerHero','<MissionCard','<GameDnaOverview','<MatchHistory','<CoachingIntelligence'].map(tag=>dashboard.indexOf(tag));
  assert.ok(order.every(index=>index>0),'every Home section is rendered');
  assert.deepEqual([...order].sort((a,b)=>a-b),order,'sections keep the priority order');
  assert.ok(dashboard.includes('buildJourneyState'));
  assert.ok(missionPanel.includes('Your job next game'));
  assert.ok(dashboardModel.includes('plainLanguageFocus'));
});

test('Home mission progress and Game DNA only show verified evidence',()=>{
  assert.ok(dashboardModel.includes('verifiedMissionRep'));
  assert.ok(missionPanel.includes('Only tracked games with a verified receipt count. Entering a game is not proof.'));
  assert.ok(dnaOverview.includes('Your DNA is still neutral'));
  assert.ok(dnaOverview.includes('XP comes only from verified games'));
});

test('Home cannot regress into a feature directory',()=>{
  assert.ok(!dashboard.includes('YOUR RANKED SNAPSHOT'));
  assert.ok(!dashboard.includes('THE OP COACHING LOOP'));
  assert.ok(!dashboard.includes('Every game has a lesson.'));
  assert.ok(!dashboard.includes('<ClientGameDna'),'the canvas DNA client is not reintroduced on Home');
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
