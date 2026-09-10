import test from 'node:test';
import assert from 'node:assert/strict';
import {attachAbilityOnHitEffects,withOpeningBasicAttackReplacement} from '../lib/combat/attackInteractions';
import {
  applyConfiguredAttackReplacement,configureChampionAttackReplacement,validatedGalioPatch,
} from '../lib/combat/championAttackReplacements';
import {buildChampionCombatProfile} from '../lib/combat/championEffects';
import {simulateCombo,type AbilityModel,type AutoAttackModel} from '../lib/combat/combos';

const ability=():AbilityModel=>({
  slot:'R',name:'On-hit spell',rank:1,cooldownSeconds:10,cost:0,castTimeSeconds:0,
  damage:[],
});

test('ability on-hit forwarding includes only explicitly eligible effects',()=>{
  const r=ability();
  const result=attachAbilityOnHitEffects(r,[
    {label:'eligible item',type:'MAGIC',flatDamage:40,appliesFromAbility:true},
    {label:'attack-only steroid',type:'MAGIC',flatDamage:999},
  ],{label:'Spell on-hit',effectiveness:1});

  assert.equal(result.applied,true);
  assert.equal(result.count,1);
  assert.equal(r.dynamicDamage?.length,1);
  assert.equal(r.dynamicDamage?.[0].flatDamage,40);
  assert.match(r.dynamicDamage?.[0].label??'',/eligible item/);
});

test('ability on-hit effectiveness scales flat, health ratios and minimum floors',()=>{
  const r=ability();
  attachAbilityOnHitEffects(r,[{
    label:'half-effect',type:'PHYSICAL',flatDamage:20,targetCurrentHealthRatio:.10,
    targetMissingHealthRatio:.04,minimumDamage:30,appliesFromAbility:true,
  }],{label:'50 percent spell',effectiveness:.5});
  const effect=r.dynamicDamage?.[0];
  assert.equal(effect?.flatDamage,10);
  assert.equal(effect?.targetCurrentHealthRatio,.05);
  assert.equal(effect?.targetMissingHealthRatio,.02);
  assert.equal(effect?.minimumDamage,15);
});

test('opening replacement removes ordinary physical auto instead of double counting it',()=>{
  const base:AutoAttackModel={
    damage:100,attackSpeed:1,
    onHits:[{label:'ordinary item on-hit',type:'PHYSICAL',flatDamage:10}],
  };
  const replacement=withOpeningBasicAttackReplacement(base,{
    id:'TEST_REPLACEMENT',label:'Magic replacement',firstNAttacks:1,
    damage:[{label:'replacement total',type:'MAGIC',flatDamage:150}],
  });
  assert.equal(replacement.applied,true);

  const result=simulateCombo({
    sequence:['AA','AA'],abilities:{},autoAttack:replacement.model,caster:{mana:0},
    target:{health:1000,maxHealth:1000,armor:0,magicResist:0},
  });
  // First attack: 150 replacement + 10 item on-hit. No extra 100 physical auto.
  assert.equal(result.events[0].rawDamage,160);
  // Second attack: ordinary 100 physical + the same 10 item on-hit.
  assert.equal(result.events[1].rawDamage,110);
});

test('multi-attack replacement hands back to ordinary attacks after its window',()=>{
  const result=withOpeningBasicAttackReplacement({damage:80,attackSpeed:1},{
    id:'THREE_HIT',label:'Three-hit replacement',firstNAttacks:3,
    damage:[{label:'replacement',type:'TRUE',flatDamage:50}],
  });
  const sim=simulateCombo({
    sequence:['AA','AA','AA','AA'],abilities:{},autoAttack:result.model,caster:{mana:0},
    target:{health:1000,maxHealth:1000,armor:0,magicResist:0},
  });
  assert.deepEqual(sim.events.map(x=>x.rawDamage),[50,50,50,80]);
});

test('replacement refuses a time-varying base-damage state it cannot preserve safely',()=>{
  const base:AutoAttackModel={
    damage:100,attackSpeed:1,
    timedStates:[{id:'BUFF',label:'Timed base multiplier',durationSeconds:3,basicAttackDamageMultiplier:1.5}],
  };
  const result=withOpeningBasicAttackReplacement(base,{
    id:'REPLACE',label:'Replacement',damage:[{label:'magic total',type:'MAGIC',flatDamage:150}],
  });
  assert.equal(result.applied,false);
  assert.equal(result.model,base);
  assert.match(result.note,/cannot represent that safely/i);
});

test('Galio Colossal Smash uses current 16.18 replacement scaling and removes the normal auto',()=>{
  const profile=buildChampionCombatProfile(
    'Galio',['GALIO_PASSIVE_READY'],{}, {abilityPower:200,level:18},
  );
  configureChampionAttackReplacement('Galio',['GALIO_PASSIVE_READY'],profile,{
    patch:'16.18.1',level:18,attackDamage:100,abilityPower:200,bonusMagicResist:50,critChance:0,
  });

  // 115 level base + 100 total AD + 80 AP + 30 bonus MR = 325 magic.
  const replacement=profile.autoEventState.replacement;
  assert.equal(replacement?.damage[0].flatDamage,325);
  assert.equal(replacement?.damage[0].type,'MAGIC');
  assert.ok(profile.modelledEffects.includes('GALIO_COLOSSAL_SMASH_OPENING_REPLACEMENT'));
  assert.ok(!profile.unmodelledEffects.includes('GALIO_PASSIVE_READY'));

  const model=applyConfiguredAttackReplacement({damage:100,attackSpeed:1,eventState:profile.autoEventState},profile);
  const sim=simulateCombo({
    sequence:['AA','AA'],abilities:{},autoAttack:model,caster:{mana:0},
    target:{health:1000,maxHealth:1000,armor:100,magicResist:100},
  });
  // Opening replacement goes through MR: 325 -> 162.5. Second ordinary auto goes through armor: 100 -> 50.
  assert.equal(sim.events[0].mitigatedDamage,162.5);
  assert.equal(sim.events[1].mitigatedDamage,50);
});

test('Galio passive remains explicit about timing pieces not yet modelled',()=>{
  const profile=buildChampionCombatProfile('Galio',['GALIO_PASSIVE_READY'],{}, {abilityPower:0,level:6});
  configureChampionAttackReplacement('Galio',['GALIO_PASSIVE_READY'],profile,{
    patch:'16.18.1',level:6,attackDamage:75,abilityPower:0,bonusMagicResist:0,critChance:.25,
  });
  assert.ok(profile.unmodelledEffects.includes('GALIO_PASSIVE_RECHARGE_TIMELINE'));
  assert.ok(profile.unmodelledEffects.includes('GALIO_PASSIVE_WINDUP_AS'));
  assert.ok(profile.unmodelledEffects.includes('GALIO_PASSIVE_CRIT_AD_RATIO'));
});

test('Galio replacement fails closed on an unreviewed future patch',()=>{
  assert.equal(validatedGalioPatch('16.18.1'),true);
  assert.equal(validatedGalioPatch('16.19.1'),false);
  const profile=buildChampionCombatProfile('Galio',['GALIO_PASSIVE_READY'],{}, {abilityPower:0,level:18});
  configureChampionAttackReplacement('Galio',['GALIO_PASSIVE_READY'],profile,{
    patch:'16.19.1',level:18,attackDamage:100,abilityPower:0,bonusMagicResist:0,critChance:0,
  });
  assert.equal(profile.autoEventState.replacement,undefined);
  assert.ok(profile.unmodelledEffects.includes('GALIO_PASSIVE_PATCH_UNVALIDATED'));
});