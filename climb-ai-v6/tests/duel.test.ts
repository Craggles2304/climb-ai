import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateDuel,type DuelSideInput} from '../lib/combat/duel';

const side=(overrides:Partial<DuelSideInput>):DuelSideInput=>({
  side:'YOU',champion:'You',sequence:['AA'],abilities:{},
  autoAttack:{damage:100,attackSpeed:1},mana:0,maxHealth:1000,currentHealth:1000,
  resistances:{armor:0,magicResist:0},...overrides,
});

test('same-timestamp lethal actions resolve as a double KO instead of array-order winner',()=>{
  const result=simulateDuel(
    side({side:'YOU',champion:'A',currentHealth:100,autoAttack:{damage:100,attackSpeed:1}}),
    side({side:'THEM',champion:'B',currentHealth:100,autoAttack:{damage:100,attackSpeed:1}}),
    2,
  );
  assert.equal(result.verdict,'DOUBLE_KO');
  assert.equal(result.timeline[0].actions.length,2);
  assert.equal(result.you.health,0);
  assert.equal(result.them.health,0);
});

test('cast-generated shield exists before incoming damage in the same frame',()=>{
  const shieldAbility={
    slot:'Q' as const,name:'Shield cast',rank:1,cooldownSeconds:10,cost:0,castTimeSeconds:.25,
    damage:[],eventState:{grantsSelfShield:{label:'Test shield',amount:120,durationSeconds:2}},
  };
  const result=simulateDuel(
    side({
      side:'YOU',champion:'Shield',sequence:['Q'],abilities:{Q:shieldAbility},
      autoAttack:{damage:0,attackSpeed:1},currentHealth:100,
    }),
    side({side:'THEM',champion:'Hit',sequence:['AA'],autoAttack:{damage:100,attackSpeed:1}}),
    2,
  );
  assert.equal(result.you.health,100);
  assert.equal(result.you.shield,20);
  assert.equal(result.you.shieldDamageAbsorbed,100);
});

test('known-duration opening shields expire before later damage',()=>{
  const result=simulateDuel(
    side({
      side:'YOU',champion:'Barrier',sequence:['Q','Q'],
      abilities:{Q:{slot:'Q',name:'Wait',rank:1,cooldownSeconds:3,cost:0,castTimeSeconds:0,damage:[]}},
      openingShields:[{label:'Barrier',amount:100,durationSeconds:2.5}],
    }),
    side({
      side:'THEM',champion:'Enemy',sequence:['Q','AA'],
      abilities:{Q:{slot:'Q',name:'Delay',rank:1,cooldownSeconds:3,cost:0,castTimeSeconds:3,damage:[]}},
      autoAttack:{damage:100,attackSpeed:1},
    }),
    5,
  );
  assert.equal(result.you.health,900);
  assert.equal(result.you.shield,0);
});

test('crowd-control overlay delays the target next action on the shared clock',()=>{
  const stun={slot:'Q' as const,name:'Stun',rank:1,cooldownSeconds:10,cost:0,castTimeSeconds:0,damage:[]};
  const result=simulateDuel(
    side({
      side:'YOU',champion:'Controller',sequence:['Q'],abilities:{Q:stun},
      abilityOverlays:{Q:{targetControl:{label:'Stun',durationSeconds:1.5}}},
      autoAttack:{damage:0,attackSpeed:1},
    }),
    side({side:'THEM',champion:'Target',sequence:['AA'],autoAttack:{damage:100,attackSpeed:1}}),
    3,
  );
  assert.equal(result.timeline[0].actions.length,2,'an action already beginning at t=0 still resolves');

  const delayed=simulateDuel(
    side({
      side:'YOU',champion:'Controller',sequence:['Q','AA'],abilities:{Q:stun},
      abilityOverlays:{Q:{targetControl:{label:'Stun',durationSeconds:1.5}}},
      autoAttack:{damage:0,attackSpeed:1},
    }),
    side({
      side:'THEM',champion:'Target',sequence:['Q','AA'],
      abilities:{Q:{slot:'Q',name:'Open',rank:1,cooldownSeconds:10,cost:0,castTimeSeconds:.25,damage:[]}},
      autoAttack:{damage:100,attackSpeed:1},
    }),
    3,
  );
  const enemySecond=delayed.timeline.flatMap(f=>f.actions.map(a=>({at:f.atSeconds,a})))
    .find(x=>x.a.side==='THEM'&&x.a.step==='AA');
  assert.ok(enemySecond);
  assert.ok((enemySecond?.at??0)>=1.5);
});

test('self-heal overlay is applied before same-frame incoming damage and capped at max HP',()=>{
  const heal={slot:'Q' as const,name:'Heal',rank:1,cooldownSeconds:10,cost:0,castTimeSeconds:0,damage:[]};
  const result=simulateDuel(
    side({
      side:'YOU',champion:'Healer',sequence:['Q'],abilities:{Q:heal},currentHealth:900,
      abilityOverlays:{Q:{selfHeal:{label:'Heal',amount:300}}},autoAttack:{damage:0,attackSpeed:1},
    }),
    side({side:'THEM',champion:'Enemy',sequence:['AA'],autoAttack:{damage:150,attackSpeed:1}}),
    2,
  );
  assert.equal(result.you.healingDone,100);
  assert.equal(result.you.health,850);
});

test('attack reset only changes timing when a validated auto action-lock value exists',()=>{
  const reset={
    slot:'Q' as const,name:'Reset',rank:1,cooldownSeconds:10,cost:0,castTimeSeconds:.1,
    damage:[],eventState:{resetsBasicAttackTimer:true},
  };
  const fast=simulateDuel(
    side({
      side:'YOU',champion:'Resetter',sequence:['AA','Q','AA'],abilities:{Q:reset},
      autoAttack:{damage:10,attackSpeed:1},autoActionLockSeconds:.2,
    }),
    side({side:'THEM',champion:'Dummy',sequence:[],autoAttack:{damage:0,attackSpeed:1}}),
    3,
  );
  const autos=fast.timeline.flatMap(f=>f.actions.map(a=>({at:f.atSeconds,a})))
    .filter(x=>x.a.side==='YOU'&&x.a.step==='AA');
  assert.equal(autos.length,2);
  assert.ok(autos[1].at<1,'reset allows the second auto before the original 1s attack timer');
});

test('resistance shred affects only future timestamps in the duel',()=>{
  const shred={
    slot:'Q' as const,name:'Shred',rank:1,cooldownSeconds:10,cost:0,castTimeSeconds:.1,
    damage:[{label:'Q',type:'PHYSICAL' as const,raw:100}],
    targetDebuff:{label:'20% shred',durationSeconds:4,percentArmorReduction:.2},
  };
  const result=simulateDuel(
    side({
      side:'YOU',champion:'Shredder',sequence:['Q','AA'],abilities:{Q:shred},
      autoAttack:{damage:100,attackSpeed:1},
    }),
    side({
      side:'THEM',champion:'Tank',sequence:[],resistances:{armor:100,magicResist:0},
      autoAttack:{damage:0,attackSpeed:1},
    }),
    3,
  );
  const hits=result.timeline.flatMap(f=>f.actions).filter(a=>a.side==='YOU');
  assert.equal(hits[0].mitigatedDamage,50);
  assert.equal(hits[1].mitigatedDamage,55.56);
});