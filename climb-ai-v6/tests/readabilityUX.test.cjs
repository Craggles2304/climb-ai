const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const ilp=fs.readFileSync(path.join(root,'app','ilp','page.tsx'),'utf8');
const dashboard=fs.readFileSync(path.join(root,'app','dashboard','page.tsx'),'utf8');
const css=fs.readFileSync(path.join(root,'app','visual-depth.css'),'utf8');

test('development plan makes one Core mission dominant with exactly two Support missions',()=>{
  assert.ok(ilp.includes(".slice(0,3)"));
  assert.ok(ilp.includes('One core. Two support.'));
  assert.ok(ilp.includes("index===0?'CORE MISSION':'SUPPORT 0'+index"));
  assert.ok(ilp.includes('MissionMeasurementBadge'));
  assert.ok(css.includes('.ip-mission.primary{'));
  assert.ok(css.includes('grid-column:1/-1'));
});

test('mission cards explain the focus in readable plain language before deep evidence',()=>{
  assert.ok(ilp.includes('WHAT THIS MEANS'));
  assert.ok(ilp.includes('YOUR JOB NEXT GAME'));
  assert.ok(ilp.includes('HOW YOU PASS'));
  assert.ok(ilp.includes('BREAK IT DOWN'));
  assert.ok(css.includes('.ip-layman>p'));
  assert.ok(css.includes('font-size:12px'));
  assert.ok(css.includes('.ip-rule>b'));
  assert.ok(css.includes('font-size:13px'));
  assert.ok(css.includes('.ip-sidequests'));
});

test('dashboard shows the authoritative Core plus two Support plan',()=>{
  assert.ok(dashboard.includes('hq-game-missions'));
  assert.ok(dashboard.includes('One core. Two support.'));
  assert.ok(dashboard.includes(".slice(0,3)"));
  assert.ok(dashboard.includes("index===0?'CORE MISSION':'SUPPORT 0'+index"));
  assert.ok(dashboard.includes('plainLanguageFocus'));
  assert.ok(dashboard.includes('MissionMeasurementBadge'));
  assert.ok(css.includes('.hq-mission-card.is-core'));
});

test('dashboard hierarchy cannot regress to three equal-priority mission cards',()=>{
  assert.ok(dashboard.includes("index===0?'is-core':''"));
  assert.ok(css.includes('body[data-op-area="hq"] .hq-mission-card.is-core{'));
  assert.ok(css.includes('grid-column:1/-1'));
  assert.ok(css.includes('min-height:300px'));
  assert.ok(!dashboard.includes('hq-command-v2'));
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
