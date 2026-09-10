import test from 'node:test';
import assert from 'node:assert/strict';
import {assessConfidence} from '../lib/combat/confidence';
import type {AssembledKit,AssembledAbility} from '../lib/combat/abilities';
import {buildChampionCombatProfile} from '../lib/combat/championEffects';
import {applyConditionalChampionSpells} from '../lib/combat/conditionalChampionSpells';
import {resolveSpellCastVariant} from '../lib/combat/spellVariants';

const calc=(name:string,value:number|null,primary=false)=>({name,value,unmodelled:[] as string[],primary});
const ability=(overrides:Partial<AssembledAbility>={}):AssembledAbility=>({
  slot:'Q',name:'Test Spell',rank:1,maxRank:5,cooldownSeconds:8,cost:60,
  rangeUnits:1000,castTimeSeconds:.25,
  damage:[{label:'Damage',type:'MAGIC',raw:100}],
  calculations:[calc('Damage',100,true)],
  damageType:'MAGIC',damageTypes:['MAGIC'],damageTypeSource:'CALCULATION_NAME',
  confidence:assessConfidence({}),...overrides,
});
const kitWith=(q:AssembledAbility):AssembledKit=>({
  abilities:{Q:q},
  models:{Q:{slot:'Q',name:q.name,rank:q.rank,cooldownSeconds:q.cooldownSeconds,cost:q.cost,castTimeSeconds:q.castTimeSeconds,damage:q.damage}},
  confidence:q.confidence,
});

test('five-hit repeat resolves first hit plus four reduced hits to 260 percent',()=>{
  const result=resolveSpellCastVariant(ability(),{
    kind:'REPEAT_PRIMARY',effectId:'TEST_FULL',label:'All five',
    totalHits:5,firstHitMultiplier:1,repeatHitMultiplier:.4,
  });
  assert.equal(result.applied,true);
  assert.deepEqual(result.damage.map(x=>x.raw),[100,40,40,40,40]);
  assert.equal(result.damage.reduce((n,x)=>n+(x.raw??0),0),260);
});

test('repeat-primary preserves independently typed mixed components on every hit',()=>{
  const result=resolveSpellCastVariant(ability({
    damage:[
      {label:'PhysicalDamage',type:'PHYSICAL',raw:100},
      {label:'MagicDamage',type:'MAGIC',raw:50},
    ],
    calculations:[calc('PhysicalDamage',100,true),calc('MagicDamage',50,true)],
    damageType:null,damageTypes:['PHYSICAL','MAGIC'],damageTypeSource:'MULTI_COMPONENT',
  }),{
    kind:'REPEAT_PRIMARY',effectId:'MIXED_REPEAT',label:'Two hits',
    totalHits:2,repeatHitMultiplier:.5,
  });
  assert.equal(result.applied,true);
  assert.deepEqual(result.damage.map(x=>[x.type,x.raw]),[
    ['PHYSICAL',100],['MAGIC',50],['PHYSICAL',50],['MAGIC',25],
  ]);
});

test('already-totalled base label is refused instead of multiplying damage twice',()=>{
  const result=resolveSpellCastVariant(ability({
    damage:[{label:'FiveRockTotalDamage',type:'MAGIC',raw:260}],
    calculations:[calc('FiveRockTotalDamage',260,true)],
  }),{
    kind:'REPEAT_PRIMARY',effectId:'TALIYAH_Q_FULL',label:'All five',
    totalHits:5,repeatHitMultiplier:.4,forbiddenBaseLabelTokens:['total','five'],
  });
  assert.equal(result.applied,false);
  assert.match(result.reason??'',/already looks like/i);
});

test('named conditional formula is selected only when one source match wins',()=>{
  const result=resolveSpellCastVariant(ability({
    calculations:[calc('Damage',100,true),calc('MaximumDamage',240),calc('MinimumDamage',80)],
  }),{
    kind:'SELECT_CALCULATION',effectId:'MAX_CAST',label:'Maximum charge',
    calculationNameCandidates:['MaximumDamage'],damageType:'MAGIC',
  });
  assert.equal(result.applied,true);
  assert.equal(result.damage[0].raw,240);
  assert.deepEqual(result.primaryCalculationNames,['MaximumDamage']);
});

test('ambiguous conditional formula match fails rather than choosing one arbitrarily',()=>{
  const result=resolveSpellCastVariant(ability({
    calculations:[calc('MaximumDamageInner',210),calc('MaximumDamageOuter',230)],
  }),{
    kind:'SELECT_CALCULATION',effectId:'MAX_CAST',label:'Maximum charge',
    calculationNameCandidates:['MaximumDamage'],damageType:'MAGIC',
  });
  assert.equal(result.applied,false);
  assert.match(result.reason??'',/more than one equally strong/i);
});

test('validated scaled form changes damage and resource cost deterministically',()=>{
  const result=resolveSpellCastVariant(ability(),{
    kind:'SCALE_PRIMARY',effectId:'WORKED',label:'Worked Ground',
    multiplier:1.9,costOverride:20,
  });
  assert.equal(result.applied,true);
  assert.equal(result.damage[0].raw,190);
  assert.equal(result.cost,20);
});

test('component filter keeps only explicitly requested resistance buckets',()=>{
  const result=resolveSpellCastVariant(ability({
    damage:[
      {label:'PhysicalDamage',type:'PHYSICAL',raw:100},
      {label:'MagicDamage',type:'MAGIC',raw:80},
      {label:'TrueDamage',type:'TRUE',raw:50},
    ],
  }),{
    kind:'FILTER_COMPONENTS',effectId:'MAGIC_TRUE_ONLY',label:'Secondary package',
    includeTypes:['MAGIC','TRUE'],
  });
  assert.equal(result.applied,true);
  assert.deepEqual(result.damage.map(x=>x.type),['MAGIC','TRUE']);
});

test('Taliyah all-five state promotes from partial only after source-safe variant resolves',()=>{
  const profile=buildChampionCombatProfile('Taliyah',['TALIYAH_Q_FULL'],{Q:1},{abilityPower:0,level:6});
  assert.ok(profile.unmodelledEffects.includes('TALIYAH_Q_FULL'));
  const kit=kitWith(ability({name:'Threaded Volley'}));
  applyConditionalChampionSpells('Taliyah',['TALIYAH_Q_FULL'],kit,profile);
  assert.ok(profile.modelledEffects.includes('TALIYAH_Q_FULL'));
  assert.ok(!profile.unmodelledEffects.includes('TALIYAH_Q_FULL'));
  assert.equal(kit.models.Q?.damage.reduce((n,x)=>n+(x.raw??0),0),260);
});

test('Taliyah Worked Ground applies 190 percent and 20 mana but keeps cooldown floor partial',()=>{
  const profile=buildChampionCombatProfile('Taliyah',['TALIYAH_Q_WORKED'],{Q:1},{abilityPower:0,level:6});
  const kit=kitWith(ability({name:'Threaded Volley',cost:55}));
  applyConditionalChampionSpells('Taliyah',['TALIYAH_Q_WORKED'],kit,profile);
  assert.ok(profile.modelledEffects.includes('TALIYAH_Q_WORKED'));
  assert.equal(kit.models.Q?.damage[0].raw,190);
  assert.equal(kit.models.Q?.cost,20);
  assert.ok(profile.unmodelledEffects.includes('TALIYAH_Q_WORKED_COOLDOWN'));
});

test('source-gated Taliyah state remains partial when base formula looks pre-totalled',()=>{
  const profile=buildChampionCombatProfile('Taliyah',['TALIYAH_Q_FULL'],{Q:1},{abilityPower:0,level:6});
  const q=ability({
    name:'Threaded Volley',
    damage:[{label:'FiveRockTotalDamage',type:'MAGIC',raw:260}],
    calculations:[calc('FiveRockTotalDamage',260,true)],
  });
  const kit=kitWith(q);
  applyConditionalChampionSpells('Taliyah',['TALIYAH_Q_FULL'],kit,profile);
  assert.ok(profile.unmodelledEffects.includes('TALIYAH_Q_FULL'));
  assert.ok(!profile.modelledEffects.includes('TALIYAH_Q_FULL'));
  assert.equal(kit.models.Q?.damage[0].raw,260);
});