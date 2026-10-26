const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const tracker=fs.readFileSync('companion/src/main.mjs','utf8');
const desktop=fs.readFileSync('companion/electron/main.cjs','utf8');
const home=fs.readFileSync('companion/electron/home-view.js','utf8');
const css=fs.readFileSync('companion/electron/home.css','utf8');

test('the tracker reports a skipped game instead of dropping it silently',()=>{
  assert.match(tracker,/if\(snapshot\.queueId!==420&&!session\)\{[\s\S]*?reportSkippedGame\(snapshot,observedQueueId\);[\s\S]*?return;/);
  assert.match(tracker,/console\.log\('OP_SKIPPED_GAME '\+JSON\.stringify\(/);
  assert.match(tracker,/reason:queueId==null\?'QUEUE_UNVERIFIED':'NOT_RANKED_SOLO'/);
});

test('each skipped game is reported once, and the next game can report again',()=>{
  // One live game ticks many times; without the signature the desktop would
  // collect the same skip over and over.
  assert.match(tracker,/if\(signature===lastSkipSignature\)return;/);
  assert.match(tracker,/lastSkipSignature=signature;/);
  assert.match(tracker,/\['None','Lobby','Matchmaking','ReadyCheck'\]\.includes\(phase\)\)\{observedQueueId=null;clearSkipSignature\(\)\}/);
});

test('the desktop keeps the last few skipped games in state',()=>{
  assert.match(desktop,/const SKIPPED_GAME_PREFIX='OP_SKIPPED_GAME ';/);
  assert.match(desktop,/let state=\{rankedSoloOnly:true,skippedGames:\[\],/);
  assert.match(desktop,/setState\(\{skippedGames:\[entry,\.\.\.\(state\.skippedGames\|\|\[\]\)\]\.slice\(0,5\)\}\)/);
  // Structured lines must not fall through to the raw diagnostics log.
  assert.match(desktop,/clean\.startsWith\(SKIPPED_GAME_PREFIX\)\)\{parseTrackerLine\(clean,kind\);return\}/);
});

test('Home shows what was skipped and why, and repaints when the list grows',()=>{
  assert.match(home,/function skippedSection\(state\)\{/);
  assert.match(home,/\$\{skippedSection\(state\)\}/);
  assert.match(home,/Queue could not be read from the League client/);
  assert.match(home,/Not Ranked Solo\/Duo/);
  assert.match(home,/Only Ranked Solo\/Duo games progress your DNA/);
  assert.match(home,/stage,home,\(state\.skippedGames\|\|\[\]\)\.length,/);
  assert.match(css,/\.oc-skipped__list\{/);
});

test('an empty list renders nothing at all',()=>{
  assert.match(home,/if\(!rows\.length\)return'';/);
});

const reviewApi=fs.readFileSync('app/api/live/companion-review/route.ts','utf8');

test('a game refused for an unlinked account is reported, not returned as an empty review',()=>{
  assert.match(reviewApi,/attribution\?\.status==='UNLINKED'/);
  assert.match(reviewApi,/reason:'UNLINKED_RIOT_ACCOUNT'/);
  assert.match(reviewApi,/observed:String\(attribution\.observed\|\|''\)/);
  // It must be decided before the review is assembled, or the player gets a
  // review of a game that was never saved.
  assert.ok(reviewApi.indexOf("attribution?.status==='UNLINKED'")<reviewApi.indexOf('const riotReview=await recentRiotReview'));
});

test('the desktop files a refused game into the same Not recorded list',()=>{
  assert.match(desktop,/body\?\.notRecorded/);
  assert.match(desktop,/skippedGames:\[body\.notRecorded,\.\.\.\(state\.skippedGames\|\|\[\]\)\]\.slice\(0,5\)/);
  // Stop polling: no review is ever coming for a game that was not recorded.
  assert.match(desktop,/body\?\.notRecorded\)\{\s*\r?\n\s*stopPostGameReviewPoll\(\);/);
});

test('Home names the account that played a refused game',()=>{
  assert.match(home,/row\.reason==='UNLINKED_RIOT_ACCOUNT'/);
  assert.match(home,/Not linked to your OP CLIMB account/);
});
