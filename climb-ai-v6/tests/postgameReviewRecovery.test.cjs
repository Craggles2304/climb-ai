const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const desktop=fs.readFileSync('companion/electron/main.cjs','utf8');
const route=fs.readFileSync('app/api/live/companion-review/route.ts','utf8');

test('Companion can recover a recent unseen review even if RECORDING was missed',()=>{
  assert.ok(desktop.includes('async function recoverLatestCompletedReview()'));
  assert.ok(desktop.includes("if(reviewPollInFlight||state.phase!=='WAITING')return"));
  assert.ok(desktop.includes("sessionId===cfg.lastReviewRenderedSessionId"));
  assert.ok(desktop.includes('age>8*60*60_000'));
  assert.ok(desktop.includes("await presentPostGameReview(review,'Recovered your latest completed match review.')"));
});

test('post-game review is only acknowledged after the review card actually renders',()=>{
  assert.ok(desktop.includes('function markReviewRendered(sessionId)'));
  assert.ok(desktop.includes('cfg.lastReviewRenderedSessionId=id'));
  assert.ok(desktop.includes("window.__opRenderedReviewSessionId"));
  assert.ok(desktop.includes('await confirmReviewRendered(sessionId)'));
  assert.ok(desktop.includes('markReviewRendered(sessionId)'));
});

test('a review fetched by an older Companion can be recovered once by the rendered-receipt build',()=>{
  assert.ok(desktop.includes("lastReviewRenderedSessionId:String(raw.lastReviewRenderedSessionId||'')"));
  assert.ok(desktop.includes("sessionId===cfg.lastReviewRenderedSessionId"));
});

test('paired Companion performs a one-shot missed-review recovery after startup',()=>{
  assert.ok(desktop.includes("setTimeout(()=>{if(state.phase==='WAITING')void recoverLatestCompletedReview()},4500)"));
});

test('review endpoint exposes completion time so recovery only shows recent games',()=>{
  assert.ok(route.includes('endedAt:latest.endedAt??latest.lastSeenAt??null'));
});


const liveRead=fs.readFileSync('lib/server/liveReadRepository.ts','utf8');
const liveCenter=fs.readFileSync('components/LiveCommandCenter.tsx','utf8');
const liveReview=fs.readFileSync('components/LiveFightReviewMount.tsx','utf8');
const analysePage=fs.readFileSync('app/analyse/[match]/page.tsx','utf8');
const analyseApi=fs.readFileSync('app/api/analyse/route.ts','utf8');

test('completed live review exposes the saved match id for full analysis',()=>{
  assert.ok(liveRead.includes("db.from('matches').select('id').eq('live_session_id',session.id)"));
  assert.ok(liveRead.includes('matchId=(matchRow as any)?.data?.id??null'));
  assert.ok(liveCenter.includes('OPEN FULL MATCH REVIEW →'));
  assert.ok(liveReview.includes('OPEN FULL MATCH REVIEW →'));
});

test('completed live game refreshes the browser account match cache',()=>{
  assert.ok(liveCenter.includes('refresh:refreshAccount'));
  assert.ok(liveCenter.includes('void refreshAccount()'));
});

test('analysis deep link loads the saved server match when client cache is stale',()=>{
  assert.ok(analysePage.includes("fetch('/api/analyse'"));
  assert.ok(analysePage.includes("body.match.riotAccountId===active.id"));
  assert.ok(analysePage.includes('Loading the saved match…'));
  assert.ok(analyseApi.includes('proAnalysis:proAnalysis??null'));
});
