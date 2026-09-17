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

test('recording UI is a concise esports coach board instead of a text wall',()=>{
  assert.doesNotThrow(()=>new Function(hud));
  assert.doesNotThrow(()=>new Function(matchup));
  for(const label of ['YOUR TEAM','THEIR TEAM','MATCH CALL','MAIN THREAT','YOUR WIN CONDITION PATH','DO THESE IN ORDER','LANE','WAVE','TRADE','NEVER','IF BEHIND','CLIMB MISSION']){
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

test('their full draft survives champ select and renders on the live board',()=>{
  assert.ok(route.includes('draftTeams:{'));
  assert.ok(route.includes('ours:Array.isArray(data?.teamPlan?.ourTeam)'));
  assert.ok(route.includes('theirs:Array.isArray(data?.teamPlan?.theirTeam)'));
  assert.ok(hud.includes("renderTeam('opRemOurTeam'"));
  assert.ok(hud.includes("renderTeam('opRemTheirTeam'"));
  assert.ok(hud.includes("side==='ourTeam'?safe(planSnapshot(state)?.draftTeams?.ours):safe(planSnapshot(state)?.draftTeams?.theirs)"));
  assert.ok(hud.includes('championTile'));
});

test('placeholder OPPONENT TBD can never beat the actual draft opponent',()=>{
  assert.ok(hud.includes('validOpponent'));
  assert.ok(matchup.includes('validOpponent'));
  assert.ok(hud.includes("u.includes('TBD')"));
  assert.ok(matchup.includes("u.includes('TBD')"));
  assert.ok(hud.includes('||draftOpponent(state,role)'));
  assert.ok(matchup.includes('||opponentFromDraft(state,role)'));
});

test('coach makes an explicit fight-versus-farm match call from both drafts',()=>{
  assert.ok(hud.includes('function matchCall'));
  assert.ok(hud.includes("call:'FARM + SCALE'"));
  assert.ok(hud.includes("call:'FIGHT EARLY'"));
  assert.ok(hud.includes("call:'FARM TO SPIKE'"));
  assert.ok(hud.includes("call:'PRESS TEMPO'"));
  assert.ok(hud.includes("call:'FARM FIRST'"));
  assert.ok(hud.includes('powerFor(roster(state,\'theirTeam\'))'));
});

test('win condition is a five-step named route through the enemy draft',()=>{
  assert.ok(hud.includes('function winSteps'));
  assert.ok(hud.includes("value:step1"));
  assert.ok(hud.includes('WITH ${withName}'));
  assert.ok(hud.includes('DENY ${threat}'));
  assert.ok(hud.includes('HIT ${focus} IF SAFE'));
  assert.ok(hud.includes("label:'5 · CASH OUT'"));
  assert.ok(hud.includes('DRAGON / BARON'));
});

test('paid draft intelligence freezes named threats and damage targets without leaking to FREE',()=>{
  assert.ok(route.includes('draftThreats:paid&&Array.isArray'));
  assert.ok(route.includes('draftDamageCore:paid&&Array.isArray'));
  assert.ok(route.includes('draftTheirWinCondition:paid?'));
  assert.ok(route.includes('draftBiggestThrow:paid?'));
  assert.match(core,/ourWinCondition:null,roleWinCondition:null,theirWinCondition:null,biggestThrow:null,compositionRead:null/);
  assert.ok(hud.includes('frozenThreats'));
  assert.ok(hud.includes('frozenDamage'));
});

test('matchup uses three short lane commands instead of a paragraph',()=>{
  assert.ok(hud.includes('opRemLaneDo'));
  assert.ok(hud.includes('opRemTradeWhen'));
  assert.ok(hud.includes('opRemNever'));
  assert.ok(matchup.includes('WAVE NEAR YOU · PRESERVE HP'));
  assert.ok(matchup.includes('FARM FIRST · MAKE ${opponent} STEP UP'));
  assert.ok(matchup.includes('${opponent} MISSES KEY SPELL'));
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
