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
