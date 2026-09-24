import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalLeaguePatch,buildLearningPatchContext} from '../lib/patchIntelligence';

test('canonical League patch keeps the balance-patch family',()=>{
  assert.equal(canonicalLeaguePatch('16.18.1'),'16.18');
  assert.equal(canonicalLeaguePatch('16.18.742.1234'),'16.18');
  assert.equal(canonicalLeaguePatch('lolpatch_16.18'),'16.18');
  assert.equal(canonicalLeaguePatch(''),null);
});

test('learning patch context marks champion balance boundaries as confounded',()=>{
  const analysis:any={version:1,metrics:{},leakSignals:[],fingerprint:{primary:'x',sequence:[],confidence:'LOW',explanation:''}};
  const rows:any[]=[
    {champion:'Jinx',role:'ADC',createdAt:'2026-09-01T00:00:00Z',patch:'16.17',analysis},
    {champion:'Jinx',role:'ADC',createdAt:'2026-09-15T00:00:00Z',patch:'16.18',analysis},
  ];
  const context=buildLearningPatchContext(rows,[{patch:'16.18',entityType:'CHAMPION',entityId:'Jinx',entityName:'Jinx',changeType:'MODIFIED',changedFields:['stats']}]);
  assert.equal(context.status,'CROSS_PATCH');
  assert.equal(context.affectedChampionBoundaries,1);
  assert.equal(context.trendReliability,'LOW');
});
