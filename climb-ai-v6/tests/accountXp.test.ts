import test from 'node:test';
import assert from 'node:assert/strict';
import {accountProgress,XP_PER_MISSION_MASTERY,XP_PER_PROVEN_REP} from '../lib/accountXp';
import type {ILPTask} from '../lib/types';

const receipt={version:2 as const,state:'BANKED' as const,measurementSource:'LIVE_MEASURABLE' as const,metric:'csPerMin',metricLabel:'CS/min',observedValue:8,observedValueLabel:'8 CS/min',targetLabel:'6+',confidence:'HIGH' as const,opportunities:1,successes:1,misses:0,events:[{atSeconds:900,label:'CS/min',detail:'8 CS/min verified'}],reconstruction:{kind:'MATCH_METRIC' as const,fields:['match.metrics.csPerMin'],formula:'8 >= 6'},reason:'Verified match metric'};
function task(id:string,status:ILPTask['status'],passes:number):ILPTask{
  return{
    id,accountId:'a',title:'Mission',dnaDomain:'WAVES_CS',category:'FARMING',why:'',gameRule:'',metric:'csPerMin',target:'6+',progress:passes?100:0,status,source:'SYSTEM',evidence:[],
    missionHistory:Array.from({length:passes},(_,i)=>({matchId:id+'-'+i,at:new Date(2026,0,i+1).toISOString(),adherence:'TRACKED' as const,clearedBar:true,outcome:'CONFIRMED' as const,banksPass:true,source:'TRACKED' as const,evidenceV2:receipt})),
    masteryRequired:3,
  };
}

test('account XP is deterministic from proven reps and mastered missions',()=>{
  const progress=accountProgress([task('a','MASTERED',3),task('b','ACTIVE',1)]);
  assert.equal(progress.provenReps,4);
  assert.equal(progress.masteredMissions,1);
  assert.equal(progress.xp,4*XP_PER_PROVEN_REP+XP_PER_MISSION_MASTERY);
  assert.equal(progress.level,2);
});

test('duplicate task ids cannot duplicate XP',()=>{
  const t=task('same','MASTERED',3);
  assert.equal(accountProgress([t,t]).xp,3*XP_PER_PROVEN_REP+XP_PER_MISSION_MASTERY);
});
