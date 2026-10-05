const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const tracker=fs.readFileSync('companion/src/main.mjs','utf8');
const desktop=fs.readFileSync('companion/electron/main.cjs','utf8');
const route=fs.readFileSync('app/api/live/telemetry/route.ts','utf8');
const repoFile=fs.readFileSync('lib/server/liveTrackerRepository.ts','utf8');
const readModel=fs.readFileSync('lib/server/liveReadRepository.ts','utf8');
const progression=fs.readFileSync('app/api/progression/route.ts','utf8');

test('full matches remain local-first until one compact FINAL bundle',()=>{
  assert.ok(tracker.includes("type:'FINAL'"));
  assert.equal(tracker.includes("queueEnvelope({type:'SNAPSHOT'"),false);
  assert.ok(tracker.includes("pending-match.json"));
  assert.ok(tracker.includes('MAX_LOCAL_KEYFRAMES=12'));
  assert.ok(route.includes("z.enum(['SNAPSHOT','END','FINAL'])"));
  assert.ok(route.includes('saveCompletedMatchBundle'));
  assert.ok(route.includes('z.array(snapshotSchema).min(1).max(12)'));
});

test('compact keyframes preserve farm checkpoints instead of relabelling stale snapshots',()=>{
  assert.ok(tracker.includes('Math.floor(num(snapshot?.gameTime,0)/300)'));
  assert.ok(tracker.includes('Math.floor(num(me?.scores?.creepScore,0)/20)'));
  assert.ok(tracker.includes('[300,600,900,1200]'));
  assert.ok(tracker.includes('nearest(seconds)'));
});

test('farm checkpoints are protected separately from ordinary keyframes',()=>{
  assert.ok(tracker.includes('captureProtectedFarmCheckpoint(snapshot)'));
  assert.ok(tracker.includes('for(const minute of [5,10,15,20])'));
  assert.ok(tracker.includes('previous<seconds&&current>=seconds&&current<=seconds+30'));
  assert.ok(tracker.includes('farmCheckpoints:session.farmCheckpoints??{}'));
  assert.ok(tracker.includes('farmCheckpoints:saved.farmCheckpoints'));
  assert.ok(tracker.includes('lastFarmCheckpointScanTime'));
  assert.ok(tracker.includes('Object.values(finished.farmCheckpoints??{})'));
  assert.ok(tracker.includes('...(finished.keyframes??[]),...protectedFarmFrames'));
});

test('Supabase keeps FINAL keyframes temporary while permanent session state stores derived evidence',()=>{
  assert.ok(repoFile.includes("captureMode:'LOCAL_FIRST_QUEUE_V1'"));
  assert.ok(repoFile.includes('latestSnapshot:snapshots[snapshots.length-1]'));
  assert.equal(repoFile.includes('keyframes:snapshots'),false);
  assert.ok(repoFile.includes('payload:envelope'));
  assert.ok(repoFile.includes('processQueuedPostGameSession'));
  assert.ok(readModel.includes('capture?.latestSnapshot'));
});

test('player read checkpoints stay local during the match',()=>{
  assert.ok(desktop.includes('read-checkpoints.json'));
  assert.equal(desktop.includes('/api/live/read-checkpoint'),false);
  assert.ok(tracker.includes('readCheckpoints:readLocalReadCheckpoints()'));
});


test('deferred XP and mission persistence happens on the next progression refresh',()=>{
  assert.ok(repoFile.includes('materializeDeferredLocalMatch'));
  assert.ok(repoFile.includes("summary?.learningPlanSync?.status==='DEFERRED'"));
  assert.ok(progression.includes('materializeDeferredLocalMatch(user.id,accountId)'));
});
