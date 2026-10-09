const $=id=>document.getElementById(id);
let current=null;
let updateState=null;
let diagnosticsOpen=false;
let coachReviewEvidenceOpen=false;
let activeCoachLevel={tier:null,depth:3,visiblePoints:3,reviewPoints:2,summary:'Core coaching with a little more context.'};

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

function setCoachLevel(level,state){
  if(level&&Number(level.depth)){
    activeCoachLevel={
      ...activeCoachLevel,
      ...level,
      depth:clamp(Number(level.depth)||3,1,10),
      visiblePoints:clamp(Number(level.visiblePoints)||3,1,5),
      reviewPoints:clamp(Number(level.reviewPoints)||2,1,3),
    };
  }
}

function render(state){
  current=state||{};
  const paired=Boolean(current.paired);
  const phase=String(current.phase||'WAITING');
  const tft=current.tftRecorder||{};
  const tftBusy=['INITIALIZING','RECORDING','PROCESSING','READY'].includes(String(tft.state||''));
  const tftHomeVisible=paired&&tftBusy&&!['CHAMP_SELECT','RECORDING','UPLOADING','REVIEW'].includes(phase);
  renderTftHome(current,tftHomeVisible);
  renderTftPrep(paired&&phase==='WAITING'&&!tftHomeVisible);
  // Do not retain a previous League rank calibration on the TFT/home screens.
  const coach=['CHAMP_SELECT','RECORDING','REVIEW'].includes(phase)
    ?(current.postGameReview?.coachLevel||current.teamPlan?.coachLevel)
    :null;
  if(!coach)activeCoachLevel={tier:null,depth:3,visiblePoints:3,reviewPoints:2,summary:'Core coaching with a little more context.'};
  setCoachLevel(coach,current);

  document.body.classList.toggle('op-mode-match-room',phase==='CHAMP_SELECT');
  document.body.classList.toggle('op-mode-quiet',phase==='RECORDING'||tft.state==='RECORDING');
  document.body.classList.toggle('op-mode-coach-review',phase==='REVIEW');
  if(phase!=='REVIEW'){
    coachReviewEvidenceOpen=false;
    document.body.classList.remove('op-review-evidence-open');
  }

  setHidden($('setup'),paired);
  // Home, My Game DNA, Champion Select and Match Preparation are native views
  // (home-view.js, draft-view.js) driven by the shell.
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
  const homeVisible=phase==='WAITING'&&!tftHomeVisible&&Boolean(current.playerHome?.ok);
  setHidden($('status'),tftHomeVisible||homeVisible||pregameVisible||quietVisible||reviewVisible);

  const tftOwnsStatus=tftBusy&&!['CHAMP_SELECT','REVIEW'].includes(phase);
  const tftTitle=tft.state==='RECORDING'?'Tracking TFT':tft.state==='PROCESSING'?'Building TFT review':tft.state==='READY'?'TFT review ready':'Preparing TFT recorder';
  const tftCopy=tft.detail||'The OP CLIMB Companion records quietly and coaches only after the TFT game.';
  $('statusTitle').textContent=tftOwnsStatus?tftTitle:phaseTitle(phase);
  $('statusCopy').textContent=tftOwnsStatus?tftCopy:phaseCopy(current);
  $('trackerState').textContent=current.trackerRunning?'Running':'Stopped';
  if($('tftRecorderState'))$('tftRecorderState').textContent=tft.state==='RECORDING'?'Recording':tft.state==='READY'?'Review ready':tft.state==='PROCESSING'?'Reviewing':tft.state==='INITIALIZING'?'Preparing':tft.state==='ERROR'?'Needs attention':tft.available?'Armed':'Unavailable';
  const visibleMode=tftOwnsStatus?(tft.state==='READY'?'TFT Review Ready':tft.state==='PROCESSING'?'TFT Reviewing':tft.state==='RECORDING'?'TFT Recording':'TFT Preparing'):modeLabel(phase);
  $('modeState').textContent=visibleMode;
  $('statusPill').textContent=visibleMode.toUpperCase();
  $('statusPill').classList.toggle('good',tftOwnsStatus||['WAITING','CHAMP_SELECT','RECORDING','UPLOADING','REVIEW'].includes(phase));
  $('statusPill').classList.toggle('bad',['AUTH_ERROR','ERROR','RESTARTING'].includes(phase));
  $('autoStart').classList.toggle('on',Boolean(current.autoStart));
  if($('overlayToggle')){
    $('overlayToggle').classList.toggle('on',Boolean(current.overlay?.enabled));
    $('overlayToggle').setAttribute('aria-pressed',String(Boolean(current.overlay?.enabled)));
  }
  if($('overlayEdit'))$('overlayEdit').disabled=!current.overlay?.enabled;
  if($('overlayModeCycle'))$('overlayModeCycle').disabled=!current.overlay?.enabled;
  if($('overlayModeLabel')){
    const mode=String(current.overlay?.layout?.mode||'FOCUS').toUpperCase();
    $('overlayModeLabel').textContent=({FOCUS:'FOCUS · balanced mission + win condition',MINIMAL:'MINIMAL · compact mission only',EXPANDED:'EXPANDED · complete pre-game contract'})[mode]||'FOCUS · balanced mission + win condition';
  }

  const statusBottom=document.querySelector('.status-bottom');
  if(statusBottom)statusBottom.style.display=['AUTH_ERROR','ERROR','RESTARTING'].includes(phase)?'flex':'none';

  const rows=safeArray(current.logs);
  $('logs').textContent=rows.length?rows.map(row=>`[${new Date(row.at).toLocaleTimeString()}] ${row.line}`).join('\n'):'No tracker activity yet.';

  syncSettingsVisibility();
}


const tftCoach=window.OP_TFT_COACH_MODEL;
let tftChosenFocus=(()=>{try{return tftCoach.normalize(localStorage.getItem(tftCoach.STORAGE_KEY))}catch{return'ECONOMY'}})();
let tftFrozenFocus=null;
let tftLastRecording=false;
let tftGuideId='ECONOMY';

function renderTftPrep(visible){
  const section=ensureTftPrep();
  setHidden(section,!visible);
  if(!visible)return;
  const focus=tftCoach.mission(tftChosenFocus);
  section.querySelector('#tftPrepTitle').textContent=focus.title;
  section.querySelector('#tftPrepRule').textContent=focus.rule;
  section.querySelectorAll('[data-tft-focus]').forEach(button=>{
    const selected=button.dataset.tftFocus===focus.id;
    button.setAttribute('aria-pressed',String(selected));
    button.querySelector('small').textContent=selected?'SELECTED':'CHOOSE FOCUS';
  });
}

function ensureTftPrep(){
  let section=$('tftPrep');
  if(section)return section;
  section=document.createElement('section');section.id='tftPrep';section.className='card tft-coach-prep hidden';
  section.innerHTML='<div class="tft-coach-head"><div class="tft-coach-kicker">OP CLIMB / TFT / BEFORE QUEUE</div><span class="tft-coach-badge">LEARNING MODE</span></div>'+
    '<h2>ONE FOCUS. ONE MATCH.</h2><p class="tft-coach-intro">Choose a lesson before queueing. It stays fixed while you play.</p>'+
    '<div class="tft-coach-picks" id="tftPrepPicks" aria-label="TFT learning focus"></div>'+
    '<div class="tft-coach-prep-preview"><div><span>YOUR NEXT MATCH MISSION</span><strong id="tftPrepTitle">ECONOMY DISCIPLINE</strong><p id="tftPrepRule"></p></div><button class="primary" id="tftPrepGamePlan" type="button">TFT GAME PLAN ↗</button></div>';
  const picks=section.querySelector('#tftPrepPicks');
  tftCoach.MISSIONS.forEach(focus=>{
    const button=document.createElement('button');
    button.type='button';button.className='tft-coach-pick';button.dataset.tftFocus=focus.id;
    const label=document.createElement('strong');label.textContent=focus.label;
    const small=document.createElement('small');small.textContent='CHOOSE FOCUS';
    button.append(label,small);
    button.addEventListener('click',()=>{
      tftChosenFocus=focus.id;
      try{localStorage.setItem(tftCoach.STORAGE_KEY,focus.id)}catch{}
      void window.opCompanion.setTftFocus(focus.id);
      renderTftPrep(true);
    });
    picks.appendChild(button);
  });
  section.querySelector('#tftPrepGamePlan').addEventListener('click',()=>window.opCompanion.openClimbPath('/tft/game-plan'));
  $('status').after(section);
  return section;
}

function renderTftGuide(){
  const box=$('tftCoachGuideNotes');
  if(!box)return;
  const guide=tftCoach.guide(tftGuideId);
  box.replaceChildren();
  guide.notes.forEach(note=>{
    const row=document.createElement('article');
    const name=document.createElement('b');name.textContent=note[0];
    const copy=document.createElement('span');copy.textContent=note[1];
    row.append(name,copy);box.appendChild(row);
  });
  $('tftHome').querySelectorAll('[data-tft-guide]').forEach(button=>{
    button.setAttribute('aria-pressed',String(button.dataset.tftGuide===guide.id));
  });
}

function renderTftHome(state,visible){
  const section=ensureTftHome();
  setHidden(section,!visible);
  if(!visible)return;
  const tft=state?.tftRecorder||{};
  const status=String(tft.state||'STARTING').toUpperCase();
  if(status==='RECORDING'&&!tftLastRecording){
    tftFrozenFocus=tftChosenFocus;
    section.querySelector('#tftCoachGuides').open=false;
  }
  if(status==='RECORDING')tftLastRecording=true;
  if(status==='ARMED'||status==='READY'||status==='STOPPED')tftLastRecording=false;
  const focus=tftCoach.mission(tftFrozenFocus||tftChosenFocus);
  section.querySelector('#tftHomeTitle').textContent=focus.title;
  section.querySelector('#tftHomeRule').textContent=focus.rule;
  section.querySelector('#tftHomeCueOne').textContent=focus.cues[0];
  section.querySelector('#tftHomeCueTwo').textContent=focus.cues[1];
  const recordText=status==='RECORDING'?'RECORDING':status==='PROCESSING'?'PROCESSING':status==='READY'?'REVIEW READY':'PREPARING';
  section.querySelector('#tftHomeStatus').textContent=recordText;
  section.querySelector('#tftHomePhase').textContent=status==='RECORDING'?'CAPTURING':status==='PROCESSING'?'BUILDING REVIEW':status==='READY'?'COMPLETE':'WAITING';
  section.querySelector('#tftHomeRound').textContent=tft.round&&tft.round!=='0-0'?tft.round:'—';
  section.querySelector('#tftHomeStageNote').textContent=status==='RECORDING'?'LESSON LOCKED':'POST-GAME LEARNING';
  section.querySelector('#tftHomeReviewNote').textContent=status==='READY'?'Your recorded decisions are ready to review.':status==='PROCESSING'?'Building evidence from the finished game.':'Live play is for learning. Evaluation happens after the game.';
  section.querySelector('#tftHomeOpen').textContent=status==='READY'?'OPEN MY TFT REVIEW ↗':'TFT LEARNING HUB ↗';
}

function ensureTftHome(){
  let section=$('tftHome');
  if(section)return section;
  section=document.createElement('section');section.id='tftHome';section.className='card tft-coach-live hidden';
  section.innerHTML='<div class="tft-coach-head"><div class="tft-coach-kicker">OP CLIMB / TFT / YOUR LEARNING HUD</div><span id="tftHomeStatus" class="tft-coach-badge">PREPARING</span></div>'+
    '<article class="tft-coach-mission"><span class="tft-coach-overline">PRE-GAME MISSION / LOCKED FOR THIS MATCH</span><h2 id="tftHomeTitle">ECONOMY DISCIPLINE</h2><strong id="tftHomeRule">Make every spend part of a plan.</strong>'+
    '<div class="tft-coach-cues"><span id="tftHomeCueOne"></span><span id="tftHomeCueTwo"></span></div></article>'+
    '<div class="tft-coach-mini"><div><span>RECORDER</span><strong id="tftHomePhase">CAPTURING</strong></div><div><span>STAGE READ</span><strong id="tftHomeRound">—</strong></div><div><span>COACH MODE</span><strong id="tftHomeStageNote">LESSON LOCKED</strong></div></div>'+
    '<details id="tftCoachGuides" class="tft-coach-guides"><summary>QUICK LEARNING GUIDES <span>STATIC REFERENCE / OPTIONAL</span></summary>'+
    '<div class="tft-coach-guide-body"><div class="tft-coach-guide-tabs" id="tftCoachGuideTabs" aria-label="TFT topic"></div><div id="tftCoachGuideNotes" class="tft-coach-guide-list"></div></div></details>'+
    '<div class="tft-coach-end"><small id="tftHomeReviewNote">The match is recorded quietly. Coaching review comes after.</small><button class="primary" type="button" id="tftHomeOpen">TFT LEARNING HUB ↗</button></div>';
  const tabs=section.querySelector('#tftCoachGuideTabs');
  tftCoach.GUIDES.forEach(guide=>{
    const button=document.createElement('button');button.type='button';
    button.dataset.tftGuide=guide.id;button.textContent=guide.label;
    button.addEventListener('click',()=>{tftGuideId=guide.id;renderTftGuide()});
    tabs.appendChild(button);
  });
  $('status').after(section);
  section.querySelector('#tftHomeOpen').addEventListener('click',()=>window.opCompanion.openClimbPath('/tft/timeline'));
  renderTftGuide();
  return section;
}

// Settings is its own route in the shell; it only needs a paired PC.
function syncSettingsVisibility(){
  setHidden($('settings'),!current?.paired);
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
  if(appState?.tftFocus&&appState?.tftRecorder?.state!=='RECORDING'){
    tftChosenFocus=tftCoach.normalize(appState.tftFocus);
    try{localStorage.setItem(tftCoach.STORAGE_KEY,tftChosenFocus)}catch{}
  }
  render(appState);
  renderUpdate(updateState,appState?.phase);
  window.opCompanion.onState(render);
  window.opCompanion.onUpdateState(next=>{updateState=next;renderUpdate(next,current?.phase)});
}

bind('openSetup','click',()=>window.opCompanion.openClimb());
bind('openClimb','click',()=>window.opCompanion.openClimb());
bind('restart','click',()=>window.opCompanion.restart());
bind('unpair','click',async()=>{if(confirm('Unpair this PC from OP CLIMB? You can reconnect it from the Live Companion page.'))await window.opCompanion.unpair()});
bind('autoStart','click',async()=>{await window.opCompanion.setAutoStart(!current?.autoStart)});
bind('overlayToggle','click',async()=>{await window.opCompanion.setOverlayEnabled(!current?.overlay?.enabled)});
bind('overlayEdit','click',()=>window.opCompanion.editOverlay());
bind('overlayModeCycle','click',()=>window.opCompanion.cycleOverlay());
bind('checkUpdate','click',()=>window.opCompanion.checkUpdate());
bind('downloadUpdate','click',()=>window.opCompanion.downloadUpdate());
bind('installUpdate','click',async()=>{const result=await window.opCompanion.installUpdate(current?.phase||'');if(result&&!result.ok&&result.error)$('updateCopy').textContent=result.error});
bind('showLogs','click',()=>{diagnosticsOpen=!diagnosticsOpen;setHidden($('logs'),!diagnosticsOpen);$('showLogs').textContent=diagnosticsOpen?'HIDE DIAGNOSTICS':'DIAGNOSTICS'});

boot();
