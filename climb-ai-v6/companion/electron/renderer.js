const $=id=>document.getElementById(id);
let current=null;
let diagnosticsOpen=false;

function phaseTitle(phase){
  return ({
    SETUP:'Connect this PC',STARTING:'Starting Companion',WAITING:'Ready for League',
    CHAMP_SELECT:'Champ select detected',RECORDING:'Recording your match',UPLOADING:'Building your review',
    RESTARTING:'Restarting tracker',AUTH_ERROR:'Re-pair required',ERROR:'Tracker needs attention'
  })[phase]||'OP CLIMB Companion';
}
function modeLabel(phase){
  return ({
    SETUP:'Setup',STARTING:'Starting',WAITING:'Waiting',CHAMP_SELECT:'Champ Select',
    RECORDING:'Live Recording',UPLOADING:'Post-game',RESTARTING:'Restarting',AUTH_ERROR:'Pairing Error',ERROR:'Error'
  })[phase]||phase;
}
function render(state){
  current=state;
  $('setup').classList.toggle('hidden',state.paired);
  $('status').classList.toggle('hidden',!state.paired);
  $('settings').classList.toggle('hidden',!state.paired);
  if(!state.paired)return;
  $('statusTitle').textContent=phaseTitle(state.phase);
  $('statusCopy').textContent=state.detail||'Companion is running.';
  $('trackerState').textContent=state.trackerRunning?'Running':'Stopped';
  $('modeState').textContent=modeLabel(state.phase);
  $('statusPill').textContent=modeLabel(state.phase).toUpperCase();
  $('statusPill').classList.toggle('good',['WAITING','CHAMP_SELECT','RECORDING','UPLOADING'].includes(state.phase));
  $('statusPill').classList.toggle('bad',['AUTH_ERROR','ERROR','RESTARTING'].includes(state.phase));
  $('autoStart').classList.toggle('on',Boolean(state.autoStart));
  const rows=Array.isArray(state.logs)?state.logs:[];
  $('logs').textContent=rows.length?rows.map(row=>`[${new Date(row.at).toLocaleTimeString()}] ${row.line}`).join('\n'):'No tracker activity yet.';
}

async function boot(){
  render(await window.opCompanion.getState());
  window.opCompanion.onState(render);
}

$('openSetup').addEventListener('click',()=>window.opCompanion.openClimb());
$('openClimb').addEventListener('click',()=>window.opCompanion.openClimb());
$('restart').addEventListener('click',()=>window.opCompanion.restart());
$('unpair').addEventListener('click',async()=>{
  if(confirm('Unpair this PC from OP CLIMB? You can reconnect it from the Live Companion page.'))await window.opCompanion.unpair();
});
$('autoStart').addEventListener('click',async()=>{await window.opCompanion.setAutoStart(!current?.autoStart)});
$('showLogs').addEventListener('click',()=>{
  diagnosticsOpen=!diagnosticsOpen;
  $('logs').classList.toggle('hidden',!diagnosticsOpen);
  $('showLogs').textContent=diagnosticsOpen?'HIDE DIAGNOSTICS':'DIAGNOSTICS';
});

boot();
