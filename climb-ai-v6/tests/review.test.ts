import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReview,bandFor,pick,hash} from '../lib/review';
import {analyseMatch} from '../lib/engine';
import {Match,MatchMetrics} from '../lib/types';

function match(id:string,over:Partial<Match>={},metrics:Partial<MatchMetrics>={}):Match{
  return {
    id,riotAccountId:'acct-1',champion:"Kog'Maw",opponent:'Caitlyn',role:'ADC',result:'LOSS',
    kills:5,deaths:6,assists:7,durationSeconds:2000,rank:'Gold IV · 38 LP',
    metrics:{
      cs:190,csPerMin:5.7,deaths:6,laneCsPerMin:6.6,post15CsPerMin:4.8,
      csAt10:70,csAt15:99,goldDiffAt15:120,xpDiffAt15:40,deathsPre10:0,
      deaths10to20:2,deathsPost20:4,killParticipation:.62,damageShare:.28,
      ...metrics,
    },
    source:'demo',createdAt:'2026-09-01T00:00:00.000Z',...over,
  };
}

const review=(m:Match,rank?:string)=>buildReview(m,analyseMatch(m,[m]),rank);

test('the same match always produces an identical review',()=>{
  const m=match('EUW1_1');
  assert.deepEqual(review(m),review(m),'reproducibility is the whole claim over a model');
});

test('different matches draw different phrasing',()=>{
  const headlines=new Set(
    Array.from({length:24},(_,i)=>review(match(`EUW1_${i}`)).headline),
  );
  assert.ok(headlines.size>1,'a single phrasing for every game is the form-letter failure');
});

test('rank bands change the vocabulary, not just the numbers',()=>{
  const m=match('EUW1_band');
  const beginner=review(m,'Bronze II');
  const advanced=review(m,'Diamond IV');
  assert.equal(beginner.band,'BEGINNER');
  assert.equal(advanced.band,'ADVANCED');

  const jargon=/tempo|breakpoint|threat map|uncontested|rotation|spacing|cooldown/i;
  assert.doesNotMatch(beginner.whatToDoInstead.join(' '),jargon,'beginners must not be given jargon');
  assert.doesNotMatch(beginner.biggestMistake.whyItMatters,jargon);
  assert.match(
    advanced.whatToDoInstead.join(' ')+advanced.biggestMistake.whyItMatters,
    jargon,
    'advanced players should get the deeper vocabulary',
  );
});

test('bandFor maps every tier it is given',()=>{
  assert.equal(bandFor('Iron IV'),'BEGINNER');
  assert.equal(bandFor('Bronze I · 12 LP'),'BEGINNER');
  assert.equal(bandFor('Silver II'),'CORE');
  assert.equal(bandFor('Gold IV · 38 LP'),'CORE');
  assert.equal(bandFor('Emerald III'),'ADVANCED');
  assert.equal(bandFor('Master+'),'ADVANCED');
  assert.equal(bandFor('Unranked'),'CORE','an unknown tier falls back to the middle, never crashes');
});

test('never emits undefined, NaN or an empty bullet',()=>{
  const sparse=match('EUW1_sparse',{},{
    laneCsPerMin:undefined,post15CsPerMin:undefined,goldDiffAt15:undefined,
    killParticipation:undefined,damageShare:undefined,deathsPre10:undefined,
    visionScore:undefined,csAt10:undefined,csAt15:undefined,
  });
  const r=review(sparse);
  const all=[r.headline,...r.didWell,r.biggestMistake.title,r.biggestMistake.whyItMatters,
    ...r.biggestMistake.evidence,...r.whatToDoInstead,r.mission.target,r.mission.rule].join(' | ');
  assert.doesNotMatch(all,/undefined|NaN|null/);
  for(const line of [...r.didWell,...r.whatToDoInstead])assert.ok(line.trim().length>0);
});

test('praise is only given for metrics that exist',()=>{
  const sparse=review(match('EUW1_nope',{},{
    goldDiffAt15:undefined,laneCsPerMin:undefined,deathsPre10:undefined,
    killParticipation:undefined,damageShare:undefined,visionScore:undefined,
  }));
  assert.equal(sparse.didWell.length,1,'with nothing measurable, offer one honest line, not three invented ones');
  assert.doesNotMatch(sparse.didWell[0],/\d/,'the fallback must not contain a fabricated figure');
});

test('caps both lists at three items',()=>{
  const rich=review(match('EUW1_rich',{},{
    goldDiffAt15:900,laneCsPerMin:7.4,deathsPre10:0,killParticipation:.8,
    damageShare:.34,visionScore:41,
  }));
  assert.ok(rich.didWell.length<=3);
  assert.ok(rich.whatToDoInstead.length<=3);
});

test('evidence is passed through from the engine, not rewritten',()=>{
  const m=match('EUW1_ev');
  const report=analyseMatch(m,[m]);
  const r=buildReview(m,report);
  assert.deepEqual(r.biggestMistake.evidence,report.primary.facts.slice(0,3));
});

test('pick is stable and hash is deterministic',()=>{
  const pool=['a','b','c','d'] as const;
  assert.equal(pick(pool,'seed-1'),pick(pool,'seed-1'));
  assert.equal(hash('abc'),hash('abc'));
  assert.notEqual(hash('abc'),hash('abd'));
  assert.throws(()=>pick([],'x'),/empty pool/);
});
