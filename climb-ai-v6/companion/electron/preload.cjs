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
#opMissionReminders{margin-top:12px;padding:18px 20px;border-left:2px solid #d6ff2f;background:linear-gradient(180deg,rgba(12,17,22,.98),rgba(8,12,16,.98))}#opMissionReminders.hidden{display:none!important}.op-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px}.op-kicker{font-size:8px;letter-spacing:.2em;font-weight:900;color:#7f8a96;text-transform:uppercase}.op-head h3{margin:5px 0 0;font-size:20px;letter-spacing:-.03em;text-transform:uppercase}.op-rank{font-size:8px;letter-spacing:.15em;font-weight:900;color:#d6ff2f;border:1px solid rgba(214,255,47,.2);padding:7px 9px;text-transform:uppercase}.op-draft{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:11px}.op-chip{font-size:8px;letter-spacing:.11em;text-transform:uppercase;border:1px solid rgba(255,255,255,.07);padding:7px 9px;color:#9aa7b2;background:rgba(255,255,255,.018)}.op-chip b{color:#e8eef2}.op-flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.op-step{position:relative;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.018);padding:13px 13px 14px;min-height:94px}.op-step:before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:#d6ff2f}.op-step:nth-child(2):before,.op-step:nth-child(3):before{background:#4c91ff}.op-step span{display:block;font-size:7px;letter-spacing:.16em;font-weight:900;color:#6f7d88;text-transform:uppercase;margin-bottom:7px}.op-step strong{display:block;font-size:13px;line-height:1.33;color:#f5f8fa}.op-bottom{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.op-win{border:1px solid rgba(255,255,255,.08);padding:12px 13px;background:rgba(255,255,255,.014)}.op-win span{display:block;font-size:7px;letter-spacing:.16em;font-weight:900;text-transform:uppercase;margin-bottom:6px}.op-win strong{display:block;font-size:11px;line-height:1.4;color:#eef3f6}.op-win.ours span{color:#d6ff2f}.op-win.theirs span{color:#ff8c8c}.op-mission{margin-top:8px;border:1px solid rgba(214,255,47,.22);background:rgba(214,255,47,.035);padding:12px 13px}.op-mission span{display:block;font-size:7px;letter-spacing:.16em;font-weight:900;color:#d6ff2f;text-transform:uppercase}.op-mission strong{display:block;margin-top:6px;font-size:14px;color:#f6f9fa;line-height:1.35}.op-foot{margin-top:9px;text-align:center;font-size:7px;letter-spacing:.14em;color:#51606d;text-transform:uppercase}#opLevelUp{position:fixed;z-index:9999;top:22px;left:50%;transform:translateX(-50%);width:min(620px,calc(100vw - 32px));padding:20px 22px;border:1px solid rgba(214,255,47,.45);border-left:3px solid #d6ff2f;background:linear-gradient(145deg,rgba(13,19,24,.985),rgba(7,11,15,.985));box-shadow:0 22px 70px rgba(0,0,0,.48)}#opLevelUp.hidden{display:none!important}.op-level-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.op-level-kicker{font-size:8px;letter-spacing:.22em;font-weight:900;color:#d6ff2f;text-transform:uppercase}.op-level-title{margin:6px 0 6px;font-size:28px;line-height:1;letter-spacing:-.04em;text-transform:uppercase}.op-level-copy{margin:0;color:#aeb8c1;font-size:12px;line-height:1.55;max-width:520px}.op-level-route{display:flex;align-items:center;gap:9px;margin-top:14px;font-size:9px;letter-spacing:.14em;text-transform:uppercase;font-weight:900;color:#dce4ea}.op-level-route b{color:#d6ff2f}.op-level-close{border:0;background:transparent;color:#8995a0;font-size:18px;cursor:pointer;padding:2px 5px}@media(max-width:920px){.op-flow{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.op-flow,.op-bottom{grid-template-columns:1fr}.op-step{min-height:0}.op-level-title{font-size:23px}}`;
  document.head.appendChild(style);

  const section=document.createElement('section');
  section.id='opMissionReminders';
  section.className='card hidden';
  section.setAttribute('aria-live','polite');
  section.innerHTML=`
    <div class="op-head">
      <div><div class="op-kicker">LOCKED FROM CHAMP SELECT</div><h3 id="opMissionHeading">YOUR GAME STRATEGY</h3></div>
      <span id="opMissionRank" class="op-rank">COACH</span>
    </div>
    <div class="op-draft"><div class="op-chip">OUR STYLE · <b id="opOurIdentity">FORMING</b></div><div class="op-chip">THEIR STYLE · <b id="opTheirIdentity">FORMING</b></div></div>
    <div class="op-flow">
      <article class="op-step"><span>01 · LANE</span><strong id="opEarly">PLAY CLEAN</strong></article>
      <article class="op-step"><span>02 · MID GAME</span><strong id="opMid">CATCH → MOVE</strong></article>
      <article class="op-step"><span>03 · OBJECTIVES</span><strong id="opObjective">SET UP FIRST</strong></article>
      <article class="op-step"><span>04 · FIGHTS</span><strong id="opFight">PLAY THE FORMATION</strong></article>
    </div>
    <div class="op-bottom">
      <article class="op-win ours"><span>WE WIN IF</span><strong id="opYourWin"></strong></article>
      <article class="op-win theirs"><span>THEY WIN IF</span><strong id="opVsTeam"></strong></article>
    </div>
    <div class="op-mission"><span>YOUR CLIMB MISSION</span><strong id="opMissionCue"></strong></div>
    <div class="op-foot">READ IT ONCE · FOLLOW THE PLAN · REVIEW IT AFTER THE GAME</div>`;
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
function openingCommand(team,matchup){
  const bot=team?.botLane;
  if(bot?.laneCall&&!bot?.pending)return commandFrom(bot.laneCall.label,bot.laneCall.summary,'PLAY THE 2V2 CLEAN');
  return oneLine(firstText(matchup?.leadPlan?.create),86)||oneLine(matchup?.laneEdge?.summary,86)||'BUILD THE FIRST CLEAN EDGE';
}
function midCommand(team){return commandFrom(team?.sidelane?.label,team?.sidelane?.summary,'CATCH WAVE → RECONNECT')}
function objectiveCommand(team){
  const start=oneLine(team?.startFight,82);
  if(start)return start;
  return oneLine(team?.playAround,82)||'ARRIVE EARLY → STAY CONNECTED';
}
function fightCommand(team){return commandFrom(team?.teamfight?.label,team?.teamfight?.summary,'PLAY THE FORMATION')}
function ourWinCommand(team,matchup){return oneLine(team?.playAround,92)||oneLine(team?.yourJob,92)||oneLine(matchup?.winCondition,92)||'STAY CONNECTED AND PLAY YOUR POWER WINDOWS'}
function theirWinCommand(team){return oneLine(team?.theirWinCondition,92)||'DO NOT GIVE THEM ISOLATED TARGETS'}

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

  const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value};
  set('opMissionHeading',phase==='RECORDING'?'YOUR GAME STRATEGY':'YOUR GAME PLAN');
  set('opMissionRank',`${String(team?.coachLevel?.tier||'OP').toUpperCase()} COACH`);
  set('opOurIdentity',oneLine(team?.ourIdentity,40)||'FORMING');
  set('opTheirIdentity',oneLine(team?.theirIdentity,40)||'FORMING');
  set('opEarly',openingCommand(team,matchup));
  set('opMid',midCommand(team));
  set('opObjective',objectiveCommand(team));
  set('opFight',fightCommand(team));
  set('opYourWin',ourWinCommand(team,matchup));
  set('opVsTeam',theirWinCommand(team));
  set('opMissionCue',oneLine(mission?.cue,100)||'STAY WITH YOUR CURRENT DEVELOPMENT FOCUS');
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
