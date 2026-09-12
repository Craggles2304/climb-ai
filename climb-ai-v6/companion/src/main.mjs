import {randomUUID} from 'node:crypto';
import {get as httpsGet} from 'node:https';
import {mkdirSync,readFileSync,unlinkSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const LOCAL='https://127.0.0.1:2999/liveclientdata/allgamedata';
const WEB=(process.env.OP_WEB_URL||process.env.CLIMB_WEB_URL||'http://localhost:3000').replace(/\/$/,'');
const TOKEN=process.env.OP_TRACKER_TOKEN||process.env.CLIMB_TRACKER_TOKEN||'';
const POLL_MS=Math.max(3000,Number(process.env.OP_POLL_MS||5000));
const END_AFTER_MISSES=3;
const UPLOAD_TIMEOUT_MS=Math.max(3000,Number(process.env.OP_UPLOAD_TIMEOUT_MS||8000));
const UPLOAD_RETRY_MS=Math.max(1000,Number(process.env.OP_UPLOAD_RETRY_MS||5000));
const MAX_UPLOAD_QUEUE=Math.max(30,Number(process.env.OP_MAX_UPLOAD_QUEUE||180));
const TRACKER_HOME=process.env.LOCALAPPDATA?join(process.env.LOCALAPPDATA,'OVERPOWERED','Tracker'):null;
const SESSION_FILE=TRACKER_HOME?join(TRACKER_HOME,'active-session.json'):null;

if(!TOKEN){
  console.error('OVERPOWERED Companion: OP_TRACKER_TOKEN is missing. Pair this PC from the Live Companion page first.');
  process.exit(1);
}

if(TRACKER_HOME){
  try{mkdirSync(TRACKER_HOME,{recursive:true})}catch{}
}

let session=null;
let running=true;
let state='STARTING';
let uploadQueue=[];
let uploadFlushing=false;
let uploadRetryTimer=null;
let droppedSnapshots=0;

function logState(next,message){
  if(state===next)return;
  state=next;
  console.log(message);
}

function localGameData(){
  return new Promise((resolve,reject)=>{
    const req=httpsGet(LOCAL,{rejectUnauthorized:false,timeout:2500},res=>{
      if((res.statusCode??500)<200||(res.statusCode??500)>=300){
        res.resume();reject(new Error(`Live Client returned ${res.statusCode}`));return;
      }
      let body='';
      res.setEncoding('utf8');
      res.on('data',chunk=>{body+=chunk;if(body.length>5_000_000)req.destroy(new Error('Live Client payload too large.'))});
      res.on('end',()=>{
        try{resolve(JSON.parse(body))}catch(err){reject(err)}
      });
    });
    req.on('timeout',()=>req.destroy(new Error('Live Client timeout')));
    req.on('error',reject);
  });
}

async function postEnvelope(envelope){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),UPLOAD_TIMEOUT_MS);
  try{
    const response=await fetch(`${WEB}/api/live/telemetry`,{
      method:'POST',
      headers:{'content-type':'application/json','authorization':`Bearer ${TOKEN}`},
      body:JSON.stringify(envelope),
      signal:controller.signal,
    });
    if(response.ok)return {ok:true,retryable:false};
    const body=await response.json().catch(()=>({}));
    const detail=body?.error||`HTTP ${response.status}`;
    if(response.status===401||response.status===403){
      logState('AUTH_ERROR',`OVERPOWERED Companion: pairing token rejected — ${detail}`);
      return {ok:false,retryable:false};
    }
    console.warn(`OVERPOWERED Companion: upload deferred — ${detail}. Recording continues locally and will retry.`);
    return {ok:false,retryable:true};
  }catch(err){
    const detail=err?.name==='AbortError'?'upload timed out':(err?.message||'network error');
    console.warn(`OVERPOWERED Companion: upload deferred — ${detail}. Recording continues locally and will retry.`);
    return {ok:false,retryable:true};
  }finally{
    clearTimeout(timeout);
  }
}

function queueEnvelope(envelope){
  if(uploadQueue.length>=MAX_UPLOAD_QUEUE){
    const oldestSnapshot=uploadQueue.findIndex(item=>item.type==='SNAPSHOT');
    if(oldestSnapshot>=0){uploadQueue.splice(oldestSnapshot,1);droppedSnapshots+=1}
    else uploadQueue.shift();
    if(droppedSnapshots===1||droppedSnapshots%20===0)
      console.warn(`OVERPOWERED Companion: upload queue is full; ${droppedSnapshots} old snapshot(s) dropped while preserving live recording.`);
  }
  uploadQueue.push(envelope);
  void flushUploadQueue();
}

async function flushUploadQueue(){
  if(uploadFlushing||uploadQueue.length===0)return;
  uploadFlushing=true;
  try{
    while(uploadQueue.length){
      const result=await postEnvelope(uploadQueue[0]);
      if(result.ok){uploadQueue.shift();continue}
      if(!result.retryable){uploadQueue.shift();continue}
      scheduleUploadRetry();
      return;
    }
  }finally{
    uploadFlushing=false;
  }
}

function scheduleUploadRetry(){
  if(uploadRetryTimer)return;
  uploadRetryTimer=setTimeout(()=>{
    uploadRetryTimer=null;
    void flushUploadQueue();
  },UPLOAD_RETRY_MS);
}

function normalize(data){
  const allPlayers=Array.isArray(data?.allPlayers)?data.allPlayers:[];
  const activeRaw=data?.activePlayer&&typeof data.activePlayer==='object'?data.activePlayer:{};
  const activeSummoner=text(activeRaw.summonerName);
  const activeRiotId=riotIdOf(activeRaw);
  const matched=allPlayers.find(player=>samePlayer(player,activeSummoner,activeRiotId))
    ||allPlayers.find(player=>text(player?.championName)===text(activeRaw.championName));
  const players=allPlayers.map(normalizePlayer).filter(Boolean);
  const me=matched?normalizePlayer(matched):null;
  const stats=activeRaw.championStats&&typeof activeRaw.championStats==='object'?activeRaw.championStats:{};
  const events=Array.isArray(data?.events?.Events)?data.events.Events:[];
  return {
    version:1,
    gameTime:num(data?.gameData?.gameTime,0),
    gameMode:text(data?.gameData?.gameMode)||null,
    mapName:text(data?.gameData?.mapName)||null,
    receivedAt:new Date().toISOString(),
    active:{
      summonerName:activeSummoner||me?.summonerName||'',
      riotId:activeRiotId||me?.riotId||null,
      championName:me?.championName||text(activeRaw.championName)||'',
      team:me?.team||'UNKNOWN',
      level:int(activeRaw.level,me?.level??0),
      position:me?.position??null,
      currentGold:Math.max(0,num(activeRaw.currentGold,0)),
      stats:{
        currentHealth:nullable(stats.currentHealth),maxHealth:nullable(stats.maxHealth),
        currentMana:nullable(stats.resourceValue),maxMana:nullable(stats.resourceMax),
        attackDamage:nullable(stats.attackDamage),attackSpeed:nullable(stats.attackSpeed),
        abilityPower:nullable(stats.abilityPower),armor:nullable(stats.armor),
        magicResist:nullable(stats.magicResist),moveSpeed:nullable(stats.moveSpeed),
      },
    },
    players,
    events:events.slice(-40).map(event=>({
      id:Number.isFinite(Number(event?.EventID))?Number(event.EventID):null,
      name:text(event?.EventName)||'Event',time:Math.max(0,num(event?.EventTime,0)),
      actor:text(event?.KillerName)||text(event?.Killer)||text(event?.Assister)||null,
      target:text(event?.VictimName)||text(event?.Victim)||text(event?.Stolen)||null,
      raw:Object.fromEntries(Object.entries(event||{}).filter(([key])=>!['EventID','EventName','EventTime'].includes(key))),
    })),
  };
}

function normalizePlayer(raw){
  if(!raw||typeof raw!=='object')return null;
  const items=Array.isArray(raw.items)?raw.items.map(item=>({
    itemId:int(item?.itemID??item?.itemId,0),displayName:text(item?.displayName)||`Item ${int(item?.itemID??item?.itemId,0)}`,
    count:Math.max(1,int(item?.count,1)),price:Math.max(0,num(item?.price,0)),
  })):[];
  const scores=raw.scores&&typeof raw.scores==='object'?raw.scores:{};
  return {
    summonerName:text(raw.summonerName),riotId:riotIdOf(raw),championName:text(raw.championName)||text(raw.rawChampionName).replace(/^game_character_displayname_/i,''),
    team:teamOf(raw.team),level:int(raw.level,0),position:text(raw.position)||null,
    isDead:Boolean(raw.isDead),respawnTimer:Math.max(0,num(raw.respawnTimer,0)),
    itemGold:items.reduce((sum,item)=>sum+item.price*item.count,0),items,
    scores:{kills:int(scores.kills,0),deaths:int(scores.deaths,0),assists:int(scores.assists,0),creepScore:int(scores.creepScore,0),wardScore:Math.max(0,num(scores.wardScore,0))},
  };
}

function loadPersistedSession(snapshot){
  if(!SESSION_FILE)return null;
  try{
    const saved=JSON.parse(readFileSync(SESSION_FILE,'utf8'));
    if(!saved||typeof saved.id!=='string'||typeof saved.startedAt!=='string')return null;
    const lastGameTime=num(saved.lastGameTime,-1);
    const sameTimeline=lastGameTime>=0&&snapshot.gameTime+30>=lastGameTime;
    const sameIdentity=!saved.riotId||!snapshot.active.riotId||saved.riotId===snapshot.active.riotId;
    if(!sameTimeline||!sameIdentity){clearPersistedSession();return null}
    return {id:saved.id,startedAt:saved.startedAt,lastGameTime:Math.max(lastGameTime,snapshot.gameTime),misses:0};
  }catch{return null}
}

function persistSession(snapshot){
  if(!SESSION_FILE||!session)return;
  try{
    writeFileSync(SESSION_FILE,JSON.stringify({
      id:session.id,startedAt:session.startedAt,lastGameTime:session.lastGameTime,
      riotId:snapshot?.active?.riotId||null,championName:snapshot?.active?.championName||null,
      savedAt:new Date().toISOString(),
    }),'utf8');
  }catch{}
}

function clearPersistedSession(){
  if(!SESSION_FILE)return;
  try{unlinkSync(SESSION_FILE)}catch{}
}

async function startSession(snapshot){
  const restored=loadPersistedSession(snapshot);
  if(restored){
    session=restored;
    logState('RECORDING',`OVERPOWERED Companion: resumed ${snapshot.active.championName||'League match'} after tracker restart.`);
    return;
  }
  session={id:randomUUID(),startedAt:new Date().toISOString(),lastGameTime:snapshot.gameTime,misses:0};
  persistSession(snapshot);
  logState('RECORDING',`OVERPOWERED Companion: recording ${snapshot.active.championName||'League match'} silently for post-game review.`);
}

async function finishSession(reason){
  if(!session)return;
  const finished=session;
  session=null;
  clearPersistedSession();
  queueEnvelope({type:'END',clientSessionId:finished.id,startedAt:finished.startedAt,endedAt:new Date().toISOString()});
  logState('WAITING',`OVERPOWERED Companion: match recording closed (${reason}). Waiting for League.`);
}

async function tick(){
  let data;
  try{
    data=await localGameData();
  }catch{
    if(session){
      session.misses+=1;
      if(session.misses>=END_AFTER_MISSES)await finishSession('League game ended');
    }else logState('WAITING','OVERPOWERED Companion: connected. Waiting for a League match.');
    return;
  }

  const snapshot=normalize(data);
  if(session&&snapshot.gameTime+30<session.lastGameTime)await finishSession('new game detected');
  if(!session)await startSession(snapshot);
  session.misses=0;
  session.lastGameTime=snapshot.gameTime;
  persistSession(snapshot);
  queueEnvelope({type:'SNAPSHOT',clientSessionId:session.id,startedAt:session.startedAt,snapshot});
  logState('RECORDING',`OVERPOWERED Companion: recording ${snapshot.active.championName||'League match'} silently for post-game review.`);
}

async function loop(){
  while(running){
    try{await tick()}
    catch(err){console.warn(`OVERPOWERED Companion: recorder loop recovered from an error — ${err?.message||err}`)}
    await new Promise(resolve=>setTimeout(resolve,POLL_MS));
  }
}

async function shutdown(){
  if(!running)return;
  running=false;
  if(uploadRetryTimer){clearTimeout(uploadRetryTimer);uploadRetryTimer=null}
  await finishSession('companion stopped');
  const deadline=Date.now()+5000;
  while(uploadQueue.length&&Date.now()<deadline){
    await flushUploadQueue();
    if(uploadQueue.length)await new Promise(resolve=>setTimeout(resolve,250));
  }
  process.exit(0);
}
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);
process.on('uncaughtException',err=>console.error('OVERPOWERED Companion: recovered from unexpected error:',err));
process.on('unhandledRejection',err=>console.error('OVERPOWERED Companion: recovered from rejected task:',err));

console.log('OVERPOWERED Companion: silent telemetry recorder. No live tactical instructions or hidden cooldown tracking.');
loop().catch(err=>{console.error('OVERPOWERED Companion loop error:',err);setTimeout(()=>void loop(),1000)});

function samePlayer(raw,summonerName,riotId){
  if(summonerName&&text(raw?.summonerName)===summonerName)return true;
  const candidate=riotIdOf(raw);return Boolean(riotId&&candidate&&candidate===riotId);
}
function riotIdOf(raw){
  const direct=text(raw?.riotId);if(direct)return direct;
  const gameName=text(raw?.riotIdGameName),tag=text(raw?.riotIdTagLine);
  return gameName?(tag?`${gameName}#${tag}`:gameName):null;
}
function teamOf(value){
  const v=text(value).toUpperCase();
  if(v==='ORDER'||v==='BLUE'||v==='100')return'ORDER';
  if(v==='CHAOS'||v==='RED'||v==='200')return'CHAOS';
  return'UNKNOWN';
}
const text=value=>typeof value==='string'?value.trim():'';
const num=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const int=(value,fallback)=>Math.max(0,Math.round(num(value,fallback)));
const nullable=value=>Number.isFinite(Number(value))?Number(value):null;
