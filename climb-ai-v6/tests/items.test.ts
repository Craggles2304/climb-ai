import test from 'node:test';
import assert from 'node:assert/strict';
import {isCompletedItem,completedItemIdsFrom,MIN_COMPLETED_GOLD} from '../lib/riot/items';

/**
 * Shapes taken from real Data Dragon payloads. The depth-2 legendaries are the
 * regression this file exists for: requiring depth >= 3 excluded Infinity Edge
 * and Rabadon's Deathcap, which cost us the second-item timing in 6 of 20 real
 * ranked games and the third in 12.
 */

const INFINITY_EDGE={from:['3006','1038'],depth:2,gold:{total:3500},maps:{'11':true},tags:['CriticalStrike','Damage']};
const RABADONS={from:['1058','1026'],depth:2,gold:{total:3500},maps:{'11':true},tags:['SpellDamage']};
const BF_SWORD={into:['3031','3072'],gold:{total:1300},maps:{'11':true},tags:['Damage']};
const HEALTH_POTION={gold:{total:50},maps:{'11':true},tags:['Consumable']};
const TRINKET={gold:{total:0},maps:{'11':true},tags:['Trinket','Vision']};
const ARAM_ONLY={from:['1038'],gold:{total:2500},maps:{'11':false,'12':true},tags:['Damage']};
const LONG_SWORD={into:['3134'],gold:{total:350},maps:{'11':true},tags:['Damage']};

test('counts depth-2 legendaries — the bug this file exists for',()=>{
  assert.equal(isCompletedItem(INFINITY_EDGE),true,'Infinity Edge must count as completed');
  assert.equal(isCompletedItem(RABADONS),true,"Rabadon's Deathcap must count as completed");
});

test('rejects components that build into something else',()=>{
  assert.equal(isCompletedItem(BF_SWORD),false,'B.F. Sword builds into IE, it is not finished');
  assert.equal(isCompletedItem(LONG_SWORD),false);
});

test('rejects consumables and trinkets',()=>{
  assert.equal(isCompletedItem(HEALTH_POTION),false);
  assert.equal(isCompletedItem(TRINKET),false);
});

test('rejects items not available on Summoner\'s Rift',()=>{
  assert.equal(isCompletedItem(ARAM_ONLY),false);
});

test('rejects a finished-looking item that is too cheap to be a real purchase',()=>{
  const cheap={from:['1001'],gold:{total:MIN_COMPLETED_GOLD-1},maps:{'11':true},tags:['Boots']};
  assert.equal(isCompletedItem(cheap),false);
  const atThreshold={...cheap,gold:{total:MIN_COMPLETED_GOLD}};
  assert.equal(isCompletedItem(atThreshold),true,'the threshold itself should pass');
});

test('rejects a starting item with no components',()=>{
  const doran={gold:{total:450},maps:{'11':true},tags:['Damage']};
  assert.equal(isCompletedItem(doran),false,'no components means it was never built');
});

test('handles missing or malformed fields without throwing',()=>{
  for(const bad of [{},{gold:undefined},{from:[],into:[]},{tags:undefined,maps:undefined}]){
    assert.doesNotThrow(()=>isCompletedItem(bad));
    assert.equal(isCompletedItem(bad),false,'incomplete data must never count as a completed item');
  }
});

test('builds an id set from a Data Dragon payload',()=>{
  const ids=completedItemIdsFrom({
    '3031':INFINITY_EDGE,'3089':RABADONS,'1038':BF_SWORD,'2003':HEALTH_POTION,
  });
  assert.deepEqual([...ids].sort((a,b)=>a-b),[3031,3089]);
});
