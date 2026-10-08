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

test('overlay renderer changes from League mission to locked TFT focus without browser injection',async()=>{
 const vm=require('node:vm');
 const nodes=new Map(),handlers={};
 const element=id=>{
   if(nodes.has(id))return nodes.get(id);
   const node={textContent:'',hidden:false,style:{},value:'',offsetWidth:390,offsetHeight:300,
     classList:{toggle(key,on){this[key]=on}},
     addEventListener:(type,fn)=>{handlers[id+':'+type]=fn},
     setPointerCapture(){}};
   nodes.set(id,node);return node;
 };
 let stateHandler=null;
 const gameState={show:true,editing:false,game:'LOL',status:'LEAGUE · RECORDING',
   layout:{x:0.68,y:0.045,scale:1,opacity:0.96},
   plan:{champion:'Jinx',role:'ADC',winCondition:'Hold range',mission:'Position safely',avoid:'Do not chase'}};
 const sandbox={window:{OP_TFT_COACH_MODEL:{mission:()=>({title:'ECONOMY DISCIPLINE',rule:'Plan your spending',cues:['Keep options open','Protect your economy']})},
   opOverlay:{getState:async()=>gameState,onState:fn=>{stateHandler=fn},saveLayout:async()=>({ok:true}),finishEditing:async()=>({ok:true})},
   addEventListener:()=>{}},document:{getElementById:element},innerWidth:1920,innerHeight:1080};
 vm.runInNewContext(fs.readFileSync(path.join(base,'learning-overlay.js'),'utf8'),sandbox,{filename:'learning-overlay.js'});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(element('win').textContent,'Hold range');
 assert.equal(element('mission').textContent,'Position safely');
 stateHandler({...gameState,game:'TFT',status:'TFT · RECORDING',plan:null,focus:'ECONOMY'});
 assert.equal(element('title').textContent,'ECONOMY DISCIPLINE');
 assert.equal(element('win').textContent,'Plan your spending');
 assert.equal(element('avoid').textContent,'Protect your economy');
 assert.ok(!element('editor').hidden===false || element('editor').hidden);
});
