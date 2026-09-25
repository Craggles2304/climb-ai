import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptILP,candidateTasks,isGameMeasurableMetric} from '../lib/ilpEngine';
import type {ILPTask,Match} from '../lib/types';

test('every built-in system mission candidate is measurable from completed game data',()=>{
  for(const [key,candidate] of Object.entries(candidateTasks)){
    assert.equal(isGameMeasurableMetric(candidate.metric),true,key+' uses '+candidate.metric);
  }
});

test('a completed measurable game creates a persistent tracked mission rep',()=>{
  const promotedAt='2026-09-25T10:00:00.000Z';
  const task:ILPTask={
    id:'system-adc-farm',accountId:'a',title:'Leave lane at 6.5+ CS/min',category:'LANING',
    why:'',gameRule:'',metric:'laneCsPerMin',target:'6.5+ lane CS/min across 3 games',
    progress:0,status:'ACTIVE',source:'SYSTEM',evidence:[],masteryRequired:3,
    history:[{at:promotedAt,type:'PROMOTED',note:'started'}],
  };
  const match:Match={
    id:'m1',riotAccountId:'a',champion:'Ahri',role:'ADC',result:'WIN',kills:5,deaths:2,assists:8,
    durationSeconds:1800,rank:'Gold',source:'live_tracker',createdAt:'2026-09-25T11:00:00.000Z',
    metrics:{cs:220,csPerMin:7.3,laneCsPerMin:7.0,deaths:2},
  };
  const next=adaptILP([task],[match]).tasks[0];
  assert.equal(next.missionHistory?.length,1);
  assert.equal(next.missionHistory?.[0].source,'TRACKED');
  assert.equal(next.missionHistory?.[0].banksPass,true);
  assert.equal(next.successfulGames,1);
});
