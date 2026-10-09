/* OP CLIMB Companion — Home and My Game DNA views.
 *
 * Home: who you are, your Game DNA dashboard, your two missions and one next
 * action. My Game DNA: the same strands in depth, role browsing, the
 * baseline tracker and the one-time reveal.
 *
 * Data comes only from /api/live/companion-home (state.playerHome). Before
 * the three-game baseline no strand shows progress; before the reveal no
 * level is shown. Nothing here estimates or fills in missing numbers.
 */
(()=>{
  'use strict';
  const ui=window.ocUI;
  if(!ui)return;
  const {esc,text,upper,num,clamp,titleCase,roleName,roleKey,ring,steps,icon,dnaStrands,dnaStage,dnaRadar,dnaColor}=ui;
  const views=window.ocViews=window.ocViews||{};
  const ROLES=['TOP','JUNGLE','MID','ADC','SUPPORT'];

  let justRevealed='';
  let roleRequest='';

  const homeOf=state=>state?.playerHome?.ok?state.playerHome:null;
  const phaseOf=state=>upper(state?.phase)||'STARTING';
  const tftBusy=state=>['INITIALIZING','RECORDING','PROCESSING','READY'].includes(upper(state?.tftRecorder?.state));
  const tierOf=state=>{const tier=upper(state?.teamPlan?.strategyAccess?.tier||state?.playerHome?.tier);return['FREE','PLUS','PRO'].includes(tier)?tier:null};
  const missionsOf=home=>(Array.isArray(home?.missions)?home.missions:[]).slice(0,2);

  /* ------------------------------------------------------------ pieces -- */

  /** The one next action for the player's real state. */
  function mainAction(state,stage){
    const phase=phaseOf(state);
    if(phase==='CHAMP_SELECT')return{label:'Open match plan',go:'prep',icon:'target'};
    if(phase==='RECORDING')return{label:'Back to live companion',go:'live',icon:'play'};
    if(phase==='UPLOADING')return{label:'Building your review',go:'review',icon:'review'};
    if(state.postGameReview&&(phase==='REVIEW'||!ui.reviewSeen(state.postGameReview)))return{label:'Review last game',go:'review',icon:'review'};
    if(stage.stage==='baseline')return{label:'Complete your baseline',go:'dna',icon:'target'};
    if(stage.stage==='reveal')return{label:'Reveal your Game DNA',go:'dna',icon:'dna'};
    return{label:'Prepare next match',go:'prep',icon:'play'};
  }

  function focusLine(home,stage){
    const role=roleName(stage.role)||'role';
    if(stage.stage==='baseline')return`Building your ${role} baseline · game ${Math.min(stage.games+1,stage.required)} of ${stage.required}`;
    if(stage.stage==='reveal')return`Your ${role} Game DNA is ready to reveal`;
    const mission=home.priorityMission||missionsOf(home)[0];
    return text(mission?.title)||'Queue up to start your next mission';
  }

  function hero(state,home,stage){
    const player=home.player||{};
    const gameName=text(player.gameName)||'Player';
    const tag=text(player.tagline);
    const rank=upper(player.rank);
    const ranked=rank&&rank!=='UNRANKED';
    const lp=num(player.leaguePoints,NaN);
    const primary=roleName(home.primaryRole||player.primaryRole||player.role);
    const tier=tierOf(state);
    const champ=ui.lastChampion();
    const art=champ?ui.splashUrl(champ.name):'';
    const action=mainAction(state,stage);
    const secondary=action.go!=='dna'?`<button class="oc-btn oc-btn--ghost" type="button" data-go="dna">${icon('dna')}Open Game DNA</button>`:'';
    return `
      <section class="oc-card oc-card--hero oc-home-hero${art?'':' is-plain'}" aria-label="Player">
        ${art?`<img class="oc-card__art" src="${esc(art)}" alt="" onerror="this.remove()">`:'<div class="oc-home-hero__pattern" aria-hidden="true"></div>'}
        <div class="oc-home-hero__body">
          <div class="oc-cluster">
            ${primary?`<span class="oc-chip oc-chip--neutral">${esc(primary)} main</span>`:''}
            ${tier?`<span class="oc-tier oc-tier--${tier.toLowerCase()}">${tier}</span>`:''}
          </div>
          <h2 class="oc-hero oc-home-hero__name">${esc(gameName)}${tag?`<span>#${esc(tag)}</span>`:''}</h2>
          <div class="oc-home-hero__rank">
            <b>${ranked?esc(titleCase(rank)):'Unranked'}</b>
            ${ranked&&Number.isFinite(lp)?`<span>${lp} LP</span>`:''}
          </div>
          <div class="oc-home-hero__focus">
            <span class="oc-eyebrow">Current focus</span>
            <strong>${esc(focusLine(home,stage))}</strong>
          </div>
          <div class="oc-cluster oc-home-hero__actions">
            <button class="oc-btn oc-btn--primary oc-btn--lg" type="button" data-go="${action.go}">${icon(action.icon)}${esc(action.label)}</button>
            ${secondary}
          </div>
        </div>
        ${champ?`<span class="oc-home-hero__credit">Last played · ${esc(champ.name)}</span>`:''}
      </section>`;
  }

  function strandTile(strand,stage,missionDomains,{why=false}={}){
    const active=stage.stage==='active';
    const mission=active&&missionDomains.includes(strand.domain);
    const center=active
      ?`<b class="oc-ring__value">${strand.level}</b><span class="oc-ring__label">LV</span>`
      :icon('lock');
    return `
      <article class="oc-strand${active?'':' is-locked'}${mission?' is-mission':''}" style="--oc-tone:${dnaColor(strand.domain)}">
        ${ring({value:active?strand.levelProgress:0,size:'sm',locked:!active,center,aria:active?`${strand.label} level ${strand.level}, ${strand.levelProgress}% to next level`:`${strand.label} locked`})}
        <div class="oc-strand__text">
          <b>${esc(strand.label)}</b>
          <span class="oc-strand__meta">${active?`<span>${strand.xpIntoLevel}/${strand.xpForNextLevel} XP</span>`:`<span>${stage.stage==='reveal'?'Ready':'Locked'}</span>`}
            ${mission?'<span class="oc-chip oc-chip--sm">Mission</span>':active&&strand.mastered?`<span class="oc-strand__mastered">${strand.mastered} mastered</span>`:''}</span>
          ${why?`<p class="oc-strand__why">${esc(strand.summary)}</p>`:''}
        </div>
      </article>`;
  }

  function radarCenter(stage){
    if(stage.stage==='baseline')return`<span class="oc-label">Baseline</span><b class="oc-radar__big">${stage.games}/${stage.required}</b>${steps(stage.games,stage.required,{current:true,tone:'violet',aria:`${stage.games} of ${stage.required} baseline games`})}`;
    if(stage.stage==='reveal')return`<span class="oc-chip oc-chip--dna">Ready</span><b class="oc-radar__big">${icon('dna')}</b>`;
    return'';
  }

  function dnaSection(state,home,stage,{expanded=false}={}){
    const strands=dnaStrands(home);
    const role=roleName(stage.role)||'this role';
    const missionDomains=missionsOf(home).map(m=>upper(m.domain));
    const title=stage.stage==='baseline'?'Unlocks after 3 games':stage.stage==='reveal'?'Ready to reveal':'Your player shape';
    const radar=dnaRadar(strands,{size:expanded?340:300,revealed:stage.stage==='active',center:radarCenter(stage)});
    const tiles=strands.map(s=>strandTile(s,stage,missionDomains,{why:expanded})).join('');
    return `
      <section class="oc-home-section oc-tone-violet" aria-label="Game DNA">
        <header class="oc-section-head">
          <div class="oc-section-head__text">
            <span class="oc-eyebrow">${esc(roleName(stage.role)||'Your')} Game DNA</span>
            <h2 class="oc-h2">${title}</h2>
            <p class="oc-small">Only ${esc(role)} games progress these six strands. Other roles keep separate DNA profiles.</p>
          </div>
          ${expanded?'':'<button class="oc-btn oc-btn--ghost oc-btn--sm" type="button" data-go="dna">Open My Game DNA'+icon('arrow')+'</button>'}
        </header>
        <div class="oc-dna${expanded?' oc-dna--expanded':''}${stage.stage==='active'&&justRevealed===stage.role?' is-revealing':''}">
          <div class="oc-card oc-dna__shape">${radar}</div>
          <div class="oc-dna__strands">${tiles}</div>
        </div>
      </section>`;
  }

  function missionCard(mission,index,home){
    const domain=upper(mission.domain);
    const strand=dnaStrands(home).find(s=>s.domain===domain);
    const confirmed=Math.max(0,num(mission.confirmed));
    const required=Math.max(1,num(mission.required,3));
    const mastered=upper(mission.status)==='MASTERED';
    const rows=[
      ['Why it matters',text(mission.meaning)],
      ['Next game',text(mission.nextGame||mission.gameRule)],
      ['How it\'s verified',text(mission.success||mission.target)],
    ].filter(([,value])=>value);
    return `
      <article class="oc-card oc-card--accent oc-mission" style="--oc-tone:${dnaColor(domain)}">
        <header class="oc-card__header">
          <div class="oc-card__heading">
            <span class="oc-eyebrow">Unlocked tree ${num(mission.focusOrder,index+1)} of 2 · ${esc(strand?.label||titleCase(domain.replace('_',' '))||'DNA')}</span>
            <h3 class="oc-title">${esc(text(mission.title)||'Current DNA mission')}</h3>
          </div>
          ${mastered?'<span class="oc-chip oc-chip--positive">Mastered</span>':''}
        </header>
        <dl class="oc-mission__rows">
          ${rows.map(([label,value])=>`<div class="${label==='Next game'?'is-next':''}"><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}
        </dl>
        <footer class="oc-mission__proof">
          <div class="oc-spread"><span class="oc-label">Verified progress</span><span class="oc-mono oc-small">${Math.min(confirmed,required)} of ${required} proven games</span></div>
          ${steps(Math.min(confirmed,required),required,{aria:`${Math.min(confirmed,required)} of ${required} proven games`})}
        </footer>
      </article>`;
  }

  function missionsSection(home,stage){
    const role=roleName(stage.role)||'this role';
    let body;
    if(stage.stage==='baseline'){
      body=`
        <article class="oc-card oc-mission-note">
          <span class="oc-eyebrow oc-tone-neutral">Provisional coaching</span>
          <h3 class="oc-title">No permanent DNA missions until baseline 3/3.</h3>
          <p class="oc-body">Play normally. OP CLIMB is learning your starting point as ${esc(role)} before it chooses your missions.</p>
          ${steps(stage.games,stage.required,{current:true,tone:'violet',aria:`${stage.games} of ${stage.required} baseline games`})}
        </article>`;
    }else if(stage.stage==='reveal'){
      body=`
        <article class="oc-card oc-mission-note oc-tone-violet">
          <span class="oc-eyebrow">Behind the reveal</span>
          <h3 class="oc-title">Your two missions are ready.</h3>
          <p class="oc-body">Reveal your Game DNA to see your six strands and the two missions chosen for your next game.</p>
          <button class="oc-btn oc-btn--tone oc-btn--sm" type="button" data-go="dna">${icon('dna')}Reveal Game DNA</button>
        </article>`;
    }else{
      const missions=missionsOf(home);
      body=missions.length
        ?missions.map((m,i)=>missionCard(m,i,home)).join('')
        :`<article class="oc-card oc-mission-note"><h3 class="oc-title">Waiting for evidence</h3><p class="oc-body">Your missions appear once a tracked ${esc(role)} game gives OP CLIMB enough evidence.</p></article>`;
    }
    return `
      <section class="oc-home-section" aria-label="Development missions">
        <header class="oc-section-head">
          <div class="oc-section-head__text">
            <span class="oc-eyebrow">Development missions</span>
            <h2 class="oc-h2">${stage.stage==='active'?'Your two unlocked trees':'Your missions'}</h2>
            <p class="oc-small">Only the two DNA trees you unlocked can bank a proven rep.</p>
          </div>
        </header>
        <div class="oc-missions">${body}</div>
      </section>`;
  }

  function planSection(state,home){
    const tier=tierOf(state);
    if(!tier)return'';
    const view=home.tierView||{};
    const upgrade=home.upgrade;
    const mastered=num(home.masteredCount,NaN);
    return `
      <section class="oc-card oc-card--compact oc-home-plan" aria-label="Your plan">
        <div class="oc-row">
          <span class="oc-tier oc-tier--${tier.toLowerCase()}">${tier}</span>
          <div class="oc-home-plan__text"><b>${esc(titleCase(text(view.label)||'Your plan'))}</b><span>${esc(text(view.detail))}</span></div>
        </div>
        ${tier==='PRO'&&Number.isFinite(mastered)?`<span class="oc-chip oc-chip--dna">${mastered} mastered habit${mastered===1?'':'s'} in Coach Memory</span>`:''}
        ${upgrade?`<div class="oc-row oc-home-plan__upgrade"><span>${esc(text(upgrade.copy))}</span><button class="oc-btn oc-btn--tone oc-btn--sm oc-tone-gold" type="button" data-open="/pricing">Unlock ${esc(upper(upgrade.tier))}${icon('external')}</button></div>`:''}
      </section>`;
  }

  /* -------------------------------------------------- My Game DNA only -- */

  function roleSwitcher(state,home){
    const profiles=Array.isArray(home.roleProfiles)?home.roleProfiles:[];
    const selected=roleKey(home.selectedRole||home.player?.role);
    const primary=roleKey(home.primaryRole||home.player?.primaryRole);
    const idle=phaseOf(state)==='WAITING';
    const buttons=ROLES.map(role=>{
      const profile=profiles.find(p=>roleKey(p?.role)===role)||{};
      const games=Math.max(0,num(profile.games));
      const required=Math.max(1,num(profile.required,3));
      const meta=profile.ready?`${games} game${games===1?'':'s'}`:`${Math.min(games,required)}/${required} baseline`;
      const busy=roleRequest===role;
      return `<button class="oc-role${role===selected?' is-active':''}" type="button" data-role="${role}" aria-pressed="${role===selected}" ${!idle||busy?'disabled':''}>
        <b>${roleName(role)}${role===primary?' <small>Main</small>':''}</b><span>${busy?'Loading…':meta}</span></button>`;
    }).join('');
    return `
      <section class="oc-card oc-card--compact oc-roles" aria-label="DNA role">
        <div class="oc-roles__text"><span class="oc-eyebrow oc-tone-violet">Role profile</span><p class="oc-small">${idle?'Viewing only. Switching here never changes your main role or merges progress.':'Role browsing is available between games.'}</p></div>
        <div class="oc-roles__list" role="group" aria-label="Choose a role to view">${buttons}</div>
      </section>`;
  }

  function stagePanel(stage){
    const role=roleName(stage.role)||'this role';
    if(stage.stage==='baseline'){
      const games=Array.from({length:stage.required},(_,i)=>{
        const done=i<stage.games,current=i===stage.games;
        return `<li class="${done?'is-done':current?'is-current':''}"><span>${done?icon('check'):i+1}</span><b>Game ${i+1}</b><small>${done?'Recorded':current?'Up next':'Waiting'}</small></li>`;
      }).join('');
      return `
        <section class="oc-card oc-card--roomy oc-baseline oc-tone-violet" aria-label="Baseline">
          <span class="oc-eyebrow">${esc(role)} baseline</span>
          <h2 class="oc-h1">Complete your baseline</h2>
          <p class="oc-lead">Play ${stage.required} ${esc(role)} games normally. The Companion records each one automatically. Your six strands and two missions unlock after game ${stage.required}.</p>
          <ol class="oc-baseline__games">${games}</ol>
        </section>`;
    }
    if(stage.stage==='reveal'){
      return `
        <section class="oc-card oc-card--roomy oc-reveal oc-tone-violet" aria-label="Reveal">
          <span class="oc-eyebrow">Baseline ${stage.required}/${stage.required} complete</span>
          <h2 class="oc-h1">Your ${esc(role)} Game DNA is ready</h2>
          <p class="oc-lead">See your six strands and the two missions chosen for your next game.</p>
          <button class="oc-btn oc-btn--primary oc-btn--lg" type="button" data-reveal="${esc(stage.role)}">${icon('dna')}Reveal my Game DNA</button>
        </section>`;
    }
    return'';
  }

  /* -------------------------------------------------------------- views -- */

  function bind(root,ctx){
    root.querySelectorAll('[data-go]').forEach(node=>node.addEventListener('click',()=>ctx.go(node.dataset.go)));
    root.querySelectorAll('[data-open]').forEach(node=>node.addEventListener('click',()=>ctx.api?.openClimbPath?.(node.dataset.open)));
    root.querySelectorAll('[data-reveal]').forEach(node=>node.addEventListener('click',()=>{
      ui.markRevealed(node.dataset.reveal);
      justRevealed=roleKey(node.dataset.reveal);
      root.dataset.key='';
      ctx.go(ctx.route);
    }));
    root.querySelectorAll('[data-role]').forEach(node=>node.addEventListener('click',async()=>{
      const role=node.dataset.role;
      if(node.getAttribute('aria-pressed')==='true')return;
      roleRequest=role;root.dataset.key='';ctx.go(ctx.route);
      await ctx.api?.setDnaRole?.(role).catch(()=>null);
      roleRequest='';root.dataset.key='';ctx.go(ctx.route);
    }));
  }

  function paint(root,key,html,ctx){
    if(root.dataset.key===key)return;
    root.dataset.key=key;
    root.innerHTML=html;
    bind(root,ctx);
  }

  function keyFor(route,state,home,stage){
    return JSON.stringify([route,phaseOf(state),tierOf(state),stage,home,ui.lastChampion()?.name||'',Boolean(state.postGameReview),roleRequest]);
  }

  views.home={
    ownsNextAction:true,
    observe:state=>ui.rememberChampion(state),
    render(root,state,ctx){
      const home=homeOf(state);
      if(!state.paired||!home||tftBusy(state))return false;
      const stage=dnaStage(home);
      paint(root,keyFor('home',state,home,stage),`
        <div class="oc-home">
          ${hero(state,home,stage)}
          ${dnaSection(state,home,stage)}
          ${missionsSection(home,stage)}
          ${planSection(state,home)}
        </div>`,ctx);
      return true;
    },
  };

  views.dna={
    render(root,state,ctx){
      const home=homeOf(state);
      if(!state.paired||!home||tftBusy(state))return false;
      const stage=dnaStage(home);
      const links=`
        <div class="oc-cluster oc-dna-links">
          ${stage.stage==='active'?`<button class="oc-btn oc-btn--secondary oc-btn--sm" type="button" data-open="/missions">Change your two trees${icon('external')}</button>`:''}
          <button class="oc-btn oc-btn--ghost oc-btn--sm" type="button" data-open="/ilp">Full DNA history on OP CLIMB${icon('external')}</button>
        </div>`;
      paint(root,keyFor('dna',state,home,stage),`
        <div class="oc-home">
          ${roleSwitcher(state,home)}
          ${stagePanel(stage)}
          ${dnaSection(state,home,stage,{expanded:true})}
          ${stage.stage==='active'?missionsSection(home,stage):''}
          ${links}
        </div>`,ctx);
      if(justRevealed===stage.role&&stage.stage==='active')setTimeout(()=>{justRevealed=''},1600);
      return true;
    },
    // Home always shows the main role; role browsing belongs to My Game DNA.
    leave(state,ctx){
      const home=homeOf(state);
      const primary=roleKey(home?.primaryRole||home?.player?.primaryRole);
      const selected=roleKey(home?.selectedRole);
      if(primary&&selected&&primary!==selected&&phaseOf(state)==='WAITING')ctx.api?.setDnaRole?.(primary).catch(()=>null);
    },
  };
})();
