import test from 'node:test';
import assert from 'node:assert/strict';
import type {ILPTask,Role} from '../lib/types';
import {DNA_DOMAINS} from '../lib/dnaDomain';
import {ensureOneMissionPerDnaStrand,isDnaStrandMission} from '../lib/dnaStrandMissions';

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
  assert.equal(nextLaning.title,'Reach 10 minutes clean');
});
