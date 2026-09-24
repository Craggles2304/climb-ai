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


test('dashboard cannot regress to the legacy giant flex focus panel',()=>{
  assert.ok(css.includes('.hq-command-v2{'));
  assert.ok(css.includes('display:grid!important'));
  assert.ok(css.includes('min-height:0!important'));
  assert.ok(css.includes('padding:0!important'));
  assert.ok(dashboard.includes('hq-focus-champ-art'));
  assert.ok(dashboard.includes('hq-match-art'));
});

test('coach is a readable workspace rather than neon chat bubbles across the whole screen',()=>{
  const coach=fs.readFileSync(path.join(root,'app','coach','page.tsx'),'utf8');
  assert.ok(coach.includes('vf-coach-workspace'));
  assert.ok(coach.includes('vf-coach-context'));
  assert.ok(coach.includes('vf-coach-rail'));
  assert.ok(coach.includes('vf-coach-answer-copy'));
  assert.ok(css.includes('.vf-message.user'));
  assert.ok(css.includes('border-right:3px solid #b6f66b'));
  assert.ok(css.includes('.vf-message.ai'));
  assert.ok(css.includes('font-size:15px'));
  assert.ok(!coach.includes('collapseAt='));
});
