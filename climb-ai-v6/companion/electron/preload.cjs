const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('opCompanion',{
  getState:()=>ipcRenderer.invoke('companion:get-state'),
  setDnaRole:(role)=>ipcRenderer.invoke('companion:set-dna-role',role),
  setOverlayEnabled:(enabled)=>ipcRenderer.invoke('companion:overlay-enabled',enabled),
  editOverlay:()=>ipcRenderer.invoke('companion:overlay-edit'),
  setTftFocus:(id)=>ipcRenderer.invoke('companion:set-tft-focus',id),
  unpair:()=>ipcRenderer.invoke('companion:unpair'),
  restart:()=>ipcRenderer.invoke('companion:restart'),
  setAutoStart:(enabled)=>ipcRenderer.invoke('companion:auto-start',enabled),
  openClimb:()=>ipcRenderer.invoke('companion:open-climb'),
  openClimbPath:(path)=>ipcRenderer.invoke('companion:open-climb-path',path),
  getUpdateState:()=>ipcRenderer.invoke('companion:update-state'),
  checkUpdate:()=>ipcRenderer.invoke('companion:check-update'),
  downloadUpdate:()=>ipcRenderer.invoke('companion:download-update'),
  installUpdate:(phase)=>ipcRenderer.invoke('companion:install-update',phase),
  simulateBotLane:(context)=>ipcRenderer.invoke('companion:botlane-sim',context),
  draftCoach:(context)=>ipcRenderer.invoke('companion:draft-coach',context),
  answerIntentProbe:(context)=>ipcRenderer.invoke('companion:intent-probe',context),
  recordReadCheckpoint:(context)=>ipcRenderer.invoke('companion:read-checkpoint',context),
  markMoment:()=>ipcRenderer.invoke('companion:mark-moment'),
  getChampionRoster:()=>ipcRenderer.invoke('companion:champion-roster'),
  getChampionGuide:(selection)=>ipcRenderer.invoke('companion:champion-guide',selection),
  onState:(handler)=>{const listener=(_event,state)=>handler(state);ipcRenderer.on('companion:state',listener);return()=>ipcRenderer.removeListener('companion:state',listener)},
  onUpdateState:(handler)=>{const listener=(_event,state)=>handler(state);ipcRenderer.on('companion:update-state',listener);return()=>ipcRenderer.removeListener('companion:update-state',listener)}
});

let dismissedRankKey='';

function installStrategyView(){
  if(document.getElementById('op-strategy-style'))return;
  const style=document.createElement('style');
  style.id='op-strategy-style';
  style.textContent=`
#opMissionReminders{margin-top:12px;padding:18px 20px;border-left:2px solid #d6ff2f;background:linear-gradient(180deg,rgba(12,17,22,.98),rgba(8,12,16,.98))}#opMissionReminders.hidden,.op-paid-lock.hidden,.op-winhero.hidden,.op-danger.hidden,.op-job.hidden,.op-flow.hidden,.op-rolewin.hidden,.op-deep.hidden,.op-build.hidden{display:none!important}#opMissionReminders:not(.hidden)~#matchup{display:none!important}.op-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;margin-bottom:11px}.op-kicker{font-size:8px;letter-spacing:.2em;font-weight:900;color:#7f8a96;text-transform:uppercase}.op-head h3{margin:5px 0 0;font-size:21px;letter-spacing:-.03em;text-transform:uppercase}.op-rank{font-size:8px;letter-spacing:.15em;font-weight:900;color:#d6ff2f;border:1px solid rgba(214,255,47,.2);padding:7px 9px;text-transform:uppercase}.op-draft{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:9px}.op-chip{font-size:8px;letter-spacing:.11em;text-transform:uppercase;border:1px solid rgba(255,255,255,.07);padding:7px 9px;color:#9aa7b2;background:rgba(255,255,255,.018)}.op-chip b{color:#e8eef2}.op-chip.role{border-color:rgba(214,255,47,.24);color:#d6ff2f}.op-paid-lock{border:1px solid rgba(214,255,47,.18);background:rgba(214,255,47,.025);padding:11px 13px;margin-bottom:8px}.op-paid-lock span{display:block;font-size:7px;letter-spacing:.17em;font-weight:900;color:#d6ff2f;text-transform:uppercase}.op-paid-lock strong{display:block;margin-top:5px;font-size:12px;color:#f6f9fa}.op-paid-lock small{display:block;margin-top:4px;font-size:9px;line-height:1.4;color:#7f8a96}.op-winhero{border:1px solid rgba(214,255,47,.28);border-left:3px solid #d6ff2f;background:rgba(214,255,47,.04);padding:14px 15px;margin-bottom:8px}.op-winhero span,.op-job span,.op-danger span,.op-mission span{display:block;font-size:7px;letter-spacing:.17em;font-weight:900;text-transform:uppercase}.op-winhero span,.op-mission span{color:#d6ff2f}.op-winhero strong{display:block;margin-top:6px;font-size:16px;line-height:1.36;color:#f6f9fa}.op-job{border:1px solid rgba(67,140,255,.22);background:rgba(67,140,255,.035);padding:11px 13px;margin-bottom:8px}.op-job span{color:#6fa6ff}.op-job strong{display:block;margin-top:5px;font-size:12px;line-height:1.4;color:#eef3f6}.op-rolewin{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-bottom:8px}.op-role-step{position:relative;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.018);padding:12px 11px 13px;min-height:96px}.op-role-step:before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:#d6ff2f}.op-role-step span{display:block;font-size:7px;letter-spacing:.15em;font-weight:900;color:#7d8993;text-transform:uppercase;margin-bottom:7px}.op-role-step strong{display:block;font-size:11px;line-height:1.35;color:#f4f7f9}.op-flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.op-step{position:relative;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.018);padding:12px 12px 13px;min-height:88px}.op-step:before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:#d6ff2f}.op-step:nth-child(2):before,.op-step:nth-child(3):before{background:#4c91ff}.op-step span{display:block;font-size:7px;letter-spacing:.16em;font-weight:900;color:#6f7d88;text-transform:uppercase;margin-bottom:7px}.op-step strong{display:block;font-size:12px;line-height:1.35;color:#f5f8fa}.op-danger{margin-top:8px;border:1px solid rgba(255,120,120,.18);background:rgba(255,80,80,.025);padding:11px 13px}.op-danger span{color:#ff8c8c}.op-danger strong{display:block;margin-top:5px;font-size:11px;line-height:1.4;color:#eef3f6}.op-deep{margin-top:8px;border:1px solid rgba(67,140,255,.2);background:rgba(67,140,255,.025);padding:0 13px 11px}.op-deep summary{cursor:pointer;padding:11px 0 8px;font-size:8px;letter-spacing:.16em;font-weight:900;color:#6fa6ff;text-transform:uppercase}.op-deep-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.op-deep-card{border:1px solid rgba(255,255,255,.07);padding:10px;background:rgba(255,255,255,.015)}.op-deep-card span{display:block;font-size:7px;letter-spacing:.14em;color:#71808d;text-transform:uppercase;font-weight:900}.op-deep-card strong{display:block;margin-top:5px;font-size:10px;line-height:1.35;color:#eef3f6}.op-deep-rule{margin-top:7px;border-top:1px solid rgba(255,255,255,.06);padding-top:8px;font-size:10px;line-height:1.45;color:#b7c2cb}.op-mission{margin-top:8px;border:1px solid rgba(214,255,47,.18);background:rgba(214,255,47,.025);padding:11px 13px}.op-mission strong{display:block;margin-top:6px;font-size:13px;color:#f6f9fa;line-height:1.35}.op-build{margin-top:8px;border:1px solid rgba(100,169,255,.22);background:linear-gradient(135deg,rgba(100,169,255,.04),rgba(4,8,12,.55));padding:10px 11px}.op-build-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.op-build-head span{font-size:7px;letter-spacing:.16em;font-weight:900;color:#75b3ff;text-transform:uppercase}.op-build-head small{font-size:6px;letter-spacing:.1em;color:#66747e;text-transform:uppercase}.op-build-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:8px}.op-build-card{display:grid;grid-template-columns:30px minmax(0,1fr);gap:8px;align-items:center;border:1px solid rgba(255,255,255,.08);background:rgba(4,8,12,.62);padding:7px 8px;min-width:0}.op-build-card.draft{border-color:rgba(214,255,47,.28)}.op-build-card img{width:30px;height:30px;object-fit:cover;border-radius:2px}.op-build-card span{display:block;font-size:6px;letter-spacing:.12em;color:#71808a;font-weight:900;text-transform:uppercase}.op-build-card strong{display:block;margin-top:3px;font-size:9px;line-height:1.2;color:#edf2f4;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.op-build-read{margin-top:7px;font-size:7px;letter-spacing:.08em;color:#84929c;text-transform:uppercase}.op-foot{margin-top:9px;text-align:center;font-size:7px;letter-spacing:.14em;color:#51606d;text-transform:uppercase}#opLevelUp{position:fixed;z-index:9999;top:22px;left:50%;transform:translateX(-50%);width:min(620px,calc(100vw - 32px));padding:20px 22px;border:1px solid rgba(214,255,47,.45);border-left:3px solid #d6ff2f;background:linear-gradient(145deg,rgba(13,19,24,.985),rgba(7,11,15,.985));box-shadow:0 22px 70px rgba(0,0,0,.48)}#opLevelUp.hidden{display:none!important}.op-level-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.op-level-kicker{font-size:8px;letter-spacing:.22em;font-weight:900;color:#d6ff2f;text-transform:uppercase}.op-level-title{margin:6px 0 6px;font-size:28px;line-height:1;letter-spacing:-.04em;text-transform:uppercase}.op-level-copy{margin:0;color:#aeb8c1;font-size:12px;line-height:1.55;max-width:520px}.op-level-route{display:flex;align-items:center;gap:9px;margin-top:14px;font-size:9px;letter-spacing:.14em;text-transform:uppercase;font-weight:900;color:#dce4ea}.op-level-route b{color:#d6ff2f}.op-level-close{border:0;background:transparent;color:#8995a0;font-size:18px;cursor:pointer;padding:2px 5px}@media(max-width:1080px){.op-rolewin{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:920px){.op-flow{grid-template-columns:repeat(2,minmax(0,1fr));.op-deep-grid{grid-template-columns:1fr}}@media(max-width:620px){.op-rolewin,.op-flow,.op-deep-grid,.op-build-grid{grid-template-columns:1fr}.op-role-step,.op-step{min-height:0}.op-level-title{font-size:23px}}`;
  document.head.appendChild(style);
  const v3=document.createElement('style');
  v3.id='op-strategy-v3-style';
  v3.textContent=`
#opMissionReminders{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:9px;margin-top:12px;padding:18px;border:1px solid rgba(182,246,107,.16);border-left:3px solid #b6f66b;background:radial-gradient(680px 260px at 88% 0,rgba(0,245,212,.055),transparent 68%),linear-gradient(145deg,#0d161a,#081014);box-shadow:0 22px 58px rgba(0,0,0,.22)}
#opMissionReminders>.op-head,#opMissionReminders>.op-draft,#opMissionReminders>.op-team-board,#opMissionReminders>.op-paid-lock,#opMissionReminders>.op-rolewin,#opMissionReminders>.op-flow,#opMissionReminders>.op-deep,#opMissionReminders>.op-build,#opMissionReminders>.op-foot{grid-column:1/-1}
#opMissionReminders>.op-winhero{grid-column:1/-1;margin:0;min-height:78px;padding:15px 18px;border:1px solid rgba(182,246,107,.26);border-left:3px solid #b6f66b;background:radial-gradient(520px 120px at 0 0,rgba(182,246,107,.08),transparent 75%),#0a1216}
#opMissionReminders>.op-job{grid-column:1/7;margin:0;min-height:86px;padding:16px 18px;border:1px solid rgba(46,199,255,.2);border-left:3px solid #2ec7ff;background:radial-gradient(360px 130px at 0 0,rgba(46,199,255,.065),transparent 74%),#0a1216}
#opMissionReminders>.op-danger{margin:0;min-height:86px;padding:14px 15px;border:1px solid rgba(255,61,113,.2);border-left:3px solid #ff3d71;background:radial-gradient(260px 110px at 100% 0,rgba(255,61,113,.07),transparent 72%),#0a1115}
#opMissionReminders>#opPaidLoss{grid-column:7/10}
#opMissionReminders>#opBiggestThrowCard{grid-column:10/-1}
#opMissionReminders>.op-mission{grid-column:1/-1;margin:0;min-height:0;padding:11px 14px;border:1px solid rgba(164,107,255,.22);border-left:3px solid #a46bff;background:rgba(164,107,255,.035)}
.op-head{grid-column:1/-1!important;margin:0;padding-bottom:11px;border-bottom:1px solid rgba(255,255,255,.06);align-items:center}
.op-kicker{color:#b6f66b}.op-head h3{font:800 clamp(28px,4vw,43px)/.95 'Barlow Condensed',sans-serif;letter-spacing:-.035em;color:#f1f6f4}.op-rank{border-color:rgba(182,246,107,.3);background:rgba(182,246,107,.045)}
.op-draft{margin:0;gap:6px}.op-chip{padding:6px 8px;background:#0b1317;border-color:rgba(255,255,255,.07)}.op-chip.role{border-color:rgba(182,246,107,.28)}
.op-team-board{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:9px;align-items:stretch}
.op-team-side{padding:11px;border:1px solid rgba(255,255,255,.065);background:#091115}.op-team-side.ours{border-top:2px solid #2ec7ff}.op-team-side.theirs{border-top:2px solid #ff3d71}
.op-team-label{display:flex;justify-content:space-between;gap:10px;margin-bottom:8px;font:800 7px 'IBM Plex Mono',monospace;letter-spacing:.12em;color:#6f7e83}.op-team-side.ours .op-team-label b{color:#2ec7ff}.op-team-side.theirs .op-team-label b{color:#ff718f}
.op-team-picks{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}.op-team-pick{min-width:0;padding:7px 6px;border:1px solid rgba(255,255,255,.055);background:#0c1519}.op-team-pick span{display:block;color:#64747a;font:700 6px 'IBM Plex Mono',monospace;letter-spacing:.08em}.op-team-pick b{display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e1e9e7;font-size:9px}.op-team-pick.you{border-color:rgba(182,246,107,.3);box-shadow:inset 0 -2px 0 #b6f66b}.op-team-vs{display:grid;place-items:center;color:#b6f66b;font:900 10px 'IBM Plex Mono',monospace}
.op-paid-lock{margin:0;padding:9px 11px}.op-paid-lock strong{font-size:10px}.op-paid-lock small{display:none}
.op-winhero span,.op-job span,.op-danger span,.op-mission span{font:800 7px 'IBM Plex Mono',monospace;letter-spacing:.14em}.op-winhero strong{margin-top:7px;font:800 25px/1.08 'Barlow Condensed',sans-serif;text-transform:uppercase;color:#f2f7f5}.op-job strong{margin-top:7px;font:800 30px/1.02 'Barlow Condensed',sans-serif;text-transform:uppercase;color:#eff5f3}.op-danger strong{font-size:12px;line-height:1.32}.op-danger small{display:block;margin-top:6px;color:#ff8ca3;font:800 7px 'IBM Plex Mono',monospace;letter-spacing:.08em}.op-mission span{color:#b795ff}.op-mission strong{font-size:11px;line-height:1.3}
.op-rolewin{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0}.op-role-step{min-height:78px;padding:13px 14px;border-radius:0}.op-role-step:before{background:linear-gradient(180deg,#b6f66b,#00f5d4)}.op-role-step span{font-size:7px}.op-role-step strong{font-size:13px;line-height:1.28}.op-role-step:not(:last-child):after{content:'→';position:absolute;right:-10px;top:50%;transform:translateY(-50%);z-index:2;color:#b6f66b;font:900 14px 'IBM Plex Mono',monospace}
.op-flow{margin:0}.op-step{border-radius:0}
.op-deep{margin:0;opacity:.78}.op-deep summary{color:#8290a0;padding:9px 0;font-size:7px}.op-deep[open]{opacity:1}.op-deep-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
.op-build{margin:0;padding:12px 13px;border-color:rgba(255,178,30,.2);border-left:3px solid #ffb21e;background:#091115}.op-build-head span{color:#ffb21e;font-size:8px}.op-build-head small{font-size:7px}.op-build-read{margin-top:6px;color:#66747a;font-size:7px;line-height:1.3}.op-build-flex{margin-top:7px;padding:7px 9px;border:1px dashed rgba(255,178,30,.22);color:#d8b56c;font:800 7px/1.35 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase}
.op-build-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.op-build-card{grid-template-columns:38px minmax(0,1fr);padding:8px 9px;min-height:56px}.op-build-card img{width:38px;height:38px}.op-build-card span{font-size:6px}.op-build-card strong{font-size:10px}
.op-foot{margin:0;padding-top:5px}.op-phase-live .op-kicker{color:#ff3d71}.op-phase-live{border-left-color:#ff3d71!important}.op-phase-live .op-rank{border-color:rgba(255,61,113,.28)}.op-phase-live .op-head:after{content:'LIVE · RECORDING';margin-left:auto;padding:6px 8px;border:1px solid rgba(255,61,113,.25);color:#ff718f;font:800 7px 'IBM Plex Mono',monospace;letter-spacing:.11em}
@media(max-width:920px){#opMissionReminders>.op-winhero,#opMissionReminders>.op-job,#opMissionReminders>.op-danger,#opMissionReminders>.op-mission{grid-column:1/-1}.op-team-board{grid-template-columns:1fr}.op-team-vs{min-height:20px}.op-build-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:650px){.op-team-picks,.op-rolewin,.op-build-grid{grid-template-columns:1fr 1fr}.op-deep-grid{grid-template-columns:1fr}.op-head h3{font-size:27px}}
`;
  document.head.appendChild(v3);

  const section=document.createElement('section');
  section.id='opMissionReminders';
  section.className='card hidden';
  section.setAttribute('aria-live','polite');
  section.innerHTML=`
    <div class="op-head">
      <div><div class="op-kicker">MATCH PLAN · LOCKED FROM CHAMP SELECT</div><h3 id="opStrategyHeading">HOW WE WIN THIS GAME</h3></div>
      <span id="opMissionRank" class="op-rank">COACH</span>
    </div>
    <div class="op-draft">
      <div class="op-chip role">YOU · <b id="opRole">ROLE NOT CONFIRMED</b></div>
      <div class="op-chip">OUR STYLE · <b id="opOurIdentity">FORMING</b></div>
      <div class="op-chip">THEIR STYLE · <b id="opTheirIdentity">FORMING</b></div>
      <div id="opCompPlanChip" class="op-chip hidden">PLAN · <b id="opCompPlan">FORMING</b></div>
    </div>
    <div id="opTeamBoard" class="op-team-board">
      <section class="op-team-side ours"><div class="op-team-label"><span>YOUR TEAM</span><b id="opOurTeamState">FORMING</b></div><div id="opOurTeamPicks" class="op-team-picks"></div></section>
      <div class="op-team-vs">VS</div>
      <section class="op-team-side theirs"><div class="op-team-label"><span>THEIR TEAM</span><b id="opTheirTeamState">FORMING</b></div><div id="opTheirTeamPicks" class="op-team-picks"></div></section>
    </div>
    <article id="opStrategyLock" class="op-paid-lock hidden"><span>PLUS MATCH READ</span><strong>ROLE WIN CONDITION + LOSS CONDITION</strong><small>PLUS, PRO and active trials unlock the full 5v5 role read. Your simple role plan stays available on FREE.</small></article>
    <article id="opPaidWin" class="op-winhero"><span>WIN CONDITION</span><strong id="opYourWin">ARRIVE FIRST → STAY CONNECTED → WIN THE FIGHT → OBJECTIVE</strong></article>
    <div id="opRoleWin" class="op-rolewin hidden">
      <article class="op-role-step"><span id="opRoleStepLabel1">1 · BUILD EDGE</span><strong id="opRoleStep1"></strong></article>
      <article class="op-role-step"><span id="opRoleStepLabel2">2 · CONNECT</span><strong id="opRoleStep2"></strong></article>
      <article class="op-role-step"><span id="opRoleStepLabel3">3 · CASH OUT</span><strong id="opRoleStep3"></strong></article>
    </div>
    <article id="opJob" class="op-job"><span>YOUR JOB</span><strong id="opYourJob">PLAY YOUR ROLE INSIDE THE TEAM PLAN.</strong></article>
    <div id="opSimpleFlow" class="op-flow">
      <article class="op-step"><span id="opStep1Label">01 · EARLY</span><strong id="opEarly">PLAY CLEAN</strong></article>
      <article class="op-step"><span id="opStep2Label">02 · MID GAME</span><strong id="opMid">RESET → MOVE</strong></article>
      <article class="op-step"><span id="opStep3Label">03 · OBJECTIVE</span><strong id="opObjective">SET UP FIRST</strong></article>
      <article class="op-step"><span id="opStep4Label">04 · FIGHT</span><strong id="opFight">PLAY THE FORMATION</strong></article>
    </div>
    <article id="opPaidLoss" class="op-danger"><span>THEY WANT</span><strong id="opVsTeam">BREAK YOUR FORMATION.</strong><small id="opThreatNames"></small></article>
    <article id="opBiggestThrowCard" class="op-danger"><span>DON'T</span><strong id="opBiggestThrow">CHASE PAST YOUR SAFE LINE.</strong></article>
    <section id="opAdaptiveBuild" class="op-build hidden">
      <div class="op-build-head"><span>BUILD</span><small>CURRENT PATCH · DRAFT-AWARE</small></div>
      <div id="opAdaptiveBuildGrid" class="op-build-grid"></div>
      <div id="opAdaptiveBuildFlex" class="op-build-flex"></div>
      <div id="opAdaptiveBuildRead" class="op-build-read"></div>
    </section>
    <div class="op-mission"><span>CLIMB MISSION</span><strong id="opMissionCue"></strong></div>
    <details id="opDeepRead" class="op-deep hidden">
      <summary>WHY THIS PLAN WORKS +</summary>
      <div class="op-deep-grid">
        <article class="op-deep-card"><span>FIRST CONTACT</span><strong id="opDeepContact"></strong></article>
        <article class="op-deep-card"><span>YOUR PROTECTION</span><strong id="opDeepProtect"></strong></article>
        <article class="op-deep-card"><span>MAIN THREATS</span><strong id="opDeepThreat"></strong></article>
      </div>
      <div class="op-deep-rule"><b>FIGHT SHAPE · </b><span id="opDeepGeometry"></span></div>
      <div class="op-deep-rule"><b>DENY THEIR PLAN · </b><span id="opDeepRule"></span></div>
    </details>
    <div class="op-foot">READ IT ONCE · CLOSE THE COMPANION · PLAY THE PLAN · REVIEW IT AFTER THE GAME</div>`;
  const status=document.getElementById('status');
  if(status)status.insertAdjacentElement('afterend',section);else document.querySelector('main')?.appendChild(section);

  const level=document.createElement('section');
  level.id='opLevelUp';
  level.className='hidden';
  level.setAttribute('aria-live','assertive');
  level.innerHTML=`<div class="op-level-head"><div><div class="op-level-kicker">RANK PROGRESS</div><h2 id="opLevelTitle" class="op-level-title"></h2><p id="opLevelCopy" class="op-level-copy"></p></div><button id="opLevelClose" class="op-level-close" aria-label="Close">×</button></div><div id="opLevelRoute" class="op-level-route"></div>`;
  document.body.appendChild(level);
  document.getElementById('opLevelClose')?.addEventListener('click',()=>{const change=window.__opLastRankChange;dismissedRankKey=change?`${change.previous}|${change.current}`:'';level.classList.add('hidden')});
}

function firstText(value){if(Array.isArray(value))return String(value.find(Boolean)||'').trim();return String(value||'').trim()}
function oneLine(value,max=92){
  let text=firstText(value).replace(/\s+/g,' ').trim();
  if(!text)return'';
  const sentence=text.match(/^(.+?[.!?])(?:\s|$)/)?.[1];
  if(sentence&&sentence.length<=max)text=sentence;
  if(text.length<=max)return text;
  const cut=text.slice(0,max-1).replace(/\s+\S*$/,'').replace(/[,:;\-–—]+$/,'');
  return`${cut}…`;
}
function commandFrom(label,summary,fallback){return oneLine(label,62)||oneLine(summary,86)||fallback}
function normalizedRole(value){const role=String(value||'').trim().toUpperCase();if(role==='BOTTOM')return'ADC';if(role==='UTILITY')return'SUPPORT';if(role==='MIDDLE')return'MID';return role}
function roleFor(state,matchup){return normalizedRole(state?.matchup?.role||matchup?.role||state?.matchup?.plan?.role)}
function openingCommand(team,matchup,role){
  if(role==='JUNGLE')return'CLEAR ON TEMPO → MOVE ONLY FOR A CLEAN GANK OR COVER';
  const bot=team?.botLane;
  if(bot?.laneCall&&!bot?.pending)return commandFrom(bot.laneCall.label,bot.laneCall.summary,'PLAY THE 2V2 CLEAN');
  if(role==='SUPPORT')return'WIN SPACE IN LANE → RESET WITH THE MAP';
  if(role==='ADC')return'FARM CLEAN → TRADE ONLY WHEN YOUR SUPPORT CAN CONNECT';
  if(role==='MID')return'CATCH MID → CREATE FIRST MOVE WITHOUT DROPPING THE WAVE';
  if(role==='TOP')return'BUILD A CLEAN LANE EDGE → DO NOT BREAK YOUR RESET';
  return oneLine(firstText(matchup?.leadPlan?.create),86)||oneLine(matchup?.laneEdge?.summary,86)||'BUILD THE FIRST CLEAN EDGE';
}
function midCommand(team,role){
  if(role==='JUNGLE')return'RESET ON TEMPO → PATH TOWARD THE NEXT OBJECTIVE';
  if(role==='SUPPORT')return'MOVE WITH JUNGLE → VISION → RECONNECT TO CARRIES';
  if(role==='ADC')return'CATCH SAFE FARM → RECONNECT BEFORE THE FIGHT STARTS';
  if(role==='MID')return'CATCH WAVE → MOVE FIRST → STAY CONNECTED';
  if(role==='TOP')return'SIDE PRESSURE → RECONNECT BEFORE THE BIG FIGHT';
  return commandFrom(team?.sidelane?.label,team?.sidelane?.summary,'CATCH WAVE → RECONNECT');
}
function objectiveCommand(team,role){
  const fight=String(team?.teamfight?.label||'').toUpperCase();
  let core='ARRIVE FIRST → KEEP FORMATION → DO NOT FACE-CHECK ALONE';
  if(fight.includes('POKE'))core='ARRIVE FIRST → TAKE SPACE → POKE BEFORE COMMITTING';
  else if(fight.includes('DIVE'))core='SWEEP FLANKS → ONE ENGAGE CALL → ENTER TOGETHER';
  else if(fight.includes('PICK'))core='DENY VISION → FIND ONE PICK → FORCE THE 5V4';
  else if(fight.includes('FRONT')||fight.includes('LAYERED'))core='ARRIVE FIRST → FRONT LINE OWNS THE CHOKE → CARRIES BEHIND';
  if(role==='JUNGLE')return`SMITE READY → ${core}`;
  return core;
}
function fightCommand(team){
  const label=String(team?.teamfight?.label||'').toUpperCase();
  if(label.includes('LAYERED'))return'FRONT LINE STARTS → DIVERS SECOND → CARRIES STAY SAFE';
  if(label.includes('FRONT'))return'FRONT TO BACK → PROTECT CARRIES → HIT THE NEAREST SAFE TARGET';
  if(label.includes('DIVE'))return'ONE CALL → ENTER TOGETHER → DELETE ONE TARGET';
  if(label.includes('POKE'))return'POKE FIRST → COMMIT ONLY AFTER HP OR SPACE ADVANTAGE';
  if(label.includes('PICK'))return'PICK FIRST → RESET OR TAKE THE 5V4';
  return commandFrom(team?.teamfight?.label,team?.teamfight?.summary,'STAY CONNECTED → FIGHT ON ONE CALL');
}
function compactNames(values,max=2){
  const list=Array.isArray(values)?values.map(value=>String(value||'').trim()).filter(Boolean):[];
  if(!list.length)return'';
  return list.slice(0,max).join(' / ').toUpperCase()+(list.length>max?' +'+String(list.length-max):'');
}
function ourWinCommand(team,matchup){
  const shape=String(team?.roleWinCondition?.compPlan||team?.teamfight?.label||'').toUpperCase();
  if(shape.includes('POKE'))return'POKE FIRST → FORCE THEM TO ENTER → CLEAN UP → OBJECTIVE';
  if(shape.includes('FRONT'))return'HOLD FORMATION → LET THEM ENTER → FRONT-TO-BACK → OBJECTIVE';
  if(shape.includes('DIVE'))return'CREATE FIRST CONTACT → DIVE TOGETHER → OBJECTIVE';
  if(shape.includes('PICK'))return'CONTROL VISION → FIND ONE PICK → 5V4 → OBJECTIVE';
  return'ARRIVE FIRST → STAY CONNECTED → WIN THE FIGHT → OBJECTIVE';
}
function theirWinCommand(team){
  const identity=String(team?.theirIdentity||'').toUpperCase();
  if(identity.includes('DIVE'))return'BACK-LINE ACCESS → COLLAPSE ON YOUR CARRY';
  if(identity.includes('POKE'))return'CHIP YOU DOWN → FORCE YOU TO ENTER LOW';
  if(identity.includes('FRONT'))return'STABLE FRONT-TO-BACK 5V5';
  if(identity.includes('PICK')||identity.includes('BURST'))return'ISOLATE ONE TARGET → FORCE THE 5V4';
  return oneLine(team?.theirWinCondition,88)||'BREAK YOUR FORMATION BEFORE THE FIGHT';
}
function biggestThrowCommand(team){
  const raw=String(team?.biggestThrow||team?.roleWinCondition?.lossCondition||'').toUpperCase();
  if(/WALK|PAST|SAFE DAMAGE|LOWER-HEALTH/.test(raw))return'STEP PAST PEEL TO REACH A LOW-HP TARGET';
  if(/SPLIT|FORMATION/.test(raw))return'BREAK FORMATION / LEAVE YOUR PEEL';
  if(/STAGGER|EARLY/.test(raw))return'ENTER ALONE BEFORE YOUR TEAM CAN FOLLOW';
  if(/FULL HEALTH|POKE/.test(raw))return'FORCE BEFORE YOUR POKE CREATES AN EDGE';
  return oneLine(raw,88)||'CHASE AFTER THE FIGHT IS ALREADY WON';
}
function phaseLabels(role){
  if(role==='JUNGLE')return['01 · PATH','02 · PRESSURE','03 · OBJECTIVE','04 · FIGHT'];
  if(role==='SUPPORT')return['01 · LANE','02 · ROAM / VISION','03 · OBJECTIVE','04 · FIGHT'];
  return['01 · LANE','02 · MID GAME','03 · OBJECTIVE','04 · FIGHT'];
}
function renderRoleWin(team,set){
  const plan=team?.roleWinCondition;
  const steps=Array.isArray(plan?.steps)?plan.steps.slice(0,5):[];
  if(steps.length!==5)return false;
  const role=String(plan?.role||'').toUpperCase();
  const protect=compactNames(team?.compositionRead?.protectors,2)||'YOUR FRONT LINE';
  const threats=compactNames(team?.compositionRead?.enemyThreats,2)||'THEIR ACCESS';
  set('opStrategyHeading','WIN THIS GAME');
  set('opCompPlan',oneLine(plan?.compPlan,70)||'PLAY THE DRAFT');
  if(role==='ADC'){
    set('opRoleStepLabel1','1 · GET PAID');
    set('opRoleStep1','FARM → CORE ITEMS');
    set('opRoleStepLabel2','2 · STAY SAFE');
    set('opRoleStep2',`PLAY BEHIND ${protect} → MAKE ${threats} CROSS THEM`);
    set('opRoleStepLabel3','3 · CASH OUT');
    set('opRoleStep3','SURVIVE FIRST ACCESS → HIT CLOSEST SAFE TARGET → OBJECTIVE');
  }else if(role==='JUNGLE'){
    set('opRoleStepLabel1','1 · TEMPO');
    set('opRoleStep1','CLEAR CLEAN → MOVE ONLY WITH LANE CONNECTION');
    set('opRoleStepLabel2','2 · SET THE MAP');
    set('opRoleStep2','RESET → ARRIVE FIRST → CONTROL THE NEXT OBJECTIVE');
    set('opRoleStepLabel3','3 · CASH OUT');
    set('opRoleStep3','ONE CLEAN FIGHT → OBJECTIVE → RESET');
  }else if(role==='SUPPORT'){
    set('opRoleStepLabel1','1 · CREATE SPACE');
    set('opRoleStep1','WIN LANE SPACE → KEEP YOUR CARRY PLAYABLE');
    set('opRoleStepLabel2','2 · SET THE MAP');
    set('opRoleStep2','MOVE WITH JUNGLE → VISION FIRST → RECONNECT');
    set('opRoleStepLabel3','3 · CASH OUT');
    set('opRoleStep3','ENGAGE OR PEEL → WON FIGHT → OBJECTIVE');
  }else if(role==='MID'){
    set('opRoleStepLabel1','1 · OWN MID');
    set('opRoleStep1','CATCH WAVE → KEEP FIRST MOVE');
    set('opRoleStepLabel2','2 · CONNECT');
    set('opRoleStep2','MOVE WITH YOUR ENGAGE → ARRIVE BEFORE THEIR MID');
    set('opRoleStepLabel3','3 · CASH OUT');
    set('opRoleStep3','WIN ONE FIGHT → OBJECTIVE → RESET');
  }else{
    set('opRoleStepLabel1','1 · BUILD EDGE');
    set('opRoleStep1',oneLine(steps[0]?.value,72)||'PLAY CLEAN');
    set('opRoleStepLabel2','2 · CONNECT');
    set('opRoleStep2',oneLine(steps[1]?.value,72)||'SET UP THE FIGHT');
    set('opRoleStepLabel3','3 · CASH OUT');
    set('opRoleStep3','WIN THE FIGHT → TAKE THE OBJECTIVE');
  }
  return true;
}
function renderDeepRead(team,set){
  const read=team?.compositionRead;
  if(!read)return false;
  set('opDeepContact',(Array.isArray(read.firstContact)&&read.firstContact.length?read.firstContact.join(' / '):'NO SINGLE FORCED ENGAGER').toUpperCase());
  set('opDeepProtect',(Array.isArray(read.protectors)&&read.protectors.length?read.protectors.join(' / '):'PLAY THE TEAM FORMATION').toUpperCase());
  set('opDeepThreat',(Array.isArray(read.enemyThreats)&&read.enemyThreats.length?read.enemyThreats.join(' / '):'THEIR FIRST CLEAN ENGAGE').toUpperCase());
  set('opDeepGeometry',oneLine(read.fightGeometry,220)||'STAY CONNECTED THROUGH FIRST CONTACT.');
  set('opDeepRule',oneLine(read.matchupRule,220)||'DENY THEIR CLEANEST FIGHT.');
  return true;
}

function championAssetKey(name){
  const clean=String(name||'').trim();
  const special={
    'Aurelion Sol':'AurelionSol',"Bel'Veth":'Belveth',"Cho'Gath":'Chogath','Dr. Mundo':'DrMundo',
    'Jarvan IV':'JarvanIV',"Kai'Sa":'Kaisa',"Kha'Zix":'Khazix',"K'Sante":'KSante','LeBlanc':'Leblanc',
    'Lee Sin':'LeeSin','Master Yi':'MasterYi','Miss Fortune':'MissFortune','Nunu & Willump':'Nunu',
    "Rek'Sai":'RekSai','Renata Glasc':'Renata','Tahm Kench':'TahmKench','Twisted Fate':'TwistedFate',
    "Vel'Koz":'Velkoz','Wukong':'MonkeyKing','Xin Zhao':'XinZhao'
  };
  return special[clean]||clean.replace(/[^A-Za-z0-9]/g,'');
}

function renderTeamBoard(team,champion){
  const threatNames=new Set((Array.isArray(team?.compositionRead?.enemyThreats)?team.compositionRead.enemyThreats:[]).map(value=>String(value||'').toUpperCase()));
  const renderSide=(id,rows,ours)=>{
    const root=document.getElementById(id);
    if(!root)return;
    root.replaceChildren();
    const list=Array.isArray(rows)?rows.slice(0,5):[];
    const values=list.length?list:Array.from({length:5},()=>null);
    values.forEach((pick,index)=>{
      const card=document.createElement('article');
      const name=String(pick?.name||'PENDING').trim();
      const role=normalizedRole(pick?.role||'')||['TOP','JUNGLE','MID','ADC','SUPPORT'][index]||'';
      const mine=ours&&name&&champion&&name.toUpperCase()===champion.toUpperCase();
      const threat=!ours&&threatNames.has(name.toUpperCase());
      card.className='op-team-pick'+(mine?' you':'')+(threat?' threat':'');
      const asset=championAssetKey(name);
      if(asset&&name!=='PENDING'){
        const img=document.createElement('img');
        img.alt='';
        img.src='https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/'+encodeURIComponent(asset)+'_0.jpg';
        card.appendChild(img);
      }
      const copy=document.createElement('div');
      const roleNode=document.createElement('span');roleNode.textContent=(threat?'THREAT · ':'')+(role||'ROLE');
      const nameNode=document.createElement('b');nameNode.textContent=name||'PENDING';
      copy.append(roleNode,nameNode);card.appendChild(copy);root.appendChild(card);
    });
  };
  const ours=Array.isArray(team?.ourTeam)?team.ourTeam:team?.rememberPlan?.draftTeams?.ours||[];
  const theirs=Array.isArray(team?.theirTeam)?team.theirTeam:team?.rememberPlan?.draftTeams?.theirs||[];
  renderSide('opOurTeamPicks',ours,true);
  renderSide('opTheirTeamPicks',theirs,false);
  const ourState=document.getElementById('opOurTeamState');
  const theirState=document.getElementById('opTheirTeamState');
  if(ourState)ourState.textContent=ours.length>=5?'5/5 LOCKED':String(ours.length)+'/5 KNOWN';
  if(theirState)theirState.textContent=theirs.length>=5?'5/5 LOCKED':String(theirs.length)+'/5 KNOWN';
}

function renderAdaptiveBuild(team){
  const root=document.getElementById('opAdaptiveBuild');
  const grid=document.getElementById('opAdaptiveBuildGrid');
  const read=document.getElementById('opAdaptiveBuildRead');
  const build=team?.adaptiveBuild||team?.rememberPlan?.adaptiveBuild||null;
  if(!root||!grid)return false;

  const unique=[];
  const seen=new Set();
  const add=item=>{if(!item||seen.has(item.id))return;seen.add(item.id);unique.push(item)};
  (Array.isArray(build?.core)?build.core.slice(0,2):[]).forEach(add);
  add(build?.boots||null);
  add(build?.finish||null);

  root.classList.toggle('hidden',unique.length<2);
  if(unique.length<2)return false;

  grid.replaceChildren();
  let coreIndex=0;
  unique.slice(0,4).forEach(item=>{
    const card=document.createElement('article');
    card.className='op-build-card';
    card.title=String(item?.why||'').trim();

    const img=document.createElement('img');
    img.alt='';
    img.src='https://ddragon.leagueoflegends.com/cdn/'+encodeURIComponent(String(build?.patch||''))+'/img/item/'+String(item?.id)+'.png';

    const copy=document.createElement('div');
    const label=document.createElement('span');
    if(item?.slot==='CORE'){coreIndex+=1;label.textContent='CORE '+String(coreIndex)}
    else if(item?.slot==='FINISH')label.textContent='NEXT';
    else if(item?.slot==='BOOTS')label.textContent='BOOTS';
    else label.textContent=String(item?.slot||'ITEM');

    const name=document.createElement('strong');
    name.textContent=String(item?.name||'ITEM').toUpperCase();
    copy.append(label,name);card.append(img,copy);grid.appendChild(card);
  });

  const flex=document.getElementById('opAdaptiveBuildFlex');
  if(flex){
    flex.textContent=build?.draftItem
      ?'FLEX IF NEEDED · '+String(build.draftItem.name||'TECH').toUpperCase()+' — '+oneLine(build.draftItem.why,84).toUpperCase()
      :'NO FORCED TECH · KEEP THE CORE PATH';
  }
  if(read){
    const source=String(build?.read||'').match(/CORE · ([^·]+)/i)?.[1]?.trim();
    read.textContent=(source?'CORE DATA · '+source.toUpperCase():'CURRENT-PATCH CORE')+' · TECH IS CONDITIONAL, NOT A FIXED THIRD ITEM';
  }
  return true;
}

function renderMissionReminders(state){
  installStrategyView();
  const section=document.getElementById('opMissionReminders');
  if(!section)return;
  const phase=String(state?.phase||'');
  const team=state?.teamPlan||null;
  const matchup=state?.matchup?.plan||null;
  const baseline=team?.dnaBaseline||null;
  const baselineReady=baseline?.ready!==false;
  const mission=baselineReady&&Array.isArray(team?.missionTips)?team.missionTips[0]||null:null;
  const visible=['CHAMP_SELECT','RECORDING'].includes(phase)&&Boolean(team||matchup||mission);
  section.classList.toggle('hidden',!visible);
  section.classList.toggle('op-phase-live',phase==='RECORDING');
  if(!visible)return;

  const statusCopy=document.getElementById('statusCopy');
  if(statusCopy&&phase==='RECORDING')statusCopy.textContent='Locked plan from champ select · recording your game · no reactive changes.';
  const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value};
  const toggle=(id,hidden)=>document.getElementById(id)?.classList.toggle('hidden',hidden);
  const role=roleFor(state,matchup);
  const champion=String(state?.matchup?.champion||matchup?.you?.name||'YOU').trim().toUpperCase();
  const access=team?.strategyAccess||{};
  const paid=Boolean(access?.paidStrategy);
  const labels=phaseLabels(role);
  const hasRoleWin=paid&&renderRoleWin(team,set);
  const hasDeep=Boolean(access?.deepStrategy)&&renderDeepRead(team,set);
  const tier=String(access?.tier||state?.playerHome?.tier||'').toUpperCase();
  const membership=['FREE','PLUS','PRO'].includes(tier)?tier+' COACH':'OP CLIMB COACH';

  if(!hasRoleWin)set('opStrategyHeading',paid?'HOW WE WIN THIS GAME':'YOUR SIMPLE GAME PLAN');
  set('opMissionRank',access?.trialing&&membership!=='OP CLIMB COACH'?`${tier} TRIAL`:membership);
  set('opRole',role?`${champion} · ${role}`:`${champion} · ROLE NOT CONFIRMED`);
  set('opOurIdentity',oneLine(team?.ourIdentity,40)||'FORMING');
  set('opTheirIdentity',oneLine(team?.theirIdentity,40)||'FORMING');
  renderTeamBoard(team,champion);
  const threatNames=Array.isArray(team?.compositionRead?.enemyThreats)?team.compositionRead.enemyThreats:[];
  set('opThreatNames',threatNames.length?'WATCH: '+threatNames.slice(0,3).join(' / ').toUpperCase():'');
  set('opStep1Label',labels[0]);set('opStep2Label',labels[1]);set('opStep3Label',labels[2]);set('opStep4Label',labels[3]);
  set('opYourJob',oneLine(team?.yourJob,125)||'PLAY YOUR ROLE INSIDE THE TEAM PLAN');
  set('opEarly',openingCommand(team,matchup,role));
  set('opMid',midCommand(team,role));
  set('opObjective',objectiveCommand(team,role));
  set('opFight',fightCommand(team));
  const missionCard=document.querySelector('.op-mission');
  const missionLabel=missionCard?.querySelector('span');
  if(!baselineReady){
    if(missionLabel)missionLabel.textContent='DNA BASELINE';
    set('opMissionCue',`GAME ${Math.min(Number(baseline?.games||0)+1,Number(baseline?.required||3))}/${Number(baseline?.required||3)} · PLAY NORMALLY. OP CLIMB IS LEARNING YOUR STARTING POINT.`);
  }else{
    if(missionLabel)missionLabel.textContent='YOUR CLIMB MISSION';
    set('opMissionCue',oneLine(mission?.cue,100)||'STAY WITH YOUR CURRENT DEVELOPMENT FOCUS');
  }
  renderAdaptiveBuild(team);

  toggle('opStrategyLock',paid);
  toggle('opRoleWin',!hasRoleWin);
  toggle('opCompPlanChip',true);
  toggle('opJob',false);
  toggle('opSimpleFlow',hasRoleWin);
  toggle('opPaidWin',!paid);
  toggle('opPaidLoss',!paid);
  toggle('opBiggestThrowCard',!paid);
  toggle('opDeepRead',!hasDeep);
  if(paid){
    set('opYourWin',ourWinCommand(team,matchup));
    set('opVsTeam',theirWinCommand(team));
    set('opBiggestThrow',biggestThrowCommand(team));
  }
}

function renderLevelUp(state){
  installStrategyView();
  const section=document.getElementById('opLevelUp');
  const change=state?.postGameReview?.rankChange;
  window.__opLastRankChange=change||null;
  if(!section||String(state?.phase||'')!=='REVIEW'||!change?.movedUp){section?.classList.add('hidden');return}
  const key=`${change.previous}|${change.current}`;
  if(key===dismissedRankKey){section.classList.add('hidden');return}
  const title=document.getElementById('opLevelTitle'),copy=document.getElementById('opLevelCopy'),route=document.getElementById('opLevelRoute'),tier=String(change.currentTier||'').toUpperCase();
  if(title)title.textContent=change.coachingLayerChanged?`YOU'VE REACHED ${tier}`:`RANK UP · ${tier} ${String(change.currentDivision||'')}`.trim();
  if(copy)copy.textContent=change.coachingLayerChanged?`Your Coach has levelled up with you. From your next game, OP CLIMB will use ${tier}-level detail automatically.`:`Nice step up. OP CLIMB recorded the division change automatically.`;
  if(route)route.innerHTML=`<span>${escapeHtml(change.previous)}</span><span>→</span><b>${escapeHtml(change.current)}</b>`;
  section.classList.remove('hidden');
}
function escapeHtml(value){return String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function renderCompanionExtras(state){renderMissionReminders(state);renderLevelUp(state)}
window.addEventListener('DOMContentLoaded',()=>{installStrategyView();ipcRenderer.invoke('companion:get-state').then(renderCompanionExtras).catch(()=>{});ipcRenderer.on('companion:state',(_event,state)=>renderCompanionExtras(state))});
