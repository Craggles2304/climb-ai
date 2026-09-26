import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptActiveFiveFromPostGameEvidence,type AdaptiveIlpMeta} from '../lib/adaptiveIlpEvidence';
import type {ILPTask} from '../lib/types';
import type {HistoryAnalysisRow,ProHistoryFix,ProLearningProfile} from '../lib/riot/proHistory';

function task(id:string,priority=50,source:ILPTask['source']='SYSTEM'):ILPTask{return{id,accountId:'acct',title:`Task ${id}`,category:'CONSISTENCY',why:'Baseline focus.',gameRule:`Rule ${id}`,metric:`metric-${id}`,target:'3 clean games',progress:10,status:'ACTIVE',source,evidence:[],priority,successfulGames:0,gamesObserved:0,masteryRequired:3,history:[]}}
function fix(over:Partial<ProHistoryFix>={}):ProHistoryFix{return{key:'CHAIN_DEATH',stage:'CONTROL',severity:'MAJOR',title:'Break the second death',gamesSeen:2,occurrences:2,why:'Recovery after a death is being lost.',rule:'After dying: collect safe resources, rebuild information, then re-enter.',mastery:'3 games with no second death inside 90 seconds.',...over}}
function profile(fixes:ProHistoryFix[],games:number,latest:string|null):ProLearningProfile{return{version:1,gamesAnalyzed:games,fingerprint:{primary:'TEST',gamesSeen:0,patternRate:0,trend:'BUILDING',sequence:[],explanation:''},metricRollups:{},fixLadder:fixes,championProfiles:{},opLeakRate:{occurrencesPerGame:0,cleanScore:100,trend:'BUILDING'},recovery:{score:null,trend:'BUILDING',availableGames:0},latestAnalysisAt:latest}}
function row(createdAt:string,key:string|null,count=1):HistoryAnalysisRow{return{champion:'Hecarim',role:'JUNGLE',createdAt,analysis:{version:1,champion:'Hecarim',role:'JUNGLE',evidenceSources:[],metrics:{},moments:[],leakSignals:key?[{key,label:key,count,severity:'MAJOR',evidence:[]}]:[],fingerprint:{primary:'TEST',sequence:[],explanation:'',confidence:'MEDIUM'},summary:{headline:'',good:[],fix:[],next:''}} as any}}
function active(tasks:ILPTask[]){return tasks.filter(t=>t.status!=='MASTERED'&&t.status!=='PAUSED')}

const g1='2026-09-01T10:00:00.000Z',g2='2026-09-02T10:00:00.000Z',g3='2026-09-03T10:00:00.000Z',g4='2026-09-04T10:00:00.000Z';

test('one unusual bad game cannot rewrite a full three-mission plan',()=>{
  const tasks=[task('a',40),task('b',50),task('c',60)];
  const one=fix({gamesSeen:1,occurrences:1,severity:'CRITICAL'});
  const result=adaptActiveFiveFromPostGameEvidence({tasks,profile:profile([one],1,g1),history:[row(g1,'CHAIN_DEATH')],accountId:'acct',role:'JUNGLE',now:g1});
  assert.equal(active(result.tasks).length,3);
  assert.equal(result.tasks.some(t=>t.id.startsWith('op-pro-chain-death')),false);
  assert.deepEqual(new Set(active(result.tasks).map(t=>t.id)),new Set(tasks.map(t=>t.id)));
});

test('repeated evidence promotes a mission and protects Coach work from replacement',()=>{
  const tasks=[task('coach',10,'COACH'),task('a',40),task('b',50)];
  const history=[row(g1,'CHAIN_DEATH'),row(g2,null),row(g3,'CHAIN_DEATH')];
  const result=adaptActiveFiveFromPostGameEvidence({tasks,profile:profile([fix()],3,g3),history,accountId:'acct',role:'JUNGLE',now:g3});
  const adaptive=result.tasks.find(t=>t.id==='op-pro-jungle-chain-death') as (ILPTask&{adaptive?:AdaptiveIlpMeta})|undefined;
  assert.ok(adaptive);
  assert.equal(adaptive?.adaptive?.recentSupportGames,2);
  assert.notEqual(result.tasks.find(t=>t.id==='coach')?.status,'PAUSED');
  assert.equal(result.tasks.find(t=>t.id==='a')?.status,'PAUSED');
  assert.equal(active(result.tasks).length,3);
});

test('another supporting game strengthens the same mission instead of duplicating it',()=>{
  const base=adaptActiveFiveFromPostGameEvidence({tasks:[task('a',40),task('b',50),task('c',60)],profile:profile([fix()],3,g3),history:[row(g1,'CHAIN_DEATH'),row(g2,null),row(g3,'CHAIN_DEATH')],accountId:'acct',role:'JUNGLE',now:g3});
  const nextFix=fix({gamesSeen:3,occurrences:3,severity:'CRITICAL'});
  const next=adaptActiveFiveFromPostGameEvidence({tasks:base.tasks,profile:profile([nextFix],4,g4),history:[row(g1,'CHAIN_DEATH'),row(g2,null),row(g3,'CHAIN_DEATH'),row(g4,'CHAIN_DEATH')],accountId:'acct',role:'JUNGLE',now:g4});
  const adaptive=next.tasks.filter(t=>(t as ILPTask&{adaptive?:AdaptiveIlpMeta}).adaptive?.patternKey==='CHAIN_DEATH');
  assert.equal(adaptive.length,1);
  assert.equal((adaptive[0] as ILPTask&{adaptive?:AdaptiveIlpMeta}).adaptive?.lastAction,'STRENGTHENED');
  assert.equal(active(next.tasks).length,3);
});

test('three clean games master the mission without inventing a replacement',()=>{
  const adaptive:ILPTask&{adaptive:AdaptiveIlpMeta}={...task('op-pro-chain-death',96),title:'Break the second death',why:'Recovery leak.',gameRule:'Reset safely after death.',metric:'OP PRO Fix Ladder',target:'3 clean games',status:'EVIDENCE_BUILDING',adaptive:{version:1,managedBy:'POST_GAME_EVIDENCE',patternKey:'CHAIN_DEATH',confidence:80,recentSupportGames:2,recentWindow:3,recentOccurrences:2,totalSupportGames:2,cleanStreak:0,activatedAfter:'2026-08-31T10:00:00.000Z',lastEvidenceAt:'2026-08-30T10:00:00.000Z',lastAction:'PROMOTED'}};
  const result=adaptActiveFiveFromPostGameEvidence({tasks:[adaptive,task('a',80),task('b',79)],profile:profile([],3,g3),history:[row(g1,null),row(g2,null),row(g3,null)],accountId:'acct',role:'JUNGLE',now:g3});
  assert.equal(result.tasks.find(t=>t.id==='op-pro-chain-death')?.status,'MASTERED');
  assert.equal(result.tasks.find(t=>t.id==='op-pro-chain-death')?.progress,100);
  assert.equal(active(result.tasks).length,2);
  assert.equal(result.tasks.some(t=>t.id.includes('adaptive-fill')),false);
});

test('mastered behaviour requires repeated recurrence before reopening',()=>{
  const mastered:ILPTask&{adaptive:AdaptiveIlpMeta}={...task('op-pro-chain-death',96),title:'Break the second death',status:'MASTERED',progress:100,adaptive:{version:1,managedBy:'POST_GAME_EVIDENCE',patternKey:'CHAIN_DEATH',confidence:80,recentSupportGames:0,recentWindow:3,recentOccurrences:0,totalSupportGames:2,cleanStreak:3,activatedAfter:'2026-08-20T10:00:00.000Z',lastEvidenceAt:'2026-08-19T10:00:00.000Z',lastAction:'MASTERED'}};
  const base=[mastered,task('a',80),task('b',79)];
  const one=adaptActiveFiveFromPostGameEvidence({tasks:base,profile:profile([fix({gamesSeen:1,occurrences:1})],1,g1),history:[row(g1,'CHAIN_DEATH')],accountId:'acct',role:'JUNGLE',now:g1});
  assert.equal(one.tasks.find(t=>t.id==='op-pro-chain-death')?.status,'MASTERED');
  const two=adaptActiveFiveFromPostGameEvidence({tasks:one.tasks,profile:profile([fix({gamesSeen:2,occurrences:2})],2,g2),history:[row(g1,'CHAIN_DEATH'),row(g2,'CHAIN_DEATH')],accountId:'acct',role:'JUNGLE',now:g2});
  assert.notEqual(two.tasks.find(t=>t.id==='op-pro-chain-death')?.status,'MASTERED');
  assert.equal((two.tasks.find(t=>t.id==='op-pro-chain-death') as ILPTask&{adaptive?:AdaptiveIlpMeta})?.adaptive?.lastAction,'REOPENED');
  assert.equal(active(two.tasks).length,3);
});

test('an empty authenticated plan stays empty until measurable evidence exists',()=>{
  const result=adaptActiveFiveFromPostGameEvidence({tasks:[],profile:profile([],0,null),history:[],accountId:'acct',role:'JUNGLE',now:g1});
  assert.equal(active(result.tasks).length,0);
  assert.equal(result.tasks.some(t=>t.id.includes('adaptive-fill')),false);
});
