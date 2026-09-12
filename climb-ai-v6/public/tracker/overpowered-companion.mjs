import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {get as httpsGet} from 'node:https';
import {mkdirSync,readFileSync,unlinkSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const LIVE_CLIENT='https://127.0.0.1:2999/liveclientdata/allgamedata';
const WEB=(process.env.OP_WEB_URL||process.env.CLIMB_WEB_URL||'http://localhost:3000').replace(/\/$/,'');
const TOKEN=process.env.OP_TRACKER_TOKEN||process.env.CLIMB_TRACKER_TOKEN||'';
const POLL_MS=Math.max(3000,Number(process.env.OP_POLL_MS||5000));
const END_AFTER_MISSES=3;
const PREGAME_END_AFTER_MISSES=2;
const UPLOAD_TIMEOUT_MS=Math.max(3000,Number(process.env.OP_UPLOAD_TIMEOUT_MS||8000));
const UPLOAD_RETRY_MS=Math.max(1000,Number(process.env.OP_UPLOAD_RETRY_MS||5000));
const MAX_UPLOAD_QUEUE=Math.max(30,Number(process.env.OP_MAX_UPLOAD_QUEUE||180));
const TRACKER_HOME=process.env.LOCALAPPDATA?join(process.env.LOCALAPPDATA,'OVERPOWERED','Tracker'):null;
const SESSION_FILE=TRACKER_HOME?join(TRACKER_HOME,'active-session.json'):null;

if(!TOKEN){console.error('OVERPOWERED Companion: OP_TRACKER_TOKEN is missing. Pair this PC from the Live Companion page first.');process.exit(1)}
if(TRACKER_HOME){try{mkdirSync(TRACKER_HOME,{recursive:true})}catch{}}

let session=null;
let pregame=null;
let pregameMisses=0;
let lastPregameSignature='';
let lastPregameUploadAt=0;
let running=true;
let state='STARTING';
let uploadQueue=[];
let uploadFlushing=false;
let uploadRetryTimer=null;
let droppedSnapshots=0;
let lcuCredentials=null;
let lcuCheckedAt=0;
const championNames=new Map();

function logState(next,message){if(state===next)return;state=next;console.log(message)}

function localGameData(){
  return new Promise((resolve,reject)=>{
    const req=httpsGet(LIVE_CLIENT,{rejectUnauthorized:false,timeout:2500},res=>{
      if((res.statusCode??500)<200||(res.statusCode??500)>=300){res.resume();reject(new Error(`Live Client returned ${res.statusCode}`));return}
      let body='';res.setEncoding('utf8');
      res.on('data',chunk=>{body+=chunk;if(body.length>5_000_000)req.destroy(new Error('Live Client payload too large.'))});
      res.on('end',()=>{try{resolve(JSON.parse(body))}catch(err){reject(err)}});
    });
    req.on('timeout',()=>req.destroy(new Error('Live Client timeout')));req.on('error',reject);
  });
}

function findLcuCredentials(force=false){
  if(!force&&lcuCredentials&&Date.now()-lcuCheckedAt<60_000)return Promise.resolve(lcuCredentials);
  if(!force&&!lcuCredentials&&Date.now()-lcuCheckedAt<10_000)return Promise.reject(new Error('League Client not detected'));
  lcuCheckedAt=Date.now();
  const script=`$p=Get-CimInstance Win32_Process -Filter "Name='LeagueClientUx.exe'" | Select-Object -First 1 -ExpandProperty CommandLine; if($p){[Console]::Out.Write($p)}`;
  return new Promise((resolve,reject)=>{
    execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:3500,maxBuffer:512_000},(error,stdout)=>{
      if(error||!stdout){lcuCredentials=null;reject(new Error('League Client not detected'));return}
      const port=/--app-port=(?:"?)(\d+)/i.exec(stdout)?.[1];
      const tokenMatch=/--remoting-auth-token=(?:"([^"]+)"|([^\s"]+))/i.exec(stdout);
      const password=tokenMatch?.[1]||tokenMatch?.[2];
      if(!port||!password){lcuCredentials=null;reject(new Error('League Client credentials unavailable'));return}
      lcuCredentials={port:Number(port),password};resolve(lcuCredentials);
    });
  });
}

async function lcuJson(path,retry=true){
  const creds=await findLcuCredentials(!retry);
  return new Promise((resolve,reject)=>{
    const auth=Buffer.from(`riot:${creds.password}`).toString('base64');
    const req=httpsGet({hostname:'127.0.0.1',port:creds.port,path,rejectUnauthorized:false,timeout:2500,headers:{authorization:`Basic ${auth}`}},res=>{
      if((res.statusCode??500)<200||(res.statusCode??500)>=300){res.resume();const err=new Error(`LCU returned ${res.statusCode}`);err.status=res.statusCode;reject(err);return}
      let body='';res.setEncoding('utf8');
      res.on('data',chunk=>{body+=chunk;if(body.length>2_000_000)req.destroy(new Error('LCU payload too large.'))});
      res.on('end',()=>{try{resolve(JSON.parse(body))}catch(err){reject(err)}});
    });
    req.on('timeout',()=>req.destroy(new Error('LCU timeout')));
    req.on('error',err=>{lcuCredentials=null;reject(err)});
  }).catch(async err=>{
    if(retry&&(err?.status===401||err?.code==='ECONNREFUSED')){lcuCredentials=null;return lcuJson(path,false)}
    throw err;
  });
}

async function championName(id){
  const championId=int(id,0);if(championId<=0)return null;
  if(championNames.has(championId))return championNames.get(championId);
  try{
    const data=await lcuJson(`/lol-game-data/assets/v1/champions/${championId}.json`);
    const name=text(data?.name)||text(data?.alias)||`Champion ${championId}`;
    championNames.set(championId,name);return name;
  }catch{const fallback=`Champion ${championId}`;championNames.set(championId,fallback);return fallback}
}

async function normalizePregame(data){
  const myTeam=Array.isArray(data?.myTeam)?data.myTeam:[];
  const theirTeam=Array.isArray(data?.theirTeam)?data.theirTeam:[];
  const actionRows=Array.isArray(data?.actions)?data.actions:[];
  const actions=actionRows.flatMap(row=>Array.isArray(row)?row:[]);
  const allyBans=Array.isArray(data?.bans?.myTeamBans)?data.bans.myTeamBans:[];
  const enemyBans=Array.isArray(data?.bans?.theirTeamBans)?data.bans.theirTeamBans:[];
  const ids=[...myTeam,...theirTeam].map(p=>int(p?.championId,0)).concat(allyBans.map(v=>int(v,0)),enemyBans.map(v=>int(v,0))).filter(v=>v>0);
  await Promise.all([...new Set(ids)].map(id=>championName(id)));
  const locked=cellId=>actions.some(action=>text(action?.type).toLowerCase()==='pick'&&int(action?.actorCellId,-1)===cellId&&Boolean(action?.completed));
  const mapPick=raw=>{
    const cellId=int(raw?.cellId,-1),championId=int(raw?.championId,0);
    return{cellId,championId,championName:championNames.get(championId)||null,role:text(raw?.assignedPosition)||text(raw?.position)||null,lockedIn:locked(cellId)};
  };
  const localCell=int(data?.localPlayerCellId,-1);
  const localRaw=myTeam.find(p=>int(p?.cellId,-1)===localCell)||null;
  const localChampionId=int(localRaw?.championId,0);
  return{
    version:1,
    capturedAt:new Date().toISOString(),
    phase:text(data?.timer?.phase)||text(data?.timer?.phaseType)||'CHAMP_SELECT',
    localPlayerCellId:localCell,
    localChampionId,
    localChampionName:championNames.get(localChampionId)||null,
    localRole:text(localRaw?.assignedPosition)||text(localRaw?.position)||null,
    localLockedIn:localCell>=0?locked(localCell):false,
    allies:myTeam.map(mapPick).slice(0,5),
    enemies:theirTeam.map(mapPick).slice(0,5),
    bans:{
      allies:allyBans.map(id=>({championId:int(id,0),championName:championNames.get(int(id,0))||null})).filter(b=>b.championId>0).slice(0,10),
      enemies:enemyBans.map(id=>({championId:int(id,0),championName:championNames.get(int(id,0))||null})).filter(b=>b.championId>0).slice(0,10),
    },
  };
}

async function postJson(path,payload){
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),UPLOAD_TIMEOUT_MS);
  try{
    const response=await fetch(`${WEB}${path}`,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${TOKEN}`},body:JSON.stringify(payload),signal:controller.signal});
    if(response.ok)return{ok:true,retryable:false};
    const body=await response.json().catch(()=>({}));const detail=body?.error||`HTTP ${response.status}`;
    if(response.status===401||response.status===403){logState('AUTH_ERROR',`OVERPOWERED Companion: pairing token rejected — ${detail}`);return{ok:false,retryable:false,detail}}
    return{ok:false,retryable:true,detail};
  }catch(err){return{ok:false,retryable:true,detail:err?.name==='AbortError'?'upload timed out':(err?.message||'network error')}}
  finally{clearTimeout(timeout)}
}

async function postEnvelope(envelope){
  const result=await postJson('/api/live/telemetry',envelope);
  if(!result.ok&&result.retryable)console.warn(`OVERPOWERED Companion: upload deferred — ${result.detail}. Recording continues locally and will retry.`);
  return result;
}

function queueEnvelope(envelope){
  if(uploadQueue.length>=MAX_UPLOAD_QUEUE){
    const oldestSnapshot=uploadQueue.findIndex(item=>item.type==='SNAPSHOT');
    if(oldestSnapshot>=0){uploadQueue.splice(oldestSnapshot,1);droppedSnapshots+=1}else uploadQueue.shift();
    if(droppedSnapshots===1||droppedSnapshots%20===0)console.warn(`OVERPOWERED Companion: upload queue is full; ${droppedSnapshots} old snapshot(s) dropped while preserving live recording.`);
  }
  uploadQueue.push(envelope);void flushUploadQueue();
}
async function flushUploadQueue(){
  if(uploadFlushing||uploadQueue.length===0)return;uploadFlushing=true;
  try{while(uploadQueue.length){const result=await postEnvelope(uploadQueue[0]);if(result.ok){uploadQueue.shift();continue}if(!result.retryable){uploadQueue.shift();continue}scheduleUploadRetry();return}}
  finally{uploadFlushing=false}
}
function scheduleUploadRetry(){if(uploadRetryTimer)return;uploadRetryTimer=setTimeout(()=>{uploadRetryTimer=null;void flushUploadQueue()},UPLOAD_RETRY_MS)}

async function pollPregame(){
  if(session)return;
  try{
    const data=await lcuJson('/lol-champ-select/v1/session');
    pregameMisses=0;
    if(!pregame)pregame={id:randomUUID(),startedAt:new Date().toISOString()};
    const context=await normalizePregame(data);
    const signature=JSON.stringify({...context,capturedAt:null});
    const heartbeat=Date.now()-lastPregameUploadAt>=15_000;
    if(signature!==lastPregameSignature||heartbeat){
      const result=await postJson('/api/live/pregame',{type:'PREGAME',clientPregameId:pregame.id,startedAt:pregame.startedAt,context});
      if(result.ok){lastPregameSignature=signature;lastPregameUploadAt=Date.now()}
      else if(result.retryable)console.warn(`OVERPOWERED Companion: champ-select upload deferred — ${result.detail}. Detection continues locally.`);
    }
    const pick=context.localChampionName||'your champion';
    logState('CHAMP_SELECT',`OVERPOWERED Companion: champ select detected — ${pick}${context.localLockedIn?' locked in':''}. Draft context will be saved for post-game learning.`);
  }catch{
    if(pregame){pregameMisses+=1;if(pregameMisses>=PREGAME_END_AFTER_MISSES)await finishPregame('champ select ended')}
  }
}

async function finishPregame(reason,quiet=false){
  if(!pregame)return;
  const finished=pregame;pregame=null;pregameMisses=0;lastPregameSignature='';lastPregameUploadAt=0;
  const result=await postJson('/api/live/pregame',{type:'PREGAME_END',clientPregameId:finished.id,startedAt:finished.startedAt,endedAt:new Date().toISOString()});
  if(!result.ok&&result.retryable)console.warn(`OVERPOWERED Companion: champ-select close upload missed — ${result.detail}. The server will expire the live draft state automatically.`);
  if(!quiet)logState('WAITING',`OVERPOWERED Companion: ${reason}. Waiting for the match to load.`);
}

function normalize(data){
  const allPlayers=Array.isArray(data?.allPlayers)?data.allPlayers:[];
  const activeRaw=data?.activePlayer&&typeof data.activePlayer==='object'?data.activePlayer:{};
  const activeSummoner=text(activeRaw.summonerName),activeRiotId=riotIdOf(activeRaw);
  const matched=allPlayers.find(player=>samePlayer(player,activeSummoner,activeRiotId))||allPlayers.find(player=>text(player?.championName)===text(activeRaw.championName));
  const players=allPlayers.map(normalizePlayer).filter(Boolean),me=matched?normalizePlayer(matched):null;
  const stats=activeRaw.championStats&&typeof activeRaw.championStats==='object'?activeRaw.championStats:{};
  const events=Array.isArray(data?.events?.Events)?data.events.Events:[];
  return{version:1,gameTime:num(data?.gameData?.gameTime,0),gameMode:text(data?.gameData?.gameMode)||null,mapName:text(data?.gameData?.mapName)||null,receivedAt:new Date().toISOString(),active:{summonerName:activeSummoner||me?.summonerName||'',riotId:activeRiotId||me?.riotId||null,championName:me?.championName||text(activeRaw.championName)||'',team:me?.team||'UNKNOWN',level:int(activeRaw.level,me?.level??0),position:me?.position??null,currentGold:Math.max(0,num(activeRaw.currentGold,0)),stats:{currentHealth:nullable(stats.currentHealth),maxHealth:nullable(stats.maxHealth),currentMana:nullable(stats.resourceValue),maxMana:nullable(stats.resourceMax),attackDamage:nullable(stats.attackDamage),attackSpeed:nullable(stats.attackSpeed),abilityPower:nullable(stats.abilityPower),armor:nullable(stats.armor),magicResist:nullable(stats.magicResist),moveSpeed:nullable(stats.moveSpeed)}},players,events:events.slice(-40).map(event=>({id:Number.isFinite(Number(event?.EventID))?Number(event.EventID):null,name:text(event?.EventName)||'Event',time:Math.max(0,num(event?.EventTime,0)),actor:text(event?.KillerName)||text(event?.Killer)||text(event?.Assister)||null,target:text(event?.VictimName)||text(event?.Victim)||text(event?.Stolen)||null,raw:Object.fromEntries(Object.entries(event||{}).filter(([key])=>!['EventID','EventName','EventTime'].includes(key)))}))};
}
function normalizePlayer(raw){
  if(!raw||typeof raw!=='object')return null;
  const items=Array.isArray(raw.items)?raw.items.map(item=>({itemId:int(item?.itemID??item?.itemId,0),displayName:text(item?.displayName)||`Item ${int(item?.itemID??item?.itemId,0)}`,count:Math.max(1,int(item?.count,1)),price:Math.max(0,num(item?.price,0))})):[];
  const scores=raw.scores&&typeof raw.scores==='object'?raw.scores:{};
  return{summonerName:text(raw.summonerName),riotId:riotIdOf(raw),championName:text(raw.championName)||text(raw.rawChampionName).replace(/^game_character_displayname_/i,''),team:teamOf(raw.team),level:int(raw.level,0),position:text(raw.position)||null,isDead:Boolean(raw.isDead),respawnTimer:Math.max(0,num(raw.respawnTimer,0)),itemGold:items.reduce((sum,item)=>sum+item.price*item.count,0),items,scores:{kills:int(scores.kills,0),deaths:int(scores.deaths,0),assists:int(scores.assists,0),creepScore:int(scores.creepScore,0),wardScore:Math.max(0,num(scores.wardScore,0))}};
}

function loadPersistedSession(snapshot){
  if(!SESSION_FILE)return null;
  try{const saved=JSON.parse(readFileSync(SESSION_FILE,'utf8'));if(!saved||typeof saved.id!=='string'||typeof saved.startedAt!=='string')return null;const lastGameTime=num(saved.lastGameTime,-1),sameTimeline=lastGameTime>=0&&snapshot.gameTime+30>=lastGameTime,sameIdentity=!saved.riotId||!snapshot.active.riotId||saved.riotId===snapshot.active.riotId;if(!sameTimeline||!sameIdentity){clearPersistedSession();return null}return{id:saved.id,startedAt:saved.startedAt,lastGameTime:Math.max(lastGameTime,snapshot.gameTime),misses:0}}catch{return null}
}
function persistSession(snapshot){if(!SESSION_FILE||!session)return;try{writeFileSync(SESSION_FILE,JSON.stringify({id:session.id,startedAt:session.startedAt,lastGameTime:session.lastGameTime,riotId:snapshot?.active?.riotId||null,championName:snapshot?.active?.championName||null,savedAt:new Date().toISOString()}),'utf8')}catch{}}
function clearPersistedSession(){if(!SESSION_FILE)return;try{unlinkSync(SESSION_FILE)}catch{}}

async function startSession(snapshot){
  if(pregame)await finishPregame('game started',true);
  const restored=loadPersistedSession(snapshot);
  if(restored){session=restored;logState('RECORDING',`OVERPOWERED Companion: resumed ${snapshot.active.championName||'League match'} after tracker restart.`);return}
  session={id:randomUUID(),startedAt:new Date().toISOString(),lastGameTime:snapshot.gameTime,misses:0};persistSession(snapshot);
  logState('RECORDING',`OVERPOWERED Companion: recording ${snapshot.active.championName||'League match'} silently for post-game review.`);
}
async function finishSession(reason){if(!session)return;const finished=session;session=null;clearPersistedSession();queueEnvelope({type:'END',clientSessionId:finished.id,startedAt:finished.startedAt,endedAt:new Date().toISOString()});logState('WAITING',`OVERPOWERED Companion: match recording closed (${reason}). Waiting for League.`)}

async function tick(){
  let data;
  try{data=await localGameData()}
  catch{if(session){session.misses+=1;if(session.misses>=END_AFTER_MISSES)await finishSession('League game ended')}else if(!pregame)logState('WAITING','OVERPOWERED Companion: connected. Waiting for League or champ select.');return}
  const snapshot=normalize(data);
  if(session&&snapshot.gameTime+30<session.lastGameTime)await finishSession('new game detected');
  if(!session)await startSession(snapshot);
  session.misses=0;session.lastGameTime=snapshot.gameTime;persistSession(snapshot);
  queueEnvelope({type:'SNAPSHOT',clientSessionId:session.id,startedAt:session.startedAt,snapshot});
  logState('RECORDING',`OVERPOWERED Companion: recording ${snapshot.active.championName||'League match'} silently for post-game review.`);
}

async function loop(){while(running){try{await pollPregame()}catch(err){console.warn(`OVERPOWERED Companion: champ-select detector recovered — ${err?.message||err}`)}try{await tick()}catch(err){console.warn(`OVERPOWERED Companion: recorder loop recovered from an error — ${err?.message||err}`)}await new Promise(resolve=>setTimeout(resolve,POLL_MS))}}
async function shutdown(){if(!running)return;running=false;if(uploadRetryTimer){clearTimeout(uploadRetryTimer);uploadRetryTimer=null}await finishPregame('companion stopped',true);await finishSession('companion stopped');const deadline=Date.now()+5000;while(uploadQueue.length&&Date.now()<deadline){await flushUploadQueue();if(uploadQueue.length)await new Promise(resolve=>setTimeout(resolve,250))}process.exit(0)}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);process.on('uncaughtException',err=>console.error('OVERPOWERED Companion: recovered from unexpected error:',err));process.on('unhandledRejection',err=>console.error('OVERPOWERED Companion: recovered from rejected task:',err));
console.log('OVERPOWERED Companion: champ-select context + silent match recorder. No live tactical instructions or hidden cooldown tracking.');
loop().catch(err=>{console.error('OVERPOWERED Companion loop error:',err);setTimeout(()=>void loop(),1000)});

function samePlayer(raw,summonerName,riotId){if(summonerName&&text(raw?.summonerName)===summonerName)return true;const candidate=riotIdOf(raw);return Boolean(riotId&&candidate&&candidate===riotId)}
function riotIdOf(raw){const direct=text(raw?.riotId);if(direct)return direct;const gameName=text(raw?.riotIdGameName),tag=text(raw?.riotIdTagLine);return gameName?(tag?`${gameName}#${tag}`:gameName):null}
function teamOf(value){const v=text(value).toUpperCase();if(v==='ORDER'||v==='BLUE'||v==='100')return'ORDER';if(v==='CHAOS'||v==='RED'||v==='200')return'CHAOS';return'UNKNOWN'}
const text=value=>typeof value==='string'?value.trim():'';
const num=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const int=(value,fallback)=>Math.max(fallback<0?-1:0,Math.round(num(value,fallback)));
const nullable=value=>Number.isFinite(Number(value))?Number(value):null;
