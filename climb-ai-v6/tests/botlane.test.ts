import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateBotLane,compareYourFocusTargets,type BotLaneKey,type BotLaneParticipantInput} from '../lib/combat/botlane';

const actor=(key:BotLaneKey,overrides:Partial<BotLaneParticipantInput>={}):BotLaneParticipantInput=>{
  const team=key.startsWith('YOU')?'YOU':'THEM';
  const role=key.endsWith('ADC')?'ADC':'SUPPORT';
  const focus=team==='YOU'?'THEM_ADC':'YOU_ADC';
  return {
    key,team,role,champion:key,sequence:['AA'],abilities:{},autoAttack:{damage:100,attackSpeed:1},
    mana:0,maxHealth:1000,currentHealth:1000,resistances:{armor:0,magicResist:0},
    focusTarget:focus as BotLaneKey,protectTarget:(team==='YOU'?'YOU_ADC':'THEM_ADC') as BotLaneKey,
    ...overrides,
  };
};
const four=(overrides:Partial<Record<BotLaneKey,Partial<BotLaneParticipantInput>>>={}):Record<BotLaneKey,BotLaneParticipantInput>=>({
  YOU_ADC:actor('YOU_ADC',overrides.YOU_ADC),YOU_SUPPORT:actor('YOU_SUPPORT',overrides.YOU_SUPPORT),
  THEM_ADC:actor('THEM_ADC',overrides.THEM_ADC),THEM_SUPPORT:actor('THEM_SUPPORT',overrides.THEM_SUPPORT),
});

test('all four champions act on the same opening frame',()=>{
  const result=simulateBotLane(four(),2);
  assert.equal(result.timeline[0].actions.length,4);
  assert.equal(result.participants.YOU_ADC.health,800);
  assert.equal(result.participants.THEM_ADC.health,800);
});

test('support ally shield is granted before same-frame enemy damage',()=>{
  const protect={slot:'W' as const,name:'Shield ally',rank:1,cooldownSeconds:10,cost:0,castTimeSeconds:.1,damage:[]};
  const result=simulateBotLane(four({
    YOU_SUPPORT:{sequence:['W'],abilities:{W:protect},autoAttack:{damage:0,attackSpeed:1},allyUtility:{W:{shield:{label:'ally shield',amount:150,durationSeconds:2.5,scope:'ALL'}}}},
    THEM_SUPPORT:{autoAttack:{damage:0,attackSpeed:1}},
    THEM_ADC:{autoAttack:{damage:100,attackSpeed:1}},
  }),2);
  assert.equal(result.participants.YOU_ADC.health,1000);
  assert.equal(result.participants.YOU_ADC.shield,50);
  assert.equal(result.participants.YOU_SUPPORT.shieldingDone,150);
});

test('support hard CC delays a future enemy action',()=>{
  const stun={slot:'Q' as const,name:'Hook',rank:1,cooldownSeconds:10,cost:0,castTimeSeconds:.1,damage:[]};
  const result=simulateBotLane(four({
    YOU_SUPPORT:{sequence:['Q'],abilities:{Q:stun},autoAttack:{damage:0,attackSpeed:1},abilityOverlays:{Q:{targetControl:{label:'stun',kind:'STUN',durationSeconds:1,actionLockSeconds:1}}}},
    YOU_ADC:{sequence:['AA','AA']},
    THEM_ADC:{sequence:['AA','AA']},
    THEM_SUPPORT:{sequence:[],autoAttack:{damage:0,attackSpeed:1}},
  }),3);
  const enemyActions=result.timeline.flatMap(f=>f.actions.map(a=>({t:f.atSeconds,a}))).filter(x=>x.a.actor==='THEM_ADC');
  assert.equal(enemyActions.length,2);
  assert.ok(enemyActions[1].t>=1);
});

test('focus target automatically swaps after first kill',()=>{
  const result=simulateBotLane(four({
    YOU_ADC:{sequence:['AA','AA'],autoAttack:{damage:1200,attackSpeed:1}},
    YOU_SUPPORT:{sequence:[],autoAttack:{damage:0,attackSpeed:1}},
    THEM_ADC:{currentHealth:500,sequence:[]},
    THEM_SUPPORT:{currentHealth:500,sequence:[]},
  }),3);
  assert.equal(result.kills[0].victim,'THEM_ADC');
  assert.equal(result.kills[1].victim,'THEM_SUPPORT');
  assert.equal(result.winner,'YOU');
});

test('focus comparison can recommend the squishier support when it converts first',()=>{
  const inputs=four({
    YOU_ADC:{sequence:['AA'],autoAttack:{damage:600,attackSpeed:1}},
    YOU_SUPPORT:{sequence:['AA'],autoAttack:{damage:300,attackSpeed:1}},
    THEM_ADC:{maxHealth:2000,currentHealth:2000,sequence:[]},
    THEM_SUPPORT:{maxHealth:500,currentHealth:500,sequence:[]},
  });
  const comparison=compareYourFocusTargets(inputs,2);
  assert.equal(comparison.recommendedTarget,'THEM_SUPPORT');
});
