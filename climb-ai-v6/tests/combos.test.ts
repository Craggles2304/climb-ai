import test from 'node:test';
import assert from 'node:assert/strict';
import {
  simulateCombo,hasteMultiplier,attackInterval,
  type AbilityModel,type ComboInput,
} from '../lib/combat/combos';

const ability=(over:Partial<AbilityModel>&{slot:AbilityModel['slot']}):AbilityModel=>({
  name:over.slot,rank:1,cooldownSeconds:10,cost:50,castTimeSeconds:0.25,
  damage:[{label:'hit',type:'PHYSICAL',raw:100}],...over,
});

const input=(over:Partial<ComboInput>={}):ComboInput=>({
  sequence:['Q','AA'],
  abilities:{
    Q:ability({slot:'Q'}),
    E:ability({slot:'E',cost:80,damage:[{label:'hit',type:'PHYSICAL',raw:150}]}),
    R:ability({slot:'R',cost:100,cooldownSeconds:100,damage:[{label:'hit',type:'TRUE',raw:300}]}),
  },
  autoAttack:{damage:60,attackSpeed:0.8},
  caster:{mana:400},
  target:{health:1000,armor:0,magicResist:0},
  ...over,
});

/* ---------------------------------------------------------- the timeline -- */

test('every step becomes an event in order, with a running clock',()=>{
  const result=simulateCombo(input({sequence:['Q','AA','E']}));
  assert.equal(result.events.length,3);
  assert.deepEqual(result.events.map(e=>e.step),['Q','AA','E']);
  assert.equal(result.events[0].atSeconds,0);
  for(let i=1;i<result.events.length;i++)
    assert.ok(result.events[i].atSeconds>=result.events[i-1].atSeconds,'the clock never goes back');
});

test('damage accumulates and the target health falls',()=>{
  const result=simulateCombo(input({sequence:['Q','AA']}));
  assert.equal(result.events[0].mitigatedDamage,100);
  assert.equal(result.events[0].targetHealthRemaining,900);
  assert.equal(result.events[1].mitigatedDamage,60);
  assert.equal(result.events[1].targetHealthRemaining,840);
  assert.equal(result.totalMitigatedDamage,160);
  assert.equal(result.targetHealthRemaining,840);
  assert.equal(result.kills,false);
});

test('resistances are applied per event, not to the total',()=>{
  const armoured=simulateCombo(input({
    sequence:['Q','R'],target:{health:2000,armor:100,magicResist:0},
  }));
  const q=armoured.events[0];
  const r=armoured.events[1];
  assert.equal(q.mitigatedDamage,50,'physical halved by 100 armour');
  assert.equal(r.mitigatedDamage,300,'true damage untouched');
});

test('a lethal combo reports the kill and does not go below zero health',()=>{
  const result=simulateCombo(input({
    sequence:['R','R'],target:{health:200,armor:0,magicResist:0},
    abilities:{R:ability({slot:'R',cost:0,cooldownSeconds:0,damage:[{label:'hit',type:'TRUE',raw:300}]})},
  }));
  assert.equal(result.kills,true);
  assert.equal(result.targetHealthRemaining,0,'health floors at zero rather than going negative');
});

/* ------------------------------------------------------------- resources -- */

test('mana is spent per cast and reported as it falls',()=>{
  const result=simulateCombo(input({sequence:['Q','E'],caster:{mana:400}}));
  assert.equal(result.events[0].manaSpent,50);
  assert.equal(result.events[0].manaRemaining,350);
  assert.equal(result.events[1].manaSpent,80);
  assert.equal(result.events[1].manaRemaining,270);
  assert.equal(result.manaUsed,130);
  assert.equal(result.manaRemaining,270);
});

test('a step that cannot be paid for does not happen and deals nothing',()=>{
  // This is the whole point of asking "can I complete this combo".
  const result=simulateCombo(input({sequence:['Q','E','R'],caster:{mana:100}}));
  const blocked=result.events.find(e=>e.status==='NO_RESOURCE')!;
  assert.ok(blocked,'a step was refused');
  assert.equal(blocked.mitigatedDamage,0,'and dealt no damage');
  assert.equal(result.completable,false);
  assert.match(result.blocked[0].reason,/costs/);
  assert.match(result.resourceNote,/not payable/);
});

test('an auto attack costs no resource',()=>{
  const result=simulateCombo(input({sequence:['AA','AA','AA'],caster:{mana:0}}));
  assert.equal(result.manaUsed,0);
  assert.equal(result.completable,true);
  assert.ok(result.totalMitigatedDamage>0);
});

test('a manaless champion is described rather than blocked',()=>{
  const result=simulateCombo(input({
    sequence:['Q','E'],caster:{mana:0},
    abilities:{Q:ability({slot:'Q',cost:0}),E:ability({slot:'E',cost:0})},
  }));
  assert.equal(result.completable,true);
  assert.match(result.resourceNote,/no resource bar/);
});

test('the resource note says whether anything is left to act with',()=>{
  const comfortable=simulateCombo(input({sequence:['Q'],caster:{mana:1000}}));
  assert.match(comfortable.resourceNote,/comfortable/);

  const drained=simulateCombo(input({
    sequence:['Q','E','R'],caster:{mana:232},
  }));
  assert.equal(drained.completable,true,'230 covers 50 + 80 + 100');
  assert.match(drained.resourceNote,/effectively empty/);
});

/* ------------------------------------------------------------ cooldowns -- */

test('the same ability twice inside its cooldown is refused',()=>{
  // A combo listing Q twice in two seconds is impossible, and quietly dealing
  // the damage twice would be the most flattering possible lie.
  const result=simulateCombo(input({sequence:['Q','AA','Q'],caster:{mana:400}}));
  const second=result.events[2];
  assert.equal(second.status,'ON_COOLDOWN');
  assert.equal(second.mitigatedDamage,0);
  assert.equal(result.completable,false);
  assert.match(result.blocked[0].reason,/cooldown/);
});

test('the same ability twice is allowed once the cooldown has elapsed',()=>{
  const result=simulateCombo(input({
    sequence:['Q','AA','AA','Q'],
    abilities:{Q:ability({slot:'Q',cooldownSeconds:1})},
    autoAttack:{damage:60,attackSpeed:1},
    caster:{mana:400},
  }));
  assert.equal(result.events[3].status,'CAST');
  assert.equal(result.completable,true);
});

test('ability haste shortens the cooldown on the standard curve',()=>{
  assert.equal(hasteMultiplier(0),1);
  assert.equal(hasteMultiplier(100),0.5);
  assert.ok(hasteMultiplier(50)>0.6&&hasteMultiplier(50)<0.7);

  // A 3s cooldown at 100 haste is 1.5s, which two 1s autos cover.
  const blockedWithout=simulateCombo(input({
    sequence:['Q','AA','AA','Q'],
    abilities:{Q:ability({slot:'Q',cooldownSeconds:3})},
    autoAttack:{damage:60,attackSpeed:1},
  }));
  const allowedWith=simulateCombo(input({
    sequence:['Q','AA','AA','Q'],
    abilities:{Q:ability({slot:'Q',cooldownSeconds:3})},
    autoAttack:{damage:60,attackSpeed:1},
    abilityHaste:100,
  }));
  assert.equal(blockedWithout.events[3].status,'ON_COOLDOWN');
  assert.equal(allowedWith.events[3].status,'CAST');
});

test('an ability with no rank is refused rather than assumed',()=>{
  const result=simulateCombo(input({sequence:['W'],abilities:{Q:ability({slot:'Q'})}}));
  assert.equal(result.events[0].status,'NOT_LEARNED');
  assert.equal(result.completable,false);
  assert.match(result.blocked[0].reason,/not available/);
});

/* --------------------------------------------------------------- shields -- */

test('a shield absorbs before health does',()=>{
  const result=simulateCombo(input({
    sequence:['Q'],target:{health:1000,armor:0,magicResist:0,shield:70},
  }));
  assert.equal(result.events[0].targetHealthRemaining,970,'70 of the 100 hit the shield');
});

test('a shield larger than the combo leaves health untouched',()=>{
  const result=simulateCombo(input({
    sequence:['Q','AA'],target:{health:1000,armor:0,magicResist:0,shield:500},
  }));
  assert.equal(result.targetHealthRemaining,1000);
  assert.equal(result.kills,false);
});

/* ---------------------------------------------------------------- timing -- */

test('duration is cast times plus attack intervals',()=>{
  const result=simulateCombo(input({
    sequence:['Q','AA'],
    abilities:{Q:ability({slot:'Q',castTimeSeconds:0.5})},
    autoAttack:{damage:60,attackSpeed:0.5},
  }));
  // 0.5s cast + one 2s attack interval.
  assert.equal(result.minimumDurationSeconds,2.5);
});

test('duration is presented as a floor, not a stopwatch reading',()=>{
  const result=simulateCombo(input());
  assert.match(result.timingNote,/floor/);
  assert.match(result.timingNote,/animation cancelling/);
});

test('attack interval is the inverse of attack speed, and survives zero',()=>{
  assert.equal(attackInterval(2),0.5);
  assert.equal(attackInterval(0.625),1.6);
  assert.equal(attackInterval(0),0,'no infinite interval');
  assert.equal(attackInterval(NaN),0);
});

/* --------------------------------------------------------------- honesty -- */

test('an uncalculable component makes the event and the total a floor',()=>{
  const result=simulateCombo(input({
    sequence:['Q'],
    abilities:{Q:ability({slot:'Q',damage:[
      {label:'known',type:'PHYSICAL',raw:100},
      {label:'stacks',type:'MAGIC',raw:null,unmodelled:['Scales with buff stacks.']},
    ]})},
  }));
  assert.equal(result.damageComplete,false);
  assert.equal(result.events[0].mitigatedDamage,100,'only what could be calculated');
  assert.deepEqual(result.events[0].skipped[0].reasons,['Scales with buff stacks.']);
  assert.match(result.events[0].note!,/floor/);
});

test('a fully calculable combo is marked complete',()=>{
  const result=simulateCombo(input({sequence:['Q','AA']}));
  assert.equal(result.damageComplete,true);
  assert.equal(result.completable,true);
  assert.ok(result.events.every(e=>e.skipped.length===0));
});

test('an empty sequence is a valid no-op, not an error',()=>{
  const result=simulateCombo(input({sequence:[]}));
  assert.deepEqual(result.events,[]);
  assert.equal(result.totalMitigatedDamage,0);
  assert.equal(result.minimumDurationSeconds,0);
  assert.equal(result.completable,true);
  assert.equal(result.targetHealthRemaining,1000);
});

test('nonsense inputs do not produce NaN anywhere',()=>{
  const result=simulateCombo(input({
    sequence:['Q','AA'],
    autoAttack:{damage:NaN,attackSpeed:-1},
    caster:{mana:NaN},
    target:{health:NaN,armor:NaN,magicResist:NaN},
    abilities:{Q:ability({slot:'Q',cost:NaN,castTimeSeconds:NaN,
      damage:[{label:'hit',type:'PHYSICAL',raw:100}]})},
  }));
  assert.doesNotMatch(JSON.stringify(result),/NaN|null,"manaRemaining"/);
  for(const event of result.events){
    assert.ok(Number.isFinite(event.atSeconds));
    assert.ok(Number.isFinite(event.manaRemaining));
    assert.ok(Number.isFinite(event.targetHealthRemaining));
  }
});
