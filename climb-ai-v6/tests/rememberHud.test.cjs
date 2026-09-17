const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const hud=fs.readFileSync(path.join(root,'companion','electron','remember-v2.js'),'utf8');
const route=fs.readFileSync(path.join(root,'app','api','live','champion-plan','route.ts'),'utf8');
const core=fs.readFileSync(path.join(root,'app','api','live','champion-plan','route-core.ts'),'utf8');
const model=fs.readFileSync(path.join(root,'lib','champions','rememberPlan.ts'),'utf8');

test('recording UI always switches to a short esports remember screen',()=>{
  for(const label of ['REMEMBER YOUR PLAN','HOW WE WIN','MATCHUP','PLAY WITH','WATCH','FIGHT RULE','IF BEHIND','CONVERT','CLIMB MISSION']){
    assert.ok(hud.includes(label),`missing ${label}`);
  }
  assert.ok(hud.includes('5 / 10 / 15 MIN SELF-CHECK'));
  assert.ok(hud.includes("const visible=phase==='RECORDING'"));
  assert.ok(!hud.includes("phase==='RECORDING'&&Boolean(plan)"),'recording must not depend on paid rememberPlan');
  assert.ok(hud.includes('op-remember-live'));
  assert.ok(hud.includes('LIVE · RECORDING'));
  assert.ok(hud.includes('PLAN LOCKED'));
});

test('matchup is visible in champ select when known and remains in the recording HUD',()=>{
  assert.ok(hud.includes('LANE MATCHUP'));
  assert.ok(hud.includes('opPregameMatchup'));
  assert.ok(hud.includes('opRemMatchTitle'));
  assert.ok(hud.includes('state?.matchup?.opponent'));
  assert.ok(hud.includes('plan?.laneDuel?.yourPattern'));
  assert.ok(hud.includes('draftOpponent(state,role)'));
});

test('FREE receives only a free-safe remember HUD while paid win/loss fields remain server-redacted',()=>{
  assert.ok(route.includes('resourceTarget:remember.resourceTarget'));
  assert.ok(route.includes('rememberPlan:remember'));
  assert.ok(route.includes("rememberPlanAccess:paid?'FULL':'SIMPLE'"));
  assert.match(core,/ourWinCondition:null,roleWinCondition:null,theirWinCondition:null,biggestThrow:null,compositionRead:null/);
  assert.ok(model.includes("kind:'CS'|'FARM'|'MAP'"));
  assert.ok(model.includes("label:role==='JUNGLE'?'FARM TARGET':'CS TARGET'"));
  assert.ok(model.includes("if(role==='SUPPORT')return{kind:'MAP'"));
});

test('draft, board-state self-check and recovery are one integrated win-condition model',()=>{
  assert.ok(model.includes('macroPlanFor(teamShape,powerCurve)'));
  assert.ok(model.includes('carryPlanFor(team,role,paid)'));
  assert.ok(model.includes('threatPlanFor(team,watch,paid)'));
  assert.ok(model.includes('objectiveRouteFor(teamShape,powerCurve)'));
  assert.ok(model.includes('WHO HAS THE FIRST GOLD / ITEM ADVANTAGE?'));
  assert.ok(model.includes('WHO IS OUR STRONGEST USABLE CARRY NOW?'));
  assert.ok(model.includes('WHAT IS THE NEXT OBJECTIVE / WHICH SIDE MATTERS?'));
  assert.ok(model.includes('WHO IS THEIR MAIN THREAT NOW?'));
  assert.ok(model.includes('WHO SHOULD RECEIVE SAFE WAVES / SOLO XP?'));
  assert.ok(model.includes('GROUP / SIDE / PICK / STALL — WHICH STATE FAVOURS US?'));
  assert.ok(model.includes('ORIGINAL PLAN OR RECOVERY PLAN?'));
  assert.ok(model.includes('STOP NEUTRAL 5V5S'));
});

test('game-state adaptation is a player-led self-check, not live reactive shotcalling',()=>{
  assert.ok(model.includes('frozenFromChampSelect:true'));
  assert.ok(model.includes('usesLiveTelemetry:false'));
  assert.ok(model.includes("minute:5"));
  assert.ok(model.includes("minute:10"));
  assert.ok(model.includes("minute:15"));
  assert.ok(hud.includes('YOU READ THE LIVE GAME STATE'));
  assert.ok(hud.includes('NO REACTIVE SHOTCALLING'));
});
