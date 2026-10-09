const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

/*
 * Runs the SHIPPED Companion Home and My Game DNA views (oc-ui.js +
 * home-view.js) against real-shaped /api/live/companion-home payloads and
 * checks what the player would see. The views only ever show data the server
 * sent: no levels before the baseline and reveal, no LP for unranked players,
 * no missions before baseline 3/3.
 */

const electron=path.join(process.cwd(),'companion/electron');
const ocUi=fs.readFileSync(path.join(electron,'oc-ui.js'),'utf8');
const homeView=fs.readFileSync(path.join(electron,'home-view.js'),'utf8');

function makeViews(storage={}){
  const store=new Map(Object.entries(storage));
  const window={};
  const context=vm.createContext({
    window,
    localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
    console,setTimeout,JSON,Math,Number,String,Array,Object,Boolean,Date,
  });
  vm.runInContext(ocUi,context);
  vm.runInContext(homeView,context);
  const render=(route,state,ctx={})=>{
    const root={dataset:{},innerHTML:'',querySelectorAll:()=>[]};
    const shown=window.ocViews[route].render(root,state,{go(){},route,api:{},...ctx});
    return{shown,html:root.innerHTML};
  };
  return{views:window.ocViews,render,store};
}

const strands=['LANING','WAVES_CS','VISION_MAP','OBJECTIVES','TEAMFIGHTS','CONSISTENCY'].map((domain,i)=>({domain,label:domain,level:i===0?4:1,levelProgress:i===0?40:0,xpIntoLevel:i===0?40:0,xpForNextLevel:100,mastered:0}));
function home(over={}){
  return{ok:true,
    player:{gameName:'Player123',tagline:'EUW',role:'ADC',primaryRole:'ADC',rank:'PLATINUM III',leaguePoints:41},
    tier:'PRO',selectedRole:'ADC',primaryRole:'ADC',tierView:{label:'PLAYER MEMORY',detail:'long-term learning memory'},
    roleProfiles:['TOP','JUNGLE','MID','ADC','SUPPORT'].map(role=>({role,games:role==='ADC'?5:0,required:3,ready:role==='ADC'})),
    baseline:{games:5,required:3,ready:true,role:'ADC'},dna:strands,
    missions:[
      {id:'a',title:'Back with the wave',domain:'WAVES_CS',confirmed:2,required:3,progress:66,meaning:'Crashing waves cost plates.',nextGame:'Freeze from 3:00.',success:'First back on your wave.',focusOrder:1,status:'ACTIVE'},
      {id:'b',title:'Ward river early',domain:'VISION_MAP',confirmed:0,required:3,progress:0,nextGame:'Ward before 3:15.',focusOrder:2,status:'ACTIVE'},
    ],
    masteredCount:3,upgrade:null,...over};
}
const state=(playerHome,over={})=>({paired:true,phase:'WAITING',trackerRunning:true,playerHome,...over});

test('Home shows genuine identity: Riot ID, verified rank and LP, main role and plan',()=>{
  const {render}=makeViews({'op:dna-revealed:ADC':'1'});
  const {shown,html}=render('home',state(home()));
  assert.equal(shown,true);
  assert.match(html,/Player123<span>#EUW<\/span>/);
  assert.match(html,/Platinum III/);
  assert.match(html,/41 LP/);
  assert.match(html,/ADC main/);
  assert.match(html,/oc-tier--pro/);
});

test('unranked players never get an LP figure',()=>{
  const {render}=makeViews();
  const {html}=render('home',state(home({player:{gameName:'New',tagline:'EUW',rank:'UNRANKED',leaguePoints:0,role:'ADC'}})));
  assert.match(html,/Unranked/);
  assert.doesNotMatch(html,/\bLP\b/);
});

test('before the baseline: no levels, no missions, provisional coaching and one baseline action',()=>{
  const {render}=makeViews();
  const baseline=home({baseline:{games:1,required:3,ready:false,role:'ADC'},missions:[],priorityMission:null,
    dna:strands.map(s=>({...s,level:1,levelProgress:0,xpIntoLevel:0}))});
  const {html}=render('home',state(baseline));
  assert.match(html,/Complete your baseline/);
  assert.match(html,/No permanent DNA missions until baseline 3\/3\./);
  assert.match(html,/Provisional coaching/);
  assert.match(html,/game 2 of 3/);
  assert.doesNotMatch(html,/LV \d/);
  assert.doesNotMatch(html,/oc-radar__shape/);
  assert.doesNotMatch(html,/Back with the wave/);
});

test('baseline complete but not revealed: DNA stays hidden behind the reveal',()=>{
  const {render}=makeViews();
  const {html}=render('home',state(home()));
  assert.match(html,/Reveal your Game DNA/);
  assert.doesNotMatch(html,/oc-radar__shape/);
  assert.doesNotMatch(html,/LV \d/);
  const dna=render('dna',state(home())).html;
  assert.match(dna,/data-reveal="ADC"/);
});

test('revealed DNA plots real strand levels and the two unlocked missions with verified reps',()=>{
  const {render}=makeViews({'op:dna-revealed:ADC':'1'});
  const {html}=render('home',state(home()));
  assert.match(html,/oc-radar__shape/);
  assert.match(html,/LV 4/);
  assert.match(html,/Only the two DNA trees you unlocked can bank a proven rep\./);
  assert.match(html,/Unlocked tree 1 of 2/);
  assert.match(html,/Unlocked tree 2 of 2/);
  assert.match(html,/Crashing waves cost plates\./);
  assert.match(html,/Freeze from 3:00\./);
  assert.match(html,/2 of 3 proven games/);
  assert.match(html,/0 of 3 proven games/);
  assert.match(html,/Prepare next match/);
  // A mission with no "why" text never gets an invented one.
  const second=html.slice(html.indexOf('Unlocked tree 2 of 2'));
  assert.doesNotMatch(second.slice(0,second.indexOf('</article>')),/Why it matters/);
});

test('Game DNA stays role-specific and Home names the role',()=>{
  const {render}=makeViews({'op:dna-revealed:ADC':'1'});
  const {html}=render('home',state(home()));
  assert.match(html,/Only ADC games progress these six strands/);
  assert.match(html,/ADC Game DNA/);
});

test('My Game DNA owns role browsing, only while idle',()=>{
  const {render}=makeViews({'op:dna-revealed:ADC':'1'});
  const idle=render('dna',state(home())).html;
  assert.match(idle,/data-role="SUPPORT"/);
  assert.doesNotMatch(idle.match(/<button class="oc-role[^>]*data-role="SUPPORT"[^>]*>/)[0],/disabled/);
  assert.match(idle,/never changes your main role or merges progress/);
  const inGame=render('dna',state(home(),{phase:'RECORDING'})).html;
  assert.match(inGame.match(/<button class="oc-role[^>]*data-role="SUPPORT"[^>]*>/)[0],/disabled/);
  assert.match(inGame,/Role browsing is available between games/);
  assert.doesNotMatch(render('home',state(home())).html,/data-role=/);
  assert.ok(homeView.includes('ctx.api?.setDnaRole?.(role)'));
});

test('the main action follows the match phase',()=>{
  const {render}=makeViews({'op:dna-revealed:ADC':'1'});
  assert.match(render('home',state(home(),{phase:'CHAMP_SELECT'})).html,/data-go="prep">.*Open match plan/s);
  assert.match(render('home',state(home(),{phase:'RECORDING'})).html,/Back to live companion/);
  assert.match(render('home',state(home(),{phase:'REVIEW',postGameReview:{match:{}}})).html,/Review last game/);
});

test('server text is escaped before it reaches the page',()=>{
  const {render}=makeViews();
  const {html}=render('home',state(home({player:{gameName:'<img src=x onerror=alert(1)>',tagline:'"x"',rank:'GOLD I',leaguePoints:5}})));
  assert.doesNotMatch(html,/<img src=x/);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('views stay out of the way when there is nothing real to show',()=>{
  const {render}=makeViews();
  assert.equal(render('home',{paired:false,phase:'SETUP'}).shown,false);
  assert.equal(render('home',state(null)).shown,false);
  assert.equal(render('dna',state({ok:false})).shown,false);
  assert.equal(render('home',state(home(),{tftRecorder:{state:'RECORDING'}})).shown,false);
});
