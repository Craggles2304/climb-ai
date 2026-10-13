const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=(file)=>fs.readFileSync(file,'utf8');
const missions=read('app/missions/page.tsx');
const dashboard=read('app/dashboard/page.tsx');
const css=read('app/mission-clarity.css');

test('Missions has one clear next action before the two next-game instructions',()=>{
 assert.ok(missions.indexOf('className="mission-next-action"')>0);
 assert.ok(missions.indexOf('className="mission-next-action"')<missions.indexOf('className="missions-active-strip"'));
 assert.match(missions,/YOUR NEXT STEP/);
 assert.match(missions,/DO THIS IN YOUR NEXT GAME/);
 assert.match(missions,/HOW PROGRESS IS CHECKED/);
 assert.match(missions,/plain\?\.nextGame/);
 assert.match(missions,/plain\?\.success/);
});

test('No made-up mission progress or premature mission activation',()=>{
 assert.match(missions,/playerConfirmed\?'YOUR TWO MISSIONS FOR NEXT GAME':'THESE ARE YOUR TWO SUGGESTED MISSIONS'/);
 assert.match(missions,/YES — CONFIRM THESE TWO/);
 assert.match(missions,/disabled=\{saving\|\|persistedDomains.length!==2\}/);
 assert.match(missions,/proof\?proof.confirmed/);
 assert.match(missions,/NOT OBSERVED/);
 assert.match(missions,/COULD NOT SAVE|Could not save/);
});

test('Advanced trees and diagnostics stay accessible, not mandatory',()=>{
 assert.match(missions,/aria-expanded=\{showAllTrees\}/);
 assert.match(missions,/\{showAllTrees&&<>/);
 assert.match(missions,/VIEW ALL 6 DNA AREAS/);
 assert.match(missions,/mission-advanced-check/);
 assert.match(missions,/MissionFlowVerification/);
 assert.match(missions,/mission-focus-detail/);
});

test('After-match instructions explain verified, missed and unobserved game evidence',()=>{
 assert.match(missions,/AFTER YOUR NEXT TRACKED GAME/);
 assert.match(missions,/<b>PROVEN<\/b>/);
 assert.match(missions,/<b>MISSED<\/b>/);
 assert.match(missions,/<b>NOT OBSERVED<\/b>/);
 assert.match(missions,/next challenge/);
});

test('Dashboard shows one next move before charts and Game DNA',()=>{
 assert.ok(dashboard.indexOf('className="op-next-step arena-mission-first-next"')>0);
 assert.ok(dashboard.indexOf('className="op-next-step arena-mission-first-next"')<dashboard.indexOf('<div id="arena-perf">'));
 assert.match(dashboard,/SEE BOTH MISSIONS AND WHAT TO DO NEXT/);
});

test('Mobile styles retain mission instructions and reduced clutter',()=>{
 assert.match(css,/@media\(max-width:640px\)/);
 assert.match(css,/mission-next-steps/);
 assert.match(css,/mission-active-instruction/);
 assert.match(css,/mission-advanced-check/);
});
