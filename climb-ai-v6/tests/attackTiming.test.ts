import test from 'node:test';
import assert from 'node:assert/strict';
import {basicAttackHitTiming} from '../lib/combat/attackTiming';
import {championAttackTiming} from '../lib/combat/championAttackTimings';
import {
  applyConfiguredAttackReplacement,configureChampionAttackReplacement,
} from '../lib/combat/championAttackReplacements';
import {buildChampionCombatProfile} from '../lib/combat/championEffects';
import {simulateCombo,type AbilityModel,type AutoAttackModel} from '../lib/combat/combos';
import {runTrade,type TradeSide} from '../lib/combat/trades';
import {simulateAdvancedDuel} from '../lib/combat/duelAdvanced';
import {simulateBotLane,type BotLaneKey,type BotLaneParticipantInput} from '../lib/combat/botlane';

const spell=(slot:'Q'|'W',damage=10,castTimeSeconds=.1):AbilityModel=>({
  slot,name:`Test ${slot}`,rank:1,cooldownSeconds:20,cost:0,castTimeSeconds,
  damage:[{label:`${slot} damage`,type:'MAGIC',raw:damage}],
});

const timedAuto=(championId:string,windupPercent:number,damage=100):AutoAttackModel=>({
  damage,attackSpeed:1,
  eventState:{attackTiming:{championId,patch:'16.18.1',windupPercent}},
});

test('validated 16.18 timing registry exposes exact priority champion windups and fails closed',()=>{
  const expected:Record<string,number>={
    Aphelios:.15333,Ashe:.2193,Ezreal:.188387,Galio:.20625,Hecarim:.25,
    Jinx:.16875,"Kog'Maw":.16622,Shen:.17361,Vayne:.17544,Viego:.16447,
  };
  for(const [champion,value] of Object.entries(expected))
    assert.equal(championAttackTiming(champion,'16.18.1')?.windupPercent,value,champion);

  assert.equal(championAttackTiming('Kog’Maw','16.18.1')?.windupPercent,.16622);
  assert.equal(championAttackTiming('Galio','16.19.1'),null);
  assert.equal(championAttackTiming('Unknown Champion','16.18.1'),null);
});

test('shared hit timing keeps Galio ordinary and empowered windups separate from attack cadence',()=>{
  const model=timedAuto('galio',.20625);
  const ordinary=basicAttackHitTiming(model,0,1);
  const empowered=basicAttackHitTiming(model,0,1,.25);
  assert.ok(Math.abs(ordinary.hitsAt-.20625)<1e-9);
  assert.ok(Math.abs(empowered.hitsAt-.165)<1e-9);
  assert.equal(basicAttackHitTiming({damage:100,attackSpeed:1},0,1).hitsAt,0);
});

test('Galio regression sequence resolves empowered hits on landing and starts recharge there',()=>{
  const profile=buildChampionCombatProfile('Galio',['GALIO_PASSIVE_READY'],{}, {abilityPower:0,level:18});
  configureChampionAttackReplacement('Galio',['GALIO_PASSIVE_READY'],profile,{
    patch:'16.18.1',level:18,attackDamage:100,abilityPower:0,bonusMagicResist:0,critChance:0,
  });
  const model=applyConfiguredAttackReplacement({damage:100,attackSpeed:1},profile);
  const result=simulateCombo({
    sequence:['AA','Q','W','AA'],abilities:{Q:spell('Q'),W:spell('W')},autoAttack:model,
    caster:{mana:0},target:{health:5000,maxHealth:5000,armor:0,magicResist:0},
  });

  assert.deepEqual(result.events.map(event=>event.atSeconds),[.17,1,1.1,1.37]);
  assert.equal(result.events[0].label,'Colossal Smash');
  assert.equal(result.events[3].label,'Colossal Smash');
  assert.match(result.events[0].note??'',/ready again at 5\.17s/i);
  assert.match(result.events[3].note??'',/ready again at 6\.37s/i);
});

test('timed trade does not count a basic attack whose validated windup lands outside the window',()=>{
  const actor:TradeSide={
    champion:'Galio',abilities:{},autoAttack:timedAuto('galio',.20625),mana:0,
    maxHealth:1000,currentHealth:1000,resistances:{armor:0,magicResist:0},
  };
  const target:TradeSide={
    champion:'Dummy',abilities:{},autoAttack:{damage:0,attackSpeed:1},mana:0,
    maxHealth:1000,currentHealth:1000,resistances:{armor:0,magicResist:0},
  };
  const result=runTrade(actor,target,{key:'WINDOW',label:'150ms',budgetSeconds:.15,autosOnly:true});
  assert.equal(result.damageDealt,0);
  assert.equal(result.steps.length,0);
});

test('simultaneous duel carries a validated auto as a pending hit until windup impact',()=>{
  const result=simulateAdvancedDuel(
    {
      side:'YOU',champion:'Galio',sequence:['AA'],abilities:{},autoAttack:timedAuto('galio',.20625),
      mana:0,maxHealth:1000,currentHealth:1000,resistances:{armor:0,magicResist:0},
    },
    {
      side:'THEM',champion:'Dummy',sequence:['Q'],abilities:{Q:spell('Q',10,.05)},autoAttack:{damage:0,attackSpeed:1},
      mana:0,maxHealth:1000,currentHealth:1000,resistances:{armor:0,magicResist:0},
    },
    2,
  );
  const galioFrame=result.timeline.find(frame=>frame.actions.some((action:any)=>action.champion==='Galio'));
  assert.equal(galioFrame?.atSeconds,.21);
  assert.equal(galioFrame?.actions.find((action:any)=>action.champion==='Galio')?.damageApplied,100);
});

function participant(
  key:BotLaneKey,team:'YOU'|'THEM',role:'ADC'|'SUPPORT',champion:string,
  sequence:('AA'|'Q')[],autoAttack:AutoAttackModel,
  options:{abilities?:Partial<Record<'Q',AbilityModel>>;health?:number;focusTarget?:BotLaneKey}={},
):BotLaneParticipantInput{
  return {
    key,team,role,champion,sequence,abilities:options.abilities??{},autoAttack,mana:0,
    maxHealth:options.health??1000,currentHealth:options.health??1000,
    resistances:{armor:0,magicResist:0},
    focusTarget:options.focusTarget??(team==='YOU'?'THEM_ADC':'YOU_ADC'),
  };
}

test('Bot Duo locks the original target while a validated basic attack is winding up',()=>{
  const inputs={
    YOU_ADC:participant('YOU_ADC','YOU','ADC','Galio',['AA'],timedAuto('galio',.20625),{focusTarget:'THEM_ADC'}),
    YOU_SUPPORT:participant('YOU_SUPPORT','YOU','SUPPORT','Ally',['Q'],{damage:0,attackSpeed:1},{
      abilities:{Q:spell('Q',500,0)},focusTarget:'THEM_ADC',
    }),
    THEM_ADC:participant('THEM_ADC','THEM','ADC','First target',[],{damage:0,attackSpeed:1},{health:100}),
    THEM_SUPPORT:participant('THEM_SUPPORT','THEM','SUPPORT','Second target',[],{damage:0,attackSpeed:1},{health:1000}),
  } as Record<BotLaneKey,BotLaneParticipantInput>;

  const result=simulateBotLane(inputs,1);
  const pending=result.timeline.flatMap(frame=>frame.actions.map(action=>({frame,action})))
    .find(x=>x.action.actor==='YOU_ADC'&&x.action.step==='AA');
  assert.equal(pending?.frame.atSeconds,.21);
  assert.equal(pending?.action.target,'THEM_ADC');
  assert.match(pending?.action.note??'',/does not retarget/i);
  assert.equal(result.participants.THEM_SUPPORT.health,1000);
});