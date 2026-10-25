import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

// Import the actual runtime module used by the packaged Windows tracker.
const modulePath='../companion/src/pending-matches.mjs';
const runtime=import(modulePath);
const game=(id:string)=>({type:'FINAL',clientSessionId:id,snapshots:[{gameTime:1800}]});

test('two offline games survive restart and acknowledgements only remove their own game',async()=>{
  const {pendingMatchStore}=await runtime;
  const dir=mkdtempSync(join(tmpdir(),'op-pending-'));
  try{
    const file=join(dir,'pending-match.json');
    const store=pendingMatchStore(file);
    store.save(game('first'));store.save(game('second'));
    const restarted=pendingMatchStore(file);
    assert.deepEqual(restarted.read().map((g:any)=>g.clientSessionId),['first','second']);
    restarted.acknowledge('first');
    assert.deepEqual(pendingMatchStore(file).read().map((g:any)=>g.clientSessionId),['second']);
    restarted.acknowledge('first');
    assert.equal(restarted.read().length,1);
    restarted.acknowledge('second');assert.deepEqual(restarted.read(),[]);
  }finally{rmSync(dir,{recursive:true,force:true})}
});

test('old single pending game upgrades without loss or duplicate retry records',async()=>{
  const {pendingMatchStore}=await runtime;
  const dir=mkdtempSync(join(tmpdir(),'op-pending-'));
  try{
    const file=join(dir,'pending-match.json');
    writeFileSync(file,JSON.stringify(game('legacy')));
    const store=pendingMatchStore(file);
    store.save(game('new'));store.save(game('new'));
    assert.deepEqual(store.read().map((g:any)=>g.clientSessionId),['legacy','new']);
  }finally{rmSync(dir,{recursive:true,force:true})}
});

test('a damaged pending file is reported and cannot be silently overwritten',async()=>{
  const {pendingMatchStore}=await runtime;
  const dir=mkdtempSync(join(tmpdir(),'op-pending-'));
  try{
    const file=join(dir,'pending-match.json');writeFileSync(file,'broken');
    assert.throws(()=>pendingMatchStore(file).save(game('next')));
  }finally{rmSync(dir,{recursive:true,force:true})}
});
