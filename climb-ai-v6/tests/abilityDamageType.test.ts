import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveAbilityDamageComponents,
  resolveAbilityDamageType,
  type AbilityCalculation,
  type DataDragonSpell,
} from '../lib/combat/abilities';
import {mitigateAll,noPenetration} from '../lib/combat/damage';

const spell=(extra:Partial<DataDragonSpell>={}):DataDragonSpell=>({
  id:'TestSpell',name:'Test Spell',...extra,
});
const primary=(name:string):Pick<AbilityCalculation,'name'>=>({name});
const calc=(name:string,value:number|null):AbilityCalculation=>({
  name,value,unmodelled:[],primary:false,
});

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

test('separate physical and magic calculations become two same-cast components',()=>{
  const result=resolveAbilityDamageComponents(
    spell(),
    [calc('PhysicalDamage',100),calc('MagicDamage',80)],
    'PHYSICAL',
  );
  assert.equal(result.mixed,true);
  assert.deepEqual(result.components.map(c=>c.type),['PHYSICAL','MAGIC']);
  assert.deepEqual(result.components.map(c=>c.calculation.value),[100,80]);
  assert.deepEqual(result.approximations,[]);
});

test('physical magic and true components are mitigated independently on one cast',()=>{
  const resolution=resolveAbilityDamageComponents(
    spell(),
    [calc('PhysicalDamage',100),calc('MagicDamage',100),calc('TrueDamage',100)],
    'PHYSICAL',
  );
  const damage=resolution.components.map(c=>({
    label:c.calculation.name,
    type:c.type,
    raw:c.calculation.value,
  }));
  const result=mitigateAll(
    damage,
    {armor:100,magicResist:0},
    noPenetration(),
  );
  assert.equal(result.rawTotal,300);
  assert.equal(result.mitigatedTotal,250);
  assert.deepEqual(result.components.map(c=>c.mitigated),[50,100,100]);
});

test('Riot semantic tags can bind differently named formula variables to components',()=>{
  const result=resolveAbilityDamageComponents(
    spell({
      tooltip:'Deals <physicalDamage>{{ damage }}</physicalDamage> plus <magicDamage>{{ bonusmagic }}</magicDamage>.',
    }),
    [calc('Damage',120),calc('BonusMagic',45)],
    'PHYSICAL',
  );
  assert.equal(result.mixed,true);
  assert.deepEqual(result.components.map(c=>[c.calculation.name,c.type]),[
    ['Damage','PHYSICAL'],
    ['BonusMagic','MAGIC'],
  ]);
});

test('empowered variant is not auto-added as a second damage component',()=>{
  const result=resolveAbilityDamageComponents(
    spell(),
    [calc('PhysicalDamage',100),calc('EmpoweredMagicDamage',200)],
    'PHYSICAL',
  );
  assert.equal(result.mixed,false);
  assert.equal(result.components.length,1);
  assert.equal(result.components[0].calculation.name,'PhysicalDamage');
  assert.equal(result.components[0].type,'PHYSICAL');
});

test('maximum and minimum variants remain alternatives rather than components',()=>{
  const result=resolveAbilityDamageComponents(
    spell(),
    [calc('MagicDamage',90),calc('MaximumTrueDamage',300),calc('MinimumPhysicalDamage',20)],
    'MAGIC',
  );
  assert.equal(result.mixed,false);
  assert.equal(result.components.length,1);
  assert.equal(result.components[0].calculation.name,'MagicDamage');
});
