const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const hud=fs.readFileSync(path.join(root,'companion','electron','remember-v3.js'),'utf8');
const matchup=fs.readFileSync(path.join(root,'companion','electron','remember-v3-matchup.js'),'utf8');
const esports=fs.readFileSync(path.join(root,'companion','electron','remember-v5-esports.js'),'utf8');
const liveRoster=fs.readFileSync(path.join(root,'companion','electron','live-roster.cjs'),'utf8');
const bootstrap=fs.readFileSync(path.join(root,'companion','electron','bootstrap.cjs'),'utf8');
const loader=fs.readFileSync(path.join(root,'companion','electron','review-v2.js'),'utf8');
const route=fs.readFileSync(path.join(root,'app','api','live','champion-plan','route.ts'),'utf8');
const core=fs.readFileSync(path.join(root,'app','api','live','champion-plan','route-core.ts'),'utf8');
const draftCoach=fs.readFileSync(path.join(root,'app','api','live','draft-coach','route.ts'),'utf8');
const main=fs.readFileSync(path.join(root,'companion','electron','main.cjs'),'utf8');
const preload=fs.readFileSync(path.join(root,'companion','electron','preload.cjs'),'utf8');
const model=fs.readFileSync(path.join(root,'lib','champions','rememberPlan.ts'),'utf8');

test('recording UI is a concise esports coach board instead of a text wall',()=>{
  assert.doesNotThrow(()=>new Function(hud));
  assert.doesNotThrow(()=>new Function(matchup));
  assert.doesNotThrow(()=>new Function(esports));
  assert.doesNotThrow(()=>new Function(liveRoster));
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
  assert.ok(loader.includes("load('remember-v5-esports.js')"));
});

test('live board fills the app and receives the actual in-game roster',()=>{
  assert.ok(esports.includes('min-height:calc(100vh - 94px)'));
  assert.ok(esports.includes('grid-template-rows:minmax(108px'));
  assert.ok(esports.includes("window.addEventListener('op-climb-live-roster'"));
  assert.ok(esports.includes("renderTeam('opRemTheirTeam'"));
  assert.ok(esports.includes('scoreThreat'));
  assert.ok(esports.includes('SURVIVE FIRST DIVE → FREE-HIT'));
  assert.ok(liveRoster.includes("PATH='/liveclientdata/allgamedata'"));
  assert.ok(liveRoster.includes("new CustomEvent('op-climb-live-roster'"));
  assert.ok(bootstrap.includes("require('./live-roster.cjs')"));
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


test('paid live draft coach reasons about composition interactions instead of champion buckets',()=>{
  assert.ok(esports.includes('SURVIVE FIRST DIVE → FREE-HIT'));
  assert.ok(esports.includes('ACCESS PACKAGE'));
  assert.ok(esports.includes('HIT CLOSEST SAFE TARGET'));
  assert.ok(esports.includes('repairTeam'));
  assert.ok(esports.includes('window.opCompanion.draftCoach'));
  assert.ok(draftCoach.includes('target accessibility'));
  assert.ok(draftCoach.includes('multi-champion threat PACKAGE'));
  assert.ok(draftCoach.includes('closest safe target'));
  assert.ok(draftCoach.includes("PLUS or PRO is required for the full draft coach."));
});

test('desktop bridges the exact live roster into the server draft coach once per draft',()=>{
  assert.ok(main.includes('/api/live/draft-coach'));
  assert.ok(main.includes("ipcMain.handle('companion:draft-coach'"));
  assert.ok(preload.includes("draftCoach:(context)=>ipcRenderer.invoke('companion:draft-coach',context)"));
  assert.ok(esports.includes('lastCoachSignature'));
  assert.ok(esports.includes('lastRosterSignature'));
});


test('paid draft coach is grounded in rank, ILP and Riot kit facts with a specificity audit',()=>{
  assert.ok(draftCoach.includes('rankCoachingInstruction'));
  assert.ok(draftCoach.includes('kitFacts'));
  assert.ok(draftCoach.includes('enemyTips'));
  assert.ok(draftCoach.includes('evaluateWinConditionPlan'));
  assert.ok(draftCoach.includes('QUALITY AUDIT FAILED'));
  assert.ok(draftCoach.includes('lanePlan'));
  assert.ok(draftCoach.includes('fightTrigger'));
  assert.ok(draftCoach.includes('objectiveSetup'));
  assert.ok(esports.includes("set('opRemLaneDo',lanePlan.wave)"));
  assert.ok(esports.includes("set('opRemTradeWhen',lanePlan.trade)"));
});


test('live roster repairs Riot NONE role and server resolves the real player lane',()=>{
  assert.ok(esports.includes("['NONE','UNKNOWN','UNSELECTED','INVALID'].includes(raw)"));
  assert.ok(esports.includes('STRONG_ADC_PRIOR'));
  assert.ok(esports.includes("const repairedMe=ours.find"));
  assert.ok(draftCoach.includes('resolvePlayerRole'));
  assert.ok(draftCoach.includes('normalizeTeamAroundPlayer'));
  assert.ok(draftCoach.includes('laneOpponentsFor'));
  assert.ok(draftCoach.includes('profileRole:context.profileRole'));
  assert.ok(draftCoach.includes('gameMode:input.gameMode'));
  assert.ok(liveRoster.includes('gameMode:String(data?.gameData?.gameMode'));
  assert.ok(liveRoster.includes('summonerSpells:spellNames(player)'));
});

test('failed draft-coach requests are throttled per roster instead of flooding the paid endpoint',()=>{
  assert.ok(esports.includes('lastCoachAttemptSignature'));
  assert.ok(esports.includes('now-lastCoachAttemptAt<30000'));
  assert.ok(esports.includes('lastCoachAttemptSignature=signature'));
});


test('bot-lane coach renders both lane opponents and resolved server role',()=>{
  assert.ok(esports.includes("laneOpponents.join(' + ')"));
  assert.ok(esports.includes("const resolvedRole=normRole(response?.player?.role)||userRole"));
  assert.ok(esports.includes("enrichedCoach.laneOpponents=response.player.laneOpponents"));
  assert.ok(draftCoach.includes('resolvedLanePlan'));
  assert.ok(draftCoach.includes("For ADC/SUPPORT, treat the lane as a DUO matchup"));
  assert.ok(draftCoach.includes("SURVIVE FIRST DIVE → FREE-HIT"));
  assert.ok(draftCoach.includes("TARGET ACCESSIBILITY BEATS TARGET PRESTIGE"));
});


test('draft coach model returns an immutable frozen branch playbook',()=>{
  assert.ok(draftCoach.includes("buildFrozenGamePlaybook"));
  assert.ok(draftCoach.includes("const playbook=buildFrozenGamePlaybook"));
  assert.ok(draftCoach.includes("playbookPolicy:{"));
  assert.ok(draftCoach.includes("frozenFromPregame:true"));
  assert.ok(draftCoach.includes("usesLiveTelemetry:false"));
  assert.ok(draftCoach.includes("playerSelectsBranch:true"));
  assert.ok(draftCoach.includes("branches:['AHEAD','EVEN','BEHIND']"));
  assert.ok(draftCoach.includes("checkpoints:[5,10,15]"));
  assert.ok(draftCoach.includes("The PLAYER will choose the matching prewritten branch"));
});
