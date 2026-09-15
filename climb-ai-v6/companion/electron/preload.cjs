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
  onState:(handler)=>{
    const listener=(_event,state)=>handler(state);
    ipcRenderer.on('companion:state',listener);
    return()=>ipcRenderer.removeListener('companion:state',listener);
  },
  onUpdateState:(handler)=>{
    const listener=(_event,state)=>handler(state);
    ipcRenderer.on('companion:update-state',listener);
    return()=>ipcRenderer.removeListener('companion:update-state',listener);
  }
});

function installMissionReminderView(){
  if(document.getElementById('op-mission-reminder-style'))return;
  const style=document.createElement('style');
  style.id='op-mission-reminder-style';
  style.textContent=`
    #opMissionReminders{margin-top:12px;padding:18px 20px;border-left:2px solid #d6ff2f;background:linear-gradient(180deg,rgba(12,17,22,.98),rgba(8,12,16,.98));}
    #opMissionReminders.hidden{display:none!important}
    .op-mission-head{display:flex;align-items:end;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:13px}
    .op-mission-kicker{font-size:8px;letter-spacing:.22em;font-weight:900;color:#7f8a96;text-transform:uppercase}
    .op-mission-head h3{margin:5px 0 0;font-size:17px;letter-spacing:-.02em;text-transform:uppercase}
    .op-mission-rank{font-size:8px;letter-spacing:.16em;font-weight:900;color:#d6ff2f;text-transform:uppercase;border:1px solid rgba(214,255,47,.2);padding:7px 9px}
    .op-mission-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
    .op-mission-card{min-height:96px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.018);padding:12px 13px;position:relative;overflow:hidden}
    .op-mission-card:before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:rgba(214,255,47,.72)}
    .op-mission-card small{display:block;font-size:7px;letter-spacing:.18em;font-weight:900;color:#6f7b86;text-transform:uppercase;margin-bottom:6px}
    .op-mission-card b{display:block;font-size:10px;letter-spacing:.06em;color:#b4bec8;text-transform:uppercase;margin-bottom:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .op-mission-card p{margin:0;font-size:13px;line-height:1.35;font-weight:800;color:#f1f5f7}
    .op-mission-foot{margin-top:10px;font-size:7px;letter-spacing:.18em;color:#51606d;text-align:center;text-transform:uppercase}
    @media(max-width:760px){.op-mission-grid{grid-template-columns:1fr}.op-mission-card{min-height:0}}
  `;
  document.head.appendChild(style);

  const section=document.createElement('section');
  section.id='opMissionReminders';
  section.className='card hidden';
  section.setAttribute('aria-live','polite');
  section.innerHTML=`
    <div class="op-mission-head">
      <div><div class="op-mission-kicker">ACTIVE FIVE · IN-GAME REMINDERS</div><h3>Three things to keep in your head</h3></div>
      <span id="opMissionRank" class="op-mission-rank">COACH</span>
    </div>
    <div id="opMissionGrid" class="op-mission-grid"></div>
    <div class="op-mission-foot">Your missions stay the focus. OP CLIMB records the evidence in the background.</div>`;
  const status=document.getElementById('status');
  if(status)status.insertAdjacentElement('afterend',section);
  else document.querySelector('main')?.appendChild(section);
}

function renderMissionReminders(state){
  installMissionReminderView();
  const section=document.getElementById('opMissionReminders');
  const grid=document.getElementById('opMissionGrid');
  const rank=document.getElementById('opMissionRank');
  if(!section||!grid)return;
  const phase=String(state?.phase||'');
  const tips=Array.isArray(state?.teamPlan?.missionTips)?state.teamPlan.missionTips.slice(0,3):[];
  const visible=phase==='RECORDING'&&tips.length>0;
  section.classList.toggle('hidden',!visible);
  if(!visible)return;

  const coach=state?.teamPlan?.coachLevel||{};
  if(rank)rank.textContent=`${String(coach.tier||'COACH').toUpperCase()} · 3 MISSION CUES`;
  grid.replaceChildren();
  tips.forEach((tip,index)=>{
    const card=document.createElement('article');
    card.className='op-mission-card';
    const number=document.createElement('small');
    number.textContent=`MISSION ${String(index+1).padStart(2,'0')}`;
    const title=document.createElement('b');
    title.textContent=String(tip?.title||`Mission ${index+1}`);
    const cue=document.createElement('p');
    cue.textContent=String(tip?.cue||'').trim();
    card.append(number,title,cue);
    grid.appendChild(card);
  });
}

window.addEventListener('DOMContentLoaded',()=>{
  installMissionReminderView();
  ipcRenderer.invoke('companion:get-state').then(renderMissionReminders).catch(()=>{});
  ipcRenderer.on('companion:state',(_event,state)=>renderMissionReminders(state));
});
