(()=>{
  const $=id=>document.getElementById(id);
  const STORAGE_KEY='opclimb.remember-plan.v2';
  let previousPhase='';
  let flashTimer=null;

  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  const upper=value=>clean(value).toUpperCase();
  const safe=value=>Array.isArray(value)?value.filter(Boolean):[];

  function install(){
    if($('opRememberHud'))return $('opRememberHud');
    const style=document.createElement('style');
    style.id='op-remember-v2-style';
    style.textContent=`
body.op-remember-live #status,body.op-remember-live #matchup,body.op-remember-live #opMissionReminders,body.op-remember-live #idleArena{display:none!important}
#opRememberHud{position:relative;overflow:hidden;margin-top:12px;padding:0;background:radial-gradient(circle at 85% 0%,rgba(214,255,47,.08),transparent 28%),linear-gradient(160deg,#0b1116,#070b0f 66%);border:1px solid rgba(255,255,255,.09);box-shadow:0 24px 70px rgba(0,0,0,.3)}#opRememberHud.hidden{display:none!important}#opRememberHud:before{content:'';position:absolute;left:0;top:0;width:4px;height:100%;background:#d6ff2f}.rem-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:19px 21px 15px;border-bottom:1px solid rgba(255,255,255,.07)}.rem-kicker{font-size:8px;letter-spacing:.22em;color:#d6ff2f;font-weight:900;text-transform:uppercase}.rem-title{margin:5px 0 0;font-size:clamp(25px,4vw,39px);line-height:1;letter-spacing:-.045em;text-transform:uppercase}.rem-lock{border:1px solid rgba(214,255,47,.3);color:#d6ff2f;padding:8px 10px;font-size:8px;letter-spacing:.15em;font-weight:900;text-transform:uppercase;white-space:nowrap}.rem-body{padding:15px 20px 20px}.rem-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px}.rem-chip{font-size:7px;letter-spacing:.13em;font-weight:900;text-transform:uppercase;padding:6px 8px;border:1px solid rgba(255,255,255,.08);color:#8c9aa5;background:rgba(255,255,255,.02)}.rem-chip b{color:#d7e0e6}.rem-win{position:relative;padding:16px 17px 17px;border:1px solid rgba(214,255,47,.25);background:linear-gradient(100deg,rgba(214,255,47,.065),rgba(214,255,47,.012));clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)}.rem-win span,.rem-card span,.rem-lower span{display:block;font-size:7px;letter-spacing:.18em;text-transform:uppercase;font-weight:900}.rem-win span{color:#d6ff2f}.rem-win strong{display:block;margin-top:7px;font-size:clamp(17px,2.4vw,25px);line-height:1.25;letter-spacing:-.02em}.rem-grid{display:grid;grid-template-columns:1.05fr 1fr 1fr 1.35fr;gap:8px;margin-top:8px}.rem-card{min-height:103px;padding:12px 13px;border:1px solid rgba(255,255,255,.075);background:rgba(255,255,255,.018);clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,0 100%)}.rem-card span{color:#75838e}.rem-card strong{display:block;margin-top:7px;font-size:13px;line-height:1.32}.rem-card small{display:block;margin-top:5px;color:#7d8993;font-size:9px;line-height:1.35}.rem-card.target{border-color:rgba(214,255,47,.22)}.rem-card.target span,.rem-card.target strong{color:#d6ff2f}.rem-card.threat{border-color:rgba(255,91,91,.22);background:rgba(255,70,70,.025)}.rem-card.threat span{color:#ff8585}.rem-lower-grid{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:8px;margin-top:8px}.rem-lower{padding:11px 13px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.014)}.rem-lower span{color:#77848e}.rem-lower strong{display:block;margin-top:6px;font-size:11px;line-height:1.4}.rem-lower.behind{border-color:rgba(255,180,75,.2)}.rem-lower.behind span{color:#ffbc68}.rem-lower.mission{border-color:rgba(214,255,47,.18)}.rem-lower.mission span{color:#d6ff2f}.rem-check{margin-top:9px;border-top:1px solid rgba(255,255,255,.07)}.rem-check summary{cursor:pointer;list-style:none;padding:11px 2px 3px;color:#8997a1;font-size:8px;letter-spacing:.15em;font-weight:900;text-transform:uppercase}.rem-check summary::-webkit-details-marker{display:none}.rem-check summary:after{content:' +';color:#d6ff2f}.rem-check[open] summary:after{content:' −'}.rem-check-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:8px}.rem-check-card{padding:11px;border:1px solid rgba(67,140,255,.15);background:rgba(67,140,255,.025)}.rem-check-card b{display:block;color:#75a9ff;font-size:9px;letter-spacing:.1em}.rem-check-card p{margin:6px 0 0;color:#b1bbc2;font-size:10px;line-height:1.4}.rem-note{margin-top:9px;text-align:center;color:#4e5b65;font-size:7px;letter-spacing:.12em;text-transform:uppercase}.rem-flash{position:absolute;z-index:5;inset:0;display:none;place-items:center;background:rgba(4,8,11,.94);font-size:clamp(28px,7vw,64px);font-weight:950;letter-spacing:.05em;color:#d6ff2f;text-transform:uppercase}.rem-flash.on{display:grid;animation:remLock 1.15s ease both}@keyframes remLock{0%{opacity:0;transform:scale(1.04)}18%,72%{opacity:1;transform:scale(1)}100%{opacity:0}}@media(max-width:980px){.rem-grid{grid-template-columns:1fr 1fr}.rem-lower-grid{grid-template-columns:1fr}.rem-check-grid{grid-template-columns:1fr}}@media(max-width:580px){.rem-grid{grid-template-columns:1fr}.rem-title{font-size:27px}.rem-top,.rem-body{padding-left:16px;padding-right:16px}}
`;
    document.head.appendChild(style);

    const section=document.createElement('section');
    section.id='opRememberHud';section.className='card hidden';section.setAttribute('aria-live','polite');
    section.innerHTML=`
      <div id="opRememberFlash" class="rem-flash">PLAN LOCKED</div>
      <div class="rem-top"><div><div class="rem-kicker">MATCH PLAN // LOCKED FROM CHAMP SELECT</div><h2 id="opRememberTitle" class="rem-title">REMEMBER YOUR PLAN</h2></div><div class="rem-lock">PLAN LOCKED</div></div>
      <div class="rem-body">
        <div class="rem-chips"><div class="rem-chip">POWER · <b id="opRemPower">MID GAME</b></div><div class="rem-chip">SHAPE · <b id="opRemShape">CONNECTED 5V5</b></div><div class="rem-chip">DAMAGE · <b id="opRemDamage">MIXED DAMAGE</b></div></div>
        <article class="rem-win"><span>HOW WE WIN</span><strong id="opRemWin">PLAY THE LOCKED PLAN → OBJECTIVE</strong></article>
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

  function render(state){
    const section=install();
    const phase=String(state?.phase||'');
    const champion=championFor(state);
    const livePlan=state?.teamPlan?.rememberPlan||null;
    if(phase==='CHAMP_SELECT'&&livePlan)save(livePlan,champion);
    const plan=livePlan||load(champion);
    const visible=phase==='RECORDING'&&Boolean(plan);
    section.classList.toggle('hidden',!visible);
    document.body.classList.toggle('op-remember-live',visible);
    if(!visible){previousPhase=phase;return}

    set('opRememberTitle',`${upper(plan.champion||champion||'YOU')} · ${upper(plan.role||'ROLE')} // REMEMBER YOUR PLAN`);
    set('opRemPower',upper(plan.draft?.powerCurve),'MID GAME');
    set('opRemShape',upper(plan.draft?.teamShape),'CONNECTED 5V5');
    set('opRemDamage',upper(plan.draft?.damageProfile),'DRAFT READ');
    set('opRemWin',upper(plan.winPath),'PLAY THE LOCKED PLAN → OBJECTIVE');
    set('opRemTargetLabel',upper(plan.resourceTarget?.label),'RESOURCE TARGET');
    set('opRemTargetHead',upper(plan.resourceTarget?.headline),'PLAY CLEAN');
    set('opRemTargetSummary',upper(plan.resourceTarget?.summary),'');
    set('opRemWith',upper(plan.playWith),'YOUR FRONT LINE');
    set('opRemWatch',upper(plan.watch),'THEIR FIRST CLEAN ENGAGE');
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
