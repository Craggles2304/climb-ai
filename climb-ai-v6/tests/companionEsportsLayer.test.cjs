const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

/*
 * The esports layer (esports-v2.css + esports-v2.js) is decoration. It must
 * never be the reason a screen stops working, so these tests pin its contract:
 * it ships, it loads after everything else, it only ADDS pictures and style
 * hooks, it tolerates missing data, and it is safe to run repeatedly.
 */

const root=process.cwd();
const electron=path.join(root,'companion/electron');
const html=fs.readFileSync(path.join(electron,'index.html'),'utf8');
const css=fs.readFileSync(path.join(electron,'esports-v2.css'),'utf8');
const source=fs.readFileSync(path.join(electron,'esports-v2.js'),'utf8');

/* ------------------------------------------------------------ packaging --- */

test('the layer is loaded, and loaded last so it wins over the older styles',()=>{
  const links=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1]);
  assert.equal(links.at(-1),'esports-v2.css','esports-v2.css must be the last stylesheet');
  assert.ok(html.includes('<script src="esports-v2.js"></script>'));
  assert.ok(html.includes('<script src="review-v2.js"></script>'),'the Match OS loader must stay');
});

test('the layer ships inside the installer',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'companion/package.json'),'utf8'));
  assert.ok(pkg.build.files.includes('electron/**/*'));
  assert.ok(!pkg.build.files.some(f=>/^!.*esports-v2/.test(f)),'nothing may exclude the layer');
});

test('the stylesheet does not hide information or remove elements',()=>{
  // Decoration only: the layer may restyle, never take content away. The
  // deliberate exceptions are the idle radar (redundant once the match room is
  // showing, stale in the review), our own elements, and the one-line reminder
  // under the plan, which is dropped only in windows too short to hold it.
  const hiding=[...css.matchAll(/([^{}]+)\{[^}]*display\s*:\s*none[^}]*\}/g)].map(m=>m[1].trim());
  for(const selector of hiding){
    // "#opMissionReminders.hidden" only keeps the page's own hide/show switch working
    // now that the section is a grid; it does not hide anything the app wants shown.
    // ".op-chip.role" is the "YOU · CHAMPION · ROLE" tag: the title and the YOU portrait say the same.
    // ".shell > footer" is the generic app footer, hidden only while the plan page (which has its own
    // reminder line) is on screen, to give the plan room.
    assert.match(selector,/#idleArena|\.es-tile\.es-missing|::-webkit|::before|::after|\.es-|\.op-foot|#opMissionReminders\.hidden|\.op-chip\.role|\.shell > footer|@media \(max-height:\d+px\)/,`unexpected hiding rule: ${selector}`);
  }
  const footRule=css.indexOf('.op-foot{display:none}');
  assert.ok(footRule>-1,'the reminder line is expected to be hidden in short windows');
  const context=css.slice(css.lastIndexOf('@media',footRule),footRule);
  assert.match(context,/^@media \(max-height:\d+px\)\{[^}]*$/,'and ONLY inside a max-height media query');
});

test('reduced motion turns the animations off',()=>{
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
});

/* ------------------------------------------------------------ tiny DOM ---- */

class El{
  constructor(tag='div'){
    this.tagName=tag.toUpperCase();this.children=[];this.parent=null;this.dataset={};this.id='';this.src='';this.alt='';this.className='';
    this._text='';this.style={props:{},setProperty(k,v){this.props[k]=v}};
    const classes=new Set();
    this.classList={add:(...n)=>n.forEach(x=>classes.add(x)),remove:n=>classes.delete(n),contains:n=>classes.has(n),toggle:(n,f)=>{const on=f===undefined?!classes.has(n):Boolean(f);on?classes.add(n):classes.delete(n);return on}};
  }
  get textContent(){return this.children.length?this.children.map(c=>c.textContent).join(''):this._text}
  set textContent(v){this._text=String(v);this.children=[]}
  append(...n){n.forEach(c=>{c.parent=this;this.children.push(c)})}
  prepend(n){n.parent=this;this.children.unshift(n)}
  replaceChildren(...n){this.children=[];this.append(...n)}
  after(n){const p=this.parent;p.children.splice(p.children.indexOf(this)+1,0,n);n.parent=p}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this)}
  cloneNode(){const c=new El(this.tagName);c.src=this.src;c.className=this.className;return c}
  querySelector(sel){
    const tag=sel.replace(/:last-child$/,'');
    if(sel.endsWith(':last-child')){const match=this.children.filter(c=>c.tagName===tag.toUpperCase());return match.at(-1)||null}
    if(sel.startsWith('.'))return this.children.find(c=>c.className.split(' ').includes(sel.slice(1)))||null;
    return this.children.find(c=>c.tagName===sel.toUpperCase())||null;
  }
}
const has=(el,name)=>el.classList.contains(name);
const findById=(node,id)=>{
  if(node.id===id)return node;
  for(const child of node.children){const hit=findById(child,id);if(hit)return hit}
  return null;
};

function setup(){
  const registry=new Map();
  const make=(id,tag)=>{const e=new El(tag);e.id=id;registry.set(id,e);return e};
  const ourRows=make('draftOurPicks'),theirRows=make('draftTheirPicks');
  const plan=make('simplePregame');
  const review=make('simplePostgameReview');
  review.append(Object.assign(new El(),{className:'coach-review-head'}));

  let handler=null;
  const sandbox={
    // Looks through the whole tree, like the real document, so elements the
    // script creates itself can be found again on the next run.
    document:{getElementById:id=>{for(const root of registry.values()){const hit=findById(root,id);if(hit)return hit}return null},createElement:t=>new El(t)},
    Image:function(){return new El('img')},
    encodeURIComponent,setTimeout,Number,Array,String,Map,
    opCompanion:{getState:()=>new Promise(()=>{}),onState:h=>{handler=h}},
  };
  sandbox.window=sandbox;
  vm.runInContext(source,vm.createContext(sandbox),{filename:'esports-v2.js'});

  const row=(role,name,state)=>{
    const r=new El();
    const a=new El('span'),b=new El('strong'),c=new El('span');
    a.textContent=role;b.textContent=name;c.textContent=state;
    r.append(a,b,c);return r;
  };
  const push=async state=>{handler(state);await new Promise(r=>setTimeout(r,5))};
  return {registry,ourRows,theirRows,plan,review,row,push};
}

const draft=()=>({localPlayerCellId:3,allies:[{cellId:0},{cellId:1},{cellId:2},{cellId:3},{cellId:4}],enemies:[{cellId:5},{cellId:6}]});

/* ------------------------------------------------------------ behaviour --- */

test('champion tiles are added to draft rows, with the right art for awkward names',async()=>{
  const t=setup();
  t.ourRows.append(t.row('TOP','Aatrox','LOCKED'),t.row('JUNGLE','Lee Sin','LOCKED'),t.row('MID','Wukong',''),t.row('ADC','Kai\'Sa','HOVER'),t.row('SUPPORT','Nunu & Willump','LOCKED'));
  await t.push({draft:draft()});
  const src=i=>t.ourRows.children[i].children[0].src;
  assert.match(src(0),/\/tiles\/Aatrox_0\.jpg$/);
  assert.match(src(1),/\/tiles\/LeeSin_0\.jpg$/);
  assert.match(src(2),/\/tiles\/MonkeyKing_0\.jpg$/,'Wukong is MonkeyKing in Data Dragon');
  assert.match(src(3),/\/tiles\/Kaisa_0\.jpg$/);
  assert.match(src(4),/\/tiles\/Nunu_0\.jpg$/);
});

test('an empty slot gets a placeholder, not a broken image',async()=>{
  const t=setup();
  t.theirRows.append(t.row('MID','SELECTING…',''),t.row('ADC','YOU · SELECTING',''));
  await t.push({draft:draft()});
  for(const row of t.theirRows.children){
    assert.equal(row.children[0].textContent,'?');
    assert.ok(row.children[0].className.includes('es-empty'));
  }
});

test('locked rows are flagged and only YOUR row is marked as you',async()=>{
  const t=setup();
  t.ourRows.append(t.row('TOP','Aatrox','LOCKED'),t.row('JUNGLE','Lee Sin','HOVER'),t.row('MID','Ahri','LOCKED'),t.row('ADC','Jinx','LOCKED'),t.row('SUPPORT','Lulu','LOCKED'));
  t.theirRows.append(t.row('TOP','Darius','LOCKED'),t.row('JUNGLE','Viego','LOCKED'));
  await t.push({draft:draft()});
  const ours=t.ourRows.children;
  assert.ok(has(ours[0],'es-locked'));
  assert.ok(!has(ours[1],'es-locked'),'a hover is not a lock');
  assert.ok(has(ours[3],'es-you'),'cell 3 is the local player');
  assert.equal(ours.filter(r=>has(r,'es-you')).length,1);
  assert.equal(t.theirRows.children.filter(r=>has(r,'es-you')).length,0,'an enemy is never "you"');
});

test('running again does not stack tiles',async()=>{
  const t=setup();
  t.ourRows.append(t.row('TOP','Aatrox','LOCKED'));
  await t.push({draft:draft()});
  await t.push({draft:draft()});
  await t.push({draft:draft()});
  assert.equal(t.ourRows.children[0].children.length,4,'tile + role + name + state, once');
});

test('the plan banner gets your art, and the opponent only once it is known',async()=>{
  const t=setup();
  const plan=(source)=>({matchup:{status:'READY',source,champion:'Jinx',opponent:'Caitlyn',plan:{you:{name:'Jinx'},them:{name:'Caitlyn'}}}});
  await t.push(plan('CHAMP_SELECT'));
  assert.ok(has(t.plan,'es-art'));
  assert.ok(has(t.plan,'es-foe'));
  assert.match(t.plan.style.props['--es-you-art'],/splash\/Jinx_0\.jpg/);
  assert.match(t.plan.style.props['--es-them-art'],/splash\/Caitlyn_0\.jpg/);

  await t.push(plan('CHAMPION_HOVER'));
  assert.ok(has(t.plan,'es-art'));
  assert.ok(!has(t.plan,'es-foe'),'a hover preview has no confirmed lane opponent');
});

test('the review gets a scoreboard that follows the coach level, and loses it with the review',async()=>{
  const t=setup();
  const review=depth=>({postGameReview:{coachLevel:{depth},match:{champion:'Jinx',role:'adc',kda:'6/3/9',csPerMin:7.4}}});
  await t.push(review(5));
  const strip=()=>t.review.children.find(c=>c.id==='esStats');
  assert.deepEqual(strip().children.map(c=>c.children[0].textContent),['ROLE','K / D / A','CS / MIN']);

  await t.push(review(1));
  assert.deepEqual(strip().children.map(c=>c.children[0].textContent),['ROLE'],'depth 1 shows no KDA or CS, same as the review itself');

  await t.push({postGameReview:null});
  assert.equal(strip(),undefined);
});

test('missing or partial state never throws',async()=>{
  const t=setup();
  for(const state of [null,{},{draft:null},{draft:{}},{matchup:{status:'LOADING'}},{matchup:{status:'READY'}},{postGameReview:{}},{postGameReview:{match:{}}}])
    await assert.doesNotReject(()=>t.push(state),JSON.stringify(state));
});
