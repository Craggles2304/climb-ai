import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVE_PLAN_SIZE,ensureFiveActive} from '../lib/ilpEngine';
import {benchmarkPass,missionBenchmark,missionRankBand} from '../lib/rankMissionBenchmarks';
import type {Match} from '../lib/types';

function game(rank:string):Match{
  return{
    id:'g-'+rank,
    riotAccountId:'a',
    champion:'Ahri',
    role:'MID',
    result:'WIN',
    kills:5,
    deaths:3,
    assists:8,
    durationSeconds:1800,
    rank,
    source:'riot',
    createdAt:'2026-09-25T12:00:00.000Z',
    metrics:{
      cs:190,csPerMin:6.3,laneCsPerMin:6.1,post15CsPerMin:5.6,
      deaths:3,deathsPre10:0,deathsPost20:1,secondItemMinute:23.7,
      objectiveParticipation:.66,damageShare:.24,killParticipation:.63,
      visionScore:32,csAt10:61,csAt15:95,
    },
  };
}

test('mission rank bands cover Iron through Master and cap elite tiers at Master',()=>{
  assert.equal(missionRankBand('Iron IV'),'IRON');
  assert.equal(missionRankBand('Gold II'),'GOLD');
  assert.equal(missionRankBand('Diamond I'),'DIAMOND');
  assert.equal(missionRankBand('Master 120 LP'),'MASTER');
  assert.equal(missionRankBand('Grandmaster'),'MASTER');
  assert.equal(missionRankBand('Challenger'),'MASTER');
});

test('proof bars get stricter from Iron to Master',()=>{
  const ironFarm=missionBenchmark('laneCsPerMin','Iron IV')!;
  const masterFarm=missionBenchmark('laneCsPerMin','Master')!;
  const ironDeaths=missionBenchmark('deaths','Iron IV')!;
  const masterDeaths=missionBenchmark('deaths','Master')!;
  assert.ok(masterFarm.target>ironFarm.target);
  assert.ok(masterDeaths.target<ironDeaths.target);
  assert.equal(benchmarkPass('laneCsPerMin',5.0,'Iron IV'),true);
  assert.equal(benchmarkPass('laneCsPerMin',5.0,'Master'),false);
});

test('the development plan has three measurable slots',()=>{
  assert.equal(ACTIVE_PLAN_SIZE,3);
  const matches=[game('Gold II'),{...game('Gold II'),id:'g2'},{...game('Gold II'),id:'g3'}];
  const result=ensureFiveActive([],matches,'a','MID','Gold II');
  const active=result.tasks.filter(task=>task.status!=='MASTERED'&&task.status!=='PAUSED');
  assert.equal(active.length,3);
  for(const task of active)assert.match(task.target,/GOLD target/i);
});
