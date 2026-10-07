import test from 'node:test';
import assert from 'node:assert/strict';
import {missionComparisonForMatch} from '../lib/missionComparison';
import type {ILPTask} from '../lib/types';

const task=(history:ILPTask['missionHistory']):ILPTask=>({
  id:'mission',accountId:'account',title:'Test mission',dnaDomain:'LANING',category:'LANING',
  why:'',gameRule:'',metric:'deathsPre10',target:'',progress:0,status:'ACTIVE',source:'SYSTEM',evidence:[],missionHistory:history,
});

test('the last game is not credited without a saved mission review',()=>{
  assert.equal(missionComparisonForMatch(task([]),'game-1').result,'NOT OBSERVED');
});

test('saved mission attempts decide the last-game result',()=>{
  const passes=task([{matchId:'game-1',at:'2026-10-06T12:00:00Z',adherence:'YES',clearedBar:true,outcome:'CONFIRMED',banksPass:true}]);
  assert.equal(missionComparisonForMatch(passes,'game-1').result,'PROVEN');
  assert.equal(missionComparisonForMatch(passes,'game-2').result,'NOT OBSERVED');
  const misses=task([{matchId:'game-1',at:'2026-10-06T12:00:00Z',adherence:'YES',clearedBar:false,outcome:'UNREWARDED',banksPass:false}]);
  assert.equal(missionComparisonForMatch(misses,'game-1').result,'NEEDS WORK');
});


test('mission comparison exposes exact timestamped proof',()=>{
  const withProof=task([{
    matchId:'game-proof',at:'2026-10-06T12:00:00Z',adherence:'TRACKED',clearedBar:true,outcome:'CONFIRMED',banksPass:true,
    evidenceV2:{
      version:2,state:'BANKED',measurementSource:'DECISION_EVIDENCE',metric:'deathsPre10',metricLabel:'Threat cycle',
      observedValue:91,observedValueLabel:'91/100',targetLabel:'85+ decision score',confidence:'HIGH',
      opportunities:1,successes:1,misses:0,
      events:[{atSeconds:1122,label:'First engage survived',detail:'Stayed outside the first engage, then re-entered after the cooldown was used.'}],
      reconstruction:{kind:'PRO_METRIC',fields:['metric:deathsPre10'],formula:'91 >= 85'},
      reason:'Timestamped decision proof.',
    },
  }]);
  const result=missionComparisonForMatch(withProof,'game-proof');
  assert.equal(result.result,'PROVEN');
  assert.equal(result.events[0]?.clock,'18:42');
  assert.match(result.detail,/18:42/);
  assert.match(result.events[0]?.detail??'',/re-entered/);
});
