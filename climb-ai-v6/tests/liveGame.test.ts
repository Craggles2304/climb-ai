import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readLiveGame,phaseFor,clockOf,championNameMap,inferredRole,SMITE_ID,
  SpectatorGame,
} from '../lib/riot/liveGame';

const ME='puuid-me';

function game(over:Partial<SpectatorGame>={}):SpectatorGame{
  const participants=[
    {puuid:ME,teamId:100,championId:96,spell1Id:4,spell2Id:7,riotId:'Craggles#EUW'},
    {puuid:'a2',teamId:100,championId:64,spell1Id:SMITE_ID,spell2Id:4},
    {puuid:'a3',teamId:100,championId:103,spell1Id:4,spell2Id:14},
    {puuid:'e1',teamId:200,championId:51,spell1Id:4,spell2Id:7},
    {puuid:'e2',teamId:200,championId:11,spell1Id:4,spell2Id:SMITE_ID},
  ];
  return {gameId:123,gameQueueConfigId:420,gameLength:600,participants,...over};
}

test('splits allies from enemies and never counts you as your own ally',()=>{
  const r=readLiveGame(game(),ME);
  assert.equal(r.me.championId,96);
  assert.equal(r.allies.length,2);
  assert.equal(r.enemies.length,2);
  assert.ok(!r.allies.some(a=>a.championId===r.me.championId&&a.riotId===r.me.riotId));
});

test('names champions when Data Dragon is available',()=>{
  const names=new Map([[96,"Kog'Maw"],[51,'Caitlyn']]);
  const r=readLiveGame(game(),ME,{championNames:names});
  assert.equal(r.me.championName,"Kog'Maw");
  assert.equal(r.enemies.find(e=>e.championId===51)?.championName,'Caitlyn');
});

test('falls back to the id rather than inventing a champion name',()=>{
  const r=readLiveGame(game(),ME);
  assert.equal(r.me.championName,'Champion 96');
});

test('infers jungle from Smite and claims nothing else about role',()=>{
  const r=readLiveGame(game(),ME);
  const jungler=r.allies.find(a=>a.likelyJungler);
  assert.equal(jungler?.championId,64);
  assert.equal(inferredRole(jungler!),'JUNGLE');
  // The player has Flash/Heal — no role can be claimed for them.
  assert.equal(r.me.likelyJungler,false);
  assert.equal(inferredRole(r.me),null,'spectator data cannot tell us a non-jungle role');
});

test('phases line up with the behaviours the plan scores',()=>{
  assert.equal(phaseFor(0),'LOADING','game not started yet');
  assert.equal(phaseFor(-5),'LOADING','negative clock happens in champ select');
  assert.equal(phaseFor(60),'LANE');
  assert.equal(phaseFor(899),'LANE','just before 15:00');
  assert.equal(phaseFor(900),'MID','15:00 exactly is the post-15 window');
  assert.equal(phaseFor(1199),'MID');
  assert.equal(phaseFor(1200),'LATE','20:00 is where deaths cost objectives');
});

test('the phase note tells the player something useful for that moment',()=>{
  assert.match(readLiveGame(game({gameLength:0}),ME).phaseNote,/loading screen/i);
  assert.match(readLiveGame(game({gameLength:1000}),ME).phaseNote,/window/i);
  assert.match(readLiveGame(game({gameLength:1500}),ME).phaseNote,/objectives/i);
});

test('formats the clock the way a player reads it',()=>{
  assert.equal(clockOf(0),'0:00');
  assert.equal(clockOf(65),'1:05');
  assert.equal(clockOf(900),'15:00');
  assert.equal(clockOf(-30),'0:00','never show a negative clock');
});

test('flags ranked solo, and does not pretend other queues are it',()=>{
  assert.equal(readLiveGame(game(),ME).isRankedSolo,true);
  assert.equal(readLiveGame(game(),ME).queue,'Ranked Solo/Duo');
  const aram=readLiveGame(game({gameQueueConfigId:450}),ME);
  assert.equal(aram.isRankedSolo,false);
  assert.equal(aram.queue,'ARAM');
  const odd=readLiveGame(game({gameQueueConfigId:9999}),ME);
  assert.equal(odd.queue,'Custom or other queue');
});

test('throws if the player is not in the game',()=>{
  assert.throws(()=>readLiveGame(game(),'puuid-nobody'),/not a participant/);
});

test('builds the champion name map from a Data Dragon payload',()=>{
  const dd={data:{Kogmaw:{key:'96',name:"Kog'Maw"},Caitlyn:{key:'51',name:'Caitlyn'}}};
  const map=championNameMap(dd);
  assert.equal(map.get(96),"Kog'Maw");
  assert.equal(map.size,2);
});

test('a malformed Data Dragon payload yields an empty map, not a crash',()=>{
  for(const bad of [null,undefined,{},{data:null},'nonsense']){
    assert.doesNotThrow(()=>championNameMap(bad));
    assert.equal(championNameMap(bad).size,0);
  }
});
