import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_LEARNING_MODEL_VERSION,
  REQUIRED_LEARNING_LAYERS,
  buildLearningModelHealth,
  learningModelNeedsRebuild,
} from '../lib/learningModelVersion';

function full(){
  return Object.fromEntries(REQUIRED_LEARNING_LAYERS.map(key=>[key,{version:1,status:key==='coachTwin'?'BUILDING':'ACTIVE'}]));
}

test('current learning model requires every persisted layer',()=>{
  const health=buildLearningModelHealth(full());
  assert.equal(health.modelVersion,CURRENT_LEARNING_MODEL_VERSION);
  assert.equal(health.complete,true);
  assert.equal(health.presentLayers,REQUIRED_LEARNING_LAYERS.length);
  assert.deepEqual(health.missing,[]);
  assert.ok(health.building.includes('coachTwin'));
});

test('BUILDING is valid persistence but a missing engine is stale',()=>{
  const recent=full();
  delete (recent as any).skillTransferGraph;
  const health=buildLearningModelHealth(recent);
  assert.equal(health.complete,false);
  assert.deepEqual(health.missing,['skillTransferGraph']);
  assert.equal(learningModelNeedsRebuild({storedVersion:CURRENT_LEARNING_MODEL_VERSION,recentChange:recent}),true);
});

test('older model versions self-heal even when their old key set looked complete',()=>{
  assert.equal(learningModelNeedsRebuild({storedVersion:0,recentChange:full()}),true);
  assert.equal(learningModelNeedsRebuild({storedVersion:CURRENT_LEARNING_MODEL_VERSION,recentChange:full()}),false);
});
