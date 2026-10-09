import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectHabits,analyseHabits,clock,HabitInput,HabitCounts,GOLD_AT_DEATH,HOARD_GOLD,MAX_MOMENTS_PER_GAME} from '../lib/habits/detect';
import {HABITS} from '../lib/habits/library';
import {groupMoments} from '../lib/habits/moments';
import {buildDNA,dnaHistory,stageFor,dnaHeadline} from '../lib/dna/dna';
import {GameRecord,careerFor,mergeRecords,MAX_CAREER_GAMES} from '../lib/dna/career';
import {habitDomain,habitOfTask,scoreHabitGame} from '../lib/dna/plan';
import {adaptILP} from '../lib/ilpEngine';
import {ensureOneMissionPerDnaStrand,gradeDnaStrandMissionsFromHistory,isDnaStrandMission,startHabitStrandMission} from '../lib/dnaStrandMissions';
import {gradeMissionGame} from '../lib/missionGrading';
import {verifiedMissionRep} from '../lib/verifiedMissionProof';
import {plainLanguageFocus} from '../lib/plainLanguageCoaching';
import {DNA_DOMAINS} from '../lib/dnaDomain';
import {priceLeak} from '../lib/costOfLeak';
import {mapRiotMatch} from '../lib/riot/mapMatch';
import {RiotTimelineEvent} from '../lib/riot/riotTypes';
import {ILPTask,Match} from '../lib/types';

const ME=1,ALLY=2,ENEMY=6;
const teamOf={1:100,2:100,3:100,4:100,5:100,6:200,7:200,8:200,9:200,10:200};
const death=(min:number,opts:Partial<RiotTimelineEvent>={}):RiotTimelineEvent=>
  ({type:'CHAMPION_KILL',timestamp:min*60_000,victimId:ME,killerId:ENEMY,assistingParticipantIds:[7],position:{x:5000,y:5000},...opts});
const objective=(min:number,team:number):RiotTimelineEvent=>
  ({type:'ELITE_MONSTER_KILL',timestamp:min*60_000,killerTeamId:team,killerId:team===100?ALLY:ENEMY,monsterType:'DRAGON'});
const gold=(values:number[])=>values.map((g,i)=>({t:i*60_000,gold:g}));
function input(over:Partial<HabitInput>={},events:RiotTimelineEvent[]=[],goldSeries=gold(new Array(30).fill(300))):HabitInput{
  return {role:'ADC',teamId:100,participantId:ME,durationSeconds:30*60,controlWardsBought:2,
    laneCsPerMin:7,post15CsPerMin:6.5,timeline:{events,gold:goldSeries,teamOf},...over};
}

/* ============================ detectors ============================ */

test('a clean game counts zero for every habit it can measure',()=>{
  const h=detectHabits(input());
  for(const id of ['deathWithGold','hoardingGold','deathBeforeObjective','backToBackDeaths','deepDeath','soloDeath','earlyDeaths','noControlWard','lateFarmDrop'] as const)
    assert.equal(h[id],0,id);
});

test('without a timeline, timeline habits are absent — never zero',()=>{
  const h=detectHabits(input({timeline:undefined}));
  assert.equal(h.soloDeath,undefined);
  assert.equal(h.deathWithGold,undefined);
  assert.equal(h.noControlWard,0,'summary-based habits still measured');
});

test('dying with unspent gold uses the gold held before the death',()=>{
  const g=new Array(30).fill(300);g[12]=GOLD_AT_DEATH+100;
  assert.equal(detectHabits(input({},[death(12.5),death(20)],gold(g))).deathWithGold,1);
});

test('sitting on gold counts episodes of two-plus minutes, not minutes',()=>{
  const g=new Array(30).fill(300);
  g[8]=g[9]=g[10]=HOARD_GOLD+50;   // one 3-minute episode
  g[15]=HOARD_GOLD+50;             // one minute only — not an episode
  g[20]=g[21]=HOARD_GOLD+10;       // second episode
  assert.equal(detectHabits(input({},[],gold(g))).hoardingGold,2);
});

test('only deaths before an ENEMY objective count',()=>{
  const h=detectHabits(input({},[death(10),objective(11,200),death(20),objective(21,100),death(25)]));
  assert.equal(h.deathBeforeObjective,1,'death before our own dragon is not the habit');
});

test('back-to-back deaths',()=>{
  assert.equal(detectHabits(input({},[death(10),death(12),death(20)])).backToBackDeaths,1);
});

test('deep deaths depend on which side you play',()=>{
  const deepForBlue={x:12000,y:12000},deepForRed={x:2500,y:2500},river={x:7400,y:7500};
  const ev=[death(8,{position:deepForBlue}),death(12,{position:river}),death(15,{position:deepForRed}),death(28,{position:deepForBlue})];
  assert.equal(detectHabits(input({teamId:100},ev)).deepDeath,1,'blue: one deep death before 25:00');
  assert.equal(detectHabits(input({teamId:200},ev)).deepDeath,1,'red: the mirror image');
});

test('solo deaths and early deaths',()=>{
  const h=detectHabits(input({},[death(4,{assistingParticipantIds:[]}),death(8),death(22,{assistingParticipantIds:[]})]));
  assert.equal(h.soloDeath,2);
  assert.equal(h.earlyDeaths,2);
});

test('no control wards only judged in games of 20+ minutes',()=>{
  assert.equal(detectHabits(input({controlWardsBought:0})).noControlWard,1);
  assert.equal(detectHabits(input({controlWardsBought:0,durationSeconds:17*60})).noControlWard,undefined);
});

test('a support is never judged on farm',()=>{
  assert.equal(detectHabits(input({role:'SUPPORT',laneCsPerMin:1,post15CsPerMin:0.2})).lateFarmDrop,undefined);
  assert.equal(detectHabits(input({post15CsPerMin:4})).lateFarmDrop,1,'an ADC is');
});

/* ======================= wired into Riot sync ======================= */

function riotGame(over:{remake?:boolean;minutes?:number}={}){
  const minutes=over.minutes??30;
  const participants=[1,2,3,4,5,6,7,8,9,10].map(id=>({
    puuid:`p${id}`,participantId:id,championName:`C${id}`,teamId:id<=5?100:200,
    teamPosition:['TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY'][(id-1)%5],win:id<=5,kills:1,deaths:1,assists:1,
    totalMinionsKilled:150,neutralMinionsKilled:0,visionWardsBoughtInGame:0,gameEndedInEarlySurrender:!!over.remake,
  }));
  const frames=Array.from({length:minutes+1},(_,i)=>({timestamp:i*60_000,
    participantFrames:Object.fromEntries(participants.map(p=>[String(p.participantId),{minionsKilled:i*6,currentGold:400,totalGold:500*i}])),
    events:i===5?[{type:'CHAMPION_KILL',timestamp:5*60_000+1,victimId:4,killerId:9,assistingParticipantIds:[],position:{x:3000,y:3000}}]:[]}));
  return mapRiotMatch(
    {metadata:{matchId:'EUW1_9',participants:participants.map(p=>p.puuid)},
      info:{gameEndTimestamp:1,gameDuration:minutes*60,gameVersion:'15.18.1',participants}} as any,
    {metadata:{matchId:'EUW1_9',participants:[]},info:{frames}} as any,
    'p4',{riotAccountId:'acct-you'}).match;
}

test('every synced game carries its habit fingerprint and moments',()=>{
  const m=riotGame();
  assert.equal(m.habitRelevant,true);
  assert.equal(m.habits?.soloDeath,1);
  assert.equal(m.habits?.noControlWard,1);
  assert.equal(m.habitMoments?.filter(x=>x.h==='soloDeath').length,1);
  assert.equal(m.patchSource,'MATCH_V5','existing patch stamping is untouched');
});

test('remakes are kept but never read for habits',()=>{
  const m=riotGame({remake:true,minutes:4});
  assert.equal(m.habitRelevant,false);
  assert.deepEqual(m.habits,{});
});

/* ============================ moments ============================ */

const kill=(min:number,o:Partial<RiotTimelineEvent>={}):RiotTimelineEvent=>({type:'CHAMPION_KILL',timestamp:min*60_000,victimId:1,killerId:6,assistingParticipantIds:[],position:{x:12000,y:12000},...o});
function moments(){
  const g=Array.from({length:30},(_,i)=>({t:i*60_000,gold:i===12?1460:(i>=18&&i<=20?1600:300)}));
  return analyseHabits({role:'ADC',teamId:100,participantId:1,durationSeconds:1800,controlWardsBought:1,laneCsPerMin:7,post15CsPerMin:6,
    timeline:{events:[kill(12.4),{type:'ELITE_MONSTER_KILL',timestamp:12.9*60_000,killerTeamId:200,monsterType:'DRAGON',monsterSubType:'FIRE_DRAGON'},kill(13.9)],
      gold:g,teamOf:{1:100,6:200},championOf:{6:'Zed'}}});
}

test('every habit count comes with the moments behind it',()=>{
  const r=moments();
  assert.equal(r.counts.soloDeath,2);
  assert.equal(r.moments.filter(m=>m.h==='soloDeath').length,2);
  assert.equal(r.moments.filter(m=>m.h==='deathWithGold').length,r.counts.deathWithGold);
  assert.equal(r.moments.filter(m=>m.h==='deathBeforeObjective').length,r.counts.deathBeforeObjective);
});

test('moments say what happened, when, and who did it',()=>{
  const d=moments().moments.map(m=>`${clock(m.t)} ${m.d}`);
  assert.ok(d.includes('12:24 Killed by Zed 30s before the enemy took Fire Dragon.'),d.join('\n'));
  assert.ok(d.includes('12:24 Killed by Zed holding 1,450+ gold.'));
  assert.ok(d.includes('13:54 Died again 1:30 after your death at 12:24.'));
  assert.ok(d.includes('18:00 Held 1,500+ gold from 18:00 to 21:00 without spending it.'));
});

test('moments at the same second become one replay stop, in game order',()=>{
  const groups=groupMoments(moments().moments);
  assert.ok(groups.find(g=>clock(g.t)==='12:24')!.items.length>=3);
  assert.deepEqual(groups.map(g=>g.t),[...groups.map(g=>g.t)].sort((a,b)=>a-b));
});

test('moments are capped per game',()=>{
  const events=Array.from({length:40},(_,i)=>kill(3+i*0.5));
  assert.ok(analyseHabits({role:'ADC',teamId:100,participantId:1,durationSeconds:3000,timeline:{events,gold:[],teamOf:{1:100,6:200}}}).moments.length<=MAX_MOMENTS_PER_GAME);
});

/* ============================== DNA ============================== */

let n=0;
const rec=(habits:HabitCounts,result:'WIN'|'LOSS'='WIN',relevant=true):GameRecord=>{
  n++;
  return {id:`g${n}`,at:new Date(Date.UTC(2026,0,1)+n*3_600_000).toISOString(),champion:'Jinx',role:'ADC',result,minutes:30,relevant,habits};
};
const games=(k:number,f:(i:number)=>HabitCounts,res:(i:number)=>'WIN'|'LOSS'=()=>'WIN')=>Array.from({length:k},(_,i)=>rec(f(i),res(i)));

test('stages: 3 games, then 5, then 10',()=>{
  assert.deepEqual([0,2,3,4,5,9,10,200].map(stageFor),['SCANNING','SCANNING','FIRST_READ','FIRST_READ','PATTERNS','PATTERNS','ESTABLISHED','ESTABLISHED']);
});

test('nothing is said before 3 games, and remakes do not count towards one',()=>{
  const d=buildDNA([...games(2,()=>({soloDeath:3})),rec({},'WIN',false)]);
  assert.equal(d.stage,'SCANNING');
  assert.equal(d.habits.length,0);
  assert.deepEqual(d.next,{at:3,remaining:1});
});

test('first read at 3 games: 2 of 3 is a signal, 1 of 3 is not',()=>{
  const d=buildDNA(games(3,i=>({soloDeath:i<2?1:0,deepDeath:i===0?1:0})));
  assert.deepEqual(d.habits.map(h=>[h.id,h.level]),[['soloDeath','SIGNAL']]);
});

test('patterns at 5 games need 3 of 5',()=>{
  const d=buildDNA(games(5,i=>({soloDeath:i<3?1:0,deepDeath:i<2?1:0})));
  assert.equal(d.stage,'PATTERNS');
  assert.deepEqual(d.habits.map(h=>h.id),['soloDeath']);
});

test('at 10 games the DNA reads the last 10 only',()=>{
  const d=buildDNA([...games(5,()=>({soloDeath:2})),...games(10,()=>({soloDeath:0}))]);
  assert.equal(d.stage,'ESTABLISHED');
  assert.equal(d.windowGames,10);
  assert.equal(d.habits.length,0,'old games no longer define the player');
});

test('after 10, the DNA is compared with birth DNA and broken habits are named',()=>{
  const birth=games(10,()=>({deathWithGold:1,soloDeath:0}));
  const since=games(10,i=>({deathWithGold:i===9?1:0,soloDeath:0}));
  const d=buildDNA([...birth,...since]);
  const g=d.all.find(h=>h.id==='deathWithGold')!;
  assert.equal(g.trend?.direction,'IMPROVING');
  assert.deepEqual(d.broken.map(h=>h.id),['deathWithGold']);
});

test('unmeasured games never count as clean games',()=>{
  const deep=buildDNA(games(10,i=>i<2?{deepDeath:1}:{})).all.find(h=>h.id==='deepDeath')!;
  assert.equal(deep.measured,2);
  assert.equal(deep.level,'CLEAN');
});

test('the cost of a habit is its win rate with vs without',()=>{
  const solo=buildDNA(games(10,i=>({soloDeath:i%2}),i=>i%2?'LOSS':'WIN')).all.find(h=>h.id==='soloDeath')!;
  assert.deepEqual(solo.cost,{withIt:0,withoutIt:1,gamesWith:5,gamesWithout:5});
});

test('history records the reads at 3, 5 and 10, then every game',()=>{
  assert.deepEqual(dnaHistory(games(13,()=>({soloDeath:1}))).map(s=>s.games),[3,5,10,11,12,13]);
});

test('every habit has copy for the player',()=>{
  for(const h of Object.values(HABITS))assert.ok(h.name&&h.description&&h.why&&h.rule&&h.source,h.id);
  assert.match(dnaHeadline(buildDNA([])),/after 3/);
});

/* ======================= career from stored matches ======================= */

let mid=0;
const match=(habits:HabitCounts|undefined,extra:Partial<Match>={}):Match=>({id:`EUW1_${++mid}`,riotAccountId:'you',champion:'Jinx',role:'ADC',result:'WIN',kills:1,deaths:1,assists:1,
  durationSeconds:1800,rank:'Gold',metrics:{cs:1,csPerMin:6,deaths:1},source:'riot',createdAt:new Date(Date.UTC(2026,5,1)+mid*3_600_000).toISOString(),habits,habitRelevant:true,...extra});

test('the career is the matches, oldest first, with no duplicates and a cap',()=>{
  const a=match({soloDeath:1}),b=match({soloDeath:0});
  const career=careerFor([b,a,b]);
  assert.deepEqual(career.map(r=>r.id),[a.id,b.id]);
  assert.equal(mergeRecords(Array.from({length:MAX_CAREER_GAMES+5},(_,i)=>({...career[0],id:`x${i}`,at:new Date(i*1000).toISOString()}))).length,MAX_CAREER_GAMES);
});

test('games synced before habit tracking still count for what their metrics show',()=>{
  const old=match(undefined,{habitRelevant:undefined,metrics:{cs:1,csPerMin:6,deaths:3,soloDeaths:2,deathsPre10:1}});
  const r=careerFor([old])[0];
  assert.equal(r.habits.soloDeath,2);
  assert.equal(r.habits.earlyDeaths,1);
  assert.equal(r.habits.deathWithGold,undefined,'timeline-only habits stay unmeasured');
});

/* ================= habits as Game DNA strand missions ================= */

const START=new Date(Date.UTC(2026,4,1));
const strandPlan=()=>{
  const seeded=ensureOneMissionPerDnaStrand([],'you','ADC').tasks;
  // The player's two unlocked DNA trees: Teamfights and Laning.
  return seeded.map(t=>({...t,dnaFocusUnlocked:t.dnaDomain==='TEAMFIGHTS'||t.dnaDomain==='LANING'}));
};
const liveIn=(tasks:ILPTask[],domain:string)=>tasks.filter(t=>isDnaStrandMission(t)&&t.dnaDomain===domain&&t.status!=='MASTERED'&&t.status!=='PAUSED');
const startSolo=(tasks:ILPTask[]=strandPlan())=>startHabitStrandMission(tasks,{accountId:'you',role:'ADC',habit:'soloDeath',reading:{occurred:7,measured:10,rate:0.7},now:START});
const tracked=(task:ILPTask,m:Match)=>{
  const grade=gradeMissionGame(task,m);
  return {matchId:m.id,at:m.createdAt,adherence:'TRACKED' as const,clearedBar:grade.passed,
    outcome:grade.evidenceV2.state==='BANKED'?'CONFIRMED' as const:'UNREWARDED' as const,
    banksPass:grade.evidenceV2.state==='BANKED',source:'TRACKED' as const,evidenceV2:grade.evidenceV2};
};

test('every habit lives in one of the six Game DNA strands',()=>{
  for(const id of Object.keys(HABITS) as (keyof typeof HABITS)[])assert.ok(DNA_DOMAINS.includes(habitDomain(id)),id);
  assert.equal(habitDomain('soloDeath'),'TEAMFIGHTS');
  assert.equal(habitDomain('earlyDeaths'),'LANING');
  assert.equal(habitDomain('deathWithGold'),'WAVES_CS');
  assert.equal(habitDomain('noControlWard'),'VISION_MAP');
  assert.equal(habitDomain('deathBeforeObjective'),'OBJECTIVES');
  assert.equal(habitDomain('backToBackDeaths'),'CONSISTENCY');
});

test('making a habit the mission pauses the strand mission and keeps the unlocked tree',()=>{
  const plan=strandPlan();
  const before=liveIn(plan,'TEAMFIGHTS')[0];
  const {tasks,status,mission}=startSolo(plan);
  assert.equal(status,'STARTED');
  assert.equal(habitOfTask(mission),'soloDeath');
  assert.equal(mission.gameRule,HABITS.soloDeath.rule);
  assert.equal(mission.priority,85);
  assert.equal(mission.dnaFocusUnlocked,true,'inherits the unlocked Teamfights tree');
  assert.deepEqual(liveIn(tasks,'TEAMFIGHTS').map(t=>t.id),[mission.id]);
  assert.equal(tasks.find(t=>t.id===before.id)?.status,'PAUSED');
  assert.equal(startSolo(tasks).status,'ALREADY_ACTIVE');
  // The six-strand rules keep it as the strand's one live mission.
  const kept=ensureOneMissionPerDnaStrand(tasks,'you','ADC').tasks;
  for(const domain of DNA_DOMAINS)assert.equal(liveIn(kept,domain).length,1,domain);
  assert.equal(liveIn(kept,'TEAMFIGHTS')[0].id,mission.id);
});

test('a clean game banks a verified rep; a dirty one is a miss with its moments as proof',()=>{
  const {mission}=startSolo();
  const clean=match({soloDeath:0});
  const cleanGrade=gradeMissionGame(mission,clean);
  assert.equal(cleanGrade.evidenceV2.state,'BANKED');
  assert.equal(cleanGrade.source,'RIOT_POST_GAME');
  assert.equal(verifiedMissionRep(mission,tracked(mission,clean)),true);

  const dirty=match({soloDeath:2},{habitMoments:[{h:'soloDeath',t:420_000,d:'Killed 1v1 by Zed.'},{h:'deathWithGold',t:420_000,d:'Died holding 1,300+ gold.'}]});
  const dirtyGrade=gradeMissionGame(mission,dirty);
  assert.equal(dirtyGrade.evidenceV2.state,'MISSED');
  assert.deepEqual(dirtyGrade.evidenceV2.events,[{atSeconds:420,label:'Solo deaths',detail:'Killed 1v1 by Zed.'}]);
  assert.equal(verifiedMissionRep(mission,tracked(mission,dirty)),false);
});

test('unmeasured games and remakes never count for or against a habit',()=>{
  const {mission}=startSolo();
  assert.equal(scoreHabitGame(mission,match({})).skip,true);
  assert.equal(scoreHabitGame(mission,match({soloDeath:0},{habitRelevant:false})).skip,true);
  assert.equal(gradeMissionGame(mission,match({})).evidenceV2.state,'NOT_OBSERVED');
  assert.equal(gradeMissionGame(mission,match({soloDeath:0},{habitRelevant:false})).evidenceV2.state,'NOT_OBSERVED');
});

test('three clean games master a habit mission on the server, then the strand mission comes back',()=>{
  const {tasks,mission}=startSolo();
  const paused=tasks.find(t=>t.dnaDomain==='TEAMFIGHTS'&&t.status==='PAUSED')!;
  const played=[match({soloDeath:0}),match({soloDeath:1}),match({soloDeath:0}),match({soloDeath:0})];
  const rows=played.map(m=>({matchId:m.id,champion:m.champion,role:'ADC',createdAt:m.createdAt,analysis:{metrics:{}} as any}));
  const graded=gradeDnaStrandMissionsFromHistory(tasks,rows,new Map(played.map(m=>[m.id,m])));
  const done=graded.tasks.find(t=>t.id===mission.id)!;
  assert.equal(done.status,'MASTERED');
  assert.equal(done.successfulGames,3);
  assert.ok(graded.changes.some(c=>c.includes('Teamfights mastered')));
  const next=ensureOneMissionPerDnaStrand(graded.tasks,'you','ADC').tasks;
  assert.deepEqual(liveIn(next,'TEAMFIGHTS').map(t=>t.id),[paused.id]);
});

test('without habit data the server leaves a habit mission not observed',()=>{
  const {tasks,mission}=startSolo();
  const m=match({soloDeath:0});
  const graded=gradeDnaStrandMissionsFromHistory(tasks,[{matchId:m.id,champion:m.champion,role:'ADC',createdAt:m.createdAt,analysis:{metrics:{}} as any}]);
  const attempt=graded.tasks.find(t=>t.id===mission.id)!.missionHistory!.at(-1)!;
  assert.equal(attempt.evidenceV2?.state,'NOT_OBSERVED');
  assert.equal(attempt.banksPass,false);
});

test('the client plan engine only grades games played after the habit mission started',()=>{
  const {mission}=startSolo();
  const before=match({soloDeath:0},{createdAt:new Date(Date.UTC(2026,3,1)).toISOString()});
  const after=[match({soloDeath:0}),match({soloDeath:0}),match({soloDeath:0})].reverse();
  const {tasks}=adaptILP([mission],[...after,before]);
  assert.equal(tasks[0].successfulGames,3);
  assert.equal(tasks[0].status,'MASTERED');
  assert.ok(!tasks[0].missionHistory!.some(a=>a.matchId===before.id));
});

test('habit missions read in their own plain language',()=>{
  const {mission}=startSolo();
  const plain=plainLanguageFocus(mission);
  assert.equal(plain.name,'BREAK IT: SOLO DEATHS');
  assert.equal(plain.nextGame,HABITS.soloDeath.rule);
});

test('habit missions get a real cost on the plan page',()=>{
  const list=Array.from({length:16},(_,i)=>match({soloDeath:i%2},{result:i%2?'LOSS':'WIN'}));
  const p=priceLeak(list,'habit:soloDeath');
  assert.equal(p.status,'READY');
  assert.equal(p.gapPoints,100);
  assert.equal(p.bar,'a clean game');
  assert.match(p.fact,/without solo deaths/);
});
