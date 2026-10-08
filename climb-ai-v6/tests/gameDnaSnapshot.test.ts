import test from 'node:test';
import assert from 'node:assert/strict';
import type {ILPTask,Role} from '../lib/types';
import {activeGameDnaMissions,canonicalGameDnaTasks,gameDnaClientMissions,gameDnaStrands,gameMissionFocusPair,missionRepView,unlockedDnaDomains} from '../lib/gameDnaSnapshot';

function task(overrides:Partial<ILPTask>&{id:string,title:string,metric:string}):ILPTask{
  return{
    accountId:'acct',
    dnaDomain:'LANING',
    category:'LANING',
    why:'',
    gameRule:'',
    target:'',
    progress:0,
    status:'ACTIVE',
    source:'SYSTEM',
    evidence:[],
    ...overrides,
  } as ILPTask;
}

const role:Role='ADC';
const evidenceFor=(metric:string)=>({...({version:2 as const,state:'BANKED' as const,measurementSource:'DECISION_EVIDENCE' as const,metric:'PLACEHOLDER',metricLabel:'Verified decision',observedValue:90,observedValueLabel:'90/100',targetLabel:'85+',confidence:'HIGH' as const,opportunities:1,successes:1,misses:0,events:[{atSeconds:620,label:'Decision',detail:'Verified timed action'}],reconstruction:{kind:'PRO_METRIC' as const,fields:['score'],formula:'90 >= 85'},reason:'Verified after match'}),metric});
const proven=(metric:string,id:string)=>({matchId:id,at:'2026-10-02T00:00:00.000Z',source:'TRACKED' as const,adherence:'TRACKED' as const,clearedBar:true,outcome:'CONFIRMED' as const,banksPass:true,evidenceV2:evidenceFor(metric)});

test('foreign-role rows never leak into Game DNA',()=>{
  const rows=[
    task({id:'adc-1',title:'ADC lane',metric:'lane',dnaDomain:'LANING',progress:40,roleScope:'ADC'}),
    task({id:'mid-1',title:'MID objective',metric:'objective',dnaDomain:'OBJECTIVES',progress:100,roleScope:'MID'}),
  ];
  const canonical=canonicalGameDnaTasks(rows,role);
  assert.deepEqual(canonical.map(row=>row.id),['adc-1']);
  assert.equal(gameDnaStrands(rows,role,true).find(row=>row.domain==='OBJECTIVES')?.progress,0);
});

test('semantic duplicates keep one freshest task',()=>{
  const rows=[
    task({id:'pro-adc-reset_quality-1790893805504',title:'Improve RESET QUALITY',metric:'reset_quality',dnaDomain:'WAVES_CS',progress:19,roleScope:'ADC',status:'PAUSED'}),
    task({id:'pro-adc-reset_quality-1790937023787',title:'Improve RESET QUALITY',metric:'reset_quality',dnaDomain:'WAVES_CS',progress:34,roleScope:'ADC',status:'ACTIVE'}),
  ];
  const canonical=canonicalGameDnaTasks(rows,role);
  assert.equal(canonical.length,1);
  assert.equal(canonical[0]?.progress,34);
});

test('Companion strands and client helix use one mission per DNA strand',()=>{
  const rows=[
    task({
      id:'a',title:'A',metric:'a',dnaDomain:'LANING',roleScope:'ADC',masteryRequired:3,
      missionHistory:[proven('a','m1')],
    }),
    task({id:'b',title:'Old A',metric:'b',dnaDomain:'LANING',progress:99,roleScope:'ADC',status:'PAUSED'}),
  ];
  const client=gameDnaClientMissions(rows,role).filter(row=>row.c==='lane');
  const strand=gameDnaStrands(rows,role,true).find(row=>row.domain==='LANING');
  assert.equal(client.length,1);
  assert.equal(client[0]?.p,33);
  assert.equal(strand?.progress,33);
  assert.equal(strand?.activeCount,1);
});

test('mission progress bar is driven by the same reps shown in the rep counter',()=>{
  const zero=task({id:'zero',title:'Zero',metric:'zero',progress:67,roleScope:'ADC',masteryRequired:3,missionHistory:[]});
  assert.deepEqual(missionRepView(zero),{confirmed:0,required:3,progress:0});

  const one=task({
    id:'one',title:'One',metric:'one',progress:12,roleScope:'ADC',masteryRequired:3,
    missionHistory:[proven('one','m1')],
  });
  assert.deepEqual(missionRepView(one),{confirmed:1,required:3,progress:33});
  assert.equal(activeGameDnaMissions([zero,one],role).length,1);
});

test('player-chosen DNA unlocks override automatic focus recommendations',()=>{
  const rows=[
    task({id:'lane',title:'Lane',metric:'red_state_fights',dnaDomain:'LANING',roleScope:'ADC',dnaFocusUnlocked:false}),
    task({id:'wave',title:'Wave',metric:'reset_quality',dnaDomain:'WAVES_CS',roleScope:'ADC',dnaFocusUnlocked:true}),
    task({id:'vision',title:'Vision',metric:'opponent_adaptation',dnaDomain:'VISION_MAP',roleScope:'ADC',dnaFocusUnlocked:false}),
    task({id:'objective',title:'Objective',metric:'objective_readiness',dnaDomain:'OBJECTIVES',roleScope:'ADC',dnaFocusUnlocked:true}),
    task({id:'fight',title:'Fight',metric:'carry_preservation',dnaDomain:'TEAMFIGHTS',roleScope:'ADC',dnaFocusUnlocked:false}),
    task({id:'mind',title:'Mind',metric:'lead_protection',dnaDomain:'CONSISTENCY',roleScope:'ADC',dnaFocusUnlocked:false}),
  ];
  assert.deepEqual(new Set(unlockedDnaDomains(rows,role)),new Set(['WAVES_CS','OBJECTIVES']));
  assert.deepEqual(new Set(gameMissionFocusPair(rows,role).map(row=>row.domain)),new Set(['WAVES_CS','OBJECTIVES']));
});
