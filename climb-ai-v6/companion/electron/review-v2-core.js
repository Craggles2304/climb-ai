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
#simplePostgameReview.op-superseded{display:none!important}#opPostGame332{margin-top:14px;padding:22px;background:linear-gradient(180deg,rgba(11,16,20,.99),rgba(7,11,14,.99));border:1px solid rgba(255,255,255,.08)}#opPostGame332.hidden{display:none!important}.op332-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}.op332-kicker{font-size:8px;letter-spacing:.21em;font-weight:900;color:#d6ff2f;text-transform:uppercase}.op332-head h2{font-size:clamp(30px,5vw,48px);margin:5px 0 5px;letter-spacing:-.045em;text-transform:uppercase}.op332-sub{margin:0;color:#7f8c97;font-size:11px;line-height:1.5}.op332-pill{border:1px solid rgba(214,255,47,.25);color:#d6ff2f;padding:8px 10px;font-size:8px;letter-spacing:.16em;font-weight:900;text-transform:uppercase}.op332-baseline{margin-top:18px;border-top:1px solid rgba(255,255,255,.08);padding-top:15px}.op332-section-label{font-size:8px;letter-spacing:.18em;font-weight:900;color:#73808b;text-transform:uppercase;margin-bottom:10px}.op332-baseline-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.op332-plan{border:1px solid rgba(255,255,255,.08);padding:13px;background:rgba(255,255,255,.018);min-height:122px}.op332-plan.mission{border-color:rgba(214,255,47,.2);background:rgba(214,255,47,.03)}.op332-plan span{display:block;font-size:8px;letter-spacing:.15em;color:#d6ff2f;font-weight:900;text-transform:uppercase}.op332-plan strong{display:block;margin-top:8px;font-size:12px;line-height:1.45}.op332-plan p{margin:7px 0 0;color:#76838e;font-size:9px;line-height:1.4}.op332-lock-note{margin:9px 0 0;color:#596671;font-size:8px;letter-spacing:.11em;text-transform:uppercase}.op332-main{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}.op332-column{border:1px solid rgba(255,255,255,.08);padding:15px}.op332-column.good{border-top:2px solid #d6ff2f}.op332-column.fix{border-top:2px solid #ff765f}.op332-column h3,.op332-neutral h3{margin:0 0 11px;font-size:13px;letter-spacing:.08em;text-transform:uppercase}.op332-list{display:grid;gap:9px}.op332-point{display:grid;grid-template-columns:25px minmax(0,1fr);gap:9px;padding:8px 0;border-top:1px solid rgba(255,255,255,.055)}.op332-point:first-child{border-top:0;padding-top:1px}.op332-point i{font-style:normal;width:22px;height:22px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.13);font-size:10px;font-weight:900}.op332-point b{display:block;font-size:11px;line-height:1.35}.op332-point p{margin:4px 0 0;font-size:10px;line-height:1.45;color:#87939d}.op332-point small{display:block;margin-top:5px;font-size:7px;letter-spacing:.12em;text-transform:uppercase;color:#596671}.op332-point.unverified{opacity:.52}.op332-neutral{margin-top:12px;border:1px solid rgba(67,140,255,.22);padding:15px}.op332-neutral-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.op332-observation{background:rgba(67,140,255,.035);border:1px solid rgba(67,140,255,.12);padding:12px}.op332-observation b{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.op332-observation p{margin:5px 0 0;color:#87939d;font-size:10px;line-height:1.45}.op332-next{margin-top:12px;border:1px solid rgba(214,255,47,.22);background:rgba(214,255,47,.035);padding:15px}.op332-next span{font-size:8px;letter-spacing:.17em;color:#d6ff2f;font-weight:900;text-transform:uppercase}.op332-next h3{margin:6px 0 4px;font-size:17px}.op332-next p{margin:0;color:#a2adb6;font-size:11px;line-height:1.5}.op332-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:12px}.op332-actions button{border:1px solid rgba(255,255,255,.12);background:transparent;color:#cdd6dd;padding:9px 12px;font-size:9px;letter-spacing:.12em;font-weight:900;cursor:pointer}.op332-actions button:disabled{opacity:.55;cursor:wait}@media(max-width:780px){.op332-baseline-grid,.op332-main,.op332-neutral-grid{grid-template-columns:1fr}.op332-plan{min-height:0}}`;
    document.head.appendChild(style);
    const section=document.createElement('section');
    section.id='opPostGame332';section.className='card hidden';section.setAttribute('aria-live','polite');
    section.innerHTML=`
      <div class="op332-head"><div><div id="op332Tag" class="op332-kicker">POST-GAME · 3 / 3 / 2</div><h2>GAME DEBRIEF</h2><p id="op332Match" class="op332-sub"></p></div><span class="op332-pill">REVIEW READY</span></div>
      <div class="op332-baseline"><div class="op332-section-label">THE PLAN YOU ACTUALLY TOOK INTO THE GAME</div><div class="op332-baseline-grid"><article class="op332-plan"><span>01 · VS THEIR TEAM</span><strong id="op332Vs"></strong><p id="op332VsWhy"></p></article><article class="op332-plan"><span>02 · YOUR WIN CONDITION</span><strong id="op332Win"></strong><p id="op332WinWhy"></p></article><article class="op332-plan mission"><span>CLIMB MISSION · PERSISTENT</span><strong id="op332Mission"></strong><p id="op332MissionWhy"></p></article></div><p id="op332LockNote" class="op332-lock-note">REVIEWED AGAINST THE LOCKED PRE-GAME PLAN · NO RESULT-BASED REWRITING</p></div>
      <div class="op332-main"><section class="op332-column good"><h3>3 THINGS DONE WELL</h3><div id="op332Good" class="op332-list"></div></section><section class="op332-column fix"><h3>3 THINGS TO IMPROVE</h3><div id="op332Improve" class="op332-list"></div></section></div>
      <section class="op332-neutral"><h3>2 NEUTRAL OBSERVATIONS</h3><div id="op332Neutral" class="op332-neutral-grid"></div></section>
      <section class="op332-next"><span>NEXT GAME · ONE FOCUS</span><h3 id="op332NextTitle"></h3><p id="op332NextRule"></p></section>
      <div class="op332-actions"><button id="op332Ready" type="button" style="border-color:rgba(214,255,47,.34);background:rgba(214,255,47,.07);color:#eaff89">NEW GAME · BACK TO READY</button><button id="op332Open" type="button">OPEN FULL REVIEW</button></div>`;
    const status=$('status');if(status)status.insertAdjacentElement('afterend',section);else document.querySelector('main')?.appendChild(section);
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
    setText('op332NextTitle',review.nextFocus?.title,'REPEAT THE CLEAN DECISIONS');
    setText('op332NextRule',review.nextFocus?.rule,'Keep the same CLIMB MISSION and build more evidence next game.');
  }

  install();
  window.opCompanion?.getState?.().then(render).catch(()=>{});
  window.opCompanion?.onState?.(render);
})();