import test from 'node:test';
import assert from 'node:assert/strict';
import {assessConfidence} from '../lib/combat/confidence';
import type {AssembledAbility,AssembledKit} from '../lib/combat/abilities';
import {buildChampionCombatProfile} from '../lib/combat/championEffects';
import {applyExecuteChampionSpells,validatedCurrentPatch} from '../lib/combat/executeChampionSpells';
import {simulateCombo} from '../lib/combat/combos';

const ability=(name:string,slot:'R'='R',rank=1):AssembledAbility=>({
  slot,name,rank,maxRank:3,cooldownSeconds:100,cost:0,rangeUnits:400,castTimeSeconds:.25,
  damage:[{label:'ImportedDamage',type:'TRUE',raw:null,unmodelled:['target health required']}],
  calculations:[{name:'Damage',value:null,unmodelled:['target health required'],primary:true}],
  damageType:'TRUE',damageTypes:['TRUE'],damageTypeSource:'SPELL_TEXT',
  confidence:assessConfidence({unmodelled:['target health required']}),
});

const kitWith=(r:AssembledAbility):AssembledKit=>({
  abilities:{R:r},
  models:{R:{slot:'R',name:r.name,rank:r.rank,cooldownSeconds:r.cooldownSeconds,cost:r.cost,castTimeSeconds:r.castTimeSeconds,damage:r.damage}},
  confidence:r.confidence,
});

test('execute rules fail closed outside the explicitly validated live patch',()=>{
  assert.equal(validatedCurrentPatch('16.18.1'),true);
  assert.equal(validatedCurrentPatch('16.19.1'),false);
  assert.equal(validatedCurrentPatch('26.18'),false,'Data Dragon versioning is used, not marketing season numbering');
});

test('Garen R replaces unresolved imported damage with exact current-patch dynamic true damage',()=>{
  const ranks={R:3};
  const profile=buildChampionCombatProfile('Garen',[],ranks,{abilityPower:0,level:18});
  const kit=kitWith(ability('Demacian Justice','R',3));
  applyExecuteChampionSpells('Garen',kit,profile,{patch:'16.18.1',bonusAttackDamage:0,ranks});

  assert.equal(kit.models.R?.damage.length,0);
  assert.equal(kit.models.R?.dynamicDamage?.[0].flatDamage,275);
  assert.equal(kit.models.R?.dynamicDamage?.[0].targetMissingHealthRatio,.35);
  assert.ok(profile.modelledEffects.includes('GAREN_R_DYNAMIC_EXECUTE'));
  assert.equal(kit.abilities.R?.confidence.level,'HIGH');
});

test('Garen R reads missing HP at the exact R event after earlier combo damage',()=>{
  const ranks={R:3};
  const profile=buildChampionCombatProfile('Garen',[],ranks,{abilityPower:0,level:18});
  const kit=kitWith(ability('Demacian Justice','R',3));
  applyExecuteChampionSpells('Garen',kit,profile,{patch:'16.18.1',bonusAttackDamage:0,ranks});

  const result=simulateCombo({
    sequence:['AA','R'],abilities:kit.models,
    autoAttack:{damage:200,attackSpeed:1},caster:{mana:0},
    target:{health:1000,maxHealth:1000,armor:0,magicResist:0},
  });

  // AA leaves 800 HP, so R sees 200 missing HP: 275 + 35% of 200 = 345.
  assert.equal(result.events[1].rawDamage,345);
  assert.equal(result.totalRawDamage,545);
});

test('Garen execute is not silently carried into an unreviewed future patch',()=>{
  const ranks={R:3};
  const profile=buildChampionCombatProfile('Garen',[],ranks,{abilityPower:0,level:18});
  const kit=kitWith(ability('Demacian Justice','R',3));
  applyExecuteChampionSpells('Garen',kit,profile,{patch:'16.19.1',bonusAttackDamage:0,ranks});

  assert.equal(kit.models.R?.dynamicDamage,undefined);
  assert.ok(profile.unmodelledEffects.includes('GAREN_R_EXECUTE_PATCH_UNVALIDATED'));
});

test('Viego primary R adds current-patch missing-health physical component from bonus AD',()=>{
  const ranks={Q:5,R:3};
  const profile=buildChampionCombatProfile('Viego',['VIEGO_R_PRIMARY'],ranks,{abilityPower:0,bonusAttackDamage:100,level:18});
  const r=ability('Heartbreaker','R',3);
  r.damage=[{label:'BaseHeartbreaker',type:'PHYSICAL',raw:0}];
  r.damageType='PHYSICAL';r.damageTypes=['PHYSICAL'];
  r.confidence=assessConfidence({});
  const kit=kitWith(r);
  kit.models.R!.damage=r.damage;

  applyExecuteChampionSpells('Viego',kit,profile,{patch:'16.18.1',bonusAttackDamage:100,ranks});

  assert.equal(kit.models.R?.dynamicDamage?.[0].targetMissingHealthRatio,.25);
  assert.ok(profile.modelledEffects.includes('VIEGO_R_MISSING_HEALTH'));
  assert.ok(profile.unmodelledEffects.includes('VIEGO_R_PRIMARY_ON_HIT'));
});

test('Viego missing-health bonus is evaluated after earlier damage in the sequence',()=>{
  const ranks={Q:5,R:3};
  const profile=buildChampionCombatProfile('Viego',['VIEGO_R_PRIMARY'],ranks,{abilityPower:0,bonusAttackDamage:100,level:18});
  const r=ability('Heartbreaker','R',3);
  r.damage=[{label:'BaseHeartbreaker',type:'PHYSICAL',raw:0}];
  r.damageType='PHYSICAL';r.damageTypes=['PHYSICAL'];
  r.confidence=assessConfidence({});
  const kit=kitWith(r);kit.models.R!.damage=r.damage;
  applyExecuteChampionSpells('Viego',kit,profile,{patch:'16.18.1',bonusAttackDamage:100,ranks});

  const result=simulateCombo({
    sequence:['AA','R'],abilities:kit.models,
    autoAttack:{damage:400,attackSpeed:1},caster:{mana:0},
    target:{health:1000,maxHealth:1000,armor:0,magicResist:0},
  });
  // R sees 400 missing HP and adds 25% of it.
  assert.equal(result.events[1].rawDamage,100);
});