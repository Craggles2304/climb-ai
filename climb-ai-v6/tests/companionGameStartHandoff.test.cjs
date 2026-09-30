const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

/*
 * The moment a game starts is where the Companion used to lose the plan.
 *
 * Between champ select ending and League's Live Client answering, the tracker
 * has no match session. Its heartbeat was derived only from its own variables,
 * so it reported WAITING while a game was loading or running. The desktop app
 * reads WAITING-while-recording as "match finished", so it flipped
 * RECORDING <-> UPLOADING every half second and started post-game review polls
 * for a game that had not begun, and the server — which only restores a draft
 * plan for a tracker it believes is RECORDING — never saw RECORDING.
 *
 * These tests run the shipped logic rather than asserting on strings where they
 * can: the pure helpers are imported, and the desktop's real applyTrackerState
 * is cut out of main.cjs and executed.
 */

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const tracker=read('companion/src/main.mjs');
const desktop=read('companion/electron/main.cjs');
const statusRoute=read('app/api/live/status/route.ts');

let helpers;
test.before(async()=>{
  helpers=await import(pathToFileURL(path.join(root,'companion/src/in-game-recovery.mjs')).href);
});

/* ---------------------------------------------------------------- helpers -- */

test('the loading screen and a running match both count as a game being active',()=>{
  for(const phase of ['GameStart','InProgress','Reconnect'])
    assert.equal(helpers.isGameActivePhase(phase),true,phase);
});

test('lobby, queue, champ select and end-of-game do not',()=>{
  for(const phase of ['None','Lobby','Matchmaking','ReadyCheck','ChampSelect','WaitingForStats','PreEndOfGame','EndOfGame','',undefined,null])
    assert.equal(helpers.isGameActivePhase(phase),false,String(phase));
});

test('a stale gameflow reading is not trusted',()=>{
  // If the League client closes after a match, the last phase seen is
  // InProgress forever. Trusting it would make the tracker claim to be
  // recording indefinitely.
  const now=1_000_000;
  const fresh=helpers.gameActiveNow({gameflow:'InProgress',gameflowSeenAt:now-2_000,now});
  const stale=helpers.gameActiveNow({gameflow:'InProgress',gameflowSeenAt:now-(helpers.GAMEFLOW_FRESH_MS+1),now});
  assert.equal(fresh,true);
  assert.equal(stale,false);
});

test('a reading that has never happened is not active',()=>{
  assert.equal(helpers.gameActiveNow({gameflow:'InProgress',gameflowSeenAt:0,now:Date.now()}),false);
  assert.equal(helpers.gameActiveNow({gameflow:'InProgress',gameflowSeenAt:undefined,now:Date.now()}),false);
});

const beat=over=>helpers.trackerHeartbeatState({
  hasSession:false,gameActive:false,hasPregame:false,lcuDetected:true,...over,
});

test('THE BUG: a running match with no session yet reports RECORDING, not WAITING',()=>{
  assert.equal(beat({gameActive:true}),'RECORDING');
});

test('a loading screen that still holds the draft reports RECORDING, not CHAMP_SELECT',()=>{
  // The draft is about to be closed. Reporting CHAMP_SELECT here would keep the
  // desktop app in champ select right up to the moment the server forgets it.
  assert.equal(beat({gameActive:true,hasPregame:true}),'RECORDING');
});

test('the ordinary states are unchanged',()=>{
  assert.equal(beat({hasSession:true}),'RECORDING');
  assert.equal(beat({hasPregame:true}),'CHAMP_SELECT');
  assert.equal(beat({}),'WAITING');
  assert.equal(beat({lcuDetected:false}),'LCU_UNAVAILABLE');
});

test('every state the tracker can report is one the server accepts',()=>{
  // An older server keeps working with a newer tracker only if nothing new is
  // invented. GAME_STARTING is deliberately NOT reported to the server.
  const enumBody=/state:z\.enum\(\[([^\]]+)\]\)/.exec(statusRoute);
  assert.ok(enumBody,'could not find the heartbeat state enum in the status route');
  const accepted=new Set([...enumBody[1].matchAll(/'([A-Z_]+)'/g)].map(m=>m[1]));
  const seen=new Set();
  for(const hasSession of [true,false])for(const gameActive of [true,false])
    for(const hasPregame of [true,false])for(const lcuDetected of [true,false])
      seen.add(beat({hasSession,gameActive,hasPregame,lcuDetected}));
  for(const state of seen)assert.ok(accepted.has(state),`${state} would be rejected by the server`);
  assert.ok(!accepted.has('GAME_STARTING'),'if the server learns GAME_STARTING, revisit this test');
});

/* -------------------------------------------- the desktop's real behaviour -- */

/**
 * Runs the desktop's REAL applyTrackerState against a sequence of tracker
 * states. The function is cut out of main.cjs by brace matching and executed
 * with just the state it needs, so this exercises the shipped code rather than a
 * re-typing of it.
 */
function desktopPhaseLog(sequence){
  const start=desktop.indexOf('function applyTrackerState(raw){');
  assert.notEqual(start,-1,'applyTrackerState must exist');
  let depth=0,end=-1;
  for(let i=desktop.indexOf('{',start);i<desktop.length;i++){
    if(desktop[i]==='{')depth++;
    else if(desktop[i]==='}'){depth--;if(depth===0){end=i+1;break}}
  }
  const source=desktop.slice(start,end);

  let reviewPolls=0;
  const prelude=[
    "let state={phase:'CHAMP_SELECT',matchup:{status:'READY'},teamPlan:{adaptiveBuild:{}}};",
    'const phases=[state.phase];',
    'let lastLocalChampSelectAt=0;',
    'const setState=patch=>{',
    '  state={...state,...patch};',
    '  if(patch.phase&&phases[phases.length-1]!==patch.phase)phases.push(patch.phase);',
    '};',
  ].join('\n');
  const drive=[
    'for(const s of sequence)applyTrackerState({state:s,detail:s},"LOCAL");',
    'return {phases,state};',
  ].join('\n');
  const driver=new Function('sequence','startPostGameReviewPoll',[prelude,source,drive].join('\n'));
  const result=driver(sequence,()=>{reviewPolls++});
  return {phases:result.phases,state:result.state,reviewPolls};
}

test('the OLD tracker sequence flips the desktop between RECORDING and UPLOADING',()=>{
  // Recorded from the real tracker before the fix. Kept to pin WHY the tracker
  // must never say WAITING during a game: the desktop deliberately treats
  // WAITING-while-recording as match end, which is how it self-heals a missed
  // end-of-match log.
  const old=['CHAMP_SELECT','WAITING','GAME_STARTING','GAME_STARTING','WAITING','GAME_STARTING','GAME_STARTING','WAITING','RECORDING'];
  const {phases,reviewPolls}=desktopPhaseLog(old);
  assert.ok(phases.filter(p=>p==='UPLOADING').length>=2,`expected repeated UPLOADING, got ${phases.join(' > ')}`);
  assert.ok(reviewPolls>=2,'and it starts post-game review polls for a game that has not begun');
});

test('the NEW tracker sequence moves the desktop from champ select to RECORDING once',()=>{
  const fixed=['CHAMP_SELECT','GAME_STARTING','RECORDING','GAME_STARTING','GAME_STARTING','RECORDING','GAME_STARTING','GAME_STARTING','RECORDING','RECORDING'];
  const {phases,state,reviewPolls}=desktopPhaseLog(fixed);
  assert.deepEqual(phases,['CHAMP_SELECT','RECORDING'],`got ${phases.join(' > ')}`);
  assert.equal(reviewPolls,0,'no review polls while the match is running');
  assert.ok(state.teamPlan,'and the plan it was holding is kept');
});

/* ---------------------------------------- the tracker's wiring, in order ---- */

const body=name=>{
  const start=tracker.indexOf(`async function ${name}(`);
  assert.notEqual(start,-1,`${name} must exist`);
  let depth=0,end=-1;
  for(let i=tracker.indexOf('{',start);i<tracker.length;i++){
    if(tracker[i]==='{')depth++;
    else if(tracker[i]==='}'){depth--;if(depth===0){end=i+1;break}}
  }
  return tracker.slice(start,end);
};

test('the desktop is told the match is starting BEFORE the server is told the draft ended',()=>{
  // Closing the draft makes the server forget it. If the desktop is still in
  // CHAMP_SELECT then, its next plan poll reads "not ready" and discards the
  // plan it was holding.
  const finish=body('finishPregame');
  const starting=finish.indexOf("emitTrackerState('GAME_STARTING'");
  const ending=finish.indexOf("type:'PREGAME_END'");
  assert.ok(starting>-1,'finishPregame must announce GAME_STARTING');
  assert.ok(ending>-1);
  assert.ok(starting<ending,'GAME_STARTING must be emitted before PREGAME_END is uploaded');
});

test('finishing the draft at game start says nothing the desktop reads as WAITING',()=>{
  // The desktop also parses log TEXT, and "waiting for the match" moves it to
  // WAITING, undoing the GAME_STARTING above.
  const finish=body('finishPregame');
  assert.match(finish,/if\(!quiet&&!gameStarting\)logState\('WAITING'/);
});

test('champ select only counts as over after the game phase has been re-read',()=>{
  const poll=body('pollPregame');
  const refresh=poll.indexOf('await pollGameflow(true)');
  const miss=poll.indexOf('pregameMisses+=1');
  assert.ok(refresh>-1,'gameflow must be refreshed before a champ-select miss is counted');
  assert.ok(refresh<miss,'and that must happen before the miss is counted');
});

test('the loading screen no longer falls through to the WAITING log in tick',()=>{
  const tick=body('tick');
  assert.ok(tick.includes('isGameActivePhase(gameflow)'),'tick must use the shared definition');
  assert.ok(!/else if\(gameflow==='InProgress'\|\|gameflow==='Reconnect'\)\{\s*emitTrackerState\('GAME_STARTING'/.test(tick),
    'the narrow InProgress/Reconnect-only check must be gone from the no-telemetry branch');
});

test('the heartbeat uses the shared state function instead of its own ternary',()=>{
  const post=body('postStatus');
  assert.ok(post.includes('trackerHeartbeatState('));
  assert.ok(post.includes('gameActiveNow('));
  assert.ok(!post.includes("session?'RECORDING':pregame?'CHAMP_SELECT'"),'the old local-only ternary must be gone');
});

test('the gameflow reading is timestamped so a stale one can be ignored',()=>{
  assert.ok(tracker.includes('let lastGameflowOkAt=0'));
  assert.ok(/lastGameflowOkAt=Date\.now\(\)/.test(body('pollGameflow')));
});

test('the new helpers ship inside the installer with the tracker',()=>{
  // They live in in-game-recovery.mjs precisely because that file is already
  // packaged. A new file would need adding to extraResources or the packaged
  // tracker would crash on import.
  const pkg=JSON.parse(read('companion/package.json'));
  assert.ok(pkg.build.extraResources.some(r=>r.from==='src/in-game-recovery.mjs'&&r.to==='tracker/in-game-recovery.mjs'));
  assert.match(tracker,/from '\.\/in-game-recovery\.mjs'/);
});
