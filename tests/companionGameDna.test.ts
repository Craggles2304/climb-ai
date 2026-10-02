import test from 'node:test';
import assert from 'node:assert/strict';
import {companionDnaStrands,companionMissionView,dnaStrength,missionProgressPercent,uniqueActiveMissions} from '../lib/companionGameDna';
import {dnaTaskProgress} from '../lib/dnaGrowth';
import type {ILPTask} from '../lib/types';

const task=(id:string,passes:number):ILPTask=>({
  id,accountId:'a',title:'Hold the line',dnaDomain:'TEAMFIGHTS',category:'TEAMFIGHTING',why:'First threat cycle is the blocker.',gameRule:'Wait for engage.',metric:'deaths',target:'3 clean reps',progress:91,status:'ACTIVE',source:'SYSTEM',evidence:[],masteryRequired:3,
  missionHistory:Array.from({length:passes},(_,index)=>({matchId:'m'+index,at:`2026-10-0${index+1}T00:00:00.000Z`,adherence:'YES',clearedBar:true,outcome:'CONFIRMED',banksPass:true})),
});

test('mission progress is derived only from completed and required reps',()=>{
  assert.deepEqual([0,1,2,3].map(value=>missionProgressPercent(value,3)),[0,33,67,100]);
  assert.equal(companionMissionView(task('one',0)).progressPercent,0);
  assert.equal(companionMissionView(task('one',1)).progressPercent,33);
  assert.equal(companionMissionView(task('one',2)).progressPercent,67);
  assert.equal(companionMissionView(task('one',3)).progressPercent,100);
  assert.equal(dnaTaskProgress(task('one',0)),0);
  assert.equal(dnaTaskProgress(task('one',2)),67);
});

test('the same active mission id cannot occupy more than one slot',()=>{
  const repeated=task('same',1);
  assert.deepEqual(uniqueActiveMissions([repeated,{...repeated,title:'stale duplicate'},task('other',0)]).map(item=>item.id),['same','other']);
});

test('all six companion strands use the web Coach four-rung DNA denominator',()=>{
  const strands=companionDnaStrands([task('one',3),task('two',2)],true);
  assert.equal(strands.length,6);
  assert.equal(strands.find(strand=>strand.domain==='TEAMFIGHTS')?.progressPercent,42);
  assert.equal(dnaStrength(strands),7);
  assert.equal(companionDnaStrands([task('one',3)],false).every(strand=>strand.progressPercent===0),true);
});
