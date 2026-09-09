import test from 'node:test';
import assert from 'node:assert/strict';
import {nextQueue,restoreBatch,MAX_QUEUE,QueuedEvent} from '../lib/analytics';

const ev=(n:number):QueuedEvent=>({event:'dashboard_view',props:{n},occurredAt:`2026-09-0${(n%9)+1}T00:00:00.000Z`});

test('queues events in order',()=>{
  const q=nextQueue(nextQueue([],ev(1)),ev(2));
  assert.deepEqual(q.map(e=>e.props.n),[1,2]);
});

test('drops the oldest events rather than growing without bound',()=>{
  let q:QueuedEvent[]=[];
  for(let i=0;i<MAX_QUEUE+25;i++)q=nextQueue(q,ev(i));
  assert.equal(q.length,MAX_QUEUE);
  assert.equal(q[0].props.n,25,'oldest 25 should have been dropped');
  assert.equal(q[q.length-1].props.n,MAX_QUEUE+24);
});

test('a failed batch goes back in front of anything tracked while it was in flight',()=>{
  const batch=[ev(1),ev(2)];
  const since=[ev(3)];
  assert.deepEqual(restoreBatch(batch,since).map(e=>e.props.n),[1,2,3]);
});

test('restoring never exceeds the cap',()=>{
  const batch=Array.from({length:MAX_QUEUE},(_,i)=>ev(i));
  const since=[ev(999)];
  const out=restoreBatch(batch,since);
  assert.equal(out.length,MAX_QUEUE);
  assert.equal(out[out.length-1].props.n,999,'the newest event must survive the trim');
});

test('track is a no-op on the server rather than throwing',async()=>{
  const {track}=await import('../lib/analytics');
  assert.doesNotThrow(()=>track('dashboard_view'));
});
