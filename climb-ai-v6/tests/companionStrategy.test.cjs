const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','companion','electron','preload.cjs'),'utf8');

test('Companion leads with a direct path to win instead of duplicate plan layers',()=>{
  for(const phrase of ['YOUR PATH TO WIN','HOW WE WIN','HOW THEY WIN','YOUR JOB','1 · EARLY GAME','2 · SETUP','3 · FIGHT → CONVERT','BIGGEST THROW','YOUR CLIMB MISSION']){
    assert.ok(source.includes(phrase),`missing ${phrase}`);
  }
  assert.ok(!source.includes('opRoleStepLabel5'),'desktop should condense the five-part engine to three visible actions');
});

test('jungle plan is role-specific instead of lane-generic',()=>{
  assert.ok(source.includes("if(role==='JUNGLE')return'CLEAR ON TEMPO → MOVE ONLY FOR A CLEAN GANK OR COVER'"));
  assert.ok(source.includes("if(role==='JUNGLE')return'ReSET ON TEMPO" )===false);
  assert.ok(source.includes("if(role==='JUNGLE')return'RESET ON TEMPO → PATH TOWARD THE NEXT OBJECTIVE'"));
  assert.ok(source.includes("if(role==='JUNGLE')return`SMITE READY → ${core}`"));
});

test('win condition is derived from teamfight identity rather than a generic reminder',()=>{
  assert.match(source,/function ourWinCommand\(team,matchup\)/);
  assert.ok(source.includes("label.includes('FRONT')||label.includes('LAYERED')"));
  assert.ok(source.includes("label.includes('DIVE')"));
  assert.ok(source.includes("label.includes('POKE')"));
  assert.ok(source.includes("label.includes('PICK')"));
});
