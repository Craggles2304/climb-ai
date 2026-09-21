import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionPremortem,reviewDecisionPremortem} from '../lib/decisionPremortem';
import type {DecisionTwinProfile} from '../lib/decisionTwin';

function baseTwin():DecisionTwinProfile{
  return{
    version:1,
    gamesAnalyzed:8,
    generatedAt:'2026-09-21T09:00:00.000Z',
    strongest:null,
    currentLimiter:null,
    mastered:[],
    masteredSituations:[],
    improvingSituations:[],
    behaviours:[
      {
        key:'CARRY_PRESERVATION',
        label:'Carry Preservation',
        metric:'carry_preservation',
        description:'Preserve safe damage uptime.',
        applicableGames:8,
        evidenceCount:14,
        averageScore:61,
        recentScore:55,
        trend:'WORSENING',
        confidence:'HIGH',
        state:'LIMITER',
        contexts:[{champion:'Aphelios',role:'ADC',applicableGames:8,averageScore:61}],
        lastSeenAt:'2026-09-20T21:00:00.000Z',
      },
      {
        key:'OBJECTIVE_READINESS',
        label:'Objective Arrival',
        metric:'objective_readiness',
        description:'Arrive early enough to establish useful geometry.',
        applicableGames:6,
        evidenceCount:9,
        averageScore:68,
        recentScore:64,
        trend:'STABLE',
        confidence:'HIGH',
        state:'AT_RISK',
        contexts:[],
        lastSeenAt:'2026-09-20T21:00:00.000Z',
      },
    ] as any,
    situationPatterns:[
      {
        id:'multi_access:carry_preservation:adc',
        tag:'MULTI_ACCESS',
        behaviourKey:'CARRY_PRESERVATION',
        behaviourLabel:'Carry Preservation',
        role:'ADC',
        applicableGames:6,
        decisions:9,
        failures:6,
        successes:3,
        failureRate:67,
        recentDecisions:6,
        recentFailures:5,
        recentSuccesses:1,
        recentFailureRate:83,
        priorDecisions:3,
        priorFailures:1,
        priorFailureRate:33,
        deltaFailureRate:50,
        coachedGames:2,
        coachedDecisions:3,
        coachedExecuted:1,
        coachedMissed:2,
        coachedExecutionRate:33,
        state:'REGRESSING',
        confidence:'HIGH',
        enemyExamples:['Pantheon','Vi'],
        championExamples:['Aphelios'],
        lastSeenAt:'2026-09-20T21:00:00.000Z',
      },
    ],
  };
}

const draft={
  champion:'Aphelios',
  role:'ADC',
  ours:[
    {champion:'Aphelios',role:'ADC'},
    {champion:'Rakan',role:'SUPPORT'},
    {champion:'Orianna',role:'MID'},
    {champion:'Ornn',role:'TOP'},
    {champion:'Sejuani',role:'JUNGLE'},
  ],
  enemies:[
    {champion:'Pantheon',role:'MID'},
    {champion:'Vi',role:'JUNGLE'},
    {champion:'Nautilus',role:'SUPPORT'},
    {champion:'Jinx',role:'ADC'},
    {champion:'Gnar',role:'TOP'},
  ],
};

test('Decision Pre-Mortem promotes the strongest repeated draft-matched personal risk',()=>{
  const result=buildDecisionPremortem(baseTwin(),draft);
  assert.equal(result.status,'READY');
  assert.ok(result.risks.length>=1);
  assert.equal(result.risks[0].behaviourKey,'CARRY_PRESERVATION');
  assert.equal(result.risks[0].situationTag,'MULTI_ACCESS');
  assert.equal(result.risks[0].source,'SITUATION_PATTERN');
  assert.equal(result.risks[0].rank,1);
  assert.ok(result.risks[0].priorityScore>=70);
  assert.match(result.risks[0].preventionRule,/FIRST ENGAGE/i);
  assert.match(result.risks[0].preventionRule,/PANTHEON|VI|NAUTILUS/i);
  assert.match(result.boundary,/not a probability/i);
});

test('Decision Pre-Mortem does not manufacture a risk from mastered or insufficient evidence',()=>{
  const twin=baseTwin();
  twin.behaviours=(twin.behaviours as any[]).map(item=>({...item,state:'MASTERED',recentScore:92}));
  twin.situationPatterns=twin.situationPatterns.map(pattern=>({...pattern,state:'MASTERED',recentFailureRate:0,recentFailures:0,recentSuccesses:6}));
  const mastered=buildDecisionPremortem(twin,draft);
  assert.equal(mastered.status,'NONE');
  assert.equal(mastered.risks.length,0);

  const building=buildDecisionPremortem({...baseTwin(),gamesAnalyzed:2},draft);
  assert.equal(building.status,'BUILDING');
  assert.equal(building.risks.length,0);
});

test('Pre-Mortem review only grades verified comparable decisions that actually appeared',()=>{
  const premortem=buildDecisionPremortem(baseTwin(),draft);
  const top=premortem.risks[0];
  const beaten=reviewDecisionPremortem(premortem,[
    {behaviourKey:top.behaviourKey,verdict:'GOOD',confidence:'HIGH',situationTags:['MULTI_ACCESS']},
    {behaviourKey:top.behaviourKey,verdict:'GOOD',confidence:'MEDIUM',situationTags:['MULTI_ACCESS']},
  ]);
  assert.equal(beaten.results[0].outcome,'BEAT_PATTERN');
  assert.equal(beaten.beatenRisks,1);

  const hit=reviewDecisionPremortem(premortem,[
    {behaviourKey:top.behaviourKey,verdict:'IMPROVE',confidence:'HIGH',situationTags:['MULTI_ACCESS']},
  ]);
  assert.equal(hit.results[0].outcome,'PATTERN_HIT');
  assert.equal(hit.hitRisks,1);

  const unseen=reviewDecisionPremortem(premortem,[
    {behaviourKey:'RESET_DISCIPLINE',verdict:'GOOD',confidence:'HIGH',situationTags:['GENERAL']},
  ]);
  assert.equal(unseen.results[0].outcome,'NOT_OBSERVED');
  assert.equal(unseen.observedRisks,0);
  assert.match(unseen.boundary,/not counted as success or failure/i);
});

test('Pre-Mortem review can distinguish mixed execution from a clean binary story',()=>{
  const premortem=buildDecisionPremortem(baseTwin(),draft);
  const top=premortem.risks[0];
  const result=reviewDecisionPremortem(premortem,[
    {behaviourKey:top.behaviourKey,verdict:'GOOD',confidence:'HIGH',situationTags:['MULTI_ACCESS']},
    {behaviourKey:top.behaviourKey,verdict:'IMPROVE',confidence:'HIGH',situationTags:['MULTI_ACCESS']},
  ]);
  assert.equal(result.results[0].outcome,'MIXED');
  assert.equal(result.mixedRisks,1);
  assert.equal(result.results[0].goodMoments,1);
  assert.equal(result.results[0].improveMoments,1);
});
