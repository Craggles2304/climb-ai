const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'../companion/electron');
const {freezeLeaguePlan,overlayView,safeLayout}=require(path.join(base,'overlay-model.cjs'));

test('overlay is opt-in; appears only for paired players in a match',()=>{
 const p={paired:true,phase:'RECORDING'};
 assert.equal(overlayView(p,{enabled:false}).show,false);
 assert.equal(overlayView({...p,paired:false},{enabled:true}).show,false);
 assert.equal(overlayView({...p,phase:'WAITING'},{enabled:true}).show,false);
 assert.equal(overlayView(p,{enabled:true}).game,'LOL');
 assert.equal(overlayView({...p,phase:'WAITING',tftRecorder:{state:'RECORDING'}},{enabled:true}).game,'TFT');
});
test('League overlay freezes a pre-game plan, excluding live enemy/telemetry data',()=>{
 const before={matchup:{champion:'Jinx',role:'ADC'},teamPlan:{ourWinCondition:'Scale as a team',biggestThrow:'Do not chase',missionTips:[{cue:'Safe teamfights'}]}};
 const locked=freezeLeaguePlan(before);
 before.teamPlan.ourWinCondition='CHANGED LIVE!';
 const view=overlayView({paired:true,phase:'RECORDING',liveHud:{secretEnemyCooldown:42}},{enabled:true,frozenLeague:locked});
 assert.equal(view.plan.winCondition,'Scale as a team');
 assert.equal(JSON.stringify(view).includes('secretEnemyCooldown'),false);
});
test('TFT overlay contains a preselected learning focus but no current board, gold or stage',()=>{
 const view=overlayView({paired:true,phase:'WAITING',tftRecorder:{state:'RECORDING',round:'5-4',gold:42,board:[1]}},{enabled:true,tftFocus:'ECONOMY'});
 assert.equal(view.focus,'ECONOMY');assert.equal(view.plan,null);
 for(const forbidden of ['5-4','gold','board'])assert.equal(JSON.stringify(view).includes(forbidden),false);
});
test('untrusted layout values are bounded',()=>{
 assert.deepEqual(safeLayout({x:-100,y:30,scale:50,opacity:0}),{x:0.015,y:0.75,scale:1.35,opacity:0.68});
});
test('isolated overlay never injects scripts or receives pairing secrets',()=>{
 const html=fs.readFileSync(path.join(base,'learning-overlay.html'),'utf8');
 const js=fs.readFileSync(path.join(base,'learning-overlay.js'),'utf8');
 const bridge=fs.readFileSync(path.join(base,'overlay-preload.cjs'),'utf8');
 const main=fs.readFileSync(path.join(base,'main.cjs'),'utf8');
 assert.match(html,/Content-Security-Policy/);
 assert.match(js,/\.textContent=/);assert.doesNotMatch(js,/\.innerHTML=/);
 assert.doesNotMatch(bridge,/token|webUrl/i);
 assert.match(main,/setIgnoreMouseEvents\(!overlayEditing,\{forward:true\}\)/);
 assert.match(main,/CommandOrControl\+Shift\+O/);assert.match(main,/Alt\+B/);
 assert.match(main,/overlayEnabled:raw\.overlayEnabled===true/);
});
