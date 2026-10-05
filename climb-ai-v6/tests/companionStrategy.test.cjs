const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','companion','electron','preload.cjs'),'utf8');

test('Companion leads with a visual command board instead of a wall of plan text',()=>{
  for(const phrase of ['WIN THIS GAME','WIN CONDITION','YOUR JOB','THEY WANT',"DON'T",'CLIMB MISSION','WHY THIS PLAN WORKS +']){
    assert.ok(source.includes(phrase),`missing ${phrase}`);
  }
  assert.ok(source.includes("'1 · GET PAID'"));
  assert.ok(source.includes("'2 · STAY SAFE'"));
  assert.ok(source.includes("'3 · CASH OUT'"));
  assert.ok(source.includes('FARM → CORE ITEMS'));
  assert.ok(source.includes('SURVIVE FIRST ACCESS → HIT CLOSEST SAFE TARGET → OBJECTIVE'));
  assert.ok(!source.includes('opRoleStepLabel5'),'desktop should condense the five-part engine to three visible actions');
});

test('jungle plan is role-specific instead of lane-generic',()=>{
  assert.ok(source.includes("if(role==='JUNGLE')return'CLEAR ON TEMPO → MOVE ONLY FOR A CLEAN GANK OR COVER'"));
  assert.ok(source.includes("if(role==='JUNGLE')return'ReSET ON TEMPO" )===false);
  assert.ok(source.includes("if(role==='JUNGLE')return'RESET ON TEMPO → PATH TOWARD THE NEXT OBJECTIVE'"));
  assert.ok(source.includes("if(role==='JUNGLE')return`SMITE READY → ${core}`"));
});

test('win condition headline is a short composition command rather than a paragraph',()=>{
  assert.match(source,/function ourWinCommand\(team,matchup\)/);
  assert.ok(source.includes("shape.includes('FRONT')"));
  assert.ok(source.includes("shape.includes('DIVE')"));
  assert.ok(source.includes("shape.includes('POKE')"));
  assert.ok(source.includes("shape.includes('PICK')"));
  assert.ok(source.includes('POKE FIRST → FORCE THEM TO ENTER → CLEAN UP → OBJECTIVE'));
  assert.ok(source.includes('HOLD FORMATION → LET THEM ENTER → FRONT-TO-BACK → OBJECTIVE'));
});
