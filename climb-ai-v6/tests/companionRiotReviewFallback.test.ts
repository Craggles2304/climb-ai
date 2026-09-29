import test from 'node:test';
import assert from 'node:assert/strict';
import {isNewRecentRiotMatch,riotCompanionReview} from '../lib/riot/companionReviewFallback';

test('Riot fallback accepts only a new recent completed game',()=>{
  const now=Date.parse('2026-09-29T23:00:00Z');
  assert.equal(isNewRecentRiotMatch('2026-09-29T22:55:00Z','2026-09-29T21:00:00Z',now),true);
  assert.equal(isNewRecentRiotMatch('2026-09-29T21:01:00Z','2026-09-29T21:00:00Z',now),false);
  assert.equal(isNewRecentRiotMatch('2026-09-28T12:00:00Z',null,now),false);
});

test('Riot fallback reports measured evidence and labels absent local recording',()=>{
  const details:any={
    match:{champion:'Ahri',role:'MID',durationSeconds:1800,kills:7,deaths:3,assists:9,createdAt:'2026-09-29T22:55:00Z',metrics:{cs:210}},
    proAnalysis:{metrics:{farm:{key:'farm',label:'Farm',score:82,status:'MEASURED',summary:'Kept farm pace through mid game.',evidence:[{label:'CS',detail:'210 CS'}]},death:{key:'death',label:'Death control',score:42,status:'DERIVED',summary:'Three deaths limited your map pressure.',evidence:[{label:'Deaths',detail:'3 deaths'}]}}},
  };
  const review=riotCompanionReview('EUW1_123',details,{tier:'SILVER',depth:3});
  assert.equal(review.source,'RIOT_MATCH');
  assert.equal(review.match.champion,'Ahri');
  assert.equal(review.match.csPerMin,7);
  assert.equal(review.good[0].title,'Farm');
  assert.equal(review.critical[0].title,'Death control');
  assert.equal(review.evidenceCount,2);
  assert.match(review.neutral[0].detail,/Local Companion recording was unavailable/);
});
