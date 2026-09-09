import test from 'node:test';
import assert from 'node:assert/strict';
import {keyMoments,turningPoints,CONSEQUENCE_WINDOW_MS} from '../lib/riot/keyMoments';
import {RiotMatchDto,RiotTimelineDto,RiotTimelineEvent} from '../lib/riot/riotTypes';

const ME='puuid-me';

const match=():RiotMatchDto=>({
  metadata:{matchId:'EUW1_T',participants:[]},
  info:{
    gameEndTimestamp:1,gameDuration:2000,
    participants:[
      {puuid:ME,participantId:1,championName:"Kog'Maw",teamId:100,win:false,kills:3,deaths:6,assists:4},
      {puuid:'a2',participantId:2,championName:'Leona',teamId:100,win:false,kills:1,deaths:5,assists:6},
      {puuid:'e6',participantId:6,championName:'Caitlyn',teamId:200,win:true,kills:9,deaths:2,assists:7},
    ],
  },
});

const timeline=(events:RiotTimelineEvent[]):RiotTimelineDto=>({
  metadata:{matchId:'EUW1_T',participants:[]},
  info:{frames:[{timestamp:0,participantFrames:{},events}]},
});

const myDeath=(ms:number,assists:number[]=[7,8])=>
  ({type:'CHAMPION_KILL',timestamp:ms,victimId:1,killerId:6,assistingParticipantIds:assists});
const enemyBaron=(ms:number)=>
  ({type:'ELITE_MONSTER_KILL',timestamp:ms,killerId:6,monsterType:'BARON_NASHOR'});
const ourDragon=(ms:number,killer=2)=>
  ({type:'ELITE_MONSTER_KILL',timestamp:ms,killerId:killer,monsterType:'DRAGON',monsterSubType:'FIRE_DRAGON',assistingParticipantIds:[1]});

test('links a death to the objective it cost, with the delay',()=>{
  const m=keyMoments(match(),timeline([myDeath(1_334_000),enemyBaron(1_371_000)]),ME);
  const death=m.find(x=>x.type==='DEATH')!;
  assert.equal(death.clock,'22:14');
  assert.equal(death.severity,'HIGH');
  assert.match(death.cost!,/Baron went to the enemy 37s later/);
});

test('does not blame a death for an objective outside the window',()=>{
  const late=1_334_000+CONSEQUENCE_WINDOW_MS+1000;
  const m=keyMoments(match(),timeline([myDeath(1_334_000),enemyBaron(late)]),ME);
  const death=m.find(x=>x.type==='DEATH')!;
  assert.equal(death.cost,undefined,'a minute later is not a consequence');
  assert.notEqual(death.severity,'HIGH');
});

test('never blames a death for an objective your own team took',()=>{
  const m=keyMoments(match(),timeline([myDeath(600_000),ourDragon(610_000)]),ME);
  assert.equal(m.find(x=>x.type==='DEATH')!.cost,undefined);
});

test('distinguishes a solo death from being collapsed on',()=>{
  const solo=keyMoments(match(),timeline([myDeath(300_000,[])]),ME);
  assert.match(solo[0].text,/no one else involved/);
  const collapsed=keyMoments(match(),timeline([myDeath(300_000,[7,8,9])]),ME);
  assert.match(collapsed[0].text,/4 of them/);
});

test('says whether you were there for your own objectives',()=>{
  const withMe=keyMoments(match(),timeline([ourDragon(500_000)]),ME);
  assert.match(withMe[0].text,/you were there/i);
  const withoutMe=keyMoments(match(),timeline([
    {type:'ELITE_MONSTER_KILL',timestamp:500_000,killerId:2,monsterType:'DRAGON',assistingParticipantIds:[]},
  ]),ME);
  assert.match(withoutMe[0].text,/without you/i);
});

test('names the dragon type when Riot supplies it',()=>{
  const m=keyMoments(match(),timeline([ourDragon(500_000)]),ME);
  assert.match(m[0].text,/fire dragon/);
});

test('a tower kill on your own team is a tower you lost',()=>{
  const m=keyMoments(match(),timeline([
    {type:'BUILDING_KILL',timestamp:700_000,teamId:100,towerType:'OUTER_TURRET',laneType:'MID_LANE'},
    {type:'BUILDING_KILL',timestamp:800_000,teamId:200,towerType:'OUTER_TURRET',laneType:'BOT_LANE'},
  ]),ME);
  const lost=m.filter(x=>x.type==='TOWER_LOST');
  assert.equal(lost.length,1,'only the building our team owned counts as lost');
  assert.match(lost[0].text,/outer turret mid/);
});

test('orders every moment by time',()=>{
  const m=keyMoments(match(),timeline([
    enemyBaron(1_400_000),myDeath(300_000),ourDragon(900_000),
  ]),ME);
  assert.deepEqual(m.map(x=>x.atMs),[300_000,900_000,1_400_000]);
});

test('turning points surface the costly moments, not every death',()=>{
  const m=keyMoments(match(),timeline([
    myDeath(120_000,[]),               // early, no consequence -> LOW
    myDeath(1_334_000),enemyBaron(1_371_000),  // HIGH
    myDeath(1_250_000,[]),             // post-20 -> MEDIUM
  ]),ME);
  const top=turningPoints(m);
  assert.equal(top[0].severity,'HIGH','the costly one leads');
  assert.ok(!top.some(x=>x.severity==='LOW'),'an early death with no cost is not a turning point');
});

test('throws if the player is not in the match',()=>{
  assert.throws(()=>keyMoments(match(),timeline([]),'nobody'),/not in match/);
});

test('an empty timeline produces no moments rather than crashing',()=>{
  assert.deepEqual(keyMoments(match(),timeline([]),ME),[]);
  assert.deepEqual(turningPoints([]),[]);
});

/* --- grouping and prioritisation, added after running on real matches --- */

const grub=(ms:number,killer=6)=>
  ({type:'ELITE_MONSTER_KILL',timestamp:ms,killerId:killer,monsterType:'HORDE'});

test('folds a burst of Voidgrubs into one moment with a count',()=>{
  // Real games fire three separate HORDE kills seconds apart. Listed
  // individually they drowned out everything actionable.
  const m=keyMoments(match(),timeline([grub(519_000),grub(532_000),grub(538_000)]),ME);
  const objectives=m.filter(x=>x.type==='OBJECTIVE_LOST');
  assert.equal(objectives.length,1,'three grubs are one moment');
  assert.equal(objectives[0].count,3);
  assert.match(objectives[0].text,/3× Voidgrubs/);
});

test('does not fold objectives that are far apart or different',()=>{
  const far=keyMoments(match(),timeline([grub(100_000),grub(400_000)]),ME);
  assert.equal(far.filter(x=>x.type==='OBJECTIVE_LOST').length,2,'five minutes apart is not one event');

  const mixed=keyMoments(match(),timeline([grub(100_000),enemyBaron(110_000)]),ME);
  assert.equal(mixed.length,2,'grubs and Baron are different objectives');
});

test('does not fold objectives taken by opposing teams',()=>{
  const m=keyMoments(match(),timeline([grub(100_000,6),grub(110_000,2)]),ME);
  assert.equal(m.length,2,'one is theirs, one is ours');
  assert.equal(m[0].type,'OBJECTIVE_LOST');
  assert.equal(m[1].type,'OBJECTIVE_TAKEN');
});

test('an objective the enemy took while you were elsewhere is context, not a turning point',()=>{
  const m=keyMoments(match(),timeline([
    grub(519_000),grub(532_000),enemyBaron(900_000),
    myDeath(1_334_000),enemyBaron(1_360_000),
  ]),ME);
  const top=turningPoints(m);
  assert.equal(top.length,1,'only the death that caused something is actionable');
  assert.equal(top[0].type,'DEATH');
  assert.match(top[0].cost!,/Baron/);
});
