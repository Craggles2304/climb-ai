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
const proLearning=fs.readFileSync(path.join(root,'lib','server','proLearningRepository.ts'),'utf8');

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


test('Companion exposes frozen player-selected AHEAD EVEN BEHIND branches with coach trust status',()=>{
  assert.ok(esports.includes('FROZEN GAME PLAN · YOU PICK THE GAME STATE'));
  assert.ok(esports.includes('data-op-branch="AHEAD"'));
  assert.ok(esports.includes('data-op-branch="EVEN"'));
  assert.ok(esports.includes('data-op-branch="BEHIND"'));
  assert.ok(esports.includes("selectedBranch='EVEN'"));
  assert.ok(esports.includes('renderSelectedBranch'));
  assert.ok(esports.includes('PLAYER-SELECTED BRANCH · NEVER AUTO-CHANGED BY LIVE TELEMETRY'));
  assert.ok(esports.includes("enrichedCoach._playbook=response?.playbook||null"));
  assert.ok(esports.includes("enrichedCoach._coachSource=clean(response?.source)||'rules'"));
  assert.ok(esports.includes("enrichedCoach._coachQuality=response?.coachQuality||null"));
  assert.ok(esports.includes('DEEP VERIFIED'));
  assert.ok(esports.includes('SAFE LOCAL PLAN'));
  assert.ok(esports.includes('renderSelfChecks(playbook)'));
});


test('verified deep coach plan is persisted for the post-game debrief without using live telemetry',()=>{
  assert.ok(esports.includes("DEEP_PLAN_STORAGE_KEY='opclimb.deep-locked-plan.v1'"));
  assert.ok(esports.includes('function persistDeepLockedPlan'));
  assert.ok(esports.includes('function persistBranchSelection'));
  assert.ok(esports.includes("source:'PLAYER_CLICK'"));
  assert.ok(esports.includes('persistDeepLockedPlan(lastCoach,champion,resolvedRole)'));
  assert.ok(esports.includes('draftFingerprint:clean(coach._playbook.draftFingerprint)'));
  assert.ok(esports.includes('branchSelections:'));
  assert.ok(!esports.includes('goldDiff'));
  assert.ok(!esports.includes('killDiff'));
});


test('deep-coach failures degrade visibly to a safe local plan instead of failing silently',()=>{
  assert.ok(main.includes("'RATE_LIMIT'"));
  assert.ok(main.includes("'QUALITY_GATE'"));
  assert.ok(main.includes("'ENTITLEMENT'"));
  assert.ok(main.includes("code:timeoutError?'TIMEOUT':'NETWORK'"));
  assert.ok(main.includes('retryAfterSeconds'));
  assert.ok(esports.includes('QUALITY GATE · SAFE PLAN'));
  assert.ok(esports.includes('COACH BUSY · SAFE PLAN'));
  assert.ok(esports.includes('PLUS / PRO REQUIRED'));
  assert.ok(esports.includes('RE-PAIR REQUIRED'));
  assert.ok(esports.includes('OFFLINE · SAFE PLAN'));
  assert.ok(esports.includes('DEEP COACH CHECKING…'));
  assert.ok(esports.includes("failure:{"));
  assert.ok(esports.includes("Deep coach unavailable. Using the safe local plan."));
});


test('Decision Twin Personal Trap is shown only from server-verified repeated evidence',()=>{
  assert.ok(draftCoach.includes('selectPersonalTrap'));
  assert.ok(draftCoach.includes('PERSONAL TRAP EVIDENCE'));
  assert.ok(draftCoach.includes("status READY"));
  assert.ok(draftCoach.includes('personalTrap,'));
  assert.ok(proLearning.includes('buildDecisionTwin'));
  assert.ok(proLearning.includes('learning_identity:decisionTwin'));
  assert.ok(proLearning.includes('mastered_behaviours:decisionTwin.mastered'));
  assert.ok(proLearning.includes('current_focus:decisionTwin.currentLimiter'));
  assert.ok(esports.includes('DECISION TWIN'));
  assert.ok(esports.includes('YOUR PERSONAL TRAP'));
  assert.ok(esports.includes('NO PERSONAL CLAIM WITHOUT ENOUGH EVIDENCE'));
  assert.ok(esports.includes('function renderPersonalTrap'));
  assert.ok(esports.includes("status==='READY'"));
  assert.ok(esports.includes("enrichedCoach._personalTrap=response?.personalTrap||null"));
  assert.ok(esports.includes("personalTrap:coach?._personalTrap||null"));
  assert.ok(esports.includes('NO VERIFIED PERSONAL TRAP'));
  assert.ok(esports.includes('BUILDING YOUR DECISION TWIN'));
});


test('Personal Trap can promote a verified recurring situation instead of only an aggregate weakness',()=>{
  assert.ok(esports.includes("SITUATION_PATTERN"));
  assert.ok(esports.includes("YOU'VE SEEN THIS DECISION BEFORE"));
  assert.ok(esports.includes("clean(trap?.proof)"));
  assert.ok(draftCoach.includes('buildDraftSituationContext'));
  assert.ok(draftCoach.includes('situationContext,'));
});


test('Personal Trap UI distinguishes learned, improving and regressing recurring patterns',()=>{
  assert.ok(esports.includes("status==='MASTERED'"));
  assert.ok(esports.includes("THIS USED TO CATCH YOU"));
  assert.ok(esports.includes("SITUATION_PATTERN"));
  assert.ok(esports.includes("root.classList.toggle('mastered',mastered)"));
  assert.ok(draftCoach.includes('MASTERED is proof of learning'));
  assert.ok(draftCoach.includes('do not re-teach it'));
  assert.ok(proLearning.includes('situationImproving'));
  assert.ok(proLearning.includes('situationMastered'));
  assert.ok(proLearning.includes('situationRegressing'));
});


test('future Personal Traps can include verified after-cue execution history',()=>{
  assert.ok(proLearning.includes('strongestCoachingResponse'));
  assert.ok(draftCoach.includes('personalTrap'));
  assert.ok(esports.includes('clean(trap?.proof)'));
});


test('Decision Pre-Mortem freezes evidence-backed personal risk windows into the player-selected plan',()=>{
  assert.ok(draftCoach.includes('buildDecisionPremortem'));
  assert.ok(draftCoach.includes('DECISION PRE-MORTEM'));
  assert.ok(draftCoach.includes('decisionPremortem,'));
  assert.ok(esports.includes('DECISION PRE-MORTEM'));
  assert.ok(esports.includes('function renderDecisionPremortem'));
  assert.ok(esports.includes('PRIORITY ≠ PROBABILITY'));
  assert.ok(esports.includes("enrichedCoach._decisionPremortem=response?.decisionPremortem"));
  assert.ok(esports.includes('decisionPremortem:coach?._decisionPremortem'));
  assert.ok(esports.includes("branch.decisionRisk"));
  assert.ok(esports.includes('PERSONAL RISK RULE'));
});


test('Companion path navigation is allowlisted before opening the web Learning Journey',()=>{
  assert.ok(preload.includes("openClimbPath:(path)=>ipcRenderer.invoke('companion:open-climb-path',path)"));
  assert.ok(main.includes("new Set(['/live','/progress','/ilp'])"));
  assert.ok(main.includes("safePaths.has(String(path||''))?String(path):'/live'"));
});
