/* Dev-only stand-in for the Electron preload API, so the Companion UI can be
   exercised in a browser. Sample data is illustrative, never shipped. */
(()=>{
  const dna=[
    ['LANING','Laning','#b6f66b',3,62],['WAVES','Waves & CS','#43d8ef',2,48],['VISION','Vision & map','#a68bff',2,31],
    ['OBJECTIVES','Objectives','#e6ad4f',1,74],['TEAMFIGHTS','Teamfights','#f0626a',2,12],['CONSISTENCY','Consistency','#3ddc8c',1,55],
  ].map(([domain,label,color,level,levelProgress])=>({domain,label,color,level,levelProgress,xpIntoLevel:levelProgress,xpForNextLevel:100}));
  const mission={id:'m1',title:'Hold the wave before your first back',domain:'WAVES',progress:66,confirmed:2,required:3,nextGame:'Freeze near your tower from 3:00, then back once the enemy wave arrives.',focusOrder:1,priority:true};
  const mission2={id:'m2',title:'Ward river before 3:15',domain:'VISION',progress:33,confirmed:1,required:3,nextGame:'Place a trinket ward in river before the first scuttle spawns.',focusOrder:2};
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
  const draft={localRole:'MIDDLE',localChampionName:'Ahri',localLockedIn:true,localPlayerCellId:2,
    allies:[{cellId:0,championName:'Ornn',role:'TOP',lockedIn:true},{cellId:1,championName:'Vi',role:'JUNGLE',lockedIn:true},{cellId:2,championName:'Ahri',role:'MIDDLE',lockedIn:true},{cellId:3,championName:'Jinx',role:'BOTTOM',lockedIn:false},{cellId:4,championName:'',role:'UTILITY'}],
    enemies:[{championName:'Syndra',role:'MIDDLE',lockedIn:true},{championName:'Lee Sin',role:'JUNGLE',lockedIn:true},{championName:''},{championName:''},{championName:''}],
    bans:{allies:[{championName:'Zed'},{championName:'Yasuo'}],enemies:[{championName:'LeBlanc'}]}};
  const matchup={status:'READY',champion:'Ahri',opponent:'Syndra',source:'CHAMP_SELECT',role:'MID',
    plan:{you:{name:'Ahri'},them:{name:'Syndra'},role:'MID',rules:['Trade when Syndra spends Q on the wave','Shove at level 3, then look at river','Hold Charm for her E']}};
  const teamPlan={yourJob:'Shove first, then roam to bot when their jungler shows top.',biggestThrow:'Facechecking river without vision after 20 minutes.',
    strategyAccess:{tier:'PLUS',paidStrategy:true},missionTips:[{cue:'Hold the wave before your first back',title:mission.title}],
    dnaBaseline:{ready:true,games:7,required:3},ourIdentity:'Pick and engage',theirIdentity:'Poke and siege',
    coachLevel:{tier:'EMERALD',depth:3,visiblePoints:3,reviewPoints:2}};
  const review={sessionId:'demo-1',match:{champion:'Ahri',role:'MID',kda:'7/2/9',csPerMin:7.8},source:'RIOT_MATCH',
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
    'Champ select · hovering':{...base,phase:'CHAMP_SELECT',detail:'Champ select detected. Reading the live draft — hover a champion for a preview.',playerHome:home(),draft:{...draft,localLockedIn:false,allies:draft.allies.map(p=>({...p,lockedIn:false}))},matchup:{...matchup,source:'CHAMPION_HOVER',provisional:true},teamPlan},
    'Champ select · locked':{...base,phase:'CHAMP_SELECT',detail:'Champ select detected. Reading the live draft.',playerHome:home(),draft,matchup,teamPlan},
    'In game':{...base,phase:'RECORDING',detail:'Match detected. Recording quietly in the background.',playerHome:home(),matchup,teamPlan},
    'Building review':{...base,phase:'UPLOADING',detail:'Match finished. Pulling out the key good points and critical points.',playerHome:home()},
    'Review ready':{...base,phase:'REVIEW',detail:'Your review is ready.',playerHome:home(),postGameReview:review},
    'Tracker error':{...base,phase:'ERROR',trackerRunning:false,detail:'Tracker could not start.',playerHome:home()},
  };

  let current=SCENARIOS['Home · missions (PLUS)'];
  let updateState={status:'CURRENT',currentVersion:'0.10.5',latestVersion:null,progress:0};
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
