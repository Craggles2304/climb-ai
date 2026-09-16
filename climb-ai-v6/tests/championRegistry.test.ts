import test from 'node:test';
import assert from 'node:assert/strict';
import {buildChampionCombatProfile,championEffectOptions,supportedChampionMechanics} from '../lib/combat/championEffects';

test('registry exposes the first six specialist ADCs',()=>{
  const names=supportedChampionMechanics().map(x=>x.champion);
  for(const champion of ['kogmaw','jinx','aphelios','ashe','ezreal','vayne'])
    assert.ok(names.includes(champion),`${champion} is registered`);
});

test('Ashe Ranger Focus applies rank-scaled AS and flurry damage',()=>{
  const rank1=buildChampionCombatProfile('Ashe',['ASHE_Q'],{Q:1},{abilityPower:0});
  const rank5=buildChampionCombatProfile('Ashe',['ASHE_Q'],{Q:5},{abilityPower:0});
  assert.equal(rank1.permanentAttackSpeedRatio,.20);
  assert.equal(rank1.basicAttackDamageMultiplier,1.10);
  assert.equal(rank5.permanentAttackSpeedRatio,.60);
  assert.equal(rank5.basicAttackDamageMultiplier,1.30);
  assert.ok(rank5.unmodelledEffects.includes('ASHE_FROST_SHOT_CRIT_SCALING'));
});

test('Ezreal selected passive stack state grants ten percent bonus AS per stack and stays explicit about refresh limits',()=>{
  for(let stacks=1;stacks<=5;stacks++){
    const profile=buildChampionCombatProfile('Ezreal',[`EZ_PASSIVE_${stacks}`],{}, {abilityPower:0});
    assert.equal(profile.permanentAttackSpeedRatio,.10*stacks);
    assert.ok(profile.unmodelledEffects.includes('EZ_PASSIVE_DURATION_REFRESH'));
    assert.ok(profile.notes.some(note=>/stacking\/refresh remains partial/i.test(note)));
  }
  const options=championEffectOptions('Ezreal');
  for(const option of options)assert.equal(option.support,'PARTIAL');
});

test('Vayne Silver Bolts fresh-target state models every third auto as max-HP true damage',()=>{
  const profile=buildChampionCombatProfile('Vayne',['VAYNE_W_FRESH'],{W:5},{abilityPower:0});
  assert.equal(profile.onHits.length,1);
  assert.equal(profile.onHits[0].type,'TRUE');
  assert.equal(profile.onHits[0].targetMaxHealthRatio,.10);
  assert.equal(profile.onHits[0].everyNthAttack,3);
  assert.ok(profile.unmodelledEffects.includes('VAYNE_W_ABILITY_STACKS_AND_MINIMUM'));
});

test('Final Hour stays partial rather than being treated as a permanent AD buff',()=>{
  const profile=buildChampionCombatProfile('Vayne',['VAYNE_R'],{R:3},{abilityPower:0});
  assert.equal(profile.basicAttackDamageMultiplier,1);
  assert.ok(profile.unmodelledEffects.includes('VAYNE_R'));
});

test('conflicting grouped states resolve to the most recently selected state and lower confidence',()=>{
  const profile=buildChampionCombatProfile(
    'Jinx',['JINX_POWPOW_3','JINX_FISHBONES'],{Q:5},{abilityPower:0},
  );
  assert.ok(profile.modelledEffects.includes('JINX_FISHBONES'));
  assert.ok(!profile.modelledEffects.includes('JINX_POWPOW_3'));
  assert.ok(profile.unmodelledEffects.some(x=>x.startsWith('CONFLICT_JINX_WEAPON')));
});

test('state option groups are declared for mutually exclusive weapons/stacks',()=>{
  const jinx=championEffectOptions('Jinx');
  const aphelios=championEffectOptions('Aphelios');
  const ezreal=championEffectOptions('Ezreal');
  const hecarim=championEffectOptions('Hecarim');
  assert.equal(jinx.find(x=>x.id==='JINX_POWPOW_1')?.group,'jinx-weapon');
  assert.equal(jinx.find(x=>x.id==='JINX_FISHBONES')?.group,'jinx-weapon');
  assert.equal(aphelios.find(x=>x.id==='APH_CALIBRUM')?.group,'aphelios-main');
  assert.equal(aphelios.find(x=>x.id==='APH_CRESCENDUM')?.group,'aphelios-main');
  assert.equal(ezreal.find(x=>x.id==='EZ_PASSIVE_1')?.group,'ezreal-passive');
  assert.equal(ezreal.find(x=>x.id==='EZ_PASSIVE_5')?.group,'ezreal-passive');
  assert.equal(hecarim.find(x=>x.id==='HEC_Q_1')?.group,'hec-q');
  assert.equal(hecarim.find(x=>x.id==='HEC_Q_3')?.group,'hec-q');
});
