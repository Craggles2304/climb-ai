import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureOneMissionPerDnaStrand,gradeDnaStrandMissionsFromHistory} from '../lib/dnaStrandMissions';
import {applyDnaFocusSelection} from '../lib/dnaFocusSelection';
import {gameDnaFocusSource,gameMissionFocusPair} from '../lib/gameDnaSnapshot';
import {mergeIlpCloudSnapshot} from '../lib/ilpCloudMerge';
import {missionComparisonForMatch} from '../lib/missionComparison';
import {verifiedMissionRep} from '../lib/verifiedMissionProof';

const baselineTime='2026-10-13T18:00:00.000Z';
const gameTime='2026-10-13T18:40:00.000Z';

test('synthetic full pipeline: recommended -> player-confirmed -> cloud -> timestamped match -> verified rep',()=>{
 const seeds=ensureOneMissionPerDnaStrand([],'account-test','ADC').tasks.map(task=>({
   ...task,
   history:[{at:baselineTime,type:'PROMOTED' as const,note:'Baseline completed'}],
   dnaFocusUnlocked:task.dnaDomain==='LANING'||task.dnaDomain==='WAVES_CS',
   dnaFocusSelectionSource:'RECOMMENDED' as const,
 }));
 assert.equal(gameDnaFocusSource(seeds,'ADC'),'RECOMMENDED');
 const selected=applyDnaFocusSelection(seeds,['LANING','WAVES_CS'],'ADC',baselineTime)!;
 assert.equal(gameDnaFocusSource(selected,'ADC'),'PLAYER');
 const older=seeds.map(task=>({id:task.id,payload:task,updated_at:'2026-10-13T17:50:00.000Z'}));
 const merged=mergeIlpCloudSnapshot(selected,older,'account-test');
 assert.equal(gameDnaFocusSource(merged.tasks,'ADC'),'PLAYER');
 assert.equal(gameMissionFocusPair(merged.tasks,'ADC').length,2);

 const history:any[]=[{
   matchId:'real-path-fixture-1',role:'ADC',champion:'Jinx',createdAt:gameTime,
   analysis:{
     version:1,evidenceSources:['LIVE_TELEMETRY'],
     metrics:{
       red_state_fights:{
         key:'red_state_fights',label:'SAFE LANE DECISIONS',score:91,
         value:'91/100',status:'DERIVED',confidence:'HIGH',sources:['LIVE_TELEMETRY'],
         summary:'Decision evidence was observed.',
         evidence:[{atSeconds:600,label:'Lane read',detail:'Declined a losing lane fight.'}],
       },
     },
     leakSignals:[],fingerprint:{primary:'',sequence:[],explanation:'',confidence:'HIGH'},
   },
 }];
 const graded=gradeDnaStrandMissionsFromHistory(merged.tasks,history).tasks;
 const focus=gameMissionFocusPair(graded,'ADC');
 const lane=focus.find(row=>row.domain==='LANING')?.task;
 const waves=focus.find(row=>row.domain==='WAVES_CS')?.task;
 assert.ok(lane&&waves);
 const attempt=lane.missionHistory?.find(row=>row.matchId==='real-path-fixture-1');
 assert.equal(verifiedMissionRep(lane,attempt),true);
 assert.equal(attempt?.evidenceV2?.events[0]?.atSeconds,600);
 assert.equal(missionComparisonForMatch(lane,'real-path-fixture-1').result,'PROVEN');
 assert.equal(missionComparisonForMatch(waves,'real-path-fixture-1').result,'NOT OBSERVED');
 assert.equal(lane.successfulGames,1);
 assert.equal(waves.successfulGames,0);

 // Replaying the same post-game payload must not award a second clean game.
 const repeated=gradeDnaStrandMissionsFromHistory(graded,history).tasks;
 assert.equal(repeated.find(task=>task.id===lane.id)?.successfulGames,1);
 const other=graded.filter(task=>!['LANING','WAVES_CS'].includes(task.dnaDomain));
 assert.ok(other.every(task=>!(task.missionHistory??[]).some(row=>row.matchId==='real-path-fixture-1')));
});


test('changing DNA trees never banks historical matches played before the player selected them',()=>{
 const starting=ensureOneMissionPerDnaStrand([],'account-test','ADC').tasks.map(task=>({
   ...task,history:[{at:baselineTime,type:'PROMOTED' as const,note:'Baseline completed'}],
   dnaFocusUnlocked:task.dnaDomain==='LANING'||task.dnaDomain==='WAVES_CS',
   dnaFocusSelectionSource:'RECOMMENDED' as const,
 }));
 const selected=applyDnaFocusSelection(starting,['LANING','WAVES_CS'],'ADC','2026-10-13T18:20:00.000Z')!;
 const before:any[]=[{
   matchId:'before-confirmation',role:'ADC',champion:'Jinx',createdAt:'2026-10-13T18:10:00.000Z',
   analysis:{version:1,evidenceSources:['LIVE_TELEMETRY'],metrics:{
     red_state_fights:{key:'red_state_fights',label:'RED STATE',score:95,value:'95/100',
       status:'DERIVED',confidence:'HIGH',sources:['LIVE_TELEMETRY'],
       summary:'Good score from past game.',evidence:[{atSeconds:510,label:'Lane',detail:'Past decision'}]}
   },leakSignals:[],fingerprint:{primary:'',sequence:[],explanation:'',confidence:'HIGH'}}
 }];
 const graded=gradeDnaStrandMissionsFromHistory(selected,before).tasks;
 assert.ok(graded.every(task=>!(task.missionHistory??[]).some(a=>a.matchId==='before-confirmation')));
});
