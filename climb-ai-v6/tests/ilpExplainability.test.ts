import test from 'node:test';
import assert from 'node:assert/strict';
import {explainIlpTask} from '../lib/ilpExplainability';
import type {ILPTask} from '../lib/types';

const base=(overrides:Partial<ILPTask>={}):ILPTask=>({
  id:'mission-1',accountId:'acct',title:'Stop the second death',category:'DEATHS',why:'Chain deaths are costing tempo',gameRule:'Recover first',metric:'OP PRO Fix Ladder',target:'3 clean games',progress:0,status:'ACTIVE',source:'SYSTEM',evidence:[],masteryRequired:3,successfulGames:0,...overrides,
});

function adaptive(task:ILPTask,meta:Record<string,unknown>){return Object.assign(task,{adaptive:{managedBy:'POST_GAME_EVIDENCE',patternKey:'CHAIN_DEATH',confidence:82,recentSupportGames:3,recentWindow:5,recentOccurrences:4,totalSupportGames:6,cleanStreak:1,lastAction:'STRENGTHENED',...meta}})}

test('strengthened mission exposes evidence confidence and mastery progress',()=>{
  const result=explainIlpTask(adaptive(base(),{}));
  assert.equal(result.label,'MISSION STRENGTHENED');
  assert.equal(result.confidence,82);
  assert.equal(result.recentSupportGames,3);
  assert.equal(result.recentWindow,5);
  assert.equal(result.recentOccurrences,4);
  assert.equal(result.cleanStreak,1);
  assert.equal(result.masteryRequired,3);
  assert.equal(result.oneOffGuard,true);
});

test('watch action explains why one game did not rewrite the mission',()=>{
  const result=explainIlpTask(adaptive(base({lastUpdatedReason:'Latest game recorded; waiting for repetition.'}),{lastAction:'WATCH',confidence:44,recentSupportGames:1,recentWindow:5,recentOccurrences:1,cleanStreak:0}));
  assert.equal(result.label,'MISSION HELD');
  assert.match(result.headline,/did not justify a rewrite/i);
  assert.equal(result.confidenceLabel,'EARLY');
});

test('mastered mission keeps player-facing clean streak proof',()=>{
  const result=explainIlpTask(adaptive(base({status:'MASTERED',progress:100,successfulGames:3}),{lastAction:'MASTERED',cleanStreak:3,confidence:91}));
  assert.equal(result.label,'MISSION MASTERED');
  assert.equal(result.cleanStreak,3);
  assert.equal(result.confidenceLabel,'VERY HIGH');
});

test('non-adaptive mission never invents confidence or repeated-game evidence',()=>{
  const result=explainIlpTask(base());
  assert.equal(result.evidenceManaged,false);
  assert.equal(result.confidence,null);
  assert.equal(result.recentSupportGames,null);
  assert.equal(result.label,'BUILDING EVIDENCE');
  assert.equal(result.oneOffGuard,false);
});
