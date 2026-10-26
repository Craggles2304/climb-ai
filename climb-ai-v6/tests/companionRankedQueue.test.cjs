const test=require('node:test');
const assert=require('node:assert/strict');
test('LCU queue identity distinguishes Solo/Duo from Flex and normals',async()=>{
  const {queueIdFromGameflow}=await import('../companion/src/in-game-recovery.mjs');
  assert.equal(queueIdFromGameflow({gameData:{queue:{id:420}}}),420);
  assert.equal(queueIdFromGameflow({gameData:{queue:{id:440}}}),440);
  assert.equal(queueIdFromGameflow({gameData:{queueId:400}}),400);
  assert.equal(queueIdFromGameflow({gameData:{gameMode:'CLASSIC'}}),null);
  assert.equal(queueIdFromGameflow({gameData:{queue:{id:'420'}}}),null);
  assert.equal(queueIdFromGameflow(null),null);
});

const fs=require('node:fs');
const tracker=fs.readFileSync('companion/src/main.mjs','utf8');

test('a failed queue lookup does not erase the id Riot already gave this game',()=>{
  // The old code did `catch{observedQueueId=null}`, so one LCU hiccup turned a
  // verified Ranked Solo/Duo game into an unverified one and the recording was
  // dropped. Only a positive id may be assigned now.
  assert.match(tracker,/const found=queueIdFromGameflow\(await lcuJson\('\/lol-gameflow\/v1\/session'\)\);\s*\r?\n\s*if\(found!=null\)observedQueueId=found;/);
  assert.doesNotMatch(tracker,/catch\{observedQueueId=null\}/);
});

test('the queue is re-read immediately while it is still unknown',()=>{
  // Waiting out the 5s throttle during the opening ticks is what loses games.
  assert.match(tracker,/if\(phaseChanged\|\|observedQueueId==null\|\|Date\.now\(\)-lastQueueLookupAt>5000\)/);
});

test('leaving a game is still the only thing that clears the queue identity',()=>{
  // Otherwise a remembered id could leak from one game into the next.
  assert.match(tracker,/\['None','Lobby','Matchmaking','ReadyCheck'\]\.includes\(phase\)\)\{observedQueueId=null;clearSkipSignature\(\)\}/);
  // Two and only two: the initialiser on line 64 and this lobby reset.
  assert.equal((tracker.match(/observedQueueId=null/g)||[]).length,2);
});
