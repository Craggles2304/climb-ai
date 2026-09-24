const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const loader=fs.readFileSync(path.join(root,'companion','electron','review-v2.js'),'utf8');
const remember=fs.readFileSync(path.join(root,'companion','electron','remember-v5-esports.js'),'utf8');
const identityUi=fs.readFileSync(path.join(root,'companion','electron','remember-v9-player-coaching-identity.js'),'utf8');
const reviewUi=fs.readFileSync(path.join(root,'companion','electron','review-v6-player-coaching-identity.js'),'utf8');
const draft=fs.readFileSync(path.join(root,'app','api','live','draft-coach','route.ts'),'utf8');
const reviewRoute=fs.readFileSync(path.join(root,'app','api','live','companion-review','route.ts'),'utf8');
const repo=fs.readFileSync(path.join(root,'lib','server','proLearningRepository.ts'),'utf8');
const decisionTwin=fs.readFileSync(path.join(root,'app','api','decision-twin','route.ts'),'utf8');
const authority=fs.readFileSync(path.join(root,'lib','server','coachAuthority.ts'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'companion','package.json'),'utf8'));

test('Stage 13 persists one unified coaching identity after learning-profile rebuild',()=>{
  assert.ok(repo.includes('buildPlayerCoachingIdentity'));
  assert.ok(repo.includes('playerCoachingIdentity'));
  assert.ok(repo.includes('getPlayerCoachingIdentity'));
  assert.ok(decisionTwin.includes('playerCoachingIdentity'));
});

test('Draft Coach consumes the Coach Brief and freezes the identity into pregame context',()=>{
  assert.ok(draft.includes('PLAYER COACHING IDENTITY: '));
  assert.ok(draft.includes('COACHING IDENTITY USE RULE:'));
  assert.ok(draft.includes('playerCoachingIdentity:input.playerCoachingIdentity'));
  assert.ok(draft.includes('playerCoachingIdentity:proModel?coachingContext.playerCoachingIdentity:null'));
  assert.ok(remember.includes('_playerCoachingIdentity=response?.playerCoachingIdentity||null'));
  assert.ok(remember.includes('playerCoachingIdentity:coach?._playerCoachingIdentity||null'));
});

test('pre-game Companion shows development, root cause, coaching format, support need and first coach question',()=>{
  assert.ok(identityUi.includes('PLAYER MODEL · COACHING IDENTITY'));
  assert.ok(identityUi.includes('NEXT DEVELOPMENT'));
  assert.ok(identityUi.includes('ROOT CAUSE'));
  assert.ok(identityUi.includes('COACHING FORMAT'));
  assert.ok(identityUi.includes('SUPPORT NEED'));
  assert.ok(identityUi.includes('COACH BRIEF · ASK THIS FIRST'));
});

test('post-game Companion receives the refreshed identity and shows whether the model changed',()=>{
  assert.ok(reviewRoute.includes('playerCoachingIdentity:latest.playerCoachingIdentity??null'));
  assert.ok(reviewUi.includes('PLAYER MODEL · UPDATED AFTER THIS GAME'));
  assert.ok(reviewUi.includes('MODEL CHANGE'));
  assert.ok(reviewUi.includes('NEXT-GAME COACH BRIEF'));
  assert.ok(reviewUi.includes("model.change?.status"));
});

test('web coach authority exposes the same player coaching identity',()=>{
  assert.ok(authority.includes('playerCoachingIdentity:'));
  assert.ok(authority.includes('const recent=roleRecent??globalRecent'));
});

test('Stage 13 UI layers load after causal coaching layers and require Companion 0.7.41+',()=>{
  assert.ok(loader.includes("load('review-v6-player-coaching-identity.js')"));
  assert.ok(loader.includes("load('remember-v9-player-coaching-identity.js')"));
  assert.ok(loader.indexOf('review-v6-player-coaching-identity.js')>loader.indexOf('review-v5-causal-coach-router.js'));
  assert.ok(loader.indexOf('remember-v9-player-coaching-identity.js')>loader.indexOf('remember-v8-causal-coach-router.js'));
  const [major,minor,patch]=pkg.version.split('.').map(Number);
  assert.ok(major>0||minor>7||(minor===7&&patch>=41));
});
