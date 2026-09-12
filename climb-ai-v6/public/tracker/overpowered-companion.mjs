import {randomUUID} from 'node:crypto';
import {get as httpsGet} from 'node:https';

const LOCAL='https://127.0.0.1:2999/liveclientdata/allgamedata';
const WEB=(process.env.OP_WEB_URL||process.env.CLIMB_WEB_URL||'http://localhost:3000').replace(/\/$/,'');
const TOKEN=process.env.OP_TRACKER_TOKEN||process.env.CLIMB_TRACKER_TOKEN||'';
const POLL_MS=Math.max(3000,Number(process.env.OP_POLL_MS||5000));
const END_AFTER_MISSES=3;

if(!TOKEN){
  console.error('OVERPOWERED Companion: OP_TRACKER_TOKEN is missing. Pair this PC from the Live Companion page first.');
  process.exit(1);
}

let session=null;
let running=true;
let state='STARTING';

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
  const response=await fetch(`${WEB}/api/live/telemetry`,{
    method:'POST',
    headers:{'content-type':'application/json','authorization':`Bearer ${TOKEN}`},
    body:JSON.stringify(envelope),
  });
  if(response.ok)return true;
  const body=await response.json().catch(()=>({}));
  const detail=body?.error||`HTTP ${response.status}`;
  if(response.status===401)logState('AUTH_ERROR',`OVERPOWERED Companion: pairing token rejected — ${detail}`);
  else console.warn(`OVERPOWERED Companion: upload failed — ${detail}`);
  return false;
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

async function startSession(snapshot){
  session={id:randomUUID(),startedAt:new Date().toISOString(),lastGameTime:snapshot.gameTime,misses:0};
  logState('RECORDING',`OVERPOWERED Companion: recording ${snapshot.active.championName||'League match'} silently for post-game review.`);
}

async function finishSession(reason){
  if(!session)return;
  const finished=session;
  session=null;
  await postEnvelope({type:'END',clientSessionId:finished.id,startedAt:finished.startedAt,endedAt:new Date().toISOString()}).catch(err=>console.warn(`OVERPOWERED Companion: could not close session — ${err.message}`));
  logState('WAITING',`OVERPOWERED Companion: match recording closed (${reason}). Waiting for League.`);
}

async function tick(){
  try{
    const data=await localGameData();
    const snapshot=normalize(data);
    if(session&&snapshot.gameTime+30<session.lastGameTime)await finishSession('new game detected');
    if(!session)await startSession(snapshot);
    session.misses=0;
    session.lastGameTime=snapshot.gameTime;
    const ok=await postEnvelope({type:'SNAPSHOT',clientSessionId:session.id,startedAt:session.startedAt,snapshot});
    if(ok)logState('RECORDING',`OVERPOWERED Companion: recording ${snapshot.active.championName||'League match'} silently for post-game review.`);
  }catch(err){
    if(session){
      session.misses+=1;
      if(session.misses>=END_AFTER_MISSES)await finishSession('League game ended');
    }else logState('WAITING','OVERPOWERED Companion: connected. Waiting for a League match.');
  }
}

async function loop(){
  while(running){
    await tick();
    await new Promise(resolve=>setTimeout(resolve,POLL_MS));
  }
}

async function shutdown(){
  if(!running)return;
  running=false;
  await finishSession('companion stopped');
  process.exit(0);
}
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);

console.log('OVERPOWERED Companion: silent telemetry recorder. No live tactical instructions or hidden cooldown tracking.');
loop().catch(err=>{console.error('OVERPOWERED Companion stopped:',err);process.exit(1)});

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
