const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../companion/electron');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const main=read('main.cjs'),renderer=read('renderer.js'),preload=read('preload.cjs');
const overlay=read('learning-overlay.js'),html=read('learning-overlay.html');
const bridge=read('overlay-preload.cjs');

test('Overlay follows selected game monitor, not always primary display',()=>{
  assert.match(main,/getDisplayNearestPoint\(screen\.getCursorScreenPoint\(\)\)/);
  assert.match(main,/overlayDisplayId/);
  assert.match(main,/screen\.getAllDisplays\(\)/);
  assert.match(main,/setOverlayScreen\(cursorDisplay\(\)\)/);
  assert.match(main,/overlayWindow\.setBounds\(display\.bounds\)/);
  assert.doesNotMatch(main,/getPrimaryDisplay\(\)\.bounds;\s*const win=new BrowserWindow/);
});
test('The HUD stays click-through but raises above borderless game without injecting',()=>{
  assert.match(main,/setAlwaysOnTop\(true,'pop-up-menu'\)/);
  assert.match(main,/win\.moveTop\(\)/);
  assert.match(main,/win\.showInactive\(\)/);
  assert.match(main,/win\.setIgnoreMouseEvents\(!\(overlayEditing\|\|overlayAssistantOpen\|\|overlayBuildsOpen\),\{forward:true\}\)/);
  assert.doesNotMatch(main,/screen-saver/);
  assert.match(main,/Borderless in League/);
});
test('Interactive editing receives focus, with a preview when not in game',()=>{
  assert.match(main,/if\(!wasVisible\)win\.show\(\)/);
  assert.match(main,/if\(enteredInteraction\)win\.focus\(\)/);
  assert.match(main,/toggleOverlayEditor\(true\)/);
  assert.match(main,/function centerOverlayLayout/);
  assert.match(main,/function nudgeOverlayLayout/);
  assert.match(main,/ipcMain\.handle\('overlay:nudge'/);
  assert.match(main,/ipcMain\.handle\('companion:overlay-move-here'/);
  assert.match(preload,/moveOverlayHere/);
  assert.match(preload,/centerOverlay/);
  assert.match(bridge,/nudge:/);
  for(const id of ['hudMoveLeft','hudMoveRight','hudMoveUp','hudMoveDown','hudCentre']){
    assert.ok(html.includes(`id="${id}"`),`HUD ${id}`);
    assert.ok(overlay.includes(id),`handler for ${id}`);
  }
});
test('HUD will not snap back mid-drag when live tracker state updates',()=>{
  assert.match(overlay,/if\(!drag&&!resize\)layout=/);
  assert.match(overlay,/drag=\{x:event\.clientX/);
  assert.match(overlay,/layout\.x=clamp\(drag\.left\+/);
  assert.match(overlay,/window\.opOverlay\.saveLayout/);
  assert.match(overlay,/if\(state\?\.editing&&\['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'\]/);
  assert.match(renderer,/bind\('overlayMoveHere','click'/);
  assert.match(renderer,/bind\('overlayCenter','click'/);
  const settings=read('index.html');
  assert.match(settings,/League requires Borderless or Windowed/);
});
test('Only bounded overlay x and y are stored',()=>{
  const {safeLayout}=require(path.join(root,'overlay-model.cjs'));
  const p=safeLayout({x:5,y:-50,scale:90,opacity:-10});
  assert.ok(p.x>=0&&p.x<=.82);
  assert.ok(p.y>=.015&&p.y<=.75);
  assert.ok(p.scale<=1.35);
  assert.ok(p.opacity>=.68);
});
