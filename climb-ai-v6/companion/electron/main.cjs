const {app,BrowserWindow,Menu,Tray,ipcMain,shell,nativeImage,safeStorage,globalShortcut}=require('electron');
const {spawn}=require('node:child_process');
const {existsSync,readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const path=require('node:path');
const {championRoster,championGuide}=require('./champion-hub-data.cjs');
const {draftFromLocalContext,freshestDraft}=require('./live-draft.cjs');

const DEFAULT_WEB='https://opclimb.com';
const APP_NAME='OP CLIMB Companion';
const PAIR_PROTOCOL='opclimb';
const MATCHUP_PREFIX='OP_MATCHUP_CONTEXT ';
const TRACKER_STATE_PREFIX='OP_TRACKER_STATE ';
const DRAFT_CONTEXT_PREFIX='OP_DRAFT_CONTEXT ';
let mainWindow=null,tray=null,tracker=null,trackerRestartTimer=null,championPlanTimer=null,reviewPollTimer=null,trackerStatusTimer=null,missedReviewTimer=null,playerHomeTimer=null;
let championPlanInFlight=false,reviewPollInFlight=false,trackerStatusInFlight=false,playerHomeInFlight=false,reviewPollAttempts=0,quitting=false,matchupSignature='',dnaViewRole='';
let lastLocalChampSelectAt=0;
let recentLogs=[];
let state={phase:'STARTING',detail:'Starting OP CLIMB Companion…',paired:false,trackerRunning:false,lastLog:'',autoStart:false,matchup:null,teamPlan:null,draft:null,postGameReview:null,playerHome:null};

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
function currentConfig(){const raw=readConfig();return{webUrl:(raw.webUrl||DEFAULT_WEB).replace(/\/$/,''),token:decryptToken(raw),tokenCipher:raw.tokenCipher||'',autoStart:Boolean(raw.autoStart),lastReviewSessionId:String(raw.lastReviewSessionId||''),lastReviewRenderedSessionId:String(raw.lastReviewRenderedSessionId||'')}}
function paired(){return Boolean(currentConfig().token)}
function publicState(){return{...state,logs:recentLogs.slice(-80),webUrl:currentConfig().webUrl}}
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
  const enteringChampSelect=patch?.phase==='CHAMP_SELECT'&&previousPhase!=='CHAMP_SELECT';
  const enteringRecording=patch?.phase==='RECORDING'&&previousPhase!=='RECORDING';
  if(enteringChampSelect||enteringRecording){stopPostGameReviewPoll();reviewPollAttempts=0;patch={...patch,postGameReview:null}}
  state={...state,...patch,paired:paired(),autoStart:currentConfig().autoStart};
  if(state.phase==='WAITING'&&previousPhase!=='WAITING'){
    const detectedRole=normalizedRole(state.postGameReview?.match?.role||state.matchup?.role||state.matchup?.plan?.role);
    if(['TOP','JUNGLE','MID','ADC','SUPPORT'].includes(detectedRole))dnaViewRole=detectedRole;
    scheduleMissedReviewRecovery(4500);
    stopPlayerHomePoll();
    void pollPlayerHome();
  }else if(previousPhase==='WAITING'&&state.phase!=='WAITING'){
    stopMissedReviewRecovery();
    stopPlayerHomePoll();
  }
  if(enteringChampSelect){
    matchupSignature='';state={...state,matchup:null,teamPlan:null,draft:null};startChampionPlanPoll();
  }else if(enteringRecording){
    if(needsRecordingPlanRecovery())startChampionPlanPoll();else stopChampionPlanPoll();
  }else{
    if(previousPhase==='CHAMP_SELECT'&&state.phase!=='CHAMP_SELECT'&&!needsRecordingPlanRecovery())stopChampionPlanPoll();
  }
  updateTray();
  if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('companion:state',publicState());
}
function addLog(line,kind='info'){
  const clean=String(line||'').trim();if(!clean)return;
  if(clean.startsWith(MATCHUP_PREFIX)||clean.startsWith(TRACKER_STATE_PREFIX)||clean.startsWith(DRAFT_CONTEXT_PREFIX)){parseTrackerLine(clean,kind);return}
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
        `(()=>{const section=document.getElementById('simplePostgameReview');return Boolean(section&&!section.classList.contains('hidden')&&String(window.__opRenderedReviewSessionId||'')===${JSON.stringify(id)});})()`,
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