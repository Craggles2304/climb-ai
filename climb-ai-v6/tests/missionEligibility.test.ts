import test from 'node:test';
import assert from 'node:assert/strict';
import {isGameMeasurableTask} from '../lib/ilpEngine';
import type {ILPTask,Match} from '../lib/types';

function match(metrics:Record<string,number|undefined>):Match{
  return{
    id:'m1',
    riotAccountId:'a1',
    champion:'Ahri',
    role:'MID',
    result:'WIN',
    kills:4,
    deaths:2,
    assists:7,
    durationSeconds:1800,
    rank:'Gold',
    source:'live_tracker',
    createdAt:'2026-09-25T10:00:00.000Z',
    metrics:{cs:180,csPerMin:6,...metrics},
  } as Match;
}

function task(metric:string):ILPTask{
  return{
    id:'t1',
    accountId:'a1',
    title:'Mission',
    category:'CONSISTENCY',
    why:'Measured mission.',
    gameRule:'Do the measurable thing.',
    metric,
    target:'3 games',
    progress:0,
    status:'ACTIVE',
    source:'SYSTEM',
    evidence:[],
  };
}

test('mission eligibility requires the player games to contain the metric',()=>{
  assert.equal(isGameMeasurableTask(task('secondItemMinute'),[match({})]),false);
  assert.equal(isGameMeasurableTask(task('secondItemMinute'),[match({secondItemMinute:21.8})]),true);
});

test('always-present scoreboard deaths remain measurable',()=>{
  assert.equal(isGameMeasurableTask(task('deaths'),[match({})]),true);
});
