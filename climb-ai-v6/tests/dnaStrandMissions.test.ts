import test from 'node:test';
import assert from 'node:assert/strict';
import type {ILPTask,Role} from '../lib/types';
import {DNA_DOMAINS} from '../lib/dnaDomain';
import {ensureOneMissionPerDnaStrand,gradeDnaStrandMissionsFromHistory,isDnaStrandMission} from '../lib/dnaStrandMissions';

const role:Role='ADC';

function legacy(id:string,domain:ILPTask['dnaDomain']):ILPTask{
  return{
    id,accountId:'acct',title:'Legacy '+id,dnaDomain:domain,category:'CONSISTENCY',
    why:'',gameRule:'',metric:'deaths',target:'3 games',progress:0,status:'ACTIVE',
    source:'SYSTEM',evidence:[],roleScope:role,roleEvidence:[role],
  };
}

test('the canonical plan has exactly one live mission on every DNA strand',()=>{
  const result=ensureOneMissionPerDnaStrand([
    legacy('one','LANING'),
    legacy('two','TEAMFIGHTS'),
  ],'acct',role);
  const live=result.tasks.filter(task=>task.status!=='MASTERED'&&task.status!=='PAUSED');
  assert.equal(live.length,6);
  assert.deepEqual(new Set(live.map(task=>task.dnaDomain)),new Set(DNA_DOMAINS));
  assert.ok(live.every(isDnaStrandMission));
  assert.ok(result.tasks.filter(task=>!isDnaStrandMission(task)).every(task=>task.status==='PAUSED'));
});

test('mastering a strand creates its next mission without duplicating the other five',()=>{
  const first=ensureOneMissionPerDnaStrand([],'acct',role).tasks;
  const laning=first.find(task=>task.dnaDomain==='LANING'&&isDnaStrandMission(task))!;
  const mastered=first.map(task=>task.id===laning.id?{...task,status:'MASTERED' as const,progress:100}:task);
  const second=ensureOneMissionPerDnaStrand(mastered,'acct',role).tasks;
  const live=second.filter(task=>task.status!=='MASTERED'&&task.status!=='PAUSED');
  assert.equal(live.length,6);
  const nextLaning=live.find(task=>task.dnaDomain==='LANING')!;
  assert.notEqual(nextLaning.id,laning.id);
  assert.equal(nextLaning.title,'Choose fights from playable lane states');
});

test('a strand mission paused by the old three-mission cap is restored instead of skipped',()=>{
  const first=ensureOneMissionPerDnaStrand([],'acct',role).tasks;
  const paused=first.map(task=>task.dnaDomain==='OBJECTIVES'?{
    ...task,status:'PAUSED' as const,lastUpdatedReason:'Paused automatically to keep the development plan at exactly three active missions.',
  }:task);
  const restored=ensureOneMissionPerDnaStrand(paused,'acct',role).tasks;
  const objective=restored.filter(task=>task.dnaDomain==='OBJECTIVES'&&task.status!=='MASTERED'&&task.status!=='PAUSED');
  assert.equal(objective.length,1);
  assert.equal(objective[0]?.id,'dna-strand-adc-objectives-1');
  assert.equal(objective[0]?.title,'Be ready before the objective');
});

test('post-game decision evidence banks completed games on the matching strand',()=>{
  const first=ensureOneMissionPerDnaStrand([],'acct',role).tasks;
  const lane=first.find(task=>task.dnaDomain==='LANING')!;
  const started=lane.history?.find(event=>event.type==='PROMOTED')?.at??'2026-10-01T00:00:00.000Z';
  const later=new Date(Date.parse(started)+60_000).toISOString();
  const history:any[]=[
    {matchId:'m1',champion:'Jinx',role:'ADC',createdAt:later,analysis:{version:1,metrics:{red_state_fights:{key:'red_state_fights',label:'RED STATE',score:90,status:'DERIVED'}},leakSignals:[],fingerprint:{primary:'',sequence:[],explanation:'',confidence:'MEDIUM'}}},
  ];
  const graded=gradeDnaStrandMissionsFromHistory(first,history).tasks;
  const updated=graded.find(task=>task.id===lane.id)!;
  assert.equal(updated.successfulGames,1);
  assert.equal(updated.gamesObserved,1);
  assert.equal(updated.progress,33);
  assert.equal(updated.missionHistory?.[0]?.banksPass,true);
});
