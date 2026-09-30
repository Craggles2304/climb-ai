const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

/*
 * The in-game HUD re-renders whenever the page changes: remember-v14 watches
 * the whole document with a MutationObserver and calls render() each time.
 * That is only safe if render() changes NOTHING when there is nothing new to
 * show. If it writes anything unconditionally, the write is itself a page
 * change, the observer fires again, render() writes again, and the browser
 * never gets back to drawing or handling input. The window freezes.
 *
 * compactFrozenPlaybook() did exactly that: it assigned summary.textContent
 * on every render. Assigning textContent replaces the text node even when the
 * text is identical, and that replacement is what the observer sees.
 *
 * This test runs the shipped script against a small fake DOM in which every
 * write to a node's text is counted, lets the page settle, then delivers more
 * observer callbacks with nothing changed. A healthy render writes nothing.
 */

const root=process.cwd();
const source=fs.readFileSync(path.join(root,'companion/electron/remember-v14-focus-layout.js'),'utf8');

class Node_{
  constructor(registry,tag='div'){
    this.registry=registry;this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;
    this.dataset={};this.style={};this.className='';this._id='';this._html='';this._text='';this.textWrites=0;
    const classes=new Set();
    this.classList={add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n),toggle:(n,f)=>{const on=f===undefined?!classes.has(n):Boolean(f);on?classes.add(n):classes.delete(n);return on}};
    this.named=new Map();
  }
  // Every assignment counts, same or not: that is what a real DOM does.
  get textContent(){return this._text}
  set textContent(value){this._text=String(value);this.textWrites+=1}
  get id(){return this._id}
  set id(v){this._id=String(v);this.registry.set(this._id,this)}
  get innerHTML(){return this._html}
  set innerHTML(v){this._html=String(v);for(const m of this._html.matchAll(/\bid="([^"]+)"/g))if(!this.registry.has(m[1]))new Node_(this.registry).id=m[1]}
  appendChild(n){n.parentElement=this;this.children.push(n);return n}
  prepend(n){n.parentElement=this;this.children.unshift(n)}
  insertAdjacentElement(_where,n){return n}
  replaceChildren(...nodes){this.children=nodes}
  querySelector(selector){return this.named.get(selector)||null}
  addEventListener(){}
}

function load(){
  const registry=new Map();
  const mk=(tag,id)=>{const n=new Node_(registry,tag);if(id)n.id=id;return n};

  // The HUD and the frozen-playbook panel that remember-v5 builds inside it.
  const hud=mk('div','opRememberHud');
  const panel=mk('section','opRemFrozenPlaybook');
  const detail=mk('details');
  const summary=mk('summary');
  const detailBody=mk('div');
  detail.named.set('summary',summary);
  detail.named.set('.rem5-coach-detail-body',detailBody);
  panel.named.set('.rem5-coach-detail',detail);

  let observerCallback=null;
  const body=mk('body');body.classList.add('op-remember-live');
  const document={
    body,head:mk('head'),documentElement:mk('html'),
    getElementById:id=>registry.get(id)||null,
    createElement:tag=>mk(tag),
    querySelector:()=>null,querySelectorAll:()=>[],
  };
  class FakeObserver{constructor(cb){observerCallback=cb}observe(){}disconnect(){}}
  const sandbox={
    document,console,localStorage:{getItem:()=>null},MutationObserver:FakeObserver,
    opCompanion:{getState:async()=>({phase:'RECORDING',matchup:null,teamPlan:null}),onState(){return()=>{}}},
  };
  sandbox.window=sandbox;
  const context=vm.createContext(sandbox);
  vm.runInContext(source,context,{filename:'remember-v14-focus-layout.js'});
  return {summary,deliver:()=>observerCallback([])};
}

const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('the playbook summary is labelled once the HUD renders',async()=>{
  const {summary}=load();
  await settle();
  assert.equal(summary.textContent,'DEEP COACH · WHY THIS FITS YOU');
});

test('THE BUG: rendering again with nothing new changes nothing on the page',async()=>{
  const {summary,deliver}=load();
  await settle();
  const writesAfterFirstRender=summary.textWrites;
  assert.ok(writesAfterFirstRender>=1,'the label must be written at least once');

  // The observer fires for any page change. Deliver it repeatedly with no new
  // data. Each delivery that writes would re-trigger the observer in a browser.
  for(let i=0;i<5;i++)deliver();

  assert.equal(summary.textWrites-writesAfterFirstRender,0,
    `summary was rewritten ${summary.textWrites-writesAfterFirstRender} more time(s) with identical text: `
    +'in a browser each rewrite re-triggers the observer, which is an infinite loop');
});

test('the label is restored if another script changes it',async()=>{
  const {summary,deliver}=load();
  await settle();
  summary.textContent='SOMETHING ELSE';
  deliver();
  assert.equal(summary.textContent,'DEEP COACH · WHY THIS FITS YOU');
});
