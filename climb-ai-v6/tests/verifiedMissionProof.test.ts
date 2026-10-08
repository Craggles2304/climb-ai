import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedMissionRep,verifiedMissionAttempts,verifiedMissionMastery} from '../lib/verifiedMissionProof';
import {accountProgress} from '../lib/accountXp';
import {missionSummary} from '../lib/missionLoop';
import {missionComparisonForMatch} from '../lib/missionComparison';
import {dnaStrandLevel} from '../lib/dnaLevel';
import type {ILPTask,ILPMissionAttempt} from '../lib/types';
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
const evidence=(metric='red_state_fights')=>({
  version:2 as const,state:'BANKED' as const,measurementSource:'DECISION_EVIDENCE' as const,
  metric,metricLabel:'Red state fights',observedValue:90,observedValueLabel:'90/100',
  targetLabel:'85+ score',confidence:'HIGH' as const,opportunities:1,successes:1,misses:0,
  events:[{atSeconds:900,label:'Fight decision',detail:'Saved the fight at 15:00'}],
  reconstruction:{kind:'PRO_METRIC' as const,fields:['proAnalysis:live','metric:red_state_fights'],formula:'90 >= 85'},
  reason:'Verified post-game decision evidence.',
});
const attempt=(id:string,receipt:any=evidence()):ILPMissionAttempt=>({matchId:id,at:'2026-10-08T12:00:00Z',source:'TRACKED',adherence:'TRACKED',outcome:'CONFIRMED',clearedBar:true,banksPass:true,evidenceV2:receipt});
const task=(history:ILPMissionAttempt[],status:ILPTask['status']='EVIDENCE_BUILDING'):ILPTask=>({
  id:'dna-strand-fights-1',accountId:'account-1',title:'Fight discipline',dnaDomain:'TEAMFIGHTS',category:'TEAMFIGHTING',
  why:'Improve',gameRule:'Think before a fight',metric:'red_state_fights',target:'85+',
  progress:0,status,source:'SYSTEM',evidence:[],missionHistory:history,masteryRequired:3,roleScope:'ADC'
});
test('legacy success flags, absent timestamps and mismatched metrics cannot earn XP',()=>{
  const invalid=[
    {...attempt(ids[0]),evidenceV2:undefined},
    attempt(ids[1],{...evidence(),events:[]}),
    attempt(ids[2],evidence('forged_metric')),
  ];
  const mission=task(invalid);
  assert.ok(invalid.every(a=>!verifiedMissionRep(mission,a)));
  assert.equal(missionSummary(mission).confirmed,0);
  assert.equal(accountProgress([mission]).xp,0);
  assert.equal(dnaStrandLevel([mission],'TEAMFIGHTS','ADC').currentCompletedGames,0);
  assert.equal(missionComparisonForMatch(mission,ids[0]).result,'NOT OBSERVED');
});
test('verified repetitions are unique by match and use the same score across views',()=>{
  const one=attempt(ids[0]);
  const mission=task([one,{...one}]);
  assert.equal(verifiedMissionAttempts(mission).length,1);
  assert.equal(missionSummary(mission).confirmed,1);
  assert.equal(accountProgress([mission]).xp,50);
  assert.equal(missionComparisonForMatch(mission,ids[0]).result,'PROVEN');
});
test('mastery XP requires three independent verified games and a mastered mission',()=>{
  const history=ids.map(id=>attempt(id));
  const invalidMastery=task(history.slice(0,2),'MASTERED');
  assert.equal(verifiedMissionMastery(invalidMastery),false);
  assert.equal(accountProgress([invalidMastery]).xp,100);
  const completed=task(history,'MASTERED');
  assert.equal(verifiedMissionMastery(completed),true);
  assert.equal(accountProgress([completed]).xp,650);
});
