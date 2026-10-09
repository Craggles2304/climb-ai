'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

/*
 * Runs the SHIPPED post-game review view (oc-ui.js + review-view.js) against
 * real-shaped /api/live/companion-review payloads. The review shows only what
 * the evidence carries: decisions need a clock to reach the timeline, a moment
 * only offers "what could be improved" when the server sent a counterfactual,
 * missing stats read "Not recorded" and nothing is graded during a baseline.
 */

const electron=path.join(process.cwd(),'companion/electron');
const ocUi=fs.readFileSync(path.join(electron,'oc-ui.js'),'utf8');
const reviewView=fs.readFileSync(path.join(electron,'review-view.js'),'utf8');
const main=fs.readFileSync(path.join(electron,'main.cjs'),'utf8');
const html=fs.readFileSync(path.join(electron,'index.html'),'utf8');

function makeView(){
  const store=new Map();
  const window={};
  const document={body:{classList:{toggle(){},remove(){},contains:()=>false}}};
  const context=vm.createContext({window,document,localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))},console,JSON,Math,Number,String,Array,Object,Boolean,Date});
  vm.runInContext(ocUi,context);
  vm.runInContext(reviewView,context);
  const render=state=>{
    // A minimal root: the moment detail is rendered separately into #ocMomentDetail.
    const detail={className:'',innerHTML:''};
    const root={dataset:{},innerHTML:'',querySelectorAll:()=>[],querySelector:sel=>sel==='#ocMomentDetail'?detail:null};
    const shown=window.ocViews.review.render(root,state,{go(){},route:'review',api:{}});
    return{shown,html:root.innerHTML,detail:detail.innerHTML,receipt:window.__opRenderedReviewSessionId,store};
  };
  return render;
}

const full=()=>({
  sessionId:'s1',partial:false,source:'RIOT_MATCH',coachLevel:{tier:'SILVER',rank:'PLATINUM III'},
  match:{champion:'Jinx',role:'ADC',kda:'8 / 2 / 7',csPerMin:7.4,durationSeconds:1800},
  evidenceCount:2,nextFocus:{title:'Hold frontline distance',rule:'Protect safe damage windows'},
  dnaBaseline:{ready:true,games:4,required:3},
  missionEvidence:[
    {dnaDomain:'TEAMFIGHTS',title:'Safe positioning',evidenceState:'BANKED',confirmed:2,required:3,evidenceReason:'Clean positioning observed.'},
    {dnaDomain:'CONSISTENCY',title:'Reduce early deaths',evidenceState:'NOT_OBSERVED',confirmed:0,required:3},
  ],
  doneWell:[{title:'Good rotation',atSeconds:540,verified:true}],improve:[],
  decisionGraph:{nodeCount:2,summary:{cleanDecisions:1,improveDecisions:1},nodes:[
    {id:'a',title:'Clean reset',verdict:'GOOD',atSeconds:540,minuteLabel:'9:00',decisionRead:'Used the recall window',consequence:'Kept tempo'},
    {id:'b',title:'Late setup',verdict:'IMPROVE',atSeconds:1400,minuteLabel:'23:20',decisionRead:'Arrived after setup',counterfactual:{alternative:'Reset one wave sooner',whyBetter:'Dragon was up in 40s'},evidence:['Arrived at 23:31'],limitation:'Fog of war limits this read.'},
    {id:'c',title:'Unclear',verdict:'IMPROVE',atSeconds:1500,minuteLabel:'25:00',decisionRead:'Took a side wave'},
    {id:'d',title:'Unknown',verdict:'NEUTRAL',atSeconds:null},
  ]},
  markedMoments:[{atSeconds:600,detail:'Nearby recorded fight.',status:'MATCHED'},{atSeconds:null,detail:'invalid'}],
});
const state=(review,over={})=>({paired:true,phase:'REVIEW',playerHome:{tier:'PRO'},postGameReview:review,...over});

test('cinematic header: champion art, role, plan tier from membership and verified stats',()=>{
  const {shown,html:out}=makeView()(state(full()));
  assert.equal(shown,true);
  assert.match(out,/splash\/Jinx_0\.jpg/);
  assert.match(out,/>Jinx</);
  assert.match(out,/oc-tier--pro">PRO/);
  assert.doesNotMatch(out,/SILVER|PLATINUM/,'rank calibration is never shown as the plan');
  for(const value of ['8 / 2 / 7','7.4','30:00','Review ready','Riot match data'])assert.ok(out.includes(value),value);
  assert.match(out,/Decisions reviewed<\/span><span class="oc-stat__value">2</);
  assert.match(out,/1 clean · 1 to review/);
});

test('the timeline shows only clocked good / review decisions and valid bookmarks, in colour',()=>{
  const {html:out}=makeView()(state(full()));
  assert.equal((out.match(/class="oc-tl-marker is-good/g)||[]).length,1);
  assert.equal((out.match(/class="oc-tl-marker is-review/g)||[]).length,2);
  assert.equal((out.match(/class="oc-tl-marker is-mark/g)||[]).length,1,'a bookmark without a clock is dropped');
  assert.doesNotMatch(out,/Unknown/,'neutral or unclocked decisions are not drawn');
  assert.match(out,/1 good/);assert.match(out,/2 to review/);assert.match(out,/1 bookmarked/);
});

test('a moment explains what happened, why it mattered and, only with a counterfactual, what to improve',()=>{
  const {detail}=makeView()(state(full()));
  // The first decision to review is selected by default.
  assert.match(detail,/Needs review/);
  assert.match(detail,/Late setup/);
  assert.match(detail,/What happened[\s\S]*Arrived after setup/);
  assert.match(detail,/What could be improved[\s\S]*Reset one wave sooner/);
  assert.match(detail,/Dragon was up in 40s/);
  assert.match(detail,/Recorded evidence[\s\S]*Arrived at 23:31/);
  assert.match(detail,/Fog of war limits this read\./);
  assert.doesNotMatch(detail,/Why it mattered/,'no consequence was recorded, so none is shown');
  // The other review moment has no counterfactual: no improvement is invented.
  const second=makeView();
  const review=full();review.decisionGraph.nodes=review.decisionGraph.nodes.filter(n=>n.id==='c');
  assert.doesNotMatch(second(state(review)).detail,/What could be improved/);
});

test('mission proof shows banked and not-observed states honestly',()=>{
  const {html:out}=makeView()(state(full()));
  assert.match(out,/Proven this game/);
  assert.match(out,/Not observed/);
  assert.match(out,/2 of 3/);
  assert.match(out,/Not observed is neutral, never a failure/);
  assert.match(out,/Teamfights/);
});

test('partial baselines never invent stats, decisions or mission grades',()=>{
  const {html:out}=makeView()(state({sessionId:'s2',partial:true,match:{champion:'Jinx',role:'ADC'},
    dnaBaseline:{ready:false,games:1,required:3},missionEvidence:[],doneWell:[{atSeconds:null,verified:true,title:'x'}],improve:[],
    markedMoments:[{atSeconds:null,detail:'invalid'}],decisionGraph:{nodes:[]}},{playerHome:null}));
  assert.match(out,/Partial recording/);
  assert.equal((out.match(/Not recorded/g)||[]).length,4,'KDA, CS, duration and decisions are all unrecorded');
  assert.match(out,/No time-stamped decisions/);
  assert.match(out,/This review is provisional/);
  assert.doesNotMatch(out,/Mission proof/,'missions are not graded during a baseline');
  assert.doesNotMatch(out,/oc-tier--/,'no plan tier is shown without one');
});

test('unverified review points stay visibly unverified',()=>{
  const review=full();
  review.doneWell=[{title:'Positive 1 not verified',detail:'OP CLIMB will not invent praise.',verified:false}];
  const {html:out}=makeView()(state(review));
  assert.match(out,/class="is-unverified"/);
  assert.match(out,/OP CLIMB will not invent praise\./);
});

test('rendering leaves the receipt main.cjs needs before marking the review shown',()=>{
  const {receipt,store}=makeView()(state(full()));
  assert.equal(receipt,'s1');
  assert.equal(store.get('oc:review-seen'),'s1');
  assert.match(main,/#ocNative\[data-route="review"\] \.oc-review/);
  assert.ok(main.includes('window.__opRenderedReviewSessionId'));
});

test('the review stays available between games and while it is being built',()=>{
  const render=makeView();
  assert.equal(render(state(full(),{phase:'WAITING'})).shown,true);
  const building=render({paired:true,phase:'UPLOADING',matchup:{champion:'Ahri'}});
  assert.equal(building.shown,true);
  assert.match(building.html,/Building your review/);
  assert.equal(render({paired:true,phase:'WAITING'}).shown,false);
  assert.equal(render({paired:false,phase:'REVIEW',postGameReview:full()}).shown,false);
});

test('server text is escaped and no performance score is invented',()=>{
  const review=full();review.match.champion='<img src=x>';
  const {html:out}=makeView()(state(review));
  assert.doesNotMatch(out,/<img src=x>/);
  assert.doesNotMatch(reviewView,/PERFORMANCE SCORE|RATING \/ 100|winProbability/);
  assert.match(html,/<script src="review-view\.js"><\/script>/);
  assert.match(html,/href="review\.css"/);
});
