import test from 'node:test';
import assert from 'node:assert/strict';
import {mapRiotMatch,durationSeconds,frameAtMinute} from '../lib/riot/mapMatch';
import {RiotMatchDto,RiotTimelineDto,RiotTimelineEvent,RiotParticipant} from '../lib/riot/riotTypes';

const ME='puuid-me';
const ACCOUNT='acct-1';

function participant(id:number,teamId:number,position:string,over:Partial<RiotParticipant>={}):RiotParticipant{
  return {
    puuid:`puuid-${id}`,participantId:id,championName:`Champ${id}`,teamId,teamPosition:position,
    win:teamId===100,kills:1,deaths:1,assists:1,...over,
  };
}

function buildMatch(over:Partial<RiotMatchDto['info']>={}):RiotMatchDto{
  const participants:RiotParticipant[]=[
    participant(1,100,'BOTTOM',{
      puuid:ME,championName:"Kog'Maw",win:true,kills:7,deaths:3,assists:9,
      totalMinionsKilled:200,neutralMinionsKilled:14,goldEarned:12800,
      totalDamageDealtToChampions:28000,visionScore:18,wardsPlaced:9,visionWardsBoughtInGame:3,
      item0:3006,item1:6672,item2:3031,
      challenges:{killParticipation:0.62,teamDamagePercentage:0.28},
    }),
    participant(2,100,'UTILITY'),participant(3,100,'JUNGLE'),
    participant(4,100,'MIDDLE'),participant(5,100,'TOP'),
    participant(6,200,'BOTTOM',{championName:'Caitlyn'}),
    participant(7,200,'UTILITY'),participant(8,200,'JUNGLE'),
    participant(9,200,'MIDDLE'),participant(10,200,'TOP'),
  ];
  return {
    metadata:{matchId:'EUW1_TEST',participants:participants.map(p=>p.puuid)},
    info:{gameEndTimestamp:1_700_000_000_000,gameDuration:1920,participants,...over},
  };
}

function buildTimeline(totalMinutes=32,events:RiotTimelineEvent[]=[]):RiotTimelineDto{
  const frames=[];
  for(let m=0;m<=totalMinutes;m++){
    // ~7.3 cs/min in lane, tailing off afterwards — mirrors the leak the product hunts.
    const mine=m<=15?Math.round(m*7.33):110+Math.round((m-15)*6.12);
    const theirs=Math.round(m*7.0);
    frames.push({
      timestamp:m*60_000,
      participantFrames:{
        '1':{minionsKilled:mine,jungleMinionsKilled:0,totalGold:400*m,xp:530*m,level:Math.min(18,1+Math.floor(m*0.67))},
        '6':{minionsKilled:theirs,jungleMinionsKilled:0,totalGold:370*m,xp:517*m,level:Math.min(18,1+Math.floor(m*0.65))},
      },
      events:events.filter(e=>e.timestamp>m*60_000-60_000&&e.timestamp<=m*60_000),
    });
  }
  return {metadata:{matchId:'EUW1_TEST',participants:[]},info:{frameInterval:60_000,frames}};
}

const DEATHS:RiotTimelineEvent[]=[
  {type:'CHAMPION_KILL',timestamp:5*60_000,victimId:1,killerId:6,assistingParticipantIds:[]},
  {type:'CHAMPION_KILL',timestamp:14*60_000,victimId:1,killerId:6,assistingParticipantIds:[7,8]},
  {type:'CHAMPION_KILL',timestamp:25*60_000,victimId:1,killerId:8,assistingParticipantIds:[9]},
];
const ITEMS:RiotTimelineEvent[]=[
  {type:'ITEM_PURCHASED',timestamp:Math.round(6.5*60_000),participantId:1,itemId:3006},
  {type:'ITEM_PURCHASED',timestamp:Math.round(11.5*60_000),participantId:1,itemId:6672},
  {type:'ITEM_PURCHASED',timestamp:Math.round(22*60_000),participantId:1,itemId:3031},
  {type:'ITEM_PURCHASED',timestamp:Math.round(29.5*60_000),participantId:1,itemId:3036},
  {type:'ITEM_PURCHASED',timestamp:Math.round(12*60_000),participantId:6,itemId:6672},
];
const OBJECTIVES:RiotTimelineEvent[]=[
  {type:'ELITE_MONSTER_KILL',timestamp:12*60_000,killerId:3,assistingParticipantIds:[1],monsterType:'DRAGON'},
  {type:'ELITE_MONSTER_KILL',timestamp:19*60_000,killerId:8,assistingParticipantIds:[],monsterType:'DRAGON'},
  {type:'BUILDING_KILL',timestamp:24*60_000,killerId:4,teamId:200,assistingParticipantIds:[]},
];
const COMPLETED=new Set([6672,3031,3036]);

const ctx={riotAccountId:ACCOUNT,rank:'Gold IV',completedItemIds:COMPLETED};

test('maps identity, result and headline stats',()=>{
  const {match}=mapRiotMatch(buildMatch(),buildTimeline(),ME,ctx);
  assert.equal(match.id,'EUW1_TEST');
  assert.equal(match.riotAccountId,ACCOUNT);
  assert.equal(match.champion,"Kog'Maw");
  assert.equal(match.opponent,'Caitlyn');
  assert.equal(match.role,'ADC');
  assert.equal(match.result,'WIN');
  assert.equal(match.durationSeconds,1920);
  assert.equal(match.source,'riot');
  assert.equal(match.rank,'Gold IV');
  assert.equal(match.metrics.cs,214);
  assert.equal(match.metrics.csPerMin,6.69);
});

test('derives the lane / post-15 economy split the ILP scores on',()=>{
  const {match}=mapRiotMatch(buildMatch(),buildTimeline(),ME,ctx);
  assert.equal(match.metrics.csAt15,110);
  assert.equal(match.metrics.laneCsPerMin,7.33);
  // (214 - 110) / (32 - 15)
  assert.equal(match.metrics.post15CsPerMin,6.12);
  assert.equal(match.metrics.goldDiffAt15,450);
  assert.equal(match.metrics.xpDiffAt15,195);
});

test('buckets deaths by game phase and classifies solo vs teamfight',()=>{
  const {match}=mapRiotMatch(buildMatch(),buildTimeline(32,DEATHS),ME,ctx);
  assert.equal(match.metrics.deathsPre10,1);
  assert.equal(match.metrics.deaths10to20,1);
  assert.equal(match.metrics.deathsPost20,1);
  assert.equal(match.metrics.soloDeaths,1);
  assert.equal(match.metrics.teamfightDeaths,1);
});

test('reads completed-item timings and ignores components and other players',()=>{
  const {match}=mapRiotMatch(buildMatch(),buildTimeline(32,ITEMS),ME,ctx);
  assert.equal(match.metrics.firstItemMinute,11.5);
  assert.equal(match.metrics.secondItemMinute,22);
  assert.equal(match.metrics.thirdItemMinute,29.5);
});

test('item timings are unavailable rather than guessed without a completed-item list',()=>{
  const {match,unavailable}=mapRiotMatch(buildMatch(),buildTimeline(32,ITEMS),ME,{riotAccountId:ACCOUNT});
  assert.equal(match.metrics.firstItemMinute,undefined);
  assert.ok(unavailable.includes('firstItemMinute'));
  assert.ok(unavailable.includes('secondItemMinute'));
});

test('objective participation counts only this team objectives',()=>{
  const {match}=mapRiotMatch(buildMatch(),buildTimeline(32,OBJECTIVES),ME,ctx);
  // Two team objectives (own dragon, enemy building destroyed); involved in one.
  assert.equal(match.metrics.objectiveParticipation,0.5);
});

test('a missing timeline degrades loudly instead of silently',()=>{
  const {match,unavailable}=mapRiotMatch(buildMatch(),null,ME,ctx);
  assert.equal(match.metrics.post15CsPerMin,undefined);
  assert.equal(match.metrics.deathsPost20,undefined);
  for(const key of ['post15CsPerMin','deathsPost20','objectiveParticipation','csAt15']){
    assert.ok(unavailable.includes(key),`expected ${key} to be reported unavailable`);
  }
  // Headline stats still survive, so the match is still worth storing.
  assert.equal(match.metrics.cs,214);
  assert.equal(match.metrics.csPerMin,6.69);
});

test('a game that ends at exactly 15 minutes has no post-15 sample',()=>{
  const dto=buildMatch({gameDuration:900});
  const {match,unavailable}=mapRiotMatch(dto,buildTimeline(15),ME,ctx);
  assert.equal(match.metrics.csAt15,110);
  assert.equal(match.metrics.post15CsPerMin,undefined);
  assert.ok(unavailable.includes('post15CsPerMin'));
});

test('challenge-derived metrics are marked unavailable on old records',()=>{
  const dto=buildMatch();
  delete dto.info.participants[0].challenges;
  const {match,unavailable}=mapRiotMatch(dto,buildTimeline(),ME,ctx);
  assert.equal(match.metrics.killParticipation,undefined);
  assert.equal(match.metrics.damageShare,undefined);
  assert.ok(unavailable.includes('killParticipation'));
  assert.ok(unavailable.includes('damageShare'));
});

test('throws when the player is not in the match',()=>{
  assert.throws(()=>mapRiotMatch(buildMatch(),buildTimeline(),'puuid-nobody',ctx),/not in match/);
});

test('durationSeconds handles both the seconds and milliseconds encodings',()=>{
  assert.equal(durationSeconds({gameDuration:1920,gameEndTimestamp:1,participants:[]}),1920);
  assert.equal(durationSeconds({gameDuration:1_920_000,participants:[]}),1920);
});

test('frameAtMinute returns null when the game ended before that minute',()=>{
  const {info}=buildTimeline(12);
  assert.equal(frameAtMinute(info.frames,15),null);
  assert.equal(frameAtMinute(info.frames,10)?.timestamp,600_000);
});
