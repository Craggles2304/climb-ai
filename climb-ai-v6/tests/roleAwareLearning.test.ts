import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalLeagueRole,
  buildRoleAwareLearningSummary,
  globalLearningRows,
  rowsForRole,
  taskAppliesToRole,
} from '../lib/roleAwareLearning';
import type {HistoryAnalysisRow} from '../lib/riot/proHistory';
import type {ILPTask} from '../lib/types';

function row(role:string,champion:string,leaks:Array<{key:string;label:string;count:number}>,metrics:Record<string,any>):HistoryAnalysisRow{
  return{
    champion,
    role,
    createdAt:role==='BOTTOM'?'2026-09-20T12:00:00.000Z':role==='MIDDLE'?'2026-09-21T12:00:00.000Z':'2026-09-22T12:00:00.000Z',
    analysis:{
      version:1,
      evidenceSources:[],
      metrics,
      leakSignals:leaks.map(leak=>({...leak,severity:'ACTIVE'})),
      fingerprint:{primary:leaks[0]?.key??'BUILDING PROFILE',sequence:leaks.map(leak=>leak.key)},
    } as any,
  };
}

const history=[
  row('BOTTOM','Aphelios',[{key:'BANKING_LEAK',label:'Spend before voluntary fights',count:1}],{
    fight_selection:{key:'fight_selection',score:72,status:'MEASURED'},
    carry_preservation:{key:'carry_preservation',score:58,status:'MEASURED'},
    cs_curve:{key:'cs_curve',score:66,status:'MEASURED'},
  }),
  row('MIDDLE','Vex',[{key:'BANKING_LEAK',label:'Spend before voluntary fights',count:1}],{
    fight_selection:{key:'fight_selection',score:78,status:'MEASURED'},
    carry_preservation:{key:'carry_preservation',score:91,status:'MEASURED'},
    cs_curve:{key:'cs_curve',score:80,status:'MEASURED'},
  }),
  row('JUNGLE','Udyr',[{key:'RED_STATE',label:'Stop accepting red-state fights',count:1}],{
    fight_selection:{key:'fight_selection',score:62,status:'MEASURED'},
    objective_readiness:{key:'objective_readiness',score:55,status:'MEASURED'},
  }),
];

test('Riot lane names canonicalise without falling back to ADC',()=>{
  assert.equal(canonicalLeagueRole('BOTTOM'),'ADC');
  assert.equal(canonicalLeagueRole('MIDDLE'),'MID');
  assert.equal(canonicalLeagueRole('UTILITY'),'SUPPORT');
  assert.equal(canonicalLeagueRole('JUNGLE'),'JUNGLE');
  assert.equal(canonicalLeagueRole('NONE'),null);
});

test('role evidence stays in its own lane',()=>{
  assert.deepEqual(rowsForRole(history,'ADC').map(r=>r.champion),['Aphelios']);
  assert.deepEqual(rowsForRole(history,'MID').map(r=>r.champion),['Vex']);
  assert.deepEqual(rowsForRole(history,'JUNGLE').map(r=>r.champion),['Udyr']);
});

test('global player model keeps transferable decisions and strips role-specific metrics',()=>{
  const global=globalLearningRows(history);
  for(const row of global){
    assert.ok(row.analysis.metrics.fight_selection);
    assert.equal(row.analysis.metrics.carry_preservation,undefined);
    assert.equal(row.analysis.metrics.cs_curve,undefined);
    assert.equal(row.analysis.metrics.objective_readiness,undefined);
  }
});

test('cross-role repeated patterns are labelled as global only after multiple roles support them',()=>{
  const summary=buildRoleAwareLearningSummary(history,'2026-09-24T12:00:00.000Z');
  assert.equal(summary.roles.ADC?.games,1);
  assert.equal(summary.roles.MID?.games,1);
  assert.equal(summary.roles.JUNGLE?.games,1);
  const banking=summary.crossRolePatterns.find(pattern=>pattern.key==='BANKING_LEAK');
  assert.ok(banking);
  assert.equal(banking?.global,true);
  assert.deepEqual(new Set(banking?.roles),new Set(['ADC','MID']));
});

test('role-scoped tasks do not leak into another role while GLOBAL tasks do',()=>{
  const base={id:'x',accountId:'a',title:'x',category:'CONSISTENCY',why:'x',gameRule:'x',metric:'x',target:'x',progress:0,status:'ACTIVE',source:'SYSTEM',evidence:[]} as ILPTask;
  const adc={...base,roleScope:'ADC' as const,roleEvidence:['ADC' as const]};
  const jungle={...base,id:'y',roleScope:'JUNGLE' as const,roleEvidence:['JUNGLE' as const]};
  const global={...base,id:'z',roleScope:'GLOBAL' as const,roleEvidence:[]};
  assert.equal(taskAppliesToRole(adc,'ADC'),true);
  assert.equal(taskAppliesToRole(adc,'MID'),false);
  assert.equal(taskAppliesToRole(jungle,'ADC'),false);
  assert.equal(taskAppliesToRole(global,'ADC'),true);
  assert.equal(taskAppliesToRole(global,'JUNGLE'),true);
});
