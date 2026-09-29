const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('update controls remain reachable from the waiting champion page',()=>{
  const html=fs.readFileSync('companion/electron/index.html','utf8');
  const renderer=fs.readFileSync('companion/electron/renderer.js','utf8');
  const arena=fs.readFileSync('companion/electron/arena.js','utf8');
  const header=html.indexOf('id="headerUpdates"');
  assert.ok(header>html.indexOf('<header')&&header<html.indexOf('</header>'));
  assert.ok(html.includes('href="header-updates.css"'));
  assert.ok(renderer.includes("bind('headerUpdates','click'"));
  assert.ok(renderer.includes("$('settings')?.scrollIntoView"));
  assert.ok(renderer.includes('setHidden(settings,!settingsOpen)'));
  assert.ok(arena.includes("$('idleSettings')?.addEventListener('click',()=>$('headerUpdates')?.click())"));
  assert.ok(!arena.includes("settings.classList.add('broadcast-settings')"));
});
