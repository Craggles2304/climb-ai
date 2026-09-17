const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const hud=fs.readFileSync(path.join(root,'companion','electron','remember-v3.js'),'utf8');
const matchup=fs.readFileSync(path.join(root,'companion','electron','remember-v3-matchup.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'companion','electron','review-v2.js'),'utf8');
const route=fs.readFileSync(path.join(root,'app','api','live','champion-plan','route.ts'),'utf8');
const core=fs.readFileSync(path.join(root,'app','api','live','champion-plan','route-core.ts'),'utf8');
const model=fs.readFileSync(path.join(root,'lib','champions','rememberPlan.ts'),'utf8');

test('recording UI switches to a concise esports remember screen',()=>{
  assert.doesNotThrow(()=>new Function(hud));
  assert.doesNotThrow(()=>new Function(matchup));
  for(const label of ['REMEMBER YOUR PLAN','HOW WE WIN · DO THIS','YOUR MATCHUP','DO THIS','TRADE WHEN','NEVER','PLAY WITH','PRIMARY FIGHT TARGET','IF BEHIND','CLIMB MISSION']){
    assert.ok(hud.includes(label),`missing ${label}`);
  }
  assert.ok(hud.includes('5 / 10 / 15 MIN SELF-CHECK'));
  assert.ok(hud.includes("const visible=phase==='RECORDING'"));
  assert.ok(hud.includes('op-remember-live'));
  assert.ok(hud.includes('LIVE · RECORDING'));
  assert.ok(hud.includes('PLAN LOCKED'));
  assert.ok(loader.includes("load('remember-v3.js')"));
  assert.ok(loader.includes("load('remember-v3-matchup.js')"));
});

test('remember HUD resolves actual allies, threats and a named fight target from the locked draft',()=>{
  assert.ok(hud.includes('pickSpecificPlayWith'));
  assert.ok(hud.includes("rolePick(allies,'SUPPORT')"));
  assert.ok(hud.includes('pickFightTarget'));
  assert.ok(hud.includes("rolePick(enemies,'ADC')"));
  assert.ok(hud.includes('pickDanger'));
  assert.ok(hud.includes('enemyDamageCore'));
  assert.ok(hud.includes('enemyThreats'));
  assert.ok(hud.includes('PRIMARY FIGHT TARGET'));
  assert.ok(hud.includes('IF THEY ARE IN SAFE RANGE'));
  assert.ok(hud.includes('DO NOT WALK THROUGH'));
  assert.ok(!hud.includes('YOUR FIRST-CONTACT CHAMPION'));
});

test('win condition is an executable named sequence rather than generic fight language',()=>{
  assert.ok(hud.includes('specificWin'));
  assert.ok(hud.includes('STAY WITH ${withName}'));
  assert.ok(hud.includes('SURVIVE ${danger}'));
  assert.ok(hud.includes('HIT ${focus} IF SAFE'));
  assert.ok(hud.includes('DRAGON / BARON'));
  assert.ok(hud.includes('finalFarmCue'));
  assert.ok(!hud.includes('WIN FIGHT → DRAGON / BARON / TOWER'));
});

test('matchup gives three direct lane instructions instead of one vague trigger sentence',()=>{
  assert.ok(hud.includes('opRemLaneDo'));
  assert.ok(hud.includes('opRemTradeWhen'));
  assert.ok(hud.includes('opRemNever'));
  assert.ok(matchup.includes('PUNISH ${opponent} WHEN THEY LAST-HIT'));
  assert.ok(matchup.includes('KEEP THE WAVE CLOSER TO YOU'));
  assert.ok(matchup.includes('FARM FIRST → KEEP THE WAVE PLAYABLE'));
  assert.ok(matchup.includes('AFTER ${opponent} MISSES A KEY SPELL OR USES IT ON THE WAVE'));
  assert.ok(matchup.includes("String(state?.phase||'')!=='RECORDING'"));
});

test('FREE remains server-redacted while the simple HUD may name champions already visible in the draft',()=>{
  assert.ok(route.includes('resourceTarget:remember.resourceTarget'));
  assert.ok(route.includes('rememberPlan:remember'));
  assert.ok(route.includes("rememberPlanAccess:paid?'FULL':'SIMPLE'"));
  assert.match(core,/ourWinCondition:null,roleWinCondition:null,theirWinCondition:null,biggestThrow:null,compositionRead:null/);
  assert.ok(model.includes("kind:'CS'|'FARM'|'MAP'"));
  assert.ok(model.includes("label:role==='JUNGLE'?'FARM TARGET':'CS TARGET'"));
  assert.ok(model.includes("if(role==='SUPPORT')return{kind:'MAP'"));
});

test('draft, board-state self-check and recovery remain one integrated win-condition model',()=>{
  assert.ok(model.includes('macroPlanFor(teamShape,powerCurve)'));
  assert.ok(model.includes('carryPlanFor(team,role,rich)'));
  assert.ok(model.includes('threatPlanFor(team,watch,rich)'));
  assert.ok(model.includes('objectiveRouteFor(teamShape,powerCurve)'));
  assert.ok(model.includes('WHO HAS THE FIRST GOLD / ITEM ADVANTAGE?'));
  assert.ok(model.includes('WHO IS OUR STRONGEST USABLE CARRY NOW?'));
  assert.ok(model.includes('WHAT IS THE NEXT OBJECTIVE / WHICH SIDE MATTERS?'));
  assert.ok(model.includes('WHO IS THEIR MAIN THREAT NOW?'));
  assert.ok(model.includes('WHO SHOULD RECEIVE SAFE WAVES / SOLO XP?'));
  assert.ok(model.includes('GROUP / SIDE / PICK / STALL — WHICH STATE FAVOURS US?'));
  assert.ok(model.includes('ORIGINAL PLAN OR RECOVERY PLAN?'));
});

test('game-state adaptation stays player-led rather than reactive live shotcalling',()=>{
  assert.ok(model.includes('frozenFromChampSelect:true'));
  assert.ok(model.includes('usesLiveTelemetry:false'));
  assert.ok(model.includes("minute:5"));
  assert.ok(model.includes("minute:10"));
  assert.ok(model.includes("minute:15"));
  assert.ok(hud.includes('YOU READ THE LIVE GAME STATE'));
  assert.ok(hud.includes('NO REACTIVE SHOTCALLING'));
});