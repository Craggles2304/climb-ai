const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const esports=fs.readFileSync(path.join(root,'companion','electron','review-esports.js'),'utf8');
const core=fs.readFileSync(path.join(root,'companion','electron','review-v2-core.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'companion','electron','review-v2.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'companion','package.json'),'utf8'));

test('post-game review has a champion-led esports hero instead of a report-only header',()=>{
  for(const label of ['POST MATCH // PERFORMANCE REVIEW','MATCH INTELLIGENCE // VERIFIED REVIEW','GAME DEBRIEF','KDA','CS / MIN','MATCH TIME','DECISIONS']){
    assert.ok(esports.includes(label),`missing ${label}`);
  }
  assert.ok(esports.includes('ddragon.leagueoflegends.com/cdn/img/champion/splash/'));
  assert.ok(esports.includes('op-es-art'));
  assert.ok(esports.includes('op-es-board'));
});

test('post-game review uses recorded evidence as a match-moments timeline',()=>{
  assert.ok(esports.includes('MATCH MOMENTS'));
  assert.ok(esports.includes("item?.verified!==false"));
  assert.ok(esports.includes('item?.atSeconds'));
  assert.ok(esports.includes("item.kind==='fix'?'fix':''"));
  assert.ok(esports.includes('(seconds/duration)*100'));
});

test('next-game coaching call is visually promoted without inventing a performance score',()=>{
  assert.ok(esports.includes('NEXT GAME // ONE CALL'));
  assert.ok(esports.includes('review?.nextFocus?.title'));
  assert.ok(esports.includes('review?.nextFocus?.rule'));
  assert.ok(!esports.includes('PERFORMANCE SCORE'));
  assert.ok(!esports.includes('RATING / 100'));
});

test('completed review has an explicit route back to ready for the next game',()=>{
  assert.ok(core.includes('id="op332Ready"'));
  assert.ok(core.includes('NEW GAME · BACK TO READY'));
  assert.ok(core.includes('localStorage.removeItem(STORAGE_KEY)'));
  assert.ok(core.includes('window.opCompanion?.restart?.()'));
});

test('review layer loads after the evidence renderer and Companion version matches this release',()=>{
  const coreIndex=loader.indexOf("load('review-v2-core.js')");
  const esportsIndex=loader.indexOf("load('review-esports.js')");
  assert.ok(coreIndex>=0&&esportsIndex>coreIndex);
  assert.equal(pkg.version,'0.7.10');
});
