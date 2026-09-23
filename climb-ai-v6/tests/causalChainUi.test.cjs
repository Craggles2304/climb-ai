const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const loader=fs.readFileSync(path.join(root,'companion','electron','review-v2.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'companion','electron','review-v4-causal-chain.js'),'utf8');
const graph=fs.readFileSync(path.join(root,'lib','decisionGraph.ts'),'utf8');
const engine=fs.readFileSync(path.join(root,'lib','decisionCausalChain.ts'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'companion','package.json'),'utf8'));

test('Stage 11 causal review loads after read calibration',()=>{
  assert.ok(loader.includes("load('review-v3-read-calibration.js')"));
  assert.ok(loader.includes("load('review-v4-causal-chain.js')"));
  assert.ok(loader.indexOf('review-v4-causal-chain.js')>loader.indexOf('review-v3-read-calibration.js'));
  const [major,minor,patch]=pkg.version.split('.').map(Number);assert.ok(major>0||minor>7||(minor===7&&patch>=39));
});

test('causal review exposes the full read priority action result chain',()=>{
  assert.ok(ui.includes('READ → PRIORITY → ACTION → RESULT'));
  assert.ok(ui.includes('FROZEN PRIORITY'));
  assert.ok(ui.includes('NEXT VERIFIED DECISION'));
  assert.ok(ui.includes('OBSERVED RESULT'));
  assert.ok(ui.includes('NEXT COACHING LAYER'));
  assert.ok(ui.includes('ROOT CAUSE MEMORY · MULTI-GAME'));
});

test('causal engine keeps evidence boundaries and distinct root-cause classes',()=>{
  assert.ok(engine.includes('MISREAD_COMPOUNDED'));
  assert.ok(engine.includes('PRIORITY_DEVIATION'));
  assert.ok(engine.includes('EXECUTION_GAP'));
  assert.ok(engine.includes('MISREAD_RECOVERED'));
  assert.ok(engine.includes('CLEAN_CHAIN'));
  assert.ok(engine.includes('NOT_VERIFIABLE'));
  assert.ok(engine.includes('IT DOES NOT CLAIM THE EARLIER READ OR PRIORITY CAUSED THE LATER RESULT'));
});

test('Stage 11 returns repeated causal memory through the live review path',()=>{
  const liveRepo=fs.readFileSync(path.join(root,'lib','server','liveTrackerRepository.ts'),'utf8');
  const learningRepo=fs.readFileSync(path.join(root,'lib','server','proLearningRepository.ts'),'utf8');
  const route=fs.readFileSync(path.join(root,'app','api','live','companion-review','route.ts'),'utf8');
  assert.ok(learningRepo.includes('buildDecisionCausalProfile'));
  assert.ok(learningRepo.includes('getDecisionCausalProfile'));
  assert.ok(liveRepo.includes('causalProfile'));
  assert.ok(route.includes('causalProfile:latest.causalProfile??null'));
});

test('Decision Graph owns Stage 11 causal reconstruction',()=>{
  assert.ok(graph.includes('buildDecisionCausalChain'));
  assert.ok(graph.includes('causalChain:DecisionCausalChainReview'));
  assert.ok(graph.includes('causalChain,'));
});
