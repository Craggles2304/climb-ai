import test from 'node:test';
import assert from 'node:assert/strict';
import {seedFor,firstPlan,PlayerProfile,PROFILE_ACCOUNT_ID} from '../lib/profile';
import {METRIC_SPECS} from '../lib/metrics';
import {priceLeak} from '../lib/costOfLeak';

const FRUSTRATIONS=[
  'I die too much','My CS is poor','I win lane but lose games',
  'I struggle with positioning','I do not know what to do after lane',
  'I struggle in teamfights','I do not know why I am losing','Other',
];

const profile=(frustration:string):PlayerProfile=>({
  id:PROFILE_ACCOUNT_ID,gameName:'Craggles',tagline:'#EUW',region:'EUW',
  role:'ADC',rank:'Gold',champions:["Kog'Maw"],frustration,
  createdAt:'2026-09-08T00:00:00.000Z',
});

test('every onboarding answer produces a starting behaviour',()=>{
  for(const f of FRUSTRATIONS){
    const seed=seedFor(f);
    assert.ok(seed.title.length>0,`${f} produced no title`);
    assert.ok(seed.gameRule.length>0,`${f} produced no in-game rule`);
    assert.ok(seed.why.length>0,`${f} produced no rationale`);
  }
});

test('an unrecognised answer falls back instead of crashing',()=>{
  const seed=seedFor('something nobody wrote');
  assert.equal(seed.metric,'post15CsPerMin');
  assert.match(seed.why,/do not have a diagnosis yet/i);
});

test('every seeded metric is one the engine can actually score',()=>{
  for(const f of FRUSTRATIONS){
    const metric=seedFor(f).metric;
    assert.ok(METRIC_SPECS[metric],`${f} seeds "${metric}", which has no metric spec`);
  }
});

test('a seeded metric can be priced once games exist',()=>{
  // The seed is only useful if the cost-of-leak engine can read it later, so
  // feed each seeded metric real values and check it reaches the sample gate
  // rather than falling out as an unknown key.
  for(const f of FRUSTRATIONS){
    const spec=METRIC_SPECS[seedFor(f).metric];
    const games=Array.from({length:4},(_,i)=>({
      id:`m${i}`,riotAccountId:'a',champion:'X',role:'ADC' as const,
      result:(i%2?'WIN':'LOSS') as 'WIN'|'LOSS',kills:1,deaths:1,assists:1,
      durationSeconds:1900,rank:'Gold IV',
      metrics:{cs:1,csPerMin:1,deaths:1,[spec.key]:spec.threshold},
      source:'demo' as const,createdAt:'2026-09-01T00:00:00.000Z',
    }));
    const priced=priceLeak(games,seedFor(f).metric);
    assert.equal(priced.status,'INSUFFICIENT_SAMPLE',
      `${f} seeds "${spec.key}", which the price engine could not read`);
    assert.ok(priced.sample>0,`${f}: the metric was present but counted as absent`);
  }
});

test('the first plan is one behaviour, not five guesses',()=>{
  const plan=firstPlan(profile('My CS is poor'));
  assert.equal(plan.length,1);
  assert.equal(plan[0].progress,0);
  assert.equal(plan[0].successfulGames,0);
  assert.equal(plan[0].status,'ACTIVE');
});

test('the first plan says out loud that it is a hypothesis',()=>{
  const [task]=firstPlan(profile('I die too much'));
  assert.match(task.evidence.join(' '),/no match evidence yet/i);
  assert.match(task.lastUpdatedReason||'',/can overturn it/i);
});

test('the plan belongs to the player, not the demo account',()=>{
  const [task]=firstPlan(profile('I struggle in teamfights'));
  assert.equal(task.accountId,PROFILE_ACCOUNT_ID);
});

test('what the player says maps to a plausible metric',()=>{
  assert.equal(seedFor('I die too much').metric,'deathsPost20');
  assert.equal(seedFor('My CS is poor').metric,'post15CsPerMin');
  assert.equal(seedFor('I struggle with positioning').metric,'deathsPost20');
});
