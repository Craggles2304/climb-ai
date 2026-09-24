const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const loader=fs.readFileSync(path.join(root,'companion','electron','review-v2.js'),'utf8');
const remember=fs.readFileSync(path.join(root,'companion','electron','remember-v5-esports.js'),'utf8');
const pre=fs.readFileSync(path.join(root,'companion','electron','remember-v10-adaptive-coaching-session.js'),'utf8');
const post=fs.readFileSync(path.join(root,'companion','electron','review-v7-adaptive-coaching-session.js'),'utf8');
const draft=fs.readFileSync(path.join(root,'app','api','live','draft-coach','route.ts'),'utf8');
const review=fs.readFileSync(path.join(root,'app','api','live','companion-review','route.ts'),'utf8');
const repo=fs.readFileSync(path.join(root,'lib','server','proLearningRepository.ts'),'utf8');
const authority=fs.readFileSync(path.join(root,'lib','server','coachAuthority.ts'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'companion','package.json'),'utf8'));

test('Stage 14 persists one adaptive session beside the Player Coaching Identity',()=>{
  assert.ok(repo.includes('buildAdaptiveCoachingSession'));
  assert.ok(repo.includes('adaptiveCoachingSession'));
  assert.ok(repo.includes('getAdaptiveCoachingSession'));
});

test('draft coaching is routed through the current session phase before the causal router',()=>{
  const apply=draft.indexOf('applyAdaptiveCoachingSession');
  const causal=draft.indexOf('buildCausalCoachRoute({profile:coachingContext.causalProfile,strategy:coachingStrategy');
  assert.ok(apply>=0);
  assert.ok(causal>apply);
  assert.ok(draft.includes('ADAPTIVE COACHING SESSION: '));
  assert.ok(draft.includes('SESSION USE RULE:'));
});

test('Companion freezes and restores the session with the locked pregame coach',()=>{
  assert.ok(draft.includes('adaptiveCoachingSession:input.adaptiveCoachingSession'));
  assert.ok(draft.includes('adaptiveCoachingSession:proModel?coachingContext.adaptiveCoachingSession:null'));
  assert.ok(remember.includes('_adaptiveCoachingSession=response?.adaptiveCoachingSession||null'));
  assert.ok(remember.includes('adaptiveCoachingSession:coach?._adaptiveCoachingSession||null'));
});

test('pregame UI shows all five phases and the active next-game brief',()=>{
  assert.ok(pre.includes('ADAPTIVE COACHING SESSION'));
  assert.ok(pre.includes('STEP '));
  assert.ok(pre.includes('NEXT GAME'));
  assert.ok(pre.includes('blockPlan'));
  assert.ok(pre.includes('currentStepNumber'));
});

test('post-game UI surfaces session event and replan explanation',()=>{
  assert.ok(review.includes('adaptiveCoachingSession:latest.adaptiveCoachingSession??null'));
  assert.ok(post.includes('ADAPTIVE SESSION · POST-GAME'));
  assert.ok(post.includes('LAST EVENT'));
  assert.ok(post.includes('REPLANS'));
  assert.ok(post.includes('NEXT GAME'));
});

test('web coach authority receives the same adaptive session contract',()=>{
  assert.ok(authority.includes('adaptiveCoachingSession:'));
  assert.ok(authority.includes('const recent=roleRecent??globalRecent'));
});

test('Stage 14 UI scripts load after Stage 13 and require Companion 0.7.42+',()=>{
  assert.ok(loader.includes("load('review-v7-adaptive-coaching-session.js')"));
  assert.ok(loader.includes("load('remember-v10-adaptive-coaching-session.js')"));
  assert.ok(loader.indexOf('review-v7-adaptive-coaching-session.js')>loader.indexOf('review-v6-player-coaching-identity.js'));
  assert.ok(loader.indexOf('remember-v10-adaptive-coaching-session.js')>loader.indexOf('remember-v9-player-coaching-identity.js'));
  const [major,minor,patch]=pkg.version.split('.').map(Number);
  assert.ok(major>0||minor>7||(minor===7&&patch>=42));
});
