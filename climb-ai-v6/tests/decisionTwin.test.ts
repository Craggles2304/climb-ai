import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionTwin,selectPersonalTrap} from '../lib/decisionTwin';
import type {HistoryAnalysisRow} from '../lib/riot/proHistory';
import type {CoachingMetricKey} from '../lib/subscription';

function row(index:number,champion:string,role:string,scores:Partial<Record<CoachingMetricKey,number>>,leaks:Array<{key:string;count:number}>=[]):HistoryAnalysisRow{
  const metrics:any={};
  for(const [key,score] of Object.entries(scores)){
    metrics[key]={
      key,
      label:String(key).toUpperCase(),
      score,
      value:String(score),
      status:'DERIVED',
      confidence:'HIGH',
      sources:['TEST'],
      summary:'test metric',
      evidence:[{atSeconds:600+index,label:'evidence',detail:'verified test evidence'}],
    };
  }
  return{
    champion,
    role,
    createdAt:new Date(Date.UTC(2026,8,1+index,12)).toISOString(),
    analysis:{
      version:1,
      champion,
      role,
      evidenceSources:['TEST'],
      metrics,
      leakSignals:leaks.map(leak=>({key:leak.key,label:leak.key,count:leak.count,severity:'MAJOR',detail:'test leak',evidenceSeconds:[600+index]})),
      fingerprint:{primary:'TEST',sequence:[],confidence:'HIGH',explanation:'test'},
    },
  };
}

const multiAccess=[
  {champion:'Sett',role:'TOP'},
  {champion:'Pantheon',role:'JUNGLE'},
  {champion:'Irelia',role:'MID'},
  {champion:'Lucian',role:'ADC'},
  {champion:'Taric',role:'SUPPORT'},
];


function withSituationGraph(base:HistoryAnalysisRow,index:number,verdict:'GOOD'|'IMPROVE',tag:'MULTI_ACCESS'|'ZONE_OBJECTIVE'){
  base.analysis.decisionGraph={
    version:1,
    generatedAt:base.createdAt,
    champion:base.champion,
    role:base.role,
    nodeCount:1,
    highConfidenceCount:1,
    planAvailable:true,
    nodes:[{
      id:'node-'+index,
      atSeconds:700+index*10,
      minuteLabel:'12:'+String(index).padStart(2,'0'),
      type:tag==='ZONE_OBJECTIVE'?'OBJECTIVE':'SURVIVAL',
      behaviourKey:tag==='ZONE_OBJECTIVE'?'OBJECTIVE_READINESS':'CARRY_PRESERVATION',
      behaviourLabel:tag==='ZONE_OBJECTIVE'?'Objective Arrival':'Carry Preservation',
      verdict,
      confidence:'HIGH',
      title:tag==='ZONE_OBJECTIVE'?'Dragon setup':'High-value fight',
      situation:'Comparable recorded situation.',
      decisionRead:verdict==='IMPROVE'?'The recorded choice was graded for improvement.':'The recorded choice matched the plan.',
      consequence:verdict==='IMPROVE'?'The position lost value.':'The position preserved value.',
      lockedPrinciple:'Follow the locked pre-game principle.',
      planAlignment:verdict==='IMPROVE'?'CONFLICTED':'MATCHED',
      situationTags:[tag],
      contextEnemies:tag==='MULTI_ACCESS'?['Sett','Pantheon','Irelia']:['Rumble','Fiddlesticks'],
      evidence:['verified'],
      limitation:'test',
    }],
    summary:{cleanDecisions:verdict==='GOOD'?1:0,improveDecisions:verdict==='IMPROVE'?1:0,neutralDecisions:0,mostRepeatedBehaviour:tag==='ZONE_OBJECTIVE'?'OBJECTIVE_READINESS':'CARRY_PRESERVATION',mostRepeatedLabel:tag==='ZONE_OBJECTIVE'?'Objective Arrival':'Carry Preservation'},
  } as any;
  return base;
}

test('Decision Twin refuses to label a personal weakness from fewer than three measurable games',()=>{
  const twin=buildDecisionTwin([
    row(0,'Aphelios','ADC',{carry_preservation:42},[{key:'CARRY_DEATH',count:1}]),
    row(1,'Aphelios','ADC',{carry_preservation:48},[{key:'CARRY_DEATH',count:1}]),
  ],'2026-09-20T12:00:00.000Z');
  const behaviour=twin.behaviours.find(item=>item.key==='CARRY_PRESERVATION');
  assert.equal(behaviour?.state,'BUILDING');
  assert.equal(behaviour?.confidence,'LOW');
  const trap=selectPersonalTrap(twin,{champion:'Aphelios',role:'ADC',ours:[{champion:'Aphelios',role:'ADC'},{champion:'Rakan',role:'SUPPORT'}],enemies:multiAccess});
  assert.equal(trap.status,'BUILDING');
  assert.match(trap.proof,/at least 3 measurable games/i);
});

test('repeated carry-preservation evidence becomes a draft-specific Personal Trap against multi-access',()=>{
  const rows=Array.from({length:6},(_,index)=>row(index,'Aphelios','ADC',{carry_preservation:38+index,fight_selection:72},[{key:'CARRY_DEATH',count:1}]));
  const twin=buildDecisionTwin(rows,'2026-09-20T12:00:00.000Z');
  const carry=twin.behaviours.find(item=>item.key==='CARRY_PRESERVATION');
  assert.equal(carry?.confidence,'HIGH');
  assert.equal(carry?.state,'LIMITER');
  assert.equal(carry?.applicableGames,6);
  assert.ok((carry?.evidenceCount||0)>=6);

  const trap=selectPersonalTrap(twin,{
    champion:'Aphelios',
    role:'ADC',
    ours:[{champion:'Nasus',role:'TOP'},{champion:'Kassadin',role:'MID'},{champion:'Aphelios',role:'ADC'},{champion:'Rakan',role:'SUPPORT'}],
    enemies:multiAccess,
  });
  assert.equal(trap.status,'READY');
  assert.equal(trap.behaviourKey,'CARRY_PRESERVATION');
  assert.equal(trap.confidence,'HIGH');
  assert.deepEqual(trap.relevantEnemies,['Sett','Pantheon','Irelia']);
  assert.match(trap.cue,/FIRST ENGAGE/i);
  assert.match(trap.cue,/CLOSEST SAFE TARGET/i);
  assert.match(trap.draftReason,/Sett \+ Pantheon \+ Irelia/i);
});

test('an improving behaviour stops being presented as a personal trap once recent evidence is strong',()=>{
  const scores=[42,48,55,88,92,94];
  const twin=buildDecisionTwin(scores.map((score,index)=>row(index,'Jinx','ADC',{carry_preservation:score})),'2026-09-20T12:00:00.000Z');
  const carry=twin.behaviours.find(item=>item.key==='CARRY_PRESERVATION');
  assert.equal(carry?.trend,'IMPROVING');
  assert.ok(['STRONG','MASTERED'].includes(String(carry?.state)));
  const trap=selectPersonalTrap(twin,{champion:'Jinx',role:'ADC',ours:[{champion:'Jinx',role:'ADC'}],enemies:multiAccess});
  assert.equal(trap.status,'NONE');
});

test('objective-readiness weakness is prioritised when the current draft contains zone control',()=>{
  const rows=Array.from({length:5},(_,index)=>row(index,'Lee Sin','JUNGLE',{objective_readiness:44+index,reset_quality:82}));
  const twin=buildDecisionTwin(rows,'2026-09-20T12:00:00.000Z');
  const trap=selectPersonalTrap(twin,{
    champion:'Lee Sin',
    role:'JUNGLE',
    ours:[{champion:'Lee Sin',role:'JUNGLE'}],
    enemies:[
      {champion:'Rumble',role:'TOP'},
      {champion:'Fiddlesticks',role:'JUNGLE'},
      {champion:'Orianna',role:'MID'},
      {champion:'Caitlyn',role:'ADC'},
      {champion:'Nautilus',role:'SUPPORT'},
    ],
  });
  assert.equal(trap.status,'READY');
  assert.equal(trap.behaviourKey,'OBJECTIVE_READINESS');
  assert.match(trap.cue,/EARLY SETUP/i);
  assert.ok(trap.relevantEnemies.includes('Rumble'));
});

test('strong history does not manufacture a Personal Trap just for the sake of personalisation',()=>{
  const rows=Array.from({length:6},(_,index)=>row(index,'Ahri','MID',{
    fight_selection:88,
    objective_readiness:90,
    farm_fight_tradeoff:86,
    reset_quality:91,
    lead_protection:89,
  }));
  const twin=buildDecisionTwin(rows,'2026-09-20T12:00:00.000Z');
  const trap=selectPersonalTrap(twin,{
    champion:'Ahri',
    role:'MID',
    ours:[{champion:'Ahri',role:'MID'}],
    enemies:multiAccess,
  });
  assert.equal(trap.status,'NONE');
  assert.match(trap.historicalSummary,/No established weak behaviour/i);
});


test('Decision Twin learns a recurring multi-access situation pattern from Decision Graph history',()=>{
  const rows=Array.from({length:8},(_,index)=>withSituationGraph(
    row(index,'Aphelios','ADC',{carry_preservation:88}),
    index,
    index<6?'IMPROVE':'GOOD',
    'MULTI_ACCESS',
  ));
  const twin=buildDecisionTwin(rows,'2026-09-20T20:00:00.000Z');
  const pattern=twin.situationPatterns.find(item=>item.tag==='MULTI_ACCESS'&&item.behaviourKey==='CARRY_PRESERVATION');
  assert.ok(pattern);
  assert.equal(pattern?.decisions,8);
  assert.equal(pattern?.failures,6);
  assert.equal(pattern?.failureRate,75);
  assert.equal(pattern?.confidence,'HIGH');
  assert.equal(pattern?.applicableGames,8);

  const trap=selectPersonalTrap(twin,{
    champion:'Aphelios',
    role:'ADC',
    ours:[{champion:'Aphelios',role:'ADC'},{champion:'Rakan',role:'SUPPORT'}],
    enemies:multiAccess,
  });
  assert.equal(trap.status,'READY');
  assert.equal(trap.source,'SITUATION_PATTERN');
  assert.equal(trap.title,"YOU'VE SEEN THIS DECISION BEFORE");
  assert.equal(trap.situationTag,'MULTI_ACCESS');
  assert.equal(trap.comparableDecisions,8);
  assert.equal(trap.failures,6);
  assert.equal(trap.failureRate,75);
  assert.match(trap.historicalSummary,/6 of 8 comparable/i);
  assert.match(trap.proof,/6\/8 all-time/i);
  assert.match(trap.proof,/recent/i);
  assert.match(trap.cue,/FIRST ENGAGE/i);
});

test('a recurring situation is not projected onto a draft that does not contain that situation',()=>{
  const rows=Array.from({length:8},(_,index)=>withSituationGraph(
    row(index,'Caitlyn','ADC',{carry_preservation:90}),
    index,
    index<6?'IMPROVE':'GOOD',
    'MULTI_ACCESS',
  ));
  const twin=buildDecisionTwin(rows,'2026-09-20T20:00:00.000Z');
  const trap=selectPersonalTrap(twin,{
    champion:'Caitlyn',
    role:'ADC',
    ours:[{champion:'Caitlyn',role:'ADC'},{champion:'Lulu',role:'SUPPORT'}],
    enemies:[
      {champion:'Garen',role:'TOP'},
      {champion:'Kindred',role:'JUNGLE'},
      {champion:'Velkoz',role:'MID'},
      {champion:'Jinx',role:'ADC'},
      {champion:'Soraka',role:'SUPPORT'},
    ],
  });
  assert.equal(trap.status,'NONE');
  assert.notEqual(trap.source,'SITUATION_PATTERN');
});

test('recurring-situation Personal Trap requires at least four comparable decisions across three games',()=>{
  const rows=[
    withSituationGraph(row(0,'Aphelios','ADC',{carry_preservation:90}),0,'IMPROVE','MULTI_ACCESS'),
    withSituationGraph(row(1,'Aphelios','ADC',{carry_preservation:90}),1,'IMPROVE','MULTI_ACCESS'),
    row(2,'Aphelios','ADC',{carry_preservation:90}),
  ];
  const twin=buildDecisionTwin(rows,'2026-09-20T20:00:00.000Z');
  const trap=selectPersonalTrap(twin,{champion:'Aphelios',role:'ADC',ours:[{champion:'Aphelios',role:'ADC'}],enemies:multiAccess});
  assert.equal(trap.status,'NONE');
});


test('a historically bad situation is MASTERED after six recent decisions are nearly clean',()=>{
  const verdicts=[
    'IMPROVE','IMPROVE','IMPROVE','IMPROVE','IMPROVE','IMPROVE','GOOD','GOOD',
    'GOOD','GOOD','GOOD','GOOD','GOOD','IMPROVE',
  ] as const;
  const rows=verdicts.map((verdict,index)=>withSituationGraph(
    row(index,'Aphelios','ADC',{carry_preservation:48}),
    index,
    verdict,
    'MULTI_ACCESS',
  ));
  const twin=buildDecisionTwin(rows,'2026-09-20T21:00:00.000Z');
  const pattern=twin.situationPatterns.find(item=>item.tag==='MULTI_ACCESS'&&item.behaviourKey==='CARRY_PRESERVATION');
  assert.ok(pattern);
  assert.equal(pattern?.priorDecisions,8);
  assert.equal(pattern?.priorFailureRate,75);
  assert.equal(pattern?.recentDecisions,6);
  assert.equal(pattern?.recentFailures,1);
  assert.equal(pattern?.recentFailureRate,17);
  assert.equal(pattern?.state,'MASTERED');
  assert.ok(twin.masteredSituations.some(item=>item.id===pattern?.id));

  const trap=selectPersonalTrap(twin,{
    champion:'Aphelios',
    role:'ADC',
    ours:[{champion:'Aphelios',role:'ADC'},{champion:'Rakan',role:'SUPPORT'}],
    enemies:multiAccess,
  });
  assert.equal(trap.status,'MASTERED');
  assert.equal(trap.title,'THIS USED TO CATCH YOU');
  assert.equal(trap.patternState,'MASTERED');
  assert.equal(trap.priorFailureRate,75);
  assert.equal(trap.recentFailureRate,17);
  assert.match(trap.proof,/5\/6 recent clean decisions/i);
  assert.match(trap.cue,/WILL NOT RE-TEACH/i);
});

test('a recurring situation stays coachable while recent evidence is improving but not yet mastered',()=>{
  const verdicts=[
    'IMPROVE','IMPROVE','IMPROVE','IMPROVE','IMPROVE','IMPROVE','GOOD','GOOD',
    'GOOD','GOOD','GOOD','GOOD','IMPROVE','IMPROVE',
  ] as const;
  const rows=verdicts.map((verdict,index)=>withSituationGraph(
    row(index,'Aphelios','ADC',{carry_preservation:82}),
    index,
    verdict,
    'MULTI_ACCESS',
  ));
  const twin=buildDecisionTwin(rows,'2026-09-20T21:00:00.000Z');
  const pattern=twin.situationPatterns.find(item=>item.tag==='MULTI_ACCESS'&&item.behaviourKey==='CARRY_PRESERVATION');
  assert.equal(pattern?.priorFailureRate,75);
  assert.equal(pattern?.recentFailureRate,33);
  assert.equal(pattern?.state,'IMPROVING');
  assert.ok(twin.improvingSituations.some(item=>item.id===pattern?.id));

  const trap=selectPersonalTrap(twin,{champion:'Aphelios',role:'ADC',ours:[{champion:'Aphelios',role:'ADC'}],enemies:multiAccess});
  assert.equal(trap.status,'READY');
  assert.equal(trap.title,"YOU'RE BREAKING THIS PATTERN");
  assert.equal(trap.patternState,'IMPROVING');
  assert.match(trap.historicalSummary,/75%/);
  assert.match(trap.historicalSummary,/2\/6 recently/);
});

test('Decision Twin detects regression even when the all-time average still looks acceptable',()=>{
  const verdicts=[
    'GOOD','GOOD','GOOD','GOOD','GOOD','IMPROVE',
    'IMPROVE','IMPROVE','IMPROVE','IMPROVE','GOOD','GOOD',
  ] as const;
  const rows=verdicts.map((verdict,index)=>withSituationGraph(
    row(index,'Aphelios','ADC',{carry_preservation:88}),
    index,
    verdict,
    'MULTI_ACCESS',
  ));
  const twin=buildDecisionTwin(rows,'2026-09-20T21:00:00.000Z');
  const pattern=twin.situationPatterns.find(item=>item.tag==='MULTI_ACCESS'&&item.behaviourKey==='CARRY_PRESERVATION');
  assert.equal(pattern?.failureRate,42);
  assert.equal(pattern?.priorFailureRate,17);
  assert.equal(pattern?.recentFailureRate,67);
  assert.equal(pattern?.state,'REGRESSING');

  const trap=selectPersonalTrap(twin,{champion:'Aphelios',role:'ADC',ours:[{champion:'Aphelios',role:'ADC'}],enemies:multiAccess});
  assert.equal(trap.status,'READY');
  assert.equal(trap.title,'THIS PATTERN IS COMING BACK');
  assert.equal(trap.patternState,'REGRESSING');
  assert.match(trap.historicalSummary,/regressed/i);
});

test('mastering one contextual pattern moves coaching past it instead of recycling the old weakness',()=>{
  const masteredRows=[
    'IMPROVE','IMPROVE','IMPROVE','IMPROVE','IMPROVE','IMPROVE','GOOD','GOOD',
    'GOOD','GOOD','GOOD','GOOD','GOOD','IMPROVE',
  ].map((verdict,index)=>withSituationGraph(
    row(index,'Aphelios','ADC',{carry_preservation:45,fight_selection:88}),
    index,
    verdict as 'GOOD'|'IMPROVE',
    'MULTI_ACCESS',
  ));
  const twin=buildDecisionTwin(masteredRows,'2026-09-20T21:00:00.000Z');
  const trap=selectPersonalTrap(twin,{champion:'Aphelios',role:'ADC',ours:[{champion:'Aphelios',role:'ADC'}],enemies:multiAccess});
  assert.equal(trap.status,'MASTERED');
  assert.notEqual(trap.title,'YOUR PERSONAL TRAP');
  assert.match(trap.historicalSummary,/previously struggled/i);
});
