const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const main=fs.readFileSync('companion/electron/main.cjs','utf8');
const preload=fs.readFileSync('companion/electron/preload.cjs','utf8');
const overlay=fs.readFileSync('companion/electron/overlay.js','utf8');
const overlayHtml=fs.readFileSync('companion/electron/overlay.html','utf8');
const tracker=fs.readFileSync('companion/src/main.mjs','utf8');
const route=fs.readFileSync('app/api/live/champion-plan/route-core.ts','utf8');

test('Companion 0.8 owns an always-on-top resizable HUD',()=>{
  assert.ok(main.includes('alwaysOnTop:true'));
  assert.ok(main.includes('resizable:true'));
  assert.ok(main.includes("setAlwaysOnTop(true,'screen-saver')"));
  assert.ok(main.includes('setIgnoreMouseEvents'));
  assert.ok(main.includes('overlayBounds'));
  assert.ok(overlayHtml.includes('LOCKED BUILD PATHS'));
});

test('HUD supports click-through and mark-moment hotkeys',()=>{
  assert.ok(main.includes("CommandOrControl+Shift+M"));
  assert.ok(main.includes("CommandOrControl+Shift+O"));
  assert.ok(preload.includes("companion:mark-moment"));
  assert.ok(preload.includes("companion:toggle-click-through"));
  assert.ok(overlay.includes('markMoment()'));
  assert.ok(overlayHtml.includes('MARK THIS MOMENT'));
});

test('marked moments stay local until the final compact match bundle',()=>{
  assert.ok(main.includes('marked-moments.json'));
  assert.ok(tracker.includes('markedMoments:readLocalMarkedMoments(finished.id)'));
  assert.equal(tracker.includes("type:'SNAPSHOT'"),false);
});

test('build recommendation freezes from champ-select/static inputs',()=>{
  assert.ok(route.includes('snapshot:null'));
  assert.ok(route.includes('buildAdaptiveItemPlan({patch,you,role,allies:alliesForBuild,enemies:enemiesForBuild,items})'));
  assert.ok(main.includes("return state.phase==='CHAMP_SELECT'||needsRecordingPlanRecovery()"));
  assert.ok(main.includes("if(!state.teamPlan?.adaptiveBuild)return true"));
  assert.ok(overlayHtml.includes('STATIC FROM CHAMP SELECT'));
  assert.equal(overlay.includes('currentGold'),false);
  assert.equal(overlay.includes('enemy items'),false);
});
