'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const root=path.join(__dirname,'../companion/electron');
const vm=require('node:vm');
const source=file=>fs.readFileSync(path.join(root,file),'utf8');
// The Companion package uses ESM but this helper is a browser script.
// Execute in a browser-like VM so this test exercises the shipped global.
const browser={window:{}};
vm.runInNewContext(source('coach-brief.js'),browser);
const brief=browser.window.OPCoachBrief;

test('screenshot: ADC match move is a real instruction, not a chopped source paragraph',()=>{
 const raw='SURVIVE THE DIVE → DPS. Keep range, hit the nearest safe target and make their divers cross your team before they reach you.';
 assert.equal(brief.cue('MOVE',raw,'ADC'),'Keep your range. Hit the nearest safe target.');
});
test('screenshot: each match decision is short and actionable',()=>{
 const sourceRead=[
  ['WIN','CORE ITEMS + SAFE FARM WITHOUT MISSING OBJECTIVE SETUP → BLITZCRANK / WARWICK → KAYN / SAMIRA / URGOT'],
  ['AVOID','KAYN / SAMIRA / URGOT GETS ONTO YOU BEFORE BLITZCRANK / WARWICK CAN PEEL'],
  ['MISSION','Before you commit, check health, items, levels and the escape route. If the visible state is red, back away.'],
  ['STEP','PLAY BEHIND BLITZCRANK / WARWICK → SURVIVE KAYN / SAMIRA / URGOT → HIT THE NEAREST SAFE TARGET → WON FIGHT / PICK → DRAGON BARON OR TOWER'],
 ];
 for(const [kind,raw] of sourceRead){
  const output=brief.cue(kind,raw,'ADC');
  assert.ok(output.length<=86,`${kind} too long: ${output}`);
  assert.doesNotMatch(output,/\.\.\.|…|→/,`${kind} was truncated or chains too many steps`);
  assert.ok(/[.!]$/.test(output),`${kind} must be a complete instruction`);
 }
});
test('show the short cards, while detailed reports are opt-in and still retain source',()=>{
 const prep=source('draft-view.js');
 assert.match(prep,/brief\('MOVE',job,role\)/);
 assert.match(prep,/brief\('WIN',ourWin,role\)/);
 assert.match(prep,/brief\('AVOID',team\.biggestThrow/);
 assert.match(prep,/brief\('MISSION',mission\.title,role\)/);
 assert.match(prep,/brief\('STEP',a\.value,role\)/);
 assert.match(prep,/<details class="oc-full-plan">/);
 assert.doesNotMatch(prep,/<details class="oc-full-plan" open/);
 assert.match(prep,/\['Full win condition',ourWin\]/);
 assert.match(prep,/\['Full role instruction',job\]/);
 assert.match(prep,/\['Full sequence',a\.value\]/);
});
test('the learning overlay uses complete action sentences even in Expanded layout',()=>{
 const overlay=source('learning-overlay.js');
 assert.match(source('learning-overlay.html'),/<script src="coach-brief\.js"><\/script>/);
 assert.match(overlay,/window\.OPCoachBrief\?\.cue/);
 assert.match(overlay,/brief\('MISSION',plan\.mission\)/);
 assert.match(overlay,/brief\('STEP',x\)/);
 assert.match(source('index.html'),/<script src="coach-brief\.js"><\/script>/);
});
test('server WAITING does not hide a still-running League game; local end is debounced',()=>{
 const main=source('main.cjs');
 assert.match(main,/if\(origin==='SERVER'\)return;/);
 assert.match(main,/scheduleRecordingExit\('Match finished/);
 assert.match(main,/const initialHandoff=recordingStartedAt>0/);
 assert.match(main,/initialHandoff\?90000:RECORDING_END_GRACE_MS/);
 assert.match(main,/markRecordingAlive\(true\)/);
 assert.match(main,/startOverlayWatchdog\(\)/);
 assert.match(main,/setAlwaysOnTop\(true,'screen-saver'\)/);
 assert.match(main,/win\.showInactive\(\)/);
 assert.match(main,/if\(lower\.includes\('match recording closed'\)\)\{cancelRecordingExit\(\)/);
});

test('a tank played mid is coached as a tank, not a backline mage',()=>{
 // jobFor used to gate the tank branch to TOP/SUPPORT/JUNGLE, so Maokai mid
 // fell through to the mage branch and was told to preserve range.
 const plan=fs.readFileSync('lib/champions/teamCompPlan.ts','utf8');
 const tankAt=plan.indexOf("if(me.tags.includes('Tank'))return theirs.dive>=2");
 const adcAt=plan.indexOf("if(me.role==='ADC'||me.tags.includes('Marksman'))");
 assert.ok(tankAt>0&&adcAt>0,'both branches must exist');
 assert.ok(tankAt<adcAt,'tank is decided before role, so a tank mid stays a tank');
 assert.doesNotMatch(plan,/includes\('Tank'\)&&\(me\.role==='TOP'/,'the tank branch must not be gated by lane');
});

test('a cue keeps the plan it was given rather than the lane boilerplate',()=>{
 // Every rule missing meant every game read the same: the lane basic.
 assert.equal(brief.cue('MOVE','HOLD THE RIVER BUSH. Nothing else matters.','MID'),'Hold the river bush.');
 assert.equal(brief.cue('MOVE','CREATE FIRST CONTACT. Give your carries a safe front edge.','MID'),
  'Make first contact. Give your carries a safe front edge.');
 // Only an empty plan may fall back to the lane line.
 assert.equal(brief.cue('MOVE','','MID'),'Clear your wave safely. Move with your team.');
});

test('the explanation after the instruction cannot flip the cue',()=>{
 // "behind FRONTLINE" and "let FIRST CONTACT happen" used to match rules meant
 // for the opposite advice, because the whole paragraph was searched.
 assert.equal(brief.cue('MOVE','CONTROL THE SPACE BEHIND FRONTLINE. Preserve range, layer damage after engage.','MID'),
  'Control the space behind frontline.');
 assert.equal(brief.cue('MOVE','WAIT → ENTER SECOND. Let key control and first contact happen.','MID'),
  'Enter after first contact. Punish the isolated target.');
});
