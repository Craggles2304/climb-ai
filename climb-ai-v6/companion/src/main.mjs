const LOCAL='https://127.0.0.1:2999/liveclientdata/allgamedata';
const WEB=process.env.OP_WEB_URL||process.env.CLIMB_WEB_URL||'http://localhost:3000';
const ACCOUNT=process.env.OP_ACCOUNT_ID||process.env.CLIMB_ACCOUNT_ID||'acct-main';
process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';
async function tick(){try{const r=await fetch(LOCAL);if(!r.ok)return;const d=await r.json();const p=d.activePlayer||{};const s=p.championStats||{};const payload={accountId:ACCOUNT,gameTime:Number(d.gameData?.gameTime||0),championName:p.championName,level:p.level,currentGold:p.currentGold,cs:s.creepScore,kills:undefined,deaths:undefined,assists:undefined,events:(d.events?.Events||[]).slice(-20).map(e=>({name:e.EventName||'event',time:Number(e.EventTime||0)})),receivedAt:new Date().toISOString()};await fetch(`${WEB}/api/live/telemetry`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});}catch{} }
console.log('OVERPOWERED Companion prototype: silent telemetry only. No automated tactical instructions.');
setInterval(tick,5000);tick();
