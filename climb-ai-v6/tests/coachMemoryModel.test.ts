import test from 'node:test';
import assert from 'node:assert/strict';
import type {ILPTask} from '../lib/types';
import {buildCoachMemoryCandidates,mergeCoachMemoryEvidence} from '../lib/coachMemoryModel';

const mission:ILPTask={
  id:'dna-strand-adc-teamfights-1',accountId:'a',title:'Survive the first threat cycle',dnaDomain:'TEAMFIGHTS',category:'TEAMFIGHTING',why:'',gameRule:'Wait out the first threat.',metric:'survival_value',target:'3 proven games',progress:100,status:'MASTERED',source:'SYSTEM',evidence:[],roleScope:'ADC',roleEvidence:['ADC'],masteryRequired:3,
  missionHistory:[
    {matchId:'m1',at:'2026-10-01T00:00:00.000Z',adherence:'TRACKED',clearedBar:true,outcome:'CONFIRMED',banksPass:true},
    {matchId:'m2',at:'2026-10-02T00:00:00.000Z',adherence:'TRACKED',clearedBar:true,outcome:'CONFIRMED',banksPass:true},
    {matchId:'m3',at:'2026-10-03T00:00:00.000Z',adherence:'TRACKED',clearedBar:true,outcome:'CONFIRMED',banksPass:true},
  ],
};

test('Coach Memory keeps mission mastery as durable role-specific history',()=>{
  const rows=buildCoachMemoryCandidates({tasks:[mission],roleProfiles:{},now:'2026-10-05T00:00:00.000Z'});
  const memory=rows.find(row=>row.key.includes('mission:ADC'))!;
  assert.equal(memory.type,'MASTERY');
  assert.equal(memory.status,'MASTERED');
  assert.equal(memory.memoryState,'MASTERED');
  assert.equal(memory.role,'ADC');
  assert.equal((memory.snapshot as any).confirmed,3);
});

test('Coach Memory stores regression and transfer without erasing prior mastery',()=>{
  const roleProfiles={ADC:{gamesAnalyzed:20,recentChange:{generatedAt:'2026-10-05T00:00:00.000Z',scenarioMemory:{cards:[{id:'memory:carry:general',behaviourKey:'CARRY_PRESERVATION',behaviourLabel:'Carry Preservation',situationTag:'GENERAL',state:'REGRESSED',confidence:'HIGH',comparableGames:10,cleanGames:7,cleanRate:70,recentCleanRate:25,memoryStrength:58,lastSeenAt:'2026-10-04T00:00:00.000Z',lastVerdict:'IMPROVE',summary:'Carry Preservation had stabilised, but comparable mistakes have returned.',trigger:'Enemy access opens.',targetBranch:'Preserve the safe damage line.',evidence:'10 comparable games'}]},decisionTransfer:{cards:[{id:'transfer:carry',behaviourKey:'CARRY_PRESERVATION',behaviourLabel:'Carry Preservation',state:'PRINCIPLE_OWNED',confidence:'HIGH',sourceChampion:'Caitlyn',sourceTag:'GENERAL',dimension:'BOTH',transferGames:6,cleanTransferGames:5,transferCleanRate:83,recentCleanRate:100,transferStrength:88,breadthScore:4,novelChampions:['Jinx'],novelContexts:['DIVE'],principle:'Preserve safe damage access.',summary:'Carry Preservation has transferred across novel conditions.',evidence:'6 transfer games',lastTransferAt:'2026-10-04T00:00:00.000Z'}]}}}};
  const rows=buildCoachMemoryCandidates({tasks:[mission],roleProfiles,now:'2026-10-05T00:00:00.000Z'});
  const regression=rows.find(row=>row.key.includes('scenario:ADC'))!;
  const transfer=rows.find(row=>row.key.includes('transfer:ADC'))!;
  assert.equal(regression.memoryState,'REGRESSED');
  assert.equal(regression.status,'ACTIVE');
  assert.equal(transfer.memoryState,'PRINCIPLE_OWNED');
  assert.equal(transfer.status,'MASTERED');
});

test('Coach Memory evidence only appends when the state fingerprint changes',()=>{
  const first={fingerprint:'x',at:'a'};
  const same=mergeCoachMemoryEvidence([first],{fingerprint:'x',at:'b'});
  assert.equal(same.changed,false);
  assert.equal(same.evidence.length,1);
  const changed=mergeCoachMemoryEvidence([first],{fingerprint:'y',at:'c'});
  assert.equal(changed.changed,true);
  assert.equal(changed.evidence.length,2);
});

test('Coach Memory stores role DNA level and traceable current strength',()=>{
  const active={...mission,id:'dna-strand-adc-teamfights-2',status:'EVIDENCE_BUILDING' as const,progress:33,missionHistory:[
    {matchId:'m4',at:'2026-10-04T00:00:00.000Z',adherence:'TRACKED' as const,clearedBar:true,outcome:'CONFIRMED' as const,banksPass:true,evidenceV2:{
      version:2,state:'BANKED' as const,measurementSource:'DECISION_EVIDENCE' as const,metricKey:'survival_value',observedValue:91,observedValueLabel:'91/100',targetLabel:'85+',confidence:'HIGH' as const,opportunities:3,successes:3,misses:0,events:[{atSeconds:620,label:'Threat cycle',detail:'Survived first access'}],reconstruction:{kind:'PRO_METRIC' as const,fields:['score'],formula:'score >= 85'},reason:'Cleared the mission threshold.'
    }}
  ]};
  const roleProfiles={ADC:{gamesAnalyzed:12,learningIdentity:{behaviours:[
    {key:'FIGHT_SELECTION',label:'Fight Selection',recentScore:84,averageScore:76,evidenceCount:5,applicableGames:5,confidence:'HIGH',trend:'IMPROVING'},
    {key:'CARRY_PRESERVATION',label:'Carry Preservation',recentScore:78,averageScore:80,evidenceCount:4,applicableGames:4,confidence:'MEDIUM',trend:'STABLE'},
    {key:'SURVIVAL_VALUE',label:'Survival Value',recentScore:82,averageScore:74,evidenceCount:3,applicableGames:3,confidence:'HIGH',trend:'IMPROVING'},
  ]},recentChange:{generatedAt:'2026-10-05T00:00:00.000Z'}}};
  const rows=buildCoachMemoryCandidates({tasks:[mission,active],roleProfiles,now:'2026-10-05T00:00:00.000Z'});
  const dna=rows.find(row=>row.key==='derived:dna:ADC:TEAMFIGHTS')!;
  assert.equal(dna.role,'ADC');
  assert.equal(dna.dnaDomain,'TEAMFIGHTS');
  assert.equal((dna.snapshot as any).level,2);
  assert.equal((dna.snapshot as any).totalXp,125);
  assert.equal(typeof (dna.snapshot as any).currentStrength,'number');
  assert.ok((dna.snapshot as any).currentStrength>=0&&(dna.snapshot as any).currentStrength<=100);
  assert.equal((dna.snapshot as any).currentMission.confirmed,1);
  assert.equal((dna.snapshot as any).currentMission.required,3);
  assert.equal((dna.snapshot as any).components.length,3);
});

test('Coach Memory preserves mission Evidence V2 proof instead of only pass/fail',()=>{
  const evidenceTask={...mission,status:'EVIDENCE_BUILDING' as const,missionHistory:[{
    matchId:'proof',at:'2026-10-05T00:00:00.000Z',adherence:'TRACKED' as const,clearedBar:true,outcome:'CONFIRMED' as const,banksPass:true,evidenceV2:{
      version:2,state:'BANKED' as const,measurementSource:'RIOT_POST_GAME' as const,metricKey:'survival_value',observedValue:88,observedValueLabel:'88/100',targetLabel:'85+',confidence:'HIGH' as const,opportunities:4,successes:3,misses:1,events:[{atSeconds:900,label:'Teamfight',detail:'Survived first threat cycle'}],reconstruction:{kind:'PRO_METRIC' as const,fields:['score'],formula:'score >= 85'},reason:'3 of 4 qualifying opportunities handled correctly.'
    }
  }]};
  const rows=buildCoachMemoryCandidates({tasks:[evidenceTask],roleProfiles:{},now:'2026-10-05T00:00:00.000Z'});
  const memory=rows.find(row=>row.key.includes('mission:ADC'))!;
  const attempt=(memory.snapshot as any).recentAttempts[0];
  assert.equal(attempt.evidenceState,'BANKED');
  assert.equal(attempt.opportunities,4);
  assert.equal(attempt.successes,3);
  assert.equal(attempt.misses,1);
  assert.equal(attempt.confidence,'HIGH');
  assert.equal(attempt.events[0].atSeconds,900);
});
