import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRiotMatchReconstruction} from '../lib/matchReconstruction';

const ME='me';
function dto(){
  return {
    metadata:{matchId:'EUW1-test',participants:[ME,'enemy','ally2','ally3','ally4','ally5','enemy2','enemy3','enemy4','enemy5']},
    info:{
      gameDuration:1800,
      participants:[
        {puuid:ME,participantId:1,championName:'Jinx',teamId:100,win:false,kills:2,deaths:3,assists:4},
        {puuid:'ally2',participantId:2,championName:'Lulu',teamId:100,win:false,kills:0,deaths:2,assists:6},
        {puuid:'ally3',participantId:3,championName:'Vi',teamId:100,win:false,kills:3,deaths:2,assists:4},
        {puuid:'ally4',participantId:4,championName:'Orianna',teamId:100,win:false,kills:2,deaths:2,assists:4},
        {puuid:'ally5',participantId:5,championName:'Ornn',teamId:100,win:false,kills:1,deaths:2,assists:4},
        {puuid:'enemy',participantId:6,championName:'Malphite',teamId:200,win:true,kills:4,deaths:2,assists:5},
        {puuid:'enemy2',participantId:7,championName:'KaiSa',teamId:200,win:true,kills:4,deaths:2,assists:5},
        {puuid:'enemy3',participantId:8,championName:'Nautilus',teamId:200,win:true,kills:1,deaths:2,assists:8},
        {puuid:'enemy4',participantId:9,championName:'Ahri',teamId:200,win:true,kills:3,deaths:2,assists:5},
        {puuid:'enemy5',participantId:10,championName:'LeeSin',teamId:200,win:true,kills:3,deaths:2,assists:5},
      ],
    },
  } as any;
}
function frame(timestamp:number,currentGold:number,totalGold=9000){
  const participantFrames:any={};
  for(let id=1;id<=10;id++)participantFrames[String(id)]={level:id===1?11:10,currentGold:id===1?currentGold:500,totalGold:id===1?totalGold:7000,minionsKilled:id===1?150:100,jungleMinionsKilled:0};
  return {timestamp,participantFrames,events:[]} as any;
}
function timeline(events:any[],gold=1040,totalGold=9000){
  const before=frame(1110000,gold,totalGold);
  const after=frame(1160000,gold,totalGold);
  before.events=events.filter(event=>event.timestamp<=1110000);
  after.events=events.filter(event=>event.timestamp>1110000);
  return {metadata:{matchId:'EUW1-test',participants:[]},info:{frames:[before,after]}} as any;
}

test('reconstructs a death into an enemy objective consequence with explicit evidence classes',()=>{
  const death={type:'CHAMPION_KILL',timestamp:1122000,victimId:1,killerId:6,assistingParticipantIds:[8]};
  const dragon={type:'ELITE_MONSTER_KILL',timestamp:1153000,killerId:10,killerTeamId:200,monsterType:'DRAGON',monsterSubType:'INFERNAL_DRAGON'};
  const result=buildRiotMatchReconstruction(dto(),timeline([death,dragon]),ME)!;
  const story=result.stories.find(row=>row.side==='CRITICAL'&&row.atSeconds===1122)!;
  assert.ok(story);
  assert.equal(story.behaviourLabel,'Objective Readiness');
  assert.match(story.consequence,/31s later/i);
  assert.ok(story.evidence.some(row=>row.kind==='VERIFIED'&&row.label==='Death'));
  assert.ok(story.evidence.some(row=>row.kind==='VERIFIED'&&/dragon/i.test(row.label)));
  assert.ok(story.evidence.some(row=>row.kind==='CONNECTED'));
  assert.ok(story.evidence.some(row=>row.kind==='COACHING_INFERENCE'));
});

test('does not invent an objective consequence when none was recorded',()=>{
  const death={type:'CHAMPION_KILL',timestamp:1122000,victimId:1,killerId:6,assistingParticipantIds:[]};
  const result=buildRiotMatchReconstruction(dto(),timeline([death]),ME)!;
  const story=result.stories.find(row=>row.side==='CRITICAL')!;
  assert.match(story.consequence,/No major objective or tower conversion was recorded/i);
  assert.equal(story.evidence.some(row=>row.kind==='CONNECTED'),false);
});

test('uses large unspent gold as reset-discipline evidence when no objective conversion follows',()=>{
  const death={type:'CHAMPION_KILL',timestamp:1122000,victimId:1,killerId:6,assistingParticipantIds:[]};
  const result=buildRiotMatchReconstruction(dto(),timeline([death],1450,7600),ME)!;
  const story=result.stories.find(row=>row.side==='CRITICAL')!;
  assert.equal(story.behaviourLabel,'Reset Discipline');
  assert.equal(story.dnaDomain,'WAVES_CS');
  assert.match(story.decision,/1450g/);
});

test('recognises building teamId as the destroyed owner, not the scoring team',()=>{
  const positive={type:'CHAMPION_KILL',timestamp:1122000,victimId:6,killerId:1,assistingParticipantIds:[]};
  const enemyTower={type:'BUILDING_KILL',timestamp:1150000,teamId:200,laneType:'MID_LANE',towerType:'OUTER_TURRET'};
  const result=buildRiotMatchReconstruction(dto(),timeline([positive,enemyTower]),ME)!;
  const story=result.stories.find(row=>row.side==='GOOD'&&row.atSeconds===1122)!;
  assert.ok(story);
  assert.match(story.consequence,/secured by your team/i);
  assert.ok(story.evidence.some(row=>row.kind==='CONNECTED'));
});

test('creates a positive objective-readiness story when the player directly helps secure it',()=>{
  const baron={type:'ELITE_MONSTER_KILL',timestamp:1450000,killerId:3,killerTeamId:100,assistingParticipantIds:[1,2,4],monsterType:'BARON_NASHOR'};
  const t:any={metadata:{matchId:'EUW1-test',participants:[]},info:{frames:[frame(1400000,500),{...frame(1460000,500),events:[baron]}]}};
  const result=buildRiotMatchReconstruction(dto(),t,ME)!;
  const story=result.stories.find(row=>row.title==='Present for Baron')!;
  assert.ok(story);
  assert.equal(story.side,'GOOD');
  assert.equal(story.dnaDomain,'OBJECTIVES');
  assert.equal(story.confidence,'HIGH');
});
