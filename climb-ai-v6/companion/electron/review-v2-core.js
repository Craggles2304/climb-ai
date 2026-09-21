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
      missionTitle:clean(fallback?.missionTitle),
      missionCue:clean(fallback?.missionCue),
      missionWhy:clean(fallback?.missionWhy),
    };
  }

  function install(){
    if($('opPostGame332'))return $('opPostGame332');
    const style=document.createElement('style');
    style.id='op-review-332-style';
    style.textContent=`
#simplePostgameReview.op-superseded{display:none!important}#opPostGame332{margin-top:14px;padding:22px;background:linear-gradient(180deg,rgba(11,16,20,.99),rgba(7,11,14,.99));border:1px solid rgba(255,255,255,.08)}#opPostGame332.hidden{display:none!important}.op332-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}.op332-kicker{font-size:8px;letter-spacing:.21em;font-weight:900;color:#d6ff2f;text-transform:uppercase}.op332-head h2{font-size:clamp(30px,5vw,48px);margin:5px 0 5px;letter-spacing:-.045em;text-transform:uppercase}.op332-sub{margin:0;color:#7f8c97;font-size:11px;line-height:1.5}.op332-pill{border:1px solid rgba(214,255,47,.25);color:#d6ff2f;padding:8px 10px;font-size:8px;letter-spacing:.16em;font-weight:900;text-transform:uppercase}.op332-baseline{margin-top:18px;border-top:1px solid rgba(255,255,255,.08);padding-top:15px}.op332-section-label{font-size:8px;letter-spacing:.18em;font-weight:900;color:#73808b;text-transform:uppercase;margin-bottom:10px}.op332-baseline-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.op332-plan{border:1px solid rgba(255,255,255,.08);padding:13px;background:rgba(255,255,255,.018);min-height:122px}.op332-plan.mission{border-color:rgba(214,255,47,.2);background:rgba(214,255,47,.03)}.op332-plan span{display:block;font-size:8px;letter-spacing:.15em;color:#d6ff2f;font-weight:900;text-transform:uppercase}.op332-plan strong{display:block;margin-top:8px;font-size:12px;line-height:1.45}.op332-plan p{margin:7px 0 0;color:#76838e;font-size:9px;line-height:1.4}.op332-lock-note{margin:9px 0 0;color:#596671;font-size:8px;letter-spacing:.11em;text-transform:uppercase}.op332-main{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}.op332-column{border:1px solid rgba(255,255,255,.08);padding:15px}.op332-column.good{border-top:2px solid #d6ff2f}.op332-column.fix{border-top:2px solid #ff765f}.op332-column h3,.op332-neutral h3{margin:0 0 11px;font-size:13px;letter-spacing:.08em;text-transform:uppercase}.op332-list{display:grid;gap:9px}.op332-point{display:grid;grid-template-columns:25px minmax(0,1fr);gap:9px;padding:8px 0;border-top:1px solid rgba(255,255,255,.055)}.op332-point:first-child{border-top:0;padding-top:1px}.op332-point i{font-style:normal;width:22px;height:22px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.13);font-size:10px;font-weight:900}.op332-point b{display:block;font-size:11px;line-height:1.35}.op332-point p{margin:4px 0 0;font-size:10px;line-height:1.45;color:#87939d}.op332-point small{display:block;margin-top:5px;font-size:7px;letter-spacing:.12em;text-transform:uppercase;color:#596671}.op332-point.unverified{opacity:.52}.op332-neutral{margin-top:12px;border:1px solid rgba(67,140,255,.22);padding:15px}.op332-graph{margin-top:12px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(180deg,rgba(10,15,19,.92),rgba(5,9,12,.92));padding:15px}.op332-graph-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.op332-graph-head span{font-size:8px;letter-spacing:.17em;color:#d6ff2f;font-weight:900;text-transform:uppercase}.op332-graph-head small{font-size:7px;letter-spacing:.11em;color:#64717a;text-transform:uppercase}.op332-graph-list{display:grid;gap:8px;margin-top:11px}.op332-node{display:grid;grid-template-columns:54px minmax(0,1fr) 118px;gap:10px;align-items:start;border-top:1px solid rgba(255,255,255,.055);padding-top:9px}.op332-node:first-child{border-top:0;padding-top:0}.op332-node-time{font-size:13px;font-weight:950;color:#d6ff2f}.op332-node-body b{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.07em}.op332-node-body p{margin:4px 0 0;color:#8a969f;font-size:9px;line-height:1.45}.op332-node-proof{display:block;margin-top:5px;color:#596671;font-size:7px;line-height:1.4}.op332-node-state{text-align:right}.op332-node-state strong{display:inline-block;padding:5px 7px;border:1px solid rgba(255,255,255,.11);font-size:7px;letter-spacing:.11em;text-transform:uppercase}.op332-node.good .op332-node-state strong{border-color:rgba(214,255,47,.28);color:#d6ff2f}.op332-node.improve .op332-node-state strong{border-color:rgba(255,118,95,.3);color:#ff8c78}.op332-node-state small{display:block;margin-top:6px;color:#66737c;font-size:6px;letter-spacing:.1em;text-transform:uppercase}.op332-premortem{margin-top:12px;border:1px solid rgba(255,184,76,.22);background:linear-gradient(135deg,rgba(255,184,76,.045),rgba(4,8,12,.78));padding:15px}.op332-premortem-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.op332-premortem-head span{font-size:8px;letter-spacing:.17em;color:#ffbb57;font-weight:900;text-transform:uppercase}.op332-premortem-status{font-size:9px;letter-spacing:.12em;font-weight:950;color:#e9eef1;text-transform:uppercase}.op332-premortem-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:11px}.op332-premortem-card{border:1px solid rgba(255,255,255,.08);background:rgba(4,8,12,.58);padding:11px;min-width:0}.op332-premortem-card.beat{border-color:rgba(214,255,47,.27)}.op332-premortem-card.hit{border-color:rgba(255,118,95,.28)}.op332-premortem-card.mixed{border-color:rgba(255,184,76,.28)}.op332-premortem-card>span{display:block;color:#687680;font-size:6px;letter-spacing:.13em;text-transform:uppercase}.op332-premortem-card strong{display:block;margin-top:5px;font-size:10px;line-height:1.3;text-transform:uppercase}.op332-premortem-card b{display:inline-block;margin-top:8px;padding:4px 6px;border:1px solid rgba(255,255,255,.1);font-size:7px;letter-spacing:.1em;text-transform:uppercase}.op332-premortem-card.beat b{color:#d6ff2f}.op332-premortem-card.hit b{color:#ff8c78}.op332-premortem-card.mixed b{color:#ffbb57}.op332-premortem-card p{margin:6px 0 0;color:#87949d;font-size:8px;line-height:1.4}.op332-premortem-proof{display:block;margin-top:9px;color:#596671;font-size:6px;line-height:1.4;letter-spacing:.08em;text-transform:uppercase}.op332-response{margin-top:12px;border:1px solid rgba(67,140,255,.22);background:linear-gradient(135deg,rgba(67,140,255,.055),rgba(4,8,12,.78));padding:15px}.op332-response.executing{border-color:rgba(214,255,47,.28);background:linear-gradient(135deg,rgba(214,255,47,.05),rgba(4,8,12,.78))}.op332-response.missing{border-color:rgba(255,118,95,.28);background:linear-gradient(135deg,rgba(255,118,95,.045),rgba(4,8,12,.78))}.op332-response-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.op332-response-head span{font-size:8px;letter-spacing:.17em;color:#67a8ff;font-weight:900;text-transform:uppercase}.op332-response.executing .op332-response-head span{color:#d6ff2f}.op332-response.missing .op332-response-head span{color:#ff8c78}.op332-response-status{font-size:9px;letter-spacing:.12em;font-weight:950;text-transform:uppercase;color:#dce6ed}.op332-response-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:10px;margin-top:11px}.op332-response-card{border:1px solid rgba(255,255,255,.08);background:rgba(4,8,12,.56);padding:12px}.op332-response-card b{display:block;color:#697680;font-size:6px;letter-spacing:.13em;text-transform:uppercase}.op332-response-card strong{display:block;margin-top:5px;color:#eef3f6;font-size:11px;line-height:1.35;text-transform:uppercase}.op332-response-card p{margin:5px 0 0;color:#88949d;font-size:9px;line-height:1.45}.op332-response-proof{display:block;margin-top:9px;color:#596671;font-size:6px;line-height:1.4;letter-spacing:.08em;text-transform:uppercase}.op332-counter{margin-top:12px;border:1px solid rgba(214,255,47,.2);background:linear-gradient(135deg,rgba(214,255,47,.035),rgba(4,8,12,.78));padding:15px}.op332-counter-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.op332-counter-head span{font-size:8px;letter-spacing:.17em;color:#d6ff2f;font-weight:900;text-transform:uppercase}.op332-counter-head small{font-size:7px;letter-spacing:.11em;color:#64717a;text-transform:uppercase}.op332-counter-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:11px}.op332-counter-card{border:1px solid rgba(255,255,255,.08);background:rgba(4,8,12,.58);padding:12px;min-width:0}.op332-counter-card:first-child{border-color:rgba(214,255,47,.28)}.op332-counter-card>span{display:block;color:#d6ff2f;font-size:7px;letter-spacing:.14em;font-weight:950;text-transform:uppercase}.op332-counter-card h4{margin:6px 0 8px;font-size:11px;line-height:1.3;text-transform:uppercase}.op332-counter-pair{display:grid;gap:7px}.op332-counter-block{border-top:1px solid rgba(255,255,255,.055);padding-top:7px}.op332-counter-block:first-child{border-top:0;padding-top:0}.op332-counter-block b{display:block;color:#6f7c85;font-size:6px;letter-spacing:.13em;text-transform:uppercase}.op332-counter-block p{margin:4px 0 0;color:#c4cdd3;font-size:9px;line-height:1.42}.op332-counter-block.better p{color:#eaff89;font-weight:800}.op332-counter-boundary{display:block;margin-top:8px;color:#596671;font-size:6px;line-height:1.4;text-transform:uppercase;letter-spacing:.08em}.op332-neutral-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.op332-observation{background:rgba(67,140,255,.035);border:1px solid rgba(67,140,255,.12);padding:12px}.op332-observation b{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.op332-observation p{margin:5px 0 0;color:#87939d;font-size:10px;line-height:1.45}.op332-next{margin-top:12px;border:1px solid rgba(214,255,47,.22);background:rgba(214,255,47,.035);padding:15px}.op332-next span{font-size:8px;letter-spacing:.17em;color:#d6ff2f;font-weight:900;text-transform:uppercase}.op332-next h3{margin:6px 0 4px;font-size:17px}.op332-next p{margin:0;color:#a2adb6;font-size:11px;line-height:1.5}.op332-development{margin-top:12px;border:1px solid rgba(214,255,47,.18);background:linear-gradient(135deg,rgba(214,255,47,.035),rgba(6,10,14,.72));padding:15px}.op332-development-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.op332-development-head span{font-size:8px;letter-spacing:.17em;color:#d6ff2f;font-weight:900;text-transform:uppercase}.op332-dev-status{font-size:8px;letter-spacing:.12em;color:#cdd6dd;font-weight:900;text-transform:uppercase}.op332-dev-copy{margin:7px 0 0;color:#7f8c97;font-size:9px;line-height:1.45}.op332-dev-list{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-top:11px}.op332-dev-card{border:1px solid rgba(255,255,255,.08);background:rgba(4,8,12,.55);padding:10px;min-width:0}.op332-dev-card.primary{border-color:rgba(214,255,47,.32)}.op332-dev-card small{display:block;color:#62707a;font-size:6px;letter-spacing:.12em;text-transform:uppercase}.op332-dev-card b{display:block;margin-top:5px;font-size:9px;line-height:1.35;text-transform:uppercase}.op332-dev-card em{display:block;margin-top:6px;font-style:normal;color:#d6ff2f;font-size:7px;letter-spacing:.08em}.op332-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:12px}.op332-actions button{border:1px solid rgba(255,255,255,.12);background:transparent;color:#cdd6dd;padding:9px 12px;font-size:9px;letter-spacing:.12em;font-weight:900;cursor:pointer}.op332-actions button:disabled{opacity:.55;cursor:wait}@media(max-width:780px){.op332-baseline-grid,.op332-main,.op332-neutral-grid,.op332-dev-list,.op332-counter-list,.op332-response-grid,.op332-premortem-list{grid-template-columns:1fr}.op332-node{grid-template-columns:45px minmax(0,1fr)}.op332-node-state{grid-column:2;text-align:left}.op332-plan{min-height:0}}`;
    document.head.appendChild(style);
    const section=document.createElement('section');
    section.id='opPostGame332';section.className='card hidden';section.setAttribute('aria-live','polite');
    section.innerHTML=`
      <div class="op332-head"><div><div id="op332Tag" class="op332-kicker">POST-GAME · 3 / 3 / 2</div><h2>GAME DEBRIEF</h2><p id="op332Match" class="op332-sub"></p></div><span class="op332-pill">REVIEW READY</span></div>
      <div class="op332-baseline"><div class="op332-section-label">THE PLAN YOU ACTUALLY TOOK INTO THE GAME</div><div class="op332-baseline-grid"><article class="op332-plan"><span>01 · VS THEIR TEAM</span><strong id="op332Vs"></strong><p id="op332VsWhy"></p></article><article class="op332-plan"><span>02 · YOUR WIN CONDITION</span><strong id="op332Win"></strong><p id="op332WinWhy"></p></article><article class="op332-plan mission"><span>CLIMB MISSION · PERSISTENT</span><strong id="op332Mission"></strong><p id="op332MissionWhy"></p></article></div><p id="op332LockNote" class="op332-lock-note">REVIEWED AGAINST THE LOCKED PRE-GAME PLAN · NO RESULT-BASED REWRITING</p></div>
      <div class="op332-main"><section class="op332-column good"><h3>3 THINGS DONE WELL</h3><div id="op332Good" class="op332-list"></div></section><section class="op332-column fix"><h3>3 THINGS TO IMPROVE</h3><div id="op332Improve" class="op332-list"></div></section></div>
      <section class="op332-neutral"><h3>2 NEUTRAL OBSERVATIONS</h3><div id="op332Neutral" class="op332-neutral-grid"></div></section>
      <section class="op332-graph"><div class="op332-graph-head"><div><span>DECISION GRAPH · WHAT ACTUALLY HAPPENED</span><small id="op332GraphMeta"></small></div></div><div id="op332GraphList" class="op332-graph-list"></div></section>
      <section id="op332Premortem" class="op332-premortem"><div class="op332-premortem-head"><div><span>DECISION PRE-MORTEM · DID THE RISK MAP HOLD?</span><div id="op332PremortemStatus" class="op332-premortem-status">CHECKING FROZEN RISKS</div></div></div><div id="op332PremortemList" class="op332-premortem-list"></div><small id="op332PremortemBoundary" class="op332-premortem-proof"></small></section>
      <section id="op332Response" class="op332-response"><div class="op332-response-head"><div><span>COACHING RESPONSE · DID THE CUE TRANSFER?</span><div id="op332ResponseStatus" class="op332-response-status">CHECKING TRAINED BEHAVIOUR</div></div></div><div class="op332-response-grid"><article class="op332-response-card"><b>PRE-GAME CUE</b><strong id="op332ResponseCue"></strong><p id="op332ResponseNote"></p></article><article class="op332-response-card"><b>VERIFIED RESPONSE</b><strong id="op332ResponseRate"></strong><p id="op332ResponseStats"></p></article></div><small id="op332ResponseBoundary" class="op332-response-proof"></small></section>
      <section class="op332-counter"><div class="op332-counter-head"><div><span>COUNTERFACTUAL COACHING · BETTER DECISION</span><small id="op332CounterMeta">EVIDENCE-BOUNDED · NO GUARANTEED OUTCOME</small></div></div><div id="op332CounterList" class="op332-counter-list"></div></section>
      <section class="op332-next"><span>NEXT GAME · ONE FOCUS</span><h3 id="op332NextTitle"></h3><p id="op332NextRule"></p></section>
      <section class="op332-development"><div class="op332-development-head"><div><span>DEVELOPMENT PLAN · ACTIVE FIVE</span><div id="op332DevStatus" class="op332-dev-status">CHECKING POST-GAME EVIDENCE</div></div></div><p id="op332DevCopy" class="op332-dev-copy"></p><div id="op332DevList" class="op332-dev-list"></div></section>
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
      setText('op332LockNote',(verified?'DEEP VERIFIED PRE-GAME PLAN':'FROZEN PRE-GAME PLAN')+(tier?' · '+tier:'')+branchText+' · NO RESULT-BASED REWRITING');
    }else{
      setText('op332LockNote','REVIEWED AGAINST THE LOCKED PRE-GAME PLAN · NO RESULT-BASED REWRITING');
    }

    renderPoints('op332Good',review.doneWell||review.good,'good');
    renderPoints('op332Improve',review.improve||review.critical,'improve');
    renderNeutral(review);
    renderDecisionGraph(review);
    renderPremortem(review);
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