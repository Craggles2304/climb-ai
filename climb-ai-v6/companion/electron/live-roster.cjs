const {app,BrowserWindow}=require('electron');
const https=require('node:https');

const HOST='127.0.0.1';
const PORT=2999;
const PATH='/liveclientdata/allgamedata';
const POLL_MS=3000;
let timer=null;
let inFlight=false;
let lastSignature='';

function requestJson(){
  return new Promise((resolve,reject)=>{
    const req=https.request({
      hostname:HOST,
      port:PORT,
      path:PATH,
      method:'GET',
      rejectUnauthorized:false,
      timeout:1800,
      headers:{accept:'application/json'},
    },res=>{
      if(res.statusCode!==200){res.resume();reject(new Error(`LCU ${res.statusCode}`));return}
      let body='';
      res.setEncoding('utf8');
      res.on('data',chunk=>{if(body.length<2_000_000)body+=chunk});
      res.on('end',()=>{try{resolve(JSON.parse(body))}catch(err){reject(err)}});
    });
    req.on('timeout',()=>req.destroy(new Error('LCU timeout')));
    req.on('error',reject);
    req.end();
  });
}

function cleanPlayer(player){
  const name=String(player?.championName||'').trim();
  if(!name)return null;
  return{
    champion:name,
    team:String(player?.team||'').trim().toUpperCase(),
    position:String(player?.position||'').trim().toUpperCase(),
    summonerName:String(player?.summonerName||player?.riotId||'').trim(),
    level:Number(player?.level)||0,
  };
}

function broadcast(payload){
  const source=`window.dispatchEvent(new CustomEvent('op-climb-live-roster',{detail:${JSON.stringify(payload)}}));`;
  for(const win of BrowserWindow.getAllWindows()){
    if(win.isDestroyed()||win.webContents.isDestroyed())continue;
    win.webContents.executeJavaScript(source,true).catch(()=>{});
  }
}

async function poll(){
  if(inFlight)return;
  inFlight=true;
  try{
    const data=await requestJson();
    const players=Array.isArray(data?.allPlayers)?data.allPlayers.map(cleanPlayer).filter(Boolean):[];
    if(players.length<2)return;
    const payload={
      players,
      activePlayer:String(data?.activePlayer?.summonerName||'').trim(),
      gameTime:Number(data?.gameData?.gameTime)||0,
    };
    const signature=players.map(p=>`${p.team}:${p.position}:${p.champion}`).join('|');
    if(signature!==lastSignature){
      lastSignature=signature;
      broadcast(payload);
    }
  }catch{
    // League's local Live Client endpoint only exists in an active match.
    lastSignature='';
  }finally{
    inFlight=false;
  }
}

function start(){
  if(timer)return;
  void poll();
  timer=setInterval(()=>void poll(),POLL_MS);
  timer.unref?.();
}

app.whenReady().then(start);
app.on('before-quit',()=>{if(timer){clearInterval(timer);timer=null}});
