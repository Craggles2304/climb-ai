const {app,ipcMain,BrowserWindow}=require('electron');
const {autoUpdater}=require('electron-updater');

const CHECK_INTERVAL_MS=4*60*60*1000;
const BUSY_PHASES=new Set(['CHAMP_SELECT','RECORDING','UPLOADING']);
let checkTimer=null;
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
  if(updateState.status!=='READY')return {ok:false,error:'The update has not finished downloading yet.'};
  if(installBlocked(phase))return {ok:false,error:'Finish the current League session before restarting to update.'};
  setUpdateState({status:'INSTALLING',error:null});
  setImmediate(()=>autoUpdater.quitAndInstall(false,true));
  return {ok:true};
}

function configureUpdater(){
  autoUpdater.autoDownload=false;
  autoUpdater.autoInstallOnAppQuit=true;
  autoUpdater.allowDowngrade=false;

  autoUpdater.on('checking-for-update',()=>setUpdateState({status:'CHECKING',error:null}));
  autoUpdater.on('update-available',info=>setUpdateState({status:'AVAILABLE',latestVersion:String(info?.version||''),progress:0,error:null}));
  autoUpdater.on('update-not-available',info=>setUpdateState({status:'CURRENT',latestVersion:String(info?.version||app.getVersion()),progress:0,error:null}));
  autoUpdater.on('download-progress',progress=>setUpdateState({status:'DOWNLOADING',progress:Math.max(0,Math.min(100,Number(progress?.percent)||0)),error:null}));
  autoUpdater.on('update-downloaded',info=>setUpdateState({status:'READY',latestVersion:String(info?.version||updateState.latestVersion||''),progress:100,error:null}));
  autoUpdater.on('error',err=>setUpdateState({status:'ERROR',error:err?.message||'Update service error.'}));
}

ipcMain.handle('companion:update-state',()=>publicUpdateState());
ipcMain.handle('companion:check-update',()=>checkForUpdate());
ipcMain.handle('companion:download-update',()=>downloadUpdate());
ipcMain.handle('companion:install-update',(_event,phase)=>installUpdate(phase));

configureUpdater();
app.whenReady().then(()=>{
  setTimeout(()=>void checkForUpdate(),12_000);
  checkTimer=setInterval(()=>void checkForUpdate(),CHECK_INTERVAL_MS);
});
app.on('before-quit',()=>{if(checkTimer){clearInterval(checkTimer);checkTimer=null}});

require('./main.cjs');
