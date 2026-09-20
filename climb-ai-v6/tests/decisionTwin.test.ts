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
