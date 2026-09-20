import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionGraph,lockedPlanFromPregameContext} from '../lib/decisionGraph';
import type {ProMatchAnalysis} from '../lib/riot/proAnalysis';
import type {StrengthTimeline,FightReview} from '../lib/riot/liveStrength';

function fight(overrides:Partial<FightReview>={}):FightReview{
  return{
    atSeconds:600,
    category:'WEAKNESS',
    outcome:'DEATH',
    opponent:'Pantheon',
    opponentChampion:'Pantheon',
    score:-22,
    verdict:'THEM_STRONGER',
    headline:'Death vs Pantheon',
    summary:'You died while the opponent already held the stronger visible combat state.',
    evidence:{
      youLevel:9,
      themLevel:10,
      levelDelta:-1,
      youItemGold:4200,
      themItemGold:4700,
      itemGoldDelta:-500,
      currentGold:450,
      healthPct:.7,
      manaPct:.6,
    },
    why:['Enemy held stronger state.'],
    howToWin:['Wait for setup.'],
    howYouLose:['Enter first.'],
    betterDecision:['Decline the fight.'],
    limitation:'Visible-state retrospective only.',
    ...overrides,
  };
}

function analysis():ProMatchAnalysis{
  return{
    version:1,
    champion:'Aphelios',
    role:'ADC',
    evidenceSources:['LIVE_TRACKER'],
    metrics:{
      objective_readiness:{
        key:'objective_readiness',
        label:'OBJECTIVE READINESS',
        score:40,
        value:'2/5 ready',
        status:'DERIVED',
        confidence:'HIGH',
        sources:['LIVE_TRACKER'],
        summary:'Readiness proxy around major objective events.',
        evidence:[{atSeconds:1180,label:'DragonKill',detail:'You died within 45s before this event.'}],
      },
      carry_preservation:{
        key:'carry_preservation',
        label:'CARRY PRESERVATION',
        score:45,
        value:'2/4 high-value deaths',
        status:'DERIVED',
        confidence:'HIGH',
        sources:['LIVE_TRACKER'],
        summary:'High-value carry deaths.',
        evidence:[{atSeconds:900,label:'High-value death',detail:'You were #1 on your team in visible item value.'}],
      },
      power_spike_conversion:{
        key:'power_spike_conversion',
        label:'POWER-SPIKE CONVERSION',
        score:90,
        value:'3/3 converted',
        status:'DERIVED',
        confidence:'MEDIUM',
        sources:['LIVE_TRACKER'],
        summary:'Power windows converted.',
        evidence:[{atSeconds:760,label:'Major item spike',detail:'Positive fight conversion followed inside 2 minutes.'}],
      },
    },
    leakSignals:[
      {key:'RED_STATE',label:'Bad fight selection',count:2,severity:'ACTIVE',detail:'Deaths taken from enemy-favoured visible states.',evidenceSeconds:[600,1320]},
      {key:'CARRY_DEATH',label:'Carry preservation',count:1,severity:'POLISH',detail:'Death while top-two visible item value.',evidenceSeconds:[900]},
    ],
    fingerprint:{primary:'BAD FIGHT SELECTION',sequence:['Accept enemy-favoured fight'],confidence:'HIGH',explanation:'Repeated pattern.'},
  };
}

function summary():StrengthTimeline{
  return{
    points:[],
    opportunities:[],
    fightReviews:[
      fight(),
      fight({atSeconds:760,category:'STRENGTH',outcome:'KILL',verdict:'YOU_STRONGER',score:28,headline:'Kill on Lucian',opponent:'Lucian',opponentChampion:'Lucian',summary:'You converted the visible advantage into a positive result.'}),
      fight({atSeconds:900,verdict:'EVEN',score:0,headline:'Death vs Sett',opponent:'Sett',opponentChampion:'Sett',evidence:{youLevel:12,themLevel:12,levelDelta:0,youItemGold:7200,themItemGold:7000,itemGoldDelta:200,currentGold:300,healthPct:.9,manaPct:.7}}),
      fight({atSeconds:1320,verdict:'THEM_STRONGER',score:-18,headline:'Death vs Irelia',opponent:'Irelia',opponentChampion:'Irelia'}),
    ],
    strongestWindow:null,
    weakestWindow:null,
    modelNote:'Visible state only.',
  };
}

test('Decision Graph reconstructs evidence nodes and compares them with the locked pre-game plan',()=>{
  const graph=buildDecisionGraph({
    analysis:analysis(),
    summary:summary(),
    generatedAt:'2026-09-20T18:00:00.000Z',
    lockedPlan:{
      source:'ai',
      headline:'SURVIVE FIRST DIVE → FREE-HIT',
      fightTrigger:'Pantheon commits → hit closest safe target and advance only after access disappears.',
      objectiveSetup:'Arrive first and hold Aphelios one layer behind Rakan.',
      never:'Do not walk through Sett + Pantheon + Irelia to reach Lucian.',
      ifBehind:'Clear safe wave then group early.',
      personalTrap:{
        status:'READY',
        behaviourKey:'FIGHT_SELECTION',
        behaviourLabel:'Fight Selection',
        cue:'WAIT FOR PANTHEON TO COMMIT BEFORE CROSSING THE FRONT EDGE.',
        proof:'Repeated multi-access evidence.',
        source:'SITUATION_PATTERN',
        situationTag:'MULTI_ACCESS',
        relevantEnemies:['Pantheon','Sett','Irelia'],
      },
      situationContext:{
        tags:['MULTI_ACCESS','SCALING_WINDOW'],
        champion:'Aphelios',
        role:'ADC',
        enemyAccess:['Sett','Pantheon','Irelia'],
        enemyPicks:[],
        enemyZones:[],
      },
    },
  });
  assert.equal(graph.version,1);
  assert.equal(graph.planAvailable,true);
  assert.ok(graph.nodeCount>=4);
  assert.ok(graph.highConfidenceCount>=2);
  const fightNode=graph.nodes.find(node=>node.behaviourKey==='FIGHT_SELECTION'&&node.atSeconds===600);
  assert.ok(fightNode);
  assert.equal(fightNode?.verdict,'IMPROVE');
  assert.equal(fightNode?.planAlignment,'CONFLICTED');
  assert.match(fightNode?.lockedPrinciple||'',/Pantheon commits/i);
  assert.match(fightNode?.decisionRead||'',/stronger visible combat state/i);
  assert.ok(fightNode?.situationTags.includes('MULTI_ACCESS'));
  assert.deepEqual(fightNode?.contextEnemies,['Sett','Pantheon','Irelia']);
  assert.ok(fightNode?.counterfactual);
  assert.equal(fightNode?.counterfactual?.alternative,'Decline the fight.');
  assert.ok(fightNode?.counterfactual?.basis.includes('RECORDED_ALTERNATIVE'));
  assert.ok(fightNode?.counterfactual?.basis.includes('LOCKED_PLAN'));
  assert.match(fightNode?.counterfactual?.whyBetter||'',/frozen pre-game principle/i);
  assert.match(fightNode?.counterfactual?.outcomeBoundary||'',/does not claim/i);
  assert.ok(fightNode?.coachingResponse);
  assert.equal(fightNode?.coachingResponse?.status,'MISSED');
  assert.match(fightNode?.coachingResponse?.cue||'',/PANTHEON/i);
  assert.match(fightNode?.coachingResponse?.boundary||'',/does not claim the cue caused/i);
  const objective=graph.nodes.find(node=>node.behaviourKey==='OBJECTIVE_READINESS');
  assert.ok(objective);
  assert.equal(objective?.planAlignment,'CONFLICTED');
  assert.match(objective?.lockedPrinciple||'',/Arrive first/i);
  assert.ok(objective?.counterfactual);
  assert.match(objective?.counterfactual?.alternative||'',/arrive before/i);
  assert.match(objective?.counterfactual?.tradeoff||'',/wave|camp/i);
  const spike=graph.nodes.find(node=>node.behaviourKey==='POWER_SPIKE_CONVERSION');
  assert.ok(spike);
  assert.equal(spike?.verdict,'GOOD');
  assert.equal(spike?.planAlignment,'MATCHED');
  assert.equal(spike?.counterfactual,null);
  assert.ok(graph.summary.counterfactualCount>=2);
  assert.ok(graph.summary.topCounterfactualNodeIds.length>=1);
  assert.ok(graph.summary.topCounterfactualNodeIds.length<=3);
  assert.equal(graph.summary.coachingResponse.activeCue,true);
  assert.equal(graph.summary.coachingResponse.behaviourKey,'FIGHT_SELECTION');
  assert.ok(graph.summary.coachingResponse.matchedMoments>=1);
  assert.ok(graph.summary.coachingResponse.missed>=1);
  assert.equal(graph.summary.coachingResponse.status,'MISSING');
});

test('Decision Graph never claims plan alignment when no locked plan survived',()=>{
  const graph=buildDecisionGraph({analysis:analysis(),summary:summary()});
  assert.equal(graph.planAvailable,false);
  assert.ok(graph.nodes.length>0);
  assert.ok(graph.nodes.every(node=>node.planAlignment==='NOT_VERIFIABLE'));
  assert.ok(graph.nodes.every(node=>node.lockedPrinciple===null));
});

test('Decision Graph dedupes overlapping leak and fight evidence rather than double-counting one moment',()=>{
  const graph=buildDecisionGraph({analysis:analysis(),summary:summary()});
  const redAt600=graph.nodes.filter(node=>node.behaviourKey==='FIGHT_SELECTION'&&Math.abs(node.atSeconds-600)<=12);
  assert.equal(redAt600.length,1);
});

test('linked pre-game context extracts only the immutable coaching fields needed for retrospective comparison',()=>{
  const plan=lockedPlanFromPregameContext({
    localChampionName:'Aphelios',
    deepCoach:{
      source:'ai',
      headline:'SURVIVE FIRST DIVE → FREE-HIT',
      fightTrigger:'Wait for Pantheon.',
      objectiveSetup:'Arrive first.',
      never:'Do not cross threat line.',
      personalTrap:{status:'READY',behaviourKey:'CARRY_PRESERVATION',cue:'FIRST ENGAGE ≠ WALK FORWARD.'},
      situationContext:{tags:['MULTI_ACCESS'],champion:'Aphelios',role:'ADC',enemyAccess:['Pantheon','Sett'],enemyPicks:[],enemyZones:[]},
    },
  });
  assert.equal(plan?.source,'ai');
  assert.equal(plan?.headline,'SURVIVE FIRST DIVE → FREE-HIT');
  assert.equal(plan?.personalTrap?.behaviourKey,'CARRY_PRESERVATION');
  assert.deepEqual(plan?.situationContext?.tags,['MULTI_ACCESS']);
  assert.equal(lockedPlanFromPregameContext({localChampionName:'Aphelios'}),null);
});


test('counterfactual coaching proposes a realistic alternative without pretending to know the outcome',()=>{
  const graph=buildDecisionGraph({
    analysis:analysis(),
    summary:summary(),
    lockedPlan:{
      headline:'SURVIVE FIRST DIVE → FREE-HIT',
      fightTrigger:'Wait until Pantheon commits, then hit the closest safe target.',
      objectiveSetup:'Arrive first.',
      never:'Do not cross the threat line.',
      situationContext:{tags:['MULTI_ACCESS'],champion:'Aphelios',role:'ADC',enemyAccess:['Pantheon','Sett','Irelia'],enemyPicks:[],enemyZones:[]},
    },
  });
  const counterfactuals=graph.nodes.map(node=>node.counterfactual).filter(Boolean);
  assert.ok(counterfactuals.length>=2);
  for(const item of counterfactuals){
    assert.ok(item?.actual);
    assert.ok(item?.alternative);
    assert.ok(item?.whyBetter);
    assert.ok(item?.tradeoff);
    assert.ok(['HIGH','MEDIUM'].includes(String(item?.confidence)));
    assert.match(item?.outcomeBoundary||'',/does not claim/i);
    assert.doesNotMatch(item?.outcomeBoundary||'',/would have won|would have survived|guaranteed kill/i);
  }
});


test('Decision Graph only scores coaching response when the pre-game cue matches the behaviour and situation',()=>{
  const graph=buildDecisionGraph({
    analysis:analysis(),
    summary:summary(),
    lockedPlan:{
      headline:'SURVIVE FIRST DIVE → FREE-HIT',
      fightTrigger:'Wait for Pantheon.',
      personalTrap:{
        status:'READY',
        behaviourKey:'OBJECTIVE_READINESS',
        behaviourLabel:'Objective Arrival',
        cue:'ARRIVE FIRST.',
        situationTag:'ZONE_OBJECTIVE',
      },
      situationContext:{
        tags:['MULTI_ACCESS'],
        champion:'Aphelios',
        role:'ADC',
        enemyAccess:['Pantheon','Sett','Irelia'],
        enemyPicks:[],
        enemyZones:[],
      },
    },
  });
  assert.equal(graph.summary.coachingResponse.activeCue,true);
  assert.equal(graph.summary.coachingResponse.matchedMoments,0);
  assert.equal(graph.summary.coachingResponse.status,'NO_MATCH');
  assert.ok(graph.nodes.every(node=>node.coachingResponse===null));
});

test('a clean comparable decision is measured as executed, not as proof that the cue caused the result',()=>{
  const cleanSummary=summary();
  cleanSummary.fightReviews=[
    fight({atSeconds:600,category:'STRENGTH',outcome:'KILL',verdict:'YOU_STRONGER',headline:'Clean fight',summary:'You converted a stronger visible state.'}),
  ];
  const graph=buildDecisionGraph({
    analysis:analysis(),
    summary:cleanSummary,
    lockedPlan:{
      headline:'SURVIVE FIRST DIVE → FREE-HIT',
      fightTrigger:'Wait for Pantheon.',
      personalTrap:{
        status:'READY',
        behaviourKey:'LEAD_PROTECTION',
        behaviourLabel:'Lead Protection',
        cue:'MAKE THEM ENTER YOUR SETUP.',
        situationTag:'MULTI_ACCESS',
      },
      situationContext:{
        tags:['MULTI_ACCESS'],
        champion:'Aphelios',
        role:'ADC',
        enemyAccess:['Pantheon','Sett'],
        enemyPicks:[],
        enemyZones:[],
      },
    },
  });
  const node=graph.nodes.find(item=>item.behaviourKey==='LEAD_PROTECTION'&&item.verdict==='GOOD');
  assert.ok(node?.coachingResponse);
  assert.equal(node?.coachingResponse?.status,'EXECUTED');
  assert.match(node?.coachingResponse?.boundary||'',/does not claim the cue caused/i);
  assert.equal(graph.summary.coachingResponse.executed,1);
  assert.equal(graph.summary.coachingResponse.responseRate,100);
  assert.equal(graph.summary.coachingResponse.status,'EXECUTING');
});
