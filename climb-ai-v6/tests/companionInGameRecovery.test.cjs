const test=require('node:test');
const assert=require('node:assert/strict');

test('a complete live roster restores the player, enemy lane, and both teams',async()=>{
  const {recoveryPregameContext}=await import('../companion/src/in-game-recovery.mjs');
  const players=[
    ['ORDER','Camille','TOP'],['ORDER','Jax','JUNGLE'],['ORDER','Orianna','MIDDLE'],['ORDER','Ashe','BOTTOM'],['ORDER','Braum','UTILITY'],
    ['CHAOS','Wukong','TOP'],['CHAOS',"Bel'Veth",'JUNGLE'],['CHAOS','Ahri','MIDDLE'],['CHAOS','Swain','BOTTOM'],['CHAOS','Lulu','UTILITY'],
  ].map(([team,championName,position],index)=>({team,championName,position,riotId:`player-${index}`}));
  const snapshot={active:{riotId:'player-7',championName:''},players};
  const context=recoveryPregameContext(snapshot);
  assert.equal(context.localChampionName,'Ahri');
  assert.equal(context.localRole,'MID');
  assert.equal(context.localPlayerCellId,2);
  assert.equal(context.allies.length,5);
  assert.equal(context.enemies.length,5);
  assert.equal(context.enemies.find(pick=>pick.role==='MID')?.championName,'Orianna');
  assert.equal(context.allies.find(pick=>pick.role==='SUPPORT')?.championName,'Lulu');
  assert.equal(context.localLockedIn,true);
  assert.equal(recoveryPregameContext({...snapshot,players:players.slice(0,9)}),null);
});
