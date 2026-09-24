const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const account=fs.readFileSync('components/AccountContext.tsx','utf8');
const sync=fs.readFileSync('app/api/riot/sync/route.ts','utf8');
const pairing=fs.readFileSync('lib/server/liveTrackerPairingRepository.ts','utf8');

test('selected Riot account rank never falls back to another profile rank',()=>{
  assert.match(account,/function accountRank\(row:any\).*return'UNRANKED'/s);
  assert.doesNotMatch(account,/function accountRank\([^)]*profile[^)]*\)/);
  assert.ok(account.includes('rank:accountRank(row)'));
});

test('switching Riot accounts requests a lightweight fresh rank from Riot',()=>{
  assert.ok(account.includes("fetch('/api/riot/sync'"));
  assert.ok(account.includes('rankOnly:true'));
  assert.ok(account.includes("account.id===active.id?{...account,rank,syncStatus:'READY'}:account"));
  assert.ok(sync.includes('rankOnly:z.boolean().optional()'));
  assert.ok(sync.includes('const ids=input.rankOnly?[]:'));
});

test('transient Riot rank failure does not erase the stored account rank',()=>{
  assert.ok(sync.includes('if(rank){'));
  assert.ok(sync.includes('accountUpdate.rank_tier=rank.tier??null'));
  assert.ok(sync.includes('accountUpdate.rank_division=rank.division??null'));
  assert.ok(sync.includes('accountUpdate.league_points=rank.leaguePoints??null'));
});

test('Companion pairing trusts the selected server account identity and rank',()=>{
  assert.ok(pairing.includes(".eq('user_id',userId).eq('id',accountKey).maybeSingle()"));
  assert.ok(pairing.includes('const storedRank=selected.rank_tier'));
  assert.ok(pairing.includes('rank:storedRank||riotProfile.rank||null'));
  assert.ok(pairing.includes(".eq('user_id',userId).eq('id',selected.id).select('id,game_name,tagline,region').single()"));
});
