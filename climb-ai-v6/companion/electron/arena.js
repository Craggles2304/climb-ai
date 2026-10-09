(()=>{
  // broadcast-v2.css and brand-sync.css are linked in index.html, after the
  // other legacy styles and before the new design system; review-v2.js loads there too.
  const $=id=>document.getElementById(id);
  function cleanText(value){return String(value||'').replace(/\s+/g,' ').trim()}

  function ensureIdleArena(){
    let root=$('idleArena');if(root)return root;
    root=document.createElement('section');root.id='idleArena';root.className='broadcast-idle hidden';
    root.innerHTML=`
      <i class="idle-corner tl"></i><i class="idle-corner tr"></i><i class="idle-corner bl"></i><i class="idle-corner br"></i>
      <div class="idle-topline"><i></i><span>OP CLIMB MATCH INTELLIGENCE</span><b id="idleSignal">SYSTEM ARMED</b></div>
      <div class="idle-controls"><button id="idleOpenClimb" type="button">OPEN OP CLIMB</button><button id="idleSettings" type="button">SYSTEM SETTINGS</button></div>
      <div class="idle-stage">
        <div class="idle-radar"><span class="ring r1"></span><span class="ring r2"></span><span class="ring r3"></span><span class="cross-x"></span><span class="cross-y"></span><span class="scan"></span><span class="idle-core"></span></div>
        <div id="idleKicker" class="idle-kicker">QUEUE STATE // STANDBY</div>
        <h1 id="idleTitle">QUEUE UP. LOCK IN. CLIMB.</h1>
        <p id="idleCopy">Champ select detection is armed. Lock your champion and the analyst desk will take over with your power spikes, lane win condition, 2v2 plan and teamfight job.</p>
        <div class="idle-next"><span>NEXT SIGNAL</span><b id="idleNext">CHAMP SELECT → CHAMPION LOCK</b></div>
      </div>
      <div class="idle-system-grid">
        <div class="idle-system good"><span>PC LINK</span><strong id="idlePc">SECURE / CONNECTED</strong><div class="microbar"><i></i></div></div>
        <div class="idle-system good"><span>TRACKER</span><strong id="idleTracker">RUNNING</strong><div class="microbar"><i></i></div></div>
        <div class="idle-system wait"><span>RIOT CLIENT</span><strong id="idleRiot">WAITING FOR LEAGUE</strong><div class="microbar"><i></i></div></div>
        <div class="idle-system good"><span>COACHING PIPELINE</span><strong id="idleCoach">READY</strong><div class="microbar"><i></i></div></div>
      </div>`;
    const status=$('status');status?.insertAdjacentElement('afterend',root);
    $('idleOpenClimb')?.addEventListener('click',()=>window.opCompanion?.openClimb?.());
    $('idleSettings')?.addEventListener('click',()=>window.ocShell?.go('settings'));
    return root;
  }

  function renderIdle(state){
    const root=ensureIdleArena();
    const phase=String(state?.phase||'WAITING');
    const readyMatch=Boolean(state?.matchup&&['LOADING','READY','ERROR'].includes(state.matchup.status));
    const show=Boolean(state?.paired&&!readyMatch&&phase!=='WAITING');
    root.classList.toggle('hidden',!show);
    if(!show)return;
    const presets={
      WAITING:{signal:'SYSTEM ARMED',kicker:'QUEUE STATE // STANDBY',title:'QUEUE UP. LOCK IN. CLIMB.',copy:'Champ select detection is armed. Lock your champion and the analyst desk will take over with your power spikes, lane win condition, 2v2 plan and teamfight job.',next:'CHAMP SELECT → CHAMPION LOCK',riot:'WAITING FOR LEAGUE'},
      CHAMP_SELECT:{signal:'DRAFT SIGNAL ACQUIRED',kicker:'CHAMP SELECT // LIVE',title:'LOCK YOUR CHAMPION.',copy:'Draft is detected. As soon as your champion locks, OP CLIMB deploys your personal power curve first, then enriches it as the enemy lane and full composition resolve.',next:'YOUR LOCK-IN → PREGAME BRIEFING',riot:'CHAMP SELECT LIVE'},
      RECORDING:{signal:'MATCH FEED LIVE',kicker:'GAME STATE // CAPTURE',title:'MATCH TELEMETRY ACTIVE.',copy:'Your game is being captured quietly. The pregame calls remain static while the post-game engine records the evidence it needs to build your review.',next:'GAME END → POST-GAME REVIEW',riot:'IN GAME'},
      UPLOADING:{signal:'ANALYSIS PIPELINE',kicker:'POST GAME // PROCESSING',title:'BUILDING YOUR REVIEW.',copy:'The match is complete. OP CLIMB is converting the recorded evidence into your OP Grade, repeated decision leak and next Fix Ladder.',next:'REVIEW READY → OP CLIMB',riot:'MATCH COMPLETE'},
      RESTARTING:{signal:'TRACKER RECOVERY',kicker:'SYSTEM // RECOVERING',title:'RECONNECTING TRACKER.',copy:'The Companion is restoring its League connection automatically. Your PC pairing remains intact.',next:'TRACKER ONLINE → STANDBY',riot:'RECONNECTING'},
      AUTH_ERROR:{signal:'PAIRING REQUIRED',kicker:'SYSTEM // ACCESS',title:'RE-PAIR THIS PC.',copy:'The secure pairing token needs refreshing before live match intelligence can resume.',next:'OPEN OP CLIMB → PAIR PC',riot:'AUTH REQUIRED'},
      ERROR:{signal:'SYSTEM CHECK',kicker:'SYSTEM // ATTENTION',title:'TRACKER NEEDS ATTENTION.',copy:cleanText(state?.detail)||'Open diagnostics or restart the tracker to restore match intelligence.',next:'DIAGNOSTICS → RESTART',riot:'CHECK REQUIRED'},
      STARTING:{signal:'BOOT SEQUENCE',kicker:'SYSTEM // INITIALISING',title:'MATCH INTELLIGENCE BOOTING.',copy:'Loading the tracker, secure pairing and updater services.',next:'SYSTEM ONLINE → STANDBY',riot:'STARTING'}
    };
    const p=presets[phase]||presets.WAITING;
    $('idleSignal').textContent=p.signal;$('idleKicker').textContent=p.kicker;$('idleTitle').textContent=p.title;$('idleCopy').textContent=p.copy;$('idleNext').textContent=p.next;$('idleRiot').textContent=p.riot;
    $('idlePc').textContent=state?.paired?'SECURE / CONNECTED':'PAIRING REQUIRED';
    $('idleTracker').textContent=state?.trackerRunning?'RUNNING':'OFFLINE';
    $('idleCoach').textContent=phase==='UPLOADING'?'ANALYSING':'READY';
    root.dataset.phase=phase.toLowerCase();
  }

  // The idle stage covers phases with no other screen (starting, errors, building a review).
  function schedule(state){requestAnimationFrame(()=>renderIdle(state))}
  ensureIdleArena();
  window.opCompanion?.getState?.().then(schedule).catch(()=>{});
  window.opCompanion?.onState?.(schedule);
})();
