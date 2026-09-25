import test from 'node:test';
import assert from 'node:assert/strict';
import {gradeMissionGame,missionMeasurementSource} from '../lib/missionGrading';
import {METRIC_SPECS} from '../lib/metrics';
import type {ILPTask,Match} from '../lib/types';

function task(metric:string,target='3 proven games'):ILPTask{
  return{id:'t',accountId:'a',title:'Mission',category:'CONSISTENCY',why:'',gameRule:'',metric,target,progress:0,status:'ACTIVE',source:'SYSTEM',evidence:[]};
}
function match(rank:string,metrics:Record<string,number|undefined>,proAnalysis?:any):Match{
  return{
    id:'m',riotAccountId:'a',champion:'Ahri',role:'MID',result:'WIN',
    kills:4,deaths:3,assists:8,durationSeconds:1800,rank,source:'live_tracker',
    createdAt:'2026-09-25T10:00:00.000Z',
    metrics:{cs:170,csPerMin:5.7,deaths:3,...metrics},
    proAnalysis,
  } as Match;
}

test('the same game can pass Gold and miss Master because one rank-aware grader is used',()=>{
  const game=match('Gold II',{laneCsPerMin:6.0});
  const gold=gradeMissionGame(task('laneCsPerMin'),game,'Gold II');
  const master=gradeMissionGame(task('laneCsPerMin'),game,'Master');
  assert.equal(gold.available,true);
  assert.equal(gold.passed,true);
  assert.equal(master.passed,false);
  assert.match(gold.targetLabel,/GOLD target/);
  assert.match(master.targetLabel,/MASTER target/);
});

test('mission measurement source is explicit',()=>{
  assert.equal(missionMeasurementSource('laneCsPerMin'),'LIVE_MEASURABLE');
  assert.equal(missionMeasurementSource('damageShare'),'RIOT_POST_GAME');
  assert.equal(missionMeasurementSource('reset_quality'),'DECISION_EVIDENCE');
});

test('Riot post-game missions never guess when the completed metric is absent',()=>{
  const grade=gradeMissionGame(task('damageShare'),match('Gold II',{}),'Gold II');
  assert.equal(grade.available,false);
  assert.equal(grade.source,'RIOT_POST_GAME');
  assert.match(grade.reason,/completed Riot metric/i);
});

test('decision evidence is graded from the persisted PRO score',()=>{
  const pro={
    version:1,champion:'Ahri',role:'MID',evidenceSources:['LIVE_TELEMETRY'],leakSignals:[],
    fingerprint:{primary:'x',sequence:[],confidence:'HIGH',explanation:'x'},
    metrics:{reset_quality:{key:'reset_quality',label:'RESET QUALITY',score:84,value:'84/100',status:'DERIVED',confidence:'HIGH',sources:['LIVE_TELEMETRY'],summary:'x',evidence:[]}},
  };
  const grade=gradeMissionGame(task('reset_quality','80+ decision score'),match('Diamond II',{},pro),'Diamond II');
  assert.equal(grade.available,true);
  assert.equal(grade.passed,true);
  assert.equal(grade.source,'DECISION_EVIDENCE');
});

test('METRIC_SPECS contains display metadata, not a second grading threshold',()=>{
  for(const spec of Object.values(METRIC_SPECS)){
    assert.equal('threshold' in spec,false);
    assert.equal('direction' in spec,false);
  }
});
