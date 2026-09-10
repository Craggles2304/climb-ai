import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChampionCombatProfile,championEffectOptions,supportedChampionMechanics,
} from '../lib/combat/championEffects';
import {simulateCombo} from '../lib/combat/combos';
import {
  abilityDamageMultiplier,applyAbilityStackAfterCast,createCombatRuntime,
} from '../lib/combat/state';

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

test("Kog'Maw W expires during a long combat timeline",()=>{
  const profile=buildChampionCombatProfile(
    'KogMaw',['KOG_W'],{Q:1,W:1},{abilityPower:0,level:6},
  );
  const result=simulateCombo({
    sequence:['AA','AA','AA','AA','AA','AA','AA','AA','AA'],abilities:{},
    autoAttack:{damage:0,attackSpeed:1,timedStates:profile.timedAutoStates},caster:{mana:0},
    target:{health:10000,maxHealth:1000,armor:0,magicResist:0},
  });
  assert.ok(result.events[0].rawDamage>0);
  assert.ok(result.events[7].rawDamage>0);
  assert.equal(result.events[8].rawDamage,0,'W must no longer add damage at t=8s');
});

test('Jinx Get Excited attack-speed state changes auto timing only inside six seconds',()=>{
  const profile=buildChampionCombatProfile(
    'Jinx',['JINX_EXCITED_1'],{Q:1},{abilityPower:0,level:6},
  );
  const result=simulateCombo({
    sequence:Array.from({length:10},()=> 'AA' as const),abilities:{},
    autoAttack:{damage:1,attackSpeed:1,timedStates:profile.timedAutoStates,attackSpeedCap:90},caster:{mana:0},
    target:{health:10000,maxHealth:10000,armor:0,magicResist:0},
  });
  assert.equal(result.events[0].state?.timedAuto[0],'Get Excited x1');
  assert.ok(result.events.some(e=>e.atSeconds>=6&&e.state?.timedAuto.length===0));
});

test('Hecarim Rampage starts from selected stacks and builds after successful Q casts',()=>{
  const profile=buildChampionCombatProfile(
    'Hecarim',['HEC_Q_1'],{Q:5},{abilityPower:0,bonusAttackDamage:100,level:18},
  );
  const rule=profile.abilityEventStates.Q?.stackRule;
  assert.ok(rule);
  assert.equal(rule?.startingStacks,1);
  assert.equal(rule?.cooldownFlatReductionPerStack,.75);
  assert.equal(rule?.damageMultiplierPerStack,.07);

  const runtime=createCombatRuntime(rule?[rule]:[]);
  assert.equal(abilityDamageMultiplier(runtime,rule,0),1.07);
  assert.equal(applyAbilityStackAfterCast(runtime,rule,0),2);
  assert.equal(abilityDamageMultiplier(runtime,rule,1),1.14);
  assert.equal(applyAbilityStackAfterCast(runtime,rule,1),3);
  assert.equal(abilityDamageMultiplier(runtime,rule,2),1.21);
  assert.equal(abilityDamageMultiplier(runtime,rule,10),1,'stacks expire after the configured window');
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

test('Vex Gloom is a consumable target mark, not a repeating proc',()=>{
  const profile=buildChampionCombatProfile(
    'Vex',['VEX_GLOOM_MARK'],{Q:1},{abilityPower:100,level:18},
  );
  const result=simulateCombo({
    sequence:['AA','AA'],abilities:{},
    autoAttack:{damage:0,attackSpeed:1,eventState:profile.autoEventState},caster:{mana:0},
    initialTargetMarks:profile.initialTargetMarks,
    target:{health:1000,maxHealth:1000,armor:0,magicResist:0},
  });
  assert.equal(result.events[0].rawDamage,175);
  assert.equal(result.events[1].rawDamage,0);
  assert.ok(profile.unmodelledEffects.includes('VEX_GLOOM_DOOM_REFUND'));
});

test('Vex basic ability can consume Gloom before a later auto',()=>{
  const profile=buildChampionCombatProfile(
    'Vex',['VEX_GLOOM_MARK'],{Q:1},{abilityPower:100,level:18},
  );
  const result=simulateCombo({
    sequence:['Q','AA'],
    abilities:{Q:{
      slot:'Q',name:'Q',rank:1,cooldownSeconds:8,cost:0,castTimeSeconds:.25,
      damage:[{label:'base',type:'MAGIC',raw:100}],eventState:profile.abilityEventStates.Q,
    }},
    autoAttack:{damage:0,attackSpeed:1,eventState:profile.autoEventState},caster:{mana:0},
    initialTargetMarks:profile.initialTargetMarks,
    target:{health:1000,maxHealth:1000,armor:0,magicResist:0},
  });
  assert.equal(result.events[0].rawDamage,275);
  assert.equal(result.events[1].rawDamage,0);
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