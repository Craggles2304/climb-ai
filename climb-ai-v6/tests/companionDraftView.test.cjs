const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

/*
 * Runs the SHIPPED Champion Select and Match Preparation views (oc-ui.js +
 * draft-view.js) against the draft the tracker emits (pregame-normalizer.mjs)
 * and the champion-plan payload. Unknown picks stay unknown; plan fields the
 * server withholds for a tier are shown as locked, never filled in.
 */

const electron=path.join(process.cwd(),'companion/electron');
const ocUi=fs.readFileSync(path.join(electron,'oc-ui.js'),'utf8');
const draftView=fs.readFileSync(path.join(electron,'draft-view.js'),'utf8');
const html=fs.readFileSync(path.join(electron,'index.html'),'utf8');

function makeViews(){
  const window={};
  const context=vm.createContext({window,localStorage:{getItem:()=>null,setItem(){}},console,JSON,Math,Number,String,Array,Object,Boolean,Date,Set});
  vm.runInContext(ocUi,context);
  vm.runInContext(draftView,context);
  return(route,state)=>{
    const root={dataset:{},innerHTML:'',querySelectorAll:()=>[]};
    const shown=window.ocViews[route].render(root,state,{go(){},route,api:{}});
    return{shown,html:root.innerHTML};
  };
}

const pick=(championName,role,cellId,lockedIn=true,selectionState=lockedIn?'LOCKED':championName?'HOVER':'WAITING')=>({championName,role,cellId,lockedIn,selectionState});
const fullDraft=()=>({phase:'BAN_PICK',localRole:'ADC',localChampionName:'Jinx',localLockedIn:true,localPlayerCellId:3,
  allies:[pick('Aatrox','TOP',0),pick('Lee Sin','JUNGLE',1),pick('Ahri','MID',2),pick('Jinx','ADC',3),pick('Lulu','SUPPORT',4,false)],
  enemies:[pick('Darius',null,5),pick('Viego',null,6),pick(null,null,7,false),pick(null,null,8,false),pick(null,null,9,false)],
  bans:{allies:[{championName:'Yone'}],enemies:[{championName:'Samira'}]}});
const steps5=[{label:'LANE',value:'Farm safely'},{label:'MOVE',value:'Group with Lulu'},{label:'VISION',value:'Ward dragon'},{label:'FIGHT',value:'Hit the front line'},{label:'CONVERT',value:'Take dragon'}];
function teamPlan(tier){
  const paid=tier!=='FREE',deep=tier==='PRO';
  return{coachLevel:{tier:'SILVER',depth:3},yourJob:'Stay safe and hit the nearest safe target.',
    strategyAccess:{tier,paidStrategy:paid,deepStrategy:deep},
    ourWinCondition:paid?'Stall, scale, teamfight around Lulu.':null,
    theirWinCondition:paid?'Dive Jinx before she scales.':null,
    biggestThrow:paid?'Chasing into Darius.':null,
    roleWinCondition:paid?{role:'ADC',compPlan:'Protect the carry',steps:steps5}:null,
    compositionRead:deep?{firstContact:['Leona'],protectors:['Lulu'],enemyThreats:['Darius'],fightGeometry:'Fight in choke points.',matchupRule:'Never face-check.'}:null,
    missionTips:[{cue:'Back with the wave',title:'Hold the wave'}],dnaBaseline:{ready:true,games:5,required:3}};
}
const plan={role:'ADC',you:{name:'Jinx'},them:{name:'Caitlyn'},rules:['Stay behind minions to level 2.','Trade after Leona engages.','Stay with Lulu.']};
const matchup=(over={})=>({status:'READY',source:'CHAMP_SELECT',champion:'Jinx',opponent:'Caitlyn',role:'ADC',plan,...over});
const state=over=>({paired:true,phase:'CHAMP_SELECT',draft:fullDraft(),matchup:matchup(),teamPlan:teamPlan('PLUS'),...over});

test('the draft board shows all ten slots, who is you, lock state and bans',()=>{
  const render=makeViews();
  const {shown,html:out}=render('draft',state());
  assert.equal(shown,true);
  assert.equal((out.match(/class="oc-slot /g)||[]).length,10);
  assert.match(out,/Jinx · Locked in/);
  assert.match(out,/is-ally is-you is-locked/);
  assert.match(out,/<b class="oc-num">6<small>\/10<\/small><\/b>/,'4 ally + 2 enemy picks are locked');
  assert.match(out,/2\/5 enemy picks revealed/);
  assert.match(out,/Banned: Yone/);
  assert.match(out,/Banned: Samira/);
  assert.match(out,/Hovering/,'an ally still choosing is shown hovering');
});

test('unknown enemy picks stay unknown and never get art or a role',()=>{
  const render=makeViews();
  const {html:out}=render('draft',state());
  assert.equal((out.match(/Not revealed/g)||[]).length>=3,true);
  const enemies=out.slice(out.indexOf('oc-team--enemy'));
  assert.doesNotMatch(enemies,/Role unknown|TOP|JUNGLE/);
  assert.equal((enemies.match(/tiles\/Darius_0\.jpg/g)||[]).length,1);
});

test('each role the tracker can send is labelled on the board',()=>{
  const render=makeViews();
  for(const [sent,shown] of Object.entries({TOP:'Top',JUNGLE:'Jungle',MIDDLE:'Mid',MID:'Mid',BOTTOM:'ADC',ADC:'ADC',UTILITY:'Support',SUPPORT:'Support'})){
    const out=render('draft',state({draft:{...fullDraft(),localRole:sent}})).html;
    assert.match(out,new RegExp(`${shown} lane`),`${sent} should read ${shown}`);
  }
  const neutral=render('draft',state({draft:{...fullDraft(),localRole:null,localChampionName:null,localLockedIn:false}})).html;
  assert.match(neutral,/Draft in progress/);
});

test('a hover preview never invents the lane opponent',()=>{
  const render=makeViews();
  const out=render('draft',state({draft:{...fullDraft(),localLockedIn:false,enemies:[],allies:[]},matchup:matchup({source:'CHAMPION_HOVER',provisional:true,opponent:null})})).html;
  assert.match(out,/Hovering Jinx/);
  assert.match(out,/Lane opponent not revealed yet/);
  assert.match(out,/>Preview</);
  assert.match(out,/Jinx game plan/);
  assert.doesNotMatch(out,/Caitlyn/);
});

test('PLUS: win conditions, the biggest throw and three actions from the role win path',()=>{
  const render=makeViews();
  const out=render('prep',state()).html;
  for(const text of ['Our win condition','Stall, scale, teamfight around Lulu.','Their win condition','Dive Jinx before she scales.','Avoid · biggest throw','Chasing into Darius.','Three important actions','Farm safely','Group with Lulu → Ward dragon','Hit the front line → Take dragon','Back with the wave'])
    assert.ok(out.includes(text),text);
  assert.match(out,/Why this plan works, the full composition read, is part of PRO/);
});

test('FREE: the paid match read is explained as locked, never filled with generic text',()=>{
  const render=makeViews();
  const out=render('prep',state({teamPlan:teamPlan('FREE')})).html;
  assert.match(out,/part of the PLUS match read/);
  assert.match(out,/oc-tier--plus/);
  assert.doesNotMatch(out,/Our win condition<\/span>/);
  assert.doesNotMatch(out,/biggest throw<\/span>/);
  assert.doesNotMatch(out,/ARRIVE FIRST|Create the first clean advantage/i);
  // The simple plan still works on FREE: lane rules become the actions.
  assert.match(out,/Stay behind minions to level 2\./);
  assert.match(out,/Stay safe and hit the nearest safe target\./);
});

test('PRO alone gets why this plan works',()=>{
  const render=makeViews();
  const out=render('prep',state({teamPlan:teamPlan('PRO')})).html;
  assert.match(out,/Why this plan works<\/summary>/);
  assert.match(out,/Fight in choke points\./);
  assert.doesNotMatch(out,/is part of PRO/);
});

test('the plan tier comes from membership, never from rank calibration',()=>{
  const render=makeViews();
  const out=render('prep',state({teamPlan:teamPlan('PRO')})).html;
  assert.match(out,/oc-tier--pro">PRO/);
  assert.doesNotMatch(out,/SILVER/);
  const home=render('prep',state({teamPlan:null,matchup:matchup(),playerHome:{tier:'PLUS'}})).html;
  assert.match(home,/oc-tier--plus">PLUS/);
});

test('the plan says whether it is a preview, locked or frozen for the game',()=>{
  const render=makeViews();
  assert.match(render('prep',state()).html,/Plan locked/);
  assert.match(render('prep',state({phase:'RECORDING'})).html,/Frozen for this game/);
  assert.match(render('prep',state({phase:'RECORDING'})).html,/No live shotcalling/);
});

test('baseline games keep the mission honest',()=>{
  const render=makeViews();
  const out=render('prep',state({teamPlan:{...teamPlan('PLUS'),dnaBaseline:{ready:false,games:1,required:3}}})).html;
  assert.match(out,/Baseline game 2 of 3/);
  assert.match(out,/no mission is scored this game/);
  assert.doesNotMatch(out,/Back with the wave/);
});

test('loading and failed plans say so',()=>{
  const render=makeViews();
  assert.match(render('draft',state({matchup:{status:'LOADING'},teamPlan:null})).html,/Building your match plan/);
  assert.match(render('draft',state({matchup:{status:'ERROR',error:'no data'},teamPlan:null})).html,/no data/);
});

test('between games, Match Preparation briefs the next game from real missions and HUD state',()=>{
  const render=makeViews();
  const home={ok:true,baseline:{ready:true,games:5,required:3},missions:[{title:'Hold the wave',domain:'WAVES_CS',nextGame:'Freeze from 3:00.'}]};
  const out=render('prep',{paired:true,phase:'WAITING',playerHome:home,overlay:{enabled:true,layout:{mode:'MINIMAL'}}}).html;
  assert.match(out,/Prepare your next match/);
  assert.match(out,/Freeze from 3:00\./);
  assert.match(out,/Minimal · compact mission/);
  const off=render('prep',{paired:true,phase:'WAITING',playerHome:home,overlay:{enabled:false}}).html;
  assert.match(off,/In-game HUD<\/span>\s*<p class="oc-plan-card__lead">Off/);
});

test('server text is escaped and views stay out of the way without data',()=>{
  const render=makeViews();
  const out=render('draft',state({draft:{...fullDraft(),localChampionName:'<script>x</script>'}})).html;
  assert.doesNotMatch(out,/<script>x/);
  assert.equal(render('draft',{paired:true,phase:'WAITING'}).shown,false);
  assert.equal(render('draft',{paired:false,phase:'CHAMP_SELECT',draft:fullDraft()}).shown,false);
  assert.equal(render('prep',{paired:true,phase:'CHAMP_SELECT'}).shown,false);
});

test('the desktop loads the native draft view and no longer ships the legacy board',()=>{
  assert.match(html,/<script src="draft-view\.js"><\/script>/);
  assert.match(html,/href="draft\.css"/);
  assert.doesNotMatch(html,/id="matchup"|premium-champ-select\.css|lane\.css/);
});
