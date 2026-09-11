import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLiveClientData,type LiveTelemetrySnapshot} from '../lib/riot/liveTelemetry';
import {buildStrengthTimeline,strengthPoint} from '../lib/riot/liveStrength';

function snapshot(over:Partial<LiveTelemetrySnapshot>={}):LiveTelemetrySnapshot{
  const base:LiveTelemetrySnapshot={
    version:1,gameTime:600,gameMode:'CLASSIC',mapName:"Summoner's Rift",receivedAt:'2026-09-11T20:00:00.000Z',
    active:{
      summonerName:'Me',riotId:'Me#EUW',championName:"Kog'Maw",team:'ORDER',level:6,position:'BOTTOM',currentGold:9999,
      stats:{currentHealth:700,maxHealth:900,currentMana:300,maxMana:500,attackDamage:100,attackSpeed:1,abilityPower:0,armor:40,magicResist:30,moveSpeed:330},
    },
    players:[
      {
        summonerName:'Me',riotId:'Me#EUW',championName:"Kog'Maw",team:'ORDER',level:6,position:'BOTTOM',isDead:false,respawnTimer:0,
        itemGold:1700,items:[{itemId:3006,displayName:"Berserker's Greaves",count:1,price:1100},{itemId:1042,displayName:'Dagger',count:2,price:300}],
        scores:{kills:1,deaths:0,assists:2,creepScore:70,wardScore:4},
      },
      {
        summonerName:'Enemy',riotId:'Enemy#EUW',championName:'Caitlyn',team:'CHAOS',level:5,position:'BOTTOM',isDead:false,respawnTimer:0,
        itemGold:1000,items:[{itemId:1038,displayName:'B. F. Sword',count:1,price:1000}],
        scores:{kills:0,deaths:1,assists:1,creepScore:62,wardScore:3},
      },
    ],events:[],
  };
  return {...base,...over,active:{...base.active,...(over.active??{})},players:over.players??base.players,events:over.events??base.events};
}

test('normalises Riot allgamedata into compact player and visible-item snapshots',()=>{
  const raw={
    gameData:{gameTime:123.4,gameMode:'CLASSIC',mapName:"Summoner's Rift"},
    activePlayer:{
      summonerName:'Me',riotId:'Me#EUW',level:4,currentGold:725,
      championStats:{currentHealth:500,maxHealth:800,attackDamage:81,attackSpeed:.72,armor:35,magicResist:30,moveSpeed:325},
    },
    allPlayers:[
      {summonerName:'Me',riotId:'Me#EUW',championName:'Vayne',team:'ORDER',level:4,position:'BOTTOM',isDead:false,respawnTimer:0,items:[{itemID:1042,displayName:'Dagger',count:1,price:300}],scores:{kills:0,deaths:0,assists:0,creepScore:28,wardScore:1}},
      {summonerName:'Enemy',riotId:'Enemy#EUW',championName:'Ashe',team:'CHAOS',level:4,position:'BOTTOM',isDead:false,respawnTimer:0,items:[{itemID:1036,displayName:'Long Sword',count:2,price:350}],scores:{kills:0,deaths:0,assists:0,creepScore:30,wardScore:1}},
    ],
    events:{Events:[{EventID:2,EventName:'ChampionKill',EventTime:100,KillerName:'Me',VictimName:'Enemy'}]},
  };
  const result=normalizeLiveClientData(raw,'2026-09-11T20:00:00.000Z');
  assert.ok(result);
  assert.equal(result?.gameTime,123.4);
  assert.equal(result?.active.championName,'Vayne');
  assert.equal(result?.active.team,'ORDER');
  assert.equal(result?.players[0].itemGold,300);
  assert.equal(result?.players[1].itemGold,700);
  assert.equal(result?.events[0].name,'ChampionKill');
  assert.equal(result?.events[0].target,'Enemy');
});

test('strength comparison prefers the Riot-exposed same-position enemy',()=>{
  const extra={
    summonerName:'Enemy Mid',riotId:'Mid#EUW',championName:'Ahri',team:'CHAOS' as const,level:10,position:'MIDDLE',isDead:false,respawnTimer:0,itemGold:5000,items:[],
    scores:{kills:5,deaths:0,assists:2,creepScore:100,wardScore:4},
  };
  const s=snapshot({players:[...snapshot().players,extra]});
  const point=strengthPoint(s);
  assert.equal(point.opponent,'Caitlyn');
  assert.match(point.comparisonReason,/matched by Riot-exposed position/i);
  assert.equal(point.verdict,'YOU_STRONGER');
});

test('unspent current gold does not inflate the deterministic strength score',()=>{
  const rich=snapshot({active:{...snapshot().active,currentGold:99999}});
  const poor=snapshot({active:{...snapshot().active,currentGold:0}});
  assert.equal(strengthPoint(rich).score,strengthPoint(poor).score);
});

test('visible level and item advantages can flip who is stronger',()=>{
  const ahead=strengthPoint(snapshot());
  assert.equal(ahead.verdict,'YOU_STRONGER');

  const base=snapshot();
  const enemyAhead={...base.players[1],level:8,itemGold:3300};
  const behind=strengthPoint(snapshot({players:[base.players[0],enemyAhead]}));
  assert.equal(behind.verdict,'THEM_STRONGER');
  assert.ok(behind.score<0);
});

test('death and respawn state creates a temporary visible power window',()=>{
  const base=snapshot();
  const deadEnemy={...base.players[1],isDead:true,respawnTimer:18};
  const point=strengthPoint(snapshot({players:[base.players[0],deadEnemy]}));
  assert.equal(point.verdict,'YOU_STRONGER');
  assert.ok(point.reasons.some(reason=>/18s respawn/i.test(reason)));
});

test('post-game timeline keeps meaningful power swings instead of every five-second sample',()=>{
  const a=snapshot({gameTime:300});
  const b=snapshot({gameTime:305});
  const cBase=snapshot({gameTime:480});
  const c=snapshot({gameTime:480,players:[cBase.players[0],{...cBase.players[1],level:8,itemGold:3500}]});
  const dBase=snapshot({gameTime:650});
  const d=snapshot({gameTime:650,players:[{...dBase.players[0],level:9,itemGold:4800},{...dBase.players[1],level:8,itemGold:3500}]});
  const timeline=buildStrengthTimeline([a,b,c,d]);
  assert.ok(timeline.points.length<4,'near-identical snapshots should be collapsed');
  assert.ok(timeline.points.some(point=>point.verdict==='THEM_STRONGER'));
  assert.equal(timeline.strongestWindow?.atSeconds,650);
  assert.equal(timeline.weakestWindow?.atSeconds,480);
  assert.match(timeline.modelNote,/does not infer hidden enemy cooldowns/i);
});

test('malformed local payload fails closed rather than inventing a snapshot',()=>{
  for(const value of [null,undefined,'bad',42])assert.equal(normalizeLiveClientData(value),null);
});
