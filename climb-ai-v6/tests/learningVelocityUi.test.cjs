const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const loader=fs.readFileSync(path.join(root,'companion','electron','review-v2.js'),'utf8');
const remember=fs.readFileSync(path.join(root,'companion','electron','remember-v5-esports.js'),'utf8');
const pre=fs.readFileSync(path.join(root,'companion','electron','remember-v11-learning-velocity.js'),'utf8');
const post=fs.readFileSync(path.join(root,'companion','electron','review-v8-learning-velocity.js'),'utf8');
const draft=fs.readFileSync(path.join(root,'app','api','live','draft-coach','route.ts'),'utf8');
const decisionTwin=fs.readFileSync(path.join(root,'app','api','decision-twin','route.ts'),'utf8');
const learning=fs.readFileSync(path.join(root,'lib','server','proLearningRepository.ts'),'utf8');
const review=fs.readFileSync(path.join(root,'app','api','live','companion-review','route.ts'),'utf8');
const authority=fs.readFileSync(path.join(root,'lib','server','coachAuthority.ts'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'companion','package.json'),'utf8'));

test('Stage 15 persists Learning Velocity beside Player Identity and Adaptive Session',()=>{
  assert.ok(learning.includes('buildLearningVelocityProfile'));
  assert.ok(learning.includes('previousLearningVelocity'));
  assert.ok(learning.includes('learningVelocity'));
  assert.ok(learning.includes('getLearningVelocityProfile'));
  assert.ok(decisionTwin.includes('learningVelocity'));
});

test('Draft Coach consumes velocity for cadence, safe experiment choice and coaching method',()=>{
  assert.ok(draft.includes('LEARNING VELOCITY: '));
  assert.ok(draft.includes('LEARNING VELOCITY USE RULE:'));
  assert.ok(draft.includes('learningVelocityExperimentBias'));
  assert.ok(draft.includes('selectLearningVelocityCoachMethod'));
  assert.ok(draft.includes('learningVelocity:input.learningVelocity'));
  assert.ok(draft.includes('learningVelocity:proModel?context.learningVelocity:null'));
});

test('Coach Authority shares the same velocity policy',()=>{
  assert.ok(authority.includes('learningVelocity:'));
  assert.ok(authority.includes('repetition count'));
  assert.ok(authority.includes('fixed ability'));
});

test('Companion freezes velocity pre-game and refreshes it after the match',()=>{
  assert.ok(remember.includes('_learningVelocity=response?.learningVelocity||null'));
  assert.ok(remember.includes('learningVelocity:coach?._learningVelocity||null'));
  assert.ok(remember.includes('op-climb-learning-velocity'));
  assert.ok(review.includes('learningVelocity:latest.learningVelocity??null'));
});

test('pregame UI shows pace, rep targets, method and milestones',()=>{
  assert.ok(pre.includes('LEARNING VELOCITY · COACH OPTIMISATION'));
  assert.ok(pre.includes('REINFORCE TARGET'));
  assert.ok(pre.includes('FADE TARGET'));
  assert.ok(pre.includes('COACHING FORMAT'));
  assert.ok(pre.includes('FIRST INDEPENDENT'));
});

test('post-game UI shows explicit policy changes and next block adjustment',()=>{
  assert.ok(post.includes('LEARNING VELOCITY · POST-GAME'));
  assert.ok(post.includes('POLICY CHANGE'));
  assert.ok(post.includes('INDEPENDENT RATE'));
  assert.ok(post.includes('NEXT BLOCK ADJUSTMENT'));
});

test('Stage 15 scripts load once after Stage 14 and Companion is 0.7.43+',()=>{
  assert.equal((loader.match(/review-v7-adaptive-coaching-session\.js/g)||[]).length,1);
  assert.equal((loader.match(/remember-v10-adaptive-coaching-session\.js/g)||[]).length,1);
  assert.equal((loader.match(/review-v8-learning-velocity\.js/g)||[]).length,1);
  assert.equal((loader.match(/remember-v11-learning-velocity\.js/g)||[]).length,1);
  assert.ok(loader.indexOf('review-v8-learning-velocity.js')>loader.indexOf('review-v7-adaptive-coaching-session.js'));
  assert.ok(loader.indexOf('remember-v11-learning-velocity.js')>loader.indexOf('remember-v10-adaptive-coaching-session.js'));
  const [major,minor,patch]=pkg.version.split('.').map(Number);
  assert.ok(major>0||minor>7||(minor===7&&patch>=43));
});
