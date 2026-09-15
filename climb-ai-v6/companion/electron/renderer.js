const $=id=>document.getElementById(id);
let current=null;
let updateState=null;
let diagnosticsOpen=false;
let activeMatchupTab='overview';
let botLaneSimSignature='';
let botLaneSim=null;
let botLaneSimLoading=false;

function phaseTitle(phase){
  return ({SETUP:'Connect this PC',STARTING:'Starting Companion',WAITING:'Ready for League',CHAMP_SELECT:'Champ select detected',RECORDING:'Recording your match',UPLOADING:'Building your review',RESTARTING:'Restarting tracker',AUTH_ERROR:'Re-pair required',ERROR:'Tracker needs attention'})[phase]||'OP CLIMB Companion';
}
function modeLabel(phase){
  return ({SETUP:'Setup',STARTING:'Starting',WAITING:'Waiting',CHAMP_SELECT:'Champ Select',RECORDING:'Live Recording',UPLOADING:'Post-game',RESTARTING:'Restarting',AUTH_ERROR:'Pairing Error',ERROR:'Error'})[phase]||phase;
}

function render(state){
  current=state;
  $('setup').classList.toggle('hidden',state.paired);
  $('status').classList.toggle('hidden',!state.paired);
  $('settings').classList.toggle('hidden',!state.paired);
  renderMatchup(state.matchup,state.teamPlan,state.paired);
  renderUpdate(updateState,state.phase);
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

function renderUpdate(next,phase){
  if(next)updateState=next;
  const update=updateState||{status:'IDLE',currentVersion:'—',latestVersion:null,progress:0,error:null};
  const status=String(update.status||'IDLE');
  const version=update.currentVersion?`v${update.currentVersion}`:'Current version';
  const latest=update.latestVersion?`v${update.latestVersion}`:'';
  const busy=['CHAMP_SELECT','RECORDING','UPLOADING'].includes(String(phase||''));
  const copy={IDLE:`${version} · Automatic update checks are enabled.`,CHECKING:`${version} · Checking for a newer Companion…`,CURRENT:`${version} · You're up to date.`,AVAILABLE:`${latest||'A new version'} is ready to download.`,DOWNLOADING:`Downloading ${latest||'update'} · ${Math.round(Number(update.progress)||0)}%`,READY:busy?`${latest||'Update'} downloaded. Finish the current League session before restarting.`:`${latest||'Update'} downloaded and ready.`,INSTALLING:'Restarting into the new version…',ERROR:update.error||'The update check failed. Your current Companion will keep working.'}[status]||`${version} · Automatic update checks are enabled.`;
  $('updateCopy').textContent=copy;
  $('updateVersion').textContent=version;
  $('checkUpdate').classList.toggle('hidden',!['IDLE','CURRENT','ERROR'].includes(status));
  $('downloadUpdate').classList.toggle('hidden',status!=='AVAILABLE');
  $('installUpdate').classList.toggle('hidden',status!=='READY');
  $('checkUpdate').disabled=status==='CHECKING';
  $('downloadUpdate').disabled=status==='DOWNLOADING';
  $('installUpdate').disabled=busy;
  $('installUpdate').textContent=busy?'FINISH GAME TO UPDATE':'RESTART & UPDATE';
  $('updateProgress').classList.toggle('hidden',status!=='DOWNLOADING');
  $('updateProgressBar').style.width=`${Math.max(0,Math.min(100,Number(update.progress)||0))}%`;
}

function renderMatchup(matchup,teamPlan,paired){
  const box=$('matchup');
  const visible=Boolean(paired&&matchup);
  box.classList.toggle('hidden',!visible);
  if(!visible)return;
  $('matchupLoading').classList.toggle('hidden',matchup.status!=='LOADING');
  $('matchupError').classList.toggle('hidden',matchup.status!=='ERROR');
  $('matchupReady').classList.toggle('hidden',matchup.status!=='READY');
  if(matchup.status==='ERROR'){
    $('matchupErrorCopy').textContent=matchup.error||'OP CLIMB could not build this plan.';
    return;
  }
  if(matchup.status!=='READY'||!matchup.plan)return;
  const plan=matchup.plan;
  const hasOpponent=Boolean(matchup.opponent&&matchup.source!=='CHAMPION_LOCK');
  $('matchupYou').textContent=plan.you?.name||matchup.champion||'You';
  $('matchupThem').textContent=hasOpponent?(plan.them?.name||matchup.opponent):'OPPONENT PENDING';
  $('matchupVs').textContent=hasOpponent?'VS':'·';
  $('matchupSummary').textContent=plan.laneEdge?.summary||'Your pregame plan is ready.';
  const edge=plan.laneEdge?.edge||'EVEN';
  $('matchupEdge').textContent=plan.laneEdge?.label||edge;
  $('matchupEdge').className=`edge-pill edge-${String(edge).toLowerCase()}`;
  $('matchupRole').textContent=plan.role?`${plan.role} PLAN`:'GAME PLAN';
  $('matchupPatch').textContent=plan.patch?`Patch ${plan.patch}`:'Current patch';
  $('matchupSource').textContent=hasOpponent?(matchup.source==='IN_GAME'?'Lane opponent confirmed in game':'Matchup resolved from champ select'):'Champion locked · matchup will enrich automatically';
  $('deepDiveTitle').textContent=hasOpponent?'FULL MATCHUP ANALYSIS':'FULL CHAMPION ANALYSIS';

  const spikes=Array.isArray(plan.powerSpikes)?plan.powerSpikes:[];
  const first=spikes.find(spike=>Number(spike.level)===2)||spikes[0];
  const major=spikes.find(spike=>Number(spike.level)===6)||spikes.find(spike=>Number(spike.level)>2)||spikes[0];
  $('firstSpikeLevel').textContent=first?`LV ${first.level}`:'—';
  $('firstSpikeText').textContent=first?.fight||'Preserve HP and create the first clean pressure window.';
  $('majorSpikeLevel').textContent=major?`LV ${major.level}`:'—';
  $('majorSpikeText').textContent=major?.fight||'Reach the breakpoint with usable HP and resources.';
  $('leadChain').textContent='TRADE → HP → WAVE → RESET → ITEM';
  $('yourJob').textContent=teamPlan?.yourJob||fallbackJob(plan.role);

  renderLaneDuel(plan,matchup,hasOpponent);
  renderBotLane(teamPlan?.botLane||null);

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
  renderSpikes(spikes);
  renderTeamPlan(teamPlan);
  setMatchupTab(activeMatchupTab);
}

function renderLaneDuel(plan,matchup,hasOpponent){
  const root=$('laneDuelBrief');
  if(!root)return;
  root.classList.toggle('hidden',!hasOpponent);
  if(!hasOpponent)return;
  const opponent=plan.them?.name||matchup.opponent||'opponent';
  const duel=plan.laneDuel||{
    headline:`HOW TO BEAT ${String(opponent).toUpperCase()}`,
    advantage:plan.winCondition?.[0]||'Create the first HP, cooldown or wave advantage.',
    yourPattern:plan.trades?.safe?.[0]||'Take a short favourable trade, then reset spacing.',
    theirPattern:plan.trades?.avoid?.[0]||`${opponent} wants you to extend the fight on their terms.`,
    killWindow:plan.trades?.pressure?.[0]||'Commit after you have already created HP or cooldown advantage.',
    wave:plan.leadPlan?.create?.[0]||'Use the wave to make the opponent expose themselves for farm.',
    never:plan.trades?.avoid?.[1]||`Do not neutral all-in ${opponent} from an even state.`,
  };
  $('laneDuelTitle').textContent=duel.headline||`HOW TO BEAT ${String(opponent).toUpperCase()}`;
  $('laneAdvantage').textContent=duel.advantage||'';
  $('laneYourPattern').textContent=duel.yourPattern||'';
  $('laneTheirPattern').textContent=duel.theirPattern||'';
  $('laneKillWindow').textContent=duel.killWindow||'';
  $('laneWave').textContent=duel.wave||'';
  $('laneNever').textContent=duel.never||'';
}

function renderBotLane(bot){
  const root=$('botLaneBrief');
  if(!root)return;
  root.classList.toggle('hidden',!bot);
  if(!bot)return;
  $('botYourLane').textContent=`${bot.yourAdc} + ${bot.yourSupport}`;
  $('botEnemyLane').textContent=`${bot.enemyAdc} + ${bot.enemySupport}`;
  $('botOurIdentity').textContent=bot.ourIdentity||'OUR DUO';
  $('botTheirIdentity').textContent=bot.theirIdentity||'THEIR DUO';
  $('botConfidence').textContent=bot.confidence==='HIGH'?'ROLES CONFIRMED':'ROLE READ';
  $('botLaneCallLabel').textContent=bot.laneCall?.label||'PLAY THE FIRST CLEAN EDGE';
  $('botLaneCallSummary').textContent=bot.laneCall?.summary||'';
  $('botLevel2Label').textContent=bot.level2?.label||'LEVEL 2';
  $('botLevel2Summary').textContent=bot.level2?.summary||'';
  $('botTradeLabel').textContent=bot.trade?.label||'SHORT TRADE';
  $('botTradeSummary').textContent=bot.trade?.summary||'';
  $('botWaveLabel').textContent=bot.wave?.label||'CONTROL THE WAVE';
  $('botWaveSummary').textContent=bot.wave?.summary||'';
  $('botAllInLabel').textContent=bot.allIn?.label||'ALL-IN AFTER EDGE';
  $('botAllInSummary').textContent=bot.allIn?.summary||'';
  $('botDangerLabel').textContent=bot.danger?.label||'DENY THEIR ENTRY';
  $('botDangerSummary').textContent=bot.danger?.summary||'';
  $('botFocus').textContent=bot.focus||'';
  $('botRoam').textContent=bot.supportRoam||'';
  $('botRoleNote').textContent=bot.note||'';

  const sig=simulationSignature(bot.simulation);
  if(sig&&sig!==botLaneSimSignature){
    botLaneSimSignature=sig;
    botLaneSim=null;
    botLaneSimLoading=false;
  }
  renderBotLaneEngine(bot);
  if(sig&&!botLaneSim&&!botLaneSimLoading)void loadBotLaneSimulation(bot,sig);
}

function simulationSignature(context){
  if(!context)return'';
  return [context.yourAdc,context.yourSupport,context.enemyAdc,context.enemySupport].map(v=>String(v||'').trim().toLowerCase()).join('|');
}

async function loadBotLaneSimulation(bot,sig){
  if(!window.opCompanion?.simulateBotLane||!bot?.simulation)return;
  botLaneSimLoading=true;
  renderBotLaneEngine(bot);
  try{
    const result=await window.opCompanion.simulateBotLane(bot.simulation);
    if(sig!==botLaneSimSignature)return;
    botLaneSim=result||{ok:false,error:'2v2 engine returned no result.'};
  }catch(err){
    if(sig!==botLaneSimSignature)return;
    botLaneSim={ok:false,error:err?.message||'2v2 engine unavailable.'};
  }finally{
    if(sig===botLaneSimSignature){botLaneSimLoading=false;renderBotLaneEngine(bot)}
  }
}

function renderBotLaneEngine(bot){
  if(!$('botEngineState'))return;
  if(botLaneSimLoading){
    $('botEngineState').textContent='MATCHUP LAB · CALCULATING';
    $('botEngineLevel2').textContent='Running the four-champion level-2 fight shape…';
    $('botEngineLevel6').textContent='Running level-6 fight shape…';
    $('botEngineFocus').textContent='Comparing focus targets…';
    $('botEngineNote').textContent='Static pregame plan stays usable while the deeper simulation runs.';
    return;
  }
  if(!botLaneSim){
    $('botEngineState').textContent='MATCHUP LAB · READY';
    $('botEngineLevel2').textContent=bot.level2?.label||'Level 2 plan ready.';
    $('botEngineLevel6').textContent='Level 6 simulation will appear automatically.';
    $('botEngineFocus').textContent=bot.focus||'Focus the nearest safe target.';
    $('botEngineNote').textContent='Waiting for the four-champion engine.';
    return;
  }
  if(!botLaneSim.ok){
    $('botEngineState').textContent='MATCHUP LAB · STATIC PLAN ONLY';
    $('botEngineLevel2').textContent=bot.level2?.label||'Use the static level-2 plan.';
    $('botEngineLevel6').textContent='Deep 2v2 simulation unavailable for this setup.';
    $('botEngineFocus').textContent=bot.focus||'Focus the nearest safe target.';
    $('botEngineNote').textContent=botLaneSim.error||'The static 2v2 plan remains valid.';
    return;
  }
  const early=botLaneSim.level2||{};
  const six=botLaneSim.level6||{};
  const confidence=early.confidence||six.confidence||'MODELLED';
  $('botEngineState').textContent=`MATCHUP LAB · ${confidence}`;
  $('botEngineLevel2').textContent=early.headline||bot.level2?.label||'Level 2 modelled.';
  $('botEngineLevel6').textContent=six.headline||'Level 6 modelled.';
  $('botEngineFocus').textContent=early.targetChampion?`FOCUS: ${String(early.targetChampion).toUpperCase()}`:(bot.focus||'Focus nearest safe target.');
  $('botEngineNote').textContent=botLaneSim.note||'';
}

function renderTeamPlan(teamPlan){
  const root=$('teamBrief');
  root.classList.toggle('hidden',!teamPlan);
  if(!teamPlan)return;
  $('ourIdentity').textContent=teamPlan.ourIdentity||'Composition forming';
  $('theirIdentity').textContent=teamPlan.theirIdentity||'Composition forming';
  $('teamNote').textContent=teamPlan.note||'';
  renderPicks('ourTeamPicks',teamPlan.ourTeam||[],true);
  renderPicks('theirTeamPicks',teamPlan.theirTeam||[],false);
  $('teamfightLabel').textContent=teamPlan.teamfight?.label||'CONTROLLED 5V5';
  $('teamfightSummary').textContent=teamPlan.teamfight?.summary||'';
  $('sidelaneLabel').textContent=teamPlan.sidelane?.label||'GROUP';
  $('sidelaneSummary').textContent=teamPlan.sidelane?.summary||'';
  $('startFight').textContent=teamPlan.startFight||'';
  $('playAround').textContent=teamPlan.playAround||'';
  $('theirWin').textContent=teamPlan.theirWinCondition||'';
  $('biggestThrow').textContent=teamPlan.biggestThrow||'';
  if(teamPlan.yourJob)$('yourJob').textContent=teamPlan.yourJob;
}

function renderPicks(id,picks,ours){
  const root=$(id);root.replaceChildren();
  const items=Array.isArray(picks)?picks:[];
  for(const pick of items){
    const card=document.createElement('div');card.className=`pick-chip ${ours?'ally':'enemy'}`;
    const initial=document.createElement('b');initial.textContent=String(pick.name||'?').slice(0,2).toUpperCase();
    const text=document.createElement('span');
    const name=document.createElement('strong');name.textContent=pick.name||'Unknown';
    const role=document.createElement('small');role.textContent=pick.role||'ROLE TBD';
    text.append(name,role);card.append(initial,text);root.appendChild(card);
  }
  for(let i=items.length;i<5;i++){
    const card=document.createElement('div');card.className='pick-chip pending';
    const initial=document.createElement('b');initial.textContent='?';
    const text=document.createElement('span');
    const name=document.createElement('strong');name.textContent='Waiting';
    const role=document.createElement('small');role.textContent='PICK';
    text.append(name,role);card.append(initial,text);root.appendChild(card);
  }
}

function fallbackJob(role){
  const value=String(role||'').toUpperCase();
  if(value==='ADC')return'SAFE DPS. Keep range, hit the nearest safe target and arrive to grouped fights with farm and items.';
  if(value==='SUPPORT')return'CREATE SPACE. Start or peel based on what keeps your carries able to deal damage.';
  if(value==='JUNGLE')return'CONNECT THE TEAM. Help create first contact and be present for the grouped moments your comp is built around.';
  if(value==='TOP')return'PRESSURE WITH PURPOSE. Use side-lane windows, then reconnect when your team needs your front line or engage.';
  if(value==='MID')return'CATCH WAVES, THEN CONNECT. Use your pressure to reach fights without becoming isolated.';
  return'STAY CONNECTED. Use your champion power without breaking the team formation.';
}

function fillList(id,values,numbered=false){
  const node=$(id);if(!node)return;
  node.replaceChildren();
  const items=Array.isArray(values)?values.filter(Boolean):[];
  for(const value of items){
    const li=document.createElement('li');
    if(numbered){const text=document.createElement('span');text.textContent=String(value);li.appendChild(text)}else li.textContent=String(value);
    node.appendChild(li);
  }
  if(!items.length){const li=document.createElement('li');li.textContent='No reliable read available for this section yet.';node.appendChild(li)}
}

function renderSpikes(spikes){
  const root=$('powerSpikes');root.replaceChildren();
  for(const spike of spikes){
    const card=document.createElement('article');card.className=`spike-card edge-${String(spike.edge||'EVEN').toLowerCase()}`;
    const top=document.createElement('div');top.className='spike-top';
    const level=document.createElement('strong');level.textContent=`LV ${spike.level}`;
    const tag=document.createElement('span');tag.textContent=spike.label||'POWER WINDOW';
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
  const [appState,updater]=await Promise.all([window.opCompanion.getState(),window.opCompanion.getUpdateState().catch(()=>null)]);
  updateState=updater;render(appState);renderUpdate(updateState,appState?.phase);
  window.opCompanion.onState(render);
  window.opCompanion.onUpdateState(next=>renderUpdate(next,current?.phase));
}

$('openSetup').addEventListener('click',()=>window.opCompanion.openClimb());
$('openClimb').addEventListener('click',()=>window.opCompanion.openClimb());
$('restart').addEventListener('click',()=>window.opCompanion.restart());
$('unpair').addEventListener('click',async()=>{if(confirm('Unpair this PC from OP CLIMB? You can reconnect it from the Live Companion page.'))await window.opCompanion.unpair()});
$('autoStart').addEventListener('click',async()=>{await window.opCompanion.setAutoStart(!current?.autoStart)});
$('checkUpdate').addEventListener('click',()=>window.opCompanion.checkUpdate());
$('downloadUpdate').addEventListener('click',()=>window.opCompanion.downloadUpdate());
$('installUpdate').addEventListener('click',async()=>{const result=await window.opCompanion.installUpdate(current?.phase||'');if(result&&!result.ok&&result.error)$('updateCopy').textContent=result.error});
$('showLogs').addEventListener('click',()=>{diagnosticsOpen=!diagnosticsOpen;$('logs').classList.toggle('hidden',!diagnosticsOpen);$('showLogs').textContent=diagnosticsOpen?'HIDE DIAGNOSTICS':'DIAGNOSTICS'});
document.querySelectorAll('[data-matchup-tab]').forEach(button=>button.addEventListener('click',()=>setMatchupTab(button.dataset.matchupTab)));

boot();
