const test=require('node:test');
const assert=require('node:assert/strict');
test('champ select keeps explicit role and falls back to Smite for jungle',async()=>{
  const {normalizePregame}=await import('../companion/src/pregame-normalizer.mjs');
  const fixture={localPlayerCellId:1,myTeam:[{cellId:1,championId:222,assignedPosition:'UTILITY',spell1Id:11}],theirTeam:[]};
  const explicit=await normalizePregame(fixture,async()=> 'Jinx');
  assert.equal(explicit.localRole,'SUPPORT');
  const inferred=await normalizePregame({...fixture,myTeam:[{cellId:1,championId:222,spell1Id:11}]},async()=> 'Jinx');
  assert.equal(inferred.localRole,'JUNGLE');
});
