const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const loader=fs.readFileSync(path.join(root,'companion','electron','review-v2.js'),'utf8');
const os=fs.readFileSync(path.join(root,'companion','electron','remember-v6-match-os.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'companion','electron','remember-v5-esports.js'),'utf8');
const review=fs.readFileSync(path.join(root,'companion','electron','review-v2-core.js'),'utf8');
const route=fs.readFileSync(path.join(root,'app','api','live','draft-coach','route.ts'),'utf8');

test('Companion loads Match OS after the existing deep coaching surface',()=>{
  assert.ok(loader.includes("load('remember-v5-esports.js')"));
  assert.ok(loader.includes("load('remember-v6-match-os.js')"));
  assert.ok(loader.indexOf("remember-v6-match-os.js")>loader.indexOf("remember-v5-esports.js"));
});

test('Match OS compresses the League system into one live contract',()=>{
  assert.ok(os.includes('HOW WE WIN'));
  assert.ok(os.includes('THEY WIN IF'));
  assert.ok(os.includes('YOUR JOB'));
  assert.ok(os.includes('ONE LEARNING REP'));
  assert.ok(os.includes('WHAT MATTERS NOW'));
  assert.ok(os.includes('POST-GAME PROOF'));
  assert.ok(os.includes('data-matchos-branch="AHEAD"'));
  assert.ok(os.includes('data-matchos-branch="EVEN"'));
  assert.ok(os.includes('data-matchos-branch="BEHIND"'));
});

test('Match OS changes display phase by clock only and never auto-selects tactical state',()=>{
  assert.ok(os.includes('phaseFor(contract,lastDetail.gameTime)'));
  assert.ok(os.includes('OP CLIMB DOES NOT AUTO-SELECT YOUR GAME STATE'));
  assert.ok(route.includes('usesLiveTelemetryForTactics:false'));
  assert.ok(route.includes('clockOnlyPhaseProgression:true'));
});

test('existing Companion bridge carries and persists the frozen Match Contract',()=>{
  assert.ok(bridge.includes('enrichedCoach._matchContract=response?.matchContract||null'));
  assert.ok(bridge.includes('matchContract:coach?._matchContract||null'));
  assert.ok(bridge.includes("new CustomEvent('op-climb-match-os'"));
});

test('post-game Companion shows the Match OS contract result first',()=>{
  assert.ok(review.includes('MATCH OS · CONTRACT REVIEW'));
  assert.ok(review.includes('function renderMatchContractReview'));
  assert.ok(review.includes('renderMatchContractReview(review)'));
});


test('Match OS obeys Intent Gap and autonomy cue fading instead of leaking the answer',()=>{
  assert.ok(os.includes('intentOpen'));
  assert.ok(os.includes("delivery==='NONE'"));
  assert.ok(os.includes('COACHING CUE LOCKED UNTIL YOUR INTENT IS FROZEN'));
  assert.ok(os.includes('POST-GAME WILL SCORE THE VERIFIED DECISION · NO LIVE ANSWER REVEALED'));
  assert.ok(bridge.includes('intentSkipped'));
});
