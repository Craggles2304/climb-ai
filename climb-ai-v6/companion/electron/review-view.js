/* OP CLIMB Companion — Post-game review view.
 *
 * Cinematic header, performance overview, an interactive timeline of the
 * reviewed decisions and the player's bookmarks, what went well, what to
 * work on, mission proof and the next-game focus.
 *
 * Everything comes from state.postGameReview as the server sent it. A moment
 * only shows the explanations its evidence carries: no counterfactual means no
 * "what could be improved", and missing stats read "Not recorded".
 */
(()=>{
  'use strict';
  const ui=window.ocUI;
  if(!ui)return;
  const {esc,text,upper,num,titleCase,roleName,steps,icon,clock,dnaColor}=ui;
  const views=window.ocViews=window.ocViews||{};
  const list=value=>Array.isArray(value)?value.filter(Boolean):[];
  const finite=value=>value!=null&&value!==''&&Number.isFinite(Number(value));
  const phaseOf=state=>upper(state?.phase)||'STARTING';
  const tierOf=state=>{const tier=upper(state?.teamPlan?.strategyAccess?.tier||state?.playerHome?.tier);return['FREE','PLUS','PRO'].includes(tier)?tier:null};

  let selectedId='';
  let deepOpen=false;
  let deepFor='';

  /* --------------------------------------------------------- moments -- */

  /** Reviewed decisions and bookmarks on one clock. */
  function moments(review){
    const nodes=list(review?.decisionGraph?.nodes)
      .filter(n=>['GOOD','IMPROVE'].includes(upper(n?.verdict))&&finite(n?.atSeconds));
    let items=nodes.map((n,i)=>{
      const good=upper(n.verdict)==='GOOD';
      const cf=n.counterfactual||null;
      return{
        id:'d'+(text(n.id)||i),kind:good?'good':'review',at:num(n.atSeconds),
        time:text(n.minuteLabel)||clock(n.atSeconds),
        title:text(n.title||n.behaviourLabel)||'Reviewed decision',
        type:titleCase(text(n.type).replace(/_/g,' ')),
        confidence:upper(n.confidence),
        happened:[text(n.situation),text(n.decisionRead)].filter(Boolean),
        mattered:text(n.consequence),
        improve:!good&&cf?text(cf.alternative):'',
        whyBetter:!good&&cf?text(cf.whyBetter):'',
        tradeoff:!good&&cf?text(cf.tradeoff):'',
        principle:text(n.lockedPrinciple),
        plan:upper(n.planAlignment),
        evidence:list(n.evidence).map(text).filter(Boolean).slice(0,4),
        limitation:text(n.limitation),
      };
    });
    // Without a decision graph, fall back to the timed, verified review points.
    if(!items.length){
      const point=(item,kind,i)=>({id:kind[0]+'p'+i,kind,at:num(item.atSeconds),time:clock(item.atSeconds),title:text(item.title)||'Reviewed moment',
        type:'',confidence:'',happened:kind==='good'&&text(item.detail)?[text(item.detail)]:[],mattered:'',
        improve:kind==='review'?text(item.detail):'',whyBetter:'',tradeoff:'',principle:'',plan:'',evidence:[],limitation:''});
      items=[
        ...list(review?.doneWell||review?.good).filter(p=>p.verified!==false&&finite(p.atSeconds)).map((p,i)=>point(p,'good',i)),
        ...list(review?.improve||review?.critical).filter(p=>p.verified!==false&&finite(p.atSeconds)).map((p,i)=>point(p,'review',i)),
      ];
    }
    const marks=list(review?.markedMoments).filter(m=>finite(m?.atSeconds)).slice(0,12).map((m,i)=>({
      id:'m'+i,kind:'mark',at:num(m.atSeconds),time:clock(m.atSeconds),title:'Your bookmark',
      matched:upper(m.status)==='MATCHED',detail:text(m.detail),
    }));
    return[...items,...marks].sort((a,b)=>a.at-b.at);
  }

  /* ----------------------------------------------------------- pieces -- */

  function header(state,review){
    const match=review.match||{};
    const champion=text(match.champion);
    const art=ui.splashUrl(champion);
    const role=roleName(match.role);
    const tier=tierOf(state);
    const source=upper(review.source)==='RIOT_MATCH'?'Riot match data':'Companion recording';
    const stat=(label,value,sub)=>`<div class="oc-stat"><span class="oc-label">${label}</span><span class="oc-stat__value${value?'':' is-na'}">${value?esc(value):'Not recorded'}</span>${sub?`<span class="oc-small">${esc(sub)}</span>`:''}</div>`;
    const graph=review.decisionGraph||null;
    const reviewed=finite(graph?.nodeCount)?num(graph.nodeCount):finite(review.evidenceCount)?num(review.evidenceCount):null;
    const split=graph?.summary&&finite(graph.summary.cleanDecisions)?`${num(graph.summary.cleanDecisions)} clean · ${num(graph.summary.improveDecisions)} to review`:'';
    return `
      <section class="oc-card oc-card--hero oc-review-hero" aria-label="Match">
        ${art?`<img class="oc-card__art" src="${esc(art)}" alt="" onerror="this.remove()">`:''}
        <div class="oc-review-hero__top">
          <div class="oc-stack" style="--oc-gap:8px">
            <span class="oc-eyebrow">Post-game review · ${source}</span>
            <h2 class="oc-hero oc-review-hero__name">${esc(champion||'Your game')}</h2>
            <div class="oc-cluster">
              ${role?`<span class="oc-chip oc-chip--neutral">${esc(role)}</span>`:''}
              ${tier?`<span class="oc-tier oc-tier--${tier.toLowerCase()}">${tier}</span>`:''}
              ${review.partial?'<span class="oc-chip oc-chip--warning">Partial recording</span>':'<span class="oc-chip oc-chip--positive">Review ready</span>'}
            </div>
          </div>
        </div>
        <div class="oc-review-stats">
          ${stat('KDA',text(match.kda),'')}
          ${stat('CS / min',finite(match.csPerMin)?num(match.csPerMin).toFixed(1):'','')}
          ${stat('Duration',finite(match.durationSeconds)&&num(match.durationSeconds)>0?clock(match.durationSeconds):'','')}
          ${stat('Decisions reviewed',reviewed!=null?String(reviewed):'',split)}
        </div>
      </section>`;
  }

  function nextGame(review,state){
    const baseline=review.dnaBaseline;
    if(baseline&&baseline.ready===false){
      const required=Math.max(1,num(baseline.required,3));
      const games=Math.min(num(baseline.games),required);
      return `<section class="oc-card oc-card--accent oc-review-next oc-tone-violet"><span class="oc-eyebrow">Baseline ${games}/${required}</span>
        <p class="oc-review-next__title">${games>=required?'Baseline complete':`Baseline game ${Math.min(games+1,required)} of ${required} next`}</p>
        <p class="oc-body">This review is provisional. Permanent DNA missions start after ${required} games in this role.</p></section>`;
    }
    const primary=review.developmentPlan?.primary;
    const title=text(primary?.title||review.nextFocus?.title);
    const rule=text(primary?.gameRule||review.nextFocus?.rule);
    if(!title&&!rule)return'';
    return `<section class="oc-card oc-card--accent oc-review-next"><span class="oc-eyebrow">Next game · one focus</span>
      ${title?`<p class="oc-review-next__title">${esc(title)}</p>`:''}${rule?`<p class="oc-body">${esc(rule)}</p>`:''}</section>`;
  }

  function timeline(review,items){
    const duration=finite(review.match?.durationSeconds)&&num(review.match.durationSeconds)>0
      ?num(review.match.durationSeconds):Math.max(60,...items.map(m=>m.at+60));
    const counts={good:items.filter(m=>m.kind==='good').length,review:items.filter(m=>m.kind==='review').length,mark:items.filter(m=>m.kind==='mark').length};
    const ticks=[];
    for(let t=0;t<=duration;t+=300)ticks.push(`<span style="left:${(t/duration*100).toFixed(2)}%">${Math.round(t/60)}</span>`);
    const pos=at=>Math.max(1.5,Math.min(98.5,at/duration*100)).toFixed(2);
    const markers=items.map(m=>`<button type="button" class="oc-tl-marker is-${m.kind}${m.id===selectedId?' is-selected':''}" data-moment="${esc(m.id)}" style="left:${pos(m.at)}%"
      aria-label="${esc(`${m.time} · ${m.kind==='good'?'Good decision':m.kind==='review'?'Needs review':'Your bookmark'}: ${m.title}`)}"><span>${esc(m.time)}</span></button>`).join('');
    const rows=items.map(m=>`<li><button type="button" class="oc-tl-row is-${m.kind}${m.id===selectedId?' is-selected':''}" data-moment="${esc(m.id)}">
      <b>${esc(m.time)}</b><i aria-hidden="true"></i><span>${esc(m.kind==='mark'?(m.detail||'Your bookmark'):m.title)}</span></button></li>`).join('');
    return `
      <section class="oc-card oc-timeline" aria-label="Match timeline">
        <header class="oc-card__header">
          <div class="oc-card__heading"><span class="oc-eyebrow oc-tone-cyan">Match timeline</span><h3 class="oc-h3">Decision moments</h3></div>
          <div class="oc-cluster">
            <span class="oc-chip oc-chip--positive"><span class="oc-dot"></span>${counts.good} good</span>
            <span class="oc-chip oc-chip--negative"><span class="oc-dot"></span>${counts.review} to review</span>
            <span class="oc-chip oc-chip--dna"><span class="oc-dot"></span>${counts.mark} bookmarked</span>
          </div>
        </header>
        ${items.length?`
        <div class="oc-tl" role="group" aria-label="Moments along the match clock">
          <div class="oc-tl__track"></div>
          ${markers}
          <div class="oc-tl__ticks" aria-hidden="true">${ticks.join('')}<em>min</em></div>
        </div>
        <div class="oc-tl__body">
          <ol class="oc-tl__list">${rows}</ol>
          <div id="ocMomentDetail" class="oc-moment" aria-live="polite"></div>
        </div>`
        :`<div class="oc-empty"><h3 class="oc-title oc-text-1">No time-stamped decisions</h3><p class="oc-body">No decision in this game met the evidence bar for the timeline, and you didn't bookmark a moment. Press Ctrl+Shift+M in game to bookmark one.</p></div>`}
      </section>`;
  }

  function momentDetail(m){
    if(!m)return'';
    if(m.kind==='mark'){
      return `
        <div class="oc-moment__head"><span class="oc-chip oc-chip--dna">${icon('bookmark')}Your bookmark</span><b class="oc-moment__time">${esc(m.time)}</b></div>
        <h4 class="oc-title">You marked this moment</h4>
        <div class="oc-moment__section"><span class="oc-label">${m.matched?'Nearest recorded evidence':'What was recorded'}</span><p>${esc(m.detail||'No nearby review evidence was captured for this moment.')}</p></div>`;
    }
    const good=m.kind==='good';
    const section=(label,body)=>body?`<div class="oc-moment__section"><span class="oc-label">${label}</span>${body}</div>`:'';
    const para=value=>value?`<p>${esc(value)}</p>`:'';
    return `
      <div class="oc-moment__head">
        <span class="oc-chip ${good?'oc-chip--positive':'oc-chip--negative'}">${good?'Good decision':'Needs review'}</span>
        ${m.type?`<span class="oc-chip oc-chip--neutral">${esc(m.type)}</span>`:''}
        ${m.confidence?`<span class="oc-chip oc-chip--sm oc-chip--neutral" title="Evidence confidence">${esc(titleCase(m.confidence))} confidence</span>`:''}
        <b class="oc-moment__time">${esc(m.time)}</b>
      </div>
      <h4 class="oc-title">${esc(m.title)}</h4>
      ${section('What happened',m.happened.map(para).join(''))}
      ${section('Why it mattered',para(m.mattered))}
      ${section('What could be improved',m.improve?`<p class="oc-moment__better">${esc(m.improve)}</p>${para(m.whyBetter)}${m.tradeoff?`<p class="oc-small">Trade-off: ${esc(m.tradeoff)}</p>`:''}`:'')}
      ${m.principle?section(m.plan==='CONFLICTED'?'Your locked plan said':'Plan principle',para(m.principle)):''}
      ${m.evidence.length?section('Recorded evidence',`<ul class="oc-moment__evidence">${m.evidence.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`):''}
      ${m.limitation?`<p class="oc-small oc-moment__limit">${icon('shield')}${esc(m.limitation)}</p>`:''}`;
  }

  function points(review){
    const good=list(review.doneWell||review.good).slice(0,3);
    const fix=list(review.improve||review.critical).slice(0,3);
    const item=(p,kind)=>`<li class="${p.verified===false?'is-unverified':''}">
      <span class="oc-review-points__mark is-${kind}" aria-hidden="true">${p.verified===false?'–':kind==='good'?icon('check'):'!'}</span>
      <div><b>${esc(text(p.title))}</b>${text(p.detail)?`<p>${esc(text(p.detail))}</p>`:''}</div></li>`;
    if(!good.length&&!fix.length)return'';
    return `
      <div class="oc-review-points">
        <article class="oc-card oc-card--accent oc-tone-green"><span class="oc-eyebrow">What went well</span>
          ${good.length?`<ul>${good.map(p=>item(p,'good')).join('')}</ul>`:'<p class="oc-body">No positive decision was verified in this recording.</p>'}</article>
        <article class="oc-card oc-card--accent oc-tone-red"><span class="oc-eyebrow">What to work on</span>
          ${fix.length?`<ul>${fix.map(p=>item(p,'fix')).join('')}</ul>`:'<p class="oc-body">No mistake was verified in this recording.</p>'}</article>
      </div>`;
  }

  function missionProof(review){
    const baseline=review.dnaBaseline;
    const missions=list(review.missionEvidence).slice(0,2);
    if(baseline&&baseline.ready===false)return'';
    if(!missions.length)return `
      <section class="oc-review-proof"><header class="oc-section-head"><div class="oc-section-head__text"><span class="oc-eyebrow oc-tone-violet">Mission proof</span><h3 class="oc-h3">Your DNA missions</h3></div></header>
      <div class="oc-empty"><p class="oc-body">No reliable mission evidence was recorded in this game. DNA progress only moves on verified evidence.</p></div></section>`;
    const cards=missions.map(m=>{
      const raw=upper(m.evidenceState);
      const result=['BANKED','MISSED','NOT_OBSERVED'].includes(raw)?raw:'NOT_OBSERVED';
      const count=Math.max(0,num(m.confirmed??m.completedGames));
      const required=Math.max(1,num(m.required??m.requiredGames,3));
      const chip=result==='BANKED'?'<span class="oc-chip oc-chip--positive">Proven this game</span>'
        :result==='MISSED'?'<span class="oc-chip oc-chip--negative">Missed</span>'
        :'<span class="oc-chip oc-chip--neutral">Not observed</span>';
      const domain=upper(m.dnaDomain);
      const domainLabel=ui.dnaMeta(domain)?.short||titleCase(domain.replace(/_/g,' '))||'Game DNA';
      return `
        <article class="oc-card oc-card--accent oc-proof" style="--oc-tone:${dnaColor(domain)}">
          <div class="oc-spread"><span class="oc-eyebrow">${esc(domainLabel)}</span>${chip}</div>
          <h4 class="oc-title">${esc(text(m.title)||'Your development mission')}</h4>
          ${text(m.evidenceReason)?`<p class="oc-body">${esc(text(m.evidenceReason))}</p>`:''}
          <div class="oc-spread"><span class="oc-label">Proven games</span><span class="oc-mono oc-small">${Math.min(count,required)} of ${required}</span></div>
          ${steps(Math.min(count,required),required,{aria:`${Math.min(count,required)} of ${required} proven games`})}
        </article>`;
    }).join('');
    return `
      <section class="oc-review-proof">
        <header class="oc-section-head"><div class="oc-section-head__text"><span class="oc-eyebrow oc-tone-violet">Mission proof</span><h3 class="oc-h3">Your DNA missions</h3>
          <p class="oc-small">Only a proven game adds progress. Not observed is neutral, never a failure.</p></div></header>
        <div class="oc-review-proof__grid">${cards}</div>
      </section>`;
  }

  function building(state){
    const champion=text(state.matchup?.champion||state.draft?.localChampionName||ui.lastChampion()?.name);
    const art=ui.splashUrl(champion);
    return `
      <section class="oc-card oc-card--hero oc-review-hero is-building" aria-label="Building review" aria-busy="true">
        ${art?`<img class="oc-card__art" src="${esc(art)}" alt="" onerror="this.remove()">`:''}
        <div class="oc-stack" style="--oc-gap:12px">
          <span class="oc-eyebrow"><span class="oc-spinner" aria-hidden="true"></span>Post-game</span>
          <h2 class="oc-hero oc-review-hero__name">Building your review</h2>
          <p class="oc-lead" style="max-width:52ch">Your game has finished. OP CLIMB is turning the recording into your review. It opens here automatically when it's ready.</p>
        </div>
      </section>`;
  }

  /* ------------------------------------------------------------ view -- */

  function select(root,items,id){
    const m=items.find(x=>x.id===id)||items[0];
    if(!m)return;
    selectedId=m.id;
    root.querySelectorAll('[data-moment]').forEach(node=>node.classList.toggle('is-selected',node.dataset.moment===m.id));
    const detail=root.querySelector('#ocMomentDetail');
    if(detail){detail.className=`oc-moment is-${m.kind}`;detail.innerHTML=momentDetail(m)}
  }

  views.review={
    ownsNextAction:true,
    render(root,state,ctx){
      if(!state.paired)return false;
      const phase=phaseOf(state);
      if(phase==='UPLOADING'){
        const key=JSON.stringify(['building',state.matchup?.champion||'']);
        if(root.dataset.key!==key){root.dataset.key=key;root.innerHTML=`<div class="oc-review">${building(state)}</div>`}
        return true;
      }
      const review=state.postGameReview;
      if(!review)return false;
      ui.markReviewSeen(review);
      // A new review starts with the deeper analysis closed.
      const reviewId=text(review.sessionId||review.matchId);
      if(reviewId!==deepFor){deepFor=reviewId;deepOpen=false;selectedId=''}
      const items=moments(review);
      if(!items.some(m=>m.id===selectedId))selectedId=(items.find(m=>m.kind==='review')||items[0])?.id||'';
      // The legacy deep-analysis engines (Decision Twin and friends) render only during the REVIEW phase.
      const deepAvailable=phase==='REVIEW';
      document.body.classList.toggle('oc-review-deep',deepAvailable&&deepOpen);
      const key=JSON.stringify(['review',review,tierOf(state),deepAvailable,deepOpen]);
      // Receipt main.cjs checks before it marks the review as shown to the player.
      const receipt=()=>{window.__opRenderedReviewSessionId=String(review.sessionId||'')};
      if(root.dataset.key===key){receipt();return true}
      root.dataset.key=key;
      const progressPath=text(review.progressPath)||'/ilp';
      root.innerHTML=`
        <div class="oc-review">
          ${header(state,review)}
          ${nextGame(review,state)}
          ${timeline(review,items)}
          ${points(review)}
          ${missionProof(review)}
          <div class="oc-cluster oc-review-actions">
            <button class="oc-btn oc-btn--secondary oc-btn--sm" type="button" data-open-path="${esc(progressPath)}">Full review on OP CLIMB${icon('external')}</button>
            ${deepAvailable?`<button class="oc-btn oc-btn--ghost oc-btn--sm" type="button" data-deep aria-expanded="${deepOpen}">${deepOpen?'Hide deeper analysis':'Show deeper analysis'}</button>`:''}
          </div>
        </div>`;
      root.querySelectorAll('[data-moment]').forEach(node=>node.addEventListener('click',()=>select(root,items,node.dataset.moment)));
      root.querySelector('.oc-tl')?.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
        const index=items.findIndex(m=>m.id===selectedId);
        const next=items[Math.max(0,Math.min(items.length-1,index+(event.key==='ArrowRight'?1:-1)))];
        if(next){event.preventDefault();select(root,items,next.id);root.querySelector(`.oc-tl-marker[data-moment="${next.id}"]`)?.focus()}
      });
      root.querySelector('[data-open-path]')?.addEventListener('click',()=>ctx.api?.openClimbPath?.(progressPath));
      root.querySelector('[data-deep]')?.addEventListener('click',()=>{deepOpen=!deepOpen;root.dataset.key='';ctx.go(ctx.route)});
      select(root,items,selectedId);
      receipt();
      return true;
    },
    leave(){deepOpen=false;document.body.classList.remove('oc-review-deep')},
  };
})();
