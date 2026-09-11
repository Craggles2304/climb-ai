import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveRangeAccess} from '../lib/combat/rangeAccess';
import {simulateCombo,type AbilityModel} from '../lib/combat/combos';

const spell=(rangeUnits:number|null):AbilityModel=>({
  slot:'Q',name:'Range Test Q',rank:1,cooldownSeconds:8,cost:50,castTimeSeconds:.25,
  rangeUnits,damage:[{label:'Q damage',type:'MAGIC',raw:200}],
});

test('explicit distance inside explicit range is deterministic IN_RANGE',()=>{
  const access=resolveRangeAccess(500,650,'Q');
  assert.equal(access.status,'IN_RANGE');
  assert.equal(access.marginUnits,150);
});

test('explicit distance outside explicit range is deterministic OUT_OF_RANGE',()=>{
  const access=resolveRangeAccess(700,650,'Q');
  assert.equal(access.status,'OUT_OF_RANGE');
  assert.equal(access.marginUnits,-50);
  assert.match(access.note,/blocked/i);
});

test('missing distance never invents geometry',()=>{
  const access=resolveRangeAccess(undefined,650,'Q');
  assert.equal(access.status,'UNKNOWN');
});

test('zero Riot range is UNKNOWN instead of a fake zero-range block',()=>{
  const access=resolveRangeAccess(300,0,'self centred spell');
  assert.equal(access.status,'UNKNOWN');
});

test('out-of-range auto spends no resource and deals no damage',()=>{
  const result=simulateCombo({
    sequence:['AA'],abilities:{},
    autoAttack:{damage:100,attackSpeed:1,rangeUnits:550,resourceCost:20},
    caster:{mana:100},targetDistanceUnits:600,
    target:{health:1000,maxHealth:1000,armor:0,magicResist:0},
  });
  assert.equal(result.events[0].status,'OUT_OF_RANGE');
  assert.equal(result.events[0].rawDamage,0);
  assert.equal(result.events[0].manaRemaining,100);
  assert.equal(result.minimumDurationSeconds,0);
});

test('out-of-range ability spends no mana, does no damage and does not consume time',()=>{
  const result=simulateCombo({
    sequence:['Q','AA'],abilities:{Q:spell(500)},
    autoAttack:{damage:100,attackSpeed:1,rangeUnits:700},
    caster:{mana:100},targetDistanceUnits:600,
    target:{health:1000,maxHealth:1000,armor:0,magicResist:0},
  });
  assert.equal(result.events[0].status,'OUT_OF_RANGE');
  assert.equal(result.events[0].manaRemaining,100);
  assert.equal(result.events[0].rawDamage,0);
  // AA is explicitly in range and can start immediately because movement was not invented.
  assert.equal(result.events[1].status,'CAST');
  assert.equal(result.events[1].atSeconds,0);
  assert.equal(result.events[1].rawDamage,100);
});

test('unknown ability range preserves the cast rather than falsely blocking it',()=>{
  const result=simulateCombo({
    sequence:['Q'],abilities:{Q:spell(null)},autoAttack:{damage:100,attackSpeed:1,rangeUnits:550},
    caster:{mana:100},targetDistanceUnits:1000,
    target:{health:1000,maxHealth:1000,armor:0,magicResist:0},
  });
  assert.equal(result.events[0].status,'CAST');
  assert.equal(result.events[0].rawDamage,200);
});
