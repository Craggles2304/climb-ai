const {app,BrowserWindow,Menu,Tray,ipcMain,shell,nativeImage,safeStorage,globalShortcut,screen}=require('electron');
const {spawn}=require('node:child_process');
const {existsSync,readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const path=require('node:path');
const {championRoster,championGuide}=require('./champion-hub-data.cjs');
const {draftFromLocalContext,freshestDraft}=require('./live-draft.cjs');
const {startTftRecorder:startNativeTftRecorder}=require('./tft-recorder.cjs');
const {safeLayout,nextHudMode,freezeLeaguePlan,overlayView}=require('./overlay-model.cjs');

const DEFAULT_WEB='https://opclimb.com';
const APP_NAME='OP CLIMB Companion';
const PAIR_PROTOCOL='opclimb';
const MATCHUP_PREFIX='OP_MATCHUP_CONTEXT ';
const TRACKER_STATE_PREFIX='OP_TRACKER_STATE ';
const DRAFT_CONTEXT_PREFIX='OP_DRAFT_CONTEXT ';
let overlayBoundDisplayId=null,overlayLastRaisedAt=0,overlayInteractionMode='';
let overlayWindow=null,overlayEditing=false,overlayAssistantOpen=false,overlayBuildsOpen=false,overlayCoachBusy=false,overlayFrozenLeague=null,overlayFrozenTftFocus=null,overlayFrozenTftMission=null,overlayFrozenTftBuilds=null,overlayFrozenLeagueBuild=null;
let mainWindow=null,tray=null,tracker=null,tftRecorder=null,trackerRestartTimer=null,championPlanTimer=null,reviewPollTimer=null,trackerStatusTimer=null,missedReviewTimer=null,playerHomeTimer=null;
let championPlanInFlight=false,reviewPollInFlight=false,trackerStatusInFlight=false,playerHomeInFlight=false,tftMissionInFlight=false,tftBuildsInFlight=false,leagueBuildInFlight='',leagueBuildKey='',reviewPollAttempts=0,quitting=false,matchupSignature='',dnaViewRole='';
let lastLocalChampSelectAt=0;
let recordingExitTimer=null,recordingExitPendingAt=0,recordingStartedAt=0,lastLocalRecordingSignalAt=0,lastLiveTelemetryAt=0,overlayWatchdog=null;
const RECORDING_END_GRACE_MS=22000;
let pairingAuthInvalid=false;
let recentLogs=[];
let state={rankedSoloOnly:true,phase:'STARTING',detail:'Starting OP CLIMB Companion…',paired:false,trackerRunning:false,tftRecorder:{available:false,state:'STARTING',detail:'Checking TFT recorder…'},lastLog:'',autoStart:false,matchup:null,teamPlan:null,draft:null,postGameReview:null,playerHome:null,tftMission:null,tftMissionError:null};

function registerProtocol(){
  if(process.defaultApp&&process.argv.length>=2)return app.setAsDefaultProtocolClient(PAIR_PROTOCOL,process.execPath,[path.resolve(process.argv[1])]);
  return app.setAsDefaultProtocolClient(PAIR_PROTOCOL);
}
registerProtocol();
const singleInstance=app.requestSingleInstanceLock();
if(!singleInstance){app.quit();process.exit(0)}
app.setName(APP_NAME);app.setAppUserModelId('com.opclimb.companion');

function appIcon(){
  const iconPath=app.isPackaged
    ?path.join(process.resourcesPath,'icon.ico')
    :path.join(__dirname,'..','build','icon.ico');
  try{
    const branded=nativeImage.createFromPath(iconPath);
    if(!branded.isEmpty())return branded;
  }catch{}
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#090e11"/><path d="M9 9h46v46H9z" fill="none" stroke="#b6f66b" stroke-width="2"/><path d="M17 43V24h7v19h-7Zm12 0V17h7v26h-7Zm12 0V29h7v14h-7Z" fill="#b6f66b"/></svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}
function configDir(){return app.getPath('userData')}
function configFile(){return path.join(configDir(),'companion.json')}
function readConfig(){try{return JSON.parse(readFileSync(configFile(),'utf8'))}catch{return{webUrl:DEFAULT_WEB,tokenCipher:'',autoStart:false}}}
function decryptToken(cfg){if(!cfg?.tokenCipher||!safeStorage.isEncryptionAvailable())return'';try{return safeStorage.decryptString(Buffer.from(cfg.tokenCipher,'base64'))}catch{return''}}
function writeConfig(next){mkdirSync(configDir(),{recursive:true});writeFileSync(configFile(),JSON.stringify(next,null,2),'utf8')}
function currentConfig(){const raw=readConfig();return{webUrl:(raw.webUrl||DEFAULT_WEB).replace(/\/$/,''),token:decryptToken(raw),tokenCipher:raw.tokenCipher||'',autoStart:Boolean(raw.autoStart),overlayEnabled:raw.overlayEnabled===true,overlayLayout:safeLayout(raw.overlayLayout),overlayDisplayId:Number.isFinite(Number(raw.overlayDisplayId))&&raw.overlayDisplayId!=null?Number(raw.overlayDisplayId):null,tftFocus:String(raw.tftFocus||'ECONOMY'),tftBuildId:String(raw.tftBuildId||''),lastReviewSessionId:String(raw.lastReviewSessionId||''),lastReviewRenderedSessionId:String(raw.lastReviewRenderedSessionId||'')}}
function paired(){return Boolean(currentConfig().token)}
function publicState(){const cfg=currentConfig();return{...state,logs:recentLogs.slice(-80),webUrl:cfg.webUrl,tftFocus:cfg.tftFocus,tftBuildId:cfg.tftBuildId,overlay:{enabled:cfg.overlayEnabled,editing:overlayEditing,buildsOpen:overlayBuildsOpen,layout:cfg.overlayLayout}}}
// The optional overlay never injects into League/TFT, touches game memory, or
// supplies live prescriptions. It shows only the frozen pre-game learning model.
// League's client briefly drops out of the LCU during the loading-screen
// handoff. A server's earlier WAITING status also arrives late. Neither
// signal alone proves the live game ended: avoid hiding the HUD mid-match.
function cancelRecordingExit(){
  if(recordingExitTimer)clearTimeout(recordingExitTimer);
  recordingExitTimer=null;recordingExitPendingAt=0;
}
function markRecordingAlive(telemetry=false){
  if(telemetry)lastLiveTelemetryAt=Date.now();
  else lastLocalRecordingSignalAt=Date.now();
  cancelRecordingExit();
}
function scheduleRecordingExit(detail){
  if(recordingExitTimer||state.phase!=='RECORDING')return;
  recordingExitPendingAt=Date.now();
  const check=()=>{
    recordingExitTimer=null;
    if(quitting||state.phase!=='RECORDING'){recordingExitPendingAt=0;return;}
    const latest=Math.max(lastLocalRecordingSignalAt,lastLiveTelemetryAt);
    if(Date.now()-latest<10000){
      recordingExitTimer=setTimeout(check,12000);
      return;
    }
    recordingExitPendingAt=0;
    setState({phase:'UPLOADING',detail:detail||'Match finished. Preparing your review.'});
    startPostGameReviewPoll();
  };
  // League's first loading screen can exceed 20s; allow 90s for the
  // initial handoff, then a shorter interval for mid-game disconnections.
  const initialHandoff=recordingStartedAt>0&&Date.now()-recordingStartedAt<120000;
  recordingExitTimer=setTimeout(check,initialHandoff?90000:RECORDING_END_GRACE_MS);
  addLog('Waiting for confirmed game end before hiding the match HUD.');
}
function startOverlayWatchdog(){
  if(overlayWatchdog)return;
  overlayWatchdog=setInterval(()=>{
    if(quitting||!overlayWindow||overlayWindow.isDestroyed())return;
    const view=overlayPayload();
    if(!view.show)return;
    const win=overlayWindow;
    if(!win.isVisible()&&!win.webContents.isLoading()){syncOverlay();return}
    // Only refresh Z-order; never focus or capture mouse while playing.
    if(!overlayEditing&&!overlayAssistantOpen&&!overlayBuildsOpen)raiseOverlay(win);
  },2500);
}
function overlayPayload(){
  const cfg=currentConfig();
  return overlayView(state,{enabled:cfg.overlayEnabled,editing:overlayEditing,layout:cfg.overlayLayout,
    frozenLeague:overlayFrozenLeague,tftFocus:overlayFrozenTftFocus||cfg.tftFocus,tftMission:overlayFrozenTftMission,assistantOpen:overlayAssistantOpen,buildsOpen:overlayBuildsOpen,
    tftBuilds:overlayFrozenTftBuilds,leagueBuild:overlayFrozenLeagueBuild});
}
// A regular Electron window can appear above borderless/windowed League.
// Exclusive fullscreen bypasses the desktop compositor: users must choose
// Borderless in League > Video. Never hook into League or Vanguard.
function cursorDisplay(){
  try{return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())}catch{return screen.getPrimaryDisplay()}
}
function chosenOverlayDisplay(preferCursor=false){
  const saved=currentConfig().overlayDisplayId;
  if(!preferCursor&&saved!=null){
    const found=screen.getAllDisplays().find(display=>display.id===saved);
    if(found)return found;
  }
  return cursorDisplay();
}
function setOverlayScreen(display){
  if(!display||!overlayWindow||overlayWindow.isDestroyed())return;
  const current=overlayWindow.getBounds();
  const target=display.bounds;
  if(overlayBoundDisplayId===display.id&&['x','y','width','height'].every(key=>current[key]===target[key]))return;
  overlayWindow.setBounds(display.bounds);
  overlayBoundDisplayId=display.id;
}
function raiseOverlay(win,{force=false}={}){
  if(!win||win.isDestroyed()||!win.isVisible())return;
  if(!force&&Date.now()-overlayLastRaisedAt<6000)return;
  overlayLastRaisedAt=Date.now();
  // "floating" is below Windows' taskbar and may fall behind borderless games.
  // This changes window z-order, never game input or its memory.
  win.setAlwaysOnTop(true,'screen-saver');
  try{win.moveTop()}catch{}
}
function createOverlayWindow(){
  if(overlayWindow&&!overlayWindow.isDestroyed())return overlayWindow;
  const display=chosenOverlayDisplay();
  const bounds=display.bounds;
  const win=new BrowserWindow({x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,
    show:false,transparent:true,frame:false,skipTaskbar:true,resizable:false,
    fullscreenable:false,focusable:true,hasShadow:false,alwaysOnTop:true,
    backgroundColor:'#00000000',webPreferences:{
      preload:path.join(__dirname,'overlay-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,
    }});
  overlayWindow=win;
  overlayBoundDisplayId=display.id;
  win.setAlwaysOnTop(true,'screen-saver');
  win.setIgnoreMouseEvents(!(overlayEditing||overlayAssistantOpen||overlayBuildsOpen),{forward:true});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('did-finish-load',()=>syncOverlay());
  win.on('closed',()=>{if(overlayWindow===win){overlayWindow=null;overlayBoundDisplayId=null}});
  win.loadFile(path.join(__dirname,'learning-overlay.html'));
  return win;
}
function syncOverlay(){
  if(quitting)return;
  const view=overlayPayload();
  if(!view.show){
    overlayEditing=false;overlayAssistantOpen=false;overlayBuildsOpen=false;overlayInteractionMode='';
    if(overlayWindow&&!overlayWindow.isDestroyed())overlayWindow.hide();
    return;
  }
  const win=createOverlayWindow();
  if(win.webContents.isLoading())return;
  const wasVisible=win.isVisible();
  const interaction=overlayEditing?'editor':overlayAssistantOpen?'coach':overlayBuildsOpen?'builds':'play';
  const enteredInteraction=interaction!=='play'&&interaction!==overlayInteractionMode;
  win.setIgnoreMouseEvents(!(overlayEditing||overlayAssistantOpen||overlayBuildsOpen),{forward:true});
  if(interaction!=='play'){
    // Focus once when a player deliberately opens the editor/coach, not on
    // every tracker update: repeatedly focusing here steals League controls.
    if(!wasVisible)win.show();
    if(enteredInteraction)win.focus();
    raiseOverlay(win,{force:enteredInteraction||!wasVisible});
  }else{
    // Immediately return keyboard input to League when closing the editor.
    // Click-through alone does not release keyboard focus on Windows.
    if(overlayInteractionMode!=='play'&&win.isFocused())win.blur();
    if(!wasVisible){win.showInactive();raiseOverlay(win,{force:true})}
    else raiseOverlay(win); // Z-order only; no focus is taken from League.
  }
  overlayInteractionMode=interaction;
  win.webContents.send('overlay:state',view);
}
// Works even outside a match (editable preview). The mouse position selects
// the actual game monitor, not an assumed primary display.
function placeOverlayOnCursorScreen(){
  if(!currentConfig().overlayEnabled)return{ok:false,error:'Enable the overlay first.'};
  const display=cursorDisplay();
  const cfg=readConfig();
  cfg.overlayDisplayId=display.id;
  cfg.overlayLayout={...safeLayout(cfg.overlayLayout),x:0.5,y:0.12};
  writeConfig(cfg);
  setOverlayScreen(display);
  toggleOverlayEditor(true);
  return{ok:true,displayId:display.id,layout:cfg.overlayLayout};
}
function centerOverlayLayout(){
  if(!currentConfig().overlayEnabled)return{ok:false,error:'Enable the overlay first.'};
  const cfg=readConfig();
  cfg.overlayLayout={...safeLayout(cfg.overlayLayout),x:0.4,y:0.2};
  writeConfig(cfg);
  syncOverlay();setState({});
  return{ok:true,layout:cfg.overlayLayout};
}
function nudgeOverlayLayout(dx=0,dy=0){
  if(!overlayEditing||!currentConfig().overlayEnabled)return{ok:false,error:'Open Edit HUD first.'};
  const cfg=readConfig(),p=safeLayout(cfg.overlayLayout);
  const next=safeLayout({...p,x:p.x+Math.max(-0.1,Math.min(0.1,Number(dx)||0)),y:p.y+Math.max(-0.1,Math.min(0.1,Number(dy)||0))});
  cfg.overlayLayout=next;writeConfig(cfg);
  syncOverlay();setState({});
  return{ok:true,layout:next};
}
function applyOverlayEnabled(enabled){
  const cfg=readConfig();cfg.overlayEnabled=Boolean(enabled);writeConfig(cfg);
  if(!enabled){overlayEditing=false;overlayAssistantOpen=false;overlayBuildsOpen=false;}
  syncOverlay();setState({});
  return{ok:true,enabled:cfg.overlayEnabled};
}
function toggleOverlayEditor(forced){
  if(!currentConfig().overlayEnabled)return{ok:false,error:'Enable the overlay first in Companion settings.'};
  overlayEditing=typeof forced==='boolean'?forced:!overlayEditing;
  if(overlayEditing){overlayAssistantOpen=false;overlayBuildsOpen=false;}
  syncOverlay();setState({});
  return{ok:true,editing:overlayEditing};
}
function toggleOverlayAssistant(forced){
  if(!currentConfig().overlayEnabled)return{ok:false,error:'Enable the in-game overlay in Companion settings first.'};
  const next=typeof forced==='boolean'?forced:!overlayAssistantOpen;
  if(next&&!overlayPayload().show)return{ok:false,error:'Start a League or TFT game with Companion recording first.'};
  overlayAssistantOpen=next;
  if(next){overlayEditing=false;overlayBuildsOpen=false;}
  syncOverlay();setState({});
  if(next&&overlayWindow&&!overlayWindow.isDestroyed())overlayWindow.focus();
  else if(overlayWindow&&!overlayWindow.isDestroyed())overlayWindow.blur();
  return{ok:true,open:overlayAssistantOpen};
}

async function askOverlayCoach(input){
  if(!overlayAssistantOpen||overlayCoachBusy)return{ok:false,error:'Open Ask Coach or finish your previous question.'};
  const cfg=currentConfig(),view=overlayPayload();
  if(!cfg.token||!view.show||!['LOL','TFT'].includes(view.game))return{ok:false,error:'Connect Companion and start a recorded match.'};
  const message=String(input?.message||'').trim().slice(0,350);
  if(message.length<2)return{ok:false,error:'Enter a question.'};
  const history=(Array.isArray(input?.history)?input.history:[]).slice(-6).filter(row=>['user','assistant'].includes(row?.role))
    .map(row=>({role:row.role,content:String(row?.content||'').slice(0,550)})).filter(row=>row.content);
  overlayCoachBusy=true;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),13000);
  try{
    const response=await fetch(cfg.webUrl+'/api/live/overlay-coach',{
      method:'POST',signal:controller.signal,
      headers:{authorization:'Bearer '+cfg.token,'content-type':'application/json'},
      body:JSON.stringify({game:view.game,message,history}),
    });
    const result=await response.json().catch(()=>({}));
    return response.ok&&result?.ok?{ok:true,answer:String(result.answer||'').slice(0,1100)}:
      {ok:false,error:String(result?.error||'The coach is temporarily unavailable.').slice(0,160)};
  }catch{
    return{ok:false,error:'Could not reach the coach. Your match keeps recording normally.'};
  }finally{clearTimeout(timer);overlayCoachBusy=false}
}

function toggleOverlayBuilds(forced){
  if(!currentConfig().overlayEnabled)return{ok:false,error:'Enable the overlay first.'};
  const next=typeof forced==='boolean'?forced:!overlayBuildsOpen;
  if(next&&!overlayPayload().show)return{ok:false,error:'The build guide opens during a recorded match.'};
  overlayBuildsOpen=next;
  if(next){overlayEditing=false;overlayAssistantOpen=false;}
  syncOverlay();setState({});
  if(next&&overlayWindow&&!overlayWindow.isDestroyed())overlayWindow.focus();
  else if(overlayWindow&&!overlayWindow.isDestroyed())overlayWindow.blur();
  return{ok:true,open:next};
}

async function refreshTftBuilds(){
  if(tftBuildsInFlight||state.phase!=='WAITING'||!paired())return;
  tftBuildsInFlight=true;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{
    const response=await fetch(currentConfig().webUrl+'/api/tft/pregame-builds',{signal:controller.signal});
    const data=await response.json().catch(()=>({}));
    if(response.ok&&data?.ok&&Array.isArray(data.builds)&&state.phase==='WAITING'){
      const selected=currentConfig().tftBuildId;
      setState({tftBuilds:{patch:String(data.patch||''),asOf:String(data.asOf||''),builds:data.builds.slice(0,5)},tftBuildError:null});
      if(selected&&!data.builds.some(build=>build.id===selected)){
        const cfg=readConfig();cfg.tftBuildId='';writeConfig(cfg);
        setState({});
      }
    }else if(state.phase==='WAITING')setState({tftBuildError:'Static build references temporarily unavailable.'});
  }catch{if(state.phase==='WAITING')setState({tftBuildError:'Static build references temporarily unavailable.'});}
  finally{clearTimeout(timer);tftBuildsInFlight=false}
}
function selectTftBuild(id){
  if(state.tftRecorder?.state==='RECORDING')return{ok:false,error:'Build preference is frozen for this TFT match.'};
  const next=String(id||'');
  if(next&&!state.tftBuilds?.builds?.some(build=>build.id===next))return{ok:false,error:'Select a currently available build.'};
  const cfg=readConfig();cfg.tftBuildId=next;writeConfig(cfg);setState({});
  return{ok:true,id:next};
}
// Champion-select guide is fetched from already existing current-patch League routes.
// If it arrives after play starts, it is NEVER inserted into the live game.
async function refreshLeagueBuild(champion,role){
  const key=champion.trim().toLowerCase()+'|'+role;
  if(leagueBuildInFlight===key||leagueBuildKey===key||state.phase!=='CHAMP_SELECT')return;
  leagueBuildInFlight=key;
  try{
    const result=await championGuide(currentConfig().webUrl,champion,role);
    if(state.phase!=='CHAMP_SELECT'||leagueBuildInFlight!==key)return;
    const build=result?.build?.ok?result.build:null;
    const meta=result?.meta?.ok?result.meta:null;
    leagueBuildKey=key;
    setState({leagueBuild:build||meta?{
      champion,role,patch:String(build?.patch||meta?.patch||''),
      source:String(build?.source||meta?.source||''),
      items:Array.isArray(build?.items)?build.items.slice(0,6).map(item=>String(item.name||'')):[],
      runes:Array.isArray(meta?.runePage?.perks)?meta.runePage.perks.slice(0,6).map(rune=>String(rune.name||'')):[],
      skillOrder:Array.isArray(meta?.skillPriority)?meta.skillPriority.slice(0,4).map(String):[],
      summoners:Array.isArray(meta?.summoners)?meta.summoners.slice(0,2).map(s=>String(s.name||'')):[],
      note:String(build?.note||'').slice(0,220),
    }:null});
  }catch{if(state.phase==='CHAMP_SELECT')setState({leagueBuild:null});}
  finally{if(leagueBuildInFlight===key)leagueBuildInFlight=''}
}
function saveOverlayLayout(raw){
  const cfg=readConfig();cfg.overlayLayout=safeLayout(raw);writeConfig(cfg);
  syncOverlay();setState({});
  return{ok:true,layout:cfg.overlayLayout};
}
function cycleOverlayLayout(){
  const cfg=readConfig();
  const previous=safeLayout(cfg.overlayLayout);
  cfg.overlayLayout={...previous,mode:nextHudMode(previous.mode)};
  writeConfig(cfg);
  syncOverlay();setState({});
  return{ok:true,layout:cfg.overlayLayout};
}
function selectTftFocus(focus){
  const allowed=new Set(['ECONOMY','TEMPO','FLEX','POSITION']);
  if(!allowed.has(focus))return{ok:false,error:'Invalid TFT learning focus.'};
  if(state.tftRecorder?.state==='RECORDING')return{ok:false,error:'TFT focus is locked while the game is active.'};
  const cfg=readConfig();cfg.tftFocus=focus;writeConfig(cfg);
  setState({});
  return{ok:true,focus};
}
function normalizedRole(value){const role=String(value||'').trim().toUpperCase();if(role==='BOTTOM'||role==='ADC')return'ADC';if(role==='UTILITY'||role==='SUPPORT')return'SUPPORT';if(role==='MIDDLE'||role==='MID')return'MID';if(role==='TOP')return'TOP';if(role==='JUNGLE')return'JUNGLE';return role}
function needsRecordingPlanRecovery(){
  if(state.phase!=='RECORDING')return false;
  if(!state.teamPlan)return true;
  if(!state.teamPlan?.adaptiveBuild)return true;
  const role=normalizedRole(state.matchup?.role||state.matchup?.plan?.role);
  return (role==='ADC'||role==='SUPPORT')&&!state.teamPlan?.botLane;
}
function canPollChampionPlan(){return state.phase==='CHAMP_SELECT'||needsRecordingPlanRecovery()}

function setState(patch){
  const previousPhase=state.phase;
  const requestedPhase=String(patch?.phase||'').toUpperCase();
  if(requestedPhase==='AUTH_ERROR')pairingAuthInvalid=true;
  if(requestedPhase==='SETUP'||requestedPhase==='STARTING')pairingAuthInvalid=false;
  if(pairingAuthInvalid&&requestedPhase&&!['AUTH_ERROR','SETUP','STARTING'].includes(requestedPhase)){
    patch={...patch,phase:'AUTH_ERROR',detail:'This PC pairing is no longer valid. Re-pair from OP CLIMB.'};
  }
  const enteringChampSelect=patch?.phase==='CHAMP_SELECT'&&previousPhase!=='CHAMP_SELECT';
  const enteringRecording=patch?.phase==='RECORDING'&&previousPhase!=='RECORDING';
  if(enteringRecording){cancelRecordingExit();recordingStartedAt=Date.now();lastLocalRecordingSignalAt=Date.now()}
  if(requestedPhase==='UPLOADING'||requestedPhase==='REVIEW'||requestedPhase==='WAITING'||requestedPhase==='SETUP'||requestedPhase==='AUTH_ERROR')cancelRecordingExit();
  if(enteringChampSelect||enteringRecording){stopPostGameReviewPoll();reviewPollAttempts=0;patch={...patch,postGameReview:null,liveHud:null}}
  const previousTftState=String(state.tftRecorder?.state||'');
  const previousLeagueChampion=String(state.matchup?.champion||'').trim().toLowerCase();
  state={...state,...patch,paired:paired(),autoStart:currentConfig().autoStart};
  if(state.phase==='CHAMP_SELECT'&&state.matchup?.champion&&String(state.matchup.champion).trim().toLowerCase()!==previousLeagueChampion){
    state.leagueBuild=null;leagueBuildKey='';
  }
  // Update the learning contract ONLY during Champion Select, before play.
  // Later plan-recovery responses must never silently change the in-game HUD.
  if(enteringChampSelect){overlayFrozenLeague=null;overlayFrozenLeagueBuild=null;leagueBuildKey='';}
  else if(state.phase==='CHAMP_SELECT'&&state.matchup?.status==='READY'){
    overlayFrozenLeague=freezeLeaguePlan(state)||overlayFrozenLeague;
  }else if(enteringRecording&&!overlayFrozenLeague){
    overlayFrozenLeague=freezeLeaguePlan(state);
  }else if(!['CHAMP_SELECT','RECORDING'].includes(state.phase)){
    overlayFrozenLeague=null;
  }
  if(enteringRecording){overlayFrozenLeagueBuild=state.leagueBuild?{...state.leagueBuild}:null;}
  if(enteringRecording&&!overlayEditing&&currentConfig().overlayDisplayId==null)setOverlayScreen(cursorDisplay());
  if(state.phase==='CHAMP_SELECT'&&state.matchup?.champion){
    const champion=String(state.matchup.champion||'').trim();
    const role=normalizedRole(state.matchup.role||state.matchup.plan?.role);
    if(champion&&['TOP','JUNGLE','MID','ADC','SUPPORT'].includes(role))void refreshLeagueBuild(champion,role);
  }
  if(state.tftRecorder?.state==='RECORDING'&&previousTftState!=='RECORDING'){
    const available=state.tftBuilds?.builds||[];
    overlayFrozenTftBuilds={patch:state.tftBuilds?.patch||'',asOf:state.tftBuilds?.asOf||'',selectedId:currentConfig().tftBuildId,builds:available.map(build=>({...build}))};
    if(!overlayEditing&&currentConfig().overlayDisplayId==null)setOverlayScreen(cursorDisplay());
    overlayFrozenTftFocus=currentConfig().tftFocus;
    overlayFrozenTftMission=state.tftMission?.mission?{...state.tftMission.mission}:null;
  }else if(state.tftRecorder?.state!=='RECORDING'){
    overlayFrozenTftFocus=null;
    overlayFrozenTftMission=null;
    overlayFrozenTftBuilds=null;
  }
  if(state.phase==='WAITING'&&previousPhase!=='WAITING'){
    const detectedRole=normalizedRole(state.postGameReview?.match?.role||state.matchup?.role||state.matchup?.plan?.role);
    if(['TOP','JUNGLE','MID','ADC','SUPPORT'].includes(detectedRole))dnaViewRole=detectedRole;
    scheduleMissedReviewRecovery(4500);
    stopPlayerHomePoll();
    void pollPlayerHome();
    void refreshTftBuilds();
  }else if(previousPhase==='WAITING'&&state.phase!=='WAITING'){
    stopMissedReviewRecovery();
    stopPlayerHomePoll();
  }
  if(enteringChampSelect){
    matchupSignature='';state={...state,matchup:null,teamPlan:null,draft:null,leagueBuild:null};startChampionPlanPoll();
  }else if(enteringRecording){
    if(needsRecordingPlanRecovery())startChampionPlanPoll();else stopChampionPlanPoll();
  }else{
    if(previousPhase==='CHAMP_SELECT'&&state.phase!=='CHAMP_SELECT'&&!needsRecordingPlanRecovery())stopChampionPlanPoll();
  }
  updateTray();
  if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('companion:state',publicState());
  syncOverlay();
}
function addLog(line,kind='info'){
  const clean=String(line||'').trim();if(!clean)return;
  if(clean.startsWith(MATCHUP_PREFIX)||clean.startsWith(TRACKER_STATE_PREFIX)||clean.startsWith(DRAFT_CONTEXT_PREFIX)||clean.startsWith('OPCLIMB_HUD_JSON=')){parseTrackerLine(clean,kind);return}
  recentLogs.push({at:new Date().toISOString(),kind,line:clean});
  if(recentLogs.length>200)recentLogs=recentLogs.slice(-200);
  setState({lastLog:clean});parseTrackerLine(clean,kind);
}

function stopPlayerHomePoll(){if(playerHomeTimer){clearTimeout(playerHomeTimer);playerHomeTimer=null}}
function schedulePlayerHomePoll(delay=60_000){
  stopPlayerHomePoll();
  if(quitting||state.phase!=='WAITING'||!paired())return;
  playerHomeTimer=setTimeout(()=>{playerHomeTimer=null;void pollPlayerHome()},delay);
}
async function pollPlayerHome(roleOverride=dnaViewRole){
  if(state.phase==='WAITING')void pollTftMission();
  if(playerHomeInFlight||state.phase!=='WAITING')return false;
  const cfg=currentConfig();if(!cfg.token)return false;
  playerHomeInFlight=true;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const requested=normalizedRole(roleOverride);
    const suffix=['TOP','JUNGLE','MID','ADC','SUPPORT'].includes(requested)?`?role=${encodeURIComponent(requested)}`:'';
    const response=await fetch(`${cfg.webUrl}/api/live/companion-home${suffix}`,{headers:{authorization:`Bearer ${cfg.token}`},signal:controller.signal});
    const body=await response.json().catch(()=>({}));
    if(response.status===401||response.status===403){setState({phase:'AUTH_ERROR',detail:'This PC pairing is no longer valid. Re-pair from OP CLIMB.'});return false}
    if(response.ok&&body?.ok&&state.phase==='WAITING'){
      dnaViewRole=normalizedRole(body.selectedRole||body.player?.role)||dnaViewRole;
      setState({playerHome:body});
      return true;
    }
  }catch{}
  finally{clearTimeout(timeout);playerHomeInFlight=false;if(state.phase==='WAITING')schedulePlayerHomePoll()}
  return false;
}

// The companion fetches the same account-scoped mission as the TFT website.
async function pollTftMission(){
  if(state.rankedSoloOnly)return;
  if(tftMissionInFlight||state.phase!=='WAITING'||!paired())return;
  const cfg=currentConfig();if(!cfg.token)return;
  tftMissionInFlight=true;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(cfg.webUrl+'/api/tft/current-mission',{headers:{authorization:'Bearer '+cfg.token},signal:controller.signal});
    const payload=await response.json().catch(()=>({}));
    if(response.ok&&payload?.ok&&payload?.mission&&state.phase==='WAITING'){
      setState({tftMission:payload,tftMissionError:null});
    }else if(state.phase==='WAITING'){
      setState({tftMissionError:response.status===401?'Reconnect the Companion to sync your TFT mission.':'TFT mission sync unavailable; your previous mission is retained.'});
    }
  }catch{
    if(state.phase==='WAITING')setState({tftMissionError:'TFT mission sync unavailable; your previous mission is retained.'});
  }finally{clearTimeout(timeout);tftMissionInFlight=false}
}

async function selectDnaRole(role){
  const next=normalizedRole(role);
  if(!['TOP','JUNGLE','MID','ADC','SUPPORT'].includes(next))return{ok:false,error:'Unknown League role.'};
  if(state.phase!=='WAITING')return{ok:false,error:'DNA role profiles can only be browsed while you are out of game.'};
  dnaViewRole=next;
  stopPlayerHomePoll();
  if(playerHomeInFlight){
    setTimeout(()=>{if(state.phase==='WAITING')void pollPlayerHome(next)},300);
    return{ok:true,role:next};
  }
  await pollPlayerHome(next);
  return{ok:true,role:next};
}

function stopChampionPlanPoll(){if(championPlanTimer){clearTimeout(championPlanTimer);championPlanTimer=null}}
function scheduleChampionPlanPoll(delay=250){
  stopChampionPlanPoll();if(!canPollChampionPlan())return;
  championPlanTimer=setTimeout(()=>{championPlanTimer=null;void pollChampionPlan()},delay);
}
function startChampionPlanPoll(){stopChampionPlanPoll();if(canPollChampionPlan())void pollChampionPlan()}
async function pollChampionPlan(){
  if(championPlanInFlight||!canPollChampionPlan())return;
  const cfg=currentConfig();if(!cfg.token)return;
  championPlanInFlight=true;
  let nextPollDelay=1600;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),7000);
  try{
    const response=await fetch(`${cfg.webUrl}/api/live/champion-plan`,{headers:{authorization:`Bearer ${cfg.token}`},signal:controller.signal});
    const body=await response.json().catch(()=>({}));
    if(response.status===401||response.status===403){setState({phase:'AUTH_ERROR',detail:'This PC pairing is no longer valid. Re-pair from OP CLIMB.'});return}
    if(response.status===429){
      nextPollDelay=Math.max(1600,Math.min(60_000,(Number(response.headers.get('retry-after'))||3)*1000));
      return;
    }
    if(body?.draft)setState({draft:freshestDraft(state.draft,body.draft)});
    if(response.ok&&!body?.ready){
      if(state.phase==='CHAMP_SELECT')setState({draft:freshestDraft(state.draft,body?.draft),matchup:null,teamPlan:null});
      return;
    }
    if(!response.ok||!body?.plan||!body?.champion)return;
    if(!canPollChampionPlan()&&state.phase!=='RECORDING')return;
    const champion=String(body.champion).trim(),role=String(body.role||'').trim();
    const teamPlan=body.teamPlan||null;
    const locked=Boolean(body.locked);
    const source=body.recoveredFromEndedPregame?'PREGAME_RECOVERY':locked?'CHAMPION_LOCK':'CHAMPION_HOVER';
    const fullOpponent=Boolean(state.matchup?.opponent&&String(state.matchup?.champion||'').toLowerCase()===champion.toLowerCase()&&['CHAMP_SELECT','IN_GAME'].includes(String(state.matchup?.source||'')));
    if(fullOpponent){setState({teamPlan,draft:freshestDraft(state.draft,body.draft)});return}
    const signature=`self|${champion}|${role}|${locked?'locked':'preview'}|${JSON.stringify(teamPlan?.ourTeam||[])}|${JSON.stringify(teamPlan?.theirTeam||[])}`.toLowerCase();
    if(signature!==matchupSignature||state.matchup?.status!=='READY'){
      matchupSignature=signature;
      const detail=body.recoveredFromEndedPregame
        ?`${champion} pregame briefing recovered for this match.`
        :locked
          ?`${champion} locked. Final plan ready; it will keep upgrading as enemy picks appear.`
          :`${champion} preview ready. Change your hover freely — lock in to freeze the final plan.`;
      setState({matchup:{status:'READY',champion,opponent:null,role:role||null,source,plan:body.plan,error:null,provisional:!locked},teamPlan,draft:freshestDraft(state.draft,body.draft),detail});
    }else if(teamPlan)setState({teamPlan,draft:freshestDraft(state.draft,body.draft)});
  }catch{}
  finally{
    clearTimeout(timeout);championPlanInFlight=false;
    if(state.phase==='CHAMP_SELECT'){
      const role=normalizedRole(state.matchup?.role||state.matchup?.plan?.role);
      const botMissing=(role==='ADC'||role==='SUPPORT')&&!state.teamPlan?.botLane;
      scheduleChampionPlanPoll(Math.max(nextPollDelay,botMissing?1600:(state.matchup?.status==='READY'?2000:1600)));
    }else if(needsRecordingPlanRecovery())scheduleChampionPlanPoll(Math.max(nextPollDelay,1600));
  }
}

function stopPostGameReviewPoll(){if(reviewPollTimer){clearTimeout(reviewPollTimer);reviewPollTimer=null}}
function stopMissedReviewRecovery(){if(missedReviewTimer){clearTimeout(missedReviewTimer);missedReviewTimer=null}}
function scheduleMissedReviewRecovery(delay=30_000){
  if(missedReviewTimer||quitting||state.phase!=='WAITING')return;
  missedReviewTimer=setTimeout(()=>{missedReviewTimer=null;void recoverLatestCompletedReview()},delay);
}
function schedulePostGameReviewPoll(delay=1800){stopPostGameReviewPoll();reviewPollTimer=setTimeout(()=>{reviewPollTimer=null;void pollPostGameReview()},delay)}
function startPostGameReviewPoll(){reviewPollAttempts=0;stopPostGameReviewPoll();void pollPostGameReview()}
function markReviewRendered(sessionId){
  const id=String(sessionId||'').trim();if(!id)return;
  const cfg=readConfig();
  cfg.lastReviewSessionId=id;
  cfg.lastReviewRenderedSessionId=id;
  cfg.lastReviewRenderedAt=new Date().toISOString();
  writeConfig(cfg);
}
async function confirmReviewRendered(sessionId){
  const id=String(sessionId||'').trim();if(!id)return false;
  for(let attempt=0;attempt<8;attempt+=1){
    const win=createWindow(true);
    if(!win||win.isDestroyed())return false;
    if(win.webContents.isLoadingMainFrame()){
      await new Promise(resolve=>{
        let settled=false;
        const finish=()=>{if(settled)return;settled=true;clearTimeout(timer);win.webContents.removeListener('did-finish-load',finish);resolve()};
        const timer=setTimeout(finish,1200);
        win.webContents.once('did-finish-load',finish);
      });
    }
    try{win.webContents.send('companion:state',publicState())}catch{}
    try{
      const rendered=await win.webContents.executeJavaScript(
        `(()=>{const section=document.querySelector('#ocNative[data-route="review"] .oc-review');return Boolean(section&&String(window.__opRenderedReviewSessionId||'')===${JSON.stringify(id)});})()`,
        true,
      );
      if(rendered)return true;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,350));
  }
  return false;
}
async function presentPostGameReview(review,detail){
  const sessionId=String(review?.sessionId||'').trim();if(!sessionId)return false;
  stopPostGameReviewPoll();
  setState({phase:'REVIEW',detail,postGameReview:review});
  createWindow(true);
  const rendered=await confirmReviewRendered(sessionId);
  if(rendered){
    markReviewRendered(sessionId);
    return true;
  }
  setState({detail:'Your review is ready, but the Companion did not confirm that the review card rendered. Re-open Companion and it will recover this review again.'});
  return false;
}
async function recoverLatestCompletedReview(){
  if(reviewPollInFlight||state.phase!=='WAITING')return;
  const cfg=currentConfig();if(!cfg.token)return;
  reviewPollInFlight=true;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20_000);
  try{
    const response=await fetch(`${cfg.webUrl}/api/live/companion-review`,{headers:{authorization:`Bearer ${cfg.token}`},signal:controller.signal});
    if(response.status===202)return;
    const body=await response.json().catch(()=>({}));
    if(response.status===401||response.status===403){setState({phase:'AUTH_ERROR',detail:'This PC pairing is no longer valid. Re-pair from OP CLIMB.'});return}
    const review=body?.review;
    const sessionId=String(review?.sessionId||'').trim();
    if(!response.ok||!body?.ready||!review||!sessionId||sessionId===cfg.lastReviewRenderedSessionId)return;
    const endedAt=Date.parse(String(review?.endedAt||''));
    const age=Number.isFinite(endedAt)?Date.now()-endedAt:Number.POSITIVE_INFINITY;
    if(age<0||age>8*60*60_000)return;
    await presentPostGameReview(review,'Recovered your latest completed match review.');
  }catch{}
  finally{clearTimeout(timeout);reviewPollInFlight=false;scheduleMissedReviewRecovery()}
}

async function pollPostGameReview(){
  if(reviewPollInFlight)return;
  const cfg=currentConfig();if(!cfg.token)return;
  if(reviewPollAttempts>=40){stopPostGameReviewPoll();setState({detail:'Match saved. Open OP CLIMB for the full review if the short summary has not appeared yet.'});return}
  reviewPollAttempts+=1;reviewPollInFlight=true;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20_000);
  try{
    const response=await fetch(`${cfg.webUrl}/api/live/companion-review`,{headers:{authorization:`Bearer ${cfg.token}`},signal:controller.signal});
    if(response.status===202){schedulePostGameReviewPoll();return}
    const body=await response.json().catch(()=>({}));
    if(response.status===401||response.status===403){setState({phase:'AUTH_ERROR',detail:'This PC pairing is no longer valid. Re-pair from OP CLIMB.'});return}
    if(!response.ok||!body?.ready||!body?.review){schedulePostGameReviewPoll(2500);return}
    await presentPostGameReview(body.review,'Your key good points and critical points are ready.');
  }catch{schedulePostGameReviewPoll(2500)}
  finally{clearTimeout(timeout);reviewPollInFlight=false}
}

function applyTrackerState(raw){
  const source=arguments.length>1?arguments[1]:'LOCAL';
  const next=String(raw?.state||'').toUpperCase(),detail=String(raw?.detail||'').trim(),origin=String(source||'LOCAL').toUpperCase();
  if(next==='RECORDING'){
    // Cloud status can lag behind the machine; local signals and live data
    // cancel premature end-of-match transitions.
    if(origin==='LOCAL')markRecordingAlive();
    return setState({phase:'RECORDING',detail:detail||'Match detected. Recording quietly in the background.'});
  }
  if(next==='GAME_STARTING'){
    if(origin==='LOCAL')markRecordingAlive();
    return setState({phase:'RECORDING',detail:detail||'League match detected. Connecting live telemetry…'});
  }
  if(next==='CHAMP_SELECT'&&origin==='SERVER'&&state.phase==='RECORDING')return;
  if(next==='CHAMP_SELECT'){
    if(origin==='LOCAL')lastLocalChampSelectAt=Date.now();
    return setState({phase:'CHAMP_SELECT',detail:detail||'Champ select detected. Reading the draft now — hover a champion for a preview.'});
  }
  if(next==='WAITING'||next==='LCU_UNAVAILABLE'){
    if(origin==='SERVER'&&state.phase==='CHAMP_SELECT'&&Date.now()-lastLocalChampSelectAt<15_000)return;
    if(state.phase==='RECORDING'){
      // Never interpret a delayed cloud status as the end of a local game.
      // The installed tracker or explicit recording-close event owns the end.
      if(origin==='SERVER')return;
      scheduleRecordingExit('Match finished. Pulling out the key good points and critical points.');
      return;
    }
    if(state.phase==='UPLOADING'||state.phase==='REVIEW')return;
    return setState({phase:'WAITING',detail:detail||'Connected. Waiting for League.'});
  }
  if(next==='ERROR'&&state.phase!=='RECORDING')setState({phase:'ERROR',detail:detail||'Tracker reported a local detection problem.'});
}

function stopTrackerStatusReconcile(){
  if(trackerStatusTimer){clearTimeout(trackerStatusTimer);trackerStatusTimer=null}
}
function scheduleTrackerStatusReconcile(delay=900){
  stopTrackerStatusReconcile();
  if(quitting||!paired()||!tracker||tracker.killed)return;
  trackerStatusTimer=setTimeout(()=>{trackerStatusTimer=null;void reconcileTrackerStatus()},delay);
}
async function reconcileTrackerStatus(){
  if(trackerStatusInFlight||quitting||!paired()||!tracker||tracker.killed)return;
  const cfg=currentConfig();if(!cfg.token)return;
  trackerStatusInFlight=true;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),4500);
  try{
    const response=await fetch(`${cfg.webUrl}/api/live/status`,{headers:{authorization:`Bearer ${cfg.token}`},signal:controller.signal,cache:'no-store'});
    const body=await response.json().catch(()=>({}));
    if(response.status===401||response.status===403){setState({phase:'AUTH_ERROR',detail:'This PC pairing is no longer valid. Re-pair from OP CLIMB.'});return}
    const remote=body?.status?.tracker_status;
    const updatedAt=Date.parse(String(body?.status?.tracker_status_updated_at||''));
    const age=Number.isFinite(updatedAt)?Date.now()-updatedAt:Number.POSITIVE_INFINITY;
    if(response.ok&&remote&&age>=0&&age<=45_000)applyTrackerState(remote,'SERVER');
  }catch{}
  finally{
    clearTimeout(timeout);trackerStatusInFlight=false;
    scheduleTrackerStatusReconcile();
  }
}
function parseTrackerLine(line,kind){
  if(line.startsWith('OPCLIMB_HUD_JSON=')){
    try{if(state.phase==='RECORDING'){markRecordingAlive(true);setState({liveHud:JSON.parse(line.slice('OPCLIMB_HUD_JSON='.length))})}}catch{}
    return;
  }
  if(line.startsWith(MATCHUP_PREFIX)){try{void loadMatchupPlan(JSON.parse(line.slice(MATCHUP_PREFIX.length)))}catch{}return}
  if(line.startsWith(TRACKER_STATE_PREFIX)){try{applyTrackerState(JSON.parse(line.slice(TRACKER_STATE_PREFIX.length)))}catch{}return}
  if(line.startsWith(DRAFT_CONTEXT_PREFIX)){try{if(state.phase==='CHAMP_SELECT')setState({draft:freshestDraft(state.draft,draftFromLocalContext(JSON.parse(line.slice(DRAFT_CONTEXT_PREFIX.length))))})}catch{}return}
  const lower=line.toLowerCase();
  if(lower.includes('pairing token rejected'))return setState({phase:'AUTH_ERROR',detail:'This PC pairing is no longer valid. Re-pair from OP CLIMB.'});
  if(lower.includes('champ select detected'))return setState({phase:'CHAMP_SELECT',detail:'Champ select detected. Reading the live draft — hover a champion for a preview.'});
  if(lower.includes('match recording closed')){cancelRecordingExit();setState({phase:'UPLOADING',detail:'Match finished. Pulling out the key good points and critical points.'});startPostGameReviewPoll();return}
  if(lower.includes('recording')||lower.includes('match telemetry'))return setState({phase:'RECORDING',detail:'Match detected. Recording quietly in the background.'});
  if(lower.includes('review')&&lower.includes('post')){setState({phase:'UPLOADING',detail:'Match finished. Pulling out the key good points and critical points.'});startPostGameReviewPoll();return}
  if(lower.includes('waiting for the match')||lower.includes('waiting for league')||lower.includes('waiting.'))return state.phase==='RECORDING'?scheduleRecordingExit('Match finished. Preparing your review.'):setState({phase:'WAITING',detail:'Connected. Waiting for League.'});
  if(lower.includes('league client connected'))return state.phase==='RECORDING'?undefined:setState({phase:'WAITING',detail:'League detected. Waiting for champ select or match.'});
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

async function requestDraftCoach(context){
  const cfg=currentConfig();
  if(!cfg.token)return{ok:false,status:401,code:'PAIR_REQUIRED',retryable:false,error:'Pair this PC to OP CLIMB first.'};
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),18_000);
  try{
    const response=await fetch(`${cfg.webUrl}/api/live/draft-coach`,{
      method:'POST',
      headers:{'content-type':'application/json',authorization:`Bearer ${cfg.token}`},
      body:JSON.stringify(context||{}),
      signal:controller.signal,
    });
    const body=await response.json().catch(()=>({}));
    const retryAfterSeconds=Math.max(0,Number(response.headers.get('retry-after'))||0);
    if(response.status===401)return{...body,ok:false,status:401,code:'AUTH',retryable:false,error:'This PC pairing is no longer valid.'};
    if(!response.ok){
      const code=response.status===202?'DRAFT_WAITING'
        :response.status===403?'ENTITLEMENT'
        :response.status===429?'RATE_LIMIT'
        :response.status===503&&Array.isArray(body?.coachQuality?.issues)?'QUALITY_GATE'
        :response.status>=500?'SERVER'
        :'REQUEST';
      return{...body,ok:false,status:response.status,code,retryable:response.status===202||response.status===429||response.status>=500,retryAfterSeconds,error:body?.error||`Draft coach returned HTTP ${response.status}.`};
    }
    return{...body,status:response.status};
  }catch(err){
    const timeoutError=err?.name==='AbortError';
    return{ok:false,status:0,code:timeoutError?'TIMEOUT':'NETWORK',retryable:true,error:timeoutError?'Draft coach timed out.':(err?.message||'Could not reach Draft Coach.')};
  }finally{clearTimeout(timeout)}
}

function localReadCheckpointFile(){
  const root=process.env.LOCALAPPDATA?path.join(process.env.LOCALAPPDATA,'OVERPOWERED','Tracker'):path.join(configDir(),'tracker');
  mkdirSync(root,{recursive:true});
  return path.join(root,'read-checkpoints.json');
}
async function recordReadCheckpoint(context){
  if(!currentConfig().token)return{ok:false,status:401,error:'Pair this PC to OP CLIMB first.'};
  const minute=Number(context?.checkpointMinute);
  if(![5,10,15].includes(minute))return{ok:false,status:400,error:'Checkpoint minute is invalid.'};
  const checkpoint={
    checkpointMinute:minute,
    gameSeconds:Math.max(0,Number(context?.gameSeconds)||0),
    stateRead:['AHEAD','EVEN','BEHIND'].includes(String(context?.stateRead))?String(context.stateRead):'EVEN',
    confidenceRead:['HIGH','MEDIUM','LOW'].includes(String(context?.confidenceRead))?String(context.confidenceRead):null,
    threatRead:String(context?.threatRead||'').trim().slice(0,80)||null,
    priorityRead:String(context?.priorityRead||'').trim().slice(0,80)||null,
  };
  try{
    const file=localReadCheckpointFile();
    let rows=[];try{const parsed=JSON.parse(readFileSync(file,'utf8'));if(Array.isArray(parsed))rows=parsed}catch{}
    rows=rows.filter(row=>Number(row?.checkpointMinute)!==minute);
    rows.push(checkpoint);rows.sort((a,b)=>Number(a.checkpointMinute)-Number(b.checkpointMinute));
    writeFileSync(file,JSON.stringify(rows.slice(0,3)),'utf8');
    return{ok:true,status:200,local:true,checkpoint};
  }catch(err){
    return{ok:false,status:0,error:err?.message||'Could not save your game read locally.'};
  }
}

async function answerIntentProbe(context){
  const cfg=currentConfig();
  if(!cfg.token)return{ok:false,status:401,error:'Pair this PC to OP CLIMB first.'};
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(`${cfg.webUrl}/api/live/intent-probe`,{
      method:'POST',
      headers:{'content-type':'application/json',authorization:`Bearer ${cfg.token}`},
      body:JSON.stringify(context||{}),
      signal:controller.signal,
    });
    const body=await response.json().catch(()=>({}));
    return{...body,status:response.status,ok:Boolean(response.ok&&body?.ok)};
  }catch(err){
    return{ok:false,status:0,error:err?.name==='AbortError'?'Intent Gap answer timed out.':(err?.message||'Could not freeze Intent Gap answer.')};
  }finally{clearTimeout(timeout)}
}

function trackerPath(){return app.isPackaged?path.join(process.resourcesPath,'tracker','main.mjs'):path.join(__dirname,'..','src','main.mjs')}
function bindTrackerStream(stream,kind){
  if(!stream)return;
  let buffer='';
  stream.setEncoding('utf8');
  stream.on('data',chunk=>{
    buffer+=String(chunk);
    const lines=buffer.split(/\r?\n/);
    buffer=lines.pop()||'';
    lines.forEach(line=>addLog(line,kind));
  });
  stream.on('end',()=>{if(buffer.trim())addLog(buffer,kind);buffer=''});
}
function stopTracker(){
  cancelRecordingExit();
  stopChampionPlanPoll();stopPostGameReviewPoll();stopMissedReviewRecovery();stopTrackerStatusReconcile();if(trackerRestartTimer){clearTimeout(trackerRestartTimer);trackerRestartTimer=null}
  if(tracker&&!tracker.killed){try{tracker.kill()}catch{}}tracker=null;setState({trackerRunning:false});
}
function startTracker(){
  const cfg=currentConfig();if(!cfg.token){stopTracker();return setState({phase:'SETUP',detail:'Pair this PC from OP CLIMB to start live tracking.'})}
  if(tracker&&!tracker.killed)return;
  const runtime=trackerPath();if(!existsSync(runtime))return setState({phase:'ERROR',detail:'Tracker runtime is missing. Reinstall OP CLIMB Companion.'});
  tracker=spawn(process.execPath,[runtime],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1',OP_WEB_URL:cfg.webUrl,OP_TRACKER_TOKEN:cfg.token},windowsHide:true,stdio:['ignore','pipe','pipe']});
  setState({phase:'WAITING',detail:'Companion is running. Waiting for League.',trackerRunning:true});
  scheduleTrackerStatusReconcile(900);
  bindTrackerStream(tracker.stdout,'info');
  bindTrackerStream(tracker.stderr,'error');
  tracker.on('error',err=>{addLog(`Tracker failed to start: ${err.message}`,'error');setState({phase:'ERROR',detail:'Tracker could not start.',trackerRunning:false})});
  tracker.on('exit',(code,signal)=>{
    tracker=null;setState({trackerRunning:false});
    if(quitting||state.phase==='AUTH_ERROR'||!paired())return;
    addLog(`Tracker stopped${code!==null?` with code ${code}`:''}${signal?` (${signal})`:''}. Restarting shortly.`,'error');
    setState({phase:'RESTARTING',detail:'Tracker stopped unexpectedly. Restarting automatically…'});
    trackerRestartTimer=setTimeout(()=>{trackerRestartTimer=null;startTracker()},5000);
  });
}

function stopTftRecorder(){
  if(tftRecorder){try{tftRecorder.stop?.()}catch{}tftRecorder=null}
  setState({tftRecorder:{available:true,state:'STOPPED',detail:'TFT recorder stopped.'}});
}
function startTftRecorder(){
  if(state.rankedSoloOnly){setState({tftRecorder:{available:false,state:'DISABLED',detail:'OP CLIMB is focused on Ranked Solo/Duo 5v5.'}});return}
  if(!paired())return;
  if(tftRecorder)return;
  try{
    tftRecorder=startNativeTftRecorder({
      app,
      getConfig:()=>{const config=currentConfig();return{webUrl:config.webUrl,token:config.token}},
      log:(line,kind)=>addLog(line,kind),
      onStatus:status=>setState({tftRecorder:status}),
    });
  }catch(err){
    addLog(`TFT recorder failed to start: ${err?.message||err}`,'error');
    setState({tftRecorder:{available:false,state:'ERROR',detail:'TFT recorder could not start.'}});
  }
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
  pairingAuthInvalid=false;
  recentLogs=[];matchupSignature='';setState({matchup:null,teamPlan:null,postGameReview:null});stopTracker();stopTftRecorder();startTracker();startTftRecorder();
}

function trackerHome(){return process.env.LOCALAPPDATA?path.join(process.env.LOCALAPPDATA,'OVERPOWERED','Tracker'):path.join(configDir(),'tracker')}
function activeSessionFile(){return path.join(trackerHome(),'active-session.json')}
function markedMomentsFile(){return path.join(trackerHome(),'marked-moments.json')}
function markMoment(){
  if(state.phase!=='RECORDING')return{ok:false,error:'A League match is not currently recording.'};
  let session={};try{session=JSON.parse(readFileSync(activeSessionFile(),'utf8'))}catch{}
  if(!session?.id||!Number.isFinite(Number(session.lastGameTime)))return{ok:false,error:'The local match clock is not ready yet. Try again in a moment.'};
  const row={
    at:new Date().toISOString(),
    clientSessionId:String(session?.id||''),
    gameSeconds:Math.max(0,Number(session?.lastGameTime)||0),
    source:'PLAYER_HOTKEY',
  };
  mkdirSync(trackerHome(),{recursive:true});
  let rows=[];try{const parsed=JSON.parse(readFileSync(markedMomentsFile(),'utf8'));if(Array.isArray(parsed))rows=parsed}catch{}
  rows=rows.filter(item=>String(item?.clientSessionId||'')===row.clientSessionId||!row.clientSessionId).slice(-24);
  rows.push(row);writeFileSync(markedMomentsFile(),JSON.stringify(rows.slice(-25)),'utf8');
  addLog(`Moment marked at ${Math.floor(row.gameSeconds/60)}:${String(Math.floor(row.gameSeconds%60)).padStart(2,'0')}.`);
  return{ok:true,moment:row};
}
function createWindow(show=true){
  if(mainWindow&&!mainWindow.isDestroyed()){if(show){mainWindow.show();mainWindow.focus()}return mainWindow}
  mainWindow=new BrowserWindow({width:1240,height:880,minWidth:760,minHeight:680,show:false,backgroundColor:'#05080d',title:APP_NAME,icon:appIcon(),autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  mainWindow.loadFile(path.join(__dirname,'index.html'));
  mainWindow.once('ready-to-show',()=>{if(show)mainWindow.show()});
  mainWindow.on('close',event=>{if(!quitting){event.preventDefault();mainWindow.hide()}});
  mainWindow.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//i.test(url))shell.openExternal(url);return{action:'deny'}});
  return mainWindow;
}
function trayLabel(){return({SETUP:'Setup required',WAITING:'Waiting for League',CHAMP_SELECT:'Champ select',RECORDING:'Recording match',UPLOADING:'Preparing review',REVIEW:'Review ready',AUTH_ERROR:'Re-pair required',RESTARTING:'Restarting tracker',ERROR:'Tracker problem',STARTING:'Starting'})[state.phase]||state.phase}
function updateTray(){
  if(!tray)return;tray.setToolTip(`${APP_NAME} — ${trayLabel()}`);
  tray.setContextMenu(Menu.buildFromTemplate([{label:`Status: ${trayLabel()}`,enabled:false},{type:'separator'},
    {label:'Open Companion',click:()=>createWindow(true)},
    {label:'Enable in-game learning overlay',type:'checkbox',checked:currentConfig().overlayEnabled,click:item=>applyOverlayEnabled(item.checked)},
    {label:'Edit overlay layout (Alt+B)',enabled:currentConfig().overlayEnabled,click:()=>toggleOverlayEditor()},
    {label:'Move overlay to cursor monitor (Ctrl+Shift+H)',enabled:currentConfig().overlayEnabled,click:()=>placeOverlayOnCursorScreen()},
    {label:'Centre overlay on its monitor',enabled:currentConfig().overlayEnabled,click:()=>centerOverlayLayout()},
    {label:'Cycle HUD size (Ctrl+Shift+L)',enabled:currentConfig().overlayEnabled,click:()=>cycleOverlayLayout()},
    {label:'Ask AI Coach (Ctrl+Shift+K)',enabled:currentConfig().overlayEnabled,click:()=>toggleOverlayAssistant()},
    {label:'View static build ideas (Ctrl+Shift+B)',enabled:currentConfig().overlayEnabled,click:()=>toggleOverlayBuilds()}, 
    {label:'Open OP CLIMB',click:()=>shell.openExternal(`${currentConfig().webUrl}/live`)},
    {label:'Restart Tracker',enabled:paired(),click:()=>{stopTracker();startTracker()}},{type:'separator'},
    {label:'Quit',click:()=>{quitting=true;app.quit()}}]));
}
function createTray(){tray=new Tray(appIcon().resize({width:24,height:24}));tray.on('double-click',()=>createWindow(true));updateTray()}
function applyAutoStart(enabled){const next=Boolean(enabled);try{app.setLoginItemSettings({openAtLogin:next,args:next?['--hidden']:[]})}catch{}const cfg=readConfig();cfg.autoStart=next;writeConfig(cfg);setState({autoStart:next})}

ipcMain.handle('overlay:get-state',()=>overlayPayload());
ipcMain.handle('overlay:save-layout',(_event,layout)=>saveOverlayLayout(layout));
ipcMain.handle('overlay:nudge',(_event,dx,dy)=>nudgeOverlayLayout(dx,dy));
ipcMain.handle('overlay:center',()=>centerOverlayLayout());
ipcMain.handle('overlay:finish-edit',()=>toggleOverlayEditor(false));
ipcMain.handle('overlay:assistant-toggle',()=>toggleOverlayAssistant());
ipcMain.handle('overlay:builds-toggle',()=>toggleOverlayBuilds());
ipcMain.handle('overlay:ask-coach',(event,input)=>event.sender===overlayWindow?.webContents?askOverlayCoach(input):{ok:false,error:'Unrecognised overlay window.'});
ipcMain.handle('companion:overlay-enabled',(_event,enabled)=>applyOverlayEnabled(enabled));
ipcMain.handle('companion:overlay-edit',()=>toggleOverlayEditor());
ipcMain.handle('companion:overlay-move-here',()=>placeOverlayOnCursorScreen());
ipcMain.handle('companion:overlay-center',()=>centerOverlayLayout());
ipcMain.handle('companion:overlay-cycle',()=>cycleOverlayLayout());
ipcMain.handle('companion:set-tft-focus',(_event,focus)=>selectTftFocus(focus));
ipcMain.handle('companion:get-tft-builds',()=>state.tftBuilds||null);
ipcMain.handle('companion:set-tft-build',(_event,id)=>selectTftBuild(id));
ipcMain.handle('companion:get-state',()=>publicState());
ipcMain.handle('companion:set-dna-role',(_event,role)=>selectDnaRole(role));
ipcMain.handle('companion:unpair',()=>{stopTracker();stopTftRecorder();const cfg=readConfig();cfg.tokenCipher='';writeConfig(cfg);pairingAuthInvalid=false;recentLogs=[];matchupSignature='';setState({phase:'SETUP',detail:'This PC is unpaired. Pair it again from OP CLIMB.',trackerRunning:false,matchup:null,teamPlan:null,postGameReview:null,tftMission:null,tftMissionError:null});return{ok:true}});
ipcMain.handle('companion:restart',()=>{stopTracker();stopTftRecorder();startTracker();startTftRecorder();return{ok:true}});
ipcMain.handle('companion:auto-start',(_event,enabled)=>{applyAutoStart(enabled);return{ok:true}});
ipcMain.handle('companion:open-climb',()=>{shell.openExternal(`${currentConfig().webUrl}/live`);return{ok:true}});
ipcMain.handle('companion:open-climb-path',(_event,path)=>{
  const safePaths=new Set(['/live','/progress','/ilp','/champions/main','/analyse','/tft/timeline','/tft/coach','/pricing','/coach','/missions']);
  let target='/live';
  try{
    const parsed=new URL(String(path||'/live'),'https://opclimb.local');
    if(safePaths.has(parsed.pathname)){
      const query=new URLSearchParams();
      if(parsed.pathname==='/ilp'){
        const game=String(parsed.searchParams.get('game')||'').trim();
        if(game)query.set('game',game.slice(0,160));
      }
      target=parsed.pathname+(query.size?'?'+query.toString():'');
    }
  }catch{}
  shell.openExternal(`${currentConfig().webUrl}${target}`);
  return{ok:true,path:target};
});
ipcMain.handle('companion:champion-roster',()=>championRoster(currentConfig().webUrl));
ipcMain.handle('companion:champion-guide',(_event,{champion,role,refresh}={})=>championGuide(currentConfig().webUrl,champion,role,globalThis.fetch,Boolean(refresh)));
ipcMain.handle('companion:draft-coach',(_event,context)=>requestDraftCoach(context));
ipcMain.handle('companion:intent-probe',(_event,context)=>answerIntentProbe(context));
ipcMain.handle('companion:read-checkpoint',(_event,context)=>recordReadCheckpoint(context));
ipcMain.handle('companion:mark-moment',()=>markMoment());

app.on('second-instance',(_event,argv)=>{createWindow(true);const link=deepLinkFromArgs(argv);if(link)void handlePairUrl(link)});
app.on('open-url',(event,url)=>{event.preventDefault();void handlePairUrl(url)});
app.on('before-quit',()=>{quitting=true;cancelRecordingExit();if(overlayWatchdog){clearInterval(overlayWatchdog);overlayWatchdog=null}try{globalShortcut.unregisterAll()}catch{}if(overlayWindow&&!overlayWindow.isDestroyed())overlayWindow.destroy();stopTftRecorder();stopTracker()});app.on('window-all-closed',()=>{});
app.whenReady().then(()=>{
  const cfg=readConfig();state={...state,paired:Boolean(decryptToken(cfg)),autoStart:Boolean(cfg.autoStart)};createTray();
  const initialLink=deepLinkFromArgs(process.argv),hidden=process.argv.includes('--hidden')&&!initialLink;createWindow(!hidden);
  try{globalShortcut.register('CommandOrControl+Shift+M',()=>markMoment())}catch{}
  try{globalShortcut.register('CommandOrControl+Shift+O',()=>applyOverlayEnabled(!currentConfig().overlayEnabled))}catch{}
  try{globalShortcut.register('Alt+B',()=>toggleOverlayEditor())}catch{}
  try{globalShortcut.register('CommandOrControl+Shift+H',()=>placeOverlayOnCursorScreen())}catch{}
  try{globalShortcut.register('CommandOrControl+Shift+L',()=>cycleOverlayLayout())}catch{}
  try{globalShortcut.register('CommandOrControl+Shift+K',()=>toggleOverlayAssistant())}catch{}
  try{globalShortcut.register('CommandOrControl+Shift+B',()=>toggleOverlayBuilds())}catch{}
  startOverlayWatchdog();
  screen.on('display-metrics-changed',()=>{if(overlayWindow&&!overlayWindow.isDestroyed()){setOverlayScreen(chosenOverlayDisplay());syncOverlay()}});
  screen.on('display-removed',()=>{if(overlayWindow&&!overlayWindow.isDestroyed()){const b=screen.getPrimaryDisplay().bounds;overlayWindow.setBounds(b);syncOverlay()}});
  if(initialLink)void handlePairUrl(initialLink);else if(state.paired){startTracker();startTftRecorder()}else setState({phase:'SETUP',detail:'Open OP CLIMB and pair this PC to start live tracking.'});
  syncOverlay();
});
