import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionSimulation,reviewDecisionSimulation} from '../lib/decisionSimulation';
import type {DecisionTwinProfile,DraftSituationContext} from '../lib/decisionTwin';
import type {DecisionPremortem} from '../lib/decisionPremortem';

function twin(games=8):DecisionTwinProfile{
  return{
    version:1,
    gamesAnalyzed:games,
    behaviours:[],
    situationPatterns:[],
    masteredSituations:[],
    improvingSituations:[],
    strongest:null,
    currentLimiter:null,
    mastered:[],
    generatedAt:'2026-09-21T10:00:00.000Z',
  };
}

function context(tags:DraftSituationContext['tags']):DraftSituationContext{
  return{
    tags,
    champion:'Aphelios',
    role:'ADC',
    enemyAccess:['Pantheon','Irelia','Sett'],
    enemyPicks:['Pantheon','Thresh'],
    enemyZones:['Orianna'],
  };
}

function premortem():DecisionPremortem{
  return{
    version:1,
    status:'READY',
    headline:'YOUR 2 HIGHEST-RISK DECISION WINDOWS',
    summary:'Repeated personal evidence + this draft.',
    boundary:'priority not probability',
    risks:[
      {
        id:'premortem:multi_access:carry_preservation:adc',
        rank:1,
        behaviourKey:'CARRY_PRESERVATION',
        behaviourLabel:'Carry Preservation',
        situationTag:'MULTI_ACCESS',
        source:'SITUATION_PATTERN',
        confidence:'HIGH',
        priorityScore:92,
        title:'SURVIVE THE SECOND ACCESS LAYER',
        trigger:'WHEN PANTHEON STARTS FIRST CONTACT AND IRELIA CAN STILL ACCESS.',
        preventionRule:'HOLD RANGE UNTIL BOTH ACCESS LAYERS ARE ACCOUNTED FOR.',
        branchRules:{
          AHEAD:'AHEAD: HOLD RANGE.',
          EVEN:'EVEN: HOLD RANGE.',
          BEHIND:'BEHIND: REDUCE VARIANCE.',
        },
        evidence:'HIGH confidence · 7/10 comparable misses.',
        relevantEnemies:['Pantheon','Irelia'],
      },
      {
        id:'premortem:pick:fight_selection:adc',
        rank:2,
        behaviourKey:'FIGHT_SELECTION',
        behaviourLabel:'Fight Selection',
        situationTag:'PICK_PRESSURE',
        source:'SITUATION_PATTERN',
        confidence:'MEDIUM',
        priorityScore:81,
        title:'DO NOT INHERIT THEIR PICK FIGHT',
        trigger:'WHEN THRESH OR PANTHEON CREATE FIRST CONTACT BEFORE FORMATION.',
        preventionRule:'WAIT FOR YOUR OWN FIGHT TRIGGER.',
        branchRules:{
          AHEAD:'AHEAD: WAIT FOR YOUR TRIGGER.',
          EVEN:'EVEN: WAIT FOR YOUR TRIGGER.',
          BEHIND:'BEHIND: REDUCE VARIANCE.',
        },
        evidence:'MEDIUM confidence · 5/8 comparable misses.',
        relevantEnemies:['Pantheon','Thresh'],
      },
    ],
  };
}

const coach={
  headline:'SURVIVE FIRST DIVE → FREE-HIT',
  theirPlan:'Pantheon / Irelia force your position first.',
  threatAnswer:'HOLD POSITION BEHIND PEEL UNTIL PANTHEON / IRELIA COMMIT.',
  fightTrigger:'PANTHEON COMMITS → HIT CLOSEST SAFE TARGET.',
  objectiveSetup:'ARRIVE FIRST → KEEP APHELIOS ONE LAYER BACK.',
  never:'WALK THROUGH ACCESS JUST TO REACH THE ADC.',
  ifBehind:'SAFE WAVES → GROUP ON ITEM → MAKE THEM ENTER YOU.',
};

test('V3 builds 3-5 exact-draft simulations and keeps personal forecasts distinct from rehearsals',()=>{
  const sim=buildDecisionSimulation({
    twin:twin(),
    premortem:premortem(),
    situationContext:context(['MULTI_ACCESS','PICK_PRESSURE','ZONE_OBJECTIVE','SCALING_WINDOW']),
    champion:'Aphelios',
    role:'ADC',
    coach,
  });
  assert.equal(sim.status,'READY');
  assert.ok(sim.scenarios.length>=3&&sim.scenarios.length<=5);
  assert.equal(sim.personalForecastCount,2);
  assert.ok(sim.draftRehearsalCount>=1);
  assert.equal(sim.scenarios[0].source,'PERSONAL_RISK');
  assert.match(sim.scenarios[0].exactDraftRead,/multiple ways to reach you/i);
  assert.match(sim.scenarios[0].twinLikelyMove,/step forward/i);
  assert.match(sim.scenarios[0].targetMove,/hold range/i);
  assert.match(sim.boundary,/draft rehearsals are not personal predictions/i);
});

test('V3 never manufactures a personal prediction when the Twin is still building',()=>{
  const sim=buildDecisionSimulation({
    twin:twin(1),
    premortem:{version:1,status:'BUILDING',headline:'BUILDING',summary:'More evidence',risks:[],boundary:'bounded'},
    situationContext:context(['MULTI_ACCESS','ZONE_OBJECTIVE','SCALING_WINDOW']),
    champion:'Aphelios',
    role:'ADC',
    coach,
  });
  assert.equal(sim.status,'READY');
  assert.equal(sim.personalForecastCount,0);
  assert.ok(sim.scenarios.length>=3);
  assert.ok(sim.scenarios.every(item=>item.source==='DRAFT_REHEARSAL'));
  assert.ok(sim.scenarios.every(item=>/NO PERSONAL PREDICTION/i.test(item.twinLikelyMove)));
  assert.match(sim.summary,/does not yet have enough personal evidence/i);
});

test('post-game V3 review scores only scenarios that produced comparable verified decisions',()=>{
  const sim=buildDecisionSimulation({
    twin:twin(),
    premortem:premortem(),
    situationContext:context(['MULTI_ACCESS','PICK_PRESSURE','ZONE_OBJECTIVE']),
    champion:'Aphelios',
    role:'ADC',
    coach,
  });
  const review=reviewDecisionSimulation(sim,[
    {behaviourKey:'CARRY_PRESERVATION',verdict:'IMPROVE',confidence:'HIGH',situationTags:['MULTI_ACCESS']},
    {behaviourKey:'FIGHT_SELECTION',verdict:'GOOD',confidence:'HIGH',situationTags:['PICK_PRESSURE']},
    {behaviourKey:'OBJECTIVE_READINESS',verdict:'GOOD',confidence:'MEDIUM',situationTags:['ZONE_OBJECTIVE']},
  ]);
  assert.equal(review.active,true);
  assert.ok(review.observedScenarios>=3);
  assert.equal(review.twinRepeated,1);
  assert.equal(review.twinBeaten,1);
  assert.ok(review.draftExecuted>=1);
  assert.ok(review.unobserved>=0);
  assert.match(review.boundary,/unobserved scenarios are not counted/i);
});

test('an unobserved personal forecast never becomes a false hit or false success',()=>{
  const sim=buildDecisionSimulation({
    twin:twin(),
    premortem:premortem(),
    situationContext:context(['MULTI_ACCESS','PICK_PRESSURE']),
    champion:'Aphelios',
    role:'ADC',
    coach,
  });
  const review=reviewDecisionSimulation(sim,[]);
  assert.equal(review.observedScenarios,0);
  assert.equal(review.twinRepeated,0);
  assert.equal(review.twinBeaten,0);
  assert.equal(review.unobserved,sim.scenarios.length);
  assert.match(review.note,/will not score them/i);
});
