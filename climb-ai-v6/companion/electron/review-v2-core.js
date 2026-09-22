(()=>{
  const $=id=>document.getElementById(id);
  const STORAGE_KEY='opclimb.locked-game-plan.v1';
  const DEEP_PLAN_STORAGE_KEY='opclimb.deep-locked-plan.v1';

  function clean(value){return String(value||'').replace(/\s+/g,' ').trim()}
  function first(value){return Array.isArray(value)?clean(value.find(Boolean)):clean(value)}
  function safeArray(value){return Array.isArray(value)?value.filter(Boolean):[]}
  function sameChampion(a,b){return clean(a).toLowerCase()===clean(b).toLowerCase()}

  function currentBaseline(state){
    const team=state?.teamPlan||null;
    const matchup=state?.matchup?.plan||null;
    const mission=safeArray(team?.missionTips)[0]||null;
    const champion=clean(matchup?.you?.name||state?.matchup?.champion);
    const yourJob=first(team?.yourJob)||first(matchup?.winCondition)||first(matchup?.rules);
    const winCondition=first(matchup?.winCondition)||first(team?.playAround);
    return{
      version:1,
      champion,
      role:clean(matchup?.role||state?.matchup?.role),
      vsTheirTeam:first(team?.theirWinCondition),
      vsTheirTeamWhy:first(team?.biggestThrow),
      yourWinCondition:yourJob,
      yourWinConditionWhy:winCondition&&winCondition!==yourJob?winCondition:first(team?.playAround),
      missionTitle:clean(mission?.title),
      missionCue:first(mission?.cue),
      missionWhy:first(mission?.evidence),
      capturedAt:new Date().toISOString(),
    };
  }

  function usefulBaseline(value){
    return Boolean(value&&(value.vsTheirTeam||value.yourWinCondition||value.missionCue||value.missionTitle));
  }

  function loadStoredBaseline(){
    try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}
  }

  function loadDeepLockedPlan(){
    try{return JSON.parse(localStorage.getItem(DEEP_PLAN_STORAGE_KEY)||'null')}catch{return null}
  }

  function deepBaseline(review){
    const stored=loadDeepLockedPlan();
    if(!stored?.champion||!stored?.headline)return null;
    const champion=clean(review?.match?.champion);
    if(champion&&!sameChampion(stored.champion,champion))return null;
    const source=clean(stored.source)||'rules';
    const quality=stored.quality||null;
    const threatText=clean(stored.theirPlan)||[
      clean(stored.threatLabel),
      safeArray(stored.threats).map(clean).filter(Boolean).join(' + '),
    ].filter(Boolean).join(' · ');
    const branchHistory=safeArray(stored.branchSelections).map(item=>clean(item?.branch)).filter(Boolean);
    const contingencyHistory=safeArray(stored.contingencySelections).map(item=>clean(item?.contingency)).filter(Boolean);
    const climbMission=stored.climbMission||null;
    const coachingStrategy=stored.coachingStrategy||null;
    const coachIntervention=stored.coachIntervention||null;
    return{
      version:2,
      champion:clean(stored.champion),
      role:clean(stored.role),
      vsTheirTeam:threatText,
      vsTheirTeamWhy:clean(stored.threatAnswer),
      yourWinCondition:clean(stored.headline),
      yourWinConditionWhy:[
        clean(stored.why),
        clean(stored.fightTrigger)?'FIGHT: '+clean(stored.fightTrigger):'',
        clean(stored.objectiveSetup)?'OBJECTIVE: '+clean(stored.objectiveSetup):'',
      ].filter(Boolean).join(' · '),
      deepPlan:true,
      deepSource:source,
      deepQuality:quality,
      selectedBranch:clean(stored.selectedBranch),
      branchHistory,
      selectedContingency:clean(stored.selectedContingency),
      contingencyHistory,
      missionTitle:clean(coachIntervention?.methodLabel?('COACH TWIN · '+coachIntervention.methodLabel):climbMission?.title),
      missionCue:clean(coachIntervention?.primaryCue||climbMission?.cue||climbMission?.action),
      missionWhy:clean(coachIntervention?.whyThisMethod||climbMission?.whyThisGame),
      strategyMode:clean(coachingStrategy?.mode),
      strategyTitle:clean(coachingStrategy?.title),
      strategyWhy:clean(coachingStrategy?.decision),
      capturedAt:clean(stored.capturedAt),
    };
  }

  function rememberLockedPlan(state){
    const phase=String(state?.phase||'');
    const next=currentBaseline(state);
    if(phase==='CHAMP_SELECT'&&usefulBaseline(next)){
      try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next))}catch{}
      return next;
    }
    if(phase==='RECORDING'&&usefulBaseline(next)){
      const stored=loadStoredBaseline();
      if(!usefulBaseline(stored)||!stored.champion||!next.champion||!sameChampion(stored.champion,next.champion)){
        try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next))}catch{}
        return next;
      }
    }
    return loadStoredBaseline();
  }

  function reviewBaseline(state,review){
    const live=currentBaseline(state);
    const stored=loadStoredBaseline();
    const deep=deepBaseline(review);
    const champion=clean(review?.match?.champion);
    const fallback=usefulBaseline(stored)&&(!champion||!stored.champion||sameChampion(stored.champion,champion))
      ?stored
      :(usefulBaseline(live)&&(!champion||!live.champion||sameChampion(live.champion,champion))?live:null);
    if(!deep)return fallback;
    return{
      ...(fallback||{}),
      ...deep,
      missionTitle:clean(deep?.missionTitle||fallback?.missionTitle),
      missionCue:clean(deep?.missionCue||fallback?.missionCue),
      missionWhy:clean(deep?.missionWhy||fallback?.missionWhy),
    };
  }

  function install(){
    if($('opPostGame332'))return $('opPostGame332');
    const style=document.createElement('style');
    style.id='op-review-332-style';
    style.textContent=`
#simplePostgameReview.op-superseded{display:none!important}.op334-recognition{margin-top:10px;border:1px solid rgba(67,140,255,.20);background:linear-gradient(135deg,rgba(67,140,255,.045),rgba(4,8,12,.72))}.op334-recognition>summary{cursor:pointer;list-style:none;padding:11px 13px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center}.op334-recognition>summary::-webkit-details-marker{display:none}.op334-recognition>summary span{color:#8fbaff;font-size:7px;letter-spacing:.16em;font-weight:950;text-transform:uppercase}.op334-recognition>summary strong{font-size:10px;letter-spacing:.08em;text-transform:uppercase}.op334-recognition>summary small{color:#667680;font-size:7px;letter-spacing:.09em;text-transform:uppercase}.op334-recognition.good{border-color:rgba(214,255,47,.26);background:linear-gradient(135deg,rgba(214,255,47,.035),rgba(4,8,12,.72))}.op334-recognition.good>summary span{color:#d6ff2f}.op334-recognition.review{border-color:rgba(255,118,95,.28);background:linear-gradient(135deg,rgba(255,118,95,.035),rgba(4,8,12,.72))}.op334-recognition.review>summary span{color:#ff8c78}.op334-recognition-list{padding:0 13px 12px;display:grid;gap:5px}.op334-read{display:grid;grid-template-columns:44px minmax(0,1fr) 92px;gap:9px;align-items:start;padding:8px 0;border-top:1px solid rgba(255,255,255,.055)}.op334-read-time{font-size:11px;font-weight:950;color:#8fbaff}.op334-read-copy b{display:block;font-size:9px;letter-spacing:.05em;text-transform:uppercase}.op334-read-copy p{margin:3px 0 0;color:#82909a;font-size:8px;line-height:1.4}.op334-read-copy small{display:block;margin-top:4px;color:#56636c;font-size:6px;line-height:1.35;text-transform:uppercase}.op334-read-state{justify-self:end;padding:4px 6px;border:1px solid rgba(255,255,255,.11);font-size:6px;letter-spacing:.1em;font-weight:900;text-transform:uppercase}.op334-read.supported .op334-read-state{color:#d6ff2f;border-color:rgba(214,255,47,.25)}.op334-read.review .op334-read-state{color:#ff8c78;border-color:rgba(255,118,95,.28)}.op334-read.not_verifiable .op334-read-state{color:#8b98a1}.op333-summary{margin-top:16px;display:grid;gap:10px}.op333-scorebar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.op333-stat{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.018);padding:11px 12px}.op333-stat span{display:block;color:#67747d;font-size:7px;letter-spacing:.14em;font-weight:900;text-transform:uppercase}.op333-stat strong{display:block;margin-top:5px;font-size:20px;line-height:1}.op333-stat.good strong{color:#d6ff2f}.op333-stat.fix strong{color:#ff8c78}.op333-summary-grid{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:9px}.op333-summary-card{border:1px solid rgba(255,255,255,.09);background:rgba(5,9,12,.72);padding:14px;min-height:118px}.op333-summary-card.win{border-top:2px solid #d6ff2f}.op333-summary-card.leak{border-top:2px solid #ff765f}.op333-summary-card.next{border-top:2px solid #67a8ff}.op333-summary-card span{display:block;color:#71808a;font-size:7px;letter-spacing:.14em;font-weight:900;text-transform:uppercase}.op333-summary-card strong{display:block;margin-top:7px;font-size:13px;line-height:1.35;text-transform:uppercase}.op333-summary-card p{margin:6px 0 0;color:#89959e;font-size:9px;line-height:1.45}.op333-key{margin-top:10px;border:1px solid rgba(255,255,255,.09);padding:14px;background:rgba(5,9,12,.62)}.op333-key-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.op333-key-head span{font-size:8px;letter-spacing:.17em;color:#d6ff2f;font-weight:900;text-transform:uppercase}.op333-key-head small{font-size:7px;letter-spacing:.1em;color:#65727b;text-transform:uppercase}.op333-key-list{display:grid;gap:5px;margin-top:10px}.op333-key-row{display:grid;grid-template-columns:48px minmax(0,1fr) 104px;gap:9px;align-items:center;padding:8px 0;border-top:1px solid rgba(255,255,255,.05)}.op333-key-row:first-child{border-top:0}.op333-key-time{font-size:12px;font-weight:950;color:#d6ff2f}.op333-key-copy b{display:block;font-size:10px;letter-spacing:.05em;text-transform:uppercase}.op333-key-copy p{margin:3px 0 0;color:#84919a;font-size:8px;line-height:1.35}.op333-key-badge{justify-self:end;padding:5px 7px;border:1px solid rgba(255,255,255,.1);font-size:7px;letter-spacing:.1em;font-weight:900;text-transform:uppercase}.op333-key-row.good .op333-key-badge{border-color:rgba(214,255,47,.3);color:#d6ff2f}.op333-key-row.improve .op333-key-badge{border-color:rgba(255,118,95,.3);color:#ff8c78}.op333-details{margin-top:10px;border:1px solid rgba(255,255,255,.08);background:rgba(4,8,12,.42)}.op333-details>summary{cursor:pointer;list-style:none;padding:12px 14px;color:#9ba7af;font-size:8px;letter-spacing:.15em;font-weight:900;text-transform:uppercase}.op333-details>summary::-webkit-details-marker{display:none}.op333-details>summary:after{content:' +';float:right;color:#d6ff2f}.op333-details[open]>summary:after{content:' −'}.op333-details-body{padding:0 12px 12px}.op333-details .op332-baseline,.op333-details .op332-main,.op333-details .op332-neutral,.op333-details .op332-graph,.op333-details .op332-premortem,.op333-details .op332-simulation,.op333-details .op332-memory,.op333-details .op332-transfer,.op333-details .op332-response,.op333-details .op332-counter,.op333-details .op332-development{margin-top:10px}#opPostGame332{margin-top:14px;padding:22px;background:linear-gradient(180deg,rgba(11,16,20,.99),rgba(7,11,14,.99));border:1px solid rgba(255,255,255,.08)}#opPostGame332.hidden{display:none!important}.op332-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}.op332-kicker{font-size:8px;letter-spacing:.21em;font-weight:900;color:#d6ff2f;text-transform:uppercase}.op332-head h2{font-size:clamp(30px,5vw,48px);margin:5px 0 5px;letter-spacing:-.045em;text-transform:uppercase}.op332-sub{margin:0;color:#7f8c97;font-size:11px;line-height:1.5}.op332-pill{border:1px solid rgba(214,255,47,.25);color:#d6ff2f;padding:8px 10px;font-size:8px;letter-spacing:.16em;font-weight:900;text-transform:uppercase}.op332-baseline{margin-top:18px;border-top:1px solid rgba(255,255,255,.08);padding-top:15px}.op332-section-label{font-size:8px;letter-spacing:.18em;font-weight:900;color:#73808b;text-transform:uppercase;margin-bottom:10px}.op332-baseline-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.op332-plan{border:1px solid rgba(255,255,255,.08);padding:13px;background:rgba(255,255,255,.018);min-height:122px}.op332-plan.mission{border-color:rgba(214,255,47,.2);background:rgba(214,255,47,.03)}.op332-plan span{display:block;font-size:8px;letter-spacing:.15em;color:#d6ff2f;font-weight:900;text-transform:uppercase}.op332-plan strong{display:block;margin-top:8px;font-size:12px;line-height:1.45}.op332-plan p{margin:7px 0 0;color:#76838e;font-size:9px;line-height:1.4}.op332-lock-note{margin:9px 0 0;color:#596671;font-size:8px;letter-spacing:.11em;text-transform:uppercase}.op332-main{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}.op332-column{border:1px solid rgba(255,255,255,.08);padding:15px}.op332-column.good{border-top:2px solid #d6ff2f}.op332-column.fix{border-top:2px solid #ff765f}.op332-column h3,.op332-neutral h3{margin:0 0 11px;font-size:13px;letter-spacing:.08em;text-transform:uppercase}.op332-list{display:grid;gap:9px}.op332-point{display:grid;grid-template-columns:25px minmax(0,1fr);gap:9px;padding:8px 0;border-top:1px solid rgba(255,255,255,.055)}.op332-point:first-child{border-top:0;padding-top:1px}.op332-point i{font-style:normal;width:22px;height:22px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.13);font-size:10px;font-weight:900}.op332-point b{display:block;font-size:11px;line-height:1.35}.op332-point p{margin:4px 0 0;font-size:10px;line-height:1.45;color:#87939d}.op332-point small{display:block;margin-top:5px;font-size:7px;letter-spacing:.12em;text-transform:uppercase;color:#596671}.op332-point.unverified{opacity:.52}.op332-neutral{margin-top:12px;border:1px solid rgba(67,140,255,.22);padding:15px}.op332-graph{margin-top:12px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(180deg,rgba(10,15,19,.92),rgba(5,9,12,.92));padding:15px}.op332-graph-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.op332-graph-head span{font-size:8px;letter-spacing:.17em;color:#d6ff2f;font-weight:900;text-transform:uppercase}.op332-graph-head small{font-size:7px;letter-spacing:.11em;color:#64717a;text-transform:uppercase}.op332-graph-list{display:grid;gap:8px;margin-top:11px}.op332-node{display:grid;grid-template-columns:54px minmax(0,1fr) 118px;gap:10px;align-items:start;border-top:1px solid rgba(255,255,255,.055);padding-top:9px}.op332-node:first-child{border-top:0;padding-top:0}.op332-node-time{font-size:13px;font-weight:950;color:#d6ff2f}.op332-node-body b{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.07em}.op332-node-body p{margin:4px 0 0;color:#8a969f;font-size:9px;line-height:1.45}.op332-node-proof{display:block;margin-top:5px;color:#596671;font-size:7px;line-height:1.4}.op332-node-state{text-align:right}.op332-node-state strong{display:inline-block;padding:5px 7px;border:1px solid rgba(255,255,255,.11);font-size:7px;letter-spacing:.11em;text-transform:uppercase}.op332-node.good .op332-node-state strong{border-color:rgba(214,255,47,.28);color:#d6ff2f}.op332-node.improve .op332-node-state strong{border-color:rgba(255,118,95,.3);color:#ff8c78}.op332-node-state small{display:block;margin-top:6px;color:#66737c;font-size:6px;letter-spacing:.1em;text-transform:uppercase}.op332-premortem{margin-top:12px;border:1px solid rgba(255,184,76,.22);background:linear-gradient(135deg,rgba(255,184,76,.045),rgba(4,8,12,.78));padding:15px}.op332-premortem-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.op332-premortem-head span{font-size:8px;letter-spacing:.17em;color:#ffbb57;font-weight:900;text-transform:uppercase}.op332-premortem-status{font-size:9px;letter-spacing:.12em;font-weight:950;color:#e9eef1;text-transform:uppercase}.op332-premortem-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:11px}.op332-premortem-card{border:1px solid rgba(255,255,255,.08);background:rgba(4,8,12,.58);padding:11px;min-width:0}.op332-premortem-card.beat{border-color:rgba(214,255,47,.27)}.op332-premortem-card.hit{border-color:rgba(255,118,95,.28)}.op332-premortem-card.mixed{border-color:rgba(255,184,76,.28)}.op332-premortem-card>span{display:block;color:#687680;font-size:6px;letter-spacing:.13em;text-transform:uppercase}.op332-premortem-card strong{display:block;margin-top:5px;font-size:10px;line-height:1.3;text-transform:uppercase}.op332-premortem-card b{display:inline-block;margin-top:8px;padding:4px 6px;border:1px solid rgba(255,255,255,.1);font-size:7px;letter-spacing:.1em;text-transform:uppercase}.op332-premortem-card.beat b{color:#d6ff2f}.op332-premortem-card.hit b{color:#ff8c78}.op332-premortem-card.mixed b{color:#ffbb57}.op332-premortem-card p{margin:6px 0 0;color:#87949d;font-size:8px;line-height:1.4}.op332-premortem-proof{display:block;margin-top:9px;color:#596671;font-size:6px;line-height:1.4;letter-spacing:.08em;text-transform:uppercase}.op332-simulation{margin-top:12px;border:1px solid rgba(83,161,255,.24);background:linear-gradient(135deg,rgba(83,161,255,.05),rgba(4,8,12,.78));padding:15px}.op332-simulation-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.op332-simulation-head span{font-size:8px;letter-spacing:.17em;color:#74b5ff;font-weight:900;text-transform:uppercase}.op332-simulation-status{font-size:9px;letter-spacing:.12em;font-weight:950;color:#dce6ed;text-transform:uppercase}.op332-simulation-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:11px}.op332-simulation-card{border:1px solid rgba(255,255,255,.08);background:rgba(4,8,12,.58);padding:11px;min-width:0}.op332-simulation-card.beat,.op332-simulation-card.executed{border-color:rgba(214,255,47,.27)}.op332-simulation-card.repeat,.op332-simulation-card.missed{border-color:rgba(255,118,95,.28)}.op332-simulation-card.mixed{border-color:rgba(255,184,76,.28)}.op332-simulation-card>span{display:block;color:#687680;font-size:6px;letter-spacing:.13em;text-transform:uppercase}.op332-simulation-card strong{display:block;margin-top:5px;font-size:10px;line-height:1.3;text-transform:uppercase}.op332-simulation-card b{display:inline-block;margin-top:8px;padding:4px 6px;border:1px solid rgba(255,255,255,.1);font-size:7px;letter-spacing:.1em;text-transform:uppercase}.op332-simulation-card.beat b,.op332-simulation-card.executed b{color:#d6ff2f}.op332-simulation-card.repeat b,.op332-simulation-card.missed b{color:#ff8c78}.op332-simulation-card.mixed b{color:#ffbb57}.op332-simulation-card p{margin:6px 0 0;color:#87949d;font-size:8px;line-height:1.4}.op332-simulation-proof{display:block;margin-top:9px;color:#596671;font-size:6px;line-height:1.4;letter-spacing:.08em;text-transform:uppercase}.op332-memory{margin-top:12px;border:1px solid rgba(214,255,47,.22);background:linear-gradient(135deg,rgba(214,255,47,.045),rgba(4,8,12,.78));padding:15px}.op332-memory.executed{border-color:rgba(214,255,47,.34)}.op332-memory.missed{border-color:rgba(255,118,95,.30);background:linear-gradient(135deg,rgba(255,118,95,.04),rgba(4,8,12,.78))}.op332-memory-head span{font-size:8px;letter-spacing:.17em;color:#d6ff2f;font-weight:900;text-transform:uppercase}.op332-memory-status{margin-top:5px;font-size:10px;letter-spacing:.1em;font-weight:950;text-transform:uppercase}.op332-memory-grid{display:grid;grid-template-columns:.8fr 1.25fr 1.25fr;gap:8px;margin-top:11px}.op332-memory-card{border:1px solid rgba(255,255,255,.08);background:rgba(4,8,12,.56);padding:12px}.op332-memory-card b{display:block;color:#687680;font-size:6px;letter-spacing:.13em;text-transform:uppercase}.op332-memory-card strong{display:block;margin-top:5px;color:#eef3f6;font-size:10px;line-height:1.4;text-transform:uppercase}.op332-memory-card p{margin:5px 0 0;color:#87949d;font-size:8px;line-height:1.42}.op332-memory-proof{display:block;margin-top:9px;color:#596671;font-size:6px;line-height:1.4;letter-spacing:.08em;text-transform:uppercase}.op332-transfer{margin-top:12px;border:1px solid rgba(74,154,255,.24);background:linear-gradient(135deg,rgba(74,154,255,.045),rgba(4,8,12,.78));padding:15px}.op332-transfer.transferred{border-color:rgba(74,154,255,.42)}.op332-transfer.failed{border-color:rgba(255,118,95,.30);background:linear-gradient(135deg,rgba(255,118,95,.04),rgba(4,8,12,.78))}.op332-transfer-head span{font-size:8px;letter-spacing:.17em;color:#8fbaff;font-weight:900;text-transform:uppercase}.op332-transfer-status{margin-top:5px;font-size:10px;letter-spacing:.1em;font-weight:950;text-transform:uppercase}.op332-transfer-grid{display:grid;grid-template-columns:.8fr 1.1fr 1.25fr;gap:8px;margin-top:11px}.op332-transfer-card{border:1px solid rgba(255,255,255,.08);background:rgba(4,8,12,.56);padding:12px}.op332-transfer-card b{display:block;color:#687680;font-size:6px;letter-spacing:.13em;text-transform:uppercase}.op332-transfer-card strong{display:block;margin-top:5px;color:#eef3f6;font-size:10px;line-height:1.4;text-transform:uppercase}.op332-transfer-card p{margin:5px 0 0;color:#87949d;font-size:8px;line-height:1.42}.op332-transfer-proof{display:block;margin-top:9px;color:#596671;font-size:6px;line-height:1.4;letter-spacing:.08em;text-transform:uppercase}.op332-response{margin-top:12px;border:1px solid rgba(67,140,255,.22);background:linear-gradient(135deg,rgba(67,140,255,.055),rgba(4,8,12,.78));padding:15px}.op332-response.executing{border-color:rgba(214,255,47,.28);background:linear-gradient(135deg,rgba(214,255,47,.05),rgba(4,8,12,.78))}.op332-response.missing{border-color:rgba(255,118,95,.28);background:linear-gradient(135deg,rgba(255,118,95,.045),rgba(4,8,12,.78))}.op332-response-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.op332-response-head span{font-size:8px;letter-spacing:.17em;color:#67a8ff;font-weight:900;text-transform:uppercase}.op332-response.executing .op332-response-head span{color:#d6ff2f}.op332-response.missing .op332-response-head span{color:#ff8c78}.op332-response-status{font-size:9px;letter-spacing:.12em;font-weight:950;text-transform:uppercase;color:#dce6ed}.op332-response-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:10px;margin-top:11px}.op332-response-card{border:1px solid rgba(255,255,255,.08);background:rgba(4,8,12,.56);padding:12px}.op332-response-card b{display:block;color:#697680;font-size:6px;letter-spacing:.13em;text-transform:uppercase}.op332-response-card strong{display:block;margin-top:5px;color:#eef3f6;font-size:11px;line-height:1.35;text-transform:uppercase}.op332-response-card p{margin:5px 0 0;color:#88949d;font-size:9px;line-height:1.45}.op332-response-proof{display:block;margin-top:9px;color:#596671;font-size:6px;line-height:1.4;letter-spacing:.08em;text-transform:uppercase}.op332-counter{margin-top:12px;border:1px solid rgba(214,255,47,.2);background:linear-gradient(135deg,rgba(214,255,47,.035),rgba(4,8,12,.78));padding:15px}.op332-counter-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.op332-counter-head span{font-size:8px;letter-spacing:.17em;color:#d6ff2f;font-weight:900;text-transform:uppercase}.op332-counter-head small{font-size:7px;letter-spacing:.11em;color:#64717a;text-transform:uppercase}.op332-counter-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:11px}.op332-counter-card{border:1px solid rgba(255,255,255,.08);background:rgba(4,8,12,.58);padding:12px;min-width:0}.op332-counter-card:first-child{border-color:rgba(214,255,47,.28)}.op332-counter-card>span{display:block;color:#d6ff2f;font-size:7px;letter-spacing:.14em;font-weight:950;text-transform:uppercase}.op332-counter-card h4{margin:6px 0 8px;font-size:11px;line-height:1.3;text-transform:uppercase}.op332-counter-pair{display:grid;gap:7px}.op332-counter-block{border-top:1px solid rgba(255,255,255,.055);padding-top:7px}.op332-counter-block:first-child{border-top:0;padding-top:0}.op332-counter-block b{display:block;color:#6f7c85;font-size:6px;letter-spacing:.13em;text-transform:uppercase}.op332-counter-block p{margin:4px 0 0;color:#c4cdd3;font-size:9px;line-height:1.42}.op332-counter-block.better p{color:#eaff89;font-weight:800}.op332-counter-boundary{display:block;margin-top:8px;color:#596671;font-size:6px;line-height:1.4;text-transform:uppercase;letter-spacing:.08em}.op332-neutral-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.op332-observation{background:rgba(67,140,255,.035);border:1px solid rgba(67,140,255,.12);padding:12px}.op332-observation b{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.op332-observation p{margin:5px 0 0;color:#87939d;font-size:10px;line-height:1.45}.op332-next{margin-top:12px;border:1px solid rgba(214,255,47,.22);background:rgba(214,255,47,.035);padding:15px}.op332-next span{font-size:8px;letter-spacing:.17em;color:#d6ff2f;font-weight:900;text-transform:uppercase}.op332-next h3{margin:6px 0 4px;font-size:17px}.op332-next p{margin:0;color:#a2adb6;font-size:11px;line-height:1.5}.op332-development{margin-top:12px;border:1px solid rgba(214,255,47,.18);background:linear-gradient(135deg,rgba(214,255,47,.035),rgba(6,10,14,.72));padding:15px}.op332-development-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.op332-development-head span{font-size:8px;letter-spacing:.17em;color:#d6ff2f;font-weight:900;text-transform:uppercase}.op332-dev-status{font-size:8px;letter-spacing:.12em;color:#cdd6dd;font-weight:900;text-transform:uppercase}.op332-dev-copy{margin:7px 0 0;color:#7f8c97;font-size:9px;line-height:1.45}.op332-dev-list{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-top:11px}.op332-dev-card{border:1px solid rgba(255,255,255,.08);background:rgba(4,8,12,.55);padding:10px;min-width:0}.op332-dev-card.primary{border-color:rgba(214,255,47,.32)}.op332-dev-card small{display:block;color:#62707a;font-size:6px;letter-spacing:.12em;text-transform:uppercase}.op332-dev-card b{display:block;margin-top:5px;font-size:9px;line-height:1.35;text-transform:uppercase}.op332-dev-card em{display:block;margin-top:6px;font-style:normal;color:#d6ff2f;font-size:7px;letter-spacing:.08em}.op332-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:12px}.op332-actions button{border:1px solid rgba(255,255,255,.12);background:transparent;color:#cdd6dd;padding:9px 12px;font-size:9px;letter-spacing:.12em;font-weight:900;cursor:pointer}.op332-actions button:disabled{opacity:.55;cursor:wait}@media(max-width:780px){.op334-recognition>summary{grid-template-columns:1fr}.op334-read{grid-template-columns:42px minmax(0,1fr)}.op334-read-state{grid-column:2;justify-self:start}.op333-scorebar,.op333-summary-grid{grid-template-columns:1fr}.op333-key-row{grid-template-columns:42px minmax(0,1fr)}.op333-key-badge{grid-column:2;justify-self:start}.op332-baseline-grid,.op332-main,.op332-neutral-grid,.op332-dev-list,.op332-counter-list,.op332-response-grid,.op332-premortem-list,.op332-simulation-list,.op332-memory-grid,.op332-transfer-grid{grid-template-columns:1fr}.op332-node{grid-template-columns:45px minmax(0,1fr)}.op332-node-state{grid-column:2;text-align:left}.op332-plan{min-height:0}}`;
    document.head.appendChild(style);
    const section=document.createElement('section');
    section.id='opPostGame332';section.className='card hidden';section.setAttribute('aria-live','polite');
    section.innerHTML=`
      <div class="op332-head"><div><div id="op332Tag" class="op332-kicker">POST-GAME · 3 / 3 / 2</div><h2>GAME DEBRIEF</h2><p id="op332Match" class="op332-sub"></p></div><span class="op332-pill">REVIEW READY</span></div>
      <section class="op333-summary">
        <div class="op333-scorebar"><article class="op333-stat good"><span>CLEAN DECISIONS</span><strong id="op333Clean">0</strong></article><article class="op333-stat fix"><span>NEEDS REVIEW</span><strong id="op333Review">0</strong></article><article class="op333-stat"><span>KEY EVENTS SHOWN</span><strong id="op333KeyCount">0</strong></article></div>
        <div class="op333-summary-grid">
          <article class="op333-summary-card win"><span>BIGGEST WIN</span><strong id="op333WinTitle">BUILDING</strong><p id="op333WinDetail"></p></article>
          <article class="op333-summary-card leak"><span>BIGGEST REVIEW</span><strong id="op333LeakTitle">BUILDING</strong><p id="op333LeakDetail"></p></article>
          <article class="op333-summary-card next"><span>NEXT-GAME RULE</span><strong id="op333NextTitle">REPEAT THE CLEAN DECISIONS</strong><p id="op333NextDetail"></p></article>
        </div>
      </section>
      <section class="op333-key"><div class="op333-key-head"><span>KEY DECISIONS · 5 MAX</span><small id="op333KeyMeta">ONLY WHAT MATTERED MOST</small></div><div id="op333KeyList" class="op333-key-list"></div></section>
      <details id="op334Recognition" class="op334-recognition"><summary><span>GAME READ</span><strong id="op334RecognitionStatus">CHECKING YOUR READS</strong><small id="op334RecognitionMeta">POST-GAME ONLY</small></summary><div id="op334RecognitionList" class="op334-recognition-list"></div></details>
      <details class="op333-details"><summary>MATCH DETAILS · PLAN / 3 GOOD / 3 REVIEW / FULL TIMELINE</summary><div class="op333-details-body">
        <div class="op332-baseline"><div class="op332-section-label">THE PLAN YOU ACTUALLY TOOK INTO THE GAME</div><div class="op332-baseline-grid"><article class="op332-plan"><span>01 · VS THEIR TEAM</span><strong id="op332Vs"></strong><p id="op332VsWhy"></p></article><article class="op332-plan"><span>02 · YOUR WIN CONDITION</span><strong id="op332Win"></strong><p id="op332WinWhy"></p></article><article class="op332-plan mission"><span>CLIMB MISSION · PERSISTENT</span><strong id="op332Mission"></strong><p id="op332MissionWhy"></p></article></div><p id="op332LockNote" class="op332-lock-note">REVIEWED AGAINST THE LOCKED PRE-GAME PLAN · NO RESULT-BASED REWRITING</p></div>
        <div class="op332-main"><section class="op332-column good"><h3>3 THINGS DONE WELL</h3><div id="op332Good" class="op332-list"></div></section><section class="op332-column fix"><h3>3 THINGS TO IMPROVE</h3><div id="op332Improve" class="op332-list"></div></section></div>
        <section class="op332-neutral"><h3>2 NEUTRAL OBSERVATIONS</h3><div id="op332Neutral" class="op332-neutral-grid"></div></section>
        <section class="op332-graph"><div class="op332-graph-head"><div><span>FULL MATCH TIMELINE</span><small id="op332GraphMeta"></small></div></div><div id="op332GraphList" class="op332-graph-list"></div></section>
      </div></details>
      <details class="op333-details"><summary>COACH EVIDENCE · PATTERNS / REHEARSAL / DECISION LAB / SKILL TRANSFER</summary><div class="op333-details-body">
        <section id="op332Premortem" class="op332-premortem"><div class="op332-premortem-head"><div><span>RISK MAP · DID THE PATTERN HOLD?</span><div id="op332PremortemStatus" class="op332-premortem-status">CHECKING FROZEN RISKS</div></div></div><div id="op332PremortemList" class="op332-premortem-list"></div><small id="op332PremortemBoundary" class="op332-premortem-proof"></small></section>
        <section id="op332Simulation" class="op332-simulation"><div class="op332-simulation-head"><div><span>MATCH REHEARSAL · REVIEW</span><div id="op332SimulationStatus" class="op332-simulation-status">CHECKING REHEARSED SCENARIOS</div></div></div><div id="op332SimulationList" class="op332-simulation-list"></div><small id="op332SimulationBoundary" class="op332-simulation-proof"></small></section>
        <section id="op332MissionReview" class="op332-memory op332-mission-review"><div class="op332-memory-head"><span>CLIMB MISSION · FROZEN REP REVIEW</span><div id="op332MissionStatus" class="op332-memory-status">CHECKING MATCH REP</div></div><div class="op332-memory-grid"><article class="op332-memory-card"><b>MISSION</b><strong id="op332MissionReviewName"></strong><p id="op332MissionReviewContext"></p></article><article class="op332-memory-card"><b>RESULT</b><strong id="op332MissionReviewResult"></strong><p id="op332MissionReviewNote"></p></article><article class="op332-memory-card"><b>CURRICULUM EFFECT</b><strong id="op332MissionReviewNext"></strong><p>One match rep adds evidence to the active lesson; it never creates graduation by itself.</p></article></div><small id="op332MissionReviewBoundary" class="op332-memory-proof"></small></section>
        <section id="op332Strategy" class="op332-response"><div class="op332-response-head"><div><span>COACHING STRATEGY · SUPPORT REVIEW</span><div id="op332StrategyStatus" class="op332-response-status">CHECKING SUPPORT POLICY</div></div></div><div class="op332-response-grid"><article class="op332-response-card"><b>FROZEN SUPPORT MODE</b><strong id="op332StrategyMode"></strong><p id="op332StrategyWhy"></p></article><article class="op332-response-card"><b>WHAT HAPPENED</b><strong id="op332StrategyResult"></strong><p id="op332StrategyNote"></p></article></div><small id="op332StrategyBoundary" class="op332-response-proof"></small></section>
        <section id="op332CoachTwin" class="op332-response"><div class="op332-response-head"><div><span>COACH TWIN · DID THIS TEACHING FORMAT LAND?</span><div id="op332CoachTwinStatus" class="op332-response-status">CHECKING FROZEN COACHING FORMAT</div></div></div><div class="op332-response-grid"><article class="op332-response-card"><b>FROZEN METHOD</b><strong id="op332CoachTwinMethod"></strong><p id="op332CoachTwinWhy"></p></article><article class="op332-response-card"><b>VERIFIED RESPONSE</b><strong id="op332CoachTwinResult"></strong><p id="op332CoachTwinNote"></p></article></div><small id="op332CoachTwinBoundary" class="op332-response-proof"></small></section>
        <section id="op332Memory" class="op332-memory"><div class="op332-memory-head"><span>DECISION LAB · SPACED REP REVIEW</span><div id="op332MemoryStatus" class="op332-memory-status">CHECKING SCHEDULED REP</div></div><div class="op332-memory-grid"><article class="op332-memory-card"><b>MEMORY</b><strong id="op332MemoryName"></strong><p id="op332MemoryContext"></p></article><article class="op332-memory-card"><b>RESULT</b><strong id="op332MemoryResult"></strong><p id="op332MemoryNote"></p></article><article class="op332-memory-card"><b>NEXT RULE</b><strong id="op332MemoryNext"></strong><p>One clean game reinforces the pattern; repeated comparable games are still required for mastery.</p></article></div><small id="op332MemoryBoundary" class="op332-memory-proof"></small></section>
        <section id="op332Transfer" class="op332-transfer"><div class="op332-transfer-head"><span>CLIMB PROFILE · SKILL TRANSFER</span><div id="op332TransferStatus" class="op332-transfer-status">CHECKING GENERALISATION</div></div><div class="op332-transfer-grid"><article class="op332-transfer-card"><b>TEST</b><strong id="op332TransferName"></strong><p id="op332TransferContext"></p></article><article class="op332-transfer-card"><b>RESULT</b><strong id="op332TransferResult"></strong><p id="op332TransferNote"></p></article><article class="op332-transfer-card"><b>MEANING</b><strong id="op332TransferMeaning"></strong><p>Transfer is evidence that the principle survived a different condition; it is not proof that every future matchup is solved.</p></article></div><small id="op332TransferBoundary" class="op332-transfer-proof"></small></section>
        <section id="op332Response" class="op332-response"><div class="op332-response-head"><div><span>COACHING RESPONSE · DID THE CUE TRANSFER?</span><div id="op332ResponseStatus" class="op332-response-status">CHECKING TRAINED BEHAVIOUR</div></div></div><div class="op332-response-grid"><article class="op332-response-card"><b>PRE-GAME CUE</b><strong id="op332ResponseCue"></strong><p id="op332ResponseNote"></p></article><article class="op332-response-card"><b>VERIFIED RESPONSE</b><strong id="op332ResponseRate"></strong><p id="op332ResponseStats"></p></article></div><small id="op332ResponseBoundary" class="op332-response-proof"></small></section>
        <section class="op332-counter"><div class="op332-counter-head"><div><span>BETTER DECISION · ALTERNATIVE LINE</span><small id="op332CounterMeta">EVIDENCE-BOUNDED · NO GUARANTEED OUTCOME</small></div></div><div id="op332CounterList" class="op332-counter-list"></div></section>
        <section class="op332-development"><div class="op332-development-head"><div><span>YOUR ACTIVE FIVE</span><div id="op332DevStatus" class="op332-dev-status">CHECKING POST-GAME EVIDENCE</div></div></div><p id="op332DevCopy" class="op332-dev-copy"></p><div id="op332DevList" class="op332-dev-list"></div></section>
      </div></details>
      <div class="op332-actions"><button id="op332Ready" type="button" style="border-color:rgba(214,255,47,.34);background:rgba(214,255,47,.07);color:#eaff89">NEW GAME · BACK TO READY</button><button id="op332Journey" type="button" style="border-color:rgba(67,140,255,.30);color:#8fbaff">VIEW LEARNING JOURNEY</button><button id="op332Open" type="button">OPEN FULL REVIEW</button></div>`;
    const status=$('status');if(status)status.insertAdjacentElement('afterend',section);else document.querySelector('main')?.appendChild(section);
    $('op332Journey')?.addEventListener('click',()=>window.opCompanion?.openClimbPath?.('/progress'));
    $('op332Open')?.addEventListener('click',()=>window.opCompanion?.openClimb?.());
    $('op332Ready')?.addEventListener('click',async()=>{
      const button=$('op332Ready');
      if(button){button.disabled=true;button.textContent='RETURNING TO READY…'}
      try{localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(DEEP_PLAN_STORAGE_KEY)}catch{}
      try{await window.opCompanion?.restart?.()}
      finally{if(button){button.disabled=false;button.textContent='NEW GAME · BACK TO READY'}}
    });
    return section;
  }

  function padded(items,kind){
    const result=safeArray(items).slice(0,3).map(item=>({...item,verified:item?.verified!==false}));
    while(result.length<3){const n=result.length+1;result.push(kind==='good'?{title:`Positive ${n} not verified`,detail:'No additional positive decision was strong enough to verify from the recording.',verified:false}:{title:`Improvement ${n} not verified`,detail:'No additional mistake was strong enough to verify as a real leak from the recording.',verified:false})}
    return result;
  }

  function renderPoints(rootId,items,kind){
    const root=$(rootId);if(!root)return;root.replaceChildren();
    padded(items,kind).forEach((item,index)=>{
      const row=document.createElement('article');row.className=`op332-point${item.verified===false?' unverified':''}`;
      const mark=document.createElement('i');mark.textContent=String(index+1).padStart(2,'0');
      const copy=document.createElement('div');
      const title=document.createElement('b');title.textContent=clean(item.title)||'Review point';copy.appendChild(title);
      const detail=document.createElement('p');detail.textContent=clean(item.detail)||'No extra detail available.';copy.appendChild(detail);
      const proof=document.createElement('small');proof.textContent=item.verified===false?'NOT ENOUGH EVIDENCE TO CLAIM THIS':'VERIFIED FROM RECORDED MATCH EVIDENCE';copy.appendChild(proof);
      row.append(mark,copy);root.appendChild(row);
    });
  }

  function fallbackNeutral(review){
    const match=review?.match||{};
    const bits=[match.champion,match.role,match.kda?`${match.kda} KDA`:null,Number.isFinite(match.csPerMin)?`${match.csPerMin} CS/min`:null].filter(Boolean);
    return[
      {title:'Match record',detail:bits.join(' · ')||'Final match telemetry was not available for the short review.'},
      {title:'Evidence coverage',detail:`${Number(review?.evidenceCount)||0} timestamped fight decisions were used for this short review${review?.partial?' from a partial recording':''}.`},
    ];
  }

  function renderNeutral(review){
    const root=$('op332Neutral');if(!root)return;root.replaceChildren();
    const values=safeArray(review?.neutral).slice(0,2);const source=values.length===2?values:fallbackNeutral(review);
    source.slice(0,2).forEach(item=>{const card=document.createElement('article');card.className='op332-observation';const title=document.createElement('b');title.textContent=clean(item.title)||'Observation';const detail=document.createElement('p');detail.textContent=clean(item.detail)||'No extra detail available.';card.append(title,detail);root.appendChild(card)});
  }

  function decisionPriority(node){
    const verdict=clean(node?.verdict).toUpperCase();
    const confidence=clean(node?.confidence).toUpperCase();
    const title=clean(node?.title).toUpperCase();
    const alignment=clean(node?.planAlignment).toUpperCase();
    const cfPriority=Number(node?.counterfactual?.priority)||0;
    let score=verdict==='IMPROVE'?120:verdict==='GOOD'?82:24;
    if(confidence==='HIGH')score+=18;else if(confidence==='MEDIUM')score+=8;
    if(alignment==='CONFLICTED')score+=14;if(alignment==='MATCHED')score+=7;
    score+=Math.min(45,cfPriority*.45);
    if(title.includes('PURCHASE WINDOW'))score-=24;
    if(/^LEVEL\s+\d+/.test(title))score-=18;
    return score;
  }

  function selectKeyDecisions(review){
    const nodes=Array.isArray(review?.decisionGraph?.nodes)?review.decisionGraph.nodes:[];
    const sorted=[...nodes].sort((a,b)=>decisionPriority(b)-decisionPriority(a));
    const chosen=[];let purchaseCount=0;
    for(const node of sorted){
      const title=clean(node?.title).toUpperCase();
      if(title.includes('PURCHASE WINDOW')&&purchaseCount>=1)continue;
      if(title.includes('PURCHASE WINDOW'))purchaseCount++;
      chosen.push(node);
      if(chosen.length>=5)break;
    }
    return chosen.sort((a,b)=>(Number(a?.atSeconds)||0)-(Number(b?.atSeconds)||0));
  }

  function renderMatchSummary(review){
    const nodes=Array.isArray(review?.decisionGraph?.nodes)?review.decisionGraph.nodes:[];
    const cleanNodes=nodes.filter(node=>clean(node?.verdict).toUpperCase()==='GOOD');
    const reviewNodes=nodes.filter(node=>clean(node?.verdict).toUpperCase()==='IMPROVE');
    const keys=selectKeyDecisions(review);
    setText('op333Clean',String(cleanNodes.length));
    setText('op333Review',String(reviewNodes.length));
    setText('op333KeyCount',String(keys.length));
    setText('op333KeyMeta',String(keys.length)+' OF '+String(nodes.length)+' DECISIONS SHOWN · FULL TIMELINE BELOW');

    const biggestWin=[...cleanNodes].sort((a,b)=>decisionPriority(b)-decisionPriority(a))[0]||null;
    const biggestLeak=[...reviewNodes].sort((a,b)=>decisionPriority(b)-decisionPriority(a))[0]||null;
    setText('op333WinTitle',biggestWin?((clean(biggestWin.minuteLabel)||'—')+' · '+(clean(biggestWin.title)||clean(biggestWin.behaviourLabel)||'CLEAN DECISION')):'NO VERIFIED CLEAN DECISION');
    setText('op333WinDetail',biggestWin?(clean(biggestWin.consequence)||clean(biggestWin.decisionRead)||'This was one of the strongest verified decisions in the game.'):'OP CLIMB will not manufacture a positive if the evidence is not strong enough.');
    setText('op333LeakTitle',biggestLeak?((clean(biggestLeak.minuteLabel)||'—')+' · '+(clean(biggestLeak.title)||clean(biggestLeak.behaviourLabel)||'REVIEW THIS')):'NO MAJOR VERIFIED LEAK');
    setText('op333LeakDetail',biggestLeak?(clean(biggestLeak.counterfactual?.alternative)||clean(biggestLeak.consequence)||clean(biggestLeak.decisionRead)||'This was the highest-value verified review point.'):'No high-confidence mistake was strong enough to promote above the fold.');
    setText('op333NextTitle',review?.nextFocus?.title,'REPEAT THE CLEAN DECISIONS');
    setText('op333NextDetail',review?.nextFocus?.rule,'Keep the current coaching focus until repeated evidence justifies changing it.');

    const root=$('op333KeyList');if(!root)return;root.replaceChildren();
    keys.forEach(node=>{
      const verdict=clean(node?.verdict).toLowerCase();
      const row=document.createElement('article');row.className='op333-key-row '+(verdict==='good'?'good':verdict==='improve'?'improve':'neutral');
      const time=document.createElement('div');time.className='op333-key-time';time.textContent=clean(node?.minuteLabel)||'—';
      const copy=document.createElement('div');copy.className='op333-key-copy';
      const title=document.createElement('b');title.textContent=clean(node?.title)||clean(node?.behaviourLabel)||'Decision point';
      const detail=document.createElement('p');detail.textContent=verdict==='improve'
        ?(clean(node?.counterfactual?.alternative)||clean(node?.decisionRead)||'Review the cleaner branch.')
        :(clean(node?.consequence)||clean(node?.decisionRead)||'Verified decision.');
      copy.append(title,detail);
      const badge=document.createElement('div');badge.className='op333-key-badge';badge.textContent=verdict==='good'?'CLEAN':verdict==='improve'?'REVIEW':'NEUTRAL';
      row.append(time,copy,badge);root.appendChild(row);
    });
  }

  function renderPlanRecognition(review){
    const root=$('op334Recognition'),list=$('op334RecognitionList');if(!root||!list)return;
    const stored=loadDeepLockedPlan();
    const engine=window.opPlanRecognitionReview;
    const result=engine?.reviewPlanRecognition?.({
      branchSelections:safeArray(stored?.branchSelections),
      contingencySelections:safeArray(stored?.contingencySelections),
      strengthPoints:safeArray(review?.recognitionEvidence?.strengthPoints),
      fightReviews:safeArray(review?.recognitionEvidence?.fightReviews),
      contingencyMap:stored?.playbook?.contingencyMap||null,
    })||null;
    list.replaceChildren();
    root.classList.remove('good','review');
    if(!result?.active){
      setText('op334RecognitionStatus','NO MANUAL READS TO GRADE');
      setText('op334RecognitionMeta','CLICK AHEAD / EVEN / BEHIND OR A CONTINGENCY DURING A FUTURE GAME');
      return;
    }
    const reviewCount=Number(result.review)||0;
    if(reviewCount>0)root.classList.add('review');else if(Number(result.supported)>0)root.classList.add('good');
    setText('op334RecognitionStatus',result.headline||'GAME READ REVIEW');
    setText('op334RecognitionMeta',String(result.supported||0)+' SUPPORTED · '+String(reviewCount)+' REVIEW · '+String(result.notVerifiable||0)+' NOT GRADED');
    const ordered=[
      ...safeArray(result.reads).filter(item=>item?.status==='REVIEW'),
      ...safeArray(result.reads).filter(item=>item?.status==='SUPPORTED'),
      ...safeArray(result.reads).filter(item=>item?.status==='NOT_VERIFIABLE'),
    ].slice(0,6);
    ordered.forEach(item=>{
      const row=document.createElement('article');row.className='op334-read '+clean(item?.status).toLowerCase();
      const time=document.createElement('div');time.className='op334-read-time';time.textContent=clean(item?.minuteLabel)||'—';
      const copy=document.createElement('div');copy.className='op334-read-copy';
      const title=document.createElement('b');title.textContent=clean(item?.title)||clean(item?.choice)||'Game read';
      const detail=document.createElement('p');detail.textContent=clean(item?.detail)||'No extra detail available.';
      const proof=document.createElement('small');proof.textContent=clean(item?.proof)||clean(result?.boundary)||'Post-game visible-state review only.';
      copy.append(title,detail,proof);
      const badge=document.createElement('div');badge.className='op334-read-state';badge.textContent=item?.status==='SUPPORTED'?'SUPPORTED':item?.status==='REVIEW'?'REVIEW':'NOT GRADED';
      row.append(time,copy,badge);list.appendChild(row);
    });
  }

  function renderDecisionGraph(review){
    const graph=review?.decisionGraph||null;
    const root=$('op332GraphList');if(!root)return;root.replaceChildren();
    if(!graph||!Array.isArray(graph.nodes)||!graph.nodes.length){
      setText('op332GraphMeta','NO HIGH-ENOUGH EVIDENCE NODES');
      const empty=document.createElement('article');empty.className='op332-node';
      const time=document.createElement('div');time.className='op332-node-time';time.textContent='—';
      const body=document.createElement('div');body.className='op332-node-body';
      const title=document.createElement('b');title.textContent='Decision graph still building';
      const detail=document.createElement('p');detail.textContent='OP CLIMB will not invent decisions it cannot support from recorded match evidence.';
      body.append(title,detail);empty.append(time,body);root.appendChild(empty);return;
    }
    const nodes=graph.nodes.slice(0,12);
    setText('op332GraphMeta',String(graph.highConfidenceCount||0)+' HIGH-CONFIDENCE · '+String(graph.nodeCount||nodes.length)+' TOTAL'+(graph.planAvailable?' · LOCKED PLAN LINKED':' · PLAN LINK UNAVAILABLE'));
    nodes.forEach(node=>{
      const card=document.createElement('article');
      const verdict=clean(node?.verdict).toLowerCase();
      card.className='op332-node '+(verdict==='good'?'good':verdict==='improve'?'improve':'neutral');
      const time=document.createElement('div');time.className='op332-node-time';time.textContent=clean(node?.minuteLabel)||'—';
      const body=document.createElement('div');body.className='op332-node-body';
      const title=document.createElement('b');title.textContent=clean(node?.title)||clean(node?.behaviourLabel)||'Decision point';
      const situation=document.createElement('p');situation.textContent=clean(node?.situation)||'Recorded decision point.';
      const decision=document.createElement('p');decision.textContent='DECISION READ · '+(clean(node?.decisionRead)||'Not enough evidence to reconstruct the decision safely.');
      const consequence=document.createElement('p');consequence.textContent='CONSEQUENCE · '+(clean(node?.consequence)||'No verified consequence available.');
      const proof=document.createElement('small');proof.className='op332-node-proof';
      const alignment=clean(node?.planAlignment);
      proof.textContent=(clean(node?.behaviourLabel)||'BEHAVIOUR')+' · '+(clean(node?.confidence)||'LOW')+' CONFIDENCE'+(alignment&&alignment!=='NOT_VERIFIABLE'?' · PLAN '+alignment:'');
      body.append(title,situation,decision,consequence,proof);
      if(clean(node?.lockedPrinciple)){
        const plan=document.createElement('p');plan.textContent='LOCKED PLAN · '+clean(node.lockedPrinciple);body.appendChild(plan);
      }
      const state=document.createElement('div');state.className='op332-node-state';
      const badge=document.createElement('strong');badge.textContent=verdict==='good'?'CLEAN DECISION':verdict==='improve'?'REVIEW THIS':'NEUTRAL';
      const confidence=document.createElement('small');confidence.textContent=clean(node?.type)||'DECISION';
      state.append(badge,confidence);
      card.append(time,body,state);root.appendChild(card);
    });
  }

  function renderPremortem(review){
    const root=$('op332Premortem'),list=$('op332PremortemList');if(!root||!list)return;
    const premortem=review?.decisionGraph?.summary?.premortem||null;
    list.replaceChildren();
    if(!premortem?.active){
      setText('op332PremortemStatus','NO VERIFIED PRE-GAME RISK MAP');
      const card=document.createElement('article');card.className='op332-premortem-card';
      const label=document.createElement('span');label.textContent='NO SCORE';
      const title=document.createElement('strong');title.textContent='Pre-Mortem was not active';
      const copy=document.createElement('p');copy.textContent=clean(premortem?.note)||'OP CLIMB did not freeze enough personal evidence before this game to grade predicted decision windows.';
      card.append(label,title,copy);list.appendChild(card);
      setText('op332PremortemBoundary',clean(premortem?.boundary)||'NO PERSONAL RISK CLAIM WITHOUT A FROZEN EVIDENCE-BOUNDED PRE-MORTEM.');
      return;
    }
    const observed=Number(premortem?.observedRisks)||0;
    const beaten=Number(premortem?.beatenRisks)||0;
    const hit=Number(premortem?.hitRisks)||0;
    const mixed=Number(premortem?.mixedRisks)||0;
    setText('op332PremortemStatus',observed
      ?String(observed)+'/'+String(premortem?.forecastCount||0)+' RISK WINDOWS OBSERVED · '+String(beaten)+' BEAT · '+String(hit)+' HIT · '+String(mixed)+' MIXED'
      :'RISK MAP NOT TESTED THIS GAME');
    const results=Array.isArray(premortem?.results)?premortem.results.slice(0,3):[];
    results.forEach((item,index)=>{
      const outcome=clean(item?.outcome).toUpperCase();
      const card=document.createElement('article');
      card.className='op332-premortem-card '+(outcome==='BEAT_PATTERN'?'beat':outcome==='PATTERN_HIT'?'hit':outcome==='MIXED'?'mixed':'unseen');
      const label=document.createElement('span');label.textContent='RISK #'+String(item?.rank||index+1)+(clean(item?.situationTag)?' · '+clean(item.situationTag).replace(/_/g,' '):'');
      const title=document.createElement('strong');title.textContent=clean(item?.behaviourLabel)||'Decision risk';
      const badge=document.createElement('b');badge.textContent=outcome==='BEAT_PATTERN'?'BEAT PATTERN':outcome==='PATTERN_HIT'?'PATTERN HIT':outcome==='MIXED'?'MIXED':'NOT OBSERVED';
      const copy=document.createElement('p');copy.textContent=clean(item?.note)||'No verified comparable decision was available.';
      card.append(label,title,badge,copy);list.appendChild(card);
    });
    setText('op332PremortemBoundary',clean(premortem?.boundary)||'NOT OBSERVED IS NOT A SUCCESS OR FAILURE · ONLY VERIFIED COMPARABLE DECISIONS ARE GRADED.');
  }

  function renderSimulationReview(review){
    const root=$('op332Simulation'),list=$('op332SimulationList');if(!root||!list)return;
    const simulation=review?.decisionGraph?.summary?.simulation||null;
    list.replaceChildren();
    if(!simulation?.active){
      setText('op332SimulationStatus','NO FROZEN SIMULATION TO SCORE');
      const card=document.createElement('article');card.className='op332-simulation-card';
      const label=document.createElement('span');label.textContent='NO SCORE';
      const title=document.createElement('strong');title.textContent='Simulation was not active';
      const copy=document.createElement('p');copy.textContent=clean(simulation?.note)||'No pre-game match rehearsal was frozen for this game.';
      card.append(label,title,copy);list.appendChild(card);
      setText('op332SimulationBoundary',clean(simulation?.boundary)||'UNOBSERVED SCENARIOS ARE NEVER COUNTED AS SUCCESS OR FAILURE.');
      return;
    }
    const observed=Number(simulation?.observedScenarios)||0;
    setText('op332SimulationStatus',observed
      ?String(observed)+'/'+String(simulation?.scenarioCount||0)+' SCENARIOS OBSERVED · '+String(simulation?.twinRepeated||0)+' PATTERN REPEATED · '+String(simulation?.twinBeaten||0)+' PATTERN BROKEN'
      :'SIMULATION NOT TESTED THIS GAME');
    const results=Array.isArray(simulation?.results)?simulation.results.slice(0,5):[];
    results.forEach((item,index)=>{
      const outcome=clean(item?.outcome).toUpperCase();
      const cls=outcome==='BEAT_TWIN'?'beat':outcome==='TWIN_REPEATED'?'repeat':outcome==='PLAN_EXECUTED'?'executed':outcome==='PLAN_MISSED'?'missed':outcome==='MIXED'?'mixed':'unseen';
      const card=document.createElement('article');card.className='op332-simulation-card '+cls;
      const label=document.createElement('span');label.textContent='SIM #'+String(item?.rank||index+1)+' · '+(clean(item?.source)==='PERSONAL_RISK'?'PERSONAL FORECAST':'DRAFT REHEARSAL');
      const title=document.createElement('strong');title.textContent=clean(item?.behaviourLabel)||'Decision scenario';
      const badge=document.createElement('b');badge.textContent=outcome==='BEAT_TWIN'?'PATTERN BROKEN':outcome==='TWIN_REPEATED'?'PATTERN REPEATED':outcome==='PLAN_EXECUTED'?'PLAN EXECUTED':outcome==='PLAN_MISSED'?'PLAN MISSED':outcome==='MIXED'?'MIXED':'NOT OBSERVED';
      const copy=document.createElement('p');copy.textContent=clean(item?.note)||'No verified comparable decision was available.';
      card.append(label,title,badge,copy);list.appendChild(card);
    });
    setText('op332SimulationBoundary',clean(simulation?.boundary)||'ONLY VERIFIED COMPARABLE DECISIONS ARE SCORED · NOT OBSERVED IS NEUTRAL.');
  }

  function renderClimbMissionReview(review){
    const root=$('op332MissionReview');if(!root)return;
    const mission=review?.decisionGraph?.summary?.climbMission||null;
    const status=clean(mission?.status||'NO_MISSION').toUpperCase();
    root.classList.toggle('executed',status==='EXECUTED');
    root.classList.toggle('missed',status==='MISSED');
    const label=status==='EXECUTED'?'MISSION EXECUTED'
      :status==='MISSED'?'MISSION MISSED'
      :status==='MIXED'?'MISSION PARTLY EXECUTED'
      :status==='NOT_OBSERVED'?'MISSION NOT TESTED'
      :'NO MATCH REP FROZEN';
    setText('op332MissionStatus',label);
    setText('op332MissionReviewName',clean(mission?.behaviourLabel)||(status==='NO_MISSION'?'No relevant Curriculum rep':'CLIMB Mission'));
    const tag=clean(mission?.targetTag).replace(/_/g,' ');
    const matched=Number(mission?.matchedMoments)||0;
    const level=Number(mission?.repLevel)||0;
    const stage=clean(mission?.repStage).replace(/_/g,' ');
    const repPrefix=level?('LEVEL '+String(level)+'/5'+(stage?' · '+stage:'')):'REP LEVEL UNKNOWN';
    setText('op332MissionReviewContext',tag?(repPrefix+' · '+tag+' · '+String(matched)+' verified mission moment'+(matched===1?'':'s')):repPrefix+' · No match-specific mission context was available.');
    setText('op332MissionReviewResult',status==='EXECUTED'?'CLEAN REP':status==='MISSED'?'REPEAT REP':status==='MIXED'?'MIXED REP':status==='NOT_OBSERVED'?'NO SCORE':'NO REP');
    setText('op332MissionReviewNote',clean(mission?.note)||'No frozen match mission result was available.');
    setText('op332MissionReviewNext',status==='EXECUTED'?'ADD EVIDENCE · DO NOT AUTO-PROMOTE DIFFICULTY'
      :status==='MISSED'?'KEEP THIS LESSON ACTIVE · REPEAT THE DECISION'
      :status==='MIXED'?'KEEP DRILLING · THE BRANCH IS NOT STABLE'
      :status==='NOT_OBSERVED'?'UNCHANGED · WAIT FOR THE NEXT RELEVANT WINDOW'
      :'CURRICULUM CONTINUES WITHOUT A FORCED MATCH REP');
    setText('op332MissionReviewBoundary',clean(mission?.boundary)||'NO MATCHING VERIFIED DECISION = NOT OBSERVED · ONE CLEAN REP ≠ DIFFICULTY PROMOTION OR GRADUATION.');
  }

  function renderCoachingStrategyReview(review){
    const root=$('op332Strategy');if(!root)return;
    const item=review?.decisionGraph?.summary?.coachingStrategy||null;
    const status=clean(item?.status||'NO_STRATEGY').toUpperCase();
    const mode=clean(item?.mode||'NO STRATEGY').toUpperCase();
    root.classList.toggle('executing',status==='CLEAN');
    root.classList.toggle('missing',status==='MISSED');
    const label=status==='CLEAN'?(item?.autonomyEvidence?'AUTONOMY EVIDENCE':'SUPPORT HELD')
      :status==='MISSED'?'SUPPORT MISSED'
      :status==='MIXED'?'MIXED RESPONSE'
      :status==='NOT_OBSERVED'?'SUPPORT NOT TESTED'
      :'NO STRATEGY FROZEN';
    setText('op332StrategyStatus',label);
    setText('op332StrategyMode',mode.replace(/_/g,' '));
    const baseline=reviewBaseline(null,review);
    setText('op332StrategyWhy',baseline?.strategyWhy||((item?.intervened?'ADAPTIVE COACHING ACTIVE':'ADAPTIVE COACHING FADED')+' · FROZEN BEFORE GAME'));
    setText('op332StrategyResult',item?.autonomyEvidence?'CLEAN WITHOUT ADAPTIVE OVERLAY':status==='CLEAN'?'CLEAN WITH SUPPORT':status==='MISSED'?'RE-SUPPORT NEXT REP':status==='MIXED'?'KEEP SUPPORT STABLE':status==='NOT_OBSERVED'?'NO SCORE':'NO TEST');
    setText('op332StrategyNote',clean(item?.note)||'No frozen support-policy result was available.');
    setText('op332StrategyBoundary',clean(item?.boundary)||'CLEAN FADED REP = CONTEXTUAL AUTONOMY EVIDENCE · NOT PERMANENT MASTERY · ONE MISS NEVER ERASES LEARNING.');
  }

  function renderCoachTwinReview(review){
    const root=$('op332CoachTwin');if(!root)return;
    const item=review?.decisionGraph?.summary?.coachIntervention||null;
    const status=clean(item?.status||'NO_INTERVENTION').toUpperCase();
    root.classList.toggle('executing',status==='EXECUTED');
    root.classList.toggle('missing',status==='MISSED');
    const label=status==='EXECUTED'?'FORMAT LANDED'
      :status==='MISSED'?'FORMAT MISSED'
      :status==='MIXED'?'MIXED RESPONSE'
      :status==='NOT_OBSERVED'?'FORMAT NOT TESTED'
      :'NO COACH TWIN TEST';
    setText('op332CoachTwinStatus',label);
    setText('op332CoachTwinMethod',clean(item?.methodLabel)||(status==='NO_INTERVENTION'?'No adaptive coaching format':'Coach Twin'));
    setText('op332CoachTwinWhy',clean(item?.selectionMode)?clean(item.selectionMode).replace(/_/g,' ')+' · frozen before game':'No method-selection evidence available.');
    const score=Number.isFinite(Number(item?.responseScore))?String(Math.round(Number(item.responseScore)))+'%':'NO SCORE';
    setText('op332CoachTwinResult',status==='NOT_OBSERVED'?'NOT OBSERVED':status==='NO_INTERVENTION'?'NO TEST':score);
    setText('op332CoachTwinNote',clean(item?.note)||'No Coach Twin response was available for this game.');
    setText('op332CoachTwinBoundary',clean(item?.boundary)||'RESPONSE ASSOCIATION ≠ CAUSATION · ONE GAME CANNOT DEFINE YOUR COACHING PREFERENCE.');
  }

  function renderScenarioPrimeReview(review){
    const root=$('op332Memory');if(!root)return;
    const memory=review?.decisionGraph?.summary?.scenarioPrime||null;
    const status=clean(memory?.status||'NO_REP').toUpperCase();
    root.classList.toggle('executed',status==='EXECUTED');
    root.classList.toggle('missed',status==='MISSED');
    const label=status==='EXECUTED'?'REP EXECUTED'
      :status==='MISSED'?'OLD BRANCH RETURNED'
      :status==='MIXED'?'NEW BRANCH NOT STABLE YET'
      :status==='NOT_OBSERVED'?'REP NOT TESTED'
      :'NO SPACED REP ACTIVE';
    setText('op332MemoryStatus',label);
    setText('op332MemoryName',clean(memory?.behaviourLabel)||(status==='NO_REP'?'No scheduled Scenario Memory':'Scenario Memory'));
    setText('op332MemoryContext',clean(memory?.situationTag)?clean(memory.situationTag).replace(/_/g,' ')+' · '+String(memory?.matchedMoments||0)+' verified comparable moment'+(Number(memory?.matchedMoments)===1?'':'s'):'No matching frozen memory was scheduled.');
    setText('op332MemoryResult',status==='EXECUTED'?'CLEAN REP':status==='MISSED'?'REPEAT REP':status==='MIXED'?'MIXED REP':status==='NOT_OBSERVED'?'NO SCORE':'NO REP');
    setText('op332MemoryNote',clean(memory?.note)||'No spaced-repetition result was available.');
    setText('op332MemoryNext',status==='EXECUTED'?'SPACE THE NEXT REP — DO NOT CALL THIS MASTERED YET':status==='NOT_OBSERVED'?'KEEP THE SAME SCHEDULE — THE MEMORY WAS NOT TESTED':status==='NO_REP'?'USE THE NORMAL ACTIVE FIVE':'KEEP THIS MEMORY ACTIVE UNTIL REPEATED CLEAN EVIDENCE HOLDS');
    setText('op332MemoryBoundary',clean(memory?.boundary)||'ONE GAME CANNOT CREATE MASTERY · UNOBSERVED IS NEUTRAL.');
  }

  function renderDecisionTransferReview(review){
    const root=$('op332Transfer');if(!root)return;
    const transfer=review?.decisionGraph?.summary?.decisionTransfer||null;
    const status=clean(transfer?.status||'NO_TEST').toUpperCase();
    root.classList.toggle('transferred',status==='TRANSFERRED');
    root.classList.toggle('failed',status==='FAILED_TRANSFER');
    const label=status==='TRANSFERRED'?'PRINCIPLE TRANSFERRED'
      :status==='FAILED_TRANSFER'?'TRANSFER FAILED'
      :status==='MIXED'?'TRANSFER NOT STABLE'
      :status==='NOT_OBSERVED'?'TRANSFER NOT TESTED'
      :'NO TRANSFER TEST ACTIVE';
    setText('op332TransferStatus',label);
    setText('op332TransferName',clean(transfer?.behaviourLabel)||(status==='NO_TEST'?'No frozen skill-transfer test':'Skill transfer'));
    const source=clean(transfer?.sourceTag).replace(/_/g,' ');
    const target=clean(transfer?.targetTag).replace(/_/g,' ');
    setText('op332TransferContext',source&&target?source+' → '+target+' · '+clean(transfer?.dimension).replace(/_/g,' '):'No novel condition was frozen before this game.');
    setText('op332TransferResult',status==='TRANSFERRED'?'CLEAN TRANSFER':status==='FAILED_TRANSFER'?'LOCAL ONLY':status==='MIXED'?'MIXED TRANSFER':status==='NOT_OBSERVED'?'NO SCORE':'NO TEST');
    setText('op332TransferNote',clean(transfer?.note)||'No transfer result was available.');
    setText('op332TransferMeaning',status==='TRANSFERRED'?'ADD ONE GENERALISATION REP — KEEP TESTING BREADTH':status==='FAILED_TRANSFER'?'KEEP LOCAL MASTERY · RE-TEST THE PRINCIPLE IN NOVEL CONDITIONS':status==='MIXED'?'PRINCIPLE IS EMERGING · DO NOT PROMOTE IT YET':status==='NOT_OBSERVED'?'UNCHANGED — THE NOVEL DECISION NEVER APPEARED':'LOCAL LEARNING COMES FIRST');
    setText('op332TransferBoundary',clean(transfer?.boundary)||'NO FROZEN NOVEL TEST = NO TRANSFER CLAIM.');
  }

  function renderCoachingResponse(review){
    const root=$('op332Response');if(!root)return;
    const response=review?.decisionGraph?.summary?.coachingResponse||null;
    const status=clean(response?.status||'NO_CUE').toUpperCase();
    root.classList.toggle('executing',status==='EXECUTING');
    root.classList.toggle('missing',status==='MISSING');
    const matched=Number(response?.matchedMoments)||0;
    const executed=Number(response?.executed)||0;
    const missed=Number(response?.missed)||0;
    const rate=Number.isFinite(Number(response?.responseRate))?Number(response.responseRate):null;
    const statusLabel=status==='EXECUTING'?'TRANSFERRED THIS GAME'
      :status==='MIXED'?'PARTIAL TRANSFER'
      :status==='MISSING'?'CUE NOT STABLE YET'
      :status==='NO_MATCH'?'NOT TESTED THIS GAME'
      :'NO PERSONAL CUE ACTIVE';
    setText('op332ResponseStatus',statusLabel);
    setText('op332ResponseCue',clean(response?.cue)||(status==='NO_CUE'?'Normal draft coaching only.':'Verified cue unavailable.'));
    setText('op332ResponseNote',clean(response?.note)||'No verified coaching-response evidence was available.');
    setText('op332ResponseRate',matched?(String(rate??0)+'% CLEAN'):'NO SCORE');
    setText('op332ResponseStats',matched?(String(executed)+' executed · '+String(missed)+' missed · '+String(matched)+' comparable decision'+(matched===1?'':'s')):'No verified comparable decision appeared, so OP CLIMB did not manufacture a score.');
    setText('op332ResponseBoundary','ASSOCIATION ONLY · OP CLIMB MEASURES WHAT HAPPENED AFTER THE CUE WAS SHOWN; IT DOES NOT CLAIM THE CUE CAUSED THE RESULT.');
  }

  function renderCounterfactuals(review){
    const graph=review?.decisionGraph||null;
    const root=$('op332CounterList');if(!root)return;root.replaceChildren();
    const nodes=Array.isArray(graph?.nodes)?graph.nodes:[];
    const topIds=Array.isArray(graph?.summary?.topCounterfactualNodeIds)?graph.summary.topCounterfactualNodeIds:[];
    let candidates=nodes.filter(node=>node?.counterfactual);
    if(topIds.length){
      const order=new Map(topIds.map((id,index)=>[String(id),index]));
      candidates=candidates.filter(node=>order.has(String(node?.id))).sort((a,b)=>(order.get(String(a?.id))??99)-(order.get(String(b?.id))??99));
    }else{
      candidates=candidates.sort((a,b)=>(Number(b?.counterfactual?.priority)||0)-(Number(a?.counterfactual?.priority)||0)).slice(0,3);
    }
    candidates=candidates.slice(0,3);
    setText('op332CounterMeta',candidates.length?String(candidates.length)+' HIGHEST-VALUE ALTERNATIVE'+(candidates.length===1?'':'S')+' · EVIDENCE-BOUNDED · NO GUARANTEED OUTCOME':'NO SUPPORTED ALTERNATIVE YET');
    if(!candidates.length){
      const empty=document.createElement('article');empty.className='op332-counter-card';
      const label=document.createElement('span');label.textContent='NOT ENOUGH EVIDENCE';
      const title=document.createElement('h4');title.textContent='No safe counterfactual generated';
      const copy=document.createElement('div');copy.className='op332-counter-block';
      const p=document.createElement('p');p.textContent='OP CLIMB will only show an alternative when the recorded moment is strong enough to support one.';
      copy.appendChild(p);empty.append(label,title,copy);root.appendChild(empty);return;
    }
    candidates.forEach(node=>{
      const cf=node.counterfactual||{};
      const card=document.createElement('article');card.className='op332-counter-card';
      const label=document.createElement('span');label.textContent=(clean(node?.minuteLabel)||'—')+' · '+(clean(node?.behaviourLabel)||'DECISION');
      const title=document.createElement('h4');title.textContent=clean(node?.title)||'Better decision';
      const pair=document.createElement('div');pair.className='op332-counter-pair';
      const actual=document.createElement('div');actual.className='op332-counter-block';
      const actualLabel=document.createElement('b');actualLabel.textContent='WHAT YOU DID';
      const actualCopy=document.createElement('p');actualCopy.textContent=clean(cf?.actual)||clean(node?.decisionRead)||'Recorded decision graded for improvement.';
      actual.append(actualLabel,actualCopy);
      const better=document.createElement('div');better.className='op332-counter-block better';
      const betterLabel=document.createElement('b');betterLabel.textContent='BETTER OPTION';
      const betterCopy=document.createElement('p');betterCopy.textContent=clean(cf?.alternative)||'No supported alternative.';
      better.append(betterLabel,betterCopy);
      const why=document.createElement('div');why.className='op332-counter-block';
      const whyLabel=document.createElement('b');whyLabel.textContent='WHY IT FITS';
      const whyCopy=document.createElement('p');whyCopy.textContent=clean(cf?.whyBetter)||'It better preserves the locked game plan.';
      why.append(whyLabel,whyCopy);
      const trade=document.createElement('div');trade.className='op332-counter-block';
      const tradeLabel=document.createElement('b');tradeLabel.textContent='TRADE-OFF';
      const tradeCopy=document.createElement('p');tradeCopy.textContent=clean(cf?.tradeoff)||'The safer option can give up immediate value.';
      trade.append(tradeLabel,tradeCopy);
      const boundary=document.createElement('small');boundary.className='op332-counter-boundary';boundary.textContent=clean(cf?.outcomeBoundary)||'NO GUARANTEED OUTCOME · THIS IS A COACHING ALTERNATIVE, NOT A PREDICTION.';
      pair.append(actual,better,why,trade);card.append(label,title,pair,boundary);root.appendChild(card);
    });
  }

  function renderDevelopmentPlan(review){
    const plan=review?.developmentPlan||null;
    const root=$('op332DevList');if(!root)return;root.replaceChildren();
    if(!plan?.synced){
      const partial=clean(plan?.status)==='SKIPPED_PARTIAL';
      setText('op332DevStatus',partial?'PARTIAL RECORDING · PLAN KEPT':'PLAN SYNC UNAVAILABLE · EXISTING MISSIONS KEPT');
      setText('op332DevCopy',partial?'Partial recordings can inform the match review, but they do not rewrite your Active Five.':'Your existing development missions stay intact if the post-game evidence sync cannot be verified.');
      return;
    }
    setText('op332DevStatus',plan.changed?'ACTIVE FIVE UPDATED FROM REPEATED EVIDENCE':'ACTIVE FIVE CHECKED · NO MISSION REPLACED');
    const changes=safeArray(plan.changes).map(clean).filter(Boolean);
    setText('op332DevCopy',changes.length?changes.join(' · '):'This match has been checked against your learning history. One unusual game cannot replace or reopen a persistent development mission.');
    safeArray(plan.activeFive).slice(0,5).forEach((mission,index)=>{
      const card=document.createElement('article');card.className='op332-dev-card'+(index===0?' primary':'');
      const number=document.createElement('small');number.textContent=(index===0?'PRIMARY · ':'')+'MISSION '+String(index+1).padStart(2,'0');
      const title=document.createElement('b');title.textContent=clean(mission?.title)||'Development mission';
      const progress=document.createElement('em');progress.textContent=Math.max(0,Math.min(100,Number(mission?.progress)||0))+'% · '+clean(mission?.status||'ACTIVE');
      card.append(number,title,progress);root.appendChild(card);
    });
  }

  function setText(id,value,fallback=''){const node=$(id);if(node)node.textContent=clean(value)||fallback}

  function render(state){
    rememberLockedPlan(state);
    const review=state?.postGameReview||null;
    const visible=String(state?.phase||'')==='REVIEW'&&Boolean(review);
    const section=install();section.classList.toggle('hidden',!visible);
    const old=$('simplePostgameReview');if(old)old.classList.toggle('op-superseded',visible);
    if(!visible)return;

    const match=review.match||{};
    const bits=[match.champion,match.role,match.kda?`${match.kda} KDA`:null,Number.isFinite(match.csPerMin)?`${match.csPerMin} CS/min`:null].filter(Boolean);
    setText('op332Tag',`${review.coachLevel?.tier||'OP'} COACH · ${review.partial?'PARTIAL':'POST-GAME'} · 3 / 3 / 2`);
    setText('op332Match',bits.join(' · '),'Recorded match review');

    const baseline=reviewBaseline(state,review);
    setText('op332Vs',baseline?.vsTheirTeam,'Locked enemy-team win condition unavailable in this Companion session.');
    setText('op332VsWhy',baseline?.vsTheirTeamWhy,baseline?'':'The evidence review below is still valid, but this plan card cannot be reconstructed safely.');
    setText('op332Win',baseline?.yourWinCondition,'Locked personal win condition unavailable in this Companion session.');
    setText('op332WinWhy',baseline?.yourWinConditionWhy,'');
    setText('op332Mission',baseline?.missionCue||baseline?.missionTitle,'Keep your current CLIMB MISSION until enough evidence justifies changing it.');
    setText('op332MissionWhy',baseline?.missionTitle?(baseline.missionWhy?`${baseline.missionTitle} · ${baseline.missionWhy}`:baseline.missionTitle):'The mission remains separate from one-match tactical advice.');
    if(baseline?.deepPlan){
      const tier=clean(baseline?.deepQuality?.tier||baseline?.deepQuality?.rank);
      const source=clean(baseline?.deepSource).toUpperCase();
      const verified=source==='AI'&&baseline?.deepQuality?.pass===true;
      const branchTrail=safeArray(baseline?.branchHistory).slice(-6);
      const branchText=branchTrail.length?' · PLAYER BRANCHES: '+branchTrail.join(' → '):(baseline?.selectedBranch?' · LAST SHOWN: '+baseline.selectedBranch:'');
      const contingencyTrail=safeArray(baseline?.contingencyHistory).slice(-6);
      const contingencyText=contingencyTrail.length?' · PLAYER CONTINGENCIES: '+contingencyTrail.join(' → '):(baseline?.selectedContingency?' · PLAN: '+baseline.selectedContingency:'');
      setText('op332LockNote',(verified?'DEEP VERIFIED PRE-GAME PLAN':'FROZEN PRE-GAME PLAN')+(tier?' · '+tier:'')+branchText+contingencyText+' · PLAYER-SELECTED · NO RESULT-BASED REWRITING');
    }else{
      setText('op332LockNote','REVIEWED AGAINST THE LOCKED PRE-GAME PLAN · NO RESULT-BASED REWRITING');
    }

    renderPoints('op332Good',review.doneWell||review.good,'good');
    renderPoints('op332Improve',review.improve||review.critical,'improve');
    renderNeutral(review);
    renderMatchSummary(review);
    renderPlanRecognition(review);
    renderDecisionGraph(review);
    renderPremortem(review);
    renderSimulationReview(review);
    renderClimbMissionReview(review);
    renderCoachingStrategyReview(review);
    renderCoachTwinReview(review);
    renderScenarioPrimeReview(review);
    renderDecisionTransferReview(review);
    renderCoachingResponse(review);
    renderCounterfactuals(review);
    setText('op332NextTitle',review.nextFocus?.title,'REPEAT THE CLEAN DECISIONS');
    setText('op332NextRule',review.nextFocus?.rule,'Keep the same CLIMB MISSION and build more evidence next game.');
    renderDevelopmentPlan(review);
  }

  install();
  window.opCompanion?.getState?.().then(render).catch(()=>{});
  window.opCompanion?.onState?.(render);
})();