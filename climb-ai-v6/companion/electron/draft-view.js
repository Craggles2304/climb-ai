/* OP CLIMB Companion — Champion Select and Match Preparation views.
 *
 * Champion Select: the live 5v5 draft from the League client (allies, the
 * enemy picks the client has revealed, bans, lock state) and the match plan.
 * Match Preparation: the same plan on its own while a game is on, and a
 * pre-queue briefing between games.
 *
 * Everything shown comes from state.draft, state.matchup and state.teamPlan.
 * Unknown picks stay unknown. Plan fields the server withholds for a plan
 * tier are explained as locked, never filled with generic text.
 */
(()=>{
  'use strict';
  const ui=window.ocUI;
  if(!ui)return;
  const {esc,text,upper,num,roleName,roleKey,portrait,steps,icon,dnaColor}=ui;
  const views=window.ocViews=window.ocViews||{};

  const phaseOf=state=>upper(state?.phase)||'STARTING';
  const tierOf=state=>{const tier=upper(state?.teamPlan?.strategyAccess?.tier||state?.playerHome?.tier);return['FREE','PLUS','PRO'].includes(tier)?tier:null};
  const list=value=>Array.isArray(value)?value.filter(Boolean):[];
  const pad5=value=>Array.from({length:5},(_,i)=>list(value)[i]||null);

  /* ----------------------------------------------------------- draft -- */

  const PHASES={PLANNING:'Planning · declare your pick',BAN_PICK:'Bans and picks',FINALIZATION:'Finalising · runes and trades',GAME_STARTING:'Game starting'};

  function pickState(pick){
    const state=upper(pick?.selectionState);
    if(pick?.lockedIn||state==='LOCKED')return'LOCKED';
    if(text(pick?.championName))return state==='HOVER'||!state?'HOVER':state;
    return'WAITING';
  }

  function slot(pick,{ours,you,index}){
    const name=text(pick?.championName);
    const state=pickState(pick);
    const role=roleName(pick?.role);
    // Empty slots say what is happening once; enemy roles are only shown if the client reveals them.
    const chip=state==='LOCKED'?'<span class="oc-chip oc-chip--sm oc-chip--positive">Locked</span>'
      :state==='HOVER'&&ours?'<span class="oc-chip oc-chip--sm oc-chip--info">Hovering</span>':'';
    const label=name||(ours?(you?'You · choosing':'Picking…'):'Not revealed');
    const roleLine=[role,you?'<b>You</b>':''].filter(Boolean).join(' · ');
    return `
      <li class="oc-slot ${ours?'is-ally':'is-enemy'}${you?' is-you':''}${state==='LOCKED'?' is-locked':''}${name?'':' is-empty'}" style="--oc-i:${index}"
        aria-label="${esc(`${ours?'Ally':'Enemy'} ${index+1}${role?`, ${role}`:''}: ${name||'not revealed'}, ${state.toLowerCase()}`)}">
        ${portrait(name,{size:'',side:ours?'ally':'enemy',you,hovering:state==='HOVER'})}
        <div class="oc-slot__text">${roleLine?`<span class="oc-slot__role">${role?esc(role):''}${role&&you?' · ':''}${you?'<b>You</b>':''}</span>`:''}<strong>${esc(label)}</strong></div>
        ${chip}
      </li>`;
  }

  function bans(title,values,tone){
    const named=list(values).filter(b=>text(b?.championName)).slice(0,5);
    return `
      <div class="oc-bans oc-tone-${tone}">
        <span class="oc-label">${title}</span>
        <div class="oc-bans__list">${named.length?named.map(b=>`<span class="oc-ban" title="${esc(b.championName)}">${portrait(b.championName,{size:'sm',label:`Banned: ${b.championName}`})}</span>`).join(''):'<span class="oc-small">None yet</span>'}</div>
      </div>`;
  }

  function laneContext(state){
    const draft=state.draft||{};
    const matchup=state.matchup||{};
    const you=text(draft.localChampionName||matchup.champion);
    const opponentKnown=Boolean(text(matchup.opponent)&&['CHAMP_SELECT','IN_GAME'].includes(upper(matchup.source)));
    const them=opponentKnown?text(matchup.plan?.them?.name||matchup.opponent):'';
    return `
      <div class="oc-vs">
        <span class="oc-label">${esc(roleName(draft.localRole)||'Your')} lane</span>
        <div class="oc-vs__pair">
          ${portrait(you,{size:'lg',you:true,hovering:!draft.localLockedIn&&Boolean(you),label:you||'Your champion'})}
          <b class="oc-vs__mark">VS</b>
          ${portrait(them,{size:'lg',side:'enemy',label:them||'Lane opponent not revealed'})}
        </div>
        <span class="oc-small">${opponentKnown?`${esc(you)} vs ${esc(them)}`:'Lane opponent not revealed yet'}</span>
      </div>`;
  }

  function draftBoard(state){
    const draft=state.draft||{};
    const allies=pad5(draft.allies);
    const enemies=pad5(draft.enemies);
    const localCell=num(draft.localPlayerCellId,-1);
    const champion=text(draft.localChampionName);
    const locked=Boolean(draft.localLockedIn);
    const role=roleName(draft.localRole);
    const title=locked&&champion?`${champion} · Locked in`:champion?`Hovering ${champion}`:role?`Choose your ${role} champion`:'Draft in progress';
    const hint=locked
      ?'Your pick is locked. The match plan finalises as the rest of the draft appears.'
      :champion?'Preview is live. Change your hover freely; locking in freezes the plan.'
      :'Reading roles, picks and bans. Hover a champion and your preview appears.';
    const lockedCount=[...allies,...enemies].filter(p=>p&&pickState(p)==='LOCKED').length;
    const enemySeen=enemies.filter(p=>text(p?.championName)).length;
    const final=phaseOf(state)!=='CHAMP_SELECT';
    return `
      <section class="oc-card oc-draft" aria-label="Draft">
        <header class="oc-draft__head">
          <div class="oc-stack" style="--oc-gap:6px">
            <span class="oc-eyebrow oc-tone-cyan">${final?'Final draft · this game':`<span class="oc-dot oc-dot--live oc-tone-cyan"></span>Champion select · ${esc(PHASES[upper(draft.phase)]||'Live draft')}`}</span>
            <h2 class="oc-h1">${esc(title)}</h2>
            ${final?'':`<p class="oc-body">${hint}</p>`}
          </div>
          <div class="oc-draft__progress">
            <div class="oc-spread"><span class="oc-label">Picks locked</span><b class="oc-num">${lockedCount}<small>/10</small></b></div>
            ${steps(lockedCount,10,{tone:'cyan',aria:`${lockedCount} of 10 picks locked`})}
            <span class="oc-small">${enemySeen}/5 enemy picks revealed</span>
          </div>
        </header>
        <div class="oc-board">
          <div class="oc-team oc-team--ally">
            <div class="oc-team__head"><span class="oc-eyebrow oc-tone-cyan">Your team</span><span class="oc-mono oc-small">${allies.filter(p=>text(p?.championName)).length}/5 picked</span></div>
            <ol class="oc-slots">${allies.map((p,i)=>slot(p,{ours:true,you:p!=null&&num(p.cellId,-2)===localCell,index:i})).join('')}</ol>
          </div>
          ${laneContext(state)}
          <div class="oc-team oc-team--enemy">
            <div class="oc-team__head"><span class="oc-eyebrow oc-tone-red">Their team</span><span class="oc-mono oc-small">${enemySeen}/5 revealed</span></div>
            <ol class="oc-slots">${enemies.map((p,i)=>slot(p,{ours:false,you:false,index:i})).join('')}</ol>
          </div>
        </div>
        <footer class="oc-draft__bans">
          ${bans('Our bans',draft.bans?.allies,'cyan')}
          ${bans('Their bans',draft.bans?.enemies,'red')}
        </footer>
      </section>`;
  }

  /* ------------------------------------------------------- match plan -- */

  // Generic role guidance, only used and labelled as such when the server sends no job.
  const ROLE_BASICS={
    ADC:'Stay safe, keep your range and hit the nearest safe target.',
    SUPPORT:'Create space for your carries. Engage or peel, not both at once.',
    JUNGLE:'Be there before the important fight starts. Connect your team around objectives.',
    TOP:'Use side-lane pressure, then reconnect before the important fight.',
    MID:'Catch your wave, then move first and stay connected to your team.',
  };

  function more(summary,rows){
    const items=rows.filter(([,value])=>text(value));
    if(!items.length)return'';
    return `<details class="oc-more"><summary>${esc(summary)}</summary><dl>${items.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></details>`;
  }

  function planCard({tone,eyebrow,title,body='',extra='',cls=''}){
    return `
      <article class="oc-card oc-card--accent oc-plan-card ${cls}" style="--oc-tone:${tone}">
        <span class="oc-eyebrow">${esc(eyebrow)}</span>
        ${title?`<p class="oc-plan-card__lead">${esc(title)}</p>`:''}
        ${body}
        ${extra}
      </article>`;
  }

  function lockedCard(tier,title,body,ctxTier){
    return `
      <article class="oc-card oc-plan-card oc-plan-card--locked oc-tone-gold">
        <div class="oc-cluster"><span class="oc-eyebrow">${esc(title)}</span><span class="oc-tier oc-tier--${tier.toLowerCase()}">${tier}</span></div>
        <p class="oc-body">${esc(body)}</p>
        <button class="oc-btn oc-btn--tone oc-btn--sm" type="button" data-open="/pricing">${ctxTier?`You're on ${ctxTier} · `:''}See plans${icon('external')}</button>
      </article>`;
  }

  function threeActions(team,plan,role){
    const roleSteps=list(team?.roleWinCondition?.steps);
    if(roleSteps.length===5){
      const first=role==='JUNGLE'?'Early path':role==='SUPPORT'?'Lane':'Early game';
      return[
        {label:first,value:text(roleSteps[0]?.value)},
        {label:'Set up',value:[roleSteps[1]?.value,roleSteps[2]?.value].map(text).filter(Boolean).join(' → ')},
        {label:'Fight → convert',value:[roleSteps[3]?.value,roleSteps[4]?.value].map(text).filter(Boolean).join(' → ')},
      ].filter(a=>a.value);
    }
    const rules=list(plan?.rules).length?list(plan.rules):list(plan?.winCondition);
    return rules.slice(0,3).map((value,i)=>({label:['First','Then','Remember'][i],value:text(value)})).filter(a=>a.value);
  }

  function missionLine(state){
    const team=state.teamPlan||{};
    const baseline=team.dnaBaseline||state.playerHome?.baseline||null;
    if(baseline&&baseline.ready===false){
      const required=Math.max(1,num(baseline.required,3));
      const game=Math.min(num(baseline.games)+1,required);
      return{title:`Baseline game ${game} of ${required}`,body:'Play normally. OP CLIMB is learning your starting point; no mission is scored this game.',baseline:true};
    }
    const tip=list(team.missionTips)[0];
    if(tip)return{title:text(tip.cue||tip.title),body:tip.cue&&tip.title&&text(tip.title)!==text(tip.cue)?text(tip.title):''};
    const mission=state.playerHome?.priorityMission||list(state.playerHome?.missions)[0];
    if(mission)return{title:text(mission.nextGame||mission.title),body:text(mission.title)};
    return null;
  }

  function buildRow(team,provisional){
    const build=team?.adaptiveBuild||team?.rememberPlan?.adaptiveBuild||null;
    const items=[];
    const seen=new Set();
    const add=item=>{if(item&&item.id!=null&&!seen.has(item.id)){seen.add(item.id);items.push(item)}};
    list(build?.core).slice(0,2).forEach(add);add(build?.boots);add(build?.finish);
    if(items.length<2)return provisional?planCard({tone:'var(--oc-text-3)',eyebrow:'Build',title:'',body:'<p class="oc-body">Your build finalises when you lock in.</p>'}):'';
    const patch=text(build.patch);
    const icons=items.slice(0,4).map((item,i)=>`
      <li class="oc-item" title="${esc(text(item.why))}">
        ${patch?`<img src="https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(patch)}/img/item/${encodeURIComponent(String(item.id))}.png" alt="" onerror="this.remove()">`:''}
        <span class="oc-label">${esc(item.slot==='BOOTS'?'Boots':item.slot==='FINISH'?'Next':`Core ${i+1}`)}</span>
        <b>${esc(text(item.name)||'Item')}</b>
      </li>`).join('');
    const flex=build.draftItem?`If needed: ${text(build.draftItem.name)}${text(build.draftItem.why)?` · ${text(build.draftItem.why)}`:''}`:'';
    return planCard({tone:'var(--oc-amber)',eyebrow:'Build for this draft',title:'',body:`<ol class="oc-items">${icons}</ol>${flex?`<p class="oc-small">${esc(flex)}</p>`:''}`});
  }

  function matchPlan(state,{standalone=false}={}){
    const matchup=state.matchup||null;
    const team=state.teamPlan||null;
    const phase=phaseOf(state);
    if(!matchup&&!team)return'';
    const status=upper(matchup?.status);
    if(status==='LOADING'&&!team){
      return `<section class="oc-plan" aria-label="Match plan"><article class="oc-card oc-plan-card" aria-busy="true"><span class="oc-eyebrow oc-tone-cyan">Match plan</span><p class="oc-plan-card__lead">Building your match plan…</p><div class="oc-skeleton" style="height:14px"></div><div class="oc-skeleton" style="height:14px;width:70%"></div></article></section>`;
    }
    if(status==='ERROR'&&!team){
      return `<section class="oc-plan" aria-label="Match plan"><article class="oc-card oc-plan-card oc-tone-red"><span class="oc-eyebrow">Match plan unavailable</span><p class="oc-body">${esc(text(matchup?.error)||'OP CLIMB could not build this plan.')}</p></article></section>`;
    }
    const plan=matchup?.plan||{};
    const access=team?.strategyAccess||{};
    const paid=Boolean(access.paidStrategy);
    const deep=Boolean(access.deepStrategy);
    const tier=tierOf(state);
    const role=roleKey(plan.role||matchup?.role||team?.roleWinCondition?.role||state.draft?.localRole);
    const provisional=Boolean(matchup?.provisional||upper(matchup?.source)==='CHAMPION_HOVER');
    const frozen=phase==='RECORDING';
    const you=text(plan.you?.name||matchup?.champion||state.draft?.localChampionName);
    const opponentKnown=Boolean(text(matchup?.opponent)&&['CHAMP_SELECT','IN_GAME'].includes(upper(matchup?.source)));
    const them=opponentKnown?text(plan.them?.name||matchup.opponent):'';
    const title=them?`${you} vs ${them}`:you?`${you} game plan`:'Your game plan';
    const chip=frozen?'<span class="oc-chip oc-chip--solid oc-tone-cyan">Frozen for this game</span>'
      :provisional?'<span class="oc-chip oc-chip--warning">Preview</span>'
      :'<span class="oc-chip oc-chip--positive">Plan locked</span>';

    // Our and their win conditions are part of the paid match read.
    const roleSteps=list(team?.roleWinCondition?.steps);
    const ourWin=text(team?.ourWinCondition);
    const theirWin=text(team?.theirWinCondition||team?.roleWinCondition?.lossCondition);
    const threats=list(team?.compositionRead?.enemyThreats).map(text).filter(Boolean);
    const winCards=paid
      ?planCard({tone:'var(--oc-lime)',eyebrow:'Our win condition',title:ourWin||'Forming as the draft fills in',
          extra:more('How it plays out',roleSteps.map(s=>[text(s?.label)||'Step',text(s?.value)]).concat([['Team shape',text(team?.roleWinCondition?.compPlan||team?.teamfight?.label)]]))})
        +planCard({tone:'var(--oc-red)',eyebrow:'Their win condition',title:theirWin||'Forming as their picks appear',
          extra:more('What to watch',[['Their style',text(team?.theirIdentity)],['Main threats',threats.slice(0,3).join(' · ')]])})
      :lockedCard('PLUS','Win conditions','Our win condition, their win condition and the biggest throw for this draft are part of the PLUS match read.',tier);

    const job=text(team?.yourJob);
    const roleCard=planCard({tone:'var(--oc-cyan)',eyebrow:`Your role in the match${roleName(role)?` · ${roleName(role)}`:''}`,
      title:job||ROLE_BASICS[role]||'',
      body:job?'':(ROLE_BASICS[role]?'<p class="oc-small">Role basics. A draft-specific job appears when the plan has one.</p>':''),
      extra:more('More on your role',[['Side lanes',text(team?.sidelane?.summary)],['Teamfights',text(team?.teamfight?.summary)],['Your style',text(team?.ourIdentity)]])});

    const mission=missionLine(state);
    const missionCard=mission?planCard({tone:mission.baseline?'var(--oc-text-3)':'var(--oc-violet)',eyebrow:'Your development mission',title:mission.title,
      body:`${mission.body?`<p class="oc-body">${esc(mission.body)}</p>`:''}<p class="oc-small">Kept separate from the team plan.</p>`}):'';

    const actions=threeActions(team,plan,role);
    const actionsCard=actions.length?`
      <article class="oc-card oc-plan-actions">
        <span class="oc-eyebrow oc-tone-lime">${actions.length===3?'Three important actions':'Important actions'}</span>
        <ol>${actions.map((a,i)=>`<li><b class="oc-plan-actions__n">${String(i+1).padStart(2,'0')}</b><div><span class="oc-label">${esc(a.label)}</span><strong>${esc(a.value)}</strong></div></li>`).join('')}</ol>
      </article>`:'';

    const avoid=paid&&text(team?.biggestThrow)?planCard({tone:'var(--oc-amber)',eyebrow:'Avoid · biggest throw',title:text(team.biggestThrow)}):'';
    const read=team?.compositionRead;
    const deepCard=deep&&read
      ?`<article class="oc-card oc-plan-deep">${more('Why this plan works',[['First contact',list(read.firstContact).join(' · ')],['Your protection',list(read.protectors).join(' · ')],['Main threats',list(read.enemyThreats).join(' · ')],['Fight shape',text(read.fightGeometry)],['Deny their plan',text(read.matchupRule)]])}</article>`
      :paid&&!deep?`<p class="oc-small oc-plan-note">${icon('lock')}Why this plan works, the full composition read, is part of PRO.</p>`:'';

    return `
      <section class="oc-plan" aria-label="Match plan">
        <header class="oc-section-head">
          <div class="oc-section-head__text">
            <span class="oc-eyebrow oc-tone-cyan">${standalone?'Your match blueprint':'Match preparation'}</span>
            <h2 class="oc-h2">${esc(title)}</h2>
            <p class="oc-small">${frozen?'Locked in champion select. It stays the same for the whole game.':provisional?'Preview. The plan freezes when you lock in and sharpens as the draft appears.':'Read it once before the game loads.'}</p>
          </div>
          <div class="oc-cluster">${tier?`<span class="oc-tier oc-tier--${tier.toLowerCase()}">${tier}</span>`:''}${chip}</div>
        </header>
        <div class="oc-plan__grid">
          <div class="oc-plan__duel">${winCards}</div>
          ${roleCard}
          ${missionCard}
          ${actionsCard}
          ${avoid}
          ${buildRow(team,provisional)}
        </div>
        ${deepCard}
        <p class="oc-plan__boundary">${icon('shield')}Pre-game plan only. No live shotcalling, scouting or decisions during the match.</p>
      </section>`;
  }

  /* --------------------------------------------- between-games briefing -- */

  function briefing(state){
    const home=state.playerHome?.ok?state.playerHome:null;
    const overlay=state.overlay||{};
    const mode=upper(overlay.layout?.mode)||'FOCUS';
    const MODES={MINIMAL:'Minimal · compact mission',FOCUS:'Focus · mission and win condition',EXPANDED:'Expanded · full pre-game plan'};
    const baseline=home?.baseline;
    const missions=list(home?.missions).slice(0,2);
    let missionBody;
    if(!home)missionBody='<p class="oc-body">Your missions load with your profile.</p>';
    else if(baseline&&!baseline.ready){
      const required=Math.max(1,num(baseline.required,3));
      missionBody=`<p class="oc-plan-card__lead">Baseline game ${Math.min(num(baseline.games)+1,required)} of ${required}</p><p class="oc-body">Play normally. Missions unlock after your baseline.</p>`;
    }else if(missions.length){
      missionBody=`<ul class="oc-brief-missions">${missions.map(m=>`<li style="--oc-tone:${dnaColor(m.domain)}"><span class="oc-label">${esc(text(m.title))}</span><strong>${esc(text(m.nextGame||m.gameRule||m.title))}</strong></li>`).join('')}</ul>`;
    }else missionBody='<p class="oc-body">No mission is scored yet. Play a tracked game to build evidence.</p>';
    return `
      <section class="oc-plan" aria-label="Before you queue">
        <header class="oc-section-head">
          <div class="oc-section-head__text">
            <span class="oc-eyebrow oc-tone-cyan">Before you queue</span>
            <h2 class="oc-h2">Prepare your next match</h2>
            <p class="oc-small">Your match plan is built in champion select. Here is what to take into the game.</p>
          </div>
        </header>
        <div class="oc-brief">
          <article class="oc-card oc-card--accent oc-plan-card oc-tone-violet">
            <span class="oc-eyebrow">Your job next game</span>
            ${missionBody}
          </article>
          <article class="oc-card oc-plan-card">
            <span class="oc-eyebrow oc-tone-cyan">In-game HUD</span>
            <p class="oc-plan-card__lead">${overlay.enabled?esc(MODES[mode]||MODES.FOCUS):'Off'}</p>
            <p class="oc-body">${overlay.enabled?'Shows your frozen pre-game plan in game. Ctrl+Shift+O hides it; Ctrl+Shift+L changes layout.':'Turn it on to keep your mission and win condition on screen in borderless or windowed mode.'}</p>
            <button class="oc-btn oc-btn--secondary oc-btn--sm" type="button" data-go="settings">HUD settings</button>
          </article>
          <article class="oc-card oc-plan-card">
            <span class="oc-eyebrow oc-tone-lime">What happens next</span>
            <ol class="oc-brief-steps">
              <li><b>Champion select</b><span>The draft board fills in on its own.</span></li>
              <li><b>Hover</b><span>A preview plan appears for your champion.</span></li>
              <li><b>Lock in</b><span>The plan freezes and the HUD carries it into the game.</span></li>
            </ol>
          </article>
        </div>
      </section>`;
  }

  /* ----------------------------------------------------------- views -- */

  function bind(root,ctx){
    root.querySelectorAll('[data-go]').forEach(node=>node.addEventListener('click',()=>ctx.go(node.dataset.go)));
    root.querySelectorAll('[data-open]').forEach(node=>node.addEventListener('click',()=>ctx.api?.openClimbPath?.(node.dataset.open)));
  }
  function paint(root,key,html,ctx){
    if(root.dataset.key===key)return;
    // Keep any expanded explanations open across live draft updates.
    const open=[...(root.querySelectorAll?.('details[open] > summary')||[])].map(s=>s.textContent);
    root.dataset.key=key;
    root.innerHTML=html;
    if(open.length)root.querySelectorAll('details > summary').forEach(s=>{if(open.includes(s.textContent))s.parentElement.open=true});
    bind(root,ctx);
  }
  const keyFor=(route,state,extra)=>JSON.stringify([route,phaseOf(state),tierOf(state),state.draft||null,state.matchup||null,state.teamPlan||null,extra]);

  views.draft={
    render(root,state,ctx){
      const phase=phaseOf(state);
      if(!state.paired||!state.draft||!['CHAMP_SELECT','RECORDING'].includes(phase))return false;
      paint(root,keyFor('draft',state,state.playerHome?.priorityMission||null),`<div class="oc-champ">${draftBoard(state)}${matchPlan(state)}</div>`,ctx);
      return true;
    },
  };

  views.prep={
    render(root,state,ctx){
      const phase=phaseOf(state);
      if(!state.paired)return false;
      if(['CHAMP_SELECT','RECORDING'].includes(phase)){
        if(!state.matchup&&!state.teamPlan)return false;
        paint(root,keyFor('prep',state,state.playerHome?.priorityMission||null),`<div class="oc-champ">${matchPlan(state,{standalone:true})}</div>`,ctx);
        return true;
      }
      if(phase!=='WAITING')return false;
      paint(root,JSON.stringify(['brief',state.playerHome||null,state.overlay||null]),`<div class="oc-champ">${briefing(state)}</div>`,ctx);
      return true;
    },
  };
})();
