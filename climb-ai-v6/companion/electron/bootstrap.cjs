const {app,ipcMain,BrowserWindow}=require('electron');
const {autoUpdater}=require('electron-updater');

const CHECK_INTERVAL_MS=15*60*1000;
const BUSY_PHASES=new Set(['CHAMP_SELECT','RECORDING','UPLOADING']);
const WEB=(process.env.OP_WEB_URL||'https://opclimb.com').replace(/\/$/,'');
let checkTimer=null;
let installWatchdog=null;
let updateState={
  status:'IDLE',
  currentVersion:app.getVersion(),
  latestVersion:null,
  progress:0,
  error:null,
};

function publicUpdateState(){return {...updateState}}
function broadcastUpdate(){
  const payload=publicUpdateState();
  for(const win of BrowserWindow.getAllWindows()){
    if(!win.isDestroyed())win.webContents.send('companion:update-state',payload);
  }
}
function setUpdateState(patch){
  updateState={...updateState,...patch,currentVersion:app.getVersion()};
  broadcastUpdate();
}
function installBlocked(phase){return BUSY_PHASES.has(String(phase||'').toUpperCase())}

async function checkForUpdate(){
  if(!app.isPackaged){
    setUpdateState({status:'CURRENT',latestVersion:app.getVersion(),progress:0,error:null});
    return publicUpdateState();
  }
  if(['DOWNLOADING','READY'].includes(updateState.status))return publicUpdateState();
  setUpdateState({status:'CHECKING',error:null});
  try{
    await autoUpdater.checkForUpdates();
  }catch(err){
    setUpdateState({status:'ERROR',error:err?.message||'Could not check for updates.'});
  }
  return publicUpdateState();
}

async function downloadUpdate(){
  if(!app.isPackaged)return {ok:false,error:'Updates are available in the installed Companion only.'};
  if(updateState.status!=='AVAILABLE')return {ok:false,error:'No newer update is ready to download.'};
  setUpdateState({status:'DOWNLOADING',progress:0,error:null});
  try{
    await autoUpdater.downloadUpdate();
    return {ok:true};
  }catch(err){
    setUpdateState({status:'ERROR',error:err?.message||'Could not download the update.'});
    return {ok:false,error:updateState.error};
  }
}

function installUpdate(phase){
  if(updateState.status==='INSTALLING')return {ok:true};
  if(updateState.status!=='READY')return {ok:false,error:'The update has not finished downloading yet.'};
  if(installBlocked(phase))return {ok:false,error:'Finish the current League session before restarting to update.'};
  setUpdateState({status:'INSTALLING',error:null});
  setTimeout(()=>{
    try{
      // Silent NSIS install avoids the assisted installer being hidden behind the Companion.
      // Force-run the new build afterwards so the player lands back in the Companion automatically.
      autoUpdater.quitAndInstall(true,true);
      installWatchdog=setTimeout(()=>{
        // If Electron/Windows failed to close us after the updater was launched, force the normal
        // quit path first (which also honours autoInstallOnAppQuit), then hard-exit as a final unlock.
        setUpdateState({status:'ERROR',error:'The update is downloaded, but Windows did not close the Companion. The app will now close so the installer can finish.'});
        try{app.quit()}catch{}
        setTimeout(()=>{try{app.exit(0)}catch{}},1500);
      },3500);
    }catch(err){
      setUpdateState({status:'ERROR',error:err?.message||'Could not restart into the downloaded update.'});
    }
  },150);
  return {ok:true};
}

function configureUpdater(){
  autoUpdater.autoDownload=true;
  autoUpdater.autoInstallOnAppQuit=true;
  autoUpdater.allowDowngrade=false;

  autoUpdater.on('checking-for-update',()=>setUpdateState({status:'CHECKING',error:null}));
  autoUpdater.on('update-available',info=>setUpdateState({status:'AVAILABLE',latestVersion:String(info?.version||''),progress:0,error:null}));
  autoUpdater.on('update-not-available',info=>setUpdateState({status:'CURRENT',latestVersion:String(info?.version||app.getVersion()),progress:0,error:null}));
  autoUpdater.on('download-progress',progress=>setUpdateState({status:'DOWNLOADING',progress:Math.max(0,Math.min(100,Number(progress?.percent)||0)),error:null}));
  autoUpdater.on('update-downloaded',info=>setUpdateState({status:'READY',latestVersion:String(info?.version||updateState.latestVersion||''),progress:100,error:null}));
  autoUpdater.on('error',err=>setUpdateState({status:'ERROR',error:err?.message||'Update service error.'}));
}

function cleanChampion(value){
  const name=String(value||'').trim();
  return name&&name.length<=40?name:'';
}

async function runBotLaneLevel(context,level){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),14_000);
  try{
    const side=name=>({champion:name,level});
    const response=await fetch(`${WEB}/api/matchup/botlane`,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        yourAdc:side(context.yourAdc),
        yourSupport:side(context.yourSupport),
        enemyAdc:side(context.enemyAdc),
        enemySupport:side(context.enemySupport),
        durationSeconds:8,
      }),
      signal:controller.signal,
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok||!body?.lanePlan)throw new Error(body?.error||`2v2 engine returned HTTP ${response.status}.`);
    const lane=body.lanePlan;
    return{
      level,
      patch:body.patch||null,
      confidence:body.confidence||null,
      call:lane.call||null,
      headline:lane.headline||null,
      reason:lane.reason||null,
      target:lane.target||null,
      targetChampion:lane.targetChampion||null,
      rangeDelta:lane.rangeDelta??null,
      rangeLabel:lane.rangeLabel||null,
      rules:Array.isArray(lane.rules)?lane.rules.slice(0,3):[],
      focusReason:body.focusComparison?.reason||null,
      winner:body.result?.winner||null,
      verdict:body.result?.verdict||null,
    };
  }finally{
    clearTimeout(timeout);
  }
}

async function simulateBotLane(context){
  const clean={
    yourAdc:cleanChampion(context?.yourAdc),
    yourSupport:cleanChampion(context?.yourSupport),
    enemyAdc:cleanChampion(context?.enemyAdc),
    enemySupport:cleanChampion(context?.enemySupport),
  };
  if(Object.values(clean).some(value=>!value))return{ok:false,error:'All four bot-lane champions are required.'};
  try{
    const [level2,level6]=await Promise.all([runBotLaneLevel(clean,2),runBotLaneLevel(clean,6)]);
    return{
      ok:true,
      context:clean,
      level2,
      level6,
      note:'Matchup Lab 2v2 engine read: default no-item setup, full access and configured actions connecting. Use it as fight-shape guidance, not a live win guarantee.',
    };
  }catch(err){
    return{ok:false,error:err?.name==='AbortError'?'The 2v2 engine timed out.':(err?.message||'Could not run the 2v2 engine.')};
  }
}

ipcMain.handle('companion:update-state',()=>publicUpdateState());
ipcMain.handle('companion:check-update',()=>checkForUpdate());
ipcMain.handle('companion:download-update',()=>downloadUpdate());
ipcMain.handle('companion:install-update',(_event,phase)=>installUpdate(phase));
ipcMain.handle('companion:botlane-sim',(_event,context)=>simulateBotLane(context));

configureUpdater();
app.whenReady().then(()=>{
  setTimeout(()=>void checkForUpdate(),12_000);
  checkTimer=setInterval(()=>void checkForUpdate(),CHECK_INTERVAL_MS);
});
app.on('will-quit',()=>{
  if(checkTimer){clearInterval(checkTimer);checkTimer=null}
  if(installWatchdog){clearTimeout(installWatchdog);installWatchdog=null}
});

require('./live-roster.cjs');
require('./main.cjs');
