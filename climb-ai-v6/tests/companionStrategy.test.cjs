const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','companion','electron','preload.cjs'),'utf8');

test('Companion leads with one explicit win condition and a connected match flow',()=>{
  for(const phrase of ['HOW WE WIN THIS GAME','WIN CONDITION','YOUR JOB','01 · EARLY','02 · MID GAME','03 · OBJECTIVE','04 · FIGHT','THEY WIN IF','YOUR CLIMB MISSION']){
    assert.ok(source.includes(phrase),`missing ${phrase}`);
  }
  assert.ok(!source.includes('<span>WE WIN IF</span>'),'old duplicated win-condition card should not remain');
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
