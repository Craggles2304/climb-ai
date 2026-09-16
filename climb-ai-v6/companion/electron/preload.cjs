const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('opCompanion',{
  getState:()=>ipcRenderer.invoke('companion:get-state'),unpair:()=>ipcRenderer.invoke('companion:unpair'),restart:()=>ipcRenderer.invoke('companion:restart'),setAutoStart:(enabled)=>ipcRenderer.invoke('companion:auto-start',enabled),openClimb:()=>ipcRenderer.invoke('companion:open-climb'),getUpdateState:()=>ipcRenderer.invoke('companion:update-state'),checkUpdate:()=>ipcRenderer.invoke('companion:check-update'),downloadUpdate:()=>ipcRenderer.invoke('companion:download-update'),installUpdate:(phase)=>ipcRenderer.invoke('companion:install-update',phase),simulateBotLane:(context)=>ipcRenderer.invoke('companion:botlane-sim',context),
  onState:(handler)=>{const listener=(_event,state)=>handler(state);ipcRenderer.on('companion:state',listener);return()=>ipcRenderer.removeListener('companion:state',listener)},
  onUpdateState:(handler)=>{const listener=(_event,state)=>handler(state);ipcRenderer.on('companion:update-state',listener);return()=>ipcRenderer.removeListener('companion:update-state',listener)}
});

let dismissedRankKey='';

function installMissionReminderView(){
  if(document.getElementById('op-mission-reminder-style'))return;
  const style=document.createElement('style');
  style.id='op-mission-reminder-style';
  style.textContent=`
#opMissionReminders{margin-top:12px;padding:18px 20px;border-left:2px solid #d6ff2f;background:linear-gradient(180deg,rgba(12,17,22,.98),rgba(8,12,16,.98));}#opMissionReminders.hidden{display:none!important}.op-mission-head{display:flex;align-items:end;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:13px}.op-mission-kicker{font-size:8px;letter-spacing:.22em;font-weight:900;color:#7f8a96;text-transform:uppercase}.op-mission-head h3{margin:5px 0 0;font-size:20px;letter-spacing:-.025em;text-transform:uppercase}.op-mission-sub{margin:5px 0 0;font-size:10px;line-height:1.45;color:#687683;max-width:760px}.op-mission-rank{font-size:8px;letter-spacing:.16em;font-weight:900;color:#d6ff2f;text-transform:uppercase;border:1px solid rgba(214,255,47,.2);padding:7px 9px}.op-draft-strip{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin:4px 0 12px;padding:10px 12px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.015)}.op-draft-strip div{min-width:0}.op-draft-strip span{display:block;font-size:7px;letter-spacing:.15em;color:#687683;text-transform:uppercase;font-weight:900}.op-draft-strip strong{display:block;margin-top:4px;font-size:11px;color:#dce4e9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.op-draft-vs{font-size:8px!important;color:#d6ff2f!important;letter-spacing:.18em!important}.op-strategy-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.op-strategy-card{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.018);padding:14px;min-height:126px;position:relative;overflow:hidden}.op-strategy-card:before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:rgba(214,255,47,.72)}.op-strategy-card.blue:before{background:rgba(76,145,255,.8)}.op-strategy-card.danger:before{background:rgba(255,103,103,.82)}.op-strategy-card b{display:block;font-size:8px;letter-spacing:.16em;color:#d6ff2f;text-transform:uppercase;margin-bottom:7px}.op-strategy-card.blue b{color:#74a9ff}.op-strategy-card.danger b{color:#ff8c8c}.op-strategy-card strong{display:block;font-size:12px;line-height:1.4;color:#f1f5f7;margin-bottom:6px}.op-strategy-card p{margin:0;color:#aeb9c2;font-size:10px;line-height:1.5}.op-win-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:9px}.op-win-card{border:1px solid rgba(255,255,255,.08);padding:14px;background:rgba(255,255,255,.016)}.op-win-card span{display:block;font-size:8px;letter-spacing:.16em;text-transform:uppercase;font-weight:900;margin-bottom:7px}.op-win-card.ours span{color:#d6ff2f}.op-win-card.theirs span{color:#ff8c8c}.op-win-card strong{display:block;font-size:12px;line-height:1.45;color:#eef3f6}.op-win-card small{display:block;margin-top:7px;font-size:9px;line-height:1.4;color:#687683}.op-mission-lock{margin-top:10px;border:1px solid rgba(214,255,47,.22);background:rgba(214,255,47,.035);padding:13px 14px}.op-mission-lock span{display:block;font-size:8px;letter-spacing:.17em;font-weight:900;color:#d6ff2f;text-transform:uppercase}.op-mission-lock strong{display:block;margin-top:6px;font-size:14px;color:#f6f9fa}.op-mission-lock p{margin:5px 0 0;color:#8d99a4;font-size:9px}.op-mission-foot{margin-top:11px;font-size:7px;letter-spacing:.16em;color:#51606d;text-align:center;text-transform:uppercase}#opLevelUp{position:fixed;z-index:9999;top:22px;left:50%;transform:translateX(-50%);width:min(620px,calc(100vw - 32px));padding:20px 22px;border:1px solid rgba(214,255,47,.45);border-left:3px solid #d6ff2f;background:linear-gradient(145deg,rgba(13,19,24,.985),rgba(7,11,15,.985));box-shadow:0 22px 70px rgba(0,0,0,.48)}#opLevelUp.hidden{display:none!important}.op-level-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.op-level-kicker{font-size:8px;letter-spacing:.22em;font-weight:900;color:#d6ff2f;text-transform:uppercase}.op-level-title{margin:6px 0 6px;font-size:28px;line-height:1;letter-spacing:-.04em;text-transform:uppercase}.op-level-copy{margin:0;color:#aeb8c1;font-size:12px;line-height:1.55;max-width:520px}.op-level-route{display:flex;align-items:center;gap:9px;margin-top:14px;font-size:9px;letter-spacing:.14em;text-transform:uppercase;font-weight:900;color:#dce4ea}.op-level-route b{color:#d6ff2f}.op-level-close{border:0;background:transparent;color:#8995a0;font-size:18px;cursor:pointer;padding:2px 5px}@media(max-width:760px){.op-strategy-grid,.op-win-grid{grid-template-columns:1fr}.op-draft-strip{grid-template-columns:1fr}.op-draft-vs{display:none!important}.op-level-title{font-size:23px}}`;
  document.head.appendChild(style);

  const section=document.createElement('section');
  section.id='opMissionReminders';
  section.className='card hidden';
  section.setAttribute('aria-live','polite');
  section.innerHTML=`
    <div class="op-mission-head">
      <div>
        <div class="op-mission-kicker">CHAMP SELECT · LOCKED GAME STRATEGY</div>
        <h3 id="opMissionHeading">HOW THIS GAME SHOULD BE PLAYED</h3>
        <p class="op-mission-sub">Built from the locked draft. Follow the same plan from loading screen to Nexus — it does not react to hidden cooldowns or live positioning.</p>
      </div>
      <span id="opMissionRank" class="op-mission-rank">COACH</span>
    </div>
    <div class="op-draft-strip">
      <div><span>OUR STYLE</span><strong id="opOurIdentity">Composition forming</strong></div>
      <span class="op-draft-vs">VS</span>
      <div><span>THEIR STYLE</span><strong id="opTheirIdentity">Composition forming</strong></div>
    </div>
    <div class="op-strategy-grid">
      <article class="op-strategy-card"><b>01 · OPENING / LANE</b><strong id="opEarlyTitle">BUILD THE FIRST CLEAN EDGE</strong><p id="opEarly"></p></article>
      <article class="op-strategy-card blue"><b>02 · MID GAME / MAP</b><strong id="opMidTitle">CATCH → MOVE</strong><p id="opMid"></p></article>
      <article class="op-strategy-card blue"><b>03 · OBJECTIVE SETUP</b><strong id="opObjectiveTitle">ARRIVE CONNECTED</strong><p id="opObjective"></p></article>
      <article class="op-strategy-card"><b>04 · TEAMFIGHTS</b><strong id="opFightTitle">PLAY THE FORMATION</strong><p id="opFight"></p></article>
    </div>
    <div class="op-win-grid">
      <article class="op-win-card theirs"><span>THEY WIN IF</span><strong id="opVsTeam"></strong><small id="opVsTeamWhy"></small></article>
      <article class="op-win-card ours"><span>WE WIN IF</span><strong id="opYourWin"></strong><small id="opYourWinWhy"></small></article>
    </div>
    <div class="op-mission-lock"><span>CLIMB MISSION · YOUR DEVELOPMENT FOCUS</span><strong id="opMissionCue"></strong><p id="opMissionWhy"></p></div>
    <div class="op-mission-foot">GAME STRATEGY LOCKED PRE-GAME · NO REACTIVE SHOTCALLING · POST-GAME EVIDENCE UPDATES YOUR ACTIVE FIVE</div>`;
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
function labelled(label,summary,fallbackTitle){return{title:firstText(label)||fallbackTitle,copy:firstText(summary)}}
function openingStrategy(team,matchup){
  const bot=team?.botLane;
  if(bot?.laneCall?.summary&&!bot?.pending)return labelled(bot.laneCall.label,bot.laneCall.summary,'PLAY THE 2V2 PLAN');
  const create=firstText(matchup?.leadPlan?.create);
  if(create)return{title:'CREATE THE FIRST EDGE',copy:create};
  const lane=firstText(matchup?.laneEdge?.summary);
  if(lane)return{title:'PLAY YOUR POWER WINDOW',copy:lane};
  return{title:'START CLEAN',copy:firstText(team?.yourJob)||'Use the first safe advantage. Do not force the game before your champion and wave give you permission.'};
}
function midStrategy(team){
  return labelled(team?.sidelane?.label,team?.sidelane?.summary,'CATCH → MOVE');
}
function objectiveStrategy(team){
  const playAround=firstText(team?.playAround);
  const firstContact=firstText(team?.startFight);
  return{title:'SET UP BEFORE YOU FIGHT',copy:playAround||firstContact||'Arrive connected before the objective. Let the team shape create the fight instead of walking in one at a time.'};
}
function fightStrategy(team){
  const base=labelled(team?.teamfight?.label,team?.teamfight?.summary,'PLAY THE FORMATION');
  const job=firstText(team?.yourJob);
  return{title:base.title,copy:base.copy||(job||'Stay connected to the formation and make the first clean fight easy for your carries.')};
}

function renderMissionReminders(state){
  installMissionReminderView();
  const section=document.getElementById('opMissionReminders');
  if(!section)return;
  const phase=String(state?.phase||'');
  const team=state?.teamPlan||null;
  const matchup=state?.matchup?.plan||null;
  const tips=Array.isArray(team?.missionTips)?team.missionTips:[];
  const mission=tips[0]||null;
  const visible=(phase==='CHAMP_SELECT'||phase==='RECORDING')&&Boolean(team||matchup||mission);
  section.classList.toggle('hidden',!visible);
  if(!visible)return;

  const coach=team?.coachLevel||{};
  const rank=document.getElementById('opMissionRank');
  if(rank)rank.textContent=`${String(coach.tier||'OP').toUpperCase()} COACH`;
  const heading=document.getElementById('opMissionHeading');
  if(heading)heading.textContent=phase==='RECORDING'?'YOUR GAME STRATEGY':'HOW THIS GAME SHOULD BE PLAYED';

  const early=openingStrategy(team,matchup),mid=midStrategy(team),objective=objectiveStrategy(team),fight=fightStrategy(team);
  const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value};
  set('opOurIdentity',firstText(team?.ourIdentity)||'Our composition is still forming');
  set('opTheirIdentity',firstText(team?.theirIdentity)||'Enemy composition is still forming');
  set('opEarlyTitle',early.title);set('opEarly',early.copy||'Use the first safe advantage and avoid donating tempo before your power window.');
  set('opMidTitle',mid.title);set('opMid',mid.copy||'Collect the safe wave, then reconnect before the next important move.');
  set('opObjectiveTitle',objective.title);set('opObjective',objective.copy);
  set('opFightTitle',fight.title);set('opFight',fight.copy);

  const theirWin=firstText(team?.theirWinCondition)||'Do not give them isolated targets or a disconnected formation for free.';
  const theirThrow=firstText(team?.biggestThrow);
  const yourWin=firstText(team?.playAround)||firstText(matchup?.winCondition)||firstText(team?.yourJob)||'Play your role around your champion power windows and keep the team connected.';
  const yourExtra=firstText(team?.yourJob)||firstText(matchup?.winCondition);
  set('opVsTeam',theirWin);
  set('opVsTeamWhy',theirThrow?`Biggest throw: ${theirThrow}`:firstText(team?.note));
  set('opYourWin',yourWin);
  set('opYourWinWhy',yourExtra&&yourExtra!==yourWin?`Your job: ${yourExtra}`:'');
  set('opMissionCue',firstText(mission?.cue)||'Stay with your current development focus.');
  set('opMissionWhy',mission?.title?`${String(mission.title)} · ${firstText(mission.evidence)||'This is the behaviour your current development plan is training.'}`:'Your Climb Mission stays separate from the match strategy and is reviewed after the game.');
}

function renderLevelUp(state){
  installMissionReminderView();
  const section=document.getElementById('opLevelUp');
  const change=state?.postGameReview?.rankChange;
  window.__opLastRankChange=change||null;
  if(!section||String(state?.phase||'')!=='REVIEW'||!change?.movedUp){section?.classList.add('hidden');return}
  const key=`${change.previous}|${change.current}`;
  if(key===dismissedRankKey){section.classList.add('hidden');return}
  const title=document.getElementById('opLevelTitle'),copy=document.getElementById('opLevelCopy'),route=document.getElementById('opLevelRoute'),tier=String(change.currentTier||'').toUpperCase();
  if(title)title.textContent=change.coachingLayerChanged?`YOU'VE REACHED ${tier}`:`RANK UP · ${tier} ${String(change.currentDivision||'')}`.trim();
  if(copy)copy.textContent=change.coachingLayerChanged?`Your Coach has levelled up with you. From your next game, OP CLIMB will use ${tier}-level detail, standards and feedback automatically.`:`Nice step up. Your ${tier} coaching layer stays focused, and OP CLIMB has recorded the division change automatically.`;
  if(route)route.innerHTML=`<span>${escapeHtml(change.previous)}</span><span>→</span><b>${escapeHtml(change.current)}</b>`;
  section.classList.remove('hidden');
}
function escapeHtml(value){return String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function renderCompanionExtras(state){renderMissionReminders(state);renderLevelUp(state)}
window.addEventListener('DOMContentLoaded',()=>{installMissionReminderView();ipcRenderer.invoke('companion:get-state').then(renderCompanionExtras).catch(()=>{});ipcRenderer.on('companion:state',(_event,state)=>renderCompanionExtras(state))});
