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
test('Expanded HUD gets the complete frozen plan, and missing advice is left empty rather than invented',()=>{
 const steps=['Farm safely','Group with Lulu','Ward dragon','Hit the front line','Take dragon'].map((value,i)=>({label:'S'+i,value}));
 const paid=freezeLeaguePlan({matchup:{champion:'Jinx',role:'ADC',plan:{rules:['Rule one']}},teamPlan:{ourWinCondition:'Scale',yourJob:'Stay safe',
   theirWinCondition:'Dive Jinx',biggestThrow:'Chasing',roleWinCondition:{steps},missionTips:[{cue:'Back with the wave'}]}});
 assert.deepEqual([...paid.actions],['Farm safely','Group with Lulu → Ward dragon','Hit the front line → Take dragon']);
 assert.equal(paid.threat,'Dive Jinx');assert.equal(paid.job,'Stay safe');assert.equal(paid.mission,'Back with the wave');
 // FREE: the server sends no paid fields; nothing generic is substituted.
 const free=freezeLeaguePlan({matchup:{champion:'Jinx',role:'ADC',plan:{rules:['Rule one','Rule two']}},teamPlan:{ourWinCondition:null,biggestThrow:null,yourJob:'Stay safe'}});
 assert.equal(free.winCondition,'');assert.equal(free.avoid,'');assert.equal(free.threat,'');
 assert.deepEqual([...free.actions],['Rule one','Rule two']);
 // Baseline games score no mission.
 const baseline=freezeLeaguePlan({teamPlan:{dnaBaseline:{ready:false,games:1,required:3},missionTips:[{cue:'Hidden'}]}});
 assert.equal(baseline.mission,'');assert.deepEqual({...baseline.baseline},{games:1,required:3});
 const model=fs.readFileSync(path.join(base,'overlay-model.cjs'),'utf8');
 assert.doesNotMatch(model,/Avoid unnecessary risks|Play your role within the team plan/);
});
test('TFT overlay contains a preselected learning focus but no current board, gold or stage',()=>{
 const view=overlayView({paired:true,phase:'WAITING',tftRecorder:{state:'RECORDING',round:'5-4',gold:42,board:[1]}},{enabled:true,tftFocus:'ECONOMY'});
 assert.equal(view.focus,'ECONOMY');assert.equal(view.plan,null);
 for(const forbidden of ['5-4','gold','board'])assert.equal(JSON.stringify(view).includes(forbidden),false);
});
test('untrusted layout values are bounded',()=>{
 assert.deepEqual(safeLayout({x:-100,y:30,scale:50,opacity:0}),{x:0.015,y:0.75,scale:1.35,opacity:0.68,mode:'FOCUS'});
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
 assert.equal(element('mission').textContent,'Plan your spending');
 assert.equal(element('win').textContent,'Keep options open');
 assert.equal(element('avoid').textContent,'Protect your economy');
 assert.ok(!element('editor').hidden===false || element('editor').hidden);
});


test('three visually distinct HUD presets are bounded, stable and user-selectable',()=>{
 const {HUD_MODES,safeLayout,nextHudMode}=require(path.join(base,'overlay-model.cjs'));
 assert.deepEqual(HUD_MODES,['FOCUS','MINIMAL','EXPANDED']);
 assert.equal(safeLayout({mode:'MINIMAL',x:.32}).mode,'MINIMAL');
 assert.equal(safeLayout({mode:'expanded'}).mode,'EXPANDED');
 assert.equal(safeLayout({mode:'../../malicious'}).mode,'FOCUS');
 assert.equal(nextHudMode('FOCUS'),'MINIMAL');
 assert.equal(nextHudMode('MINIMAL'),'EXPANDED');
 assert.equal(nextHudMode('EXPANDED'),'FOCUS');
 for(const mode of HUD_MODES){
   const p=overlayView({paired:true,phase:'RECORDING'},{enabled:true,layout:{mode,opacity:.8}});
   assert.equal(p.layout.mode,mode);
   assert.equal(p.layout.opacity,.8);
 }
});

test('premium HUD includes real static champion art with safe CSP and readable minimal focus expanded modes',()=>{
 const html=fs.readFileSync(path.join(base,'learning-overlay.html'),'utf8');
 const css=fs.readFileSync(path.join(base,'learning-overlay.css'),'utf8');
 const js=fs.readFileSync(path.join(base,'learning-overlay.js'),'utf8');
 assert.match(html,/img-src https:\/\/ddragon\.leagueoflegends\.com/);
 assert.match(html,/id="championArt"/);
 assert.match(html,/data-preset="MINIMAL"/);
 assert.match(html,/data-preset="FOCUS"/);
 assert.match(html,/data-preset="EXPANDED"/);
 assert.match(css,/\.hud\.mode-minimal/);
 assert.match(css,/\.hud\.mode-focus/);
 assert.match(css,/\.hud\.mode-expanded/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(js,/leagueoflegends\.com\/cdn\/img\/champion\/tiles\//);
 assert.match(js,/encodeURIComponent\(key\)/);
 assert.doesNotMatch(js,/\.innerHTML=/);
 assert.doesNotMatch(js,/liveHud|winProbability|enemyCooldown/i);
});

test('League plan cannot update with late live recovery; settings support layout cycle hotkey',()=>{
 const main=fs.readFileSync(path.join(base,'main.cjs'),'utf8');
 const preload=fs.readFileSync(path.join(base,'preload.cjs'),'utf8');
 const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
 const renderer=fs.readFileSync(path.join(base,'renderer.js'),'utf8');
 assert.match(main,/state\.phase==='CHAMP_SELECT'&&state\.matchup\?\.status==='READY'/);
 assert.match(main,/else if\(enteringRecording&&!overlayFrozenLeague\)/);
 assert.doesNotMatch(main,/if\(state\.phase!=='RECORDING'\)overlayFrozenLeague=null;/);
 assert.match(main,/CommandOrControl\+Shift\+L/);
 assert.match(main,/companion:overlay-cycle/);
 assert.match(preload,/cycleOverlay/);
 assert.match(renderer,/overlayModeCycle/);
 assert.match(html,/overlayModeLabel/);
});

test('preset buttons persist mode and status clearly distinguishes preview from a real recording',async()=>{
 const vm=require('node:vm');
 const nodes=new Map(),handlers={};
 const fake=id=>{
   if(nodes.has(id))return nodes.get(id);
   const node={textContent:'',hidden:false,style:{},dataset:{},value:'',offsetWidth:364,offsetHeight:340,
     classList:{toggle(key,on){this[key]=on}},
     addEventListener(type,fn){handlers[id+':'+type]=fn},setPointerCapture(){},removeAttribute(){},setAttribute(){}};
   nodes.set(id,node);return node;
 };
 const buttons=['MINIMAL','FOCUS','EXPANDED'].map(mode=>{
   const element=fake('button-'+mode);element.dataset.preset=mode;return element;
 });
 let push=null,lastSaved=null;
 const initial={show:true,editing:true,game:'PREVIEW',status:'PREVIEW · EDITING',
   layout:{x:.68,y:.045,scale:1,opacity:.96,mode:'FOCUS'},plan:null,focus:'ECONOMY'};
 const window={addEventListener(){},OP_TFT_COACH_MODEL:{mission:()=>null},
   opOverlay:{onState:fn=>{push=fn},getState:async()=>initial,saveLayout:async value=>(lastSaved=value,{layout:value}),finishEditing:async()=>({ok:true})}};
 vm.runInNewContext(fs.readFileSync(path.join(base,'learning-overlay.js'),'utf8'),
   {window,document:{getElementById:fake,querySelectorAll:()=>buttons},innerWidth:1920,innerHeight:1080},{filename:'learning-overlay.js'});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(fake('status').textContent,'LAYOUT PREVIEW');
 assert.equal(fake('recordingStatus').textContent,'● EDITOR PREVIEW');
 assert.equal(fake('overlay').dataset.mode,'FOCUS');
 assert.equal(fake('championArt').hidden,true);
 handlers['button-MINIMAL:click']();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(lastSaved.mode,'MINIMAL');
 assert.equal(fake('overlay').dataset.mode,'MINIMAL');
 push({...initial,editing:false,game:'LOL',layout:lastSaved,plan:{champion:'Jinx',role:'ADC',mission:'Protect positioning',winCondition:'Scale',avoid:'Do not chase'}});
 assert.equal(fake('title').textContent,'Jinx · ADC');
 assert.equal(fake('mission').textContent,'Protect positioning');
 assert.equal(fake('status').textContent,'LEAGUE RECORDING');
 assert.match(fake('championArt').src,/Jinx_0\.jpg/);
});
