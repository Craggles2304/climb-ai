import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPublicPreview} from '../lib/publicPreview';
import type {Match} from '../lib/types';

function row(index:number,overrides:Partial<Match>={}):Match{
  const base:Match={
    id:'m'+index,
    riotAccountId:'public',
    champion:index<4?'Jinx':'Ashe',
    role:'ADC',
    result:index%2===0?'WIN':'LOSS',
    kills:4,
    deaths:index<3?6:4,
    assists:7,
    durationSeconds:1800,
    rank:'Gold IV · 20 LP',
    metrics:{
      cs:190,
      csPerMin:6.3,
      deaths:index<3?6:4,
      csAt10:index<3?55:64,
      csAt15:95,
      laneCsPerMin:6.3,
      post15CsPerMin:5.4,
      deathsPre10:index<3?1:0,
      deaths10to20:1,
      deathsPost20:1,
      killParticipation:.55,
    },
    source:'riot',
    createdAt:new Date(Date.UTC(2026,8,20-index)).toISOString(),
  };
  return {...base,...overrides,metrics:{...base.metrics,...overrides.metrics}};
}

test('public preview summarizes the player own ranked sample without fake rank benchmarks',()=>{
  const report=buildPublicPreview(Array.from({length:8},(_,index)=>row(index)),'Gold IV · 20 LP');
  assert.equal(report.gamesAnalyzed,8);
  assert.equal(report.primaryRole,'ADC');
  assert.equal(report.mainChampion,'Jinx');
  assert.equal(report.rank,'Gold IV · 20 LP');
  assert.ok(report.insights.some(item=>item.label==='YOUR CS @ 10'));
  assert.ok(report.insights.some(item=>item.label==='GAMES WITH A DEATH BEFORE 10'));
  assert.doesNotMatch(JSON.stringify(report),/rank average|Gold average/i);
  assert.ok(report.focus.rule.length>20);
});

test('recent trend compares the player against their own earlier evidence',()=>{
  const rows=Array.from({length:10},(_,index)=>row(index,{
    metrics:{
      ...row(index).metrics,
      deathsPre10:index<5?0:1,
      csAt10:index<5?70:55,
    },
  }));
  const report=buildPublicPreview(rows,'Gold IV');
  assert.match(report.trend,/fewer early-death games|CS@10 is up/i);
});
