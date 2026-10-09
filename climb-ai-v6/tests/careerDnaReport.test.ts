import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weeklyReport} from '../lib/dna/report';
import {GameRecord} from '../lib/dna/career';
import {HabitCounts} from '../lib/habits/detect';

const NOW=new Date('2026-09-30T12:00:00Z');
let n=0;
const game=(daysAgo:number,habits:HabitCounts,result:'WIN'|'LOSS'='WIN',relevant=true):GameRecord=>
  ({id:`g${++n}`,at:new Date(NOW.getTime()-daysAgo*86_400_000).toISOString(),champion:'Jinx',role:'ADC',result,minutes:30,relevant,habits});
const many=(k:number,daysAgo:(i:number)=>number,h:(i:number)=>HabitCounts)=>Array.from({length:k},(_,i)=>game(daysAgo(i),h(i)));

test('no report until 3 ranked games this week',()=>{
  const r=weeklyReport([...many(10,i=>20+i,()=>({soloDeath:1})),game(1,{soloDeath:0}),game(2,{},'WIN',false)],NOW);
  assert.equal(r.status,'NOT_ENOUGH');
  assert.equal(r.needed,2,'remakes do not count');
});

test('the example report: one habit down, one unchanged, focus on what is left',()=>{
  const before=many(10,i=>10+i,i=>({soloDeath:i<7?1:0,deathBeforeObjective:i<5?1:0}));
  const week=many(5,i=>i+0.5,i=>({soloDeath:i<2?1:0,deathBeforeObjective:i<3?1:0}));
  const r=weeklyReport([...before,...week],NOW);
  assert.equal(r.status,'READY');
  const solo=r.lines.find(l=>l.id==='soloDeath')!;
  assert.equal(solo.change,'IMPROVED');
  assert.equal(solo.before,0.7);
  assert.equal(solo.now,0.4);
  assert.equal(r.lines.find(l=>l.id==='deathBeforeObjective')!.change,'UNCHANGED');
  assert.equal(r.focus?.id,'deathBeforeObjective');
  assert.equal(r.headline,'This week: solo deaths down from 70% to 40%, dying before objectives unchanged at 60%. Focus: dying before objectives.');
});

test('a habit getting worse becomes the focus',()=>{
  const before=many(10,i=>10+i,()=>({soloDeath:0,deepDeath:1}));
  const week=many(4,i=>i+1,()=>({soloDeath:1,deepDeath:1}));
  const r=weeklyReport([...before,...week],NOW);
  assert.equal(r.lines[0].id,'soloDeath');
  assert.equal(r.lines[0].change,'WORSE');
  assert.equal(r.focus?.id,'soloDeath');
});

test('small moves are called unchanged, not progress',()=>{
  const before=many(10,i=>10+i,i=>({soloDeath:i<5?1:0}));   // 50%
  const week=many(5,i=>i+1,i=>({soloDeath:i<3?1:0}));       // 60%
  assert.equal(weeklyReport([...before,...week],NOW).lines[0].change,'UNCHANGED');
});

test('first week: no baseline, so nothing is called better or worse',()=>{
  const r=weeklyReport(many(4,i=>i+1,()=>({soloDeath:1})),NOW);
  assert.equal(r.status,'FIRST_WEEK');
  assert.equal(r.lines[0].change,'NEW');
  assert.equal(r.lines[0].before,null);
});

test('a clean week says so',()=>{
  const r=weeklyReport([...many(10,i=>10+i,()=>({soloDeath:0})),...many(3,i=>i+1,()=>({soloDeath:0}))],NOW);
  assert.equal(r.focus,null);
  assert.match(r.headline,/none of your habits/);
});

test('games older than 7 days are not "this week"',()=>{
  const r=weeklyReport(many(5,i=>8+i,()=>({soloDeath:1})),NOW);
  assert.equal(r.games,0);
  assert.equal(r.status,'NOT_ENOUGH');
});
