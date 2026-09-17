(()=>{
  const $=id=>document.getElementById(id);
  const STORAGE_KEY='opclimb.remember-plan.v2';
  let previousPhase='';
  let flashTimer=null;

  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  const upper=value=>clean(value).toUpperCase();
  const safe=value=>Array.isArray(value)?value.filter(Boolean):[];
  const normalRole=value=>{const r=upper(value);if(r==='BOTTOM')return'ADC';if(r==='UTILITY')return'SUPPORT';if(r==='MIDDLE')return'MID';return r||null};
  const clip=(value,max=92)=>{const text=clean(value);if(text.length<=max)return text;const cut=text.slice(0,max-1).replace(/\s+\S*$/,'');return`${cut||text.slice(0,max-1)}…`};

  function install(){
    if($('opRememberHud'))return $('opRememberHud');
    const style=document.createElement('style');
    style.id='op-remember-v2-style';
    style.textContent=`
body.op-remember-live #status,body.op-remember-live #matchup,body.op-remember-live #opMissionReminders,body.op-remember-live #idleArena{display:none!important}
body.op-pregame-v2 #opMissionReminders{padding:23px 25px 22px;background:radial-gradient(circle at 100% 0%,rgba(214,255,47,.055),transparent 32%),linear-gradient(180deg,rgba(11,16,21,.99),rgba(7,11,15,.99));box-shadow:0 18px 55px rgba(0,0,0,.2)}
body.op-pregame-v2 #opMissionReminders .op-head h3{font-size:27px}body.op-pregame-v2 #opMissionReminders .op-draft{margin-bottom:12px}
#opPregameMatchup{display:grid;grid-template-columns:minmax(180px,.72fr) 1fr;gap:16px;align-items:center;margin:0 0 12px;padding:15px 16px;border:1px solid rgba(67,140,255,.24);border-left:3px solid #4c91ff;background:linear-gradient(95deg,rgba(67,140,255,.07),rgba(67,140,255,.015));clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,0 100%)}#opPregameMatchup.hidden{display:none!important}.pre-match-kicker{font-size:7px;letter-spacing:.18em;font-weight:900;color:#6fa6ff;text-transform:uppercase}.pre-match-title{margin-top:6px;font-size:19px;line-height:1.08;font-weight:950;color:#f5f8fa;text-transform:uppercase}.pre-match-meta{margin-top:4px;font-size:8px;letter-spacing:.1em;color:#8796a2;text-transform:uppercase}.pre-match-cue{font-size:11px;line-height:1.45;color:#d9e1e7;font-weight:800;text-transform:uppercase}
#opRememberHud{position:relative;overflow:hidden;margin-top:14px;padding:0;background:radial-gradient(circle at 83% 0%,rgba(214,255,47,.11),transparent 29%),linear-gradient(150deg,#0d1419,#070b0f 64%);border:1px solid rgba(255,255,255,.1);box-shadow:0 26px 80px rgba(0,0,0,.4)}#opRememberHud.hidden{display:none!important}#opRememberHud:before{content:'';position:absolute;left:0;top:0;width:4px;height:100%;background:#d6ff2f}.rem-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:23px 25px 18px;border-bottom:1px solid rgba(255,255,255,.075)}.rem-kicker{font-size:8px;letter-spacing:.22em;color:#d6ff2f;font-weight:900;text-transform:uppercase}.rem-title{margin:6px 0 0;font-size:clamp(28px,4.2vw,43px);line-height:.98;letter-spacing:-.05em;text-transform:uppercase}.rem-live{display:flex;align-items:center;gap:7px;border:1px solid rgba(214,255,47,.3);color:#d6ff2f;padding:8px 11px;font-size:8px;letter-spacing:.15em;font-weight:900;text-transform:uppercase;white-space:nowrap}.rem-live:before{content:'';width:6px;height:6px;border-radius:50%;background:#d6ff2f;box-shadow:0 0 14px rgba(214,255,47,.9)}.rem-body{padding:18px 24px 23px}.rem-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.rem-chip{font-size:7px;letter-spacing:.13em;font-weight:900;text-transform:uppercase;padding:6px 8px;border:1px solid rgba(255,255,255,.08);color:#8c9aa5;background:rgba(255,255,255,.02)}.rem-chip b{color:#d7e0e6}.rem-win{position:relative;padding:18px 19px 19px;border:1px solid rgba(214,255,47,.3);background:linear-gradient(100deg,rgba(214,255,47,.08),rgba(214,255,47,.012));clip-path:polygon(0 0,calc(100% - 15px) 0,100% 15px,100% 100%,0 100%)}.rem-win span,.rem-card span,.rem-lower span,.rem-match span{display:block;font-size:7px;letter-spacing:.18em;text-transform:uppercase;font-weight:900}.rem-win span{color:#d6ff2f}.rem-win strong{display:block;margin-top:8px;font-size:clamp(19px,2.6vw,28px);line-height:1.2;letter-spacing:-.025em}.rem-match{display:grid;grid-template-columns:minmax(170px,.75fr) 1fr;gap:15px;align-items:center;margin-top:9px;padding:14px 15px;border:1px solid rgba(67,140,255,.25);background:linear-gradient(90deg,rgba(67,140,255,.07),rgba(67,140,255,.012));clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)}.rem-match span{color:#6fa6ff}.rem-match strong{display:block;margin-top:5px;font-size:17px;line-height:1.15;text-transform:uppercase}.rem-match small{display:block;margin-top:4px;color:#81909b;font-size:8px;letter-spacing:.08em;text-transform:uppercase}.rem-match-rule{font-size:11px;line-height:1.45;color:#dbe3e8;font-weight:800;text-transform:uppercase}.rem-grid{display:grid;grid-template-columns:1.05fr 1fr 1fr 1.35fr;gap:8px;margin-top:9px}.rem-card{min-height:106px;padding:13px 14px;border:1px solid rgba(255,255,255,.075);background:rgba(255,255,255,.018);clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,0 100%)}.rem-card span{color:#75838e}.rem-card strong{display:block;margin-top:7px;font-size:13px;line-height:1.32}.rem-card small{display:block;margin-top:5px;color:#7d8993;font-size:9px;line-height:1.35}.rem-card.target{border-color:rgba(214,255,47,.22)}.rem-card.target span,.rem-card.target strong{color:#d6ff2f}.rem-card.threat{border-color:rgba(255,91,91,.22);background:rgba(255,70,70,.025)}.rem-card.threat span{color:#ff8585}.rem-lower-grid{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:8px;margin-top:8px}.rem-lower{padding:12px 14px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.014)}.rem-lower span{color:#77848e}.rem-lower strong{display:block;margin-top:6px;font-size:11px;line-height:1.4}.rem-lower.behind{border-color:rgba(255,180,75,.2)}.rem-lower.behind span{color:#ffbc68}.rem-lower.mission{border-color:rgba(214,255,47,.18)}.rem-lower.mission span{color:#d6ff2f}.rem-check{margin-top:10px;border-top:1px solid rgba(255,255,255,.07)}.rem-check summary{cursor:pointer;list-style:none;padding:12px 2px 3px;color:#8997a1;font-size:8px;letter-spacing:.15em;font-weight:900;text-transform:uppercase}.rem-check summary::-webkit-details-marker{display:none}.rem-check summary:after{content:' +';color:#d6ff2f}.rem-check[open] summary:after{content:' −'}.rem-check-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:8px}.rem-check-card{padding:11px;border:1px solid rgba(67,140,255,.15);background:rgba(67,140,255,.025)}.rem-check-card b{display:block;color:#75a9ff;font-size:9px;letter-spacing:.1em}.rem-check-card p{margin:6px 0 0;color:#b1bbc2;font-size:10px;line-height:1.4}.rem-note{margin-top:10px;text-align:center;color:#4e5b65;font-size:7px;letter-spacing:.12em;text-transform:uppercase}.rem-flash{position:absolute;z-index:5;inset:0;display:none;place-items:center;background:rgba(4,8,11,.95);font-size:clamp(30px,7vw,68px);font-weight:950;letter-spacing:.05em;color:#d6ff2f;text-transform:uppercase}.rem-flash.on{display:grid;animation:remLock 1.15s ease both}@keyframes remLock{0%{opacity:0;transform:scale(1.04)}18%,72%{opacity:1;transform:scale(1)}100%{opacity:0}}@media(max-width:980px){.rem-grid{grid-template-columns:1fr 1fr}.rem-lower-grid{grid-template-columns:1fr}.rem-check-grid{grid-template-columns:1fr}.rem-match,#opPregameMatchup{grid-template-columns:1fr}}@media(max-width:580px){.rem-grid{grid-template-columns:1fr}.rem-title{font-size:29px}.rem-top,.rem-body{padding-left:16px;padding-right:16px}}
`;
    document.head.appendChild(style);

    const section=document.createElement('section');
    section.id='opRememberHud';section.className='card hidden';section.setAttribute('aria-live','polite');
    section.innerHTML=`
      <div id="opRememberFlash" class="rem-flash">PLAN LOCKED</div>
      <div class="rem-top"><div><div class="rem-kicker">MATCH PLAN // LOCKED FROM CHAMP SELECT</div><h2 id="opRememberTitle" class="rem-title">REMEMBER YOUR PLAN</h2></div><div class="rem-live">LIVE · RECORDING</div></div>
      <div class="rem-body">
        <div class="rem-chips"><div class="rem-chip">POWER · <b id="opRemPower">YOUR PLAN</b></div><div class="rem-chip">SHAPE · <b id="opRemShape">CONNECTED 5V5</b></div><div class="rem-chip">DAMAGE · <b id="opRemDamage">DRAFT READ</b></div></div>
        <article class="rem-win"><span>HOW WE WIN</span><strong id="opRemWin">PLAY THE LOCKED PLAN → OBJECTIVE</strong></article>
        <article class="rem-match"><div><span>MATCHUP</span><strong id="opRemMatchTitle">DETECTING LANE OPPONENT</strong><small id="opRemMatchEdge">RIOT POSITION DATA WILL FILL THIS IN</small></div><div id="opRemMatchRule" class="rem-match-rule">PLAY THE WAVE FIRST. CREATE THE ADVANTAGE BEFORE YOU COMMIT.</div></article>
        <div class="rem-grid">
          <article class="rem-card target"><span id="opRemTargetLabel">CS TARGET</span><strong id="opRemTargetHead">7.0 CS/MIN</strong><small id="opRemTargetSummary">70 @10 · 105 @15 · 140 @20</small></article>
          <article class="rem-card"><span>PLAY WITH</span><strong id="opRemWith">YOUR FRONT LINE</strong></article>
          <article class="rem-card threat"><span>WATCH</span><strong id="opRemWatch">THEIR FIRST ENGAGE</strong></article>
          <article class="rem-card"><span>FIGHT RULE</span><strong id="opRemFight">STAY CONNECTED → HIT WHAT IS SAFE</strong></article>
        </div>
        <div class="rem-lower-grid">
          <article class="rem-lower behind"><span>IF BEHIND</span><strong id="opRemBehind">SAFE WAVES → GROUP EARLY → BUY TIME</strong></article>
          <article class="rem-lower"><span>CONVERT</span><strong id="opRemObjective">WIN FIGHT → OBJECTIVE → RESET</strong></article>
          <article class="rem-lower mission"><span>CLIMB MISSION</span><strong id="opRemMission">KEEP YOUR CURRENT DEVELOPMENT FOCUS</strong></article>
        </div>
        <details class="rem-check"><summary>5 / 10 / 15 MIN SELF-CHECK · READ THE BOARD YOURSELF</summary><div id="opRemChecks" class="rem-check-grid"></div></details>
        <div class="rem-note">STATIC MEMORY AID · YOU READ THE LIVE GAME STATE · NO REACTIVE SHOTCALLING</div>
      </div>`;
    const status=$('status');if(status)status.insertAdjacentElement('afterend',section);else document.querySelector('main')?.appendChild(section);
    return section;
  }

  function installPregameMatchup(){
    const strategy=$('opMissionReminders');if(!strategy)return null;
    let card=$('opPregameMatchup');if(card)return card;
    card=document.createElement('article');card.id='opPregameMatchup';card.className='hidden';
    card.innerHTML=`<div><div class="pre-match-kicker">LANE MATCHUP</div><div id="opPreMatchTitle" class="pre-match-title"></div><div id="opPreMatchEdge" class="pre-match-meta"></div></div><div id="opPreMatchCue" class="pre-match-cue"></div>`;
    const draft=strategy.querySelector('.op-draft');if(draft)draft.insertAdjacentElement('afterend',card);else strategy.prepend(card);
    return card;
  }

  function save(plan,champion){
    if(!plan)return;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify({plan,champion:clean(champion),savedAt:new Date().toISOString()}))}catch{}
  }
  function load(champion){
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(!parsed?.plan)return null;
      const wanted=clean(champion).toLowerCase(),stored=clean(parsed.champion).toLowerCase();
      if(wanted&&stored&&wanted!==stored)return null;
      return parsed.plan;
    }catch{return null}
  }
  function championFor(state){return clean(state?.matchup?.champion||state?.matchup?.plan?.you?.name||state?.teamPlan?.rememberPlan?.champion)}
  function missionFor(state){return clean(safe(state?.teamPlan?.missionTips)[0]?.cue)||'KEEP YOUR CURRENT DEVELOPMENT FOCUS'}
  function set(id,value,fallback='—'){const node=$(id);if(node)node.textContent=clean(value)||fallback}

  function draftOpponent(state,role){
    const enemies=safe(state?.teamPlan?.theirTeam);
    if(role){const exact=enemies.find(enemy=>normalRole(enemy?.role)===role&&clean(enemy?.name));if(exact)return clean(exact.name)}
    return enemies.length===1?clean(enemies[0]?.name):'';
  }
  function matchupFor(state){
    const role=normalRole(state?.matchup?.role||state?.matchup?.plan?.role||state?.teamPlan?.rememberPlan?.role);
    const you=clean(state?.matchup?.champion||state?.matchup?.plan?.you?.name||state?.teamPlan?.rememberPlan?.champion)||'YOU';
    const opponent=clean(state?.matchup?.opponent||state?.matchup?.plan?.them?.name)||draftOpponent(state,role);
    const plan=state?.matchup?.plan||null;
    const edge=clean(plan?.laneEdge?.label)||'MATCHUP READ';
    const cue=clean(plan?.laneDuel?.yourPattern)||clean(safe(plan?.rules)[0])||clean(safe(plan?.winCondition)[0])||'PLAY THE WAVE FIRST. CREATE THE ADVANTAGE BEFORE YOU COMMIT.';
    return{role,you,opponent,edge,cue};
  }

  function resourceFallback(role){
    if(role==='SUPPORT')return{label:'MAP TARGET',headline:'SET UP FIRST',summary:'MOVE WITH JUNGLE → VISION → OBJECTIVE'};
    if(role==='JUNGLE')return{label:'FARM TARGET',headline:'6.2 CS/MIN',summary:'60 @10 · 95 @15 · 125 @20'};
    return{label:'CS TARGET',headline:'7.0 CS/MIN',summary:'70 @10 · 105 @15 · 140 @20'};
  }
  function shapeFor(team){const raw=upper(team?.teamfight?.label||team?.ourIdentity||'CONNECTED 5V5');if(raw.includes('FRONT'))return'FRONT TO BACK';if(raw.includes('DIVE'))return'DIVE TOGETHER';if(raw.includes('POKE'))return'POKE FIRST';if(raw.includes('PICK'))return'FIND PICK';return raw||'CONNECTED 5V5'}
  function fallbackPlan(state){
    const team=state?.teamPlan||{};const match=matchupFor(state);const role=match.role;const shape=shapeFor(team);const target=team?.resourceTarget||resourceFallback(role);
    let win='PLAY THE LOCKED PLAN → WIN THE CLEAN FIGHT → OBJECTIVE';
    if(role==='ADC')win=`FARM CLEAN → SURVIVE FIRST CONTACT → FRONT TO BACK → OBJECTIVE`;
    else if(role==='MID')win=`CONTROL WAVE → MOVE FIRST → ${shape} → OBJECTIVE`;
    else if(role==='JUNGLE')win='CLEAR ON TEMPO → MOVE FIRST → OBJECTIVE SETUP → CONVERT';
    else if(role==='TOP')win=shape.includes('SIDE')?'SIDE PRESSURE → FORCE RESPONSE → OBJECTIVE':'WAVE FIRST → FRONT EDGE → OBJECTIVE';
    else if(role==='SUPPORT')win='SET VISION → ENABLE CARRY → CONTROL FIRST CONTACT → OBJECTIVE';
    const playWith=role==='ADC'?'YOUR PEEL / FRONT LINE':role==='SUPPORT'?'YOUR JUNGLE + MAIN CARRY':role==='JUNGLE'?'THE LANE WITH FIRST MOVE':'YOUR FIRST-CONTACT CHAMPION';
    const watch=match.opponent?`${match.opponent} · YOUR MATCHUP`:'THEIR FIRST CLEAN ENGAGE';
    const fight=clean(team?.yourJob)|| (role==='ADC'?'STAY BEHIND FIRST CONTACT → HIT NEAREST SAFE TARGET':role==='MID'?'PLAY BEHIND FIRST CONTACT → LAYER DAMAGE / CONTROL':'STAY CONNECTED → ONE CALL → SAME FIGHT');
    return{champion:match.you,role,draft:{powerCurve:'YOUR PLAN',teamShape:shape,damageProfile:'DRAFT READ'},winPath:win,resourceTarget:target,playWith,watch,fightRule:fight,behindPlan:role==='ADC'?'SAFE FARM → STAY WITH PEEL → SCALE INTO THE NEXT FIGHT':'SAFE WAVES → GROUP EARLY → BUY TIME',objectiveRule:'WIN FIGHT / PICK → OBJECTIVE → RESET',checks:[{minute:5,title:'FIRST READ',questions:['WHO HAS THE FIRST USABLE LEAD?','IS THE ORIGINAL PLAN ON TRACK?']},{minute:10,title:'MAP READ',questions:['WHO IS STRONGEST NOW?','WHICH SIDE / OBJECTIVE MATTERS NEXT?']},{minute:15,title:'RECHECK',questions:['WHO IS THEIR BIGGEST THREAT NOW?','ORIGINAL PLAN OR RECOVERY PLAN?']}]};
  }

  function renderChecks(checks){
    const root=$('opRemChecks');if(!root)return;root.replaceChildren();
    safe(checks).slice(0,3).forEach(check=>{
      const card=document.createElement('article');card.className='rem-check-card';
      const title=document.createElement('b');title.textContent=`${check.minute} MIN · ${upper(check.title)}`;
      const copy=document.createElement('p');copy.textContent=safe(check.questions).slice(0,2).map(upper).join(' · ');
      card.append(title,copy);root.appendChild(card);
    });
  }

  function flashLock(){
    const node=$('opRememberFlash');if(!node)return;
    node.classList.remove('on');void node.offsetWidth;node.classList.add('on');
    clearTimeout(flashTimer);flashTimer=setTimeout(()=>node.classList.remove('on'),1200);
  }

  function renderPregame(state){
    const phase=String(state?.phase||'');const card=installPregameMatchup();if(!card)return;
    const match=matchupFor(state);const show=phase==='CHAMP_SELECT'&&Boolean(match.opponent);
    card.classList.toggle('hidden',!show);document.body.classList.toggle('op-pregame-v2',phase==='CHAMP_SELECT');
    if(!show)return;
    set('opPreMatchTitle',`${upper(match.you)} VS ${upper(match.opponent)}`);
    set('opPreMatchEdge',upper(match.edge),'MATCHUP READ');
    set('opPreMatchCue',upper(clip(match.cue,150)),'CREATE THE ADVANTAGE BEFORE YOU COMMIT.');
  }

  function render(state){
    const section=install();renderPregame(state);
    const phase=String(state?.phase||'');
    const champion=championFor(state);
    const livePlan=state?.teamPlan?.rememberPlan||null;
    if(phase==='CHAMP_SELECT'&&livePlan)save(livePlan,champion);
    const plan=livePlan||load(champion)||fallbackPlan(state);
    const visible=phase==='RECORDING';
    section.classList.toggle('hidden',!visible);
    document.body.classList.toggle('op-remember-live',visible);
    if(!visible){previousPhase=phase;return}

    const match=matchupFor(state);
    set('opRememberTitle',`${upper(plan.champion||champion||'YOU')} · ${upper(plan.role||match.role||'ROLE')} // REMEMBER YOUR PLAN`);
    set('opRemPower',upper(plan.draft?.powerCurve),'YOUR PLAN');
    set('opRemShape',upper(plan.draft?.teamShape),'CONNECTED 5V5');
    set('opRemDamage',upper(plan.draft?.damageProfile),'DRAFT READ');
    set('opRemWin',upper(plan.winPath),'PLAY THE LOCKED PLAN → OBJECTIVE');
    set('opRemMatchTitle',match.opponent?`${upper(match.you)} VS ${upper(match.opponent)}`:'DETECTING LANE OPPONENT');
    set('opRemMatchEdge',upper(match.edge),match.opponent?'MATCHUP READ':'RIOT POSITION DATA WILL FILL THIS IN');
    set('opRemMatchRule',upper(clip(match.cue,150)),'PLAY THE WAVE FIRST. CREATE THE ADVANTAGE BEFORE YOU COMMIT.');
    set('opRemTargetLabel',upper(plan.resourceTarget?.label),'RESOURCE TARGET');
    set('opRemTargetHead',upper(plan.resourceTarget?.headline),'PLAY CLEAN');
    set('opRemTargetSummary',upper(plan.resourceTarget?.summary),'');
    set('opRemWith',upper(plan.playWith),'YOUR FRONT LINE');
    set('opRemWatch',match.opponent?`${upper(match.opponent)} · ${upper(match.edge)}`:upper(plan.watch),'THEIR FIRST CLEAN ENGAGE');
    set('opRemFight',upper(plan.fightRule),'STAY CONNECTED → HIT WHAT IS SAFE');
    set('opRemBehind',upper(plan.behindPlan),'SAFE WAVES → GROUP EARLY → BUY TIME');
    set('opRemObjective',upper(plan.objectiveRule),'WIN FIGHT → OBJECTIVE → RESET');
    set('opRemMission',upper(missionFor(state)),'KEEP YOUR CURRENT DEVELOPMENT FOCUS');
    renderChecks(plan.checks);

    if(previousPhase&&previousPhase!=='RECORDING')flashLock();
    previousPhase=phase;
  }

  install();
  window.opCompanion?.getState?.().then(render).catch(()=>{});
  window.opCompanion?.onState?.(render);
})();
