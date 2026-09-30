const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

/*
 * The "match plan" page (built by preload.cjs) used to show plan lines as one
 * block of text ("PLAY BEHIND X → SURVIVE Y → HIT Z"), hid the team's own win
 * condition behind the role plan, and showed only four build items.
 *
 * These tests pin the fixes:
 *  - the build shows the whole path plus swaps
 *  - long lines are split into separate pieces (arrows, "OR", sentences)
 *  - the original sentence stays in the page, because preload keeps writing to it
 *  - champion names are matched as whole words, never inside other words
 */

const root=process.cwd();
const electron=path.join(root,'companion/electron');
const preload=fs.readFileSync(path.join(electron,'preload.cjs'),'utf8');
const layer=fs.readFileSync(path.join(electron,'esports-v2.js'),'utf8');

class El{
  constructor(tag='div'){
    this.tagName=tag.toUpperCase();this.children=[];this.parent=null;this.dataset={};this.id='';this.className='';this.title='';this.src='';this.alt='';
    this._text='';this.style={setProperty(){}};
    const classes=new Set();
    this.classList={add:(...n)=>n.forEach(x=>classes.add(x)),remove:n=>classes.delete(n),contains:n=>classes.has(n),
      toggle:(n,f)=>{const on=f===undefined?!classes.has(n):Boolean(f);on?classes.add(n):classes.delete(n);return on}};
  }
  get textContent(){return this.children.length?this.children.map(c=>c.textContent).join(''):this._text}
  set textContent(v){this._text=String(v);this.children=[]}
  append(...n){n.forEach(c=>{if(c.parent)c.parent.children=c.parent.children.filter(x=>x!==c);c.parent=this;this.children.push(c)})}
  appendChild(n){this.append(n);return n}
  prepend(n){n.parent=this;this.children.unshift(n)}
  replaceChildren(...n){this.children=[];this.append(...n)}
  after(n){if(n.parent)n.parent.children=n.parent.children.filter(x=>x!==n);const p=this.parent;p.children.splice(p.children.indexOf(this)+1,0,n);n.parent=p}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null}
  cloneNode(){const c=new El(this.tagName);c.src=this.src;c.className=this.className;return c}
  tokens(){return new Set(String(this.className).split(' ').filter(Boolean))}
  matches(sel){return sel.startsWith('.')?this.tokens().has(sel.slice(1))||this.classList.contains(sel.slice(1)):this.tagName===sel.toUpperCase()}
  querySelector(sel){for(const c of this.children){if(c.matches(sel))return c;const d=c.querySelector(sel);if(d)return d}return null}
  closest(sel){for(let n=this;n;n=n.parent)if(n.matches(sel))return n;return null}
}
const byId=(node,id)=>{if(node.id===id)return node;for(const c of node.children){const hit=byId(c,id);if(hit)return hit}return null};
const make=(tag,props={},...kids)=>{const e=new El(tag);Object.assign(e,props);e.append(...kids);return e};
const text=(tag,id,value)=>{const e=new El(tag);e.id=id;e.textContent=value;return e};

/* ----------------------------------------------------- the full build ----- */

function renderAdaptiveBuild(team){
  const start=preload.indexOf('function renderAdaptiveBuild(team){');
  assert.notEqual(start,-1,'renderAdaptiveBuild must exist');
  let depth=0,end=-1;
  for(let i=preload.indexOf('{',start);i<preload.length;i++){
    if(preload[i]==='{')depth++;
    else if(preload[i]==='}'){depth--;if(depth===0){end=i+1;break}}
  }
  const grid=make('div',{id:'opAdaptiveBuildGrid'});
  const section=make('section',{id:'opAdaptiveBuild'});
  const read=make('div',{id:'opAdaptiveBuildRead'});
  const nodes={opAdaptiveBuild:section,opAdaptiveBuildGrid:grid,opAdaptiveBuildRead:read};
  const document={getElementById:id=>nodes[id]||null,createElement:tag=>new El(tag)};
  vm.runInNewContext(`${preload.slice(start,end)};result=renderAdaptiveBuild(team)`,{document,team,result:null,encodeURIComponent,String,Array});
  return {grid,section,read};
}
const item=(id,name,slot)=>({id,name,slot,why:`${name} because`});
const build={
  patch:'16.19.1',read:'4 DIVE THREATS',
  core:[item(3031,'Infinity Edge','CORE'),item(3095,'Stormrazor','CORE')],
  draftItem:item(3139,'Mercurial Scimitar','DRAFT'),finish:item(3036,"Lord Dominik's Regards",'FINISH'),boots:item(3047,'Plated Steelcaps','BOOTS'),
  swaps:[item(3026,'Guardian Angel','SWAP'),item(3072,'Bloodthirster','SWAP'),item(3046,'Phantom Dancer','SWAP'),item(9999,'Fourth Swap','SWAP')],
};

test('THE BUG: the build shows the whole path, not just four items',()=>{
  const {grid,section}=renderAdaptiveBuild({adaptiveBuild:build});
  const cards=grid.children;
  const labels=cards.map(c=>c.querySelector('div').children[0].textContent);
  assert.deepEqual(labels,['CORE 1','CORE 2','VS THIS TEAM','FINISH','BOOTS','SWAP IF','SWAP IF','SWAP IF']);
  assert.ok(!section.classList.contains('hidden'));
});

test('swaps are marked as swaps and capped at three',()=>{
  const {grid}=renderAdaptiveBuild({adaptiveBuild:build});
  const swaps=grid.children.filter(c=>c.className.includes('swap'));
  assert.equal(swaps.length,3,'a fourth swap would crowd the row');
  assert.ok(!grid.children.slice(0,5).some(c=>c.className.includes('swap')),'the path itself is never a swap');
});

test('each item keeps its icon and explanation',()=>{
  const {grid}=renderAdaptiveBuild({adaptiveBuild:build});
  const finish=grid.children[3];
  assert.match(finish.children[0].src,/\/cdn\/16\.19\.1\/img\/item\/3036\.png$/);
  assert.equal(finish.title,"Lord Dominik's Regards because");
});

test('a plan with no finisher or swaps still renders the original four',()=>{
  const {grid}=renderAdaptiveBuild({adaptiveBuild:{...build,finish:null,swaps:undefined}});
  assert.equal(grid.children.length,4);
});

test('with fewer than two path items the build stays hidden',()=>{
  const {section}=renderAdaptiveBuild({adaptiveBuild:{core:[item(1,'One','CORE')]}});
  assert.ok(section.classList.contains('hidden'));
});

/* ----------------------------------------- long lines become pieces ------- */

const allies=[['Ornn','TOP'],['Sejuani','JUNGLE'],['Orianna','MID'],['Caitlyn','ADC'],['Janna','SUPPORT']];
const enemies=[['Yone','TOP'],['Viego','JUNGLE'],['Lux','MID'],["Kai'Sa",'ADC'],['Pyke','SUPPORT'],['Sion','TOP']];
const person=([name,role])=>({name,role});

function page(steps,{win='',loss='',ourStyle='FRONT-TO-BACK',theirStyle='DIVE',allyList=allies,enemyList=enemies.slice(0,5)}={}){
  const head=make('div',{className:'op-head'});
  const ours=make('div',{className:'op-chip'},text('b','opOurIdentity',ourStyle));
  const theirs=make('div',{className:'op-chip'},text('b','opTheirIdentity',theirStyle));
  const draft=make('div',{className:'op-draft'},ours,theirs);
  const stepCards=steps.map((value,i)=>make('article',{className:'op-role-step'},text('span',`opRoleStepLabel${i+1}`,`${i+1} · LABEL`),text('strong',`opRoleStep${i+1}`,value)));
  const roleWin=make('div',{id:'opRoleWin',className:'op-rolewin'},...stepCards);
  const winCard=make('article',{id:'opPaidWin',className:'op-winhero'},make('span'),text('strong','opYourWin',win));
  const lossCard=make('article',{id:'opPaidLoss',className:'op-danger'},make('span'),text('strong','opVsTeam',loss));
  const section=make('section',{id:'opMissionReminders'},head,draft,roleWin,lossCard,winCard);
  let handler=null;
  const sandbox={
    document:{getElementById:id=>byId(section,id),createElement:tag=>new El(tag)},
    Image:function(){return new El('img')},encodeURIComponent,setTimeout,Number,Array,String,Map,WeakMap,RegExp,JSON,
    opCompanion:{getState:()=>new Promise(()=>{}),onState:h=>{handler=h}},
  };
  sandbox.window=sandbox;
  vm.runInContext(layer,vm.createContext(sandbox),{filename:'esports-v2.js'});
  const state=()=>({matchup:{champion:'Caitlyn',plan:{you:{name:'Caitlyn'}}},teamPlan:{ourTeam:allyList.map(person),theirTeam:enemyList.map(person),compositionRead:{}}});
  const push=async(next=state())=>{handler(next);await new Promise(r=>setTimeout(r,5))};
  const pieces=card=>{const list=card.children.find(c=>c.tagName==='OL');return list?list.children.map(li=>li.textContent):null};
  return {section,stepCards,winCard,lossCard,draft,head,push,pieces,flowOf:card=>card.children.find(c=>c.tagName==='OL')||null};
}

const STEPS=['CORE ITEMS + SAFE FARM','Janna / Ornn','Yone / Pyke / Lux — DO NOT STEP OUT BEFORE THEIR ACCESS IS COMMITTED',
  'PLAY BEHIND Janna / Ornn → SURVIVE Yone / Pyke / Lux → HIT THE NEAREST SAFE TARGET','WON FIGHT / PICK → DRAGON, BARON OR TOWER → RESET INSTEAD OF LOW-VALUE CHASE'];

test('an arrow chain becomes one separate piece per step',async()=>{
  const p=page(STEPS);
  await p.push();
  assert.deepEqual(p.pieces(p.stepCards[3]),['PLAY BEHIND Janna / Ornn','SURVIVE Yone / Pyke / Lux','HIT THE NEAREST SAFE TARGET']);
  assert.deepEqual(p.pieces(p.stepCards[4]),['WON FIGHT / PICK','DRAGON, BARON OR TOWER','RESET INSTEAD OF LOW-VALUE CHASE']);
  assert.ok(p.flowOf(p.stepCards[3]).className.includes('down'));
  assert.ok(p.stepCards[3].classList.contains('es-flowed'));
});

test('the original sentence stays in the page, because preload keeps writing to it',async()=>{
  const p=page(STEPS);
  await p.push();
  assert.equal(byId(p.section,'opRoleStep4').textContent,STEPS[3]);
});

test('a line with no arrow is left alone',async()=>{
  const p=page(STEPS);
  await p.push();
  assert.equal(p.flowOf(p.stepCards[0]),null);
  assert.ok(!p.stepCards[0].classList.contains('es-flowed'));
});

test('"survive": the names become portraits and only the rule is left to read',async()=>{
  const p=page(STEPS);
  await p.push();
  assert.deepEqual(p.pieces(p.stepCards[2]),['DO NOT STEP OUT BEFORE THEIR ACCESS IS COMMITTED']);
  assert.ok(p.flowOf(p.stepCards[2]).className.includes('rule'));
});

test('a dash after something that is not a list of names is not split off',async()=>{
  const p=page([ 'a','b','GET TO THE OBJECTIVE — WITH VISION','d','e']);
  await p.push();
  assert.equal(p.flowOf(p.stepCards[2]),null);
});

test('"X, OR Y" becomes two alternatives',async()=>{
  const p=page(STEPS,{loss:'Yone / Pyke / Lux GETS ONTO YOU BEFORE Janna / Ornn CAN PEEL, OR YOU STEP OUTSIDE THAT PROTECTION.'});
  await p.push();
  assert.deepEqual(p.pieces(p.lossCard),['Yone / Pyke / Lux GETS ONTO YOU BEFORE Janna / Ornn CAN PEEL','YOU STEP OUTSIDE THAT PROTECTION']);
  assert.ok(p.flowOf(p.lossCard).className.includes('or'));
});

test('the simple four-step plan (lower coaching levels) gets the same treatment',async()=>{
  const p=page(STEPS);
  const simple=make('article',{className:'op-step'},text('span','opStep1Label','01 · LANE'),text('strong','opEarly','FARM CLEAN → TRADE ONLY WHEN YOUR SUPPORT CAN CONNECT'));
  const flowRow=make('div',{id:'opSimpleFlow'},simple);
  p.section.append(flowRow);
  await p.push();
  assert.deepEqual(p.pieces(simple),['FARM CLEAN','TRADE ONLY WHEN YOUR SUPPORT CAN CONNECT']);
});

test('the team win condition is split by arrows, else by sentence, else left whole',async()=>{
  const arrows=page(STEPS,{win:'ARRIVE FIRST → STAY CONNECTED → CONVERT TO THE OBJECTIVE.'});
  await arrows.push();
  assert.deepEqual(arrows.pieces(arrows.winCard),['ARRIVE FIRST','STAY CONNECTED','CONVERT TO THE OBJECTIVE']);
  assert.ok(arrows.flowOf(arrows.winCard).className.includes('inline'));

  const sentences=page(STEPS,{win:'WIN CONNECTED FIGHTS. PLAY AROUND JANNA.'});
  await sentences.push();
  assert.deepEqual(sentences.pieces(sentences.winCard),['WIN CONNECTED FIGHTS','PLAY AROUND JANNA']);

  const single=page(STEPS,{win:'STALL, SCALE, TEAMFIGHT AROUND LULU.'});
  await single.push();
  assert.equal(single.flowOf(single.winCard),null);
});

test('running again does not stack pieces, and a changed sentence is re-split',async()=>{
  const p=page(STEPS);
  await p.push();await p.push();await p.push();
  assert.equal(p.stepCards[3].children.filter(c=>c.tagName==='OL').length,1);

  byId(p.section,'opRoleStep4').textContent='ONE → TWO';
  await p.push();
  assert.deepEqual(p.pieces(p.stepCards[3]),['ONE','TWO']);

  byId(p.section,'opRoleStep4').textContent='JUST ONE THING';
  await p.push();
  assert.equal(p.flowOf(p.stepCards[3]),null,'no arrows any more, so the pieces go away');
  assert.ok(!p.stepCards[3].classList.contains('es-flowed'));
});

/* ---------------------------------------------- names and style labels ---- */

test('a champion is only found as a whole word, never inside another word',async()=>{
  // "Sion" is on the enemy team (one of the five) and sits inside "DECISION" and "OBSESSION".
  const withSion=[['Sion','TOP'],...enemies.slice(1,5)];
  const p=page(['a','DECISION OBSESSION — MISSION','DECISION OBSESSION','d','e'],{enemyList:withSion});
  await p.push();
  const chips=card=>card.children.find(c=>c.className&&String(c.className).includes('es-chips'));
  assert.equal(chips(p.stepCards[2]),undefined,'"Sion" must not be found inside "DECISION"');
});

test('each team gets its own style label above its portraits',async()=>{
  const p=page(STEPS);
  await p.push();
  const squad=byId(p.section,'esSquad');
  const [ours,,theirs]=squad.children;
  assert.equal(ours.querySelector('.es-caption').children[0].textContent.includes('FRONT-TO-BACK'),true);
  assert.equal(theirs.querySelector('.es-caption').children[0].textContent.includes('DIVE'),true);
  assert.ok(!p.draft.children.some(c=>c.textContent.includes('FRONT-TO-BACK')),'moved out of the tag row');
});

test('with no portraits to hang them on, the labels go back to the tag row',async()=>{
  const p=page(STEPS);
  await p.push();
  await p.push({matchup:{champion:'Caitlyn'},teamPlan:{ourTeam:[],theirTeam:[],compositionRead:{}}});
  assert.equal(byId(p.section,'esSquad'),null);
  assert.equal(p.draft.children.length,2,'both labels are back where preload put them');
});

test('the stylesheet places the win, loss and mission cards and shows the arrows',()=>{
  const css=fs.readFileSync(path.join(electron,'esports-v2.css'),'utf8');
  for(const needle of ['.op-winhero{','.es-flow.down','.es-flow.or','.es-flow.inline','.es-flow.rule'])
    assert.ok(css.includes(needle),`missing rule ${needle}`);
  assert.ok(!/\.es-flow[^{]*li\{[^}]*clip-path:var\(--es-cut-shape-sm\)/.test(css),
    'flow boxes must not clip: clip-path would cut off their own arrows');
});
