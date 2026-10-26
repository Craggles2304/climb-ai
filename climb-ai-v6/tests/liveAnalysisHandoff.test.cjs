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
  // Further filters (queue scoping, for one) may sit in this chain; looking the
  // match up by its session is the contract, not the exact filter list.
  assert.match(liveRead,/db\.from\('matches'\)\.select\('id'\)[^;]*?\.eq\('live_session_id',session\.id\)/);
  assert.ok(liveRead.includes('matchId=(matchRow as any)?.data?.id??null'));
  assert.ok(liveRead.includes('matchId,'));
});

test('live page exposes a full match review action for completed games',()=>{
  // Either quoting style is fine; the route and the id it carries are not.
  const analyseLink=/\/analyse\/(?:'\+|\$\{)encodeURIComponent\(review\.matchId\)/;
  assert.match(liveCenter,analyseLink);
  assert.match(liveReview,analyseLink);
  assert.ok(liveCenter.includes('OPEN SAVED MATCH'));
  assert.ok(liveReview.includes('OPEN FULL MATCH REVIEW →'));
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
  // Guards may be added in front (queue processing, for one); the recovery
  // condition itself is what this pins down.
  assert.match(liveTracker,/if\([^)]*session\.status==='COMPLETE'&&normalized\.length&&strength&&!recoveredMatchId\)/);
  assert.ok(liveTracker.includes("persistLiveMatchWithRetry({...session,user_id:userId},normalized,strength,proAnalysis)"));
});

test('live finalization retries saved-match persistence before giving up',()=>{
  assert.ok(liveTracker.includes('persistLiveMatchWithRetry(session,snapshots,summary,proAnalysis)'));
  assert.ok(liveTracker.includes('for(const delay of [0,250,800])'));
});
