import test from 'node:test';
import assert from 'node:assert/strict';
import {priceLeak,rankLeaks,MIN_TOTAL,MIN_PER_SIDE} from '../lib/costOfLeak';
import {METRIC_SPECS,clears} from '../lib/metrics';
import {adaptILP} from '../lib/ilpEngine';
import {Match,MatchMetrics,ILPTask} from '../lib/types';

let seq=0;
function match(result:'WIN'|'LOSS',metrics:Partial<MatchMetrics>):Match{
  seq++;
  return {
    id:`m-${seq}`,riotAccountId:'acct-1',champion:"Kog'Maw",role:'ADC',result,
    kills:5,deaths:4,assists:6,durationSeconds:1900,rank:'Gold IV',
    metrics:{cs:200,csPerMin:6.3,deaths:4,...metrics},
    source:'demo',createdAt:'2026-09-01T00:00:00.000Z',
  };
}

/** n games above the bar (w of them wins) and m below (v of them wins). */
function split(above:number,aboveWins:number,below:number,belowWins:number,value=[7,4]){
  const out:Match[]=[];
  for(let i=0;i<above;i++)out.push(match(i<aboveWins?'WIN':'LOSS',{post15CsPerMin:value[0]}));
  for(let i=0;i<below;i++)out.push(match(i<belowWins?'WIN':'LOSS',{post15CsPerMin:value[1]}));
  return out;
}

test('splits the player games by the bar and states the fact plainly',()=>{
  const r=priceLeak(split(11,8,12,3),'post15CsPerMin');
  assert.equal(r.status,'READY');
  assert.equal(r.sample,23);
  assert.deepEqual({games:r.cleared.games,wins:r.cleared.wins},{games:11,wins:8});
  assert.deepEqual({games:r.missed.games,wins:r.missed.wins},{games:12,wins:3});
  assert.match(r.fact,/won 8 of 11 when you held 6\.0\+ post-15 CS\/min/);
  assert.match(r.fact,/3 of 12 when you did not/);
});

test('reports the gap as a separate inference, never inside the fact',()=>{
  const r=priceLeak(split(11,8,12,3),'post15CsPerMin');
  // 8/11 = 72.7%, 3/12 = 25% -> 48 points
  assert.equal(r.gapPoints,48);
  assert.match(r.inference!,/48-point win-rate gap/);
  assert.doesNotMatch(r.fact,/gap/);
});

test('refuses to report below the sample gate, and says what is needed',()=>{
  const r=priceLeak(split(5,4,5,1),'post15CsPerMin'); // 10 games
  assert.equal(r.status,'INSUFFICIENT_SAMPLE');
  assert.equal(r.gapPoints,null);
  assert.equal(r.gamesNeeded,MIN_TOTAL-10);
  assert.match(r.suggestion!,/Play 5 more ranked games/);
});

test('refuses when one side of the bar is too thin, even with enough games',()=>{
  const r=priceLeak(split(18,12,3,1),'post15CsPerMin'); // 21 games, only 3 below
  assert.equal(r.status,'INSUFFICIENT_SAMPLE');
  assert.equal(r.gamesNeeded,MIN_PER_SIDE-3);
});

test('the counterfactual is withheld below high confidence',()=>{
  const medium=priceLeak(split(8,6,12,3),'post15CsPerMin'); // 20 games, min side 8
  assert.equal(medium.status,'READY');
  assert.equal(medium.confidence,'MEDIUM');
  assert.equal(medium.estimatedWinsLost,null,'must not estimate wins lost at medium confidence');
  assert.doesNotMatch(medium.suggestion!,/\d+ of those losses/);
});

test('the counterfactual appears only at high confidence, phrased as an estimate',()=>{
  const high=priceLeak(split(15,11,15,4),'post15CsPerMin'); // 30 games, 15 each side
  assert.equal(high.confidence,'HIGH');
  // 15 * (11/15 - 4/15) = 7
  assert.equal(high.estimatedWinsLost,7);
  assert.match(high.suggestion!,/Roughly 7 of those losses/);
});

test('never uses causal language about gaining LP or rank',()=>{
  const r=priceLeak(split(15,11,15,4),'post15CsPerMin');
  const all=[r.fact,r.inference,r.suggestion].join(' ');
  for(const banned of [/\bLP\b/i,/\bgain\b/i,/\bwill win\b/i,/\bcauses?\b/i,/\bguarantee/i]){
    assert.doesNotMatch(all,banned,`copy must avoid ${banned}`);
  }
});

test('handles an at-most metric, where clearing the bar means fewer',()=>{
  const games=[
    ...Array.from({length:10},(_,i)=>match(i<7?'WIN':'LOSS',{deathsPost20:1})),
    ...Array.from({length:10},(_,i)=>match(i<3?'WIN':'LOSS',{deathsPost20:4})),
  ];
  const r=priceLeak(games,'deathsPost20');
  assert.equal(r.status,'READY');
  assert.equal(r.cleared.games,10);
  assert.equal(r.cleared.wins,7);
  assert.match(r.fact,/2 or fewer post-20 deaths/);
});

test('a gap pointing the wrong way is reported plainly, not spun',()=>{
  const r=priceLeak(split(11,3,12,9),'post15CsPerMin');
  assert.equal(r.status,'READY');
  assert.ok(r.gapPoints! < 0);
  assert.match(r.inference!,/not the behaviour to chase right now/);
  assert.equal(r.suggestion,null,'must not suggest chasing a behaviour that is not paying');
});

test('a flat split says so rather than inventing a gap',()=>{
  const r=priceLeak(split(10,5,10,5),'post15CsPerMin');
  assert.equal(r.gapPoints,0);
  assert.match(r.inference!,/not currently separating your games/);
  assert.equal(r.suggestion,null);
});

test('marks the metric unavailable when no game records it',()=>{
  const games=Array.from({length:20},()=>match('WIN',{}));
  const r=priceLeak(games,'post15CsPerMin');
  assert.equal(r.status,'METRIC_UNAVAILABLE');
  assert.match(r.fact,/No games on this account record post-15 CS\/min/);
});

test('an unknown metric degrades instead of throwing',()=>{
  const r=priceLeak(split(11,8,12,3),'clipReview');
  assert.equal(r.status,'METRIC_UNAVAILABLE');
  assert.equal(r.gapPoints,null);
});

test('rankLeaks orders by the size of the gap',()=>{
  const games=[
    ...Array.from({length:10},(_,i)=>match(i<8?'WIN':'LOSS',{post15CsPerMin:7,deathsPost20:1})),
    ...Array.from({length:10},(_,i)=>match(i<2?'WIN':'LOSS',{post15CsPerMin:4,deathsPost20:1})),
  ];
  const ranked=rankLeaks(games,['deathsPost20','post15CsPerMin']);
  assert.equal(ranked[0].metric,'post15CsPerMin','the metric that separates games must rank first');
});

// --- drift guard -------------------------------------------------------------
// The price tag and the learning plan must agree on where the bar is. If someone
// changes a threshold in ilpEngine without changing metrics.ts, the plan would
// call a game a pass while the price tag counted it as a miss.
test('thresholds agree with the pass conditions in ilpEngine',()=>{
  const cases:[string,number,number][]=[
    // metric, value that should clear, value that should miss
    ['post15CsPerMin',6.0,5.9],
    ['deathsPost20',2,3],
    ['secondItemMinute',23,24],
    ['objectiveParticipation',0.7,0.6],
  ];
  for(const [metric,pass,fail] of cases){
    const spec=METRIC_SPECS[metric];
    assert.ok(spec,`${metric} missing from METRIC_SPECS`);
    assert.equal(clears(spec,pass),true,`${metric}: ${pass} should clear the bar`);
    assert.equal(clears(spec,fail),false,`${metric}: ${fail} should miss the bar`);

    const task:ILPTask={
      id:'t1',accountId:'acct-1',title:'t',category:'FARMING',why:'',gameRule:'',
      metric,target:'',progress:0,status:'ACTIVE',source:'SYSTEM',evidence:[],
      successfulGames:0,masteryRequired:3,
    };
    const at=Array.from({length:5},()=>match('WIN',{[spec.key]:pass} as Partial<MatchMetrics>));
    const below=Array.from({length:5},()=>match('WIN',{[spec.key]:fail} as Partial<MatchMetrics>));
    assert.equal(adaptILP([task],at).tasks[0].successfulGames,1,
      `ilpEngine should bank a pass for ${metric} at ${pass}`);
    assert.equal(adaptILP([task],below).tasks[0].successfulGames,0,
      `ilpEngine should not bank a pass for ${metric} at ${fail}`);
  }
});
