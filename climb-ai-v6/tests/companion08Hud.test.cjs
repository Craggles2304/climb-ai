const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const main=fs.readFileSync('companion/electron/main.cjs','utf8');
const renderer=fs.readFileSync('companion/electron/renderer.js','utf8');
const preload=fs.readFileSync('companion/electron/preload.cjs','utf8');
const tracker=fs.readFileSync('companion/src/main.mjs','utf8');
const route=fs.readFileSync('app/api/live/champion-plan/route-core.ts','utf8');
const packageConfig=JSON.parse(fs.readFileSync('companion/package.json','utf8'));

test('Companion keeps its main window and an optional click-through learning-only HUD',()=>{
  assert.ok(main.includes("mainWindow=new BrowserWindow("));
  assert.ok(main.includes("createWindow(!hidden)"));
  assert.ok(main.includes("createOverlayWindow()"));
  assert.ok(main.includes("setIgnoreMouseEvents(!overlayEditing,{forward:true})"));
  assert.ok(main.includes("overlayEnabled:raw.overlayEnabled===true"));
  assert.equal(main.includes("setAlwaysOnTop(true,'screen-saver')"),false);
  for(const file of ['overlay.html','overlay.css'])assert.equal(fs.existsSync(`companion/electron/${file}`),false);
  assert.ok(packageConfig.build.files.includes('!electron/overlay.js'));
});

test('tracking and marked moments remain available in the main window',()=>{
  assert.ok(main.includes('startTracker()'));
  assert.ok(main.includes("CommandOrControl+Shift+M"));
  assert.ok(main.includes("ipcMain.handle('companion:mark-moment'"));
  assert.ok(preload.includes("markMoment:()=>ipcRenderer.invoke('companion:mark-moment')"));
  assert.ok(renderer.includes('id="markMoment"'));
  assert.ok(renderer.includes('Moment marked for your post-game review.'));
  assert.ok(main.includes('marked-moments.json'));
  assert.ok(tracker.includes('markedMoments:readLocalMarkedMoments(finished.id)'));
  assert.equal(tracker.includes("type:'SNAPSHOT'"),false);
});

test('locked pregame builds remain draft-based',()=>{
  assert.ok(route.includes('snapshot:null'));
  assert.ok(route.includes('buildAdaptiveItemPlan({'));
  assert.ok(route.includes('popularItems:popular?.items??null'));
  assert.ok(route.includes('popularSource:popular?'));
  assert.ok(main.includes("return state.phase==='CHAMP_SELECT'||needsRecordingPlanRecovery()"));
  assert.ok(main.includes("if(!state.teamPlan?.adaptiveBuild)return true"));
});
