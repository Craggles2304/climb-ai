import test from 'node:test';
import assert from 'node:assert/strict';
import type {ILPMissionAttempt,ILPTask,Match} from '../lib/types';
import {agoLabel,attemptState,climbJourney,mainChampion,matchRowViews,missionView,parseRank,percentOf,recentForm,strandViews} from '../lib/dashboard/model';
import {championAssetId,championDisplayName,championTile} from '../lib/championArt';
import {buildDNA} from '../lib/dna/dna';
import {careerFor} from '../lib/dna/career';

const NOW=Date.parse('2026-10-09T18:00:00.000Z');

function match(id:string,overrides:Partial<Match>={}):Match{
  return{
    id,riotAccountId:'acct',champion:'Aphelios',role:'ADC',result:'WIN',kills:6,deaths:3,assists:9,
    durationSeconds:1860,rank:'GOLD IV',source:'riot',createdAt:'2026-10-09T16:00:00.000Z',
    metrics:{cs:200,csPerMin:6.4,deaths:3,killParticipation:.58,visionScore:21},
    ...overrides,
  } as Match;
}

const receipt=(metric:string,state:'BANKED'|'MISSED'|'NOT_OBSERVED'='BANKED')=>({
  version:2 as const,state,measurementSource:'DECISION_EVIDENCE' as const,metric,metricLabel:'Fight decision',
  observedValue:state==='BANKED'?90:40,observedValueLabel:state==='BANKED'?'90/100':'40/100',targetLabel:'85+',confidence:'HIGH' as const,
  opportunities:1,successes:state==='BANKED'?1:0,misses:state==='BANKED'?0:1,
  events:[{atSeconds:900,label:'Fight decision',detail:'Held the fight at 15:00'}],
  reconstruction:{kind:'PRO_METRIC' as const,fields:['proAnalysis:live'],formula:'90 >= 85'},reason:'Graded after the match.',
});
const attempt=(matchId:string,metric:string,state:'BANKED'|'MISSED'|'NOT_OBSERVED',at='2026-10-09T16:40:00.000Z'):ILPMissionAttempt=>({
  matchId,at,source:'TRACKED',adherence:'TRACKED',
  outcome:state==='BANKED'?'CONFIRMED':'UNEARNED',clearedBar:state==='BANKED',banksPass:state==='BANKED',
  evidenceV2:receipt(metric,state),
});
function task(overrides:Partial<ILPTask>&{id:string;metric:string}):ILPTask{
  return{
    accountId:'acct',title:'Stop accepting red-state fights',dnaDomain:'TEAMFIGHTS',category:'TEAMFIGHTING',
    why:'',gameRule:'Before committing, check the numbers.',target:'85+',progress:0,status:'ACTIVE',source:'SYSTEM',evidence:[],
    roleScope:'ADC',masteryRequired:3,
    ...overrides,
  } as ILPTask;
}

test('rank labels parse into tier, division and LP without guessing',()=>{
  assert.deepEqual(parseRank('GOLD IV · 38 LP'),{tier:'GOLD',division:'IV',lp:38,label:'Gold IV',ranked:true});
  assert.deepEqual(parseRank('Platinum IV · 12 LP'),{tier:'PLATINUM',division:'IV',lp:12,label:'Platinum IV',ranked:true});
  assert.equal(parseRank('GRANDMASTER · 410 LP').tier,'GRANDMASTER');
  assert.equal(parseRank('GRANDMASTER · 410 LP').division,null);
  assert.equal(parseRank('MASTER').lp,null);
  assert.equal(parseRank('UNRANKED').ranked,false);
  assert.equal(parseRank('').ranked,false);
  assert.equal(parseRank(undefined).label,'Unranked');
});

test('recent form averages only what was measured',()=>{
  const games=[
    match('a',{result:'WIN',kills:10,deaths:2,assists:8}),
    match('b',{result:'LOSS',kills:2,deaths:6,assists:4,metrics:{cs:0,csPerMin:0,deaths:6}}),
    match('c',{result:'WIN',kills:6,deaths:4,assists:6,metrics:{cs:180,csPerMin:6,deaths:4}}),
  ];
  const form=recentForm(games,10);
  assert.equal(form.games,3);
  assert.equal(form.wins,2);
  assert.equal(form.winRate,67);
  assert.deepEqual(form.results,['WIN','LOSS','WIN']);
  // The zero CS/min game is unknown, not a 0.0 average contribution.
  assert.equal(form.csPerMin,6.2);
  assert.equal(form.kills,6);
  assert.equal(recentForm([]).winRate,null);
  assert.equal(recentForm([]).csPerMin,null);
});

test('main champion comes from tracked games before declarations',()=>{
  const games=[match('1',{champion:'MonkeyKing'}),match('2',{champion:'Wukong'}),match('3',{champion:'Jinx'})];
  assert.deepEqual(mainChampion(games,['Jinx']),{name:'Wukong',games:2,sample:3,source:'TRACKED'});
  assert.deepEqual(mainChampion([match('1',{champion:'Jinx'})],['Aphelios']),{name:'Aphelios',games:0,sample:1,source:'DECLARED'});
  assert.equal(mainChampion([],[]),null);
});

test('champion names resolve both Riot ids and display names',()=>{
  assert.equal(championAssetId("Kha'Zix"),'Khazix');
  assert.equal(championAssetId('Khazix'),'Khazix');
  assert.equal(championAssetId("Kog'Maw"),'KogMaw');
  assert.equal(championDisplayName('MonkeyKing'),'Wukong');
  assert.equal(championDisplayName('MissFortune'),'Miss Fortune');
  assert.equal(championDisplayName("Kai'Sa"),"Kai'Sa");
  assert.equal(championTile('Unknown'),'');
});

test('mission progress counts only verified receipts',()=>{
  const metric='red_state_fights';
  const mission=task({id:'dna-strand-fights-1',metric,dnaFocusUnlocked:true,missionHistory:[
    attempt('m1',metric,'BANKED','2026-10-09T10:00:00.000Z'),
    attempt('m2',metric,'MISSED','2026-10-09T12:00:00.000Z'),
    attempt('m3',metric,'NOT_OBSERVED','2026-10-09T14:00:00.000Z'),
  ]});
  const view=missionView(mission);
  assert.equal(view.confirmed,1);
  assert.equal(view.required,3);
  assert.equal(view.unlocked,true);
  assert.equal(view.latest?.state,'NOT_OBSERVED');
  assert.deepEqual(view.history.map(item=>item.state),['BANKED','MISSED','NOT_OBSERVED']);
  // A legacy pass flag without a V2 receipt is not proof.
  const legacy={...attempt('m4',metric,'BANKED'),evidenceV2:undefined};
  assert.equal(attemptState(mission,legacy),'NOT_OBSERVED');
});

test('journey stages are read from evidence, never from entering a game',()=>{
  const fresh=climbJourney({deviceLoaded:true,linked:false,online:false,baselineGames:0,role:'MID',dnaRevealed:false,missions:[],masteredCount:0});
  assert.deepEqual(fresh.map(stage=>stage.status),['CURRENT','LOCKED','LOCKED','LOCKED','LOCKED','LOCKED']);
  const baseline=climbJourney({deviceLoaded:true,linked:true,online:true,baselineGames:2,role:'MID',dnaRevealed:false,missions:[],masteredCount:0});
  assert.deepEqual(baseline.map(stage=>stage.status),['DONE','CURRENT','LOCKED','LOCKED','LOCKED','LOCKED']);
  assert.equal(baseline[1].detail,'2/3 MID baseline games');
  const metric='red_state_fights';
  const training=missionView(task({id:'dna-strand-fights-1',metric,dnaFocusUnlocked:true,missionHistory:[attempt('m1',metric,'MISSED')]}));
  const active=climbJourney({deviceLoaded:true,linked:true,online:false,baselineGames:5,role:'ADC',dnaRevealed:true,missions:[training],masteredCount:0});
  assert.deepEqual(active.map(stage=>stage.status),['DONE','DONE','DONE','DONE','CURRENT','LOCKED']);
  assert.equal(active[4].detail,'0/3 verified games');
  // Playing a game with a mission is training; it is not verification.
  assert.notEqual(active[4].status,'DONE');
});

test('the journey has exactly one current step and EVOLVE is never pre-completed',()=>{
  const metric='red_state_fights';
  const training=missionView(task({id:'dna-strand-fights-1',metric,dnaFocusUnlocked:true}));
  // Riot-synced games completed the baseline, but the Companion was never paired.
  const unpaired=climbJourney({deviceLoaded:true,linked:false,online:false,baselineGames:12,role:'ADC',dnaRevealed:true,missions:[training],masteredCount:2});
  assert.deepEqual(unpaired.map(stage=>stage.status),['CURRENT','DONE','DONE','READY','LOCKED','LOCKED']);
  assert.equal(unpaired.filter(stage=>stage.status==='CURRENT').length,1);
  // Verification needs tracked games, so it waits on the Companion.
  assert.equal(unpaired[4].detail,'Needs the Companion to verify');
  assert.equal(unpaired[5].detail,'2 missions mastered so far');
  assert.notEqual(unpaired[5].status,'DONE');
});

test('revealing the DNA is available without the Companion; training waits for the reveal',()=>{
  const metric='red_state_fights';
  const training=missionView(task({id:'dna-strand-fights-1',metric,dnaFocusUnlocked:true}));
  const ready=climbJourney({deviceLoaded:true,linked:false,online:false,baselineGames:30,role:'ADC',dnaRevealed:false,missions:[training],masteredCount:0});
  assert.deepEqual(ready.map(stage=>stage.status),['CURRENT','DONE','READY','LOCKED','LOCKED','LOCKED']);
  assert.equal(ready[2].detail,'Your DNA is ready');
});

test('Game DNA stays neutral until the role baseline is complete',()=>{
  const metric='red_state_fights';
  const tasks=[task({id:'dna-strand-fights-1',metric,dnaFocusUnlocked:true,missionHistory:[attempt('m1',metric,'BANKED')]})];
  const neutral=strandViews({tasks,role:'ADC',baselineReady:false,dna:null,allHabits:true});
  assert.equal(neutral.length,6);
  assert.ok(neutral.every(strand=>strand.neutral&&strand.mission===null&&strand.level===1&&strand.levelProgress===0));
  const live=strandViews({tasks,role:'ADC',baselineReady:true,dna:null,allHabits:true});
  const fights=live.find(strand=>strand.domain==='TEAMFIGHTS')!;
  assert.equal(fights.neutral,false);
  assert.equal(fights.mission?.confirmed,1);
  assert.equal(fights.mission?.state,'TRAINING');
});

test('FREE sees only the biggest Career DNA habit; other strands stay locked reads',()=>{
  const games:Match[]=Array.from({length:6},(_,index)=>match('g'+index,{
    createdAt:new Date(NOW-index*3_600_000).toISOString(),
    habitRelevant:true,
    habits:{soloDeath:2,earlyDeaths:index%2?0:2,noControlWard:1},
  }));
  const dna=buildDNA(careerFor(games));
  assert.ok(dna.habits.length>=2,'fixture should flag at least two habits');
  const free=strandViews({tasks:[],role:'ADC',baselineReady:true,dna,allHabits:false});
  const shown=free.filter(strand=>strand.habit);
  assert.equal(shown.length,1);
  assert.equal(shown[0].habit?.id,dna.habits[0].id);
  assert.ok(free.some(strand=>strand.habitLocked));
  const plus=strandViews({tasks:[],role:'ADC',baselineReady:true,dna,allHabits:true});
  assert.ok(plus.filter(strand=>strand.habit).length>=1);
  assert.equal(plus.some(strand=>strand.habitLocked),false);
});

test('match rows show measured stats and per-game mission evidence',()=>{
  const metric='red_state_fights';
  const mission=task({id:'dna-strand-fights-1',metric,dnaFocusUnlocked:true,missionHistory:[attempt('m1',metric,'BANKED'),attempt('m2',metric,'MISSED')]});
  const rows=matchRowViews([
    match('m1',{champion:'KogMaw',createdAt:'2026-10-09T17:00:00.000Z'}),
    match('m2',{result:'LOSS',kills:2,deaths:7,assists:3,metrics:{cs:0,csPerMin:0,deaths:7}}),
    match('m3'),
  ],[mission],NOW);
  assert.equal(rows[0].championName,"Kog'Maw");
  assert.equal(rows[0].championId,'KogMaw');
  assert.equal(rows[0].ago,'1h ago');
  assert.equal(rows[0].killParticipation,58);
  assert.deepEqual(rows[0].missions.map(item=>item.state),['BANKED']);
  assert.deepEqual(rows[1].missions.map(item=>item.state),['MISSED']);
  assert.equal(rows[1].csPerMin,null);
  assert.equal(rows[1].kdaRatio,0.71);
  assert.deepEqual(rows[2].missions,[]);
  assert.equal(rows[2].durationLabel,'31:00');
  assert.equal(percentOf(64),64);
  assert.equal(percentOf(undefined),null);
  assert.equal(agoLabel('not a date',NOW),'—');
});
