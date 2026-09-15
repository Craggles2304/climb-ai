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
    .op-mission-head h3{margin:5px 0 0;font-size:18px;letter-spacing:-.025em;text-transform:uppercase}
    .op-mission-sub{margin:5px 0 0;font-size:10px;line-height:1.45;color:#687683}
    .op-mission-rank{font-size:8px;letter-spacing:.16em;font-weight:900;color:#d6ff2f;text-transform:uppercase;border:1px solid rgba(214,255,47,.2);padding:7px 9px}
    .op-mission-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
    .op-mission-card{min-height:178px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.018);padding:13px 14px;position:relative;overflow:hidden}
    .op-mission-card:before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:rgba(214,255,47,.72)}
    .op-mission-number{display:block;font-size:7px;letter-spacing:.18em;font-weight:900;color:#6f7b86;text-transform:uppercase;margin-bottom:6px}
    .op-mission-title{display:block;font-size:10px;letter-spacing:.06em;color:#b4bec8;text-transform:uppercase;margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .op-coach-row{border-top:1px solid rgba(255,255,255,.055);padding-top:8px;margin-top:8px}
    .op-coach-row:first-of-type{border-top:0;padding-top:0;margin-top:0}
    .op-coach-label{display:block;font-size:7px;letter-spacing:.17em;font-weight:900;color:#697784;text-transform:uppercase;margin-bottom:4px}
    .op-coach-copy{margin:0;font-size:11px;line-height:1.4;color:#dbe2e8}
    .op-coach-now .op-coach-label{color:#d6ff2f}
    .op-coach-now .op-coach-copy{font-size:13px;font-weight:850;color:#f5f8fa}
    .op-coach-next .op-coach-label{color:#74a9ff}
    .op-coach-evidence{margin-top:9px;font-size:7px;line-height:1.45;letter-spacing:.06em;color:#596773}
    .op-mission-foot{margin-top:11px;font-size:7px;letter-spacing:.16em;color:#51606d;text-align:center;text-transform:uppercase}
    @media(max-width:760px){.op-mission-grid{grid-template-columns:1fr}.op-mission-card{min-height:0}}
  `;
  document.head.appendChild(style);

  const section=document.createElement('section');
  section.id='opMissionReminders';
  section.className='card hidden';
  section.setAttribute('aria-live','polite');
  section.innerHTML=`
    <div class="op-mission-head">
      <div>
        <div class="op-mission-kicker">ACTIVE FIVE · LIVE COACHING</div>
        <h3>Your three decisions right now</h3>
        <p class="op-mission-sub">OP CLIMB updates these from this match, your tracked patterns and what your next coaching level demands.</p>
      </div>
      <span id="opMissionRank" class="op-mission-rank">COACH</span>
    </div>
    <div id="opMissionGrid" class="op-mission-grid"></div>
    <div class="op-mission-foot">Live evidence changes the cue. Your Active Five decides what OP CLIMB coaches.</div>`;
  const status=document.getElementById('status');
  if(status)status.insertAdjacentElement('afterend',section);
  else document.querySelector('main')?.appendChild(section);
}

function row(label,text,className=''){
  const wrap=document.createElement('div');wrap.className=`op-coach-row ${className}`.trim();
  const heading=document.createElement('span');heading.className='op-coach-label';heading.textContent=label;
  const copy=document.createElement('p');copy.className='op-coach-copy';copy.textContent=String(text||'').trim();
  wrap.append(heading,copy);return wrap;
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
  const depth=Math.max(1,Math.min(10,Number(coach.depth)||3));
  const current=String(coach.tier||'COACH').toUpperCase();
  const next=String(coach.nextTier||'NEXT').toUpperCase();
  if(rank)rank.textContent=current===next?`${current} · MASTERY`:`${current} → ${next}`;
  grid.replaceChildren();

  tips.forEach((tip,index)=>{
    const card=document.createElement('article');card.className='op-mission-card';
    const number=document.createElement('span');number.className='op-mission-number';number.textContent=`PRIORITY ${String(index+1).padStart(2,'0')} · ${String(tip?.category||'MISSION')}`;
    const title=document.createElement('b');title.className='op-mission-title';title.textContent=String(tip?.title||`Mission ${index+1}`);
    card.append(number,title);

    if(depth>=2&&tip?.liveRead)card.append(row('LIVE READ',tip.liveRead));
    card.append(row('DO THIS NOW',tip?.cue||'Stay with the mission and make the next clean decision.','op-coach-now'));
    if(tip?.nextLevel)card.append(row(current===next?'MASTERY STANDARD':`${next} STANDARD`,tip.nextLevel,'op-coach-next'));
    if(depth>=6&&tip?.evidence){const evidence=document.createElement('div');evidence.className='op-coach-evidence';evidence.textContent=String(tip.evidence);card.appendChild(evidence)}
    grid.appendChild(card);
  });
}

window.addEventListener('DOMContentLoaded',()=>{
  installMissionReminderView();
  ipcRenderer.invoke('companion:get-state').then(renderMissionReminders).catch(()=>{});
  ipcRenderer.on('companion:state',(_event,state)=>renderMissionReminders(state));
});