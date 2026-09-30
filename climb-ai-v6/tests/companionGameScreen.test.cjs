const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

/*
 * While a match is recording, the old coach board was a tall stack of tiny text
 * with the win path and build hidden in a drawer, and "YOUR JOB" sat in a box
 * that clipped long sentences. esports-v2.js now builds a one-screen version
 * from the values the board has already computed.
 *
 * These tests run the shipped script against a small fake DOM shaped like the
 * board and check what ends up on screen.
 */

const root=process.cwd();
const layer=fs.readFileSync(path.join(root,'companion/electron/esports-v2.js'),'utf8');

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
  prepend(n){n.parent=this;this.children.unshift(n)}
  replaceChildren(...n){this.children=[];this.append(...n)}
  after(n){if(n.parent)n.parent.children=n.parent.children.filter(x=>x!==n);const p=this.parent;p.children.splice(p.children.indexOf(this)+1,0,n);n.parent=p}
  before(n){if(n.parent)n.parent.children=n.parent.children.filter(x=>x!==n);const p=this.parent;p.children.splice(p.children.indexOf(this),0,n);n.parent=p}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null}
  cloneNode(){const c=new El(this.tagName);c.src=this.src;c.className=this.className;return c}
  matches(sel){return sel.startsWith('.')?String(this.className).split(' ').includes(sel.slice(1)):this.tagName===sel.toUpperCase()}
  querySelector(sel){for(const c of this.children){if(c.matches(sel))return c;const d=c.querySelector(sel);if(d)return d}return null}
  closest(sel){for(let n=this;n;n=n.parent)if(n.matches(sel))return n;return null}
}
const byId=(node,id)=>{if(node.id===id)return node;for(const c of node.children){const hit=byId(c,id);if(hit)return hit}return null};
const make=(tag,props={},...kids)=>{const e=new El(tag);Object.assign(e,props);e.append(...kids);return e};
const text=(tag,id,value)=>{const e=new El(tag);e.id=id;e.textContent=value;return e};
const person=([name,role])=>({name,role});
const hasClass=(el,name)=>String(el.className).split(' ').includes(name);
const descendants=el=>el.children.flatMap(c=>[c,...descendants(c)]);
const find=(el,name)=>descendants(el).find(c=>hasClass(c,name));
const tagOf=unit=>unit.children.find(c=>hasClass(c,'es-unit-tag'))?.textContent||'';

const allies=[['Ornn','TOP'],['Sejuani','JUNGLE'],['Orianna','MID'],['Caitlyn','ADC'],['Janna','SUPPORT']];
const enemies=[['Yone','TOP'],['Viego','JUNGLE'],['Lux','MID'],["Kai'Sa",'ADC'],['Pyke','SUPPORT']];
const item=(id,name,slot)=>({id,name,slot,why:`${name} because`});
const build={
  patch:'16.19.1',read:'4 DIVE THREATS',
  core:[item(3031,'Infinity Edge','CORE'),item(3095,'Stormrazor','CORE')],
  draftItem:item(3139,'Mercurial Scimitar','DRAFT'),finish:item(3036,"Lord Dominik's Regards",'FINISH'),boots:item(3047,'Plated Steelcaps','BOOTS'),
  swaps:[item(3026,'Guardian Angel','SWAP'),item(3072,'Bloodthirster','SWAP'),item(3046,'Phantom Dancer','SWAP')],
};

// The old coach board computes these; the new screen only reads them.
const BOARD={
  opRememberTitle:'CAITLYN · ADC // WIN CONDITION',opRemOurShape:'FRONT-TO-BACK',opRemEnemyCurve:'MID GAME DRAFT',
  opRemGameCall:'TAKE SAFE RESOURCES → HIT YOUR SPIKE → STAY ALIVE',opRemGameCallWhy:'YOU ARE THE DRAFT RESOURCE PRIORITY',
  opRemThreat:'Pyke',opRemThreatAnswer:'KEEP FLASH FOR ENTRY · STAY BEHIND PEEL',
  opRemCarryPrimary:'Caitlyn',opRemCarryRole:'PRIMARY CARRY',opRemCarryPlay:'Caitlyn',
  opRemDecisionCall:'FARM',opRemFightWhen:'Pyke COMMITS · YOU STILL HAVE PEEL / RANGE',opRemStopRule:'FULL-HP EXTENDED FIGHT FROM EVEN WAVE',
  opMissionCue:'After dying: collect safe resources.',opYourWin:'ARRIVE FIRST → STAY CONNECTED → CONVERT TO THE OBJECTIVE.',
};
const PATH=[['1 · TEMPO','150 CS @20'],['2 · LINK','WITH JANNA'],['3 · SURVIVE','DENY PYKE'],['4 · FIGHT','HIT YONE IF SAFE'],['5 · CASH OUT','DRAGON / BARON']];

function gamePage(values={},{live=true}={}){
  const shell=make('div',{className:'shell'});
  const live_=text('span','','LIVE · RECORDING');live_.className='rem4-live';
  const hud=make('section',{id:'opRememberHud'},live_);
  for(const [id,value] of Object.entries({...BOARD,...values}))hud.append(text('strong',id,value));
  hud.append(make('div',{id:'opRemWinPath'},...PATH.map(([label,value])=>make('div',{className:'rem4-step'},text('i','',label),text('strong','',value)))));
  shell.append(hud);
  const body=new El('body');
  if(live)body.classList.add('op-remember-live');
  let handler=null;
  const sandbox={
    document:{body,getElementById:id=>byId(shell,id),createElement:tag=>new El(tag)},
    Image:function(){return new El('img')},encodeURIComponent,setTimeout,clearTimeout,Number,Array,String,Map,WeakMap,RegExp,JSON,
    opCompanion:{getState:()=>new Promise(()=>{}),onState:h=>{handler=h}},
  };
  sandbox.window=sandbox;
  vm.runInContext(layer,vm.createContext(sandbox),{filename:'esports-v2.js'});
  const state=(over={})=>({
    matchup:{champion:'Caitlyn',plan:{you:{name:'Caitlyn'}}},
    teamPlan:{ourTeam:allies.map(person),theirTeam:enemies.map(person),compositionRead:{},adaptiveBuild:build,...over},
  });
  const push=async(next=state())=>{handler(next);await new Promise(r=>setTimeout(r,5))};
  const game=()=>byId(shell,'esGame');
  const card=name=>find(game(),name);
  return {shell,hud,body,push,state,game,card,set:(id,value)=>{byId(shell,id).textContent=value}};
}
const pieces=el=>el.querySelector('ol').children.map(li=>li.textContent);

test('the screen is built from the board and sits directly above it',async()=>{
  const g=gamePage();
  await g.push();
  assert.ok(g.game(),'esGame must exist while the board is live');
  assert.equal(g.shell.children.indexOf(g.game())+1,g.shell.children.indexOf(g.hud));
});

test('your job is shown as separate pieces, in order, none lost',async()=>{
  const g=gamePage();
  await g.push();
  assert.deepEqual(pieces(g.card('job')),['TAKE SAFE RESOURCES','HIT YOUR SPIKE','STAY ALIVE']);
});

test('THE BUG: a very long job sentence keeps every part instead of being cut off',async()=>{
  const g=gamePage({opRemGameCall:'CREATE SPACE FOR A → CONNECT FIRST WITH B AND C → PEEL THE DIVE FROM D → FOLLOW UP ON THE ENGAGE'});
  await g.push();
  const all=pieces(g.card('job'));
  assert.equal(all.length,4);
  assert.equal(all[1],'CONNECT FIRST WITH B AND C');
  assert.match(fs.readFileSync(path.join(root,'companion/electron/esports-v2.css'),'utf8'),/\.es-g-card\{[^}]*clip-path/,'the card is cut-cornered, never overflow:hidden');
  assert.ok(!/\.es-g-card[^{]*\{[^}]*overflow:hidden/.test(fs.readFileSync(path.join(root,'companion/electron/esports-v2.css'),'utf8')),
    'overflow:hidden on the job card is what clipped long sentences before');
});

test('a job with no arrow is shown whole',async()=>{
  const g=gamePage({opRemGameCall:'PLAY YOUR ROLE'});
  await g.push();
  assert.equal(g.card('job').querySelector('ol'),null);
  assert.ok(g.card('job').children.some(c=>c.textContent==='PLAY YOUR ROLE'));
});

test('the threat shows its portrait and its answer as short lines',async()=>{
  const g=gamePage();
  await g.push();
  const threat=g.card('threat');
  assert.match(find(threat,'es-g-threat-art').src,/tiles\/Pyke_0\.jpg$/);
  assert.deepEqual(threat.querySelector('ul').children.map(li=>li.textContent),['KEEP FLASH FOR ENTRY','STAY BEHIND PEEL']);
});

test('a threat who is not on the enemy team gets no portrait (no guessing)',async()=>{
  const g=gamePage({opRemThreat:'THEIR ENGAGE'});
  await g.push();
  assert.equal(find(g.card('threat'),'es-g-threat-art'),undefined);
});

test('the six rules, five steps, win condition and mission are all there',async()=>{
  const g=gamePage();
  await g.push();
  assert.deepEqual(g.card('es-g-cells').children.map(c=>c.children[0].textContent),['WHO CARRIES','YOUR ROLE','PLAY AROUND','FIGHT / FARM','FIGHT WHEN',"DON'T"]);
  assert.deepEqual(g.card('es-g-steps').children.map(s=>s.children[1].textContent),['150 CS @20','WITH JANNA','DENY PYKE','HIT YONE IF SAFE','DRAGON / BARON']);
  assert.deepEqual(pieces(g.card('win')),['ARRIVE FIRST','STAY CONNECTED','CONVERT TO THE OBJECTIVE']);
  assert.equal(g.card('mission').children[1].textContent,'After dying: collect safe resources.');
});

test('the build shows the whole path plus three swaps',async()=>{
  const g=gamePage();
  await g.push();
  const items=g.card('es-g-items').children;
  assert.deepEqual(items.map(i=>i.children[1].textContent),['CORE 1','CORE 2','VS THIS TEAM','FINISH','BOOTS','SWAP IF','SWAP IF','SWAP IF']);
  assert.match(items[3].children[0].src,/\/16\.19\.1\/img\/item\/3036\.png$/);
});

test('squads are tagged: you, who you play with, who to fear',async()=>{
  const g=gamePage();
  await g.push();
  const squad=g.card('es-g-squad');
  const side=key=>squad.children.find(c=>hasClass(c,key)).children;
  const nameOf=unit=>unit.children[2].textContent;
  assert.equal(tagOf(side('ours').find(u=>nameOf(u)==='Caitlyn')),'YOU');
  assert.equal(tagOf(side('ours').find(u=>nameOf(u)==='Janna')),'LINK');
  assert.equal(tagOf(side('theirs').find(u=>nameOf(u)==='Pyke')),'THREAT');
  assert.equal(tagOf(side('theirs').find(u=>nameOf(u)==='Yone')),'');
});

test('it only redraws when a value changed',async()=>{
  const g=gamePage();
  await g.push();
  const first=g.game().children[0];
  await g.push();
  assert.equal(g.game().children[0],first,'same values: same nodes, no churn');
  g.set('opRemThreat','Yone');
  await g.push();
  assert.notEqual(g.game().children[0],first);
  assert.equal(g.card('threat').querySelector('h3').textContent,'Yone');
});

test('outside a match the screen is removed, and it returns with the match',async()=>{
  const g=gamePage();
  await g.push();
  assert.ok(g.game());
  g.body.classList.remove('op-remember-live');
  await g.push();
  assert.equal(g.game(),null);
  g.body.classList.add('op-remember-live');
  await g.push();
  assert.ok(g.game());
});

test('missing values and no build never throw, and leave out what cannot be shown',async()=>{
  const g=gamePage({opRemThreat:'',opRemThreatAnswer:'',opRemDecisionCall:'',opMissionCue:'',opYourWin:''});
  await assert.doesNotReject(()=>g.push(g.state({adaptiveBuild:null})));
  assert.equal(g.card('es-g-build'),undefined,'no build, no build row');
  assert.equal(g.card('win'),undefined,'no win condition text, no win card');
});

test('the old board is not hidden by anything outside its own top section',()=>{
  // Its drawers carry the interactive tools (contingency, self-check), so only the parts
  // the new screen replaces may be hidden.
  const css=fs.readFileSync(path.join(root,'companion/electron/esports-v2.css'),'utf8');
  const rule=css.slice(css.indexOf('#esGame ~ #opRememberHud > .rem4-top'),css.indexOf('body.op-remember-live #esGame ~ #opRememberHud'));
  // ".rem4-body" only appears as the path to the four sections inside it.
  const hidden=[...rule.matchAll(/(\.rem4-[a-z-]+)/g)].map(m=>m[1]).filter(name=>name!=='.rem4-body');
  assert.deepEqual([...new Set(hidden)].sort(),['.rem4-call-row','.rem4-carry-strip','.rem4-command-strip','.rem4-draft','.rem4-top']);
});
