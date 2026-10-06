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
