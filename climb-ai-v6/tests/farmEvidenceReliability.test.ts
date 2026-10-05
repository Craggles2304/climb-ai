import test from 'node:test';
import assert from 'node:assert/strict';
import type {Match} from '../lib/types';
import type {ProMatchAnalysis} from '../lib/riot/proAnalysis';
import {reconcileFarmEvidence} from '../lib/riot/reconcileFarmEvidence';

function matchWithCurve(curve:ProMatchAnalysis['metrics']['cs_curve'],durationSeconds=1051,cs=130,csPerMin=7.42):Match{
  return{
    id:'m1',riotAccountId:'a1',champion:'Caitlyn',opponent:'Ashe',role:'ADC',result:'WIN',
    kills:5,deaths:4,assists:9,durationSeconds,rank:'Platinum',source:'live_tracker',createdAt:'2026-10-05T13:43:54Z',
    metrics:{cs,csPerMin,deaths:4},
    proAnalysis:{
      version:1,champion:'Caitlyn',role:'BOTTOM',evidenceSources:['LIVE_TELEMETRY'],
      metrics:{cs_curve:curve},leakSignals:[],fingerprint:{primary:'TEST',sequence:[],confidence:'MEDIUM',explanation:'test'},
    },
  };
}

test('repairs the real failure mode where stale snapshots became fake 5/10/15 CS zeros',()=>{
  const input=matchWithCurve({
    key:'cs_curve',label:'CS CURVE',score:0,value:'5m 0 · 10m 0 · 15m 0 · 20m 130',
    status:'MEASURED',confidence:'MEDIUM',sources:['LIVE_TELEMETRY'],
    summary:'bad curve',
    evidence:[
      {atSeconds:300,label:'5 minute CS',detail:'0 CS (0/min).'},
      {atSeconds:600,label:'10 minute CS',detail:'0 CS (0/min).'},
      {atSeconds:900,label:'15 minute CS',detail:'0 CS (0/min).'},
      {atSeconds:1200,label:'20 minute CS',detail:'130 CS (6.5/min).'},
    ],
  });
  const fixed=reconcileFarmEvidence(input);
  const curve=fixed.proAnalysis?.metrics.cs_curve;
  assert.equal(fixed.metrics.cs,130);
  assert.equal(fixed.metrics.csPerMin,7.42);
  assert.equal(curve?.score,null);
  assert.equal(curve?.status,'BUILDING');
  assert.match(curve?.value||'',/130 final CS/);
  assert.match(curve?.summary||'',/will not invent a CS curve/i);
  assert.deepEqual(curve?.evidence.map(item=>item.label),['Final farm']);
});

test('keeps a plausible measured CS curve unchanged',()=>{
  const curve={
    key:'cs_curve' as const,label:'CS CURVE',score:88,value:'5m 34 · 10m 76 · 15m 112',
    status:'MEASURED' as const,confidence:'MEDIUM' as const,sources:['LIVE_TELEMETRY'],
    summary:'valid curve',
    evidence:[
      {atSeconds:300,label:'5 minute CS',detail:'34 CS (6.8/min).'},
      {atSeconds:600,label:'10 minute CS',detail:'76 CS (7.6/min).'},
      {atSeconds:900,label:'15 minute CS',detail:'112 CS (7.5/min).'},
    ],
  };
  const input=matchWithCurve(curve,1200,145,7.25);
  const fixed=reconcileFarmEvidence(input);
  assert.equal(fixed.proAnalysis?.metrics.cs_curve?.score,88);
  assert.equal(fixed.proAnalysis?.metrics.cs_curve?.status,'MEASURED');
  assert.equal(fixed.proAnalysis?.metrics.cs_curve?.evidence.length,3);
});
