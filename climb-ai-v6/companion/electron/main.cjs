const {app,BrowserWindow,Menu,Tray,ipcMain,shell,nativeImage,safeStorage}=require('electron');
const {spawn}=require('node:child_process');
const {existsSync,readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const path=require('node:path');

const DEFAULT_WEB='https://opclimb.com';
const APP_NAME='OP CLIMB Companion';
const PAIR_PROTOCOL='opclimb';
const MATCHUP_PREFIX='OP_MATCHUP_CONTEXT ';
let mainWindow=null,tray=null,tracker=null,trackerRestartTimer=null,championPlanTimer=null;
let championPlanInFlight=false,quitting=false,matchupSignature='';
let recentLogs=[];
let state={phase:'STARTING',detail:'Starting OP CLIMB Companion…',paired:false,trackerRunning:false,lastLog:'',autoStart:false,matchup:null,teamPlan:null};

function registerProtocol(){
  if(process.defaultApp&&process.argv.length>=2)return app.setAsDefaultProtocolClient(PAIR_PROTOCOL,process.execPath,[path.resolve(process.argv[1])]);
  return app.setAsDefaultProtocolClient(PAIR_PROTOCOL);
}
registerProtocol();
const singleInstance=app.requestSingleInstanceLock();
if(!singleInstance){app.quit();process.exit(0)}
app.setName(APP_NAME);app.setAppUserModelId('com.opclimb.companion');

function appIcon(){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0b0f0c"/><path d="M14 43V21h8v22h-8Zm14 0V14h8v29h-8Zm14 0V27h8v16h-8Z" fill="#d6ff2f"/></svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}
function configDir(){return app.getPath('userData')}
function configFile(){return path.join(configDir(),'companion.json')}
function readConfig(){try{return JSON.parse(readFileSync(configFile(),'utf8'))}catch{return{webUrl:DEFAULT_WEB,tokenCipher:'',autoStart:false}}}
function decryptToken(cfg){if(!cfg?.tokenCipher||!safeStorage.isEncryptionAvailable())return'';try{return safeStorage.decryptString(Buffer.from(cfg.tokenCipher,'base64'))}catch{return''}}
function writeConfig(next){mkdirSync(configDir(),{recursive:true});writeFileSync(configFile(),JSON.stringify(next,null,2),'utf8')}
function currentConfig(){const raw=readConfig();return{webUrl:(raw.webUrl||DEFAULT_WEB).replace(/\/$/,''),token:decryptToken(raw),tokenCipher:raw.tokenCipher||'',autoStart:Boolean(raw.autoStart)}}
function paired(){return Boolean(currentConfig().token)}
function publicState(){return{...state,logs:recentLogs.slice(-80),webUrl:currentConfig().webUrl}}

function setState(patch){
  const previousPhase=state.phase;
  const enteringChampSelect=patch?.phase==='CHAMP_SELECT'&&previousPhase!=='CHAMP_SELECT';
  state={...state,...patch,paired:paired(),autoStart:currentConfig().autoStart};
  if(enteringChampSelect){matchupSignature='';state={...state,matchup:null,teamPlan:null};startChampionPlanPoll()}
  else if(previousPhase==='CHAMP_SELECT'&&state.phase!=='CHAMP_SELECT')stopChampionPlanPoll();
  updateTray();
  if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('companion:state',publicState());
}
function addLog(line,kind='info'){
  const clean=String(line||'').trim();if(!clean)return;
  if(clean.startsWith(MATCHUP_PREFIX)){parseTrackerLine(clean,kind);return}
  recentLogs.push({at:new Date().toISOString(),kind,line:clean});
  if(recentLogs.length>200)recentLogs=recentLogs.slice(-200);
  setState({lastLog:clean});parseTrackerLine(clean,kind);
}

function stopChampionPlanPoll(){if(championPlanTimer){clearTimeout(championPlanTimer);championPlanTimer=null}}
function scheduleChampionPlanPoll(delay=2200){
  stopChampionPlanPoll();if(state.phase!=='CHAMP_SELECT')return;
  championPlanTimer=setTimeout(()=>{championPlanTimer=null;void pollChampionPlan()},delay);
}
function startChampionPlanPoll(){stopChampionPlanPoll();if(state.phase==='CHAMP_SELECT')void pollChampionPlan()}
async function pollChampionPlan(){
  if(championPlanInFlight||state.phase!=='CHAMP_SELECT')return;
  const cfg=currentConfig();if(!cfg.token)return;
  championPlanInFlight=true;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),7000);
  try{
    const response=await fetch(`${cfg.webUrl}/api/live/champion-plan`,{headers:{authorization:`Bearer ${cfg.token}`},signal:controller.signal});
    if(response.status===202)return;
    const body=await response.json().catch(()=>({}));
    if(response.status===401||response.status===403){setState({phase:'AUTH_ERROR',detail:'This PC pairing is no longer valid. Re-pair from OP CLIMB.'});return}
    if(!response.ok||!body?.ready||!body?.plan||!body?.champion)return;
    if(state.phase!=='CHAMP_SELECT')return;
    const champion=String(body.champion).trim(),role=String(body.role||'').trim();
    const teamPlan=body.teamPlan||null;
    const fullOpponent=Boolean(state.matchup?.opponent&&state.matchup?.source!=='CHAMPION_LOCK');
    if(fullOpponent){setState({teamPlan});return}
    const signature=`self|${champion}|${role}|${JSON.stringify(teamPlan?.ourTeam||[])}|${JSON.stringify(teamPlan?.theirTeam||[])}`.toLowerCase();
    if(signature!==matchupSignature||state.matchup?.status!=='READY'){
      matchupSignature=signature;
      setState({matchup:{status:'READY',champion,opponent:null,role:role||null,source:'CHAMPION_LOCK',plan:body.plan,error:null},teamPlan,detail:`${champion} locked. Your briefing is ready; matchup details will enrich automatically.`});
    }else if(teamPlan)setState({teamPlan});
  }catch{}
  finally{clearTimeout(timeout);championPlanInFlight=false;if(state.phase==='CHAMP_SELECT')scheduleChampionPlanPoll(state.matchup?.status==='READY'?4000:1800)}
}

function parseTrackerLine(line,kind){
  if(line.startsWith(MATCHUP_PREFIX)){try{void loadMatchupPlan(JSON.parse(line.slice(MATCHUP_PREFIX.length)))}catch{}return}
  const lower=line.toLowerCase();
  if(lower.includes('pairing token rejected'))return setState({phase:'AUTH_ERROR',detail:'This PC pairing is no longer valid. Re-pair from OP CLIMB.'});
  if(lower.includes('champ select detected'))return setState({phase:'CHAMP_SELECT',detail:'Champ select detected. Lock your champion to build your briefing.'});
  if(lower.includes('recording')||lower.includes('match telemetry'))return setState({phase:'RECORDING',detail:'Match detected. Recording quietly in the background.'});
  if(lower.includes('waiting for the match')||lower.includes('waiting for league')||lower.includes('waiting.'))return setState({phase:'WAITING',detail:'Connected. Waiting for League.'});
  if(lower.includes('review')&&lower.includes('post'))return setState({phase:'UPLOADING',detail:'Match finished. Preparing your OP CLIMB review.'});
  if(lower.includes('league client connected'))return setState({phase:'WAITING',detail:'League detected. Waiting for champ select or match.'});
  if(kind==='error'&&state.phase!=='RECORDING')setState({detail:line});
}

async function loadMatchupPlan(raw){
  const champion=String(raw?.champion||'').trim(),opponent=String(raw?.opponent||'').trim(),role=String(raw?.role||'').trim(),source=String(raw?.source||'DETECTED').trim();
  if(!champion||!opponent||champion===opponent)return;
  const signature=`${champion}|${opponent}|${role}`.toLowerCase();
  if(signature===matchupSignature&&state.matchup?.status==='READY')return;
  matchupSignature=signature;
  setState({matchup:{status:'LOADING',champion,opponent,role:role||null,source,plan:null,error:null}});
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  try{
    const query=new URLSearchParams({champion,opponent});if(role)query.set('role',role);
    const response=await fetch(`${currentConfig().webUrl}/api/matchup/live-plan?${query.toString()}`,{signal:controller.signal});
    const body=await response.json().catch(()=>({}));
    if(!response.ok||!body?.plan){setState({matchup:{status:'ERROR',champion,opponent,role:role||null,source,plan:null,error:body?.error||`HTTP ${response.status}`}});return}
    if(signature!==matchupSignature)return;
    setState({matchup:{status:'READY',champion,opponent,role:role||null,source,plan:body.plan,error:null}});
  }catch(err){
    if(signature!==matchupSignature)return;
    setState({matchup:{status:'ERROR',champion,opponent,role:role||null,source,plan:null,error:err?.name==='AbortError'?'Matchup plan timed out.':'Could not load the matchup plan.'}});
  }finally{clearTimeout(timeout)}
}

function trackerPath(){return app.isPackaged?path.join(process.resourcesPath,'tracker','main.mjs'):path.join(__dirname,'..','src','main.mjs')}
function stopTracker(){
  stopChampionPlanPoll();if(trackerRestartTimer){clearTimeout(trackerRestartTimer);trackerRestartTimer=null}
  if(tracker&&!tracker.killed){try{tracker.kill()}catch{}}tracker=null;setState({trackerRunning:false});
}
function startTracker(){
  const cfg=currentConfig();if(!cfg.token){stopTracker();return setState({phase:'SETUP',detail:'Pair this PC from OP CLIMB to start live tracking.'})}
  if(tracker&&!tracker.killed)return;
  const runtime=trackerPath();if(!existsSync(runtime))return setState({phase:'ERROR',detail:'Tracker runtime is missing. Reinstall OP CLIMB Companion.'});
  tracker=spawn(process.execPath,[runtime],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1',OP_WEB_URL:cfg.webUrl,OP_TRACKER_TOKEN:cfg.token},windowsHide:true,stdio:['ignore','pipe','pipe']});
  setState({phase:'WAITING',detail:'Companion is running. Waiting for League.',trackerRunning:true});
  tracker.stdout.on('data',chunk=>String(chunk).split(/\r?\n/).forEach(line=>addLog(line,'info')));
  tracker.stderr.on('data',chunk=>String(chunk).split(/\r?\n/).forEach(line=>addLog(line,'error')));
  tracker.on('error',err=>{addLog(`Tracker failed to start: ${err.message}`,'error');setState({phase:'ERROR',detail:'Tracker could not start.',trackerRunning:false})});
  tracker.on('exit',(code,signal)=>{
    tracker=null;setState({trackerRunning:false});
    if(quitting||state.phase==='AUTH_ERROR'||!paired())return;
    addLog(`Tracker stopped${code!==null?` with code ${code}`:''}${signal?` (${signal})`:''}. Restarting shortly.`,'error');
    setState({phase:'RESTARTING',detail:'Tracker stopped unexpectedly. Restarting automatically…'});
    trackerRestartTimer=setTimeout(()=>{trackerRestartTimer=null;startTracker()},5000);
  });
}

async function redeemPairCode(rawCode){
  const code=String(rawCode||'').trim().toUpperCase();if(code.replace(/[^A-Z0-9]/g,'').length!==12)return{ok:false,error:'The pairing link is invalid. Create a new pairing from OP CLIMB.'};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch(`${DEFAULT_WEB}/api/live/pair/claim`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code}),signal:controller.signal});
    const body=await response.json().catch(()=>({}));
    if(!response.ok||!body?.token)return{ok:false,error:body?.error||'Pairing failed. Create a new pairing on OP CLIMB and try again.'};
    return{ok:true,token:String(body.token)};
  }catch(err){return{ok:false,error:err?.name==='AbortError'?'Pairing timed out. Check your internet connection and try again.':'Could not reach OP CLIMB.'}}
  finally{clearTimeout(timer)}
}
function deepLinkFromArgs(argv){return argv.find(value=>typeof value==='string'&&value.toLowerCase().startsWith(`${PAIR_PROTOCOL}://`))||''}
async function handlePairUrl(rawUrl){
  let parsed;try{parsed=new URL(rawUrl)}catch{return}
  if(parsed.protocol!==`${PAIR_PROTOCOL}:`||parsed.hostname!=='pair')return;
  createWindow(true);const code=parsed.searchParams.get('code')||'';
  if(!safeStorage.isEncryptionAvailable()){setState({phase:'SETUP',detail:'Windows secure storage is unavailable on this PC. Pairing was not saved.'});return}
  setState({phase:'STARTING',detail:'Securely connecting this PC to OP CLIMB…'});
  const claimed=await redeemPairCode(code);if(!claimed.ok){setState({phase:'SETUP',detail:claimed.error||'Pairing failed.'});return}
  const cfg=readConfig();cfg.webUrl=DEFAULT_WEB;cfg.tokenCipher=safeStorage.encryptString(claimed.token).toString('base64');writeConfig(cfg);
  recentLogs=[];matchupSignature='';setState({matchup:null,teamPlan:null});stopTracker();startTracker();
}

function createWindow(show=true){
  if(mainWindow&&!mainWindow.isDestroyed()){if(show){mainWindow.show();mainWindow.focus()}return mainWindow}
  mainWindow=new BrowserWindow({width:1040,height:900,minWidth:760,minHeight:680,show:false,backgroundColor:'#090d0a',title:APP_NAME,icon:appIcon(),autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  mainWindow.loadFile(path.join(__dirname,'index.html'));
  mainWindow.once('ready-to-show',()=>{if(show)mainWindow.show()});
  mainWindow.on('close',event=>{if(!quitting){event.preventDefault();mainWindow.hide()}});
  mainWindow.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//i.test(url))shell.openExternal(url);return{action:'deny'}});
  return mainWindow;
}
function trayLabel(){return({SETUP:'Setup required',WAITING:'Waiting for League',CHAMP_SELECT:'Champ select',RECORDING:'Recording match',UPLOADING:'Preparing review',AUTH_ERROR:'Re-pair required',RESTARTING:'Restarting tracker',ERROR:'Tracker problem',STARTING:'Starting'})[state.phase]||state.phase}
function updateTray(){
  if(!tray)return;tray.setToolTip(`${APP_NAME} — ${trayLabel()}`);
  tray.setContextMenu(Menu.buildFromTemplate([{label:`Status: ${trayLabel()}`,enabled:false},{type:'separator'},{label:'Open Companion',click:()=>createWindow(true)},{label:'Open OP CLIMB',click:()=>shell.openExternal(`${currentConfig().webUrl}/live`)},{label:'Restart Tracker',enabled:paired(),click:()=>{stopTracker();startTracker()}},{type:'separator'},{label:'Quit',click:()=>{quitting=true;app.quit()}}]));
}
function createTray(){tray=new Tray(appIcon().resize({width:24,height:24}));tray.on('double-click',()=>createWindow(true));updateTray()}
function applyAutoStart(enabled){const next=Boolean(enabled);try{app.setLoginItemSettings({openAtLogin:next,args:next?['--hidden']:[]})}catch{}const cfg=readConfig();cfg.autoStart=next;writeConfig(cfg);setState({autoStart:next})}

ipcMain.handle('companion:get-state',()=>publicState());
ipcMain.handle('companion:unpair',()=>{stopTracker();const cfg=readConfig();cfg.tokenCipher='';writeConfig(cfg);recentLogs=[];matchupSignature='';setState({phase:'SETUP',detail:'This PC is unpaired. Pair it again from OP CLIMB.',trackerRunning:false,matchup:null,teamPlan:null});return{ok:true}});
ipcMain.handle('companion:restart',()=>{stopTracker();startTracker();return{ok:true}});
ipcMain.handle('companion:auto-start',(_event,enabled)=>{applyAutoStart(enabled);return{ok:true}});
ipcMain.handle('companion:open-climb',()=>{shell.openExternal(`${currentConfig().webUrl}/live`);return{ok:true}});

app.on('second-instance',(_event,argv)=>{createWindow(true);const link=deepLinkFromArgs(argv);if(link)void handlePairUrl(link)});
app.on('open-url',(event,url)=>{event.preventDefault();void handlePairUrl(url)});
app.on('before-quit',()=>{quitting=true;stopTracker()});app.on('window-all-closed',()=>{});
app.whenReady().then(()=>{
  const cfg=readConfig();state={...state,paired:Boolean(decryptToken(cfg)),autoStart:Boolean(cfg.autoStart)};createTray();
  const initialLink=deepLinkFromArgs(process.argv),hidden=process.argv.includes('--hidden')&&!initialLink;createWindow(!hidden);
  if(initialLink)void handlePairUrl(initialLink);else if(state.paired)startTracker();else setState({phase:'SETUP',detail:'Open OP CLIMB and pair this PC to start live tracking.'});
});
