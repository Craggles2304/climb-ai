const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const runtime=fs.readFileSync('companion/src/main.mjs','utf8');
const desktop=fs.readFileSync('companion/electron/main.cjs','utf8');
const statusRoute=fs.readFileSync('app/api/live/status/route.ts','utf8');
const championPlanRoute=fs.readFileSync('app/api/live/champion-plan/route-core.ts','utf8');

test('tracker publishes state transitions and renews steady state heartbeats',()=>{
  assert.ok(runtime.includes("const TRACKER_STATE_PREFIX='OP_TRACKER_STATE '"));
  assert.ok(runtime.includes('emitTrackerState(next,message)'));
  assert.ok(runtime.includes('emitTrackerState(heartbeatState,heartbeatDetail)'));
  assert.match(runtime,/const RUNTIME_VERSION='\d{4}\.\d{2}\.\d{2}\.\d+';/);
  assert.ok(runtime.includes("let lastStatusSignature=''"));
  assert.ok(runtime.includes('Date.now()-lastStatusUploadAt<HEARTBEAT_MS'));
  assert.ok(runtime.includes('lastStatusUploadAt=Date.now()'));
  assert.ok(runtime.includes('void postStatus().catch(()=>{})'));
  assert.ok(statusRoute.includes('const STATUS_KEEPALIVE_MS=10_000'));
});

test('a missed draft can recover a full in-game plan from the live roster',()=>{
  assert.ok(runtime.includes("clientPregameId:session.id,startedAt:session.startedAt,context"));
  assert.ok(runtime.includes("type:'PREGAME_END',clientPregameId:finished.id"));
  assert.ok(runtime.includes('await recoverInGamePlan(snapshot)'));
  assert.ok(desktop.includes('scheduleChampionPlanPoll(Math.max(nextPollDelay,1600))'));
  assert.ok(packageJson.build.extraResources.some(resource=>resource.to==='tracker/in-game-recovery.mjs'));
});

test('desktop consumes authoritative tracker state instead of relying only on prose logs',()=>{
  assert.ok(desktop.includes("const TRACKER_STATE_PREFIX='OP_TRACKER_STATE '"));
  assert.ok(desktop.includes('function applyTrackerState(raw)'));
  assert.ok(desktop.includes("if(next==='RECORDING')return setState({phase:'RECORDING'"));
  assert.ok(desktop.includes("if(next==='CHAMP_SELECT'){"));
  assert.ok(desktop.includes("if(origin==='LOCAL')lastLocalChampSelectAt=Date.now()"));
  assert.ok(desktop.includes("if(next==='WAITING'||next==='LCU_UNAVAILABLE')"));
  assert.ok(desktop.includes("Date.now()-lastLocalChampSelectAt<15_000"));
});


test('auth rejection is sticky until the Companion is explicitly paired again',()=>{
  assert.ok(desktop.includes('let pairingAuthInvalid=false'));
  assert.ok(desktop.includes("if(requestedPhase==='AUTH_ERROR')pairingAuthInvalid=true"));
  assert.ok(desktop.includes("!['AUTH_ERROR','SETUP','STARTING'].includes(requestedPhase)"));
  assert.ok(desktop.includes("phase:'AUTH_ERROR',detail:'This PC pairing is no longer valid. Re-pair from OP CLIMB.'"));
  assert.ok(desktop.includes('pairingAuthInvalid=false;'));
});

test('desktop self-heals match end when a prose end log is missed',()=>{
  assert.ok(desktop.includes("if(state.phase==='RECORDING'){"));
  assert.ok(desktop.includes("setState({phase:'UPLOADING'"));
  assert.ok(desktop.includes('startPostGameReviewPoll();return;'));
});

test('tracker stdout and stderr are line-buffered so split chunks cannot lose state messages',()=>{
  assert.ok(desktop.includes('function bindTrackerStream(stream,kind)'));
  assert.ok(desktop.includes("const lines=buffer.split(/\\r?\\n/)"));
  assert.ok(desktop.includes("buffer=lines.pop()||''"));
  assert.ok(desktop.includes("bindTrackerStream(tracker.stdout,'info')"));
  assert.ok(desktop.includes("bindTrackerStream(tracker.stderr,'error')"));
});


const packageJson=JSON.parse(fs.readFileSync('companion/package.json','utf8'));

test('Windows tray uses the packaged OP CLIMB icon instead of relying on runtime SVG',()=>{
  assert.ok(desktop.includes("path.join(process.resourcesPath,'icon.ico')"));
  assert.ok(desktop.includes("path.join(__dirname,'..','build','icon.ico')"));
  assert.ok(desktop.includes('nativeImage.createFromPath(iconPath)'));
  const iconResource=(packageJson.build.extraResources||[]).find(resource=>resource.from==='build/icon.ico');
  assert.ok(iconResource);
  assert.equal(iconResource.to,'icon.ico');
});


const bootstrap=fs.readFileSync('companion/electron/bootstrap.cjs','utf8');
const indexHtml=fs.readFileSync('companion/electron/index.html','utf8');

test('Companion updater auto-downloads and checks frequently enough for active beta testing',()=>{
  assert.ok(bootstrap.includes('const CHECK_INTERVAL_MS=15*60*1000'));
  assert.ok(bootstrap.includes('autoUpdater.autoDownload=true'));
});

test('running Companion version is always visible in the shell sidebar',()=>{
  const shell=fs.readFileSync('companion/electron/shell.js','utf8');
  assert.ok(indexHtml.includes('id="ocVersion"'));
  assert.ok(shell.includes("$('ocVersion').textContent=version?`v${version}`:''"));
  assert.ok(desktop.includes("app.setAppUserModelId('com.opclimb.companion')"));
});


test('desktop reconciles live phase from the server heartbeat when local IPC goes stale',()=>{
  assert.ok(desktop.includes('async function reconcileTrackerStatus()'));
  assert.ok(desktop.includes("/api/live/status"));
  assert.ok(desktop.includes("applyTrackerState(remote,'SERVER')"));
  assert.ok(desktop.includes('age<=45_000'));
  assert.ok(desktop.includes('scheduleTrackerStatusReconcile(900)'));
});

test('server exposes tracker status to the paired Companion token',()=>{
  assert.ok(statusRoute.includes('const token=bearerToken(req)'));
  assert.ok(statusRoute.includes('authenticateTrackerToken(token)'));
  assert.ok(statusRoute.includes(".eq('id',device.id)"));
});

test('champion plan recovers from canonical live draft when the device mirror is stale',()=>{
  assert.ok(championPlanRoute.includes("trackerState==='CHAMP_SELECT'||!context"));
  assert.ok(championPlanRoute.includes("db.from('live_pregame_contexts')"));
  assert.ok(championPlanRoute.includes(".is('ended_at',null)"));
  assert.ok(championPlanRoute.includes('activeHasSelection&&!mirrorHasSelection'));
});
