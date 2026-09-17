const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const hud=fs.readFileSync(path.join(root,'companion','electron','remember-v2.js'),'utf8');
const route=fs.readFileSync(path.join(root,'app','api','live','champion-plan','route.ts'),'utf8');
const model=fs.readFileSync(path.join(root,'lib','champions','rememberPlan.ts'),'utf8');

test('recording UI is a short esports remember screen rather than the full analysis desk',()=>{
  for(const label of ['REMEMBER YOUR PLAN','HOW WE WIN','PLAY WITH','WATCH','FIGHT RULE','IF BEHIND','CONVERT','CLIMB MISSION']){
    assert.ok(hud.includes(label),`missing ${label}`);
  }
  assert.ok(hud.includes('5 / 10 / 15 MIN SELF-CHECK'));
  assert.ok(hud.includes("phase==='RECORDING'"));
  assert.ok(hud.includes('op-remember-live'));
  assert.ok(hud.includes('PLAN LOCKED'));
});

test('CS/resource target exists without leaking paid win-condition strategy to FREE',()=>{
  assert.ok(route.includes('resourceTarget:remember.resourceTarget'));
  assert.ok(route.includes('rememberPlan:paid?remember:null'));
  assert.ok(model.includes("kind:'CS'|'FARM'|'MAP'"));
  assert.ok(model.includes("label:role==='JUNGLE'?'FARM TARGET':'CS TARGET'"));
  assert.ok(model.includes("if(role==='SUPPORT')return{kind:'MAP'"));
});

test('game-state adaptation is a prebuilt self-check, not live reactive shotcalling',()=>{
  assert.ok(model.includes('frozenFromChampSelect:true'));
  assert.ok(model.includes('usesLiveTelemetry:false'));
  assert.ok(model.includes("minute:5"));
  assert.ok(model.includes("minute:10"));
  assert.ok(model.includes("minute:15"));
  assert.ok(hud.includes('YOU READ THE LIVE GAME STATE'));
  assert.ok(hud.includes('NO REACTIVE SHOTCALLING'));
});
