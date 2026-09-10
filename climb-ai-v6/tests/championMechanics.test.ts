import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChampionCombatProfile,championEffectOptions,supportedChampionMechanics,
} from '../lib/combat/championEffects';
import {simulateCombo} from '../lib/combat/combos';

test('registry exposes mechanics by capability instead of champion-only switches',()=>{
  const coverage=supportedChampionMechanics();
  const shen=coverage.find(x=>x.champion==='shen');
  const hecarim=coverage.find(x=>x.champion==='hecarim');
  const vex=coverage.find(x=>x.champion==='vex');
  assert.ok(shen?.mechanics.includes('EMPOWERED_AUTO'));
  assert.ok(shen?.mechanics.includes('SHIELD'));
  assert.ok(hecarim?.mechanics.includes('STACK'));
  assert.ok(vex?.mechanics.includes('MARK'));
});

test('mutually exclusive state groups are declared for stateful specialists',()=>{
  const shen=championEffectOptions('Shen').filter(x=>x.id.startsWith('SHEN_Q'));
  const hec=championEffectOptions('Hecarim').filter(x=>x.id.startsWith('HEC_Q'));
  assert.ok(shen.every(x=>x.group==='shen-q'));
  assert.ok(hec.every(x=>x.group==='hec-q'));
});

test('Shen ordinary Q empowers only the next three basic attacks',()=>{
  const profile=buildChampionCombatProfile(
    'Shen',['SHEN_Q'],{Q:3},{abilityPower:0,level:11},
  );
  assert.equal(profile.attackRangeBonus,75);
  assert.equal(profile.onHits[0].firstNAttacks,3);

  const result=simulateCombo({
    sequence:['AA','AA','AA','AA'],abilities:{},
    autoAttack:{damage:0,attackSpeed:1,onHits:profile.onHits},caster:{mana:0},
    target:{health:5000,maxHealth:1000,armor:0,magicResist:0},
  });
  assert.ok(result.events[0].rawDamage>0);
  assert.ok(result.events[2].rawDamage>0);
  assert.equal(result.events[3].rawDamage,0);
});

test('Shen pull-through keeps temporary attack speed visibly partial',()=>{
  const profile=buildChampionCombatProfile(
    'Shen',['SHEN_Q_THROUGH'],{Q:5},{abilityPower:100,level:18},
  );
  assert.ok(profile.modelledEffects.includes('SHEN_Q_THROUGH'));
  assert.ok(profile.unmodelledEffects.includes('SHEN_Q_THROUGH_TEMP_AS'));
});

test('Hecarim Rampage stacks produce an explicit Q modifier',()=>{
  const profile=buildChampionCombatProfile(
    'Hecarim',['HEC_Q_3'],{Q:5},{abilityPower:0,bonusAttackDamage:100,level:18},
  );
  assert.equal(profile.abilityModifiers.Q?.cooldownFlatReduction,2.25);
  assert.equal(profile.abilityModifiers.Q?.damageMultiplier,1.21);
});

test('Viego passive current-health on-hit shrinks as the target loses HP',()=>{
  const profile=buildChampionCombatProfile(
    'Viego',[],{Q:5},{abilityPower:0,level:18},
  );
  const full=simulateCombo({
    sequence:['AA'],abilities:{},autoAttack:{damage:0,attackSpeed:1,onHits:profile.onHits},
    caster:{mana:0},target:{health:1000,maxHealth:1000,armor:0,magicResist:0},
  });
  const low=simulateCombo({
    sequence:['AA'],abilities:{},autoAttack:{damage:0,attackSpeed:1,onHits:profile.onHits},
    caster:{mana:0},target:{health:100,maxHealth:1000,armor:0,magicResist:0},
  });
  assert.ok(full.totalRawDamage>low.totalRawDamage);
  assert.ok(low.totalRawDamage>=30,'minimum-damage floor remains active');
});

test('Vex Gloom can be represented as an opening-auto mark detonation without repeating',()=>{
  const profile=buildChampionCombatProfile(
    'Vex',['VEX_GLOOM_MARK'],{Q:1},{abilityPower:100,level:18},
  );
  const result=simulateCombo({
    sequence:['AA','AA'],abilities:{},
    autoAttack:{damage:0,attackSpeed:1,autoProcs:profile.autoProcs},caster:{mana:0},
    target:{health:1000,maxHealth:1000,armor:0,magicResist:0},
  });
  assert.equal(result.events[0].rawDamage,175);
  assert.equal(result.events[1].rawDamage,0);
  assert.ok(profile.unmodelledEffects.includes('VEX_GLOOM_ABILITY_CONSUMPTION'));
});

test('repeatEvery supports reset/proc patterns without champion-specific loop code',()=>{
  const result=simulateCombo({
    sequence:['AA','AA','AA','AA','AA'],abilities:{},caster:{mana:0},
    autoAttack:{damage:0,attackSpeed:1,autoProcs:[{
      label:'every second',procAtAuto:1,repeatEvery:2,
      damage:{label:'proc',type:'TRUE',flatDamage:10},
    }]},
    target:{health:1000,maxHealth:1000,armor:0,magicResist:0},
  });
  assert.equal(result.events[0].rawDamage,10);
  assert.equal(result.events[1].rawDamage,0);
  assert.equal(result.events[2].rawDamage,10);
  assert.equal(result.events[4].rawDamage,10);
});

test('dynamic missing-health damage is evaluated at the exact ability event',()=>{
  const result=simulateCombo({
    sequence:['AA','R'],caster:{mana:0},
    autoAttack:{damage:500,attackSpeed:1},
    abilities:{R:{
      slot:'R',name:'Execute test',rank:1,cooldownSeconds:100,cost:0,castTimeSeconds:0,
      damage:[],dynamicDamage:[{label:'missing HP',type:'TRUE',targetMissingHealthRatio:.5}],
    }},
    target:{health:1000,maxHealth:1000,armor:0,magicResist:0},
  });
  assert.equal(result.events[1].rawDamage,250);
});

test('transformation and typed-shield gaps stay partial instead of becoming fake stats',()=>{
  const possession=buildChampionCombatProfile('Viego',['VIEGO_POSSESSION'],{}, {abilityPower:0});
  const galio=buildChampionCombatProfile('Galio',['GALIO_W_SHIELD'],{}, {abilityPower:0});
  assert.ok(possession.unmodelledEffects.includes('VIEGO_POSSESSION'));
  assert.ok(galio.unmodelledEffects.includes('GALIO_W_SHIELD'));
  assert.equal(possession.basicAttackDamageMultiplier,1);
  assert.equal(galio.basicAttackDamageMultiplier,1);
});