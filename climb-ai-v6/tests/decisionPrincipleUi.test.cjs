const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('Stage 17 Companion loads one pre-game and one post-game principle surface',()=>{
  const loader=fs.readFileSync('companion/electron/review-v2.js','utf8');
  const pre=fs.readFileSync('companion/electron/remember-v13-decision-principle-engine.js','utf8');
  const post=fs.readFileSync('companion/electron/review-v10-decision-principle-engine.js','utf8');
  assert.equal((loader.match(/remember-v13-decision-principle-engine\.js/g)||[]).length,1);
  assert.equal((loader.match(/review-v10-decision-principle-engine\.js/g)||[]).length,1);
  assert.match(pre,/DECISION PRINCIPLE ENGINE/);
  assert.match(pre,/decisionPrinciplePrime/);
  assert.match(post,/decisionPrinciple/);
  assert.match(post,/DIRECT MOMENTS/);
});

test('Stage 17 frozen Companion plan carries principle engine and test',()=>{
  const live=fs.readFileSync('companion/electron/remember-v5-esports.js','utf8');
  assert.match(live,/decisionPrincipleEngine:coach\?\._decisionPrincipleEngine/);
  assert.match(live,/decisionPrinciplePrime:coach\?\._decisionPrinciplePrime/);
  assert.match(live,/_decisionPrincipleEngine=response\?\.decisionPrincipleEngine/);
  assert.match(live,/_decisionPrinciplePrime=response\?\.decisionPrinciplePrime/);
});
