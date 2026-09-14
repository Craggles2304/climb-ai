const {app,BrowserWindow,Menu,Tray,ipcMain,shell,nativeImage,safeStorage}=require('electron');
const {spawn}=require('node:child_process');
const {existsSync,readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const path=require('node:path');

const DEFAULT_WEB='https://opclimb.com';
const APP_NAME='OP CLIMB Companion';
let mainWindow=null;
let tray=null;
let tracker=null;
let trackerRestartTimer=null;
let quitting=false;
let recentLogs=[];
let state={phase:'STARTING',detail:'Starting OP CLIMB Companion…',paired:false,trackerRunning:false,lastLog:'',autoStart:false};

const singleInstance=app.requestSingleInstanceLock();
if(!singleInstance){app.quit();process.exit(0)}

app.setName(APP_NAME);
app.setAppUserModelId('com.opclimb.companion');

function appIcon(){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0b0f0c"/><path d="M14 43V21h8v22h-8Zm14 0V14h8v29h-8Zm14 0V27h8v16h-8Z" fill="#d6ff2f"/></svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

function configDir(){return app.getPath('userData')}
function configFile(){return path.join(configDir(),'companion.json')}
function readConfig(){
  try{return JSON.parse(readFileSync(configFile(),'utf8'))}catch{return {webUrl:DEFAULT_WEB,tokenCipher:'',autoStart:false}}
}
function decryptToken(config){
  if(!config?.tokenCipher||!safeStorage.isEncryptionAvailable())return '';
  try{return safeStorage.decryptString(Buffer.from(config.tokenCipher,'base64'))}catch{return ''}
}
function writeConfig(next){
  mkdirSync(configDir(),{recursive:true});
  writeFileSync(configFile(),JSON.stringify(next,null,2),'utf8');
}
function currentConfig(){
  const raw=readConfig();
  return {webUrl:(raw.webUrl||DEFAULT_WEB).replace(/\/$/,''),token:decryptToken(raw),tokenCipher:raw.tokenCipher||'',autoStart:Boolean(raw.autoStart)};
}
function paired(){return Boolean(currentConfig().token)}

function setState(patch){
  state={...state,...patch,paired:paired(),autoStart:currentConfig().autoStart};
  updateTray();
  if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('companion:state',publicState());
}
function publicState(){return {...state,logs:recentLogs.slice(-80),webUrl:currentConfig().webUrl}}
function addLog(line,kind='info'){
  const clean=String(line||'').trim();if(!clean)return;
  recentLogs.push({at:new Date().toISOString(),kind,line:clean});
  if(recentLogs.length>200)recentLogs=recentLogs.slice(-200);
  setState({lastLog:clean});
  parseTrackerLine(clean,kind);
}
function parseTrackerLine(line,kind){
  const lower=line.toLowerCase();
  if(lower.includes('pairing token rejected'))return setState({phase:'AUTH_ERROR',detail:'This PC pairing is no longer valid. Re-pair from OP CLIMB.'});
  if(lower.includes('champ select detected'))return setState({phase:'CHAMP_SELECT',detail:'Champ select detected. Draft context is being saved.'});
  if(lower.includes('recording')||lower.includes('match telemetry'))return setState({phase:'RECORDING',detail:'Match detected. Recording quietly in the background.'});
  if(lower.includes('waiting for the match')||lower.includes('waiting for league')||lower.includes('waiting.'))return setState({phase:'WAITING',detail:'Connected. Waiting for League.'});
  if(lower.includes('review')&&lower.includes('post'))return setState({phase:'UPLOADING',detail:'Match finished. Preparing your OP CLIMB review.'});
  if(lower.includes('league client connected'))return setState({phase:'WAITING',detail:'League detected. Waiting for champ select or match.'});
  if(kind==='error'&&state.phase!=='RECORDING')setState({detail:line});
}

function trackerPath(){
  if(app.isPackaged)return path.join(process.resourcesPath,'tracker','main.mjs');
  return path.join(__dirname,'..','src','main.mjs');
}
function stopTracker(){
  if(trackerRestartTimer){clearTimeout(trackerRestartTimer);trackerRestartTimer=null}
  if(tracker&&!tracker.killed){try{tracker.kill()}catch{}}
  tracker=null;
  setState({trackerRunning:false});
}
function startTracker(){
  const cfg=currentConfig();
  if(!cfg.token){stopTracker();return setState({phase:'SETUP',detail:'Pair this PC from OP CLIMB to start live tracking.'})}
  if(tracker&&!tracker.killed)return;
  const runtime=trackerPath();
  if(!existsSync(runtime))return setState({phase:'ERROR',detail:'Tracker runtime is missing. Reinstall OP CLIMB Companion.'});
  const env={...process.env,ELECTRON_RUN_AS_NODE:'1',OP_WEB_URL:cfg.webUrl,OP_TRACKER_TOKEN:cfg.token};
  tracker=spawn(process.execPath,[runtime],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  setState({phase:'WAITING',detail:'Companion is running. Waiting for League.',trackerRunning:true});
  tracker.stdout.on('data',chunk=>String(chunk).split(/\r?\n/).forEach(line=>addLog(line,'info')));
  tracker.stderr.on('data',chunk=>String(chunk).split(/\r?\n/).forEach(line=>addLog(line,'error')));
  tracker.on('error',err=>{addLog(`Tracker failed to start: ${err.message}`,'error');setState({phase:'ERROR',detail:'Tracker could not start.',trackerRunning:false})});
  tracker.on('exit',(code,signal)=>{
    tracker=null;
    setState({trackerRunning:false});
    if(quitting||state.phase==='AUTH_ERROR'||!paired())return;
    addLog(`Tracker stopped${code!==null?` with code ${code}`:''}${signal?` (${signal})`:''}. Restarting shortly.`,'error');
    setState({phase:'RESTARTING',detail:'Tracker stopped unexpectedly. Restarting automatically…'});
    trackerRestartTimer=setTimeout(()=>{trackerRestartTimer=null;startTracker()},5000);
  });
}

async function redeemPairCode(rawCode,webUrl){
  const code=String(rawCode||'').trim().toUpperCase();
  if(code.replace(/[^A-Z0-9]/g,'').length!==12)return {ok:false,error:'Enter the 12-character pairing code shown on OP CLIMB.'};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch(`${webUrl}/api/live/pair/claim`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code}),signal:controller.signal});
    const body=await response.json().catch(()=>({}));
    if(!response.ok||!body?.token)return {ok:false,error:body?.error||'Pairing failed. Create a new code on OP CLIMB and try again.'};
    return {ok:true,token:String(body.token)};
  }catch(err){
    return {ok:false,error:err?.name==='AbortError'?'Pairing timed out. Check your internet connection and try again.':'Could not reach OP CLIMB.'};
  }finally{clearTimeout(timer)}
}

function createWindow(show=true){
  if(mainWindow&&!mainWindow.isDestroyed()){if(show){mainWindow.show();mainWindow.focus()}return mainWindow}
  mainWindow=new BrowserWindow({width:760,height:690,minWidth:660,minHeight:600,show:false,backgroundColor:'#090d0a',title:APP_NAME,icon:appIcon(),autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  mainWindow.loadFile(path.join(__dirname,'index.html'));
  mainWindow.once('ready-to-show',()=>{if(show)mainWindow.show()});
  mainWindow.on('close',event=>{if(!quitting){event.preventDefault();mainWindow.hide()}});
  mainWindow.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//i.test(url))shell.openExternal(url);return{action:'deny'}});
  return mainWindow;
}

function trayLabel(){
  const map={SETUP:'Setup required',WAITING:'Waiting for League',CHAMP_SELECT:'Champ select',RECORDING:'Recording match',UPLOADING:'Preparing review',AUTH_ERROR:'Re-pair required',RESTARTING:'Restarting tracker',ERROR:'Tracker problem',STARTING:'Starting'};
  return map[state.phase]||state.phase;
}
function updateTray(){
  if(!tray)return;
  tray.setToolTip(`${APP_NAME} — ${trayLabel()}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:`Status: ${trayLabel()}`,enabled:false},
    {type:'separator'},
    {label:'Open Companion',click:()=>createWindow(true)},
    {label:'Open OP CLIMB',click:()=>shell.openExternal(`${currentConfig().webUrl}/live`)},
    {label:'Restart Tracker',enabled:paired(),click:()=>{stopTracker();startTracker()}},
    {type:'separator'},
    {label:'Quit',click:()=>{quitting=true;app.quit()}}
  ]));
}
function createTray(){tray=new Tray(appIcon().resize({width:24,height:24}));tray.on('double-click',()=>createWindow(true));updateTray()}

function applyAutoStart(enabled){
  const next=Boolean(enabled);
  try{app.setLoginItemSettings({openAtLogin:next,args:next?['--hidden']:[]})}catch{}
  const cfg=readConfig();cfg.autoStart=next;writeConfig(cfg);setState({autoStart:next});
}

ipcMain.handle('companion:get-state',()=>publicState());
ipcMain.handle('companion:pair',async(_event,payload)=>{
  const webUrl=String(payload?.webUrl||DEFAULT_WEB).trim().replace(/\/$/,'');
  const safeWeb=/^https:\/\//i.test(webUrl)?webUrl:DEFAULT_WEB;
  if(!safeStorage.isEncryptionAvailable())return {ok:false,error:'Windows secure storage is unavailable on this PC.'};
  setState({phase:'STARTING',detail:'Securely pairing this PC with OP CLIMB…'});
  const claimed=await redeemPairCode(payload?.code,safeWeb);
  if(!claimed.ok){setState({phase:'SETUP',detail:'Pair this PC from OP CLIMB to start live tracking.'});return claimed}
  const cfg=readConfig();
  cfg.webUrl=safeWeb;
  cfg.tokenCipher=safeStorage.encryptString(claimed.token).toString('base64');
  writeConfig(cfg);
  recentLogs=[];
  stopTracker();startTracker();
  return {ok:true};
});
ipcMain.handle('companion:unpair',()=>{stopTracker();const cfg=readConfig();cfg.tokenCipher='';writeConfig(cfg);recentLogs=[];setState({phase:'SETUP',detail:'This PC is unpaired. Create a new pairing code on OP CLIMB.',trackerRunning:false});return {ok:true}});
ipcMain.handle('companion:restart',()=>{stopTracker();startTracker();return {ok:true}});
ipcMain.handle('companion:auto-start',(_event,enabled)=>{applyAutoStart(enabled);return {ok:true}});
ipcMain.handle('companion:open-climb',()=>{shell.openExternal(`${currentConfig().webUrl}/live`);return {ok:true}});

app.on('second-instance',()=>createWindow(true));
app.on('before-quit',()=>{quitting=true;stopTracker()});
app.on('window-all-closed',()=>{});

app.whenReady().then(()=>{
  const cfg=readConfig();
  state={...state,paired:Boolean(decryptToken(cfg)),autoStart:Boolean(cfg.autoStart)};
  createTray();
  const hidden=process.argv.includes('--hidden');
  createWindow(!hidden);
  if(state.paired)startTracker();else setState({phase:'SETUP',detail:'Pair this PC from OP CLIMB to start live tracking.'});
});
