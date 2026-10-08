import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const recorder=require('../companion/electron/tft-recorder.cjs');

function word(text:string,confidence:number,x0:number,y0:number,x1:number,y1:number){
  return{text,confidence,x0,y0,x1,y1};
}

test('native TFT recorder recognises the player HUD without opponent data',()=>{
  const hud=recorder.parseTftHudOcr({
    topText:'Planning Stage 4-2',
    bottomText:'Lvl. 7 20 / 36 Buy XP Refresh',
    bottomWidth:1000,
    bottomHeight:400,
    bottomWords:[
      word('50',94,675,75,720,120),
      word('Ahri',91,230,250,285,282),
      word('Jinx',90,380,250,430,282),
      word('Vi',91,525,250,550,282),
      word('Ornn',89,680,250,730,282),
      word('Lulu',92,825,250,875,282),
    ],
  });
  assert.equal(hud.confirmedTft,true);
  assert.equal(hud.round,'4-2');
  assert.equal(hud.level,7);
  assert.equal(hud.xp,20);
  assert.equal(hud.gold,50);
  assert.equal(hud.shop.length,5);
  assert.deepEqual(hud.shop.map((row:any)=>row.name),['Ahri','Jinx','Vi','Ornn','Lulu']);
  assert.equal(recorder.CAPTURE_POLICY.opponentTracking,false);
  assert.deepEqual(Object.keys(recorder.CAPTURE_REGIONS).sort(),['hud','stage']);
});

test('native TFT recorder does not identify a League screen as TFT without shop anchors',()=>{
  const hud=recorder.parseTftHudOcr({
    topText:'12:44',
    bottomText:'Level 9 88 CS',
    bottomWidth:1000,
    bottomHeight:400,
    bottomWords:[word('650',90,680,75,730,120)],
  });
  assert.equal(hud.confirmedTft,false);
  assert.equal(hud.round,'0-0');
});

test('native TFT recorder conservatively classifies shop transitions',()=>{
  const before=[
    {slot:'slot_1',name:'Ahri'},{slot:'slot_2',name:'Jinx'},{slot:'slot_3',name:'Vi'},{slot:'slot_4',name:'Ornn'},{slot:'slot_5',name:'Lulu'},
  ];
  const reroll=[
    {slot:'slot_1',name:'Sett'},{slot:'slot_2',name:'Garen'},{slot:'slot_3',name:'Lux'},{slot:'slot_4',name:'Ezreal'},{slot:'slot_5',name:'Sona'},
  ];
  const purchase=[
    {slot:'slot_1',name:''},{slot:'slot_2',name:'Jinx'},{slot:'slot_3',name:'Vi'},{slot:'slot_4',name:'Ornn'},{slot:'slot_5',name:'Lulu'},
  ];
  assert.equal(recorder.shopTransition(before,reroll,50,48),'REFRESH');
  assert.equal(recorder.shopTransition(before,purchase,50,46),'PURCHASE');
  assert.equal(recorder.shopTransition(before,purchase,50,40),'NONE');
});

test('native TFT recorder uses LCU only to distinguish TFT from other Riot gameflow',()=>{
  assert.equal(recorder.classifyTftSession({gameData:{queue:{gameMode:'TFT'}}}),'TFT');
  assert.equal(recorder.classifyTftSession({gameData:{queue:{gameMode:'CLASSIC'}}}),'OTHER');
  assert.equal(recorder.classifyTftSession({}),'UNKNOWN');
  assert.equal(recorder.roundValue('PVP Stage 6-3'),'6-3');
});


test('TFT wire schema accepts real recorded stages instead of rejecting every POINT',async()=>{
  const {tftEnvelopeSchema}=await import('../lib/tft/ingestSchema');
  const point={clientPointId:'4-2:CHECKPOINT:12',at:new Date().toISOString(),round:'4-2',eventKind:'CHECKPOINT' as const,gold:48,level:7,xp:18,shopRefreshes:2,purchases:1,shop:[{slot:'slot_1',name:'Ahri',confidence:92}]};
  const envelope={game:'TFT' as const,action:'POINT' as const,pseudoMatchId:'native-test-123',point};
  assert.equal(tftEnvelopeSchema.safeParse(envelope).success,true);
  assert.equal(tftEnvelopeSchema.safeParse({...envelope,action:'END',endedAt:new Date().toISOString()}).success,true);
  assert.equal(tftEnvelopeSchema.safeParse({...envelope,point:{...point,round:'not-a-round'}}).success,false);
  assert.equal(tftEnvelopeSchema.safeParse({...envelope,point:{...point,gold:-50}}).success,false);
});


test('native recorder queues failed uploads in original order and retries automatically',()=>{
  const {readFileSync}=require('node:fs');
  const source=readFileSync('companion/electron/tft-recorder.cjs','utf8');
  assert.match(source,/if\(!await flush\(\)\)\{queueEvent\(body\);return null\}/);
  assert.match(source,/rows\.slice\(-3000\)/);
  assert.match(source,/error\?\.status===400\|\|error\?\.status===404/);
  assert.match(source,/lastEndedMatch===body\.pseudoMatchId/);
  assert.match(source,/pointCounter\+' checkpoints captured/);
});

test('post-game telemetry cannot show a successful review for an empty capture',()=>{
  const {readFileSync}=require('node:fs');
  const source=readFileSync('lib/server/tftTelemetryRepository.ts','utf8');
  assert.match(source,/status:timeline\.points\.length\?'COMPLETE':'ABORTED'/);
  assert.match(source,/evidenceReady:timeline\.points\.length>0/);
  assert.match(source,/quality:timeline\.points\.length\?'RECORDED':'NO_EVIDENCE'/);
});
