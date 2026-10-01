import test from 'node:test';
import assert from 'node:assert/strict';
import {coachingDevelopmentBand,coachingNeedScore,coachingPriority} from '../lib/coachingPriorityEngine';

test('rank bands change what the coach looks for first',()=>{
  assert.equal(coachingDevelopmentBand('Bronze IV'),'FUNDAMENTALS');
  assert.equal(coachingDevelopmentBand('Gold II'),'CONTROL');
  assert.equal(coachingDevelopmentBand('Emerald I'),'MACRO');
  assert.equal(coachingDevelopmentBand('Diamond III'),'DECISION');
});

test('Bronze ADC prioritises farming and survival over advanced fight optimisation',()=>{
  const farm=coachingPriority('ADC','Bronze IV','LANING','laneCsPerMin');
  const fight=coachingPriority('ADC','Bronze IV','TEAMFIGHTING','fight_selection');
  assert.ok(farm.score>fight.score);
  const farmNeed=coachingNeedScore({role:'ADC',rank:'Bronze IV',category:'LANING',metric:'laneCsPerMin',evidenceProgress:40,legacyPriority:78});
  const fightNeed=coachingNeedScore({role:'ADC',rank:'Bronze IV',category:'TEAMFIGHTING',metric:'fight_selection',evidenceProgress:20,legacyPriority:95});
  assert.ok(farmNeed.score>fightNeed.score);
});

test('Support priorities are role specific',()=>{
  const vision=coachingPriority('SUPPORT','Bronze II','VISION','visionScore');
  const farming=coachingPriority('SUPPORT','Bronze II','FARMING','csPerMin');
  assert.ok(vision.score>farming.score);
});

test('Platinum jungle prioritises objective and map conversion',()=>{
  const objective=coachingPriority('JUNGLE','Platinum II','OBJECTIVES','objectiveParticipation');
  const farm=coachingPriority('JUNGLE','Platinum II','FARMING','csPerMin');
  assert.ok(objective.score>farm.score);
});

test('Diamond ADC prioritises decision quality above basic lane farm maintenance',()=>{
  const fight=coachingPriority('ADC','Diamond II','TEAMFIGHTING','fight_selection');
  const farm=coachingPriority('ADC','Diamond II','LANING','laneCsPerMin');
  assert.ok(fight.score>farm.score);
});
