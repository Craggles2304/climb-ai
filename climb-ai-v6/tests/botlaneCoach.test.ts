import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBotLaneCoachPlan} from '../lib/combat/botlaneCoach';
import type {LaneCoachParticipant} from '../lib/combat/botlaneCoach';
import type {BotLaneFocusComparison,BotLaneResult,BotLaneSnapshot} from '../lib/combat/botlane';

const snap=(key:BotLaneSnapshot['key'],champion:string,team:'YOU'|'THEM',role:'ADC'|'SUPPORT',health=1000):BotLaneSnapshot=>({
  key,champion,team,role,health,maxHealth:1000,shield:0,mana:500,alive:health>0,
  damageDealt:0,damageTaken:0,healingDone:0,shieldingDone:0,controlledUntil:0,
});

const result=(overrides:Partial<BotLaneResult>={}):BotLaneResult=>({
  verdict:'EVEN',winner:null,durationSeconds:5,timeline:[],kills:[],firstKill:null,incomplete:false,
  participants:{
    YOU_ADC:snap('YOU_ADC',"Kog'Maw",'YOU','ADC'),
    YOU_SUPPORT:snap('YOU_SUPPORT','Lulu','YOU','SUPPORT'),
    THEM_ADC:snap('THEM_ADC','Caitlyn','THEM','ADC'),
    THEM_SUPPORT:snap('THEM_SUPPORT','Lux','THEM','SUPPORT'),
  },
  teamDamage:{YOU:500,THEM:500},
  damageContribution:{YOU_ADC:400,YOU_SUPPORT:100,THEM_ADC:400,THEM_SUPPORT:100},
  assumptions:[],modelNote:'test',...overrides,
});

const focus=(base:BotLaneResult):BotLaneFocusComparison=>({
  recommendedTarget:'THEM_ADC',recommendedRole:'ADC',reason:'ADC focus scores higher.',
  adcFocus:base,supportFocus:base,
});

const participant=(champion:string,attackRange:number,accessMode:'FULL'|'NO_AUTOS'='FULL'):LaneCoachParticipant=>({
  champion,attackRange,accessMode,missedAbilities:[],
});

test('winning shared-clock result produces an all-in call',()=>{
  const r=result({verdict:'YOU_WIN',winner:'YOU',teamDamage:{YOU:900,THEM:400}});
  const plan=buildBotLaneCoachPlan({
    result:r,focus:focus(r),
    yourAdc:participant("Kog'Maw",710),yourSupport:participant('Lulu',550),
    enemyAdc:participant('Caitlyn',650),enemySupport:participant('Lux',550),
  });
  assert.equal(plan.call,'ALL_IN');
  assert.equal(plan.targetChampion,'Caitlyn');
});

test('no-auto access overrides a neutral fight into farm-first coaching',()=>{
  const r=result();
  const plan=buildBotLaneCoachPlan({
    result:r,focus:focus(r),
    yourAdc:participant("Kog'Maw",500,'NO_AUTOS'),yourSupport:participant('Lulu',550),
    enemyAdc:participant('Caitlyn',650),enemySupport:participant('Lux',550),
  });
  assert.equal(plan.call,'FARM');
  assert.ok(plan.rerunTriggers.some(x=>x.includes('autos are currently excluded')));
});

test('large clean range edge yields poke plan when neither side is lethal',()=>{
  const r=result({verdict:'EVEN'});
  const plan=buildBotLaneCoachPlan({
    result:r,focus:focus(r),
    yourAdc:participant('Ashe',700),yourSupport:participant('Lulu',550),
    enemyAdc:participant('Vayne',550),enemySupport:participant('Nautilus',175),
  });
  assert.equal(plan.call,'POKE');
  assert.equal(plan.rangeLabel,'YOU');
  assert.equal(plan.rangeDelta,150);
});

test('forced misses are surfaced as rerun triggers rather than hidden probability',()=>{
  const r=result();
  const you=participant("Kog'Maw",500);
  you.missedAbilities=['Q'];
  const plan=buildBotLaneCoachPlan({
    result:r,focus:focus(r),yourAdc:you,yourSupport:participant('Lulu',550),
    enemyAdc:participant('Caitlyn',650),enemySupport:participant('Lux',550),
  });
  assert.ok(plan.rerunTriggers.some(x=>x.includes('Q is currently set to MISS')));
});