import test from 'node:test';
import assert from 'node:assert/strict';
import {applyBotLaneStaticAccess} from '../lib/combat/botlaneAccess';
import type {BotLaneParticipantInput} from '../lib/combat/botlane';

const participant=():BotLaneParticipantInput=>({
  key:'YOU_ADC',team:'YOU',role:'ADC',champion:'Range Tester',
  sequence:['AA','Q','W','AA'],
  abilities:{
    Q:{slot:'Q',name:'Long spell',rank:1,cooldownSeconds:5,cost:0,castTimeSeconds:.2,damage:[{label:'Q',type:'MAGIC',raw:100}]},
    W:{slot:'W',name:'Short spell',rank:1,cooldownSeconds:5,cost:0,castTimeSeconds:.2,damage:[{label:'W',type:'MAGIC',raw:80}]},
  },
  autoAttack:{damage:70,attackSpeed:1},mana:500,maxHealth:1000,currentHealth:1000,
  resistances:{armor:30,magicResist:30},focusTarget:'THEM_ADC',
});

test('explicit distance removes autos when target is outside attack range',()=>{
  const result=applyBotLaneStaticAccess({
    participant:participant(),requestedAccessMode:'FULL',attackRange:550,
    abilityRanges:{Q:900,W:450},targetDistance:650,
  });
  assert.equal(result.effectiveAccessMode,'NO_AUTOS');
  assert.equal(result.blockedAutos,true);
  assert.deepEqual(result.participant.sequence,['Q','W']);
});

test('static distance blocks only enemy-facing spells proven out of published range',()=>{
  const result=applyBotLaneStaticAccess({
    participant:participant(),requestedAccessMode:'FULL',attackRange:550,
    abilityRanges:{Q:900,W:450},targetDistance:650,
  });
  assert.equal(result.participant.abilities.Q?.damage.length,1);
  assert.equal(result.participant.abilities.W?.damage.length,0);
  assert.deepEqual(result.blockedAbilities,['W']);
});

test('unknown published spell range stays modelled but lowers access confidence',()=>{
  const result=applyBotLaneStaticAccess({
    participant:participant(),requestedAccessMode:'FULL',attackRange:550,
    abilityRanges:{Q:null,W:450},targetDistance:400,
  });
  assert.equal(result.participant.abilities.Q?.damage.length,1);
  assert.ok(result.partial.some(reason=>reason.includes('Q target access is unresolved')));
});

test('ally utility slot is not disabled by enemy target distance',()=>{
  const input=participant();
  input.allyUtility={Q:{shield:{label:'Ally shield',amount:100,durationSeconds:2,scope:'ALL'}}};
  const result=applyBotLaneStaticAccess({
    participant:input,requestedAccessMode:'FULL',attackRange:550,
    abilityRanges:{Q:100},targetDistance:900,
  });
  assert.equal(result.participant.abilities.Q?.damage.length,1);
  assert.equal(result.participant.allyUtility?.Q?.shield?.amount,100);
  assert.deepEqual(result.blockedAbilities,[]);
});

test('manual NO AUTOS still works when no distance is supplied',()=>{
  const result=applyBotLaneStaticAccess({
    participant:participant(),requestedAccessMode:'NO_AUTOS',attackRange:550,abilityRanges:{},
  });
  assert.equal(result.effectiveAccessMode,'NO_AUTOS');
  assert.deepEqual(result.participant.sequence,['Q','W']);
  assert.equal(result.partial.length,0);
});
