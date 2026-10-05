import test from 'node:test';
import assert from 'node:assert/strict';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady,dnaTaskProgress,dnaTaskState} from '../lib/dnaGrowth';
import type {ILPTask,Match} from '../lib/types';

const game=(id:string,role:Match['role']='ADC',durationSeconds=1800)=>({
  id,riotAccountId:'acc',champion:'Jinx',role,result:'WIN',kills:1,deaths:1,assists:1,
  durationSeconds,rank:'Bronze IV',source:'riot',createdAt:new Date().toISOString(),
  metrics:{cs:100,csPerMin:5},
}) as Match;

test('Game DNA remains in baseline until three valid games in the active role',()=>{
  const matches=[game('1'),game('2'),game('3','MID'),game('short','ADC',240)];
  assert.equal(DNA_BASELINE_GAMES,3);
  assert.equal(dnaBaselineGameCount(matches,'ADC'),2);
  assert.equal(dnaBaselineReady(2),false);
  assert.equal(dnaBaselineReady(3),true);
});

test('Riot position aliases count toward the correct role baseline',()=>{
  const bottom=game('bottom','BOTTOM' as Match['role']);
  const utility=game('utility','UTILITY' as Match['role']);
  assert.equal(dnaBaselineGameCount([bottom],'ADC'),1);
  assert.equal(dnaBaselineGameCount([utility],'SUPPORT'),1);
  assert.equal(dnaBaselineGameCount([bottom,utility],'ADC'),1);
});

test('DNA growth uses mission progress continuously and mastery locks at 100',()=>{
  const learning={status:'ACTIVE',progress:37} as ILPTask;
  assert.equal(dnaTaskState(learning),1);
  assert.equal(dnaTaskProgress(learning),37);

  const learned={status:'ACTIVE',progress:100} as ILPTask;
  assert.equal(dnaTaskState(learned),2);
  assert.equal(dnaTaskProgress(learned),100);

  const mastered={status:'MASTERED',progress:64} as ILPTask;
  assert.equal(dnaTaskState(mastered),3);
  assert.equal(dnaTaskProgress(mastered),100);
});
