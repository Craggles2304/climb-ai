const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const liveRead=fs.readFileSync('lib/server/liveReadRepository.ts','utf8');
const liveCenter=fs.readFileSync('components/LiveCommandCenter.tsx','utf8');
const liveReview=fs.readFileSync('components/LiveFightReviewMount.tsx','utf8');
const analysePage=fs.readFileSync('app/analyse/[match]/page.tsx','utf8');
const analyseApi=fs.readFileSync('app/api/analyse/route.ts','utf8');

const liveTracker=fs.readFileSync('lib/server/liveTrackerRepository.ts','utf8');

test('completed live review exposes the saved match id',()=>{
  assert.ok(liveRead.includes("db.from('matches').select('id').eq('live_session_id',session.id)"));
  assert.ok(liveRead.includes('matchId=(matchRow as any)?.data?.id??null'));
  assert.ok(liveRead.includes('matchId,'));
});

test('live page exposes a full match review action for completed games',()=>{
  assert.ok(liveCenter.includes('OPEN FULL MATCH REVIEW →'));
  assert.ok(liveReview.includes('OPEN FULL MATCH REVIEW →'));
  assert.ok(liveCenter.includes("href={'/analyse/'+encodeURIComponent(review.matchId)}"));
  assert.ok(liveReview.includes('encodeURIComponent(review.matchId)'));
});

test('completed live game refreshes the account match cache',()=>{
  assert.ok(liveCenter.includes('refresh:refreshAccount'));
  assert.ok(liveCenter.includes('void refreshAccount()'));
});

test('analysis page can recover a newly completed match directly from the server',()=>{
  assert.ok(analysePage.includes("fetch('/api/analyse'"));
  assert.ok(analysePage.includes("body.match.riotAccountId===active.id"));
  assert.ok(analysePage.includes('Loading the saved match…'));
  assert.ok(analyseApi.includes('match,'));
  assert.ok(analyseApi.includes('proAnalysis:proAnalysis??null'));
});


test('completed live review self-heals a missing saved match',()=>{
  assert.ok(liveTracker.includes("if(session.status==='COMPLETE'&&normalized.length&&strength&&!recoveredMatchId)"));
  assert.ok(liveTracker.includes("persistLiveMatchWithRetry({...session,user_id:userId},normalized,strength,proAnalysis)"));
});

test('live finalization retries saved-match persistence before giving up',()=>{
  assert.ok(liveTracker.includes('persistLiveMatchWithRetry(session,snapshots,summary,proAnalysis)'));
  assert.ok(liveTracker.includes('for(const delay of [0,250,800])'));
});
