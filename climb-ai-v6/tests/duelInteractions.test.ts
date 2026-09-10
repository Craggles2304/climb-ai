import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateAdvancedDuel,type AdvancedDuelSideInput} from '../lib/combat/duelAdvanced';
import {buildChampionDuelProfile} from '../lib/combat/championDuel';

const side=(overrides:Partial<AdvancedDuelSideInput>):AdvancedDuelSideInput=>({
  side:'YOU',champion:'You',sequence:['AA'],abilities:{},
  autoAttack:{damage:100,attackSpeed:1},mana:0,maxHealth:1000,currentHealth:1000,
  resistances:{armor:0,magicResist:0},...overrides,
});

test('magic-only shields absorb magic but let physical damage through',()=>{
  const magic={slot:'Q' as const,name:'Magic',rank:1,cooldownSeconds:10,cost:0,castTimeSeconds:0,damage:[{label:'magic',type:'MAGIC' as const,raw:100}]};
  const result=simulateAdvancedDuel(
    side({side:'YOU',champion:'Galio',sequence:[],openingShields:[{label:'bulwark',amount:100,durationSeconds:null,scope:'MAGIC'}]}),
    side({side:'THEM',champion:'Enemy',sequence:['AA','Q'],abilities:{Q:magic},autoAttack:{damage:100,attackSpeed:1}}),
    3,
  );
  assert.equal(result.you.health,900,'physical auto bypasses the magic shield');
  assert.equal(result.you.shield,0,'magic spell consumes the remaining magic shield');
  assert.equal(result.you.shieldDamageAbsorbed,100);
});

test('hard CC delays the next enemy action',()=>{
  const stun={slot:'Q' as const,name:'Stun',rank:1,cooldownSeconds:10,cost:0,castTimeSeconds:0,damage:[]};
  const wait={slot:'Q' as const,name:'Open',rank:1,cooldownSeconds:10,cost:0,castTimeSeconds:.25,damage:[]};
  const result=simulateAdvancedDuel(
    side({side:'YOU',champion:'Controller',sequence:['Q'],abilities:{Q:stun},autoAttack:{damage:0,attackSpeed:1},abilityOverlays:{Q:{targetControl:{label:'taunt',kind:'TAUNT',durationSeconds:1.5,actionLockSeconds:1.5}}}}),
    side({side:'THEM',champion:'Target',sequence:['Q','AA'],abilities:{Q:wait},autoAttack:{damage:100,attackSpeed:1}}),
    3,
  );
  const enemyAuto=result.timeline.flatMap((f:any)=>f.actions.map((a:any)=>({at:f.atSeconds,a}))).find((x:any)=>x.a.side==='THEM'&&x.a.step==='AA');
  assert.ok(enemyAuto);
  assert.ok(enemyAuto.at>=1.5);
});

test('one-shot control key is consumed only once',()=>{
  const spell={slot:'Q' as const,name:'Fear spell',rank:1,cooldownSeconds:0,cost:0,castTimeSeconds:.1,damage:[]};
  const control={label:'Doom fear',kind:'FEAR' as const,durationSeconds:1,actionLockSeconds:1,consumeKey:'DOOM'};
  const result=simulateAdvancedDuel(
    side({side:'YOU',champion:'Vex',sequence:['Q','Q'],abilities:{Q:spell},autoAttack:{damage:0,attackSpeed:1},abilityOverlays:{Q:{targetControl:control}}}),
    side({side:'THEM',champion:'Dummy',sequence:[],autoAttack:{damage:0,attackSpeed:1}}),
    3,
  );
  const fears=result.timeline.flatMap((f:any)=>f.actions).filter((a:any)=>a.controlAppliedSeconds>0);
  assert.equal(fears.length,1);
});

test('on-damage sustain heals after the shared damage frame',()=>{
  const result=simulateAdvancedDuel(
    side({side:'YOU',champion:'Hecarim',currentHealth:500,sequence:['AA'],autoAttack:{damage:200,attackSpeed:1},sustainEffects:[{label:'Spirit of Dread',healFromDamageRatio:.25,durationSeconds:4}]}),
    side({side:'THEM',champion:'Dummy',sequence:[],autoAttack:{damage:0,attackSpeed:1}}),
    2,
  );
  assert.equal(result.you.healingDone,50);
  assert.equal(result.you.health,550);
});

test('Vex W profile creates a timed all-damage shield',()=>{
  const profile=buildChampionDuelProfile('Vex',[],{W:3},{level:11,abilityPower:100,maxHealth:1000,bonusHealth:0});
  assert.equal(profile.abilityOverlays.W?.selfShield?.amount,175);
  assert.equal(profile.abilityOverlays.W?.selfShield?.durationSeconds,2.5);
  assert.equal(profile.abilityOverlays.W?.selfShield?.scope,'ALL');
});

test('Vex Doom profile scales fear by level and shares one consume key',()=>{
  const profile=buildChampionDuelProfile('Vex',['VEX_DOOM_READY'],{Q:1,W:1,E:1},{level:16,abilityPower:0,maxHealth:1000,bonusHealth:0});
  assert.equal(profile.abilityOverlays.Q?.targetControl?.durationSeconds,1.5);
  assert.equal(profile.abilityOverlays.W?.targetControl?.consumeKey,'VEX_DOOM');
  assert.equal(profile.abilityOverlays.E?.targetControl?.consumeKey,'VEX_DOOM');
});

test('Galio active W profile creates a magic-only shield and E knockup',()=>{
  const profile=buildChampionDuelProfile('Galio',['GALIO_W_SHIELD'],{W:5,E:1},{level:11,abilityPower:0,maxHealth:2000,bonusHealth:500});
  assert.equal(profile.openingShields[0].amount,270);
  assert.equal(profile.openingShields[0].scope,'MAGIC');
  assert.equal(profile.abilityOverlays.E?.targetControl?.actionLockSeconds,.75);
});

test('Hecarim W profile models own damage healing but flags ally contribution partial',()=>{
  const profile=buildChampionDuelProfile('Hecarim',['HEC_W_ACTIVE'],{W:1},{level:9,abilityPower:0,maxHealth:1500,bonusHealth:0});
  assert.equal(profile.sustainEffects[0].healFromDamageRatio,.25);
  assert.equal(profile.sustainEffects[0].durationSeconds,4);
  assert.ok(profile.partial.includes('HEC_W_ALLY_DAMAGE_HEAL'));
});