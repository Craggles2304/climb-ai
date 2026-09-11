import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStrengthTimeline} from '../lib/riot/liveStrength';
import type {LiveTelemetrySnapshot} from '../lib/riot/liveTelemetry';

function snapshot(over:Partial<LiveTelemetrySnapshot>={}):LiveTelemetrySnapshot{
  return {
    version:1,gameTime:545,gameMode:'CLASSIC',mapName:'Summoner\'s Rift',receivedAt:new Date().toISOString(),
    active:{
      summonerName:'Tester',riotId:'Tester#EUW',championName:"Kog'Maw",team:'ORDER',level:7,position:'BOTTOM',currentGold:620,
      stats:{currentHealth:920,maxHealth:1100,currentMana:520,maxMana:700,attackDamage:95,attackSpeed:0.8,abilityPower:0,armor:45,magicResist:34,moveSpeed:335},
    },
    players:[
      {summonerName:'Tester',riotId:'Tester#EUW',championName:"Kog'Maw",team:'ORDER',level:7,position:'BOTTOM',isDead:false,respawnTimer:0,itemGold:4800,items:[],scores:{kills:2,deaths:0,assists:1,creepScore:78,wardScore:5}},
      {summonerName:'Enemy',riotId:'Enemy#EUW',championName:'Jinx',team:'CHAOS',level:6,position:'BOTTOM',isDead:false,respawnTimer:0,itemGold:3200,items:[],scores:{kills:0,deaths:2,assists:0,creepScore:65,wardScore:3}},
    ],
    events:[],...over,
  };
}

test('flags a timestamped possible all-in when visible state is materially ahead',()=>{
  const review=buildStrengthTimeline([snapshot()]);
  assert.equal(review.opportunities.length,1);
  const window=review.opportunities[0];
  assert.equal(window.type,'ALL_IN_CANDIDATE');
  assert.equal(window.opponent,'Jinx');
  assert.equal(window.atSeconds,545);
  assert.equal(window.evidence.levelDelta,1);
  assert.equal(window.evidence.itemGoldDelta,1600);
  assert.match(window.detail,/reachable fight/i);
  assert.match(window.limitation,/not a guaranteed kill/i);
});

test('does not fabricate a fight window when visible states are close',()=>{
  const close=snapshot({players:[
    {summonerName:'Tester',riotId:'Tester#EUW',championName:"Kog'Maw",team:'ORDER',level:7,position:'BOTTOM',isDead:false,respawnTimer:0,itemGold:3500,items:[],scores:{kills:0,deaths:0,assists:0,creepScore:70,wardScore:4}},
    {summonerName:'Enemy',riotId:'Enemy#EUW',championName:'Jinx',team:'CHAOS',level:7,position:'BOTTOM',isDead:false,respawnTimer:0,itemGold:3450,items:[],scores:{kills:0,deaths:0,assists:0,creepScore:69,wardScore:4}},
  ]});
  assert.equal(buildStrengthTimeline([close]).opportunities.length,0);
});

test('flags an enemy-favoured window instead of telling the player to force',()=>{
  const behind=snapshot({active:{...snapshot().active,level:6,currentGold:150},players:[
    {summonerName:'Tester',riotId:'Tester#EUW',championName:"Kog'Maw",team:'ORDER',level:6,position:'BOTTOM',isDead:false,respawnTimer:0,itemGold:2600,items:[],scores:{kills:0,deaths:2,assists:0,creepScore:55,wardScore:3}},
    {summonerName:'Enemy',riotId:'Enemy#EUW',championName:'Jinx',team:'CHAOS',level:7,position:'BOTTOM',isDead:false,respawnTimer:0,itemGold:4100,items:[],scores:{kills:2,deaths:0,assists:1,creepScore:78,wardScore:5}},
  ]});
  const window=buildStrengthTimeline([behind]).opportunities[0];
  assert.equal(window.type,'CAUTION_WINDOW');
  assert.match(window.detail,/poor default fight/i);
});
