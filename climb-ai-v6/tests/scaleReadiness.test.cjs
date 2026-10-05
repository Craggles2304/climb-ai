const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const telemetry=fs.readFileSync('app/api/live/telemetry/route.ts','utf8');
const repoFile=fs.readFileSync('lib/server/liveTrackerRepository.ts','utf8');
const worker=fs.readFileSync('lib/server/postGameQueue.ts','utf8');
const cron=fs.readFileSync('app/api/cron/postgame/route.ts','utf8');
const vercel=fs.readFileSync('vercel.json','utf8');
const migration=fs.readFileSync('supabase/migrations/20261005_50_player_beta_hardening.sql','utf8');

test('telemetry sampling and rate limiting are shared in Postgres, not Vercel memory',()=>{
  assert.ok(telemetry.includes('claimLiveTelemetryIngest'));
  assert.ok(repoFile.includes("db.rpc('claim_live_telemetry_ingest'"));
  assert.equal(telemetry.includes('snapshotSampleAt=new Map'),false);
  assert.equal(telemetry.includes("rateLimit(clientKey(req,'live-telemetry')"),false);
  assert.ok(migration.includes('telemetry_ingest_windows'));
  assert.ok(migration.includes('telemetry_sample_claims'));
  assert.ok(migration.includes("'SAMPLE_ALREADY_CLAIMED'"));
});

test('post-game uploads are durable and processed outside the ingest request',()=>{
  assert.ok(repoFile.includes("processing:{status:'QUEUED'"));
  assert.ok(repoFile.includes("db.from('live_postgame_jobs').upsert"));
  assert.ok(repoFile.includes('payload:envelope'));
  assert.ok(repoFile.includes('processQueuedPostGameSession'));
  assert.equal(repoFile.includes("if(envelope.type==='END')await finalizeSession(sessionId)"),false);
  assert.ok(worker.includes("db.rpc('claim_live_postgame_jobs'"));
  assert.ok(worker.includes("db.rpc('finish_live_postgame_job'"));
});

test('Vercel drains a bounded post-game batch every minute with a secret',()=>{
  const config=JSON.parse(vercel);
  assert.deepEqual(config.crons,[{path:'/api/cron/postgame',schedule:'* * * * *'}]);
  assert.ok(cron.includes('process.env.CRON_SECRET'));
  assert.ok(cron.includes("drainPostGameQueue({limit:18,concurrency:3})"));
  assert.ok(cron.includes('export const maxDuration=120'));
});

test('temporary queued keyframes are deleted after successful processing',()=>{
  assert.ok(migration.includes('payload=null'));
  assert.equal(repoFile.includes('keyframes:snapshots'),false);
});
