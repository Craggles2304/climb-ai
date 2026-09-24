const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const desktop=fs.readFileSync('companion/electron/main.cjs','utf8');
const route=fs.readFileSync('app/api/live/companion-review/route.ts','utf8');

test('Companion can recover a recent unseen review even if RECORDING was missed',()=>{
  assert.ok(desktop.includes('async function recoverLatestCompletedReview()'));
  assert.ok(desktop.includes("if(reviewPollInFlight||state.phase!=='WAITING')return"));
  assert.ok(desktop.includes("sessionId===cfg.lastReviewSessionId"));
  assert.ok(desktop.includes('age>8*60*60_000'));
  assert.ok(desktop.includes("detail:'Recovered your latest completed match review.'"));
});

test('normal post-game flow marks a review as shown to avoid reopening it forever',()=>{
  assert.ok(desktop.includes('function markReviewShown(sessionId)'));
  assert.ok(desktop.includes('cfg.lastReviewSessionId=id'));
  assert.ok(desktop.includes('markReviewShown(body.review?.sessionId)'));
});

test('paired Companion performs a one-shot missed-review recovery after startup',()=>{
  assert.ok(desktop.includes("setTimeout(()=>{if(state.phase==='WAITING')void recoverLatestCompletedReview()},4500)"));
});

test('review endpoint exposes completion time so recovery only shows recent games',()=>{
  assert.ok(route.includes('endedAt:latest.endedAt??latest.lastSeenAt??null'));
});
