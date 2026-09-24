const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const ilp=fs.readFileSync(path.join(root,'app','ilp','page.tsx'),'utf8');
const dashboard=fs.readFileSync(path.join(root,'app','dashboard','page.tsx'),'utf8');
const css=fs.readFileSync(path.join(root,'app','visual-depth.css'),'utf8');

test('development plan keeps one main focus and demotes the other four to background tracking',()=>{
  assert.ok(ilp.includes("activeTasks.slice(1)"));
  assert.ok(ilp.includes("OTHER HABITS WE&apos;RE WATCHING"));
  assert.ok(ilp.includes("You do not need to remember five instructions in game."));
  assert.ok(ilp.includes("vf-track-support-grid"));
  assert.ok(ilp.includes("plainLanguageFocus"));
});

test('supporting habit cards use readable coaching copy rather than micro rows',()=>{
  assert.ok(css.includes(".vf-track-support-grid"));
  assert.ok(css.includes("font-size:15px"));
  assert.ok(css.includes("min-height:238px"));
  assert.ok(css.includes(".vf-track-main h3"));
  assert.ok(css.includes(".vf-track-pass>span"));
});

test('dashboard is a visual coaching HQ instead of repeated generic cards',()=>{
  assert.ok(dashboard.includes("hq-command-v2"));
  assert.ok(dashboard.includes("hq-focus-visual"));
  assert.ok(dashboard.includes("BACKGROUND TRACKING"));
  assert.ok(dashboard.includes("hq-match-grid"));
  assert.ok(dashboard.includes("plainLanguageFocus"));
  assert.ok(css.includes(".hq-match-card"));
  assert.ok(css.includes(".hq-focus-visual"));
});
