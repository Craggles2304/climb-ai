const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const loader=fs.readFileSync(path.join(root,'companion','electron','review-v2.js'),'utf8');
const live=fs.readFileSync(path.join(root,'companion','electron','remember-v7-read-checkpoints.js'),'utf8');
const routeUi=fs.readFileSync(path.join(root,'companion','electron','remember-v8-causal-coach-router.js'),'utf8');
const reviewUi=fs.readFileSync(path.join(root,'companion','electron','review-v5-causal-coach-router.js'),'utf8');
const draft=fs.readFileSync(path.join(root,'app','api','live','draft-coach','route.ts'),'utf8');
const graph=fs.readFileSync(path.join(root,'lib','decisionGraph.ts'),'utf8');
const remember=fs.readFileSync(path.join(root,'companion','electron','remember-v5-esports.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'companion','package.json'),'utf8'));

test('Stage 12 causal router is frozen by the draft coach and persisted in Companion',()=>{
  assert.ok(draft.includes('buildCausalCoachRoute'));
  assert.ok(draft.includes('causalCoachRoute'));
  assert.ok(remember.includes('_causalCoachRoute'));
  assert.ok(remember.includes('causalCoachRoute:coach?._causalCoachRoute||null'));
});

test('Match OS exposes causal coaching layer and route-specific directives',()=>{
  assert.ok(routeUi.includes('CAUSAL COACH ROUTER · NEXT-GAME LAYER'));
  assert.ok(routeUi.includes('COACHING LAYER'));
  assert.ok(routeUi.includes('LIVE DIRECTIVE'));
  assert.ok(routeUi.includes('CHECKPOINT PLAN'));
});

test('live read checkpoints obey route cadence and follow-through commitment cue',()=>{
  assert.ok(live.includes('checkpointMinutes()'));
  assert.ok(live.includes("route?.mode==='COMMITMENT_TEST'"));
  assert.ok(live.includes("READ LOCKED · COMMIT TO "));
  assert.ok(live.includes("route?.mode==='AUTONOMY_TEST'"));
  assert.ok(live.includes("route?.mode==='EXECUTION_ONLY'"));
});

test('post-game Decision Graph reviews the frozen causal route',()=>{
  assert.ok(graph.includes('reviewCausalCoachRoute'));
  assert.ok(graph.includes('causalCoachRoute:causalCoachRouteReview'));
  assert.ok(reviewUi.includes('CAUSAL COACH ROUTER · POST-GAME CHECK'));
  assert.ok(reviewUi.includes('ROUTED LAYER'));
  assert.ok(reviewUi.includes('OBSERVED LAYER'));
  assert.ok(reviewUi.includes('NEXT ROUTER ACTION'));
});

test('Stage 12 UI scripts load after Stage 10 and 11 layers',()=>{
  assert.ok(loader.includes("load('remember-v8-causal-coach-router.js')"));
  assert.ok(loader.includes("load('review-v5-causal-coach-router.js')"));
  assert.ok(loader.indexOf('remember-v8-causal-coach-router.js')>loader.indexOf('remember-v7-read-checkpoints.js'));
  assert.ok(loader.indexOf('review-v5-causal-coach-router.js')>loader.indexOf('review-v4-causal-chain.js'));
  const [major,minor,patch]=pkg.version.split('.').map(Number);
  assert.ok(major>0||minor>7||(minor===7&&patch>=40));
});
