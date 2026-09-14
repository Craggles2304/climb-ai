const $=id=>document.getElementById(id);
let current=null;
let diagnosticsOpen=false;
let activeMatchupTab='overview';

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
  renderMatchup(state.matchup,state.paired);
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

function renderMatchup(matchup,paired){
  const box=$('matchup');
  const visible=Boolean(paired&&matchup);
  box.classList.toggle('hidden',!visible);
  if(!visible)return;
  $('matchupLoading').classList.toggle('hidden',matchup.status!=='LOADING');
  $('matchupError').classList.toggle('hidden',matchup.status!=='ERROR');
  $('matchupReady').classList.toggle('hidden',matchup.status!=='READY');
  if(matchup.status==='ERROR'){
    $('matchupErrorCopy').textContent=matchup.error||'OP CLIMB could not build this matchup.';
    return;
  }
  if(matchup.status!=='READY'||!matchup.plan)return;
  const plan=matchup.plan;
  $('matchupYou').textContent=plan.you?.name||matchup.champion||'You';
  $('matchupThem').textContent=plan.them?.name||matchup.opponent||'Opponent';
  $('matchupSummary').textContent=plan.laneEdge?.summary||'Your matchup plan is ready.';
  const edge=plan.laneEdge?.edge||'EVEN';
  $('matchupEdge').textContent=plan.laneEdge?.label||edge;
  $('matchupEdge').className=`edge-pill edge-${String(edge).toLowerCase()}`;
  $('matchupRole').textContent=plan.role?`${plan.role} LANE`:'LANE PLAN';
  $('matchupPatch').textContent=plan.patch?`Patch ${plan.patch}`:'Current patch';
  $('matchupSource').textContent=matchup.source==='IN_GAME'?'Lane opponent confirmed in game':'Detected from champ select';

  fillList('matchupRules',plan.rules,true);
  fillList('winCondition',plan.winCondition,true);
  fillList('leadCreate',plan.leadPlan?.create);
  fillList('leadConvert',plan.leadPlan?.convert);
  fillList('leadProtect',plan.leadPlan?.protect);
  fillList('tradeSafe',plan.trades?.safe);
  fillList('tradePressure',plan.trades?.pressure);
  fillList('tradeAvoid',plan.trades?.avoid);
  fillList('itemAhead',plan.itemPlan?.ahead);
  fillList('itemEven',plan.itemPlan?.even);
  fillList('itemBehind',plan.itemPlan?.behind);
  fillList('stateAhead',plan.states?.ahead);
  fillList('stateEven',plan.states?.even);
  fillList('stateBehind',plan.states?.behind);
  renderSpikes(plan.powerSpikes||[]);
  setMatchupTab(activeMatchupTab);
}

function fillList(id,values,numbered=false){
  const node=$(id);if(!node)return;
  node.replaceChildren();
  const items=Array.isArray(values)?values.filter(Boolean):[];
  for(const value of items){
    const li=document.createElement('li');
    if(numbered){const text=document.createElement('span');text.textContent=String(value);li.appendChild(text)}
    else li.textContent=String(value);
    node.appendChild(li);
  }
  if(!items.length){const li=document.createElement('li');li.textContent='No reliable matchup read available for this section yet.';node.appendChild(li)}
}

function renderSpikes(spikes){
  const root=$('powerSpikes');root.replaceChildren();
  for(const spike of spikes){
    const card=document.createElement('article');
    card.className=`spike-card edge-${String(spike.edge||'EVEN').toLowerCase()}`;
    const top=document.createElement('div');top.className='spike-top';
    const level=document.createElement('strong');level.textContent=`LV ${spike.level}`;
    const tag=document.createElement('span');tag.textContent=spike.label||'CONTESTED';
    top.append(level,tag);
    const fight=document.createElement('h3');fight.textContent=spike.fight||'Create an advantage before committing.';
    const lead=document.createElement('p');lead.className='spike-lead';lead.textContent=spike.createLead||'';
    const avoid=document.createElement('p');avoid.className='spike-avoid';avoid.textContent=spike.avoid||'';
    card.append(top,fight,lead,avoid);
    const facts=Array.isArray(spike.facts)?spike.facts.filter(Boolean):[];
    if(facts.length){
      const details=document.createElement('details');
      const summary=document.createElement('summary');summary.textContent='WHY THIS LEVEL';details.appendChild(summary);
      const list=document.createElement('ul');
      for(const fact of facts){const li=document.createElement('li');li.textContent=fact;list.appendChild(li)}
      details.appendChild(list);card.appendChild(details);
    }
    root.appendChild(card);
  }
}

function setMatchupTab(name){
  activeMatchupTab=name;
  document.querySelectorAll('[data-matchup-tab]').forEach(button=>button.classList.toggle('active',button.dataset.matchupTab===name));
  document.querySelectorAll('[data-matchup-panel]').forEach(panel=>panel.classList.toggle('hidden',panel.dataset.matchupPanel!==name));
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
document.querySelectorAll('[data-matchup-tab]').forEach(button=>button.addEventListener('click',()=>setMatchupTab(button.dataset.matchupTab)));

boot();
