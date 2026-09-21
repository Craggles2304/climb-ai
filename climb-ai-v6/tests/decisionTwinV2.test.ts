import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionTwinV2} from '../lib/decisionTwinV2';
import type {DecisionBehaviourKey,DecisionSituationTag} from '../lib/decisionTwin';
import type {HistoryAnalysisRow} from '../lib/riot/proHistory';
import type {CoachingMetricKey} from '../lib/subscription';

function row(
  index:number,
  scores:Partial<Record<CoachingMetricKey,number>>,
  options:{tag?:DecisionSituationTag;behaviour?:DecisionBehaviourKey;verdict?:'GOOD'|'IMPROVE';premortem?:any}={},
):HistoryAnalysisRow{
  const metrics=Object.fromEntries(Object.entries(scores).map(([key,score])=>[key,{key,label:key,value:String(score),score,status:'AVAILABLE',evidence:[{type:'TEST'}]}]));
  const behaviour=options.behaviour??'FIGHT_SELECTION';
  const tag=options.tag;
  const node=tag?{
    id:`node-${index}`,
    phase:'MID',
    timeSeconds:600+index,
    title:'Comparable decision',
    behaviourKey:behaviour,
    behaviourLabel:behaviour.replaceAll('_',' '),
    verdict:options.verdict??'GOOD',
    confidence:'HIGH',
    planAlignment:(options.verdict??'GOOD')==='GOOD'?'MATCHED':'CONFLICTED',
    situationTags:[tag],
    contextEnemies:['Pantheon','Sett'],
    evidence:['verified'],
    counterfactual:null,
    coachingResponse:null,
  }:null;
  return{
    champion:'Aphelios',
    role:'ADC',
    createdAt:`2026-09-${String(index+1).padStart(2,'0')}T12:00:00.000Z`,
    analysis:{
      version:1,
      champion:'Aphelios',
      role:'ADC',
      evidenceSources:[],
      metrics,
      moments:[],
      leakSignals:[],
      fingerprint:{primary:'TEST',sequence:[],explanation:'',confidence:'MEDIUM'},
      summary:{headline:'',good:[],fix:[],next:''},
      ...(node?{decisionGraph:{version:1,nodes:[node],summary:{premortem:options.premortem??null}}}:{decisionGraph:options.premortem?{version:1,nodes:[],summary:{premortem:options.premortem}}:undefined}),
    } as any,
  };
}

test('Decision Twin V2 refuses to name an identity from too little evidence',()=>{
  const twin=buildDecisionTwinV2([
    row(0,{fight_selection:42}),
    row(1,{fight_selection:45}),
  ],'2026-09-21T10:00:00.000Z');
  assert.equal(twin.version,2);
  assert.equal(twin.identity.status,'BUILDING');
  assert.equal(twin.identity.primary,null);
  assert.equal(twin.activeFive.length,0);
  assert.match(twin.identity.summary,/will not name/i);
});

test('Decision Twin V2 creates a grounded behavioural identity and realistic next target',()=>{
  const rows=Array.from({length:6},(_,index)=>row(index,{
    fight_selection:44+index,
    reset_quality:88+index,
    lead_protection:70+index,
  }));
  const twin=buildDecisionTwinV2(rows,'2026-09-21T10:00:00.000Z');
  assert.equal(twin.identity.status,'READY');
  assert.equal(twin.identity.primary?.key,'FIGHT_SELECTION');
  assert.equal(twin.identity.primary?.label,'THE FIGHT INHERITOR');
  assert.equal(twin.identity.strongest?.key,'RESET_DISCIPLINE');
  const fight=twin.activeFive.find(item=>item.key==='FIGHT_SELECTION');
  assert.ok(fight);
  assert.ok((fight?.targetScore??0)>(fight?.currentScore??0));
  assert.ok(twin.targetTwin.targetAverage===null||twin.targetTwin.currentAverage===null||twin.targetTwin.targetAverage>=twin.targetTwin.currentAverage);
});

test('Decision Twin V2 exposes contextual selves from repeated Decision Graph situations',()=>{
  const verdicts=['IMPROVE','IMPROVE','IMPROVE','IMPROVE','GOOD','GOOD'] as const;
  const rows=verdicts.map((verdict,index)=>row(index,{carry_preservation:58+index},{
    tag:'MULTI_ACCESS',
    behaviour:'CARRY_PRESERVATION',
    verdict,
  }));
  const twin=buildDecisionTwinV2(rows,'2026-09-21T10:00:00.000Z');
  const context=twin.contextProfiles.find(item=>item.tag==='MULTI_ACCESS');
  assert.ok(context);
  assert.equal(context?.label,'UNDER DIVE PRESSURE');
  assert.equal(context?.observations,6);
  assert.equal(context?.failures,4);
  assert.equal(context?.failureRate,67);
  assert.ok(context?.behaviours.includes('CARRY_PRESERVATION'));
});

test('Decision Twin V2 Risk Map Ledger scores only risk windows that actually appeared',()=>{
  const base=(active:boolean,forecastCount:number,observedRisks:number,hitRisks:number,beatenRisks:number,mixedRisks:number,unobservedRisks:number)=>({
    version:1,active,forecastCount,observedRisks,hitRisks,beatenRisks,mixedRisks,unobservedRisks,results:[],note:'',boundary:'',
  });
  const rows=[
    row(0,{fight_selection:55},{premortem:base(true,3,2,1,1,0,1)}),
    row(1,{fight_selection:55},{premortem:base(true,2,1,0,1,0,1)}),
    row(2,{fight_selection:55},{premortem:base(false,0,0,0,0,0,0)}),
  ];
  const twin=buildDecisionTwinV2(rows,'2026-09-21T10:00:00.000Z');
  assert.equal(twin.riskLedger.frozenRiskMaps,2);
  assert.equal(twin.riskLedger.forecastRisks,5);
  assert.equal(twin.riskLedger.observedRisks,3);
  assert.equal(twin.riskLedger.unobservedRisks,2);
  assert.equal(twin.riskLedger.observedRate,60);
  assert.equal(twin.riskLedger.hitRisks,1);
  assert.equal(twin.riskLedger.beatenRisks,2);
  assert.match(twin.riskLedger.boundary,/unobserved risk windows are not failures/i);
});

test('mastered behaviours are not kept in the Twin-ranked Active Five',()=>{
  const rows=Array.from({length:6},(_,index)=>row(index,{
    fight_selection:92,
    reset_quality:90,
    lead_protection:89,
    carry_preservation:91,
    survival_value:93,
  }));
  const twin=buildDecisionTwinV2(rows,'2026-09-21T10:00:00.000Z');
  assert.equal(twin.activeFive.length,0);
  assert.equal(twin.identity.primary,null);
  assert.ok(twin.identity.strongest);
});
