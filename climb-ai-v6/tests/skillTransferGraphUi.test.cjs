const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const loader=fs.readFileSync(path.join(root,'companion','electron','review-v2.js'),'utf8');
const remember=fs.readFileSync(path.join(root,'companion','electron','remember-v5-esports.js'),'utf8');
const pre=fs.readFileSync(path.join(root,'companion','electron','remember-v12-skill-transfer-graph.js'),'utf8');
const post=fs.readFileSync(path.join(root,'companion','electron','review-v9-skill-transfer-graph.js'),'utf8');
const draft=fs.readFileSync(path.join(root,'app','api','live','draft-coach','route.ts'),'utf8');
const graph=fs.readFileSync(path.join(root,'lib','climbSkillTransferGraph.ts'),'utf8');
const decision=fs.readFileSync(path.join(root,'lib','decisionGraph.ts'),'utf8');
const learning=fs.readFileSync(path.join(root,'lib','server','proLearningRepository.ts'),'utf8');
const twin=fs.readFileSync(path.join(root,'app','api','decision-twin','route.ts'),'utf8');
const review=fs.readFileSync(path.join(root,'app','api','live','companion-review','route.ts'),'utf8');
const authority=fs.readFileSync(path.join(root,'lib','server','coachAuthority.ts'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'companion','package.json'),'utf8'));

test('Stage 16 persists and exposes the Skill Transfer Graph',()=>{
  assert.ok(learning.includes('buildSkillTransferGraph'));
  assert.ok(learning.includes('skillTransferGraph'));
  assert.ok(learning.includes('getSkillTransferGraph'));
  assert.ok(twin.includes('skillTransferGraph'));
  assert.ok(authority.includes('skillTransferGraph:'));
});

test('Draft Coach freezes a graph-selected Skill Bridge',()=>{
  assert.ok(draft.includes('selectSkillBridgePrime'));
  assert.ok(draft.includes('skillTransferGraph:proModel?context.skillTransferGraph:null'));
  assert.ok(draft.includes('skillBridgePrime'));
  assert.ok(draft.includes('SKILL TRANSFER GRAPH: '));
  assert.ok(remember.includes('_skillTransferGraph=response?.skillTransferGraph||null'));
  assert.ok(remember.includes('_skillBridgePrime=response?.skillBridgePrime||null'));
});

test('Decision Graph reviews direct target evidence only',()=>{
  assert.ok(graph.includes('reviewSkillBridgePrime'));
  assert.ok(graph.includes('Source mastery, edge strength and observed associations cannot pass or graduate the target skill.'));
  assert.ok(decision.includes('reviewSkillBridgePrime'));
  assert.ok(decision.includes('skillBridge:skillBridgeReview'));
  assert.ok(decision.includes('skillBridgePrime:raw.skillBridgePrime??null'));
});

test('Companion shows pregame graph and postgame direct bridge result',()=>{
  assert.ok(pre.includes('SKILL TRANSFER GRAPH · DIRECT BRIDGE TEST'));
  assert.ok(pre.includes('STABLE SOURCE'));
  assert.ok(pre.includes('DIRECT TARGET TEST'));
  assert.ok(post.includes('SKILL BRIDGE · POST-GAME DIRECT EVIDENCE'));
  assert.ok(post.includes('DIRECT TARGET MOMENTS'));
  assert.ok(review.includes('skillTransferGraph:latest.skillTransferGraph??null'));
});

test('Stage 16 scripts load after Stage 15 and require Companion 0.7.44+',()=>{
  assert.ok(loader.includes("load('review-v9-skill-transfer-graph.js')"));
  assert.ok(loader.includes("load('remember-v12-skill-transfer-graph.js')"));
  assert.ok(loader.indexOf('review-v9-skill-transfer-graph.js')>loader.indexOf('review-v8-learning-velocity.js'));
  assert.ok(loader.indexOf('remember-v12-skill-transfer-graph.js')>loader.indexOf('remember-v11-learning-velocity.js'));
  const [major,minor,patch]=pkg.version.split('.').map(Number);
  assert.ok(major>0||minor>7||(minor===7&&patch>=44));
});
