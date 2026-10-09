'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const assets=path.join(root,'companion/electron');
const script=fs.readFileSync(path.join(assets,'review-esports.js'),'utf8');
const css=fs.readFileSync(path.join(assets,'premium-review.css'),'utf8');

function reviewHarness(){
  const registry=new Map(),all=[],head=[];
  const make=(tag='div')=>{
    const el={tag,children:[],dataset:{},attributes:{},
      style:{setProperty(name,value){this[name]=value}},
      classList:{names:new Set(),add(value){this.names.add(value)},toggle(value,on){if(on)this.names.add(value);else this.names.delete(value)}},
      setAttribute(name,value){this.attributes[name]=value},
      appendChild(child){this.children.push(child);return child},
      append(...children){this.children.push(...children)},
      replaceChildren(...children){this.children=[...children]},
      closest(){return null},
    };
    Object.defineProperty(el,'id',{get(){return this._id||''},set(value){this._id=value;registry.set(value,this)}});
    Object.defineProperty(el,'innerHTML',{get(){return this._html||''},set(markup){
      this._html=markup;
      for(const match of markup.matchAll(/id="([^"]+)"/g)){
        if(!registry.has(match[1])){const child=make('div');child.id=match[1];}
      }
    }});
    all.push(el);return el;
  };
  const section=make('section');section.id='opPostGame332';
  const summary=make('section'),dev=make('section');
  section.children=[summary,dev];
  section.querySelector=selector=>{
    if(selector==='.op333-summary')return summary;
    if(selector==='.op332-development')return dev;
    // Deliberately expose nested children as non-direct anchors. insertBefore
    // must NOT attempt to insert before these.
    if(['.op332-baseline','.op332-main','.op332-neutral'].includes(selector))return make('section');
    return null;
  };
  Object.defineProperty(section,'firstChild',{get(){return this.children[0]}});
  section.insertBefore=(node,before)=>{
    if(before&&!section.children.includes(before))throw Error('DOM insertBefore requires a DIRECT child');
    const index=before?section.children.indexOf(before):section.children.length;
    section.children.splice(index,0,node);
    return node;
  };
  let handleState=null;
  const document={
    getElementById:id=>registry.get(id)||null,
    createElement:tag=>make(tag),
    head:{appendChild(element){head.push(element);return element}},
  };
  const window={
    opCompanion:{
      getState:async()=>({phase:'WAITING'}),
      onState:callback=>{handleState=callback},
    },
  };
  vm.runInNewContext(script,{document,window,console},{filename:'review-esports.js'});
  return{section,registry,all,head,push:state=>handleState(state)};
}

test('postgame review mounts hero, verified missions and timeline as actual top-level siblings',()=>{
  const {section,registry}=reviewHarness();
  assert.deepEqual(section.children.map(el=>el.id||''),['opEsHero','','opEsProof','opEsTimeline','']);
  assert.ok(registry.has('opEsArt'));
  assert.ok(registry.has('opEsProofGrid'));
  assert.ok(registry.has('opEsMoments'));
});

test('Review displays subscription coach badge, accurate clock, decisions and 2 scored DNA missions',()=>{
  const {push,registry,section}=reviewHarness();
  push({phase:'REVIEW',playerHome:{tier:'PRO'},postGameReview:{
    partial:false,coachLevel:{tier:'SILVER',rank:'PLATINUM III'},
    match:{champion:'Jinx',role:'ADC',kda:'8 / 2 / 7',csPerMin:7.4,durationSeconds:1800},
    evidenceCount:2,nextFocus:{title:'Hold frontline distance',rule:'Protect safe damage windows'},
    dnaBaseline:{ready:true,games:4,required:3},
    missionEvidence:[
      {dnaDomain:'TEAMFIGHTS',title:'Safe positioning',evidenceState:'BANKED',confirmed:2,required:3,evidenceReason:'Clean positioning observed.'},
      {dnaDomain:'CONSISTENCY',title:'Reduce early deaths',evidenceState:'NOT_OBSERVED',confirmed:0,required:3},
    ],
    doneWell:[{title:'Good rotation',atSeconds:540,verified:true}],improve:[],
    decisionGraph:{nodes:[
      {title:'Clean reset',verdict:'GOOD',atSeconds:540,minuteLabel:'9:00',decisionRead:'Used the recall window',consequence:'Kept tempo'},
      {title:'Late setup',verdict:'IMPROVE',atSeconds:1400,minuteLabel:'23:20',decisionRead:'Arrived after setup',counterfactual:{alternative:'Reset one wave sooner'}},
      {title:'Unknown',verdict:'NOT_OBSERVED',atSeconds:null},
    ]},markedMoments:[{atSeconds:600,detail:'My bookmark',status:'MATCHED'}],
  }});
  assert.equal(registry.get('opEsCoach').textContent,'PRO COACH'); // rank != plan
  assert.equal(registry.get('opEsReady').textContent,'REVIEW READY');
  assert.equal(registry.get('opEsEvidence').textContent,'2');
  assert.equal(registry.get('opEsNextTitle').textContent,'Hold frontline distance');
  assert.equal(registry.get('opEsProofGrid').children.length,2);
  const [banked,notObserved]=registry.get('opEsProofGrid').children;
  assert.equal(banked.className,'op-es-proof-card banked');
  assert.equal(banked.children[2].children[0].textContent,'BANKED');
  assert.equal(banked.children[3].children[0].style.width,'67%');
  assert.equal(notObserved.className,'op-es-proof-card not-observed');
  assert.equal(notObserved.children[2].children[0].textContent,'NOT OBSERVED');
  assert.equal(registry.get('opEsMoments').children.length,2);
  assert.equal(registry.get('opEsRail').children.length,2); // 1 verified moment + 1 player mark
  assert.equal(registry.get('opEsEndTime').textContent,'30:00');
  assert.equal(section.children.filter(el=>el.id==='opEsHero').length,1);
});

test('baseline and missing review evidence never invent mastery, metrics or game decisions',()=>{
  const {push,registry}=reviewHarness();
  push({phase:'REVIEW',postGameReview:{
    partial:true,match:{champion:'Jinx',role:'ADC'},
    dnaBaseline:{ready:false,games:1,required:3},missionEvidence:[],
    doneWell:[{atSeconds:null,verified:true}],improve:[],
    markedMoments:[{atSeconds:null,detail:'invalid'}],
    decisionGraph:{nodes:[]},
  }});
  assert.equal(registry.get('opEsCoach').textContent,'OP CLIMB COACH');
  assert.equal(registry.get('opEsReady').textContent,'PARTIAL REVIEW');
  assert.equal(registry.get('opEsEvidence').textContent,'—');
  assert.equal(registry.get('opEsProofGrid').children.length,1);
  assert.equal(registry.get('opEsProofGrid').children[0].children[0].textContent,'BASELINE NOT COMPLETE');
  assert.equal(registry.get('opEsMoments').children.length,1);
  assert.match(registry.get('opEsMoments').children[0].textContent,/No time-stamped reviewed decisions/);
  assert.equal(registry.get('opEsRail').children.length,0);
});

test('premium graphical hierarchy uses legible review, timeline, proof and reduced motion styling',()=>{
  const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
  assert.match(html,/premium-review\.css/);
  assert.match(css,/\.op-es-proof-card/);
  assert.match(css,/\.op-es-moment-card/);
  assert.match(css,/\.op333-summary-card/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(script,/review\.evidenceCount!=null/);
  assert.match(script,/review\?\.decisionGraph\?\.nodes/);
  assert.doesNotMatch(script,/PERFORMANCE SCORE|RATING \/ 100/);
});
