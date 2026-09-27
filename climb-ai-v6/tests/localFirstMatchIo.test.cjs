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

test('Supabase stores derived evidence instead of raw keyframe history',()=>{
  assert.ok(repoFile.includes("captureMode:'LOCAL_FIRST_V1'"));
  assert.ok(repoFile.includes('latestSnapshot:snapshots[snapshots.length-1]'));
  assert.equal(repoFile.includes('keyframes:snapshots'),false);
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
