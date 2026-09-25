import test from 'node:test';
import assert from 'node:assert/strict';
import {missionStage,missionSummary} from '../lib/missionLoop';
import type {ILPTask} from '../lib/types';

function task(overrides:Partial<ILPTask>={}):ILPTask{
  return {
    id:'t1',
    accountId:'a1',
    title:'Own the wave',
    category:'LANING',
    why:'Farm reliably.',
    gameRule:'Protect the wave.',
    metric:'laneCsPerMin',
    target:'6.5+ lane CS/min across 3 games',
    progress:33,
    status:'ACTIVE',
    source:'SYSTEM',
    evidence:[],
    masteryRequired:3,
    ...overrides,
  };
}

test('automatic match evidence is visible as mission reps when no behaviour review exists',()=>{
  const t=task({successfulGames:1,gamesObserved:2});
  const summary=missionSummary(t);
  assert.equal(summary.confirmed,1);
  assert.equal(summary.reviewed,2);
  assert.equal(summary.remaining,2);
  assert.equal(summary.proofMode,'TRACKED');
  assert.equal(missionStage(t),'REPEAT');
});

test('reviewed behaviour evidence takes priority over automatic metric fallback',()=>{
  const t=task({
    successfulGames:3,
    gamesObserved:3,
    missionHistory:[
      {matchId:'m1',at:'2026-09-25T10:00:00Z',adherence:'YES',clearedBar:false,outcome:'UNREWARDED',banksPass:false},
      {matchId:'m2',at:'2026-09-25T11:00:00Z',adherence:'YES',clearedBar:true,outcome:'CONFIRMED',banksPass:true},
    ],
  });
  const summary=missionSummary(t);
  assert.equal(summary.confirmed,1);
  assert.equal(summary.reviewed,2);
  assert.equal(summary.proofMode,'REVIEWED');
});
