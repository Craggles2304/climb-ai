'use strict';

const {readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const path=require('node:path');

const TFT_GAME_ID=21570;
const FEATURES=['game_info','me','match_info','store','board','bench'];
const ALLOWED_INFO=new Set([
  'me:xp','me:health','me:rank','me:gold',
  'match_info:pseudo_match_id','match_info:match_state','match_info:round_type',
  'store:shop_pieces','board:board_pieces','bench:bench_pieces',
]);

function jsonValue(value){
  if(value===null||value===undefined)return value;
  if(typeof value!=='string')return value;
  const trimmed=value.trim();
  if(!trimmed)return '';
  try{return JSON.parse(trimmed)}catch{return trimmed}
}
function numberValue(value){
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:undefined;
}
function boolValue(value){
  if(value===true||value==='true'||value===1||value==='1')return true;
  if(value===false||value==='false'||value===0||value==='0')return false;
  return undefined;
}
function roundValue(value){
  const parsed=jsonValue(value);
  const raw=typeof parsed==='string'?parsed:JSON.stringify(parsed??'');
  const match=/(\d+)\s*[-_.:]\s*(\d+)/.exec(raw);
  if(match)return `${Number(match[1])}-${Number(match[2])}`;
  const stage=/stage[^0-9]*(\d+)[^0-9]+(\d+)/i.exec(raw);
  return stage?`${Number(stage[1])}-${Number(stage[2])}`:'0-0';
}
function pieceRows(value){
  const parsed=jsonValue(value);
  if(!parsed||typeof parsed!=='object')return[];
  return Object.entries(parsed).flatMap(([slot,raw])=>{
    if(!raw||typeof raw!=='object')return[];
    const unit=raw;
    const name=String(unit.name||'').trim();
    if(!name)return[];
    const items=[unit.item_1,unit.item_2,unit.item_3].map(x=>String(x||'').trim()).filter(Boolean);
    return[{slot,name,level:Math.max(1,Number(unit.level)||1),items}];
  }).slice(0,12);
}
function shopRows(value){
  const parsed=jsonValue(value);
  if(!parsed||typeof parsed!=='object')return[];
  return Object.entries(parsed).map(([slot,raw])=>{
    const name=raw&&typeof raw==='object'?String(raw.name||'').trim():String(raw||'').trim();
    return{slot,name};
  }).filter(row=>row.name).slice(0,8);
}
function shopSignature(rows){return rows.map(row=>`${row.slot}:${row.name}`).join('|')}
function soldCount(previous,next){
  const before=new Map(previous.map(row=>[row.slot,String(row.name||'')]));
  return next.reduce((count,row)=>{
    const now=String(row.name||'').toLowerCase();
    const was=String(before.get(row.slot)||'').toLowerCase();
    return count+(now.includes('sold')&&!was.includes('sold')?1:0);
  },0);
}
function boardPower(rows){
  const starWeight={1:1,2:3,3:9,4:18};
  return rows.reduce((score,row)=>score+(starWeight[Math.min(4,Math.max(1,Number(row.level)||1))]||1)+(Array.isArray(row.items)?row.items.length*2:0),0);
}
function completedItems(rows){return rows.reduce((count,row)=>count+(Array.isArray(row.items)?row.items.length:0),0)}

function startTftRecorder({app,getConfig,log=()=>{},onStatus=()=>{}}){
  const gep=app?.overwolf?.packages?.gep;
  if(!gep){
    onStatus({available:false,state:'UNAVAILABLE',detail:'TFT recorder requires the Overwolf Electron GEP runtime.'});
    return{available:false,stop:()=>{}};
  }

  const queueFile=path.join(app.getPath('userData'),'tft-telemetry-queue.json');
  let active=false;
  let pseudoMatchId='';
  let startedAt='';
  let round='0-0';
  let pointCounter=0;
  let roundRefreshes=0;
  let roundPurchases=0;
  let shopSeenThisRound=false;
  let shop=[];
  let board=[];
  let bench=[];
  let me={gold:undefined,level:undefined,xp:undefined,hp:undefined,placement:undefined};
  let stopped=false;
  let chain=Promise.resolve();

  const status=(state,detail,extra={})=>onStatus({available:true,state,detail,...extra});
  const cfg=()=>getConfig?.()||{};
  const loadQueue=()=>{try{const rows=JSON.parse(readFileSync(queueFile,'utf8'));return Array.isArray(rows)?rows:[]}catch{return[]}};
  const saveQueue=rows=>{try{mkdirSync(path.dirname(queueFile),{recursive:true});writeFileSync(queueFile,JSON.stringify(rows.slice(-120)),'utf8')}catch{}};
  const request=async body=>{
    const config=cfg();
    if(!config.token||!config.webUrl)throw Object.assign(new Error('Pair this PC to OP CLIMB first.'),{status:401});
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetch(`${String(config.webUrl).replace(/\/$/,'')}/api/live/telemetry`,{
        method:'POST',
        headers:{'content-type':'application/json',authorization:`Bearer ${config.token}`},
        body:JSON.stringify(body),
        signal:controller.signal,
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw Object.assign(new Error(payload?.error||`TFT recorder returned HTTP ${response.status}.`),{status:response.status});
      return payload;
    }finally{clearTimeout(timer)}
  };
  const flush=async()=>{
    const queued=loadQueue();
    if(!queued.length)return;
    const remaining=[];
    for(let i=0;i<queued.length;i++){
      try{await request(queued[i])}
      catch(error){
        if(error?.status===401){log('TFT recorder needs this PC to be paired again.','error');saveQueue([]);return}
        remaining.push(...queued.slice(i));break;
      }
    }
    saveQueue(remaining);
  };
  const send=body=>{
    chain=chain.then(async()=>{
      await flush();
      try{return await request(body)}
      catch(error){
        if(error?.status!==401){
          const rows=loadQueue();rows.push(body);saveQueue(rows);
          log('TFT checkpoint saved locally; upload will retry automatically.','info');
        }else log('TFT recorder could not upload because pairing is invalid.','error');
        return null;
      }
    });
    return chain;
  };

  const ensureMatch=reason=>{
    if(active)return;
    active=true;
    startedAt=new Date().toISOString();
    pseudoMatchId=pseudoMatchId||`local-${Date.now()}`;
    pointCounter=0;roundRefreshes=0;roundPurchases=0;shopSeenThisRound=false;
    status('RECORDING','TFT detected. Recording your own decision evidence silently.',{pseudoMatchId});
    log(`TFT recorder started (${reason}).`);
    void send({game:'TFT',action:'START',pseudoMatchId,startedAt,metadata:{capture:'OVERWOLF_GEP_LOCAL_PLAYER_V1',features:FEATURES}});
    void checkpoint('MATCH_START');
  };
  const checkpoint=eventKind=>{
    if(!active)return Promise.resolve(null);
    const at=new Date().toISOString();
    const point={
      clientPointId:`${round}:${eventKind}:${++pointCounter}`,
      at,round,eventKind,
      gold:me.gold,level:me.level,xp:me.xp,hp:me.hp,placement:me.placement,
      shopRefreshes:roundRefreshes,purchases:roundPurchases,
      boardPower:boardPower(board),boardUnits:board.length,benchUnits:bench.length,
      completedItems:completedItems(board),board,bench,shop,
    };
    return send({game:'TFT',action:'POINT',pseudoMatchId,point});
  };
  const finish=reason=>{
    if(!active)return;
    const endedAt=new Date().toISOString();
    const point={
      clientPointId:`${round}:MATCH_END:${++pointCounter}`,
      at:endedAt,round,eventKind:'MATCH_END',
      gold:me.gold,level:me.level,xp:me.xp,hp:me.hp,placement:me.placement,
      shopRefreshes:roundRefreshes,purchases:roundPurchases,
      boardPower:boardPower(board),boardUnits:board.length,benchUnits:bench.length,
      completedItems:completedItems(board),board,bench,shop,
    };
    const id=pseudoMatchId;
    active=false;
    status('PROCESSING','TFT finished. Building your post-game Decision Twin review.',{pseudoMatchId:id});
    void send({game:'TFT',action:'END',pseudoMatchId:id,endedAt,point}).then(result=>{
      if(result?.ok){
        const observed=Array.isArray(result.findings)?result.findings.filter(x=>x?.status==='OBSERVED').length:0;
        status('READY',`TFT review ready · ${observed} evidence-backed pattern${observed===1?'':'s'} found.`,{pseudoMatchId:id,sessionId:result.sessionId});
        log(`TFT post-game review ready (${reason}).`);
      }
    });
    pseudoMatchId='';startedAt='';round='0-0';shop=[];board=[];bench=[];
    roundRefreshes=0;roundPurchases=0;shopSeenThisRound=false;
  };

  const handleInfo=data=>{
    if(!data||typeof data!=='object')return;
    const feature=String(data.feature||data.category||'');
    const key=String(data.key||'');
    if(!ALLOWED_INFO.has(`${feature}:${key}`))return;
    const value=jsonValue(data.value??data.data);

    if(feature==='match_info'){
      if(key==='pseudo_match_id'&&value)pseudoMatchId=active?pseudoMatchId:String(value).slice(0,180);
      if(key==='round_type'){
        const parsed=roundValue(value);if(parsed!=='0-0')round=parsed;
      }
      if(key==='match_state'){
        const inMatch=boolValue(value);
        if(inMatch===true)ensureMatch('match state');
        if(inMatch===false&&active)finish('match state ended');
      }
      return;
    }
    if(feature==='me'){
      if(key==='gold')me.gold=numberValue(value);
      if(key==='health')me.hp=numberValue(value);
      if(key==='rank')me.placement=numberValue(value);
      if(key==='xp'){
        const xp=jsonValue(value);
        if(xp&&typeof xp==='object'){
          me.level=numberValue(xp.level);
          me.xp=numberValue(xp.current_xp);
        }
      }
      return;
    }
    if(feature==='board'&&key==='board_pieces'){board=pieceRows(value);return}
    if(feature==='bench'&&key==='bench_pieces'){bench=pieceRows(value);return}
    if(feature==='store'&&key==='shop_pieces'){
      const next=shopRows(value);
      if(shopSeenThisRound){
        const sold=soldCount(shop,next);
        if(sold>0)roundPurchases+=sold;
        else if(shopSignature(next)&&shopSignature(next)!==shopSignature(shop))roundRefreshes+=1;
      }else shopSeenThisRound=true;
      shop=next;
    }
  };

  const handleSnapshot=info=>{
    if(!info||typeof info!=='object')return;
    if(info.feature&&info.key){handleInfo(info);return}
    const root=info.info&&typeof info.info==='object'?info.info:info;
    for(const [feature,values] of Object.entries(root)){
      if(!values||typeof values!=='object')continue;
      for(const [key,value] of Object.entries(values))handleInfo({feature,category:feature,key,value});
    }
  };
  const handleEvents=data=>{
    const events=Array.isArray(data?.events)?data.events:Array.isArray(data)?data:(data?.event?[data.event]:[]);
    for(const item of events){
      const name=String(item?.name||'');
      if(name==='match_start')ensureMatch('match_start');
      else if(name==='round_start'){
        if(!active)ensureMatch('round_start');
        const maybeRound=roundValue(item?.data);if(maybeRound!=='0-0')round=maybeRound;
        roundRefreshes=0;roundPurchases=0;shopSeenThisRound=false;
        void checkpoint('ROUND_START');
      }else if(name==='round_end')void checkpoint('ROUND_END');
      else if(name==='match_end')finish('match_end');
    }
  };

  const detected=async(event,gameId)=>{
    if(Number(gameId)!==TFT_GAME_ID)return;
    try{event?.enable?.()}catch{}
    try{
      await gep.setRequiredFeatures(TFT_GAME_ID,FEATURES);
      status('ARMED','TFT recorder armed. It records only your own supported game data.');
      log('TFT GEP recorder armed.');
      const info=await gep.getInfo(TFT_GAME_ID).catch(()=>null);
      if(info)handleSnapshot(info);
    }catch(error){
      status('ERROR','TFT recorder could not subscribe to game events.');
      log(`TFT recorder subscription failed: ${error?.message||error}`,'error');
    }
  };
  const infoListener=(_event,gameId,data)=>{if(Number(gameId)===TFT_GAME_ID)handleInfo(data)};
  const gameListener=(_event,gameId,data)=>{if(Number(gameId)===TFT_GAME_ID)handleEvents(data)};
  const exitListener=(_event,gameId)=>{if(Number(gameId)===TFT_GAME_ID&&active)finish('game process exit')};
  const errorListener=error=>log(`TFT GEP: ${error?.message||error}`,'error');

  gep.on('game-detected',detected);
  gep.on('new-info-update',infoListener);
  gep.on('new-game-event',gameListener);
  gep.on('game-exit',exitListener);
  gep.on('error',errorListener);
  void flush();
  status('ARMED','TFT recorder is ready and waiting for Teamfight Tactics.');

  return{
    available:true,
    stop(){
      if(stopped)return;stopped=true;
      if(active)finish('companion shutdown');
      try{gep.off('game-detected',detected)}catch{}
      try{gep.off('new-info-update',infoListener)}catch{}
      try{gep.off('new-game-event',gameListener)}catch{}
      try{gep.off('game-exit',exitListener)}catch{}
      try{gep.off('error',errorListener)}catch{}
    },
  };
}

module.exports={startTftRecorder,TFT_GAME_ID,FEATURES,pieceRows,shopRows,roundValue,boardPower,soldCount};
