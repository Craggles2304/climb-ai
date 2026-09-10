import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveAbilityDamageType,
  type AbilityCalculation,
  type DataDragonSpell,
} from '../lib/combat/abilities';

const spell=(extra:Partial<DataDragonSpell>={}):DataDragonSpell=>({
  id:'TestSpell',name:'Test Spell',...extra,
});
const primary=(name:string):Pick<AbilityCalculation,'name'>=>({name});

test('CommunityDragon calculation name can override champion physical fallback',()=>{
  const result=resolveAbilityDamageType(spell(),primary('MagicDamage'),'PHYSICAL');
  assert.equal(result.type,'MAGIC');
  assert.equal(result.source,'CALCULATION_NAME');
  assert.deepEqual(result.approximations,[]);
});

test('true damage is resolved from explicit Riot spell text',()=>{
  const result=resolveAbilityDamageType(
    spell({description:'Deals true damage to the target.'}),
    primary('Damage'),
    'PHYSICAL',
  );
  assert.equal(result.type,'TRUE');
  assert.equal(result.source,'SPELL_TEXT');
  assert.deepEqual(result.approximations,[]);
});

test('Data Dragon semantic damage markup is treated as explicit evidence',()=>{
  const result=resolveAbilityDamageType(
    spell({tooltip:'Deals <magicDamage>{{ damage }} magic damage</magicDamage>.'}),
    primary('Damage'),
    'PHYSICAL',
  );
  assert.equal(result.type,'MAGIC');
  assert.equal(result.source,'SPELL_TEXT');
});

test('physical spell text can override a magic-heavy champion fallback',()=>{
  const result=resolveAbilityDamageType(
    spell({tooltip:'Strikes the enemy for physical damage.'}),
    primary('TotalDamage'),
    'MAGIC',
  );
  assert.equal(result.type,'PHYSICAL');
  assert.equal(result.source,'SPELL_TEXT');
});

test('mixed damage text is not silently collapsed into the first type',()=>{
  const result=resolveAbilityDamageType(
    spell({description:'Deals physical damage and bonus magic damage.'}),
    primary('Damage'),
    'PHYSICAL',
  );
  assert.equal(result.type,'PHYSICAL');
  assert.equal(result.source,'CHAMPION_FALLBACK');
  assert.ok(result.approximations[0]?.includes('multiple damage types'));
});

test('ambiguous spells retain the fallback but advertise the approximation',()=>{
  const result=resolveAbilityDamageType(
    spell({description:'Strikes the target and slows them.'}),
    primary('Damage'),
    'MAGIC',
  );
  assert.equal(result.type,'MAGIC');
  assert.equal(result.source,'CHAMPION_FALLBACK');
  assert.ok(result.approximations.length>0);
});

test('non-damaging abilities do not create a fake damage type warning',()=>{
  const result=resolveAbilityDamageType(spell(),null,'PHYSICAL');
  assert.equal(result.type,null);
  assert.equal(result.source,'NONE');
  assert.deepEqual(result.approximations,[]);
});

test('conflicting calculation-name types lower confidence rather than guessing',()=>{
  const result=resolveAbilityDamageType(
    spell(),
    primary('PhysicalDamagePlusMagicDamage'),
    'MAGIC',
  );
  assert.equal(result.type,'MAGIC');
  assert.equal(result.source,'CHAMPION_FALLBACK');
  assert.ok(result.approximations[0]?.includes('multiple damage types'));
});
