const $=id=>document.getElementById(id);
let current=null;
let updateState=null;
let diagnosticsOpen=false;
let settingsOpen=false;
let pregameExpanded=false;
let coachReviewEvidenceOpen=false;
let activeCoachLevel={tier:'SILVER',depth:3,visiblePoints:3,reviewPoints:2,summary:'Core coaching with a little more context.'};

function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function safeArray(value){return Array.isArray(value)?value.filter(Boolean):[]}
function setHidden(node,hidden){if(node)node.classList.toggle('hidden',Boolean(hidden))}
function roleLabel(value){
  const role=String(value||'').trim().toUpperCase();
  return({TOP:'TOP',JUNGLE:'JUNGLE',MIDDLE:'MID',MID:'MID',BOTTOM:'ADC',ADC:'ADC',UTILITY:'SUPPORT',SUPPORT:'SUPPORT'})[role]||'—';
}

function phaseTitle(phase){
  return ({
    SETUP:'Connect this PC',
    STARTING:'Starting Companion',
    WAITING:'Ready for League',
    CHAMP_SELECT:'Your game plan',
    RECORDING:'Tracking match',
    UPLOADING:'Building your review',
    REVIEW:'Your game review',
    RESTARTING:'Restarting Companion',
    AUTH_ERROR:'Reconnect this PC',
    ERROR:'Companion needs attention',
  })[phase]||'OP CLIMB Companion';
}

function modeLabel(phase){
  return ({SETUP:'Setup',STARTING:'Starting',WAITING:'Ready',CHAMP_SELECT:'Pregame',RECORDING:'Recording',UPLOADING:'Reviewing',REVIEW:'Review Ready',RESTARTING:'Restarting',AUTH_ERROR:'Reconnect',ERROR:'Error'})[phase]||phase||'Ready';
}

function phaseCopy(state){
  const phase=String(state?.phase||'WAITING');
  if(phase==='STARTING')return'Starting quietly in the background.';
  if(phase==='WAITING')return"You're connected. Open League and play normally — OP CLIMB will take it from here.";
  if(phase==='CHAMP_SELECT')return'Reading champion select and building a short plan for this game.';
  if(phase==='RECORDING')return'No live shotcalling. OP CLIMB is recording quietly and will coach you after the game.';
  if(phase==='UPLOADING')return'Game finished. OP CLIMB is turning the recording into your review.';
  if(phase==='REVIEW')return'Your review is ready.';
  if(phase==='RESTARTING')return'Restarting the tracker. This should only take a moment.';
  if(phase==='AUTH_ERROR')return state?.detail||'This PC needs to be paired again from OP CLIMB.';
  if(phase==='ERROR')return state?.detail||'Something needs attention. Use the recovery options below.';
  return state?.detail||'Companion is running.';
}

function setCoachLevel(level){
  if(level&&Number(level.depth)){
    activeCoachLevel={
      ...activeCoachLevel,
      ...level,
      depth:clamp(Number(level.depth)||3,1,10),
      visiblePoints:clamp(Number(level.visiblePoints)||3,1,5),
      reviewPoints:clamp(Number(level.reviewPoints)||2,1,3),
    };
  }
  const signal=document.querySelector('.brand-signal b');
  if(signal)signal.textContent=`${activeCoachLevel.tier} COACH`;
}

function render(state){
  current=state||{};
  const paired=Boolean(current.paired);
  const phase=String(current.phase||'WAITING');
  const coach=current.postGameReview?.coachLevel||current.teamPlan?.coachLevel;
  setCoachLevel(coach);

  document.body.classList.toggle('op-mode-match-room',phase==='CHAMP_SELECT');
  document.body.classList.toggle('op-mode-quiet',phase==='RECORDING');
  document.body.classList.toggle('op-mode-coach-review',phase==='REVIEW');
  if(phase!=='REVIEW'){
    coachReviewEvidenceOpen=false;
    document.body.classList.remove('op-review-evidence-open');
  }

  setHidden($('setup'),paired);
  renderPlayerHome(current.playerHome,paired&&phase==='WAITING');
  renderPregame(current.matchup,current.teamPlan,current.draft,paired&&phase==='CHAMP_SELECT');
  renderQuietMode(current,paired&&phase==='RECORDING');
  renderPostGameReview(current.postGameReview,phase);
  renderUpdate(updateState,phase);

  if(!paired){
    setHidden($('status'),true);
    setHidden($('settings'),true);
    return;
  }

  const pregameVisible=phase==='CHAMP_SELECT'&&Boolean(current.matchup||current.draft);
  const quietVisible=phase==='RECORDING';
  const reviewVisible=phase==='REVIEW'&&Boolean(current.postGameReview);
  const homeVisible=phase==='WAITING'&&Boolean(current.playerHome?.ok);
  setHidden($('status'),homeVisible||pregameVisible||quietVisible||reviewVisible);

  $('statusTitle').textContent=phaseTitle(phase);
  $('statusCopy').textContent=phaseCopy(current);
  $('trackerState').textContent=current.trackerRunning?'Running':'Stopped';
  $('modeState').textContent=modeLabel(phase);
  $('statusPill').textContent=modeLabel(phase).toUpperCase();
  $('statusPill').classList.toggle('good',['WAITING','CHAMP_SELECT','RECORDING','UPLOADING','REVIEW'].includes(phase));
  $('statusPill').classList.toggle('bad',['AUTH_ERROR','ERROR','RESTARTING'].includes(phase));
  $('autoStart').classList.toggle('on',Boolean(current.autoStart));

  const statusBottom=document.querySelector('.status-bottom');
  if(statusBottom)statusBottom.style.display=['AUTH_ERROR','ERROR','RESTARTING'].includes(phase)?'flex':'none';

  const rows=safeArray(current.logs);
  $('logs').textContent=rows.length?rows.map(row=>`[${new Date(row.at).toLocaleTimeString()}] ${row.line}`).join('\n'):'No tracker activity yet.';

  syncSettingsVisibility();
}

function renderPlayerHome(home,visible){
  const section=ensurePlayerHome();
  setHidden(section,!visible);
  if(!visible||!home?.ok)return;

  const player=home.player||{};
  const tier=String(home.tier||'FREE').toUpperCase();
  const baseline=home.baseline||{games:0,required:3,ready:false};
  const baselineReady=Boolean(baseline.ready);
  const roleLabel=String(player.role||baseline.role||'ROLE').trim().toUpperCase()||'ROLE';
  const games=Math.max(0,Number(baseline.games||0));
  const required=Math.max(1,Number(baseline.required||3));

  $('playerHomeName').textContent=[player.gameName,player.tagline?'#'+player.tagline:''].filter(Boolean).join(' ');
  $('playerHomeRank').textContent=[player.rank,player.role].filter(Boolean).join(' · ')||'PLAYER PROFILE';
  $('playerHomeTier').textContent=tier;
  $('playerHomeView').textContent=String(home.tierView?.label||'PLAYER OVERVIEW');
  $('playerHomeViewCopy').textContent=baselineReady
    ?`${roleLabel} DNA only · only ${roleLabel} games progress these six strands. Other roles keep separate DNA profiles.`
    :`${roleLabel} DNA baseline ${Math.min(games,required)}/${required} · only games played in ${roleLabel} count toward this role profile.`;
  if($('playerDnaRoleTitle'))$('playerDnaRoleTitle').textContent=`${roleLabel} GAME DNA`;
  if($('playerDnaRoleSubtitle'))$('playerDnaRoleSubtitle').textContent=`Your ${roleLabel} player shape.`;
  if($('playerMissionRoleTitle'))$('playerMissionRoleTitle').textContent=`${roleLabel} DNA MISSIONS`;
  if($('playerMissionRoleSubtitle'))$('playerMissionRoleSubtitle').textContent=`Only ${roleLabel} games progress these six strands.`;

  const dnaRoot=$('playerHomeDna');
  dnaRoot.replaceChildren();
  safeArray(home.dna).forEach(item=>{
    const row=document.createElement('div');
    row.className='player-dna-row'+(!baselineReady?' baseline':'');
    row.style.setProperty('--dna-color',baselineReady?String(item.color||'#7d8a8f'):'#677378');

    const label=document.createElement('div');
    label.className='player-dna-label';
    const dot=document.createElement('i');
    const name=document.createElement('span');
    name.textContent=String(item.label||item.domain||'DNA');
    const xp=document.createElement('small');
    xp.textContent=baselineReady?`${Number(item.xpIntoLevel)||0}/${Number(item.xpForNextLevel)||100} XP`:'LEVELS UNLOCK AFTER BASELINE';
    name.appendChild(xp);
    label.append(dot,name);

    const track=document.createElement('div');track.className='player-dna-track';
    const fill=document.createElement('i');fill.style.width=(baselineReady?clamp(Number(item.levelProgress)||0,0,100):0)+'%';track.appendChild(fill);

    const value=document.createElement('b');value.textContent='LV '+(baselineReady?Math.max(1,Number(item.level)||1):1);

    row.append(label,track,value);
    dnaRoot.appendChild(row);
  });

  const missionRoot=$('playerHomeMissions');
  missionRoot.replaceChildren();
  if(!baselineReady){
    const card=document.createElement('article');card.className='player-mission-card baseline';
    card.innerHTML=`<span>DNA BASELINE</span><h3>${Math.min(games,required)}/${required} GAMES OBSERVED</h3><p>Play normally. OP CLIMB is learning your starting habits before it gives you a personalised mission.</p><div class="player-baseline-dots">${[0,1,2].map(i=>`<i class="${i<games?'done':i===games?'current':''}">${i<games?'✓':i+1}</i>`).join('')}</div>`;
    missionRoot.appendChild(card);
  }else{
    const missions=safeArray(home.missions);
    missions.forEach(mission=>{
      const dna=safeArray(home.dna).find(item=>String(item.domain)===String(mission.domain));
      const card=document.createElement('article');card.className='player-mission-card';
      card.style.setProperty('--mission-color',String(dna?.color||'#b6f66b'));
      const top=document.createElement('div');top.className='player-mission-top';
      const label=document.createElement('span');label.textContent=(roleLabel+' · '+String(dna?.label||mission.domain||'DNA')+' · LV '+Math.max(1,Number(dna?.level)||1)+' MISSION').toUpperCase();
      const reps=document.createElement('b');reps.textContent=`${Number(mission.confirmed)||0}/${Number(mission.required)||3} GAMES`;
      top.append(label,reps);
      const title=document.createElement('h3');title.textContent=String(mission.title||'Current DNA mission');
      const rule=document.createElement('p');rule.textContent=String(mission.gameRule||'Play a tracked game to build evidence for this strand.');
      const progress=document.createElement('div');progress.className='player-mission-progress';
      const progressFill=document.createElement('i');progressFill.style.width=clamp(Number(mission.progress)||0,0,100)+'%';progress.appendChild(progressFill);
      const note=document.createElement('small');note.textContent='Each tracked game that clears this mission banks one completion. 3/3 moves this strand to its next mission.';
      card.append(top,title,rule,progress,note);
      missionRoot.appendChild(card);
    });

    const limit=Number(home.tierView?.missionLimit)||6;
    while(missionRoot.children.length<limit){
      const empty=document.createElement('article');empty.className='player-mission-card empty';
      empty.innerHTML='<span>DNA MISSION</span><h3>WAITING FOR EVIDENCE</h3><p>This strand mission will appear as soon as the plan has enough tracked evidence.</p>';
      missionRoot.appendChild(empty);
    }
  }

  const memory=$('playerHomeMemory');
  if(tier==='PRO'){
    memory.className='player-memory pro';
    memory.innerHTML=`<span>PRO PLAYER MEMORY</span><strong>${Number(home.masteredCount)||0} MASTERED HABIT${Number(home.masteredCount)===1?'':'S'}</strong><small>Your six DNA levels are uncapped. Mastered missions and completed games keep adding permanent strand XP.</small>`;
  }else if(tier==='PLUS'){
    memory.className='player-memory plus';
    memory.innerHTML='<span>PLUS DEVELOPMENT VIEW</span><strong>90-DAY PROGRESS</strong><small>All six DNA missions stay tracked together. Long-term mastered-habit memory unlocks with Pro.</small>';
  }else{
    memory.className='player-memory free';
    memory.innerHTML='<span>FREE DEVELOPMENT VIEW</span><strong>6 DNA MISSIONS</strong><small>One mission sits on each DNA strand, with every tracked game able to bank progress.</small>';
  }

  const upgrade=$('playerHomeUpgrade');
  if(home.upgrade){
    upgrade.classList.remove('hidden');
    upgrade.querySelector('b').textContent='UNLOCK '+String(home.upgrade.tier||'NEXT');
    upgrade.querySelector('span').textContent=String(home.upgrade.copy||'');
  }else upgrade.classList.add('hidden');
}

function ensurePlayerHome(){
  let section=$('playerHome');
  if(section)return section;
  section=document.createElement('section');
  section.id='playerHome';
  section.className='player-home hidden';
  section.innerHTML=`
    <header class="player-home-hero">
      <div>
        <div class="player-home-kicker"><span id="playerHomeView">PLAYER OVERVIEW</span><b id="playerHomeTier">FREE</b></div>
        <h2 id="playerHomeName">PLAYER</h2>
        <p id="playerHomeRank">RANK · ROLE</p>
        <small id="playerHomeViewCopy">Loading your development view…</small>
      </div>
      <div class="player-home-ready"><i></i><span>READY FOR LEAGUE</span><small>Match detection armed</small></div>
    </header>
    <div class="player-home-grid">
      <section class="player-dna-panel">
        <div class="player-panel-head"><div><span id="playerDnaRoleTitle">ROLE GAME DNA</span><h3 id="playerDnaRoleSubtitle">Your role-specific player shape.</h3></div><button id="playerHomeOpenClimb" type="button">OPEN MY CLIMB ↗</button></div>
        <div id="playerHomeDna" class="player-dna-tree"></div>
      </section>
      <section class="player-missions-panel">
        <div class="player-panel-head"><div><span id="playerMissionRoleTitle">ROLE DNA MISSIONS</span><h3 id="playerMissionRoleSubtitle">Only this role progresses these strands.</h3></div></div>
        <div id="playerHomeMissions" class="player-mission-list"></div>
      </section>
    </div>
    <div class="player-home-bottom">
      <article id="playerHomeMemory" class="player-memory"></article>
      <article id="playerHomeUpgrade" class="player-upgrade hidden"><div><b>UNLOCK NEXT</b><span></span></div><button id="playerHomePlans" type="button">SEE PLANS ↗</button></article>
    </div>`;
  $('status').after(section);
  section.querySelector('#playerHomeOpenClimb')?.addEventListener('click',()=>window.opCompanion.openClimbPath('/ilp'));
  section.querySelector('#playerHomePlans')?.addEventListener('click',()=>window.opCompanion.openClimbPath('/progress'));
  return section;
}

function syncSettingsVisibility(){
  const settings=$('settings');
  if(!settings)return;
  setHidden(settings,!settingsOpen);
  const button=$('headerUpdates');
  if(!button)return;
  button.setAttribute('aria-expanded',String(settingsOpen));
  const status=String(updateState?.status||'');
  const needsUpdate=['AVAILABLE','DOWNLOADING','READY'].includes(status);
  button.classList.toggle('needs-update',needsUpdate);
  button.textContent=status==='READY'?'UPDATE READY':status==='AVAILABLE'?'UPDATE AVAILABLE':status==='DOWNLOADING'?'DOWNLOADING UPDATE':settingsOpen?'CLOSE SETTINGS':'UPDATES & SETTINGS';
}


function renderQuietMode(state,visible){
  const section=ensureQuietMode();
  const hasLockedPlan=Boolean(state?.teamPlan?.adaptiveBuild||state?.teamPlan?.ourWinCondition||state?.teamPlan?.roleWinCondition);
  setHidden(section,!visible||hasLockedPlan);
  if(!visible)return;
  const matchup=state?.matchup||null;
  const role=String(matchup?.role||matchup?.plan?.role||'').toUpperCase();
  const champion=String(matchup?.champion||matchup?.plan?.you?.name||'').trim();
  const identity=[champion,role].filter(Boolean).join(' · ');
  $('quietIdentity').textContent=identity||'MATCH IN PROGRESS';
  $('quietFocus').textContent='No live instructions. OP CLIMB is recording the match so your missions can be scored after the game.';
}

function ensureQuietMode(){
  let section=$('quietMode');
  if(section)return section;
  section=document.createElement('section');
  section.id='quietMode';
  section.className='card quiet-mode hidden';
  section.setAttribute('aria-live','polite');
  section.innerHTML=`
    <div class="quiet-mode-top">
      <div><div class="eyebrow">TRACKING ONLY · RECORDING</div><h2>MATCH IN PROGRESS</h2><p id="quietIdentity"></p></div>
      <span class="quiet-live"><i></i> RECORDING</span>
    </div>
    <div class="quiet-focus"><span>WHAT OP CLIMB IS DOING</span><strong id="quietFocus">No live instructions. OP CLIMB is recording the match so your missions can be scored after the game.</strong></div>
    <div class="quiet-mark"><button id="markMoment" class="primary">MARK THIS MOMENT</button><span>Or press Ctrl+Shift+M during a match.</span><small id="markMomentResult" role="status"></small></div>
    <p class="quiet-boundary">Tracking only. No reactive shotcalling, no live performance grading and no new tactical advice during the match. Coaching resumes after the game.</p>`;
  $('status').after(section);
  section.querySelector('#markMoment')?.addEventListener('click',async()=>{
    const result=await window.opCompanion.markMoment();
    $('markMomentResult').textContent=result?.ok?'Moment marked for your post-game review.':result?.error||'Could not mark this moment.';
  });
  return section;
}

function renderPregame(matchup,teamPlan,draft,visible){
  const box=$('matchup');
  if(!box)return;
  setHidden(box,!visible);
  if(!visible)return;

  setCoachLevel(teamPlan?.coachLevel);
  renderDraftBoard(draft,matchup);

  const loading=matchup?.status==='LOADING';
  const failed=matchup?.status==='ERROR';
  const ready=matchup?.status==='READY'&&matchup?.plan;
  setHidden($('matchupLoading'),true);
  setHidden($('matchupError'),!failed);
  setHidden($('matchupReady'),true);

  const simple=ensureSimplePregame();
  setHidden(simple,!ready);
  if(failed)$('matchupErrorCopy').textContent=matchup?.error||'OP CLIMB could not build this plan.';
  if(!ready)return;

  const plan=matchup.plan||{};
  const baseline=teamPlan?.dnaBaseline||null;
  const baselineReady=baseline?.ready!==false;
  const source=String(matchup?.source||'');
  const provisional=Boolean(matchup?.provisional||source==='CHAMPION_HOVER');
  const hasOpponent=Boolean(matchup.opponent&&['CHAMP_SELECT','IN_GAME'].includes(source));
  const you=plan.you?.name||matchup.champion||'Your champion';
  const them=hasOpponent?(plan.them?.name||matchup.opponent):'Opponent pending';
  const role=String(plan.role||'').toUpperCase();
  const rules=safeArray(plan.rules).length?safeArray(plan.rules):safeArray(plan.winCondition);
  const ruleCap=clamp(Number(activeCoachLevel.visiblePoints)||2,1,5);

  $('simplePregameTier').textContent=baselineReady
    ?`${activeCoachLevel.tier} COACH · ${provisional?'PREVIEW':'LOCKED'}`
    :`DNA BASELINE · ${Math.min(Number(baseline?.games||0),Number(baseline?.required||3))}/${Number(baseline?.required||3)}`;
  $('simplePregameTitle').textContent=hasOpponent?`${you} vs ${them}`:provisional?`${you} preview`:`${you} game plan`;
  $('simplePregameSummary').textContent=!baselineReady
    ?`Observation game ${Math.min(Number(baseline?.games||0)+1,Number(baseline?.required||3))} of ${Number(baseline?.required||3)}. Play normally — no personalised learning challenge is active yet.`
    :provisional
      ?'Preview only — change your hover freely. OP CLIMB will freeze and enrich the final plan when you lock in.'
      :(plan.laneEdge?.summary||'Keep the plan simple and play the first clean advantage.');
  $('simplePregameJob').textContent=teamPlan?.yourJob||fallbackJob(role);
  $('simplePregameLead').textContent=leadPathFor(activeCoachLevel.depth);
  const pill=$('simplePregamePill');
  if(pill){
    pill.textContent=provisional?'PREVIEW':'PLAN LOCKED';
    pill.classList.toggle('good',!provisional);
  }
  renderSimpleRules(rules.slice(0,ruleCap));
  renderPregameExtra(plan,teamPlan);
}

function renderDraftBoard(draft,matchup){
  const board=ensureDraftBoard();
  if(!board)return;
  const hasDraft=Boolean(draft);
  setHidden(board,!hasDraft);
  if(!hasDraft)return;