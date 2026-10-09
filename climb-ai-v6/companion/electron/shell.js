/* OP CLIMB Companion — app shell.
 *
 * Owns the sidebar, header, "where am I / what next" strip and routing.
 * Legacy screens still render themselves from Companion state; the shell
 * only decides which of them belong to the current route (the "gate") and
 * shows an honest route state when a screen has nothing to show yet.
 *
 * The match phase picks the default route, so with no clicks the app follows
 * the game exactly as before. A manual choice holds until the phase changes.
 */
(()=>{
  'use strict';
  const api=window.opCompanion;
  const $=id=>document.getElementById(id);

  /* ---------------------------------------------------------------- data -- */

  const ICONS={
    home:'<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
    dna:'<path d="M7 3c0 6 10 6 10 12s-10 3-10 6M17 3c0 6-10 6-10 12s10 3 10 6M8.6 7.5h6.8M8.6 16.5h6.8"/>',
    draft:'<path d="m4 4 9 9M4 4v4M4 4h4M20 4l-9 9M20 4v4M20 4h-4M7 17l-3 3M17 17l3 3M9.5 15.5l-2 2M14.5 15.5l2 2"/>',
    prep:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8.5 11l2 2 4-4M8.5 17h7"/>',
    live:'<circle cx="12" cy="12" r="2.2"/><path d="M8 8a5.6 5.6 0 0 0 0 8M16 8a5.6 5.6 0 0 1 0 8M5.2 5.2a9.6 9.6 0 0 0 0 13.6M18.8 5.2a9.6 9.6 0 0 1 0 13.6"/>',
    review:'<path d="M3 12h3l2.5-6 4 12 3-9 2 3H21"/>',
    memory:'<path d="M12 4.5a3.5 3.5 0 0 0-6.6 1.6A3.5 3.5 0 0 0 4 12a3.5 3.5 0 0 0 2.2 5.6A3.5 3.5 0 0 0 12 19.5zM12 4.5a3.5 3.5 0 0 1 6.6 1.6A3.5 3.5 0 0 1 20 12a3.5 3.5 0 0 1-2.2 5.6A3.5 3.5 0 0 1 12 19.5M12 4.5v15"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    lock:'<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
    collapse:'<path d="m15 6-6 6 6 6"/>',
    external:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    key:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8"/>',
  };
  const icon=(name,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||''}</svg>`;

  const ROUTES=[
    {id:'home',    label:'Home',              group:'You',   eyebrow:'Your climb', tone:'lime'},
    {id:'dna',     label:'My Game DNA',       group:'You',   eyebrow:'Your climb', tone:'violet'},
    {id:'draft',   label:'Champion Select',   group:'Match', eyebrow:'Match',      tone:'cyan'},
    {id:'prep',    label:'Match Preparation', group:'Match', eyebrow:'Match',      tone:'cyan'},
    {id:'live',    label:'Live Companion',    group:'Match', eyebrow:'Match',      tone:'red'},
    {id:'review',  label:'Match Review',      group:'Match', eyebrow:'Match',      tone:'lime'},
    {id:'memory',  label:'Coach Memory',      group:'Coach', eyebrow:'Coach',      tone:'violet', plan:'PRO'},
    {id:'settings',label:'Settings',          footer:true,   eyebrow:'Companion',  tone:'neutral'},
  ];
  const ROUTE=Object.fromEntries(ROUTES.map(route=>[route.id,route]));

  /** The route each match phase opens on. */
  function phaseRoute(phase){
    return({CHAMP_SELECT:'draft',RECORDING:'live',UPLOADING:'review',REVIEW:'review'})[phase]||'home';
  }

  /** The four-step match loop shown in the strip. */
  const LOOP=[
    {id:'between',label:'Between games'},
    {id:'draft',  label:'Champion select'},
    {id:'game',   label:'In game'},
    {id:'review', label:'Post-game'},
  ];
  function loopStep(phase){
    return({CHAMP_SELECT:'draft',RECORDING:'game',UPLOADING:'review',REVIEW:'review'})[phase]||'between';
  }
  const LOOP_TONE={between:'lime',draft:'cyan',game:'red',review:'lime'};

  /* Which legacy screens belong to which routes. Top-level children of
     #legacyView not listed here follow the phase: they show only on the
     route the current phase opens. */
  const MEMBERS={
    setup:['home'], status:['home'], tftHome:['home'], tftPrep:['home'],
    opMissionReminders:['live'],
    quietMode:['live'], opRememberHud:['live'],
    // The deep-analysis engines show under the native review only when the player opens them.
    opPostGame332:r=>r==='review'&&document.body.classList.contains('oc-review-deep'),
    settings:['settings'],
  };
  const isMember=(members,r)=>typeof members==='function'?members(r):members.includes(r);
  /* Parts inside a legacy screen that only some of its routes should show. */
  const NESTED=[];
  /* What counts as real content for a route. If none of it is visible, the
     shell shows the route state instead of an empty page. */
  const PROBES={
    home:['#setup','#status','#tftHome','#tftPrep'],
    dna:[],
    draft:[],
    prep:[],
    live:['#quietMode','#opRememberHud','#opMissionReminders'],
    review:[],
    settings:['#settings'],
    memory:[],
  };

  /* --------------------------------------------------------------- state -- */

  let state=null;
  let update=null;
  let route='home';
  let lastPhase=null;
  let reviewSeen=false;
  let feedbackTimer=null;

  const shell=$('ocShell');
  const legacy=$('legacyView');
  const view=$('ocView');
  const inner=$('ocViewInner');
  const routeState=$('ocRouteState');
  const native=$('ocNative');
  if(!shell||!legacy||!view||!inner||!routeState||!native)return;

  /* Native views register on window.ocViews before this script runs:
       ocViews[route]={render(root,state,ctx)->boolean, observe?(state),
                       leave?(state,ctx), ownsNextAction?:boolean}
     render() returns false when it has nothing to show, so the route state
     (or a legacy screen) can take its place. */
  const VIEWS=window.ocViews||{};
  let nativeShown=false;

  const text=value=>String(value??'').trim();
  const upper=value=>text(value).toUpperCase();
  const phaseOf=s=>upper(s?.phase)||'STARTING';
  // Same source order as renderer.js companionPlanTier: paid membership only, never rank calibration.
  const tierOf=s=>{const tier=upper(s?.teamPlan?.strategyAccess?.tier||s?.playerHome?.tier);return['FREE','PLUS','PRO'].includes(tier)?tier:null};
  const titleCase=value=>text(value).toLowerCase().replace(/\b[a-z]/g,ch=>ch.toUpperCase()).replace(/\b(Ii|Iii|Iv)\b/g,m=>m.toUpperCase());
  const roleName=value=>({TOP:'Top',JUNGLE:'Jungle',MID:'Mid',MIDDLE:'Mid',ADC:'ADC',BOTTOM:'ADC',SUPPORT:'Support',UTILITY:'Support'})[upper(value)]||'';
  const tftBusy=s=>['INITIALIZING','RECORDING','PROCESSING','READY'].includes(upper(s?.tftRecorder?.state));
  function dnaRevealed(s){
    const role=upper(s?.playerHome?.selectedRole||s?.playerHome?.player?.role);
    try{return Boolean(role)&&localStorage.getItem('op:dna-revealed:'+role)==='1'}catch{return false}
  }

  /* ------------------------------------------------------------- sidebar -- */

  function buildNav(){
    const nav=$('ocNav');
    const footer=$('ocNavFooter');
    const groups=new Map();
    ROUTES.forEach((item,index)=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='oc-nav__item';
      button.dataset.route=item.id;
      button.title=`${item.label} (Ctrl+${index+1})`;
      button.innerHTML=`${icon(item.id)}<span class="oc-nav__label">${item.label}</span><span class="oc-nav__badge"></span>`;
      button.addEventListener('click',()=>go(item.id));
      if(item.footer){footer.prepend(button);return}
      if(!groups.has(item.group)){
        const group=document.createElement('div');
        group.className='oc-nav__group';
        group.innerHTML=`<div class="oc-nav__heading">${item.group}</div>`;
        groups.set(item.group,group);
        nav.appendChild(group);
      }
      groups.get(item.group).appendChild(button);
    });
  }

  function badge(id,html){
    const node=shell.querySelector(`.oc-nav__item[data-route="${id}"] .oc-nav__badge`);
    if(node&&node.innerHTML!==html)node.innerHTML=html;
  }

  function renderNav(){
    const s=state||{};
    const phase=phaseOf(s);
    const tier=tierOf(s);
    const home=s.playerHome?.ok?s.playerHome:null;
    shell.querySelectorAll('.oc-nav__item').forEach(button=>{
      const active=button.dataset.route===route;
      if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });

    // DNA: baseline count until it is complete, then a one-time reveal flag.
    const baseline=home?.baseline;
    if(baseline&&!baseline.ready)badge('dna',`<span class="oc-chip oc-chip--neutral">${Math.min(Number(baseline.games)||0,Number(baseline.required)||3)}/${Number(baseline.required)||3}</span>`);
    else if(baseline?.ready&&!dnaRevealed(s))badge('dna','<span class="oc-chip oc-chip--dna">New</span>');
    else badge('dna','');

    // Long labels get a dot only, so the label is never truncated.
    badge('draft',phase==='CHAMP_SELECT'?'<span class="oc-dot oc-dot--live oc-tone-cyan"></span><span class="oc-sr-only">Live now</span>':'');
    const planReady=phase==='CHAMP_SELECT'&&upper(s.matchup?.status)==='READY';
    badge('prep',planReady?'<span class="oc-dot oc-tone-cyan"></span><span class="oc-sr-only">Plan ready</span>':'');
    badge('live',phase==='RECORDING'?'<span class="oc-dot oc-dot--live oc-tone-red"></span><span class="oc-sr-only">Live now</span>':'');
    badge('review',phase==='UPLOADING'
      ?'<span class="oc-spinner" style="width:14px;height:14px;color:var(--oc-lime)" aria-label="Building review"></span>'
      :phase==='REVIEW'&&!reviewSeen?'<span class="oc-chip">New</span>':'');

    // Coach Memory is PRO. Show the requirement, never a broken control.
    const locked=tier!=='PRO';
    const memory=shell.querySelector('.oc-nav__item[data-route="memory"]');
    memory?.classList.toggle('is-locked',locked);
    badge('memory',locked?'<span class="oc-tier oc-tier--pro">Pro</span><span class="oc-sr-only">Requires PRO</span>':'');

    const status=upper(update?.status);
    badge('settings',['AVAILABLE','DOWNLOADING','READY'].includes(status)?'<span class="oc-chip oc-chip--warning">Update</span>':'');
  }

  function renderIdentity(){
    const s=state||{};
    const root=$('ocIdentity');
    const home=s.playerHome?.ok?s.playerHome:null;
    const player=home?.player||null;
    const phase=phaseOf(s);
    const link=!s.paired?'warn':['AUTH_ERROR','ERROR'].includes(phase)?'bad':['STARTING','RESTARTING'].includes(phase)||!s.trackerRunning?'warn':'ok';
    root.dataset.link=link;

    const avatar=$('ocIdentityAvatar'),name=$('ocIdentityName'),rank=$('ocIdentityRank'),meta=$('ocIdentityMeta');
    if(!s.paired){
      avatar.textContent='?';
      name.textContent='Not paired';
      rank.textContent='Pair from OP CLIMB';
      meta.replaceChildren();
      root.title='This PC is not paired';
      return;
    }
    if(!player){
      avatar.textContent='OP';
      name.textContent='Loading profile…';
      rank.textContent='Connected to OP CLIMB';
      meta.replaceChildren();
      root.title='';
      return;
    }
    const gameName=text(player.gameName)||'Player';
    avatar.textContent=gameName.slice(0,1);
    name.innerHTML='';
    name.append(gameName);
    if(text(player.tagline)){const tag=document.createElement('span');tag.textContent='#'+text(player.tagline);name.appendChild(tag)}
    // Only verified rank data. LP is shown only for a ranked player.
    const rankText=upper(player.rank);
    const ranked=rankText&&rankText!=='UNRANKED';
    rank.textContent=ranked?`${titleCase(rankText)}${Number.isFinite(Number(player.leaguePoints))?` · ${Number(player.leaguePoints)} LP`:''}`:'Unranked';
    meta.replaceChildren();
    const role=roleName(home.selectedRole||player.role);
    if(role){const chip=document.createElement('span');chip.className='oc-chip oc-chip--sm oc-chip--neutral';chip.textContent=role;meta.appendChild(chip)}
    const tier=tierOf(s);
    if(tier){const chip=document.createElement('span');chip.className=`oc-tier oc-tier--${tier.toLowerCase()}`;chip.textContent=tier;meta.appendChild(chip)}
    root.title=`${gameName}${text(player.tagline)?'#'+text(player.tagline):''} · ${rank.textContent}`;
  }

  function renderVersion(){
    const version=text(update?.currentVersion);
    $('ocVersion').textContent=version?`v${version}`:'';
  }

  /* -------------------------------------------------------------- header -- */

  function renderHeader(){
    const item=ROUTE[route];
    $('ocRouteEyebrow').textContent=item.eyebrow;
    $('ocRouteEyebrow').className=`oc-eyebrow oc-tone-${item.tone}`;
    $('ocRouteTitle').textContent=item.label;
    document.title=`${item.label} · OP CLIMB Companion`;

    const s=state||{};
    const phase=phaseOf(s);
    const status=$('ocSystemStatus');
    const health=!s.paired&&phase!=='STARTING'
      ?{tone:'amber',title:'Not paired',detail:'Pair from OP CLIMB',live:false}
      :phase==='AUTH_ERROR'?{tone:'red',title:'Pairing expired',detail:'Re-pair from OP CLIMB',live:false}
      :phase==='ERROR'?{tone:'red',title:'Needs attention',detail:'Tracker stopped',live:false}
      :phase==='STARTING'?{tone:'amber',title:'Starting',detail:'Connecting to OP CLIMB',live:false}
      :phase==='RESTARTING'?{tone:'amber',title:'Reconnecting',detail:'Restarting the tracker',live:false}
      :s.trackerRunning?{tone:'green',title:'Connected',detail:'Tracking League games',live:true}
      :{tone:'amber',title:'Tracker offline',detail:'Restart from Settings',live:false};
    status.className=`oc-status oc-tone-${health.tone}`;
    status.innerHTML=`<span class="oc-dot${health.live?' oc-dot--live':''}"></span><span class="oc-status__text"><span class="oc-status__title"></span><span class="oc-status__detail"></span></span>`;
    status.querySelector('.oc-status__title').textContent=health.title;
    status.querySelector('.oc-status__detail').textContent=health.detail;

    const chip=$('ocUpdateChip');
    const updateStatus=upper(update?.status);
    const showUpdate=['AVAILABLE','DOWNLOADING','READY'].includes(updateStatus);
    chip.hidden=!showUpdate;
    if(showUpdate)chip.textContent=updateStatus==='READY'?'Update ready':updateStatus==='DOWNLOADING'?`Updating ${Math.round(Number(update.progress)||0)}%`:'Update available';
  }

  /* --------------------------------------------------------------- strip -- */

  /** The single next step for the player's real situation. */
  function nextStep(){
    const s=state||{};
    const phase=phaseOf(s);
    const home=s.playerHome?.ok?s.playerHome:null;
    const goTo=(target,label)=>route===target?null:{label,run:()=>go(target)};
    // On Home the setup card already carries the pairing button.
    if(!s.paired&&phase!=='STARTING')return{text:'Pair this PC to start tracking your games.',action:route==='home'?null:{label:'Pair this PC',run:()=>api?.openClimb?.()}};
    if(phase==='AUTH_ERROR')return{text:'This PC needs to be paired again.',action:{label:'Open OP CLIMB',run:()=>api?.openClimb?.()}};
    if(phase==='ERROR')return{text:'Restart the tracker to reconnect to League.',action:{label:'Restart tracker',run:()=>api?.restart?.()}};
    if(phase==='STARTING'||phase==='RESTARTING')return{text:'Getting ready. Nothing to do.'};
    if(phase==='CHAMP_SELECT'){
      const draft=s.draft;
      const ready=upper(s.matchup?.status)==='READY';
      if(draft?.localLockedIn&&ready)return{text:'Read your plan once before the game loads.',action:goTo('prep','Open match plan')};
      if(draft?.localLockedIn)return{text:'Locked in. Your match plan is being finalised.'};
      if(text(draft?.localChampionName))return{text:'Lock in your champion to freeze the plan.'};
      return{text:'Hover a champion to preview your plan.'};
    }
    if(phase==='RECORDING')return route==='live'
      ?{text:'Play the plan. Bookmark key moments for your review.',action:{label:'Bookmark moment',run:bookmark}}
      :{text:'Play the plan. Press Ctrl+Shift+M to bookmark a moment.',action:goTo('live','Open live companion')};
    if(phase==='UPLOADING')return{text:'Your review opens here automatically when it is ready.'};
    if(phase==='REVIEW'){
      if(route!=='review')return{text:'Your post-game review is ready.',action:goTo('review','Review last game')};
      const next=text(s.postGameReview?.developmentPlan?.primary?.title||s.postGameReview?.nextFocus?.title);
      return{text:next?`Next game: ${next}`:'Read your review, then queue for your next game.'};
    }
    // Between games. A review the player hasn't opened yet comes first.
    if(s.postGameReview&&window.ocUI&&!window.ocUI.reviewSeen(s.postGameReview))
      return{text:'Your last game\'s review is ready.',action:goTo('review','Review last game')};
    const tftState=upper(s.tftRecorder?.state);
    if(tftBusy(s))return{text:tftState==='RECORDING'?'Play your TFT game. Coaching follows after it ends.':'Your TFT review is being prepared.'};
    if(!home)return{text:'Open League and queue up. OP CLIMB takes over in champion select.'};
    const baseline=home.baseline||{};
    const required=Math.max(1,Number(baseline.required)||3);
    const games=Math.min(Math.max(0,Number(baseline.games)||0),required);
    const role=roleName(home.selectedRole||home.player?.role);
    if(!baseline.ready)return{text:`Play baseline game ${Math.min(games+1,required)} of ${required}${role?` as ${role}`:''}. Play normally.`};
    if(!dnaRevealed(s))return{text:'Your Game DNA is ready to reveal.',action:goTo('dna','Open Game DNA')};
    const mission=home.priorityMission||(Array.isArray(home.missions)?home.missions[0]:null);
    // Missions are already on Home and My Game DNA; only offer the jump from elsewhere.
    if(mission)return{text:`Next game: ${text(mission.nextGame||mission.title)}`,action:['home','dna'].includes(route)?null:{label:'View mission',run:()=>go('dna')}};
    return{text:'Queue up. OP CLIMB takes over in champion select.'};
  }

  function renderStrip(){
    const s=state||{};
    const phase=phaseOf(s);
    const step=loopStep(phase);
    const index=LOOP.findIndex(item=>item.id===step);
    const strip=$('ocStrip');
    strip.className=`oc-strip oc-tone-${LOOP_TONE[step]}`;
    const steps=$('ocLoopSteps');
    steps.querySelectorAll('i').forEach((node,i)=>{
      node.className=i<index?'is-past':i===index?'is-now':'';
    });
    $('ocLoopLabel').textContent=LOOP[index].label;
    $('ocLoop').setAttribute('aria-label',`Match loop: step ${index+1} of 4, ${LOOP[index].label}`);

    const next=nextStep();
    const nextNode=$('ocNext');
    nextNode.innerHTML='<b>NEXT</b>';
    nextNode.append(next.text);
    nextNode.title=next.text;
    $('ocNow').textContent=text(s.detail)||'Starting OP CLIMB Companion…';

    // A native view that shows its own main action keeps the strip text-only.
    const viewOwnsAction=nativeShown&&VIEWS[route]?.ownsNextAction;
    const button=$('ocNextAction');
    if(next.action&&!viewOwnsAction){
      button.hidden=false;
      button.textContent=next.action.label;
      button.onclick=()=>next.action.run();
    }else{
      button.hidden=true;
      button.onclick=null;
    }
  }

  async function bookmark(){
    const result=await api?.markMoment?.().catch(()=>null);
    const node=$('ocStripFeedback');
    node.textContent=result?.ok?'Moment bookmarked for your review.':text(result?.error)||'Could not bookmark this moment.';
    node.style.color=result?.ok?'':'var(--oc-red)';
    clearTimeout(feedbackTimer);
    feedbackTimer=setTimeout(()=>{node.textContent=''},3200);
  }

  /* ---------------------------------------------------------------- gate -- */

  function setGate(el,show){
    if(show){
      if(el.dataset.ocGated!=='1')return;
      const prev=el.dataset.ocPrevDisplay||'';
      const [value,priority]=prev.split('|');
      if(value)el.style.setProperty('display',value,priority||'');else el.style.removeProperty('display');
      delete el.dataset.ocGated;
      delete el.dataset.ocPrevDisplay;
    }else if(el.dataset.ocGated!=='1'){
      // Keep any inline display a legacy screen set, so showing it again restores it.
      const value=el.style.getPropertyValue('display');
      if(value)el.dataset.ocPrevDisplay=`${value}|${el.style.getPropertyPriority('display')}`;
      el.style.setProperty('display','none','important');
      el.dataset.ocGated='1';
    }
  }

  const isShown=el=>Boolean(el&&el.getClientRects().length);

  function applyGate(){
    const phase=phaseOf(state);
    // Unlisted legacy screens (status stages) only fill a phase route with no native view.
    const followsPhase=route===phaseRoute(phase)&&!nativeShown;
    let followerShown=false;
    for(const el of legacy.children){
      const members=MEMBERS[el.id];
      const show=members?isMember(members,route):followsPhase;
      setGate(el,show);
      if(!members&&show&&isShown(el))followerShown=true;
    }
    for(const [selector,routes] of NESTED){
      legacy.querySelectorAll(selector).forEach(el=>setGate(el,routes.includes(route)));
    }
    const hasContent=nativeShown||followerShown||PROBES[route].some(selector=>isShown(legacy.querySelector(selector)));
    renderRouteState(!hasContent);
  }

  const ctx={go,get route(){return route},get update(){return update},api};
  function renderNative(){
    const viewFor=VIEWS[route];
    let shown=false;
    if(viewFor){
      try{shown=Boolean(viewFor.render(native,state||{},ctx))}
      catch(err){console.error('[ocShell] view failed',route,err);shown=false}
    }
    if(!shown&&native.childElementCount)native.replaceChildren();
    native.hidden=!shown;
    native.dataset.route=shown?route:'';
    nativeShown=shown;
  }

  let gateQueued=false;
  function queueGate(){
    if(gateQueued)return;
    gateQueued=true;
    requestAnimationFrame(()=>{gateQueued=false;applyGate()});
  }

  /* --------------------------------------------------------- route state -- */

  /** What a route says when it has nothing to show. Every line is true for the
   *  player's actual state; no screen pretends data exists. */
  function routeCopy(){
    const s=state||{};
    const phase=phaseOf(s);
    const tier=tierOf(s);
    const home=s.playerHome?.ok?s.playerHome:null;
    const pair={label:'Pair this PC',kind:'primary',run:()=>api?.openClimb?.()};
    if(!s.paired&&phase!=='STARTING'&&route!=='memory'){
      return{eyebrow:'Not paired',title:'Pair this PC first',body:'Open Live Companion on OP CLIMB and choose Pair this PC. The website opens the Companion and completes pairing for you.',actions:[pair]};
    }
    switch(route){
      case 'home':
        return{eyebrow:'Your climb',title:'Loading your profile',body:'Connecting to OP CLIMB to load your rank, Game DNA and missions.',busy:true};
      case 'dna':
        if(tftBusy(s))return{eyebrow:'Game DNA',title:'Game DNA tracks League games',body:'Your TFT session is running. Your League Game DNA will be here when you are back on the Rift.'};
        return{eyebrow:'Game DNA',title:'Loading your Game DNA',body:'Your six DNA strands and active missions appear here once your profile loads.',busy:!home};
      case 'draft':
        if(phase==='CHAMP_SELECT')return{eyebrow:'Live draft',title:'Reading champion select',body:'OP CLIMB is reading roles, picks and bans. Your draft board appears in a moment.',busy:true};
        return{eyebrow:'Champion select',title:'Your draft board appears in champion select',body:'When you enter champion select in League, this screen fills in on its own: both teams, picks, bans and your match plan. You don\'t need to do anything here yet.'};
      case 'prep':
        if(phase==='RECORDING'){
          if(s.teamPlan||s.matchup)return{eyebrow:'Match preparation',title:'Your locked plan is on Live Companion',body:'The plan you locked in champion select stays frozen for this game.',actions:[{label:'Open live companion',kind:'secondary',run:()=>go('live')}]};
          return{eyebrow:'Match preparation',title:'No plan was locked for this game',body:'OP CLIMB builds the match plan during champion select. This game is still being recorded for your review.'};
        }
        if(phase==='CHAMP_SELECT')return{eyebrow:'Match preparation',title:'Building your match plan',body:'Your plan appears once you hover or lock a champion. It freezes when you lock in.',busy:true};
        return{eyebrow:'Match preparation',title:'Your match plan is built in champion select',body:'When you enter champion select, OP CLIMB builds your plan here: both win conditions, your job in the match, three key actions and your development mission.'};
      case 'live':
        if(phase==='RECORDING')return{eyebrow:'Live companion',title:'Recording your game',body:'OP CLIMB is recording quietly. Your post-game review is built from this match.'};
        return{eyebrow:'Live companion',title:'Live Companion starts with your game',body:'In game, OP CLIMB shows the plan you locked in champion select. It never gives live shotcalling or scouting, and it never makes decisions for you.',
          list:[['Ctrl+Shift+M','Bookmark a moment for your review'],['Ctrl+Shift+O','Show or hide the in-game HUD'],['Ctrl+Shift+L','Change HUD layout'],['Alt+B','Move and resize the HUD']],
          actions:[{label:'HUD settings',kind:'secondary',run:()=>go('settings')}]};
      case 'review':
        if(phase==='UPLOADING')return{eyebrow:'Post-game',title:'Building your review',body:'Your game has finished. OP CLIMB is turning the recording into your review. It opens here automatically when it\'s ready.',busy:true};
        return{eyebrow:'Match review',title:'Your next review appears here',body:'After each tracked game, your review opens here automatically: what you did well, what to work on, and whether your mission was proven.',
          actions:[{label:'See your progress',kind:'secondary',external:true,run:()=>api?.openClimbPath?.('/progress')}]};
      case 'memory':{
        if(tier==='PRO'){
          const mastered=Number(home?.masteredCount);
          return{eyebrow:'Coach memory',title:'Your Coach Memory',body:Number.isFinite(mastered)
            ?`OP CLIMB has recorded ${mastered} mastered habit${mastered===1?'':'s'} for you. Your full Coach Memory, with recurring habits and long-term player identity, is on OP CLIMB.`
            :'Your full Coach Memory, with recurring habits and long-term player identity, is on OP CLIMB.',
            actions:[{label:'Open Coach Memory',kind:'primary',external:true,run:()=>api?.openClimbPath?.('/coach')}]};
        }
        return{eyebrow:'Coach memory',tone:'gold',tier:'PRO',title:'Coach Memory is part of PRO',
          body:tier?`You're on ${tier}. PRO adds a persistent Decision Twin and Coach Memory that learn your recurring habits and long-term player identity.`
            :'PRO adds a persistent Decision Twin and Coach Memory that learn your recurring habits and long-term player identity.',
          list:[['check','Remembers the habits that keep repeating'],['check','Keeps mastered habits in your long-term history'],['check','Persistent Decision Twin across every game']],
          price:'£19.99',
          actions:[{label:'See plans',kind:'tone',external:true,run:()=>api?.openClimbPath?.('/pricing')}]};
      }
      case 'settings':
        return{eyebrow:'Settings',title:'Settings are loading',body:'Companion settings appear once the Companion has started.',busy:true};
    }
    return{title:'Nothing here yet',body:''};
  }

  let lastRouteStateKey='';
  function renderRouteState(show){
    routeState.hidden=!show;
    if(!show){lastRouteStateKey='';return}
    const copy=routeCopy();
    const key=route+'|'+JSON.stringify(copy,(k,v)=>typeof v==='function'?undefined:v);
    if(key===lastRouteStateKey)return;
    lastRouteStateKey=key;

    const tone=copy.tone||ROUTE[route].tone;
    routeState.className=`oc-route-state oc-tone-${tone}`;
    routeState.innerHTML='';
    const mark=document.createElement('div');mark.className='oc-route-state__mark';mark.innerHTML=icon(route);
    routeState.appendChild(mark);

    const head=document.createElement('div');head.className='oc-cluster';
    const eyebrow=document.createElement('span');eyebrow.className='oc-eyebrow';eyebrow.textContent=copy.eyebrow||ROUTE[route].eyebrow;
    head.appendChild(eyebrow);
    if(copy.tier){const tierChip=document.createElement('span');tierChip.className=`oc-tier oc-tier--${copy.tier.toLowerCase()}`;tierChip.textContent=copy.tier;head.appendChild(tierChip)}
    if(copy.busy){const spin=document.createElement('span');spin.className='oc-spinner';spin.style.color='var(--oc-tone)';spin.setAttribute('aria-hidden','true');head.appendChild(spin)}
    routeState.appendChild(head);

    const title=document.createElement('h2');title.className='oc-h2';title.textContent=copy.title;
    routeState.appendChild(title);
    if(copy.body){const body=document.createElement('p');body.className='oc-lead';body.textContent=copy.body;routeState.appendChild(body)}

    if(copy.list?.length){
      const list=document.createElement('ul');list.className='oc-route-state__list';
      copy.list.forEach(([lead,line])=>{
        const li=document.createElement('li');
        if(lead==='check')li.innerHTML=icon('check');
        else{const kbd=document.createElement('kbd');kbd.textContent=lead;li.appendChild(kbd)}
        li.append(line);
        list.appendChild(li);
      });
      routeState.appendChild(list);
    }
    if(copy.price){
      const price=document.createElement('div');price.className='oc-route-state__price';
      price.innerHTML=`${copy.price} <small>/ month</small>`;
      routeState.appendChild(price);
    }
    const actions=document.createElement('div');actions.className='oc-route-state__actions';
    (copy.actions||[]).forEach(action=>{
      const button=document.createElement('button');
      button.type='button';
      button.className=`oc-btn oc-btn--${action.kind||'secondary'}`;
      button.append(action.label);
      if(action.external)button.insertAdjacentHTML('beforeend',icon('external'));
      button.addEventListener('click',action.run);
      actions.appendChild(button);
    });
    routeState.appendChild(actions);
  }

  /* -------------------------------------------------------------- routing -- */

  function go(next,{auto=false}={}){
    if(!ROUTE[next])return;
    const changed=next!==route;
    if(changed)try{VIEWS[route]?.leave?.(state||{},ctx)}catch(err){console.error('[ocShell] leave failed',err)}
    route=next;
    if(route==='review'&&phaseOf(state)==='REVIEW')reviewSeen=true;
    shell.dataset.route=route;
    if(changed){
      view.scrollTop=0;
      inner.classList.remove('is-entering');
      void inner.offsetWidth;
      inner.classList.add('is-entering');
      if(!auto)$('ocRouteTitle').focus({preventScroll:true});
    }
    renderAll();
  }

  function renderAll(){
    renderNav();
    renderIdentity();
    renderVersion();
    renderHeader();
    renderNative();
    renderStrip();
    applyGate();
  }

  function onState(next){
    state=next||{};
    for(const viewFor of Object.values(VIEWS)){try{viewFor.observe?.(state)}catch{}}
    const phase=phaseOf(state);
    if(phase!==lastPhase){
      if(phase==='REVIEW')reviewSeen=false;
      // The phase picks the screen; a manual choice holds until it changes.
      const target=!state.paired&&phase!=='STARTING'?'home':phaseRoute(phase);
      lastPhase=phase;
      go(target,{auto:true});
      return;
    }
    renderAll();
  }

  /* ---------------------------------------------------------------- boot -- */

  buildNav();

  // Sidebar collapse is a per-viewer convenience; narrow windows always use the rail.
  const railQuery=window.matchMedia('(max-width: 999px)');
  let railPreferred=false;
  try{railPreferred=localStorage.getItem('oc:sidebar')==='rail'}catch{}
  const syncRail=()=>shell.classList.toggle('is-rail',railPreferred||railQuery.matches);
  railQuery.addEventListener('change',syncRail);
  syncRail();
  $('ocCollapse').innerHTML=icon('collapse');
  $('ocCollapse').addEventListener('click',()=>{
    railPreferred=!shell.classList.contains('is-rail');
    try{localStorage.setItem('oc:sidebar',railPreferred?'rail':'full')}catch{}
    syncRail();
    $('ocCollapse').setAttribute('aria-label',railPreferred?'Expand sidebar':'Collapse sidebar');
  });

  $('ocUpdateChip').addEventListener('click',()=>go('settings'));

  document.addEventListener('keydown',event=>{
    if(!event.ctrlKey||event.shiftKey||event.altKey||event.metaKey)return;
    const index=Number(event.key)-1;
    if(Number.isInteger(index)&&ROUTES[index]){event.preventDefault();go(ROUTES[index].id)}
  });

  // Legacy screens toggle their own visibility on every render; re-check the gate after them.
  new MutationObserver(queueGate).observe(legacy,{childList:true,subtree:true,attributes:true,attributeFilter:['class','open']});

  window.ocShell={go,get route(){return route}};

  renderAll();
  if(api){
    api.getState?.().then(onState).catch(()=>{});
    api.onState?.(onState);
    api.getUpdateState?.().then(next=>{update=next;renderAll()}).catch(()=>{});
    api.onUpdateState?.(next=>{update=next;renderAll()});
  }
})();
