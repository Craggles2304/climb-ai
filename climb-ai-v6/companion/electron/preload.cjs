const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('opCompanion',{
  getState:()=>ipcRenderer.invoke('companion:get-state'),
  unpair:()=>ipcRenderer.invoke('companion:unpair'),
  restart:()=>ipcRenderer.invoke('companion:restart'),
  setAutoStart:(enabled)=>ipcRenderer.invoke('companion:auto-start',enabled),
  openClimb:()=>ipcRenderer.invoke('companion:open-climb'),
  getUpdateState:()=>ipcRenderer.invoke('companion:update-state'),
  checkUpdate:()=>ipcRenderer.invoke('companion:check-update'),
  downloadUpdate:()=>ipcRenderer.invoke('companion:download-update'),
  installUpdate:(phase)=>ipcRenderer.invoke('companion:install-update',phase),
  simulateBotLane:(context)=>ipcRenderer.invoke('companion:botlane-sim',context),
  onState:(handler)=>{const listener=(_event,state)=>handler(state);ipcRenderer.on('companion:state',listener);return()=>ipcRenderer.removeListener('companion:state',listener)},
  onUpdateState:(handler)=>{const listener=(_event,state)=>handler(state);ipcRenderer.on('companion:update-state',listener);return()=>ipcRenderer.removeListener('companion:update-state',listener)}
});

let dismissedRankKey='';

function installStrategyView(){
  if(document.getElementById('op-strategy-style'))return;
  const style=document.createElement('style');
  style.id='op-strategy-style';
  style.textContent=`
#opMissionReminders{margin-top:12px;padding:18px 20px;border-left:2px solid #d6ff2f;background:linear-gradient(180deg,rgba(12,17,22,.98),rgba(8,12,16,.98))}#opMissionReminders.hidden,.op-paid-lock.hidden,.op-winhero.hidden,.op-danger.hidden,.op-job.hidden,.op-flow.hidden,.op-rolewin.hidden,.op-deep.hidden{display:none!important}#opMissionReminders:not(.hidden)~#matchup{display:none!important}.op-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;margin-bottom:11px}.op-kicker{font-size:8px;letter-spacing:.2em;font-weight:900;color:#7f8a96;text-transform:uppercase}.op-head h3{margin:5px 0 0;font-size:21px;letter-spacing:-.03em;text-transform:uppercase}.op-rank{font-size:8px;letter-spacing:.15em;font-weight:900;color:#d6ff2f;border:1px solid rgba(214,255,47,.2);padding:7px 9px;text-transform:uppercase}.op-draft{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:9px}.op-chip{font-size:8px;letter-spacing:.11em;text-transform:uppercase;border:1px solid rgba(255,255,255,.07);padding:7px 9px;color:#9aa7b2;background:rgba(255,255,255,.018)}.op-chip b{color:#e8eef2}.op-chip.role{border-color:rgba(214,255,47,.24);color:#d6ff2f}.op-paid-lock{border:1px solid rgba(214,255,47,.18);background:rgba(214,255,47,.025);padding:11px 13px;margin-bottom:8px}.op-paid-lock span{display:block;font-size:7px;letter-spacing:.17em;font-weight:900;color:#d6ff2f;text-transform:uppercase}.op-paid-lock strong{display:block;margin-top:5px;font-size:12px;color:#f6f9fa}.op-paid-lock small{display:block;margin-top:4px;font-size:9px;line-height:1.4;color:#7f8a96}.op-winhero{border:1px solid rgba(214,255,47,.28);border-left:3px solid #d6ff2f;background:rgba(214,255,47,.04);padding:14px 15px;margin-bottom:8px}.op-winhero span,.op-job span,.op-danger span,.op-mission span{display:block;font-size:7px;letter-spacing:.17em;font-weight:900;text-transform:uppercase}.op-winhero span,.op-mission span{color:#d6ff2f}.op-winhero strong{display:block;margin-top:6px;font-size:16px;line-height:1.36;color:#f6f9fa}.op-job{border:1px solid rgba(67,140,255,.22);background:rgba(67,140,255,.035);padding:11px 13px;margin-bottom:8px}.op-job span{color:#6fa6ff}.op-job strong{display:block;margin-top:5px;font-size:12px;line-height:1.4;color:#eef3f6}.op-rolewin{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-bottom:8px}.op-role-step{position:relative;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.018);padding:12px 11px 13px;min-height:96px}.op-role-step:before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:#d6ff2f}.op-role-step span{display:block;font-size:7px;letter-spacing:.15em;font-weight:900;color:#7d8993;text-transform:uppercase;margin-bottom:7px}.op-role-step strong{display:block;font-size:11px;line-height:1.35;color:#f4f7f9}.op-flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.op-step{position:relative;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.018);padding:12px 12px 13px;min-height:88px}.op-step:before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:#d6ff2f}.op-step:nth-child(2):before,.op-step:nth-child(3):before{background:#4c91ff}.op-step span{display:block;font-size:7px;letter-spacing:.16em;font-weight:900;color:#6f7d88;text-transform:uppercase;margin-bottom:7px}.op-step strong{display:block;font-size:12px;line-height:1.35;color:#f5f8fa}.op-danger{margin-top:8px;border:1px solid rgba(255,120,120,.18);background:rgba(255,80,80,.025);padding:11px 13px}.op-danger span{color:#ff8c8c}.op-danger strong{display:block;margin-top:5px;font-size:11px;line-height:1.4;color:#eef3f6}.op-deep{margin-top:8px;border:1px solid rgba(67,140,255,.2);background:rgba(67,140,255,.025);padding:0 13px 11px}.op-deep summary{cursor:pointer;padding:11px 0 8px;font-size:8px;letter-spacing:.16em;font-weight:900;color:#6fa6ff;text-transform:uppercase}.op-deep-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.op-deep-card{border:1px solid rgba(255,255,255,.07);padding:10px;background:rgba(255,255,255,.015)}.op-deep-card span{display:block;font-size:7px;letter-spacing:.14em;color:#71808d;text-transform:uppercase;font-weight:900}.op-deep-card strong{display:block;margin-top:5px;font-size:10px;line-height:1.35;color:#eef3f6}.op-deep-rule{margin-top:7px;border-top:1px solid rgba(255,255,255,.06);padding-top:8px;font-size:10px;line-height:1.45;color:#b7c2cb}.op-mission{margin-top:8px;border:1px solid rgba(214,255,47,.18);background:rgba(214,255,47,.025);padding:11px 13px}.op-mission strong{display:block;margin-top:6px;font-size:13px;color:#f6f9fa;line-height:1.35}.op-foot{margin-top:9px;text-align:center;font-size:7px;letter-spacing:.14em;color:#51606d;text-transform:uppercase}#opLevelUp{position:fixed;z-index:9999;top:22px;left:50%;transform:translateX(-50%);width:min(620px,calc(100vw - 32px));padding:20px 22px;border:1px solid rgba(214,255,47,.45);border-left:3px solid #d6ff2f;background:linear-gradient(145deg,rgba(13,19,24,.985),rgba(7,11,15,.985));box-shadow:0 22px 70px rgba(0,0,0,.48)}#opLevelUp.hidden{display:none!important}.op-level-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.op-level-kicker{font-size:8px;letter-spacing:.22em;font-weight:900;color:#d6ff2f;text-transform:uppercase}.op-level-title{margin:6px 0 6px;font-size:28px;line-height:1;letter-spacing:-.04em;text-transform:uppercase}.op-level-copy{margin:0;color:#aeb8c1;font-size:12px;line-height:1.55;max-width:520px}.op-level-route{display:flex;align-items:center;gap:9px;margin-top:14px;font-size:9px;letter-spacing:.14em;text-transform:uppercase;font-weight:900;color:#dce4ea}.op-level-route b{color:#d6ff2f}.op-level-close{border:0;background:transparent;color:#8995a0;font-size:18px;cursor:pointer;padding:2px 5px}@media(max-width:1080px){.op-rolewin{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:920px){.op-flow{grid-template-columns:repeat(2,minmax(0,1fr));.op-deep-grid{grid-template-columns:1fr}}@media(max-width:620px){.op-rolewin,.op-flow,.op-deep-grid{grid-template-columns:1fr}.op-role-step,.op-step{min-height:0}.op-level-title{font-size:23px}}`;
  document.head.appendChild(style);

  const section=document.createElement('section');
  section.id='opMissionReminders';
  section.className='card hidden';
  section.setAttribute('aria-live','polite');
  section.innerHTML=`
    <div class="op-head">
      <div><div class="op-kicker">LOCKED FROM CHAMP SELECT</div><h3 id="opStrategyHeading">HOW WE WIN THIS GAME</h3></div>
      <span id="opMissionRank" class="op-rank">COACH</span>
    </div>
    <div class="op-draft">
      <div class="op-chip role">YOU · <b id="opRole">ROLE NOT CONFIRMED</b></div>
      <div class="op-chip">OUR STYLE · <b id="opOurIdentity">FORMING</b></div>
      <div class="op-chip">THEIR STYLE · <b id="opTheirIdentity">FORMING</b></div>
      <div id="opCompPlanChip" class="op-chip hidden">PLAN · <b id="opCompPlan">FORMING</b></div>
    </div>
    <article id="opStrategyLock" class="op-paid-lock hidden"><span>PLUS MATCH READ</span><strong>ROLE WIN CONDITION + LOSS CONDITION</strong><small>PLUS, PRO and active trials unlock the full 5v5 role read. Your simple role plan stays available on FREE.</small></article>
    <article id="opPaidWin" class="op-winhero"><span>OUR WIN CONDITION</span><strong id="opYourWin">BUILD THE FIRST CLEAN ADVANTAGE, THEN CONVERT IT.</strong></article>
    <div id="opRoleWin" class="op-rolewin hidden">
      <article class="op-role-step"><span id="opRoleStepLabel1">1</span><strong id="opRoleStep1"></strong></article>
      <article class="op-role-step"><span id="opRoleStepLabel2">2</span><strong id="opRoleStep2"></strong></article>
      <article class="op-role-step"><span id="opRoleStepLabel3">3</span><strong id="opRoleStep3"></strong></article>
      <article class="op-role-step"><span id="opRoleStepLabel4">4</span><strong id="opRoleStep4"></strong></article>
      <article class="op-role-step"><span id="opRoleStepLabel5">5</span><strong id="opRoleStep5"></strong></article>
    </div>
    <article id="opJob" class="op-job"><span>YOUR JOB</span><strong id="opYourJob">PLAY YOUR ROLE INSIDE THE TEAM PLAN.</strong></article>
    <div id="opSimpleFlow" class="op-flow">
      <article class="op-step"><span id="opStep1Label">01 · EARLY</span><strong id="opEarly">PLAY CLEAN</strong></article>
      <article class="op-step"><span id="opStep2Label">02 · MID GAME</span><strong id="opMid">RESET → MOVE</strong></article>
      <article class="op-step"><span id="opStep3Label">03 · OBJECTIVE</span><strong id="opObjective">SET UP FIRST</strong></article>
      <article class="op-step"><span id="opStep4Label">04 · FIGHT</span><strong id="opFight">PLAY THE FORMATION</strong></article>
    </div>
    <article id="opPaidLoss" class="op-danger"><span>THEY WIN IF</span><strong id="opVsTeam">WE GIVE THEM THE FIGHT THEY WANT.</strong></article>
    <details id="opDeepRead" class="op-deep hidden">
      <summary>PRO · WHY THIS PLAN WORKS</summary>
      <div class="op-deep-grid">
        <article class="op-deep-card"><span>FIRST CONTACT</span><strong id="opDeepContact"></strong></article>
        <article class="op-deep-card"><span>YOUR PROTECTION</span><strong id="opDeepProtect"></strong></article>
        <article class="op-deep-card"><span>MAIN THREATS</span><strong id="opDeepThreat"></strong></article>
      </div>
      <div class="op-deep-rule"><b>FIGHT SHAPE · </b><span id="opDeepGeometry"></span></div>
      <div class="op-deep-rule"><b>DENY THEIR PLAN · </b><span id="opDeepRule"></span></div>
    </details>
    <div class="op-mission"><span>YOUR CLIMB MISSION</span><strong id="opMissionCue"></strong></div>
    <div class="op-foot">READ IT ONCE · PLAY THE PLAN · REVIEW IT AFTER THE GAME</div>`;
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
function ourWinCommand(team,matchup){
  const server=oneLine(team?.ourWinCondition,210);
  if(server)return server;
  const label=String(team?.teamfight?.label||'').toUpperCase();
  const play=oneLine(team?.playAround,118);
  const job=oneLine(team?.yourJob,118);
  if(label.includes('FRONT')||label.includes('LAYERED'))return oneLine(`WIN CONNECTED FRONT-TO-BACK FIGHTS. ${play||job}`,150);
  if(label.includes('DIVE'))return oneLine(`CREATE FIRST CONTACT, THEN ENTER TOGETHER ON ONE TARGET. ${play}`,150);
  if(label.includes('POKE'))return'ARRIVE FIRST → TAKE SPACE → LOWER THEIR HP → COMMIT WITH THE ADVANTAGE → TAKE THE OBJECTIVE.';
  if(label.includes('PICK'))return'CONTROL VISION → CATCH ONE PLAYER → USE THE 5V4 → TAKE THE OBJECTIVE INSTEAD OF CHASING.';
  return oneLine(`ARRIVE FIRST → STAY CONNECTED → FIGHT ON ONE CALL → CONVERT TO THE OBJECTIVE. ${play||job||firstText(matchup?.winCondition)}`,180)||'CREATE THE FIRST CLEAN ADVANTAGE → STAY CONNECTED → CONVERT IT INTO THE OBJECTIVE.';
}
function theirWinCommand(team){return oneLine(team?.roleWinCondition?.lossCondition,150)||oneLine(team?.theirWinCondition,150)||'THEY FIND AN ISOLATED TARGET OR BREAK OUR FORMATION BEFORE THE FIGHT STARTS'}
function phaseLabels(role){
  if(role==='JUNGLE')return['01 · PATH','02 · PRESSURE','03 · OBJECTIVE','04 · FIGHT'];
  if(role==='SUPPORT')return['01 · LANE','02 · ROAM / VISION','03 · OBJECTIVE','04 · FIGHT'];
  return['01 · LANE','02 · MID GAME','03 · OBJECTIVE','04 · FIGHT'];
}
function renderRoleWin(team,set){
  const plan=team?.roleWinCondition;
  const steps=Array.isArray(plan?.steps)?plan.steps.slice(0,5):[];
  if(steps.length!==5)return false;
  set('opStrategyHeading',String(plan?.title||'YOUR WIN CONDITION').toUpperCase());
  set('opCompPlan',oneLine(plan?.compPlan,70)||'PLAY THE DRAFT');
  for(let i=0;i<5;i++){
    set(`opRoleStepLabel${i+1}`,`${i+1} · ${String(steps[i]?.label||'STEP').toUpperCase()}`);
    set(`opRoleStep${i+1}`,oneLine(steps[i]?.value,105)||'PLAY CLEAN');
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

function renderMissionReminders(state){
  installStrategyView();
  const section=document.getElementById('opMissionReminders');
  if(!section)return;
  const phase=String(state?.phase||'');
  const team=state?.teamPlan||null;
  const matchup=state?.matchup?.plan||null;
  const mission=Array.isArray(team?.missionTips)?team.missionTips[0]||null:null;
  const visible=(phase==='CHAMP_SELECT'||phase==='RECORDING')&&Boolean(team||matchup||mission);
  section.classList.toggle('hidden',!visible);
  if(!visible)return;

  const statusCopy=document.getElementById('statusCopy');
  if(statusCopy&&phase==='RECORDING')statusCopy.textContent='Play normally. Follow the locked role plan; glance, then get your eyes back on League.';
  const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value};
  const toggle=(id,hidden)=>document.getElementById(id)?.classList.toggle('hidden',hidden);
  const role=roleFor(state,matchup);
  const champion=String(state?.matchup?.champion||matchup?.you?.name||'YOU').trim().toUpperCase();
  const access=team?.strategyAccess||{};
  const paid=Boolean(access?.paidStrategy);
  const labels=phaseLabels(role);
  const hasRoleWin=paid&&renderRoleWin(team,set);
  const hasDeep=Boolean(access?.deepStrategy)&&renderDeepRead(team,set);
  const tier=String(access?.tier||team?.coachLevel?.tier||'FREE').toUpperCase();

  if(!hasRoleWin)set('opStrategyHeading',paid?'HOW WE WIN THIS GAME':'YOUR SIMPLE GAME PLAN');
  set('opMissionRank',access?.trialing?`${tier} TRIAL`:`${tier} COACH`);
  set('opRole',role?`${champion} · ${role}`:`${champion} · ROLE NOT CONFIRMED`);
  set('opOurIdentity',oneLine(team?.ourIdentity,40)||'FORMING');
  set('opTheirIdentity',oneLine(team?.theirIdentity,40)||'FORMING');
  set('opStep1Label',labels[0]);set('opStep2Label',labels[1]);set('opStep3Label',labels[2]);set('opStep4Label',labels[3]);
  set('opYourJob',oneLine(team?.yourJob,125)||'PLAY YOUR ROLE INSIDE THE TEAM PLAN');
  set('opEarly',openingCommand(team,matchup,role));
  set('opMid',midCommand(team,role));
  set('opObjective',objectiveCommand(team,role));
  set('opFight',fightCommand(team));
  set('opMissionCue',oneLine(mission?.cue,100)||'STAY WITH YOUR CURRENT DEVELOPMENT FOCUS');

  toggle('opStrategyLock',paid);
  toggle('opRoleWin',!hasRoleWin);
  toggle('opCompPlanChip',!hasRoleWin);
  toggle('opJob',hasRoleWin);
  toggle('opSimpleFlow',hasRoleWin);
  toggle('opPaidWin',!paid||hasRoleWin);
  toggle('opPaidLoss',!paid);
  toggle('opDeepRead',!hasDeep);
  if(paid){
    if(!hasRoleWin)set('opYourWin',ourWinCommand(team,matchup));
    set('opVsTeam',theirWinCommand(team));
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