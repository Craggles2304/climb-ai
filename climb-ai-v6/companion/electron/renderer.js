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
  const tft=current.tftRecorder||{};
  if($('tftRecorderState'))$('tftRecorderState').textContent=tft.state==='RECORDING'?'Recording':tft.state==='READY'?'Review ready':tft.state==='PROCESSING'?'Reviewing':tft.state==='ERROR'?'Needs attention':tft.available?'Armed':'Unavailable';
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
  let companionDnaRevealed=false;
  try{companionDnaRevealed=localStorage.getItem('op:dna-revealed:'+roleLabel)==='1'}catch{}
  const journey=baselineReady&&!companionDnaRevealed
    ?{phase:'DNA_REVEAL',status:'DNA READY · 3/3',title:'Your Game DNA is ready to reveal.',body:'Open My DNA once to reveal your six strands and first priority mission.',progress:'3/3'}
    :home.journey||{
      phase:baselineReady?'MISSION':'BASELINE',
      status:baselineReady?'DNA ACTIVE':'BASELINE '+Math.min(games,required)+'/'+required,
      title:baselineReady?'Your priority mission is ready.':'Play baseline game '+Math.min(games+1,required)+'.',
      body:baselineReady?'Focus one mission. OP CLIMB tracks the other five automatically.':'Play normally. Coaching stays provisional until the three-game baseline is complete.',
      progress:Math.min(games,required)+'/'+required,
    };

  $('playerHomeName').textContent=[player.gameName,player.tagline?'#'+player.tagline:''].filter(Boolean).join(' ');
  $('playerHomeRank').textContent=[player.rank,player.role].filter(Boolean).join(' · ')||'PLAYER PROFILE';
  $('playerHomeTier').textContent=tier;
  $('playerHomeView').textContent=String(home.tierView?.label||'PLAYER OVERVIEW');
  $('playerHomeViewCopy').textContent=baselineReady
    ?`${roleLabel} DNA only · only ${roleLabel} games progress these six strands. Other roles keep separate DNA profiles.`
    :`${roleLabel} DNA baseline ${Math.min(games,required)}/${required} · only games played in ${roleLabel} count toward this role profile.`;
  if($('playerJourneyStatus'))$('playerJourneyStatus').textContent=String(journey.status||'YOUR NEXT STEP');
  if($('playerJourneyProgress'))$('playerJourneyProgress').textContent=String(journey.progress||'');
  if($('playerJourneyTitle'))$('playerJourneyTitle').textContent=String(journey.title||'Keep climbing.');
  if($('playerJourneyBody'))$('playerJourneyBody').textContent=String(journey.body||'OP CLIMB will keep the next step clear.');
  const journeyCard=$('playerJourney');
  if(journeyCard)journeyCard.className='player-journey phase-'+String(journey.phase||'MISSION').toLowerCase();
  if($('playerDnaRoleTitle'))$('playerDnaRoleTitle').textContent=roleLabel+' GAME DNA';
  if($('playerDnaRoleSubtitle'))$('playerDnaRoleSubtitle').textContent=!baselineReady?'Locked until the three-game role baseline is complete.':!companionDnaRevealed?'Baseline complete. Reveal your DNA to start the mission loop.':'Your '+roleLabel+' player shape.';
  if($('playerMissionRoleTitle'))$('playerMissionRoleTitle').textContent=!baselineReady?'PROVISIONAL COACHING':!companionDnaRevealed?'DNA READY':roleLabel+' TWO UNLOCKED TREES';
  if($('playerMissionRoleSubtitle'))$('playerMissionRoleSubtitle').textContent=!baselineReady?'No permanent DNA missions until baseline 3/3.':!companionDnaRevealed?'Reveal your player identity before training missions.':'All six DNA strands stay visible. The two trees you unlocked are the only ones that can bank mission progress this game.';
  if($('playerHomeOpenClimb'))$('playerHomeOpenClimb').textContent=baselineReady&&!companionDnaRevealed?'REVEAL MY DNA ↗':'OPEN MY DNA ↗';

  const roleRoot=$('playerDnaRoleSwitcher');
  if(roleRoot){
    roleRoot.replaceChildren();
    const selected=String(home.selectedRole||roleLabel).toUpperCase();
    const primary=String(home.primaryRole||player.primaryRole||roleLabel).toUpperCase();
    const profiles=safeArray(home.roleProfiles);
    profiles.forEach(profile=>{
      const role=String(profile.role||'').toUpperCase();
      if(!role)return;
      const button=document.createElement('button');
      button.type='button';
      button.className=(role===selected?'active ':'')+(role===primary?'primary-role':'');
      button.setAttribute('aria-pressed',String(role===selected));
      const title=document.createElement('strong');title.textContent=role;
      const gamesSeen=Math.max(0,Number(profile.games)||0);
      const requiredGames=Math.max(1,Number(profile.required)||3);
      const meta=document.createElement('small');
      meta.textContent=(profile.ready?`${gamesSeen} GAMES`:`${Math.min(gamesSeen,requiredGames)}/${requiredGames} BASELINE`)+(role===primary?' · MAIN':'');
      button.append(title,meta);
      button.addEventListener('click',async()=>{
        if(role===selected)return;
        button.disabled=true;
        const result=await window.opCompanion.setDnaRole(role).catch(()=>({ok:false}));
        if(!result?.ok)button.disabled=false;
      });
      roleRoot.appendChild(button);
    });
  }

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
    card.innerHTML=`<span>PROVISIONAL COACHING · NOT A DNA MISSION</span><h3>BASELINE ${Math.min(games,required)}/${required}</h3><p>Play normally. OP CLIMB is learning what repeats before it reveals your permanent DNA missions after game ${required}.</p><div class="player-baseline-dots">${[0,1,2].map(i=>`<i class="${i<games?'done':i===games?'current':''}">${i<games?'✓':i+1}</i>`).join('')}</div>`;
    missionRoot.appendChild(card);
  }else if(!companionDnaRevealed){
    const card=document.createElement('article');card.className='player-mission-card reveal';
    card.innerHTML='<span>GAME DNA READY · 3/3</span><h3>REVEAL YOUR PLAYER IDENTITY</h3><p>Your baseline is complete. Open My DNA to reveal all six strands and the two missions selected for your next game.</p><small>Nothing to memorise yet · reveal first, then OP CLIMB gives you two clear jobs.</small>';
    missionRoot.appendChild(card);
  }else{
    const missions=safeArray(home.missions);
    missions.forEach((mission,index)=>{
      const dna=safeArray(home.dna).find(item=>String(item.domain)===String(mission.domain));
      const focusOrder=Math.max(1,Number(mission.focusOrder)||index+1);
      const priority=focusOrder===1;
      const card=document.createElement('article');card.className='player-mission-card focus';
      card.style.setProperty('--mission-color',String(dna?.color||'#b6f66b'));
      const top=document.createElement('div');top.className='player-mission-top';
      const label=document.createElement('span');label.textContent=(('UNLOCKED '+focusOrder+' OF 2')+' · '+String(dna?.label||mission.domain||'DNA')).toUpperCase();
      const reps=document.createElement('b');reps.textContent=`${Number(mission.confirmed)||0}/${Number(mission.required)||3} PROVEN`;
      top.append(label,reps);
      const title=document.createElement('h3');title.textContent=String(mission.title||'Current DNA mission');
      const rule=document.createElement('p');rule.textContent=String(mission.nextGame||mission.gameRule||'Play a tracked game to build evidence for this strand.');
      const progress=document.createElement('div');progress.className='player-mission-progress';
      const progressFill=document.createElement('i');progressFill.style.width=clamp(Number(mission.progress)||0,0,100)+'%';progress.appendChild(progressFill);
      const note=document.createElement('small');note.textContent='THIS GAME · Only the two DNA trees you unlocked can bank a proven rep. The other four remain fully visible in My DNA.';
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
  if(!baselineReady){
    memory.className='player-memory baseline';
    memory.innerHTML=`<span>BASELINE ${Math.min(games,required)}/${required}</span><strong>PERMANENT MISSIONS LOCKED</strong><small>Single-game coaching is provisional. Finish the role baseline before OP CLIMB creates your persistent DNA mission loop.</small>`;
  }else if(!companionDnaRevealed){
    memory.className='player-memory reveal';
    memory.innerHTML='<span>DNA READY · 3/3</span><strong>REVEAL FIRST</strong><small>Your missions are ready behind the reveal. Open My DNA once, then the Companion will show the two missions selected for your next game.</small>';
  }else if(tier==='PRO'){
    memory.className='player-memory pro';
    memory.innerHTML=`<span>PRO PLAYER MEMORY</span><strong>${Number(home.masteredCount)||0} MASTERED HABIT${Number(home.masteredCount)===1?'':'S'}</strong><small>Your six DNA levels are uncapped. Mastered missions and completed games keep adding permanent strand XP.</small>`;
  }else if(tier==='PLUS'){
    memory.className='player-memory plus';
    memory.innerHTML='<span>PLUS DEVELOPMENT VIEW</span><strong>90-DAY PROGRESS</strong><small>Two missions are scored each game. All six DNA strands still build your long-term profile. Long-term mastered-habit memory unlocks with Pro.</small>';
  }else{
    memory.className='player-memory free';
    memory.innerHTML='<span>FREE DEVELOPMENT VIEW</span><strong>6 DNA MISSIONS</strong><small>Two missions are selected and scored per game. The other four strands stay in your DNA profile without competing for focus.</small>';
  }

  const upgrade=$('playerHomeUpgrade');
  if(home.upgrade&&baselineReady&&companionDnaRevealed){
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
    <section id="playerJourney" class="player-journey">
      <div class="player-journey-step"><span id="playerJourneyStatus">YOUR NEXT STEP</span><b id="playerJourneyProgress"></b></div>
      <div class="player-journey-copy"><strong id="playerJourneyTitle">Loading your journey…</strong><small id="playerJourneyBody">OP CLIMB is checking what comes next.</small></div>
    </section>
    <section class="player-role-switcher">
      <div><span>DNA ROLE PROFILE</span><strong>FLICK BETWEEN ROLES</strong><small>Viewing only · switching here never changes your main role or merges progress.</small></div>
      <div id="playerDnaRoleSwitcher" class="player-role-tabs" role="tablist" aria-label="Game DNA roles"></div>
    </section>
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
  section.querySelector('#playerHomeOpenClimb')?.addEventListener('click',()=>{const role=String(current?.playerHome?.selectedRole||current?.playerHome?.player?.role||'').toUpperCase();const baseline=current?.playerHome?.baseline;if(baseline?.ready&&role){try{localStorage.setItem('op:dna-revealed:'+role,'1')}catch{}}window.opCompanion.openClimbPath(role?`/ilp?role=${encodeURIComponent(role)}`:'/ilp')});
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
  const baselineReady=state?.playerHome?.baseline?.ready!==false;
  $('quietFocus').textContent=baselineReady
    ?'No live instructions. OP CLIMB is recording quietly so the two missions from your unlocked DNA trees can be measured after the game.'
    :'No live instructions. OP CLIMB is recording quietly so this game can build your baseline and provisional post-game coaching.';
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
    <div class="quiet-focus"><span>WHAT OP CLIMB IS DOING</span><strong id="quietFocus">No live instructions. OP CLIMB is recording quietly and will coach you after the game.</strong></div>
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
    ?`Observation game ${Math.min(Number(baseline?.games||0)+1,Number(baseline?.required||3))} of ${Number(baseline?.required||3)}. The match plan stays simple while OP CLIMB learns your starting point.`
    :provisional
      ?'Preview only — the path to win will freeze when you lock in and sharpen as the full draft appears.'
      :'Read this once: how we win, how they win, your job, three actions and the one throw to avoid.';
  $('simplePregameHowWin').textContent=directWinPath(teamPlan,plan);
  $('simplePregameHowLose').textContent=directLossPath(teamPlan);
  $('simplePregameJob').textContent=teamPlan?.yourJob||fallbackJob(role);
  $('simplePregameThrow').textContent=String(teamPlan?.biggestThrow||teamPlan?.roleWinCondition?.lossCondition||'Do not break formation for a low-value chase.');
  const mission=baselineReady?safeArray(teamPlan?.missionTips)[0]||null:null;
  $('simplePregameMission').textContent=baselineReady
    ?String(mission?.cue||mission?.title||'Keep your current development focus separate from the match win condition.')
    :`BASELINE ${Math.min(Number(baseline?.games||0)+1,Number(baseline?.required||3))}/${Number(baseline?.required||3)} · PLAY NORMALLY`;
  const pill=$('simplePregamePill');
  if(pill){
    pill.textContent=provisional?'PREVIEW':'PLAN LOCKED';
    pill.classList.toggle('good',!provisional);
  }
  renderWinningActions(directWinningActions(teamPlan,rules.slice(0,ruleCap),role));
  renderPregameExtra(plan,teamPlan);
}

function renderDraftBoard(draft,matchup){
  const board=ensureDraftBoard();
  if(!board)return;
  const hasDraft=Boolean(draft);
  setHidden(board,!hasDraft);
  if(!hasDraft)return;

  const role=roleLabel(draft.localRole);
  const champion=String(draft.localChampionName||'').trim();
  const locked=Boolean(draft.localLockedIn);
  const state=locked?'LOCKED':champion?'HOVERING':'CHOOSING';
  const title=champion
    ?`${champion} · ${state}`
    :role&&role!=='—'
      ?`${role} · CHOOSE YOUR CHAMPION`
      :'DRAFT IN PROGRESS';
  $('draftBoardTitle').textContent=title;
  $('draftBoardRole').textContent=role;
  $('draftBoardPick').textContent=champion||'NO CHAMPION SELECTED';
  $('draftBoardState').textContent=state;
  $('draftBoardState').classList.toggle('good',locked);
  const enemySeen=safeArray(draft.enemies).filter(p=>p?.championName).length;
  $('draftBoardSeen').textContent=`${enemySeen}/5 ENEMIES SEEN`;
  $('draftBoardHint').textContent=locked
    ?'Your pick is locked. OP CLIMB is finalising the matchup, team plan and item recommendation as the remaining draft appears.'
    :champion
      ?'Preview is live now. Change your hover freely — the plan will follow you. Locking only freezes the final version.'
      :'OP CLIMB is already reading role, picks and bans. Hover a champion when you are ready and the preview will appear automatically.';
  renderDraftSide('draftOurPicks',safeArray(draft.allies),draft.localPlayerCellId,true);
  renderDraftSide('draftTheirPicks',safeArray(draft.enemies),draft.localPlayerCellId,false);
  renderDraftBans('draftOurBans',safeArray(draft?.bans?.allies));
  renderDraftBans('draftTheirBans',safeArray(draft?.bans?.enemies));
}

function renderDraftSide(id,picks,localCell,ours){
  const root=$(id);if(!root)return;
  root.replaceChildren();
  const values=picks.length?picks:Array.from({length:5},()=>null);
  values.slice(0,5).forEach((pick,index)=>{
    const row=document.createElement('div');
    row.style.cssText='display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 9px;border:1px solid rgba(255,255,255,.07);border-radius:10px;background:rgba(255,255,255,.018)';
    const role=document.createElement('span');
    role.textContent=roleLabel(pick?.role);role.style.cssText='font-size:9px;font-weight:900;opacity:.55';
    const name=document.createElement('strong');
    name.textContent=pick?.championName||((ours&&Number(pick?.cellId)===Number(localCell))?'YOU · SELECTING':'SELECTING…');
    name.style.cssText='white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    const state=document.createElement('span');
    const selection=String(pick?.selectionState||pick?.lockedIn?'LOCKED':pick?.championName?'HOVER':'WAITING');
    state.textContent=pick?.lockedIn?'LOCKED':pick?.championName?(ours?'HOVER':'SEEN'):'';
    state.style.cssText='font-size:8px;font-weight:900;color:'+(pick?.lockedIn?'#d6ff2f':'#7f93a0');
    row.append(role,name,state);root.appendChild(row);
  });
}

function renderDraftBans(id,bans){
  const root=$(id);if(!root)return;
  root.replaceChildren();
  const named=bans.map(b=>String(b?.championName||'').trim()).filter(Boolean);
  if(!named.length){const empty=document.createElement('span');empty.textContent='NONE YET';empty.style.opacity='.45';root.appendChild(empty);return}
  named.slice(0,5).forEach(name=>{const chip=document.createElement('span');chip.textContent=name;chip.style.cssText='padding:5px 7px;border:1px solid rgba(255,95,95,.18);border-radius:999px;font-size:8px;font-weight:850;color:#d8b0b0';root.appendChild(chip)});
}

function ensureDraftBoard(){
  let board=$('draftBoard');
  if(board)return board;
  const box=$('matchup');
  if(!box)return null;
  board=document.createElement('section');
  board.id='draftBoard';
  board.className='hidden';
  board.style.cssText='display:grid;gap:12px;margin-bottom:12px;padding:16px;border:1px solid rgba(214,255,47,.2);background:linear-gradient(135deg,rgba(214,255,47,.035),rgba(4,8,12,.72));border-radius:16px';
  board.innerHTML=`
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
      <div><div class="eyebrow">CHAMP SELECT · LIVE DRAFT</div><h2 id="draftBoardTitle" style="margin:5px 0 0;font-size:clamp(24px,4vw,36px)">DRAFT IN PROGRESS</h2></div>
      <span id="draftBoardState" class="pill">CHOOSING</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
      <div style="padding:9px 10px;border:1px solid rgba(255,255,255,.07);border-radius:11px"><span class="eyebrow">YOUR ROLE</span><strong id="draftBoardRole" style="display:block;margin-top:4px">—</strong></div>
      <div style="padding:9px 10px;border:1px solid rgba(255,255,255,.07);border-radius:11px"><span class="eyebrow">YOUR PICK</span><strong id="draftBoardPick" style="display:block;margin-top:4px">SELECTING</strong></div>
      <div style="padding:9px 10px;border:1px solid rgba(255,255,255,.07);border-radius:11px"><span class="eyebrow">DRAFT READ</span><strong id="draftBoardSeen" style="display:block;margin-top:4px">0/5 ENEMIES SEEN</strong></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div><div class="eyebrow" style="margin-bottom:7px">YOUR TEAM</div><div id="draftOurPicks" style="display:grid;gap:6px"></div></div>
      <div><div class="eyebrow" style="margin-bottom:7px">THEIR TEAM</div><div id="draftTheirPicks" style="display:grid;gap:6px"></div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;border-top:1px solid rgba(255,255,255,.07);padding-top:10px">
      <div><div class="eyebrow">OUR BANS</div><div id="draftOurBans" style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px"></div></div>
      <div><div class="eyebrow">THEIR BANS</div><div id="draftTheirBans" style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px"></div></div>
    </div>
    <p id="draftBoardHint" style="margin:0;font-size:11px;line-height:1.5;opacity:.68"></p>`;
  const simple=$('simplePregame');
  if(simple)box.insertBefore(board,simple);else box.prepend(board);
  return board;
}

function ensureSimplePregame(){
  let section=$('simplePregame');
  if(section)return section;
  const box=$('matchup');
  section=document.createElement('section');
  section.id='simplePregame';
  section.className='hidden';
  section.innerHTML=`
    <div class="simple-pregame-hero" style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
      <div><div class="eyebrow" id="simplePregameTier">COACH</div><h2 id="simplePregameTitle" style="font-size:clamp(28px,5vw,44px);margin:6px 0 8px;letter-spacing:-.04em"></h2><p id="simplePregameSummary" style="margin:0;opacity:.72;line-height:1.5;max-width:720px"></p></div>
      <span id="simplePregamePill" class="pill good">GAME PLAN</span>
    </div>
    <div class="simple-pregame-win-grid">
      <article class="simple-pregame-win"><div class="eyebrow">HOW WE WIN</div><strong id="simplePregameHowWin"></strong></article>
      <article class="simple-pregame-loss"><div class="eyebrow">HOW THEY WIN</div><strong id="simplePregameHowLose"></strong></article>
    </div>
    <article class="simple-pregame-job"><div class="eyebrow">YOUR JOB</div><strong id="simplePregameJob"></strong></article>
    <section class="simple-pregame-actions"><div class="eyebrow">YOUR 3 WINNING ACTIONS</div><div id="simplePregameRules"></div></section>
    <article class="simple-pregame-throw"><div class="eyebrow">BIGGEST THROW</div><strong id="simplePregameThrow"></strong></article>
    <article class="simple-pregame-mission"><div class="eyebrow">YOUR DEVELOPMENT JOB · SEPARATE FROM THE MATCH PLAN</div><strong id="simplePregameMission"></strong></article>
    <div id="simplePregameExtra" class="hidden" style="margin-top:12px;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:16px;background:rgba(255,255,255,.02)"><div class="eyebrow">DEEPER MATCH DETAIL</div><div id="simplePregameExtraList" style="display:grid;gap:9px;margin-top:10px"></div></div>
    <div class="simple-pregame-actions-row" style="display:flex;gap:9px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px"><button id="simplePregameMore" class="ghost">MORE DETAIL</button><button id="simplePregameFull" class="ghost">OPEN FULL ANALYSIS</button></div>`;
  const ready=$('matchupReady');
  box.insertBefore(section,ready||null);
  $('simplePregameMore').addEventListener('click',()=>{pregameExpanded=!pregameExpanded;syncPregameExtra()});
  $('simplePregameFull').addEventListener('click',()=>window.opCompanion.openClimb());
  return section;
}

function directWinPath(teamPlan,plan){
  const roleWin=teamPlan?.roleWinCondition||null;
  const steps=safeArray(roleWin?.steps);
  if(steps.length===5){
    const shape=String(roleWin?.compPlan||teamPlan?.teamfight?.label||'PLAY THE DRAFT').trim();
    const fight=String(steps[3]?.value||'').trim();
    const convert=String(steps[4]?.value||'').trim();
    return [shape,fight,convert].filter(Boolean).join(' → ');
  }
  const fallback=String(teamPlan?.ourWinCondition||safeArray(plan?.winCondition)[0]||teamPlan?.teamfight?.summary||'Create the first clean advantage, stay connected and convert it into the objective.').trim();
  return fallback;
}

function directLossPath(teamPlan){
  return String(teamPlan?.theirWinCondition||teamPlan?.roleWinCondition?.lossCondition||'They isolate a target or break your formation before the fight starts.').trim();
}

function directWinningActions(teamPlan,rules,role){
  const steps=safeArray(teamPlan?.roleWinCondition?.steps);
  if(steps.length===5){
    const firstLabel=role==='JUNGLE'?'EARLY PATH':role==='SUPPORT'?'LANE':'EARLY GAME';
    return[
      {label:firstLabel,value:String(steps[0]?.value||'PLAY CLEAN')},
      {label:'SETUP',value:[steps[1]?.value,steps[2]?.value].filter(Boolean).join(' → ')},
      {label:'FIGHT → CONVERT',value:[steps[3]?.value,steps[4]?.value].filter(Boolean).join(' → ')},
    ];
  }
  const fallback=(rules.length?rules:['Play clean.','Arrive before the important fight.','Win the fight, take the objective, then reset.']).slice(0,3);
  return fallback.map((value,index)=>({label:['EARLY GAME','SETUP','FIGHT → CONVERT'][index],value:String(value)}));
}

function renderWinningActions(actions){
  const root=$('simplePregameRules');
  if(!root)return;
  root.replaceChildren();
  safeArray(actions).slice(0,3).forEach((action,index)=>{
    const row=document.createElement('div');
    row.className='simple-winning-action';
    const n=document.createElement('b');n.textContent=String(index+1).padStart(2,'0');
    const copy=document.createElement('div');
    const label=document.createElement('span');label.textContent=String(action?.label||'ACTION');
    const text=document.createElement('strong');text.textContent=String(action?.value||'PLAY CLEAN');
    copy.append(label,text);row.append(n,copy);root.appendChild(row);
  });
}

function renderPregameExtra(plan,teamPlan){
  const extras=[];
  const spikes=safeArray(plan.powerSpikes);
  const first=spikes.find(x=>Number(x.level)===2)||spikes[0];
  const major=spikes.find(x=>Number(x.level)===6)||spikes.find(x=>Number(x.level)>2);
  if(first)extras.push(`Early spike · Lv ${first.level}: ${first.fight||first.label||'Use the first clean power window.'}`);
  if(activeCoachLevel.depth>=5&&plan.laneDuel?.advantage)extras.push(`Matchup edge: ${plan.laneDuel.advantage}`);
  if(activeCoachLevel.depth>=7&&major)extras.push(`Major spike · Lv ${major.level}: ${major.fight||major.label||'Use the next major power window.'}`);
  if(activeCoachLevel.depth>=8&&teamPlan?.teamfight?.summary)extras.push(`Teamfight: ${teamPlan.teamfight.summary}`);
  if(activeCoachLevel.depth>=9&&teamPlan?.biggestThrow)extras.push(`Avoid: ${teamPlan.biggestThrow}`);

  const cap=activeCoachLevel.depth<=3?1:activeCoachLevel.depth<=6?2:activeCoachLevel.depth<=8?3:4;
  const root=$('simplePregameExtraList');
  if(root){
    root.replaceChildren();
    extras.slice(0,cap).forEach(text=>{
      const p=document.createElement('p');p.textContent=text;p.style.cssText='margin:0;line-height:1.45;opacity:.8';root.appendChild(p);
    });
  }
  const more=$('simplePregameMore');
  if(more)more.style.display=extras.length?'':'none';
  syncPregameExtra();
}

function syncPregameExtra(){
  const extra=$('simplePregameExtra');
  setHidden(extra,!pregameExpanded);
  const more=$('simplePregameMore');
  if(more)more.textContent=pregameExpanded?'LESS DETAIL':'MORE DETAIL';
}

function leadPathFor(depth){
  if(depth<=2)return'TRADE → RESET';
  if(depth<=4)return'TRADE → WAVE → RESET';
  if(depth<=6)return'TRADE → WAVE → RESET → ITEM';
  return'TRADE → HP → WAVE → RESET → ITEM';
}

function fallbackJob(role){
  const value=String(role||'').toUpperCase();
  if(value==='ADC'||value==='BOTTOM')return'Stay safe, keep your range and hit the nearest safe target.';
  if(value==='SUPPORT'||value==='UTILITY')return'Create space for your carries. Engage or peel — do not do both at once.';
  if(value==='JUNGLE')return'Be there before the important fight starts. Connect your team around objectives.';
  if(value==='TOP')return'Use side-lane pressure, then reconnect before the important fight.';
  if(value==='MID'||value==='MIDDLE')return'Catch your wave, then move first and stay connected to your team.';
  return'Play your champion strength without breaking the team shape.';
}

function renderPostGameReview(review,phase){
  const section=ensureReviewSection();
  const visible=phase==='REVIEW'&&Boolean(review);
  setHidden(section,!visible);
  if(!visible)return;

  setCoachLevel(review.coachLevel);
  const match=review.match||{};
  const bits=[match.champion,match.role];
  if(activeCoachLevel.depth>=2&&match.kda)bits.push(`${match.kda} KDA`);
  if(activeCoachLevel.depth>=4&&Number.isFinite(match.csPerMin))bits.push(`${match.csPerMin} CS/min`);
  $('simpleReviewMatch').textContent=bits.filter(Boolean).join(' · ');
  $('simpleReviewTag').textContent=`${activeCoachLevel.tier} COACH · ${review.source==='RIOT_MATCH'?'RIOT MATCH':review.partial?'PARTIAL':'POST-GAME'}`;

  const baseline=review.dnaBaseline||{games:3,required:3,ready:true};
  const baselineGames=Math.max(0,Number(baseline.games||0));
  const baselineRequired=Math.max(1,Number(baseline.required||3));
  const baselineReady=Boolean(baseline.ready);
  const learning=review.learningSignal||null;
  const primary=review.developmentPlan?.primary||null;
  const strength=safeArray(review.doneWell||review.good).find(item=>item?.verified!==false)||safeArray(review.doneWell||review.good)[0]||null;

  $('simpleReviewHeadline').textContent=!baselineReady
    ?`BASELINE ${Math.min(baselineGames,baselineRequired)}/${baselineRequired}`
    :learning?.status==='MASTERED'
      ?'HABIT MASTERED ✓'
      :learning?.status==='REP_BANKED'
        ?'PROVEN GAME ✓'
        :'YOUR PROGRESS IS READY';

  const intro=section.querySelector('.coach-review-intro');
  if(intro)intro.textContent=!baselineReady
    ?`Game ${Math.min(baselineGames,baselineRequired)} of ${baselineRequired} is recorded. This is provisional coaching only — permanent DNA missions stay locked until baseline 3/3 and the DNA reveal.`
    :learning?.status==='REP_BANKED'
      ?`That game proved “${learning.title}”. You now have ${learning.confirmed}/${learning.required} proven games.`
      :learning?.status==='MASTERED'
        ?`You proved “${learning.title}” enough times for it to move into mastery.`
        :'The game is measured. See what held, what needs work and whether your priority mission was proven.';

  renderReviewList('simpleGood',review.doneWell||review.good,'✓');
  renderReviewList('simpleCritical',review.improve||review.critical,'!');

  const strengthCard=$('simpleStrengthSignal');
  if(strengthCard){
    const strengthTitle=strength?.title||'No verified strength yet';
    strengthCard.querySelector('strong').textContent=strengthTitle;
    strengthCard.querySelector('small').textContent=strength?.verified===false
      ?'OP CLIMB will not invent praise when the evidence is weak.'
      :'Measured good play worth keeping.';
    strengthCard.classList.toggle('muted-signal',!strength||strength?.verified===false);
  }

  const repCard=$('simpleRepSignal');
  if(repCard){
    const title=learning?.status==='MASTERED'?'MASTERED ✓':learning?.status==='REP_BANKED'?'PROVEN ✓':learning?.status==='REP_MISSED'?'MISSED':learning?.status==='NOT_OBSERVED'?'NOT OBSERVED':'EVIDENCE UPDATED';
    repCard.querySelector('strong').textContent=baselineReady?title:`${Math.min(baselineGames,baselineRequired)}/${baselineRequired} BASELINE`;
    repCard.querySelector('small').textContent=!baselineReady
      ?`${Math.max(0,baselineRequired-baselineGames)} baseline game${Math.max(0,baselineRequired-baselineGames)===1?'':'s'} left before the DNA reveal.`
      :learning
        ?`${learning.confirmed}/${learning.required} proven games · ${learning.dnaDomain||'DNA'} · ${String(learning.evidenceState||'NOT_OBSERVED').replace('_',' ')}`
        :'No mission was proven from this game.';
  }

  const dnaCard=$('simpleDnaSignal');
  if(dnaCard){
    const progress=learning?Number(learning.progress||0):primary?Number(primary.progress||0):0;
    dnaCard.querySelector('strong').textContent=!baselineReady?'0%':`${Math.max(0,Math.min(100,Math.round(progress)))}%`;
    dnaCard.querySelector('small').textContent=!baselineReady
      ?'DNA stays grey until game 3 is complete.'
      :learning?.status==='REP_BANKED'||learning?.status==='MASTERED'
        ?`${learning.dnaDomain||primary?.dnaDomain||'DNA'} moved from verified learning evidence.`
        :primary
          ?`${primary.dnaDomain||'DNA'} · current mission progress`
          :'DNA will move when a behaviour is actually proven.';
  }

  if(!baselineReady){
    $('simpleNextTitle').textContent=`BASELINE GAME ${Math.min(baselineGames+1,baselineRequired)} OF ${baselineRequired}`;
    $('simpleNextRule').textContent='Play normally. Do not change your game for OP CLIMB yet — give it a real baseline.';
  }else{
    $('simpleNextTitle').textContent=primary?.title||review.nextFocus?.title||'NEXT GAME';
    $('simpleNextRule').textContent=primary?.gameRule||review.nextFocus?.rule||'Keep the current challenge simple and build another clean rep.';
  }

  const progressButton=$('simpleOpenProgress');
  if(progressButton)progressButton.textContent='OPEN MATCH ROOM →';

  syncCoachReviewEvidence();
  window.__opRenderedReviewSessionId=String(review.sessionId||'');
}

function ensureReviewSection(){
  let section=$('simplePostgameReview');
  if(section)return section;
  section=document.createElement('section');
  section.id='simplePostgameReview';
  section.className='card hidden';
  section.style.cssText='margin-top:14px;padding:22px';
  section.innerHTML=`
    <div class="coach-review-head">
      <div><div class="eyebrow" id="simpleReviewTag">POST-GAME</div><h2 id="simpleReviewHeadline">YOUR PROGRESS</h2><p id="simpleReviewMatch"></p></div>
      <div class="pill good">PROGRESS READY</div>
    </div>
    <p class="coach-review-intro">Your game has been measured.</p>
    <div class="coach-review-signals" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:14px 0">
      <article id="simpleStrengthSignal" style="border:1px solid rgba(182,246,107,.2);padding:12px;border-radius:12px"><span class="eyebrow">STRENGTH PROVED</span><strong style="display:block;margin-top:6px"></strong><small style="display:block;margin-top:4px;opacity:.62"></small></article>
      <article id="simpleRepSignal" style="border:1px solid rgba(214,255,47,.18);padding:12px;border-radius:12px"><span class="eyebrow">LEARNING</span><strong style="display:block;margin-top:6px"></strong><small style="display:block;margin-top:4px;opacity:.62"></small></article>
      <article id="simpleDnaSignal" style="border:1px solid rgba(100,169,255,.18);padding:12px;border-radius:12px"><span class="eyebrow">DNA</span><strong style="display:block;margin-top:6px"></strong><small style="display:block;margin-top:4px;opacity:.62"></small></article>
    </div>
    <div class="coach-review-grid">
      <article class="coach-review-card good"><span>WHAT YOU DID WELL</span><div id="simpleGood"></div></article>
      <article class="coach-review-card fix"><span>WHAT TO WORK ON</span><div id="simpleCritical"></div></article>
    </div>
    <article class="coach-review-next"><span>NEXT GAME</span><h3 id="simpleNextTitle"></h3><p id="simpleNextRule"></p></article>
    <div class="coach-review-actions"><button id="simpleOpenProgress" class="primary">SEE MY PROGRESS →</button><button id="simpleReviewEvidence" class="ghost">SHOW THE PROOF</button></div>`;
  $('status').after(section);
  $('simpleReviewEvidence').addEventListener('click',()=>{coachReviewEvidenceOpen=!coachReviewEvidenceOpen;syncCoachReviewEvidence()});
  $('simpleOpenProgress').addEventListener('click',()=>{
    window.opCompanion.openClimbPath('/live');
  });
  return section;
}

function renderReviewList(id,items,mark){
  const root=$(id);if(!root)return;
  root.replaceChildren();
  const cap=1;
  const values=safeArray(items).slice(0,cap);
  const source=values.length?values:[{title:mark==='✓'?'No clear positive signal':'No critical leak confirmed',detail:mark==='✓'?'OP CLIMB will not invent praise when the evidence is weak.':'Keep the same focus and build more evidence.'}];
  source.forEach(item=>{
    const row=document.createElement('div');
    row.style.cssText='display:grid;grid-template-columns:24px minmax(0,1fr);gap:9px;padding:5px 0';
    const icon=document.createElement('b');icon.textContent=mark;icon.style.fontSize='18px';
    const copy=document.createElement('div');
    const title=document.createElement('b');title.textContent=item.title||'Review point';
    copy.appendChild(title);
    if(activeCoachLevel.depth>=3&&item.detail){
      const detail=document.createElement('p');detail.textContent=item.detail;detail.style.cssText='margin:3px 0 0;opacity:.68;font-size:12px;line-height:1.45';copy.appendChild(detail);
    }
    row.append(icon,copy);root.appendChild(row);
  });
}


function syncCoachReviewEvidence(){
  document.body.classList.toggle('op-review-evidence-open',coachReviewEvidenceOpen);
  const button=$('simpleReviewEvidence');
  if(button)button.textContent=coachReviewEvidenceOpen?'HIDE COACH EVIDENCE':'OPEN COACH EVIDENCE';
}

function renderUpdate(next,phase){
  if(next)updateState=next;
  const update=updateState||{status:'IDLE',currentVersion:'—',latestVersion:null,progress:0,error:null};
  const status=String(update.status||'IDLE');
  const version=update.currentVersion?`v${update.currentVersion}`:'Current version';
  const latest=update.latestVersion?`v${update.latestVersion}`:'';
  const busy=['CHAMP_SELECT','RECORDING','UPLOADING'].includes(String(phase||''));
  const copy={
    IDLE:`${version} · Automatic update checks are enabled.`,
    CHECKING:`${version} · Checking for a newer Companion…`,
    CURRENT:`${version} · You're up to date.`,
    AVAILABLE:`${latest||'A new version'} is ready to download.`,
    DOWNLOADING:`Downloading ${latest||'update'} · ${Math.round(Number(update.progress)||0)}%`,
    READY:busy?`${latest||'Update'} downloaded. Finish the current League session before restarting.`:`${latest||'Update'} downloaded and ready.`,
    INSTALLING:'Closing the Companion and installing the new version…',
    ERROR:update.error||'The update check failed. Your current Companion will keep working.',
  }[status]||`${version} · Automatic update checks are enabled.`;

  $('updateCopy').textContent=copy;
  $('updateVersion').textContent=version;
  if($('companionVersionBadge'))$('companionVersionBadge').textContent=version;
  setHidden($('checkUpdate'),!['IDLE','CURRENT','ERROR'].includes(status));
  setHidden($('downloadUpdate'),status!=='AVAILABLE');
  setHidden($('installUpdate'),status!=='READY');
  $('checkUpdate').disabled=status==='CHECKING';
  $('downloadUpdate').disabled=status==='DOWNLOADING';
  $('installUpdate').disabled=busy;
  $('installUpdate').textContent=busy?'FINISH GAME TO UPDATE':'RESTART & UPDATE';
  setHidden($('updateProgress'),status!=='DOWNLOADING');
  $('updateProgressBar').style.width=`${clamp(Number(update.progress)||0,0,100)}%`;
  syncSettingsVisibility();
}

function bind(id,event,handler){const node=$(id);if(node)node.addEventListener(event,handler)}

async function boot(){
  const [appState,updater]=await Promise.all([
    window.opCompanion.getState(),
    window.opCompanion.getUpdateState().catch(()=>null),
  ]);
  updateState=updater;
  render(appState);
  renderUpdate(updateState,appState?.phase);
  window.opCompanion.onState(next=>{
    if(String(current?.phase||'')!=='CHAMP_SELECT'&&String(next?.phase||'')==='CHAMP_SELECT')pregameExpanded=false;
    render(next);
  });
  window.opCompanion.onUpdateState(next=>{updateState=next;renderUpdate(next,current?.phase)});
}

bind('openSetup','click',()=>window.opCompanion.openClimb());
bind('openClimb','click',()=>window.opCompanion.openClimb());
bind('restart','click',()=>window.opCompanion.restart());
bind('unpair','click',async()=>{if(confirm('Unpair this PC from OP CLIMB? You can reconnect it from the Live Companion page.'))await window.opCompanion.unpair()});
bind('autoStart','click',async()=>{await window.opCompanion.setAutoStart(!current?.autoStart)});
bind('checkUpdate','click',()=>window.opCompanion.checkUpdate());
bind('downloadUpdate','click',()=>window.opCompanion.downloadUpdate());
bind('installUpdate','click',async()=>{const result=await window.opCompanion.installUpdate(current?.phase||'');if(result&&!result.ok&&result.error)$('updateCopy').textContent=result.error});
bind('showLogs','click',()=>{diagnosticsOpen=!diagnosticsOpen;setHidden($('logs'),!diagnosticsOpen);$('showLogs').textContent=diagnosticsOpen?'HIDE DIAGNOSTICS':'DIAGNOSTICS'});
bind('headerUpdates','click',()=>{settingsOpen=!settingsOpen;syncSettingsVisibility();if(settingsOpen)$('settings')?.scrollIntoView({behavior:'smooth',block:'start'})});

boot();