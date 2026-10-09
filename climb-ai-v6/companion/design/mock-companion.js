/* Dev-only stand-in for the Electron preload API, so the Companion UI can be
   exercised in a browser. Sample data is illustrative, never shipped. */
(()=>{
  const dna=[
    ['LANING','Laning',3,62,1],['WAVES_CS','Waves & CS',2,48,0],['VISION_MAP','Vision & Map',2,31,0],
    ['OBJECTIVES','Objectives',1,74,0],['TEAMFIGHTS','Teamfights',2,12,1],['CONSISTENCY','Consistency',1,55,0],
  ].map(([domain,label,level,levelProgress,mastered])=>({domain,label,level,levelProgress,xpIntoLevel:levelProgress,xpForNextLevel:100,mastered,totalXp:(level-1)*100+levelProgress}));
  const mission={id:'m1',title:'Hold the wave before your first back',domain:'WAVES_CS',progress:66,confirmed:2,required:3,status:'ACTIVE',
    meaning:'Backing on a crashing wave hands the enemy a free plate and pushes your next item back.',
    nextGame:'Freeze near your tower from 3:00, then back once the enemy wave arrives.',
    success:'Your first back happens with the wave on your side in a tracked game.',focusOrder:1,priority:true};
  const mission2={id:'m2',title:'Ward river before 3:15',domain:'VISION_MAP',progress:33,confirmed:1,required:3,status:'ACTIVE',
    meaning:'Most early ganks in your games came from an unwarded river.',
    nextGame:'Place a trinket ward in river before the first scuttle spawns.',
    success:'A river ward is placed before 3:15.',focusOrder:2};
  const roles=['TOP','JUNGLE','MID','ADC','SUPPORT'];
  function home({tier='PLUS',games=7,ready=true}={}){
    return{ok:true,
      player:{gameName:'Sample',tagline:'EUW',role:'MID',primaryRole:'MID',rank:'EMERALD II',leaguePoints:64},
      tier,selectedRole:'MID',primaryRole:'MID',
      roleProfiles:roles.map(role=>role==='MID'?{role,games,required:3,ready}:{role,games:0,required:3,ready:false}),
      tierView:{label:'DEEPER DEVELOPMENT',detail:'2 player-unlocked DNA trees',missionLimit:2},
      baseline:{games,required:3,ready,role:'MID'},
      journey:ready?{phase:'MISSION',status:'DNA ACTIVE',title:mission.title,body:'Mission 1: '+mission.nextGame,progress:'2 UNLOCKED TREES'}
        :{phase:'BASELINE',status:`BASELINE ${games}/3`,title:`Play baseline game ${games+1}.`,body:'Play normally.',progress:`${games}/3`},
      dna,missions:ready?[mission,mission2]:[],priorityMission:ready?mission:null,
      masteredCount:tier==='PRO'?4:null,
      upgrade:tier==='FREE'?{tier:'PLUS',copy:'Add the 90-day development view.'}:tier==='PLUS'?{tier:'PRO',copy:'Add long-term player memory.'}:null};
  }
  const draft={phase:'BAN_PICK',localRole:'MID',localChampionName:'Ahri',localLockedIn:true,localPlayerCellId:2,localSelectionState:'LOCKED',
    allies:[{cellId:0,championName:'Ornn',role:'TOP',lockedIn:true,selectionState:'LOCKED'},{cellId:1,championName:'Vi',role:'JUNGLE',lockedIn:true,selectionState:'LOCKED'},{cellId:2,championName:'Ahri',role:'MID',lockedIn:true,selectionState:'LOCKED'},{cellId:3,championName:'Jinx',role:'ADC',lockedIn:false,selectionState:'HOVER'},{cellId:4,championName:null,role:'SUPPORT',lockedIn:false,selectionState:'WAITING'}],
    enemies:[{cellId:5,championName:'Syndra',role:null,lockedIn:true,selectionState:'LOCKED'},{cellId:6,championName:'Lee Sin',role:null,lockedIn:true,selectionState:'LOCKED'},{cellId:7,championName:null,role:null,selectionState:'WAITING'},{cellId:8,championName:null,role:null,selectionState:'WAITING'},{cellId:9,championName:null,role:null,selectionState:'WAITING'}],
    bans:{allies:[{championName:'Zed'},{championName:'Yasuo'},{championName:'Katarina'}],enemies:[{championName:'LeBlanc'},{championName:'Kai\'Sa'}]}};
  const earlyDraft={...draft,phase:'PLANNING',localChampionName:null,localLockedIn:false,localSelectionState:'WAITING',
    allies:draft.allies.map(p=>({...p,championName:null,lockedIn:false,selectionState:'WAITING'})),
    enemies:draft.enemies.map(p=>({...p,championName:null,lockedIn:false,selectionState:'WAITING'})),bans:{allies:[],enemies:[]}};
  const matchup={status:'READY',champion:'Ahri',opponent:'Syndra',source:'CHAMP_SELECT',role:'MID',
    plan:{you:{name:'Ahri'},them:{name:'Syndra'},role:'MID',rules:['Trade when Syndra spends Q on the wave','Shove at level 3, then look at river','Hold Charm for her E']}};
  function teamPlan(tier='PLUS'){
    const paid=tier!=='FREE',deep=tier==='PRO';
    return{yourJob:'Shove first, then roam to bot when their jungler shows top.',
      ourIdentity:'Pick and engage',theirIdentity:'Poke and siege',
      teamfight:{label:'PICK',summary:'Find one pick with Charm before objectives, then force the 5v4.'},
      sidelane:{label:'SIDE',summary:'Ornn holds top so you and Vi can play around river.'},
      strategyAccess:{tier,paidStrategy:paid,deepStrategy:deep},
      ourWinCondition:paid?'Catch one target with Ahri and Vi before dragon, then take the objective 5v4.':null,
      theirWinCondition:paid?'They poke you down from range and siege towers before you can engage.':null,
      biggestThrow:paid?'Walking into river without vision after 20 minutes.':null,
      roleWinCondition:paid?{role:'MID',compPlan:'Pick composition',lossCondition:'They siege mid before you find a pick.',steps:[
        {label:'LANE',value:'Shove at level 3'},{label:'MOVE',value:'Roam bot with Vi'},{label:'VISION',value:'Ward river before dragon'},{label:'FIGHT',value:'Charm the first target in range'},{label:'CONVERT',value:'Take dragon, then reset'}]}:null,
      compositionRead:deep?{firstContact:['Vi','Ahri'],protectors:['Ornn'],enemyThreats:['Syndra','Lee Sin'],
        fightGeometry:'Fight in the river jungle, where Syndra cannot poke freely.',matchupRule:'Do not fight on open mid lane against their siege.'}:null,
      adaptiveBuild:{patch:'14.24.1',core:[{id:6655,name:'Luden\'s Companion',slot:'CORE'},{id:4645,name:'Shadowflame',slot:'CORE'}],boots:{id:3020,name:'Sorcerer\'s Shoes',slot:'BOOTS'},finish:{id:3157,name:'Zhonya\'s Hourglass',slot:'FINISH'},
        draftItem:{name:'Banshee\'s Veil',why:'if Syndra starts winning lane'}},
      missionTips:[{cue:'Hold the wave before your first back',title:mission.title}],
      dnaBaseline:{ready:true,games:7,required:3},coachLevel:{tier:'EMERALD',depth:3,visiblePoints:3,reviewPoints:2}};
  }
  const node=(id,at,verdict,title,extra={})=>({id,atSeconds:at,minuteLabel:`${Math.floor(at/60)}:${String(at%60).padStart(2,'0')}`,verdict,confidence:'HIGH',type:'FIGHT',
    title,behaviourLabel:title,situation:'',decisionRead:'',consequence:'',lockedPrinciple:null,planAlignment:'NOT_VERIFIABLE',evidence:[],counterfactual:null,limitation:'',...extra});
  const decisionGraph={nodeCount:5,summary:{cleanDecisions:3,improveDecisions:2},nodes:[
    node('n1',212,'GOOD','Backed on a frozen wave',{type:'RESET',situation:'Your wave was frozen outside your tower at 3:20.',decisionRead:'You recalled with the enemy wave still arriving.',consequence:'You lost no minions and reached your first item 40 seconds earlier.',evidence:['0 minions lost during recall','Item purchase at 4:05']}),
    node('n2',548,'IMPROVE','Fought into an unseen jungler',{situation:'River was unwarded for 90 seconds.',decisionRead:'You pushed past river to trade with Syndra.',consequence:'Lee Sin collapsed from river and you died, giving up dragon priority.',
      counterfactual:{alternative:'Ward river first, then trade from the side brush.',whyBetter:'Lee Sin had been last seen bot side 40 seconds earlier and was due to arrive.',tradeoff:'You would have lost about four seconds of pressure on the wave.'},evidence:['Death at 9:08','No ward in river for 92 seconds'],limitation:'Fog of war: the review cannot see what you saw on the minimap.'}),
    node('n3',901,'GOOD','Charm opened the dragon fight',{type:'OBJECTIVE',decisionRead:'You charmed the first target in range as Vi engaged.',consequence:'Your team won the fight 4 for 1 and took dragon.',planAlignment:'MATCHED',lockedPrinciple:'Charm the first target in range'}),
    node('n4',1340,'IMPROVE','Late to baron setup',{type:'OBJECTIVE',decisionRead:'You stayed mid to push a wave while your team set up baron.',consequence:'You arrived after the fight started; baron was lost.',counterfactual:{alternative:'Leave the wave and arrive 20 seconds before baron spawns.',whyBetter:'Your plan was built around picks before objectives.',tradeoff:'One wave of minions.'}}),
    node('n5',1620,'GOOD','Clean side-lane shove',{type:'FARM',decisionRead:'You shoved bot with vision and reset safely.',consequence:'Kept pressure without dying.'}),
  ]};
  const review={sessionId:'demo-1',matchId:'m-demo',progressPath:'/ilp?game=m-demo',evidenceCount:5,decisionGraph,
    markedMoments:[{atSeconds:530,status:'MATCHED',detail:'Nearby recorded fight: died to Lee Sin gank.'},{atSeconds:1180,status:'NO_EVIDENCE',detail:'No nearby review evidence was captured for this moment.'}],
    missionEvidence:[{dnaDomain:'WAVES_CS',title:'Hold the wave before your first back',evidenceState:'BANKED',confirmed:3,required:3,evidenceReason:'First back happened with the wave on your side.'},
      {dnaDomain:'VISION_MAP',title:'Ward river before 3:15',evidenceState:'MISSED',confirmed:1,required:3,evidenceReason:'First river ward was placed at 4:40.'}],
    match:{champion:'Ahri',role:'MID',kda:'7/2/9',csPerMin:7.8,durationSeconds:1902},source:'RIOT_MATCH',
    doneWell:[{title:'Backed on a frozen wave twice',detail:'Both backs landed with the wave at your tower.',verified:true}],
    improve:[{title:'Died to the jungler at 14:20 without vision',detail:'River was unwarded for 90 seconds before the gank.'}],
    dnaBaseline:{ready:true,games:7,required:3},
    learningSignal:{status:'REP_BANKED',title:mission.title,confirmed:3,required:3,dnaDomain:'WAVES',progress:100,evidenceState:'VERIFIED'},
    developmentPlan:{primary:{title:'Ward river before 3:15',gameRule:mission2.nextGame,progress:33,dnaDomain:'VISION'}},
    nextFocus:{title:'Ward river before 3:15',rule:mission2.nextGame},coachLevel:{tier:'EMERALD',depth:3,visiblePoints:3,reviewPoints:2}};

  const base={paired:true,trackerRunning:true,autoStart:true,overlay:{enabled:true,layout:{mode:'FOCUS'}},tftRecorder:{available:true,state:'IDLE'},logs:[],matchup:null,teamPlan:null,draft:null,postGameReview:null};
  const SCENARIOS={
    'Unpaired':{...base,paired:false,trackerRunning:false,phase:'SETUP',detail:'Open OP CLIMB and pair this PC to start live tracking.',playerHome:null},
    'Starting':{...base,phase:'STARTING',trackerRunning:false,detail:'Starting OP CLIMB Companion…',playerHome:null},
    'Home · loading':{...base,phase:'WAITING',detail:'Companion is running. Waiting for League.',playerHome:null},
    'Home · baseline 1/3 (FREE)':{...base,phase:'WAITING',detail:'Companion is running. Waiting for League.',playerHome:home({tier:'FREE',games:1,ready:false})},
    'Home · missions (PLUS)':{...base,phase:'WAITING',detail:'League detected. Waiting for champ select or match.',playerHome:home()},
    'Home · PRO':{...base,phase:'WAITING',detail:'League detected. Waiting for champ select or match.',playerHome:home({tier:'PRO'})},
    'Champ select · early':{...base,phase:'CHAMP_SELECT',detail:'Champ select detected. Reading the live draft — hover a champion for a preview.',playerHome:home(),draft:earlyDraft},
    'Champ select · hovering':{...base,phase:'CHAMP_SELECT',detail:'Champ select detected. Reading the live draft — hover a champion for a preview.',playerHome:home(),
      draft:{...draft,localLockedIn:false,localSelectionState:'HOVER',allies:draft.allies.map(p=>p.cellId===2?{...p,lockedIn:false,selectionState:'HOVER'}:p)},matchup:{...matchup,source:'CHAMPION_HOVER',opponent:null,provisional:true},teamPlan:teamPlan()},
    'Champ select · locked':{...base,phase:'CHAMP_SELECT',detail:'Champ select detected. Reading the live draft.',playerHome:home(),draft,matchup,teamPlan:teamPlan()},
    'Champ select · FREE':{...base,phase:'CHAMP_SELECT',detail:'Champ select detected. Reading the live draft.',playerHome:home({tier:'FREE'}),draft,matchup,teamPlan:teamPlan('FREE')},
    'Champ select · PRO':{...base,phase:'CHAMP_SELECT',detail:'Champ select detected. Reading the live draft.',playerHome:home({tier:'PRO'}),draft,matchup,teamPlan:teamPlan('PRO')},
    'In game':{...base,phase:'RECORDING',detail:'Match detected. Recording quietly in the background.',playerHome:home(),draft,matchup,teamPlan:teamPlan()},
    'Building review':{...base,phase:'UPLOADING',detail:'Match finished. Pulling out the key good points and critical points.',playerHome:home()},
    'Review ready':{...base,phase:'REVIEW',detail:'Your review is ready.',playerHome:home(),postGameReview:review},
    'Review · partial baseline':{...base,phase:'REVIEW',detail:'Your review is ready.',playerHome:home({tier:'FREE',games:1,ready:false}),
      postGameReview:{sessionId:'demo-2',partial:true,match:{champion:'Jinx',role:'ADC'},dnaBaseline:{ready:false,games:1,required:3},missionEvidence:[],
        doneWell:[{title:'Positive 1 not verified',detail:'The recording did not capture another decision strong enough to call a genuine positive. OP CLIMB will not invent praise.',verified:false}],
        improve:[{title:'Death from an even state at 12:10',detail:'Stay behind your support until level 6.',atSeconds:730,verified:true}],decisionGraph:{nodes:[]},markedMoments:[]}},
    'Waiting · review unseen':{...base,phase:'WAITING',detail:'League detected. Waiting for champ select or match.',playerHome:home(),postGameReview:{...review,sessionId:'demo-3'}},
    'Tracker error':{...base,phase:'ERROR',trackerRunning:false,detail:'Tracker could not start.',playerHome:home()},
  };

  let current=SCENARIOS['Home · missions (PLUS)'];
  let updateState={status:'CURRENT',currentVersion:'0.11.0',latestVersion:null,progress:0};
  const stateListeners=[],updateListeners=[];
  const ok=()=>Promise.resolve({ok:true});
  window.opCompanion={
    getState:()=>Promise.resolve(current),
    onState:handler=>{stateListeners.push(handler);return()=>{}},
    getUpdateState:()=>Promise.resolve(updateState),
    onUpdateState:handler=>{updateListeners.push(handler);return()=>{}},
    setDnaRole:ok,setOverlayEnabled:ok,editOverlay:ok,cycleOverlay:ok,setTftFocus:ok,unpair:ok,restart:ok,setAutoStart:ok,
    openClimb:()=>{console.info('[mock] openClimb');return ok()},
    openClimbPath:path=>{console.info('[mock] openClimbPath',path);return ok()},
    checkUpdate:ok,downloadUpdate:ok,installUpdate:ok,
    simulateBotLane:()=>Promise.resolve({ok:false}),draftCoach:()=>Promise.resolve({ok:false}),answerIntentProbe:()=>Promise.resolve({ok:false}),recordReadCheckpoint:ok,
    markMoment:()=>Promise.resolve({ok:true}),
    getChampionRoster:()=>Promise.resolve({ok:false,champions:[]}),getChampionGuide:()=>Promise.resolve({ok:false}),
  };
  window.__ocMock={
    scenarios:Object.keys(SCENARIOS),
    set(name){current=SCENARIOS[name];stateListeners.forEach(fn=>fn(current))},
    update(status){updateState={...updateState,status,latestVersion:status==='CURRENT'?null:'0.10.6',progress:42};updateListeners.forEach(fn=>fn(updateState))},
  };

  window.addEventListener('DOMContentLoaded',()=>{
    const panel=document.createElement('div');
    panel.style.cssText='position:fixed;right:12px;bottom:12px;z-index:99999;display:flex;gap:6px;padding:8px;border:1px dashed #e6ad4f;border-radius:8px;background:#000c;font:12px/1 monospace;color:#e6ad4f';
    const select=document.createElement('select');
    Object.keys(SCENARIOS).forEach(name=>{const option=document.createElement('option');option.textContent=name;option.selected=SCENARIOS[name]===current;select.appendChild(option)});
    select.addEventListener('change',()=>window.__ocMock.set(select.value));
    const upd=document.createElement('select');
    ['CURRENT','AVAILABLE','DOWNLOADING','READY'].forEach(name=>{const option=document.createElement('option');option.textContent='update: '+name;option.value=name;upd.appendChild(option)});
    upd.addEventListener('change',()=>window.__ocMock.update(upd.value));
    panel.append('DEV',select,upd);
    document.body.appendChild(panel);
  });
})();
