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
  const games=Math.max(0,Number(baseline.games||0));
  const required=Math.max(1,Number(baseline.required||3));

  $('playerHomeName').textContent=[player.gameName,player.tagline?'#'+player.tagline:''].filter(Boolean).join(' ');
  $('playerHomeRank').textContent=[player.rank,player.role].filter(Boolean).join(' · ')||'PLAYER PROFILE';
  $('playerHomeTier').textContent=tier;
  $('playerHomeView').textContent=String(home.tierView?.label||'PLAYER OVERVIEW');
  $('playerHomeViewCopy').textContent=baselineReady
    ?String(home.tierView?.detail||'Your current development view.')
    :`DNA baseline ${Math.min(games,required)}/${required} · your strands stay at 0% until game ${required}.`;

  const dnaRoot=$('playerHomeDna');
  dnaRoot.replaceChildren();
  safeArray(home.dna).forEach(item=>{
    const row=document.createElement('div');
    row.className='player-dna-row'+(!baselineReady?' baseline':'');
    row.style.setProperty('--dna-color',baselineReady?String(item.color||'#7d8a8f'):'#677378');

    const label=document.createElement('div');
    label.className='player-dna-label';
    const dot=document.createElement('i');
    const name=document.createElement('span');name.textContent=String(item.label||item.domain||'DNA');
    label.append(dot,name);

    const track=document.createElement('div');track.className='player-dna-track';
    const fill=document.createElement('i');fill.style.width=(baselineReady?clamp(Number(item.progress)||0,0,100):0)+'%';track.appendChild(fill);

    const value=document.createElement('b');value.textContent=(baselineReady?clamp(Number(item.progress)||0,0,100):0)+'%';

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
      const label=document.createElement('span');label.textContent=(String(dna?.label||mission.domain||'DNA')+' MISSION').toUpperCase();
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
    memory.innerHTML=`<span>PRO PLAYER MEMORY</span><strong>${Number(home.masteredCount)||0} MASTERED HABIT${Number(home.masteredCount)===1?'':'S'}</strong><small>Long-term learning memory is active. OP CLIMB can carry proven habits across games and choose what to learn next.</small>`;
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
        <div class="player-panel-head"><div><span>YOUR GAME DNA</span><h3>Your player shape.</h3></div><button id="playerHomeOpenClimb" type="button">OPEN MY CLIMB ↗</button></div>
        <div id="playerHomeDna" class="player-dna-tree"></div>
      </section>
      <section class="player-missions-panel">
        <div class="player-panel-head"><div><span>DNA MISSIONS</span><h3>One mission for every strand.</h3></div></div>
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
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
      <div><div class="eyebrow" id="simplePregameTier">COACH</div><h2 id="simplePregameTitle" style="font-size:clamp(28px,5vw,44px);margin:6px 0 8px;letter-spacing:-.04em"></h2><p id="simplePregameSummary" style="margin:0;opacity:.72;line-height:1.5;max-width:720px"></p></div>
      <span id="simplePregamePill" class="pill good">GAME PLAN</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:18px">
      <article style="border:1px solid rgba(214,255,47,.24);border-radius:16px;padding:17px"><div class="eyebrow">YOUR JOB</div><strong id="simplePregameJob" style="display:block;font-size:18px;line-height:1.35;margin-top:7px"></strong></article>
      <article style="border:1px solid rgba(67,140,255,.24);border-radius:16px;padding:17px"><div class="eyebrow">SIMPLE PLAN</div><strong id="simplePregameLead" style="display:block;font-size:18px;line-height:1.35;margin-top:7px"></strong></article>
    </div>
    <div style="margin-top:14px;border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:17px"><div class="eyebrow">REMEMBER THIS</div><div id="simplePregameRules" style="display:grid;gap:9px;margin-top:10px"></div></div>
    <div id="simplePregameExtra" class="hidden" style="margin-top:12px;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:16px;background:rgba(255,255,255,.02)"><div class="eyebrow">MORE DETAIL FOR YOUR LEVEL</div><div id="simplePregameExtraList" style="display:grid;gap:9px;margin-top:10px"></div></div>
    <div style="display:flex;gap:9px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px"><button id="simplePregameMore" class="ghost">MORE DETAIL</button><button id="simplePregameFull" class="ghost">OPEN FULL ANALYSIS</button></div>`;
  const ready=$('matchupReady');
  box.insertBefore(section,ready||null);
  $('simplePregameMore').addEventListener('click',()=>{pregameExpanded=!pregameExpanded;syncPregameExtra()});
  $('simplePregameFull').addEventListener('click',()=>window.opCompanion.openClimb());
  return section;
}

function renderSimpleRules(rules){
  const root=$('simplePregameRules');
  if(!root)return;
  root.replaceChildren();
  const values=rules.length?rules:['Play the simple plan and avoid forcing the first bad fight.'];
  values.forEach((rule,index)=>{
    const row=document.createElement('div');
    row.style.cssText='display:grid;grid-template-columns:28px minmax(0,1fr);gap:9px;align-items:start';
    const n=document.createElement('b');n.textContent=String(index+1).padStart(2,'0');n.style.opacity='.55';
    const text=document.createElement('strong');text.textContent=String(rule);text.style.lineHeight='1.4';
    row.append(n,text);root.appendChild(row);
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
        ?'PROVEN REP BANKED ✓'
        :'YOUR PROGRESS IS READY';

  const intro=section.querySelector('.coach-review-intro');
  if(intro)intro.textContent=!baselineReady
    ?`Game ${Math.min(baselineGames,baselineRequired)} of ${baselineRequired} is recorded. No personalised challenge yet — OP CLIMB is still building your starting DNA.`
    :learning?.status==='REP_BANKED'
      ?`That game counted toward “${learning.title}”. You now have ${learning.confirmed}/${learning.required} proven reps.`
      :learning?.status==='MASTERED'
        ?`You proved “${learning.title}” enough times for it to move into mastery.`
        :'The game is measured. See what held, what needs work and what your next challenge is.';

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
    const title=learning?.status==='MASTERED'?'MASTERED ✓':learning?.status==='REP_BANKED'?'REP BANKED ✓':learning?.status==='NO_REP'?'KEEP WORKING':'EVIDENCE UPDATED';
    repCard.querySelector('strong').textContent=baselineReady?title:`${Math.min(baselineGames,baselineRequired)}/${baselineRequired} BASELINE`;
    repCard.querySelector('small').textContent=!baselineReady
      ?`${Math.max(0,baselineRequired-baselineGames)} baseline game${Math.max(0,baselineRequired-baselineGames)===1?'':'s'} left before challenges unlock.`
      :learning
        ?`${learning.confirmed}/${learning.required} proven reps · ${learning.dnaDomain||'DNA'}`
        :'No mission rep was scored from this game.';
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
          ?`${primary.dnaDomain||'DNA'} · current challenge progress`
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
  if(progressButton)progressButton.textContent=baselineReady?'SEE MY PROGRESS →':'SEE BASELINE →';

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
    const path=String(current?.postGameReview?.progressPath||'/ilp');
    window.opCompanion.openClimbPath(path);
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