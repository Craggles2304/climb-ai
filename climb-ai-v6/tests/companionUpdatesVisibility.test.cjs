const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('update controls remain reachable from every screen',()=>{
  const html=fs.readFileSync('companion/electron/index.html','utf8');
  const renderer=fs.readFileSync('companion/electron/renderer.js','utf8');
  const shell=fs.readFileSync('companion/electron/shell.js','utf8');
  const arena=fs.readFileSync('companion/electron/arena.js','utf8');
  // The shell header carries an update chip on every route, and opens Settings.
  const chip=html.indexOf('id="ocUpdateChip"');
  assert.ok(chip>html.indexOf('<header class="oc-header"')&&chip<html.indexOf('</header>'));
  assert.ok(html.includes('href="shell.css"'));
  assert.ok(shell.includes("$('ocUpdateChip').addEventListener('click',()=>go('settings'))"));
  assert.ok(shell.includes("['AVAILABLE','DOWNLOADING','READY'].includes(updateStatus)"));
  // Settings is its own route; the legacy section only needs a paired PC.
  assert.ok(shell.includes("{id:'settings',"));
  assert.ok(renderer.includes("setHidden($('settings'),!current?.paired)"));
  assert.ok(arena.includes("$('idleSettings')?.addEventListener('click',()=>window.ocShell?.go('settings'))"));
  assert.ok(!arena.includes("settings.classList.add('broadcast-settings')"));
});
