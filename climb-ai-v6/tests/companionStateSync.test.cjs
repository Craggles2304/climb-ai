const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const runtime=fs.readFileSync('companion/src/main.mjs','utf8');
const desktop=fs.readFileSync('companion/electron/main.cjs','utf8');

test('tracker publishes structured state transitions and recurring heartbeats',()=>{
  assert.ok(runtime.includes("const TRACKER_STATE_PREFIX='OP_TRACKER_STATE '"));
  assert.ok(runtime.includes('emitTrackerState(next,message)'));
  assert.ok(runtime.includes('emitTrackerState(heartbeatState,heartbeatDetail)'));
  assert.ok(runtime.includes("const RUNTIME_VERSION='2026.09.24.1'"));
});

test('desktop consumes authoritative tracker state instead of relying only on prose logs',()=>{
  assert.ok(desktop.includes("const TRACKER_STATE_PREFIX='OP_TRACKER_STATE '"));
  assert.ok(desktop.includes('function applyTrackerState(raw)'));
  assert.ok(desktop.includes("if(next==='RECORDING')return setState({phase:'RECORDING'"));
  assert.ok(desktop.includes("if(next==='CHAMP_SELECT')return setState({phase:'CHAMP_SELECT'"));
  assert.ok(desktop.includes("if(next==='WAITING'||next==='LCU_UNAVAILABLE')"));
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
