import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RUNES,buildRuneCombatProfile,buildSummonerCombatProfile,igniteAtLevel,lastStandBonus,
} from '../lib/combat/effects';
import {buildChampionCombatProfile} from '../lib/combat/championEffects';
import {simulateCombo} from '../lib/combat/combos';

test('Press the Attack is modelled on the third basic attack',()=>{
  const profile=buildRuneCombatProfile([RUNES.PRESS_THE_ATTACK],{
    level:18,isRanged:true,healthPercent:100,baseAttackSpeed:.65,
    bonusAttackSpeedRatio:0,adaptiveDamageType:'PHYSICAL',
  });
  assert.equal(profile.autoProcs.length,1);
  assert.equal(profile.autoProcs[0].procAtAuto,3);
  assert.equal(profile.autoProcs[0].damage.flatDamage,180);
  assert.equal(profile.damageRules[0].activateAfterAutos,3);
});

test('Lethal Tempo uses ranged and melee stack rates',()=>{
  const ranged=buildRuneCombatProfile([RUNES.LETHAL_TEMPO],{
    level:18,isRanged:true,healthPercent:100,baseAttackSpeed:.65,
    bonusAttackSpeedRatio:.5,adaptiveDamageType:'PHYSICAL',
  });
  const melee=buildRuneCombatProfile([RUNES.LETHAL_TEMPO],{
    level:18,isRanged:false,healthPercent:100,baseAttackSpeed:.65,
    bonusAttackSpeedRatio:.5,adaptiveDamageType:'PHYSICAL',
  });
  assert.equal(ranged.attackStack?.attackSpeedPerStack,.026);
  assert.equal(melee.attackStack?.attackSpeedPerStack,.0325);
  assert.equal(ranged.attackStack?.maxStacks,6);
});

test('Last Stand scales only when the caster is below 60% health',()=>{
  assert.equal(lastStandBonus(100),0);
  assert.equal(lastStandBonus(60),0);
  assert.equal(lastStandBonus(30),.11);
  assert.ok(lastStandBonus(45)>.05&&lastStandBonus(45)<.11);
});

test('Ignite keeps its low-level curve and reaches the level 18 endpoint',()=>{
  assert.equal(igniteAtLevel(1),70);
  assert.equal(igniteAtLevel(6),170);
  assert.equal(igniteAtLevel(18),475);
});

test('summoner effects only apply when the selected spell is marked active',()=>{
  const inactive=buildSummonerCombatProfile(
    ['SummonerBarrier','SummonerDot'],[],{level:18,maxHealth:2000,currentHealth:1000},
  );
  assert.equal(inactive.bonusShield,0);
  assert.equal(inactive.igniteDamage,0);

  const active=buildSummonerCombatProfile(
    ['SummonerBarrier','SummonerDot','SummonerExhaust'],
    ['SummonerBarrier','SummonerDot','SummonerExhaust'],
    {level:18,maxHealth:2000,currentHealth:1000},
  );
  assert.equal(active.bonusShield,460);
  assert.equal(active.igniteDamage,475);
  assert.equal(active.exhaustDamageMultiplier,.65);
  assert.equal(active.exhaustDurationSeconds,3);
});

test('Heal cannot push current health above maximum health',()=>{
  const profile=buildSummonerCombatProfile(
    ['SummonerHeal'],['SummonerHeal'],{level:18,maxHealth:2000,currentHealth:1900},
  );
  assert.equal(profile.heal,100);
});

test("Kog'Maw Q passive and W active produce champion-specific combat effects",()=>{
  const profile=buildChampionCombatProfile(
    'KogMaw',['KOG_W'],{Q:3,W:2,E:1,R:1},{abilityPower:100},
  );
  assert.equal(profile.permanentAttackSpeedRatio,.20);
  assert.equal(profile.attackRangeBonus,150);
  assert.equal(profile.onHits.length,1);
  // W rank 2 is 3.75% max HP + 1 percentage point per 100 AP.
  assert.equal(profile.onHits[0].targetMaxHealthRatio,.0475);
});

test('current-health rune rules are evaluated event by event',()=>{
  const profile=buildRuneCombatProfile([RUNES.CUT_DOWN,RUNES.COUP_DE_GRACE],{
    level:18,isRanged:true,healthPercent:100,baseAttackSpeed:1,
    bonusAttackSpeedRatio:0,adaptiveDamageType:'PHYSICAL',
  });
  const result=simulateCombo({
    sequence:['AA','AA','AA'],abilities:{},
    autoAttack:{damage:300,attackSpeed:1},caster:{mana:0},
    target:{health:1000,maxHealth:1000,armor:0,magicResist:0},
    damageRules:profile.damageRules,
  });
  assert.equal(result.events[0].rawDamage,324); // Cut Down while target >60%.
  assert.equal(result.events[2].rawDamage,324); // Coup once target falls <40%.
});

test('Exhaust reduces ordinary damage during its active window but not true damage',()=>{
  const result=simulateCombo({
    sequence:['Q','R'],
    abilities:{
      Q:{slot:'Q',name:'Physical',rank:1,cooldownSeconds:5,cost:0,castTimeSeconds:.25,damage:[{label:'hit',type:'PHYSICAL',raw:100}]},
      R:{slot:'R',name:'True',rank:1,cooldownSeconds:5,cost:0,castTimeSeconds:.25,damage:[{label:'hit',type:'TRUE',raw:100}]},
    },
    autoAttack:{damage:0,attackSpeed:1},caster:{mana:0},
    target:{health:1000,maxHealth:1000,armor:0,magicResist:0},
    outgoingDamageMultiplier:.65,outgoingDamageMultiplierDurationSeconds:3,
  });
  assert.equal(result.events[0].rawDamage,65);
  assert.equal(result.events[1].rawDamage,100);
});
