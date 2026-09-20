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
  const objective=graph.nodes.find(node=>node.behaviourKey==='OBJECTIVE_READINESS');
  assert.ok(objective);
  assert.equal(objective?.planAlignment,'CONFLICTED');
  assert.match(objective?.lockedPrinciple||'',/Arrive first/i);
  const spike=graph.nodes.find(node=>node.behaviourKey==='POWER_SPIKE_CONVERSION');
  assert.ok(spike);
  assert.equal(spike?.verdict,'GOOD');
  assert.equal(spike?.planAlignment,'MATCHED');
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
    },
  });
  assert.equal(plan?.source,'ai');
  assert.equal(plan?.headline,'SURVIVE FIRST DIVE → FREE-HIT');
  assert.equal(plan?.personalTrap?.behaviourKey,'CARRY_PRESERVATION');
  assert.equal(lockedPlanFromPregameContext({localChampionName:'Aphelios'}),null);
});
