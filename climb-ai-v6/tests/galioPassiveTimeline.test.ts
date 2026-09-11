import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateCombo,type AbilityModel,type AutoAttackModel} from '../lib/combat/combos';
import {simulateAdvancedDuel} from '../lib/combat/duelAdvanced';
import {simulateBotLane,type BotLaneKey,type BotLaneParticipantInput} from '../lib/combat/botlane';
import {withRechargeableBasicAttackReplacement} from '../lib/combat/attackInteractions';

const spell=(slot:'Q'|'W'|'E'|'R',damage=10,castTimeSeconds=.1):AbilityModel=>({
  slot,name:`Test ${slot}`,rank:1,cooldownSeconds:20,cost:0,castTimeSeconds,
  damage:[{label:`${slot} damage`,type:'MAGIC',raw:damage}],
});

const galioAuto=():AutoAttackModel=>withRechargeableBasicAttackReplacement(
  {damage:100,attackSpeed:1},
  {
    id:'GALIO_COLOSSAL_SMASH',label:'Colossal Smash',startsReady:true,
    cooldownSeconds:5,cooldownReductionOnAbilityHit:3,
    attackSpeedFlatWhileReady:.4,
    damage:[{label:'Colossal Smash',type:'MAGIC',flatDamage:200}],
  },
);

test('ready Colossal Smash gets bonus attack speed only while the passive is available',()=>{
  const result=simulateCombo({
    sequence:['AA','AA'],abilities:{},autoAttack:galioAuto(),caster:{mana:0},
    target:{health:5000,maxHealth:5000,armor:0,magicResist:0},
  });

  // Ready attack: 1.0 + 0.4 attacks/s => 0.71s interval.
  assert.equal(result.events[0].atSeconds,0);
  assert.equal(result.events[1].atSeconds,.71);
  assert.equal(result.events[0].label,'Colossal Smash');
  assert.equal(result.events[1].label,'Auto attack');
  // The passive is no longer ready for the second attack, so its interval is the normal 1.0s.
  assert.equal(result.minimumDurationSeconds,1.71);
});

test('one ability hit refunds 3s but does not make Colossal Smash ready before its remaining cooldown',()=>{
  const result=simulateCombo({
    sequence:['AA','Q','AA'],
    abilities:{Q:spell('Q')},autoAttack:galioAuto(),caster:{mana:0},
    target:{health:5000,maxHealth:5000,armor:0,magicResist:0},
  });

  assert.equal(result.events[0].label,'Colossal Smash');
  assert.equal(result.events[0].rawDamage,200);
  // First passive at t=0 -> ready t=5; ready-state AS moves Q to t=.71, then Q refunds to t=2.
  // The next AA starts at t=.81, so it must still be an ordinary physical attack.
  assert.equal(result.events[1].atSeconds,.71);
  assert.equal(result.events[2].atSeconds,.81);
  assert.equal(result.events[2].label,'Auto attack');
  assert.equal(result.events[2].rawDamage,100);
  assert.match(result.events[1].note??'',/refunded 3s.*ready at 2s/i);
});

test('two qualifying ability casts can recharge Colossal Smash early and the next proc restarts 5s cooldown',()=>{
  const result=simulateCombo({
    sequence:['AA','Q','W','AA','AA'],
    abilities:{Q:spell('Q'),W:spell('W')},autoAttack:galioAuto(),caster:{mana:0},
    target:{health:5000,maxHealth:5000,armor:0,magicResist:0},
  });

  assert.deepEqual(result.events.map(x=>x.rawDamage),[200,10,10,200,100]);
  assert.equal(result.events[3].atSeconds,.91);
  assert.equal(result.events[3].label,'Colossal Smash');
  assert.equal(result.events[4].atSeconds,1.62);
  assert.equal(result.events[4].label,'Auto attack');
  assert.match(result.events[3].note??'',/ready again at 5\.91s/i);
});

test('ability hits while Colossal Smash is already ready do not bank future cooldown reduction',()=>{
  const result=simulateCombo({
    sequence:['Q','AA','AA'],
    abilities:{Q:spell('Q')},autoAttack:galioAuto(),caster:{mana:0},
    target:{health:5000,maxHealth:5000,armor:0,magicResist:0},
  });

  assert.equal(result.events[1].label,'Colossal Smash');
  // Q happened before the first proc, so the passive still starts a full 5s cooldown when consumed.
  assert.match(result.events[1].note??'',/ready again at 5\.1s/i);
  assert.equal(result.events[2].atSeconds,.81);
  assert.equal(result.events[2].label,'Auto attack');
});

test('simultaneous duel uses the same rechargeable passive clock',()=>{
  const result=simulateAdvancedDuel(
    {
      side:'YOU',champion:'Galio',sequence:['AA','Q','W','AA'],
      abilities:{Q:spell('Q'),W:spell('W')},autoAttack:galioAuto(),mana:0,
      maxHealth:5000,currentHealth:5000,resistances:{armor:0,magicResist:0},
    },
    {
      side:'THEM',champion:'Dummy',sequence:[],abilities:{},autoAttack:{damage:0,attackSpeed:1},
      mana:0,maxHealth:5000,currentHealth:5000,resistances:{armor:0,magicResist:0},
    },
    10,
  );

  const labels=result.timeline.flatMap(frame=>frame.actions.map((action:any)=>action.label));
  assert.equal(labels.filter(label=>label==='Colossal Smash').length,2);
  assert.equal(result.timeline[1]?.atSeconds,.71);
});

function participant(
  key:BotLaneKey,team:'YOU'|'THEM',role:'ADC'|'SUPPORT',champion:string,
  sequence:('AA'|'Q'|'W')[],autoAttack:AutoAttackModel,abilities:Partial<Record<'Q'|'W',AbilityModel>>={},
):BotLaneParticipantInput{
  const enemy:BotLaneKey=team==='YOU'?'THEM_ADC':'YOU_ADC';
  return {
    key,team,role,champion,sequence,abilities,autoAttack,mana:0,maxHealth:10000,currentHealth:10000,
    resistances:{armor:0,magicResist:0},focusTarget:enemy,
  };
}

test('Bot Duo also allows a refunded second Colossal Smash on the shared four-player clock',()=>{
  const inputs={
    YOU_ADC:participant('YOU_ADC','YOU','ADC','Galio',['AA','Q','W','AA'],galioAuto(),{Q:spell('Q'),W:spell('W')}),
    YOU_SUPPORT:participant('YOU_SUPPORT','YOU','SUPPORT','Ally',[],{damage:0,attackSpeed:1}),
    THEM_ADC:participant('THEM_ADC','THEM','ADC','Target',[],{damage:0,attackSpeed:1}),
    THEM_SUPPORT:participant('THEM_SUPPORT','THEM','SUPPORT','Enemy support',[],{damage:0,attackSpeed:1}),
  } as Record<BotLaneKey,BotLaneParticipantInput>;

  const result=simulateBotLane(inputs,10);
  const galioActions=result.timeline.flatMap(frame=>frame.actions.filter(action=>action.actor==='YOU_ADC'));
  assert.equal(galioActions.filter(action=>action.note?.includes('Colossal Smash consumed')).length,2);
  assert.equal(galioActions[1]?.step,'Q');
  assert.equal(result.timeline.find(frame=>frame.actions.some(action=>action.actor==='YOU_ADC'&&action.step==='Q'))?.atSeconds,.71);
});