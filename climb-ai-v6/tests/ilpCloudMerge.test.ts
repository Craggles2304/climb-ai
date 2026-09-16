import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeIlpCloudSnapshot,type CloudIlpRow} from '../lib/ilpCloudMerge';
import type {ILPTask} from '../lib/types';

function task(id:string,over:Partial<ILPTask>={}):ILPTask{return{id,accountId:'acct',title:`Task ${id}`,category:'CONSISTENCY',why:'test',gameRule:'test rule',metric:'test_metric',target:'3 games',progress:20,status:'ACTIVE',source:'SYSTEM',evidence:[],priority:60,history:[],...over}}
function row(task:ILPTask,updatedAt:string):CloudIlpRow{return{id:task.id,payload:task,updated_at:updatedAt}}

const t1='2026-09-16T12:00:00.000Z';
const t2='2026-09-16T12:05:00.000Z';
const t3='2026-09-16T12:10:00.000Z';

test('remote-only evidence mission survives a stale browser snapshot',()=>{
  const remote={...task('op-pro-chain-death',{title:'Break the second death',priority:96}),adaptive:{version:1,managedBy:'POST_GAME_EVIDENCE',patternKey:'CHAIN_DEATH',confidence:85}} as any;
  const result=mergeIlpCloudSnapshot([task('a')],[row(remote,t2)],'acct');
  assert.ok(result.tasks.some(item=>item.id==='op-pro-chain-death'));
  assert.ok(result.tasks.some(item=>item.id==='a'));
  assert.equal(result.writes.length,1);
});

test('later automatic client progress cannot overwrite a server evidence decision',()=>{
  const remote={...task('a',{status:'PAUSED',progress:45,lastUpdatedReason:'Paused automatically after repeated evidence promoted a stronger system focus.'}),history:[{at:t2,type:'PAUSED',note:'Replaced only after repeated evidence promoted Break the second death.'}]} as ILPTask;
  const stale=task('a',{status:'ACTIVE',progress:80,history:[{at:t3,type:'PROGRESS',note:'Automatic client progress after match sync.'}]});
  const result=mergeIlpCloudSnapshot([stale],[row(remote,t2)],'acct');
  const merged=result.tasks.find(item=>item.id==='a');
  assert.equal(merged?.status,'PAUSED');
  assert.equal(merged?.progress,45);
  assert.equal(result.writes.length,0);
});

test('explicit player pause after server update is allowed and keeps adaptive metadata',()=>{
  const remote={...task('op-pro-chain-death',{title:'Break the second death',priority:96}),adaptive:{version:1,managedBy:'POST_GAME_EVIDENCE',patternKey:'CHAIN_DEATH',confidence:85},history:[{at:t1,type:'PROMOTED',note:'Repeated evidence promoted this mission.'}]} as any;
  const local={...task('op-pro-chain-death',{title:'Break the second death',status:'PAUSED',priority:96,lastUpdatedReason:'Paused by player.',history:[{at:t3,type:'PAUSED',note:'Paused by player.'}]}),adaptive:{version:1,managedBy:'POST_GAME_EVIDENCE',patternKey:'CHAIN_DEATH',confidence:70}} as any;
  const result=mergeIlpCloudSnapshot([local],[row(remote,t2)],'acct');
  const merged=result.tasks.find(item=>item.id==='op-pro-chain-death') as any;
  assert.equal(merged.status,'PAUSED');
  assert.equal(merged.adaptive.confidence,85);
  assert.equal(result.writes.length,1);
});

test('newer local evidence may still update a normal non-server-managed task',()=>{
  const remote=task('farm',{progress:30,history:[{at:t1,type:'PROGRESS',note:'Older progress.'}]});
  const local=task('farm',{progress:55,history:[{at:t3,type:'PROGRESS',note:'New match evidence.'}]});
  const result=mergeIlpCloudSnapshot([local],[row(remote,t2)],'acct');
  assert.equal(result.tasks.find(item=>item.id==='farm')?.progress,55);
  assert.equal(result.writes.length,1);
});
