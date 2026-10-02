import test from 'node:test';
import assert from 'node:assert/strict';
import type {ILPTask,Role} from '../lib/types';
import {activeGameDnaMissions,canonicalGameDnaTasks,gameDnaClientMissions,gameDnaStrands,missionRepView} from '../lib/gameDnaSnapshot';

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
      missionHistory:[{matchId:'m1',at:'2026-10-01T00:00:00.000Z',adherence:'TRACKED',clearedBar:true,outcome:'CONFIRMED',banksPass:true}],
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
    missionHistory:[{matchId:'m1',at:'2026-10-02T00:00:00.000Z',adherence:'YES',clearedBar:true,outcome:'CONFIRMED',banksPass:true}],
  });
  assert.deepEqual(missionRepView(one),{confirmed:1,required:3,progress:33});
  assert.equal(activeGameDnaMissions([zero,one],role).length,1);
});