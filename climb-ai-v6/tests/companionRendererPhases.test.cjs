const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

/*
 * The Companion's main screen is one function, render(state), that fills in the
 * champ-select board, the plan, the quiet in-game card, the review and the
 * status line in a fixed order. If anything in that chain throws, everything
 * after it is skipped: the screen keeps showing whatever it showed last.
 *
 * That is exactly how champ select broke. renderDraftBoard called roleLabel(),
 * which was never defined, so the moment the tracker reported a draft the app
 * threw before it drew the picks, the plan or the status. The draft was
 * arriving; it simply never reached the screen.
 *
 * These tests run the SHIPPED renderer.js against a small fake DOM (built from
 * the real index.html ids) and push every phase through it with realistic data.
 */

const root=process.cwd();
const electron=path.join(root,'companion/electron');
const html=fs.readFileSync(path.join(electron,'index.html'),'utf8');
const rendererSource=fs.readFileSync(path.join(electron,'renderer.js'),'utf8');

/* ------------------------------------------------------------- fake DOM ---- */

class FakeElement{
  constructor(registry,tag='div'){
    this.registry=registry;this.tagName=tag.toUpperCase();
    this.children=[];this.style={};this.dataset={};this._id='';this._html='';
    this.textContent='';this.value='';this.disabled=false;this.className='';
    const classes=new Set();
    this.classList={
      add:(...n)=>n.forEach(x=>classes.add(x)),remove:(...n)=>n.forEach(x=>classes.delete(x)),
      contains:n=>classes.has(n),toggle:(n,force)=>{const on=force===undefined?!classes.has(n):Boolean(force);on?classes.add(n):classes.delete(n);return on},
    };
  }
  get id(){return this._id}
  set id(value){this._id=String(value);this.registry.set(this._id,this)}
  get innerHTML(){return this._html}
  set innerHTML(value){
    this._html=String(value);
    // Elements created by code carry their own ids inside the markup. Register
    // them so later getElementById calls find them, as a real DOM would.
    for(const match of this._html.matchAll(/\bid="([^"]+)"/g))if(!this.registry.has(match[1]))new FakeElement(this.registry).id=match[1];
  }
  replaceChildren(...nodes){this.children=nodes}
  append(...nodes){this.children.push(...nodes)}
  prepend(...nodes){this.children.unshift(...nodes)}
  appendChild(node){this.children.push(node);return node}
  insertBefore(node){this.children.push(node);return node}
  after(){}before(){}remove(){}
  addEventListener(){}removeEventListener(){}
  setAttribute(){}getAttribute(){return null}removeAttribute(){}
  querySelector(){return new FakeElement(this.registry)}
  querySelectorAll(){return[]}
  closest(){return null}
  scrollIntoView(){}click(){}
}

function makeContext(){
  const registry=new Map();
  // Every id that is in index.html at load time exists from the start.
  for(const match of html.matchAll(/\bid="([^"]+)"/g))new FakeElement(registry).id=match[1];
  const badge=new FakeElement(registry,'b');
  const document={
    body:new FakeElement(registry,'body'),
    head:new FakeElement(registry,'head'),
    getElementById:id=>registry.get(id)||null,
    createElement:tag=>new FakeElement(registry,tag),
    querySelector:selector=>selector==='.brand-signal b'?badge:new FakeElement(registry),
    querySelectorAll:()=>[],
    addEventListener(){},
  };
  const bridge={
    getState:async()=>({phase:'WAITING',paired:true}),
    getUpdateState:async()=>({status:'CURRENT',currentVersion:'0.8.10',progress:0}),
    onState(){return()=>{}},onUpdateState(){return()=>{}},
    openClimb:async()=>{},restart:async()=>{},unpair:async()=>{},setAutoStart:async()=>{},
    checkUpdate:async()=>{},downloadUpdate:async()=>{},installUpdate:async()=>({ok:true}),markMoment:async()=>({ok:true}),
  };
  const sandbox={document,console,confirm:()=>false,setTimeout,clearTimeout,Date,opCompanion:bridge};
  sandbox.window=sandbox;
  const context=vm.createContext(sandbox);
  vm.runInContext(rendererSource,context,{filename:'renderer.js'});
  return {context,registry,badge,render:state=>vm.runInContext('render',context)(state)};
}

/* ---------------------------------------------------------------- fixtures -- */

const pick=(championName,role,cellId,lockedIn=true)=>({championName,role,cellId,lockedIn});
const fullDraft=()=>({
  localRole:'BOTTOM',localChampionName:'Jinx',localLockedIn:true,localPlayerCellId:3,
  allies:[pick('Aatrox','TOP',0),pick('Lee Sin','JUNGLE',1),pick('Ahri','MIDDLE',2),pick('Jinx','BOTTOM',3),pick('Lulu','UTILITY',4)],
  enemies:[pick('Darius','TOP',5),pick('Viego','JUNGLE',6),pick('Syndra','MIDDLE',7),pick('Caitlyn','BOTTOM',8),pick('Leona','UTILITY',9)],
  bans:{allies:[{championName:'Yone'}],enemies:[{championName:'Samira'}]},
});
const plan=()=>({
  patch:'16.19.1',role:'ADC',you:{name:'Jinx'},them:{name:'Caitlyn'},
  laneEdge:{edge:'EVEN',summary:'Even lane. Survive, scale, then take over teamfights.'},
  rules:['Stay behind your minions until level 2.','Trade only when Leona has used her engage.','Stay with Lulu.'],
  powerSpikes:[{level:2,edge:'EVEN',label:'FIRST WINDOW',fight:'Rocket trade.'},{level:6,edge:'AHEAD',label:'ULTIMATE',fight:'Finish a low Caitlyn.'}],
});
const teamPlan=()=>({
  coachLevel:{tier:'GOLD',depth:5,visiblePoints:3,reviewPoints:2},
  yourJob:'Stay safe and hit the nearest safe target.',
  ourWinCondition:'Stall, scale, teamfight around Lulu.',
  adaptiveBuild:{patch:'16.19.1',core:[{id:3031,name:'Infinity Edge',slot:'CORE'}],boots:{id:3006,name:"Berserker's Greaves",slot:'BOOTS'}},
  teamfight:{summary:'Peel for Jinx.'},biggestThrow:'Chasing into Leona.',
  ourTeam:[{name:'Jinx'}],theirTeam:[{name:'Caitlyn'}],
});
const matchup=()=>({status:'READY',source:'CHAMP_SELECT',champion:'Jinx',opponent:'Caitlyn',role:'ADC',plan:plan()});
const review=()=>({
  sessionId:'s1',source:'COMPANION',coachLevel:{tier:'GOLD',depth:5,visiblePoints:3,reviewPoints:2},
  match:{champion:'Jinx',role:'ADC',kda:'6/3/9',csPerMin:7.4},
  good:[{title:'Held the wave',detail:'No free damage before level 2.'}],
  critical:[{title:'Walked up alone',detail:'Caught at 14:10.'}],
  nextFocus:{title:'STAY WITH LULU',rule:'Do not pass your minions alone.'},
});
const base={paired:true,trackerRunning:true,autoStart:false,logs:[],matchup:null,teamPlan:null,draft:null,postGameReview:null,detail:''};

/* -------------------------------------------------------------------- tests - */

const scenarios={
  'waiting for League':{phase:'WAITING'},
  'champ select, draft only (nobody locked yet)':{phase:'CHAMP_SELECT',draft:{...fullDraft(),localChampionName:null,localLockedIn:false,allies:[],enemies:[]}},
  'champ select, draft arrives before any plan':{phase:'CHAMP_SELECT',draft:fullDraft(),matchup:{status:'LOADING'}},
  'champ select, plan locked':{phase:'CHAMP_SELECT',draft:fullDraft(),matchup:matchup(),teamPlan:teamPlan()},
  'champ select, plan failed':{phase:'CHAMP_SELECT',draft:fullDraft(),matchup:{status:'ERROR',error:'no data'}},
  'in game, plan held':{phase:'RECORDING',matchup:matchup(),teamPlan:teamPlan()},
  'in game, no plan recovered':{phase:'RECORDING'},
  'building the review':{phase:'UPLOADING'},
  'review ready':{phase:'REVIEW',postGameReview:review()},
  'needs attention':{phase:'ERROR',detail:'League closed.'},
  'this PC is not paired':{phase:'WAITING',paired:false},
};

for(const [name,patch] of Object.entries(scenarios)){
  test(`render() completes: ${name}`,()=>{
    const {render}=makeContext();
    assert.doesNotThrow(()=>render({...base,...patch}));
  });
}

test('THE BUG: a live draft reaches the screen and the status line still updates',()=>{
  const {render,registry}=makeContext();
  render({...base,phase:'CHAMP_SELECT',draft:fullDraft(),matchup:matchup(),teamPlan:teamPlan()});
  const text=id=>registry.get(id)?.textContent;

  // The draft board is filled in...
  assert.equal(text('draftBoardRole'),'ADC');
  assert.equal(text('draftBoardPick'),'Jinx');
  assert.equal(text('draftBoardSeen'),'5/5 ENEMIES SEEN');
  assert.equal(registry.get('draftOurPicks').children.length,5);
  assert.equal(registry.get('draftTheirPicks').children.length,5);
  // ...the plan is drawn after it...
  assert.match(text('simplePregameTitle'),/Jinx vs Caitlyn/);
  // ...and the lines that render() writes LAST were reached, which is what a
  // thrown error upstream prevents.
  assert.equal(text('statusTitle'),'Your game plan');
});

test('each role the tracker can send is labelled for the draft board',()=>{
  const {render,registry}=makeContext();
  const expected={TOP:'TOP',JUNGLE:'JUNGLE',MIDDLE:'MID',MID:'MID',BOTTOM:'ADC',ADC:'ADC',UTILITY:'SUPPORT',SUPPORT:'SUPPORT'};
  for(const [sent,shown] of Object.entries(expected)){
    render({...base,phase:'CHAMP_SELECT',draft:{...fullDraft(),localRole:sent}});
    assert.equal(registry.get('draftBoardRole').textContent,shown,`${sent} should read ${shown}`);
  }
});

test('a draft with no role yet still renders, with a neutral label',()=>{
  const {render,registry}=makeContext();
  render({...base,phase:'CHAMP_SELECT',draft:{...fullDraft(),localRole:null,localChampionName:null,localLockedIn:false}});
  assert.equal(registry.get('draftBoardRole').textContent,'—');
  assert.equal(registry.get('draftBoardTitle').textContent,'DRAFT IN PROGRESS');
});

test('the desktop app throwing in one phase does not poison the next',()=>{
  // Belt and braces: drive a whole game's worth of phases through one window.
  const {render,registry}=makeContext();
  for(const name of ['waiting for League','champ select, plan locked','in game, plan held','building the review','review ready','waiting for League'])
    assert.doesNotThrow(()=>render({...base,...scenarios[name]}),name);
  assert.equal(registry.get('statusTitle').textContent,'Ready for League');
});


test('rank-calibrated SILVER never masquerades as paid plan or persists on TFT/home',()=>{
  const {render,registry,badge}=makeContext();
  const silverCalibration={tier:'SILVER',rank:'UNRANKED',depth:3,visiblePoints:3,reviewPoints:2};
  const paidPlan={...teamPlan(),coachLevel:silverCalibration,strategyAccess:{tier:'PRO',paidStrategy:true,deepStrategy:true}};
  render({...base,phase:'CHAMP_SELECT',matchup:matchup(),draft:fullDraft(),teamPlan:paidPlan});
  assert.equal(badge.textContent,'PRO COACH');
  assert.match(registry.get('simplePregameTier').textContent,/PRO COACH/);
  assert.doesNotMatch(registry.get('simplePregameTier').textContent,/SILVER COACH/);
  render({...base,phase:'RECORDING',teamPlan:paidPlan,matchup:matchup()});
  assert.equal(badge.textContent,'PRO COACH');
  render({...base,phase:'WAITING',playerHome:{tier:'PRO',ok:false}});
  assert.equal(badge.textContent,'PRO COACH');
  render({...base,phase:'WAITING',tftRecorder:{state:'ARMED'},playerHome:null});
  assert.equal(badge.textContent,'OP CLIMB COACH');
});


test('premium Companion Home displays genuine baseline, rank and a primary development action',()=>{
  const {render,registry}=makeContext();
  const home={ok:true,
    player:{gameName:'Player123',tagline:'EUW',rank:'PLATINUM III',role:'ADC'},
    tier:'PRO',tierView:{label:'PLAYER MEMORY'},
    baseline:{ready:false,games:1,required:3},journey:{phase:'BASELINE',status:'BASELINE 1/3',title:'Play baseline game 2.',body:'Play normally.',progress:'1/3'},
    roleProfiles:[],dna:[],missions:[],selectedRole:'ADC',primaryRole:'ADC',
  };
  assert.doesNotThrow(()=>render({...base,phase:'WAITING',playerHome:home}));
  const val=id=>registry.get(id)?.textContent;
  assert.equal(val('playerHomeName'),'Player123 #EUW');
  assert.equal(val('playerHomeTier'),'PRO');
  assert.equal(val('playerHomeRank'),'PLATINUM III · ADC');
  assert.equal(val('playerHomeScoreValue'),'1/3');
  assert.equal(val('playerHomeScoreKind'),'BASELINE');
  assert.equal(val('playerHomeSpotlightTitle'),'BUILD YOUR BASELINE');
  assert.equal(val('playerHomeNextButton'),'OPEN MY CLIMB ↗');
});

test('premium Companion Home uses real mission repetitions, not time-played XP',()=>{
  const source=fs.readFileSync(path.join(electron,'renderer.js'),'utf8');
  const style=fs.readFileSync(path.join(electron,'premium-home.css'),'utf8');
  const html=fs.readFileSync(path.join(electron,'index.html'),'utf8');
  assert.match(source,/nextMission\?\.confirmed/);
  assert.match(source,/nextMission\?\.required/);
  assert.match(source,/playerHomeOrbitFill/);
  assert.match(html,/premium-home\.css/);
  assert.match(style,/prefers-reduced-motion/);
  assert.match(style,/\.player-home-hero/);
  assert.match(style,/\.player-home-next-button/);
});
