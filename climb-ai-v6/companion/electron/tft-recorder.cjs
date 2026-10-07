'use strict';

const {readFileSync,writeFileSync,mkdirSync,existsSync}=require('node:fs');
const {get:httpsGet}=require('node:https');
const {execFile}=require('node:child_process');
const path=require('node:path');

const POLL_MS=4500;
const CHECKPOINT_MS=15000;
const WINDOW_WIDTH=1920;
const WINDOW_HEIGHT=1080;
const OCR_MIN_CONFIDENCE=45;
const CAPTURE_POLICY={
  source:'OP_CLIMB_NATIVE_WINDOW_OCR_V1',
  coaching:'POST_GAME_ONLY',
  privacy:'Own TFT game-window HUD/shop crops only. Full frames are held in memory briefly, never written to disk, and never uploaded.',
  opponentTracking:false,
};
const CAPTURE_REGIONS={
  stage:{x:.30,y:0,w:.40,h:.20},
  hud:{x:.05,y:.66,w:.90,h:.34},
};

function roundValue(value){
  const raw=String(value??'').replace(/[_.:—–]/g,'-');
  const match=/(?:stage\s*)?([1-9])\s*-\s*([1-9])/i.exec(raw);
  return match?Number(match[1])+'-'+Number(match[2]):'0-0';
}
function cleanText(value){return String(value??'').replace(/\s+/g,' ').trim()}
function numberFrom(value){
  const raw=String(value??'').replace(/[^0-9]/g,'');
  if(!raw)return undefined;
  const parsed=Number(raw);
  return Number.isFinite(parsed)?parsed:undefined;
}
function normalizeWord(word){
  const bbox=word?.bbox||{};
  return{
    text:cleanText(word?.text),
    confidence:Number(word?.confidence)||0,
    x0:Number(bbox.x0)||0,
    y0:Number(bbox.y0)||0,
    x1:Number(bbox.x1)||0,
    y1:Number(bbox.y1)||0,
  };
}
function flattenWords(blocks){
  const rows=[];
  for(const block of Array.isArray(blocks)?blocks:[]){
    for(const paragraph of Array.isArray(block?.paragraphs)?block.paragraphs:[]){
      for(const line of Array.isArray(paragraph?.lines)?paragraph.lines:[]){
        for(const word of Array.isArray(line?.words)?line.words:[])rows.push(normalizeWord(word));
      }
    }
  }
  return rows;
}
function parseLevelAndXp(text){
  const levelMatch=/(?:lvl|level)\s*\.?\s*(\d{1,2})/i.exec(text);
  const ratioMatch=/(\d{1,2})\s*\/\s*(\d{1,2})/.exec(text);
  const level=levelMatch?Number(levelMatch[1]):undefined;
  const xp=ratioMatch?Number(ratioMatch[1]):undefined;
  return{
    level:Number.isFinite(level)&&level>=1&&level<=15?level:undefined,
    xp:Number.isFinite(xp)&&xp>=0&&xp<=100?xp:undefined,
  };
}
function goldCandidate(words,width,height){
  const targetX=.70,targetY=.23;
  let best=null;
  for(const word of Array.isArray(words)?words:[]){
    if(word.confidence<OCR_MIN_CONFIDENCE)continue;
    if(/%/.test(word.text))continue;
    const value=numberFrom(word.text);
    if(value===undefined||value>200)continue;
    const cx=((word.x0+word.x1)/2)/Math.max(1,width);
    const cy=((word.y0+word.y1)/2)/Math.max(1,height);
    if(cx<.45||cx>.90||cy<.02||cy>.44)continue;
    const distance=Math.abs(cx-targetX)*1.3+Math.abs(cy-targetY);
    const heightScore=Math.min(20,Math.max(0,(word.y1-word.y0)/Math.max(1,height)*180));
    const score=word.confidence+heightScore-distance*55;
    if(!best||score>best.score)best={value,confidence:word.confidence,score,cx,cy};
  }
  return best;
}
const SHOP_STOPWORDS=new Set([
  'refresh','reroll','buy','xp','lvl','level','sell','lock','shop','planning','combat','gold',
  'chance','odds','next','free','cost','team','stage','round','bench',
]);
function sanitizeShopName(value){
  const cleaned=String(value??'').replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'’.-]/g,'').replace(/^[.'’-]+|[.'’-]+$/g,'');
  if(cleaned.length<2||cleaned.length>24)return'';
  if(SHOP_STOPWORDS.has(cleaned.toLowerCase()))return'';
  return cleaned;
}
function shopRowsFromWords(words,width,height){
  const startX=.20,endX=.95,slotWidth=(endX-startX)/5;
  const candidates=Array.from({length:5},()=>[]);
  for(const word of Array.isArray(words)?words:[]){
    if(word.confidence<50)continue;
    const name=sanitizeShopName(word.text);
    if(!name)continue;
    const cx=((word.x0+word.x1)/2)/Math.max(1,width);
    const cy=((word.y0+word.y1)/2)/Math.max(1,height);
    if(cx<startX||cx>endX||cy<.42||cy>.98)continue;
    const slot=Math.min(4,Math.max(0,Math.floor((cx-startX)/slotWidth)));
    candidates[slot].push({...word,name,cy});
  }
  const rows=candidates.map((slotRows,index)=>{
    const chosen=[...slotRows].sort((a,b)=>b.cy-a.cy||b.confidence-a.confidence)[0];
    return{slot:'slot_'+(index+1),name:chosen?.name||'',confidence:chosen?Math.round(chosen.confidence):0};
  });
  return rows.filter(row=>row.name).length>=3?rows:[];
}
function parseTftHudOcr({topText='',bottomText='',bottomWords=[],bottomWidth=1,bottomHeight=1}){
  const round=roundValue(topText+' '+bottomText);
  const {level,xp}=parseLevelAndXp(bottomText);
  const gold=goldCandidate(bottomWords,bottomWidth,bottomHeight);
  const shop=shopRowsFromWords(bottomWords,bottomWidth,bottomHeight);
  const shopAnchor=/\b(refresh|reroll|buy\s*xp|lvl\.?|level)\b/i.test(bottomText);
  const confirmedTft=round!=='0-0'&&shopAnchor;
  const evidenceCount=[round!=='0-0',shopAnchor,level!==undefined,gold!==null,shop.length>=3].filter(Boolean).length;
  return{
    confirmedTft,
    round,
    level,
    xp,
    gold:gold?.value,
    goldConfidence:gold?.confidence??0,
    shop,
    confidence:evidenceCount>=4?'HIGH':evidenceCount>=2?'MEDIUM':'LOW',
  };
}
function shopSignature(rows){
  return (Array.isArray(rows)?rows:[]).map(row=>String(row?.name||'').trim().toLowerCase()).join('|');
}
function shopTransition(previous,next,previousGold,nextGold){
  if(!Array.isArray(previous)||!Array.isArray(next)||previous.length!==5||next.length!==5)return'NONE';
  const changed=[];
  for(let i=0;i<5;i++){
    const before=String(previous[i]?.name||'').trim().toLowerCase();
    const after=String(next[i]?.name||'').trim().toLowerCase();
    if(before!==after)changed.push({before,after});
  }
  if(changed.length>=4)return'REFRESH';
  const goldDrop=Number(previousGold)-Number(nextGold);
  const emptied=changed.some(row=>row.before&&!row.after);
  if(changed.length>=1&&changed.length<=2&&emptied&&Number.isFinite(goldDrop)&&goldDrop>=1&&goldDrop<=5)return'PURCHASE';
  return'NONE';
}
function classifyTftSession(session){
  const queue=session?.gameData?.queue||{};
  const map=session?.map||session?.gameData?.map||{};
  const values=[
    queue.gameMode,queue.name,queue.type,queue.gameType,
    session?.gameData?.gameMode,session?.gameMode,map.gameMode,map.name,
  ].map(value=>String(value||'').trim()).filter(Boolean);
  if(values.some(value=>/\btft\b|teamfight\s*tactics/i.test(value)))return'TFT';
  if(values.length)return'OTHER';
  return'UNKNOWN';
}
function cropRect(image,normalized){
  const size=image.getSize();
  const x=Math.max(0,Math.floor(size.width*normalized.x));
  const y=Math.max(0,Math.floor(size.height*normalized.y));
  const width=Math.max(1,Math.min(size.width-x,Math.floor(size.width*normalized.w)));
  const height=Math.max(1,Math.min(size.height-y,Math.floor(size.height*normalized.h)));
  return{x,y,width,height};
}
function upscale(image,minWidth=1200){
  const size=image.getSize();
  if(size.width>=minWidth)return image;
  return image.resize({width:minWidth,quality:'better'});
}

function startTftRecorder({app,getConfig,log=()=>{},onStatus=()=>{}}){
  let desktopCapturer;
  try{({desktopCapturer}=require('electron'))}catch{}
  if(!desktopCapturer){
    onStatus({available:false,state:'UNAVAILABLE',detail:'TFT recorder could not access the OP CLIMB window-capture runtime.'});
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
  let shop=[];
  let acceptedGold=undefined;
  let current={gold:undefined,level:undefined,xp:undefined};
  let lastCheckpointAt=0;
  let matchStartSent=false;
  let pendingShopSignature='';
  let pendingShopHits=0;
  let tftConfirmHits=0;
  let missHits=0;
  let nonTftFlowHits=0;
  let stopped=false;
  let pollTimer=null;
  let inFlight=false;
  let chain=Promise.resolve();
  let workerPromise=null;
  let worker=null;
  let lcuCredentials=null;
  let lcuCheckedAt=0;

  const status=(state,detail,extra={})=>onStatus({available:true,state,detail,capture:'OP_CLIMB_NATIVE',...extra});
  const cfg=()=>getConfig?.()||{};
  const loadQueue=()=>{try{const rows=JSON.parse(readFileSync(queueFile,'utf8'));return Array.isArray(rows)?rows:[]}catch{return[]}};
  const saveQueue=rows=>{try{mkdirSync(path.dirname(queueFile),{recursive:true});writeFileSync(queueFile,JSON.stringify(rows.slice(-120)),'utf8')}catch{}};

  const request=async body=>{
    const config=cfg();
    if(!config.token||!config.webUrl)throw Object.assign(new Error('Pair this PC to OP CLIMB first.'),{status:401});
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),body?.action==='END'?20000:8000);
    try{
      const response=await fetch(String(config.webUrl).replace(/\/$/,'')+'/api/live/telemetry',{
        method:'POST',
        headers:{'content-type':'application/json',authorization:'Bearer '+config.token},
        body:JSON.stringify(body),
        signal:controller.signal,
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw Object.assign(new Error(payload?.error||'TFT recorder returned HTTP '+response.status+'.'),{status:response.status});
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

  const defaultLockfiles=()=>[
    process.env.OP_LCU_LOCKFILE||'',
    'C:\\Riot Games\\League of Legends\\lockfile',
    'D:\\Riot Games\\League of Legends\\lockfile',
    'E:\\Riot Games\\League of Legends\\lockfile',
  ].filter(Boolean);
  const readLockfile=file=>{
    try{
      if(!existsSync(file))return null;
      const parts=readFileSync(file,'utf8').trim().split(':');
      const port=Number(parts[2]),password=parts[3];
      return Number.isFinite(port)&&port>0&&password?{port,password}:null;
    }catch{return null}
  };
  const processLcuInfo=()=>new Promise((resolve,reject)=>{
    const script=`$p=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'LeagueClientUx.exe' -or $_.Name -eq 'LeagueClient.exe' } | Select-Object -First 1; if($p){ [PSCustomObject]@{ CommandLine=$p.CommandLine; ExecutablePath=$p.ExecutablePath } | ConvertTo-Json -Compress }`;
    execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:3500,maxBuffer:512000},(error,stdout)=>{
      if(error||!stdout){reject(new Error('League Client process not detected'));return}
      try{resolve(JSON.parse(stdout))}catch{reject(new Error('League Client process details unavailable'))}
    });
  });
  const findLcu=async()=>{
    if(lcuCredentials&&Date.now()-lcuCheckedAt<60000)return lcuCredentials;
    lcuCheckedAt=Date.now();
    for(const file of defaultLockfiles()){
      const found=readLockfile(file);
      if(found){lcuCredentials=found;return found}
    }
    try{
      const info=await processLcuInfo();
      const command=String(info?.CommandLine||'');
      const port=/--app-port=(?:"?)(\d+)/i.exec(command)?.[1];
      const token=/--remoting-auth-token=(?:"([^"]+)"|([^\s"]+))/i.exec(command);
      const password=token?.[1]||token?.[2];
      if(port&&password){lcuCredentials={port:Number(port),password};return lcuCredentials}
      const exe=String(info?.ExecutablePath||'');
      const found=readLockfile(exe?path.join(path.dirname(exe),'lockfile'):'');
      if(found){lcuCredentials=found;return found}
    }catch{}
    lcuCredentials=null;
    return null;
  };
  const lcuJson=async endpoint=>{
    const creds=await findLcu();
    if(!creds)return null;
    return new Promise(resolve=>{
      const auth=Buffer.from('riot:'+creds.password).toString('base64');
      const req=httpsGet({hostname:'127.0.0.1',port:creds.port,path:endpoint,rejectUnauthorized:false,timeout:2200,headers:{authorization:'Basic '+auth}},res=>{
        if((res.statusCode??500)<200||(res.statusCode??500)>=300){res.resume();resolve(null);return}
        let body='';res.setEncoding('utf8');
        res.on('data',chunk=>{body+=chunk;if(body.length>1500000)req.destroy()});
        res.on('end',()=>{try{resolve(JSON.parse(body))}catch{resolve(null)}});
      });
      req.on('timeout',()=>{try{req.destroy()}catch{};resolve(null)});
      req.on('error',()=>{lcuCredentials=null;resolve(null)});
    });
  };
  const gameflow=async()=>{
    const phase=await lcuJson('/lol-gameflow/v1/gameflow-phase');
    const phaseText=typeof phase==='string'?phase:String(phase||'');
    if(!['InProgress','Reconnect','GameStart'].includes(phaseText))return{available:Boolean(phaseText),phase:phaseText,mode:'UNKNOWN',active:false};
    const session=await lcuJson('/lol-gameflow/v1/session');
    const mode=classifyTftSession(session);
    return{available:Boolean(phaseText),phase:phaseText,mode,active:['InProgress','Reconnect','GameStart'].includes(phaseText)};
  };

  const languagePath=()=>{
    const packaged=path.join(process.resourcesPath,'tessdata');
    if(existsSync(path.join(packaged,'eng.traineddata.gz')))return packaged;
    try{
      return path.join(path.dirname(require.resolve('@tesseract.js-data/eng/package.json')),'4.0.0_best_int');
    }catch{return undefined}
  };
  const getWorker=async()=>{
    if(worker)return worker;
    if(workerPromise)return workerPromise;
    workerPromise=(async()=>{
      status('INITIALIZING','TFT detected. Preparing OP CLIMB local text recognition…');
      const {createWorker,PSM}=require('tesseract.js');
      const langPath=languagePath();
      const created=await createWorker('eng',1,{langPath,logger:()=>{}});
      await created.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT,preserve_interword_spaces:'1',user_defined_dpi:'180'});
      worker=created;
      return created;
    })().catch(error=>{
      workerPromise=null;
      status('ERROR','TFT local text recognition could not start. League tracking is unaffected.');
      log('TFT OCR failed to initialise: '+(error?.message||error),'error');
      throw error;
    });
    return workerPromise;
  };
  const recognizeRegion=async(image,region)=>{
    const rect=cropRect(image,region);
    let crop=image.crop(rect);
    crop=upscale(crop,1200);
    const size=crop.getSize();
    const ocr=await getWorker();
    const result=await ocr.recognize(crop.toPNG(),{}, {text:true,blocks:true});
    return{
      text:cleanText(result?.data?.text),
      words:flattenWords(result?.data?.blocks),
      width:size.width,
      height:size.height,
    };
  };
  const captureWindow=async()=>{
    const sources=await desktopCapturer.getSources({
      types:['window'],
      thumbnailSize:{width:WINDOW_WIDTH,height:WINDOW_HEIGHT},
      fetchWindowIcons:false,
    });
    const candidates=sources.map(source=>{
      const name=String(source?.name||'');
      let score=0;
      if(/league of legends \(tm\) client/i.test(name))score+=100;
      else if(/league of legends/i.test(name))score+=70;
      if(/riot client/i.test(name))score-=100;
      const size=source.thumbnail?.getSize?.()||{width:0,height:0};
      score+=Math.min(20,Math.floor(size.width/200));
      return{source,name,score,size};
    }).filter(row=>row.score>0&&row.size.width>400&&row.size.height>300)
      .sort((a,b)=>b.score-a.score);
    const chosen=candidates[0];
    return chosen?{image:chosen.source.thumbnail,name:chosen.name}:null;
  };
  const readHud=async image=>{
    const [top,bottom]=await Promise.all([
      recognizeRegion(image,CAPTURE_REGIONS.stage),
      recognizeRegion(image,CAPTURE_REGIONS.hud),
    ]);
    return parseTftHudOcr({
      topText:top.text,
      bottomText:bottom.text,
      bottomWords:bottom.words,
      bottomWidth:bottom.width,
      bottomHeight:bottom.height,
    });
  };

  const ensureMatch=reason=>{
    if(active)return;
    active=true;
    startedAt=new Date().toISOString();
    pseudoMatchId='native-'+Date.now();
    pointCounter=0;round='0-0';roundRefreshes=0;roundPurchases=0;shop=[];
    acceptedGold=undefined;current={gold:undefined,level:undefined,xp:undefined};
    lastCheckpointAt=0;matchStartSent=false;pendingShopSignature='';pendingShopHits=0;missHits=0;nonTftFlowHits=0;
    status('RECORDING','TFT detected. OP CLIMB is recording your own visible decision evidence silently.',{pseudoMatchId});
    log('TFT native recorder started ('+reason+').');
    void send({
      game:'TFT',action:'START',pseudoMatchId,startedAt,
      metadata:{
        capture:CAPTURE_POLICY.source,
        coaching:CAPTURE_POLICY.coaching,
        privacy:CAPTURE_POLICY.privacy,
        opponentTracking:false,
      },
    });
  };
  const pointPayload=eventKind=>{
    if(!active||round==='0-0')return null;
    return{
      clientPointId:round+':'+eventKind+':'+(++pointCounter),
      at:new Date().toISOString(),
      round,eventKind,
      gold:current.gold,level:current.level,xp:current.xp,
      shopRefreshes:roundRefreshes,purchases:roundPurchases,
      shop:shop.length?shop:undefined,
    };
  };
  const checkpoint=eventKind=>{
    const point=pointPayload(eventKind);
    if(!point)return Promise.resolve(null);
    lastCheckpointAt=Date.now();
    return send({game:'TFT',action:'POINT',pseudoMatchId,point});
  };
  const finish=reason=>{
    if(!active)return;
    const endedAt=new Date().toISOString();
    const point=pointPayload('MATCH_END');
    const id=pseudoMatchId;
    active=false;
    status('PROCESSING','TFT finished. Building your post-game Decision Twin review.',{pseudoMatchId:id});
    void send({game:'TFT',action:'END',pseudoMatchId:id,endedAt,point:point||undefined}).then(result=>{
      if(result?.ok){
        const observed=Array.isArray(result.findings)?result.findings.filter(item=>item?.status==='OBSERVED').length:0;
        status('READY','TFT review ready · '+observed+' evidence-backed pattern'+(observed===1?'':'s')+' found.',{pseudoMatchId:id,sessionId:result.sessionId});
        log('TFT post-game review ready ('+reason+').');
      }
    });
    pseudoMatchId='';startedAt='';round='0-0';shop=[];roundRefreshes=0;roundPurchases=0;
    current={gold:undefined,level:undefined,xp:undefined};pendingShopSignature='';pendingShopHits=0;
  };
  const applyShop=rows=>{
    if(!Array.isArray(rows)||rows.length!==5)return false;
    const signature=shopSignature(rows);
    if(!signature.replace(/\|/g,''))return false;
    if(signature===pendingShopSignature)pendingShopHits+=1;
    else{pendingShopSignature=signature;pendingShopHits=1}
    if(pendingShopHits<2)return false;
    if(shop.length===5&&signature!==shopSignature(shop)){
      const transition=shopTransition(shop,rows,acceptedGold,current.gold);
      if(transition==='REFRESH')roundRefreshes+=1;
      if(transition==='PURCHASE')roundPurchases+=1;
    }
    shop=rows.map(row=>({slot:row.slot,name:row.name,confidence:row.confidence}));
    acceptedGold=current.gold;
    return true;
  };
  const applyHud=hud=>{
    if(!hud)return;
    if(Number.isFinite(hud.gold))current.gold=hud.gold;
    if(Number.isFinite(hud.level))current.level=hud.level;
    if(Number.isFinite(hud.xp))current.xp=hud.xp;
    const previousRound=round;
    const nextRound=hud.round&&hud.round!=='0-0'?hud.round:round;
    if(previousRound!=='0-0'&&nextRound!==previousRound)void checkpoint('ROUND_END');
    if(nextRound!==round){
      round=nextRound;roundRefreshes=0;roundPurchases=0;shop=[];acceptedGold=current.gold;pendingShopSignature='';pendingShopHits=0;
      if(!matchStartSent){matchStartSent=true;void checkpoint('MATCH_START')}
      void checkpoint('ROUND_START');
    }else if(round!=='0-0'&&!matchStartSent){
      matchStartSent=true;void checkpoint('MATCH_START');
    }
    const shopChanged=applyShop(hud.shop);
    if(round!=='0-0'&&(shopChanged||Date.now()-lastCheckpointAt>=CHECKPOINT_MS))void checkpoint('CHECKPOINT');
  };

  const poll=async()=>{
    if(stopped||inFlight)return;
    inFlight=true;
    try{
      const flow=await gameflow();
      if(active&&flow.available&&flow.active&&flow.mode==='OTHER'){
        nonTftFlowHits+=1;
        if(nonTftFlowHits>=2){finish('League gameflow replaced TFT');return}
      }else nonTftFlowHits=0;
      if(active&&flow.available&&!flow.active&&flow.phase){
        missHits+=1;
        if(missHits>=2){finish('TFT gameflow ended');return}
      }
      if(!active&&flow.available&&flow.active&&flow.mode==='OTHER'){
        status('ARMED','League match detected. TFT OCR is sleeping while League tracking runs.');
        return;
      }

      const captured=await captureWindow();
      if(!captured){
        if(active&&!flow.active){
          missHits+=1;
          if(missHits>=4)finish('TFT game window closed');
        }
        if(!active)status('ARMED','OP CLIMB TFT recorder is ready. Open TFT and play normally.');
        return;
      }

      let hud;
      try{hud=await readHud(captured.image)}catch(error){
        if(active)status('RECORDING','TFT is active. A capture pass was skipped; recording will retry automatically.',{pseudoMatchId});
        else status('ARMED','OP CLIMB TFT recorder is ready. Waiting for a TFT match.');
        return;
      }

      if(hud.confirmedTft)tftConfirmHits+=1;else tftConfirmHits=0;
      const flowConfirmsTft=flow.active&&flow.mode==='TFT';
      if(!active&&(flowConfirmsTft||tftConfirmHits>=2))ensureMatch(flowConfirmsTft?'LCU TFT gameflow':'TFT HUD detected');
      if(active){
        missHits=0;
        if(hud.confirmedTft||flowConfirmsTft){
          applyHud(hud);
          status('RECORDING','TFT recording quietly · '+(round!=='0-0'?'stage '+round:'waiting for stage read')+' · post-game coaching only.',{pseudoMatchId,round,confidence:hud.confidence});
        }else if(!flowConfirmsTft){
          missHits+=1;
          if(missHits>=4)finish('TFT HUD no longer detected');
        }
      }else status('ARMED','OP CLIMB TFT recorder is ready. Open TFT and play normally.');
    }finally{
      inFlight=false;
      if(!stopped)pollTimer=setTimeout(()=>void poll(),POLL_MS);
    }
  };

  void flush();
  status('ARMED','OP CLIMB TFT recorder is ready. Open TFT and play normally.');
  pollTimer=setTimeout(()=>void poll(),1200);

  return{
    available:true,
    stop(){
      if(stopped)return;stopped=true;
      if(pollTimer){clearTimeout(pollTimer);pollTimer=null}
      if(active)finish('companion shutdown');
      const localWorker=worker;
      worker=null;
      if(localWorker)void localWorker.terminate().catch(()=>{});
    },
  };
}

module.exports={
  startTftRecorder,
  CAPTURE_POLICY,
  CAPTURE_REGIONS,
  roundValue,
  flattenWords,
  parseTftHudOcr,
  shopRowsFromWords,
  shopTransition,
  classifyTftSession,
};
