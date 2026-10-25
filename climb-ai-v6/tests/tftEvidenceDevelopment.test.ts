import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTacticianProfile,TFT_SKILL_KEYS} from '../lib/tft/advancedCoach';
import {buildTftDevelopment,hasTftObservation,type TftRecordedReview} from '../lib/tft/development';
import {tftSessionReviewSchema} from '../lib/tft/reviewSchema';
import type {TftMatch} from '../lib/tft/types';
const match=(patch:Partial<TftMatch>={}):TftMatch=>({id:'game-1',riotAccountId:'account',playedAt:'2026-10-15T18:00:00Z',placement:8,level:6,goldLeft:50,gameLengthSeconds:1800,gameVersion:'',augments:[],traits:[],units:[],compSignature:'reroll',...patch});
const assessment={round:'4-2',verdict:'HELPED' as const,reason:'Spent to complete the planned frontline upgrade.'};
const points=[{at:'2026-10-15T18:00:00Z',round:'3-2',gold:50,level:6},{at:'2026-10-15T18:02:00Z',round:'3-3',gold:22,level:6,shopRefreshes:7}];

test('placement, final level and leftover gold never establish skill quality',()=>{
  for(const m of [match(),match({placement:1,level:10,goldLeft:0})]){
    const p=buildTacticianProfile([m]);assert.equal(p.grade,null);assert.equal(p.primaryLeak,null);
    assert.ok(p.skills.every(s=>s.score===null&&s.basis==='NOT_OBSERVED'));
    assert.ok(p.ilp.every(t=>t.progress===0&&t.verifiedProgress===0));
  }
});
test('unexplained legacy dropdowns and unknown reviews cannot earn credit',()=>{
  const p=buildTacticianProfile([match({decisionReview:{rollTiming:'ON_TIME',positioningResult:'WON_FIGHTS',assessments:{ECONOMY:{...assessment,verdict:'UNCERTAIN'}}}})]);
  assert.equal(p.grade,null);assert.equal(p.ilp.find(t=>t.skill==='ECONOMY')?.progress,0);
});
test('all six strands score explained self-reviews with an explicit evidence boundary',()=>{
  const assessments=Object.fromEntries(TFT_SKILL_KEYS.map(k=>[k,assessment]));
  const p=buildTacticianProfile([match({decisionReview:{assessments}})]);
  assert.equal(p.skills.length,6);assert.ok(p.skills.every(s=>s.score===100&&s.basis==='SELF_REVIEW'&&s.evidenceCount===1));
  assert.equal(p.gradingBasis,'SELF_REVIEW');assert.ok(p.ilp.every(t=>t.verifiedProgress===0));
});
test('one game is one review per skill, even when uploaded repeatedly',()=>{
  const m=match({decisionReview:{assessments:{ECONOMY:assessment}}});
  const p=buildTacticianProfile([m,m,m]);assert.equal(p.skills[0].evidenceCount,1);assert.equal(p.ilp.find(t=>t.skill==='ECONOMY')?.progress,1);
});
test('shared mission progress counts unique recorded games with the snapshotted mission, not passes',()=>{
  const baseline=buildTftDevelopment([],[]);assert.equal(baseline.mission.status,'BASELINE');
  const recording:TftRecordedReview={id:'session-1',matchId:'native-1',startedAt:points[0].at,points,mission:baseline.mission};
  const d=buildTftDevelopment([], [recording,recording,{...recording,id:'session-2'},{...recording,id:'session-3'}]);
  assert.equal(d.mission.progress,3);assert.equal(d.mission.status,'REVIEW_READY');assert.equal(d.profile.grade,null);assert.equal(d.mission.verifiedMastery,false);
});
test('old sessions, empty captures and unrelated missions do not award progress',()=>{
  const d=buildTftDevelopment([], [{id:'a',matchId:'a',startedAt:points[0].at,points}, {id:'b',matchId:'b',startedAt:points[0].at,points:[],mission:{id:'tft-economy-evidence-v2',domain:'ECONOMY'}}]);
  assert.equal(d.mission.progress,0);assert.equal(hasTftObservation(points,'BOARD_BUILDING'),false);assert.equal(hasTftObservation(points,'ITEMS_AUGMENTS'),false);assert.equal(hasTftObservation(points,'FLEXIBILITY'),false);
});
test('completed session self-reviews reach DNA without pretending capture proved quality',()=>{
  const d=buildTftDevelopment([], [{id:'a',matchId:'native-a',startedAt:points[0].at,points,assessments:{BOARD_BUILDING:assessment,ITEMS_AUGMENTS:{...assessment,verdict:'HURT'}}}]);
  assert.equal(d.profile.skills.find(s=>s.key==='BOARD_BUILDING')?.score,100);
  assert.equal(d.profile.skills.find(s=>s.key==='ITEMS_AUGMENTS')?.score,0);
  assert.equal(d.mission.domain,'ITEMS_AUGMENTS');assert.equal(d.mission.verifiedMastery,false);
});
test('review input rejects invented provenance and unexplained assessments',()=>{
  const input={sessionId:'11111111-1111-4111-8111-111111111111',skill:'ECONOMY',assessment};
  assert.equal(tftSessionReviewSchema.safeParse(input).success,true);
  assert.equal(tftSessionReviewSchema.safeParse({...input,assessment:{...assessment,reason:'good'}}).success,false);
  assert.equal(tftSessionReviewSchema.safeParse({...input,assessment:{...assessment,source:'VERIFIED'}}).success,false);
});
