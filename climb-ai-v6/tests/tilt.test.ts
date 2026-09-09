import test from 'node:test';
import assert from 'node:assert/strict';
import {groupSessions,currentSession,lossStreak,SESSION_GAP_MS} from '../lib/sessions';
import {readTilt,lateSessionDecline,MIN_PER_POSITION} from '../lib/tilt';
import {judgeRep,summariseReps} from '../lib/adherence';
import {Match} from '../lib/types';

const NOW=Date.UTC(2026,8,8,22,0,0);
const MIN=60_000;

let n=0;
function game(result:'WIN'|'LOSS',minutesAgo:number,deaths=5):Match{
  n++;
  return {
    id:`g-${n}`,riotAccountId:'a',champion:"Kog'Maw",role:'ADC',result,
    kills:5,deaths,assists:5,durationSeconds:1900,rank:'Gold IV',
    metrics:{cs:190,csPerMin:6,deaths},
    source:'demo',createdAt:new Date(NOW-minutesAgo*MIN).toISOString(),
  };
}

/* ---------- sessions ---------- */

test('groups back-to-back games into one session',()=>{
  const s=groupSessions([game('WIN',20),game('LOSS',55),game('LOSS',90)]);
  assert.equal(s.length,1);
  assert.equal(s[0].matches.length,3);
});

test('splits sessions across a long gap',()=>{
  const s=groupSessions([game('WIN',20),game('LOSS',55),game('WIN',60*30)]);
  assert.equal(s.length,2);
  assert.equal(s[0].matches.length,2,'newest session first');
  assert.equal(s[1].matches.length,1);
});

test('orders newest first regardless of input order',()=>{
  const a=game('WIN',20),b=game('LOSS',55),c=game('LOSS',90);
  const s=groupSessions([c,a,b]);
  assert.deepEqual(s[0].matches.map(m=>m.id),[a.id,b.id,c.id]);
});

test('ignores matches with an unusable timestamp',()=>{
  const broken={...game('WIN',20),createdAt:'not-a-date'};
  assert.equal(groupSessions([broken]).length,0);
});

test('a stale session is not the current one',()=>{
  const old=[game('LOSS',60*24)];
  assert.equal(currentSession(old,NOW),null,'yesterday is not tonight');
  assert.ok(currentSession([game('LOSS',30)],NOW));
});

test('counts only the losses at the end of the session',()=>{
  const s=currentSession([game('LOSS',20),game('LOSS',55),game('WIN',90),game('LOSS',120)],NOW);
  assert.equal(lossStreak(s),2);
});

/* ---------- tilt ---------- */

const history=(sessions:('WIN'|'LOSS')[][],deathsEarly=3,deathsLate=6)=>{
  const out:Match[]=[];
  sessions.forEach((results,si)=>{
    results.forEach((r,gi)=>{
      const minutesAgo=si*60*30+ (results.length-gi)*35;
      out.push(game(r,minutesAgo,gi>=2?deathsLate:deathsEarly));
    });
  });
  return out;
};

test('three straight losses tonight is a stop',()=>{
  const r=readTilt([game('LOSS',20),game('LOSS',55),game('LOSS',90)],NOW);
  assert.equal(r.status,'STOP');
  assert.equal(r.streak,3);
  assert.match(r.headline,/Stop for tonight/);
});

test('two losses alone is a watch, not a stop',()=>{
  const r=readTilt([game('LOSS',20),game('LOSS',55),game('WIN',90)],NOW);
  assert.equal(r.status,'WATCH');
  assert.match(r.headline,/Two down/);
});

test('a long session is a watch even while winning',()=>{
  const r=readTilt([1,2,3,4,5].map(i=>game('WIN',i*35)),NOW);
  assert.equal(r.status,'WATCH');
  assert.equal(r.streak,0);
});

test('a fresh session is fine',()=>{
  const r=readTilt([game('WIN',20)],NOW);
  assert.equal(r.status,'FINE');
  assert.match(r.headline,/Queue up/);
});

test('yesterday losses do not tilt today',()=>{
  const r=readTilt([game('LOSS',60*30),game('LOSS',60*30+35),game('LOSS',60*30+70)],NOW);
  assert.equal(r.status,'FINE');
  assert.equal(r.gamesThisSession,0);
});

test('the decline claim is withheld without enough session history',()=>{
  const r=readTilt([game('LOSS',20),game('LOSS',55),game('WIN',90)],NOW);
  assert.equal(r.declineMeasured,false);
  assert.equal(r.extraDeathsLate,null);
  assert.ok(r.evidence.some(e=>/Not enough session history/.test(e)));
});

test('with enough history it measures the decline and escalates two losses to stop',()=>{
  // Six sessions of four games: first game calm, third and fourth worse.
  const many=history([
    ['LOSS','LOSS','WIN','WIN'],['WIN','LOSS','WIN','LOSS'],['WIN','WIN','LOSS','WIN'],
    ['LOSS','WIN','WIN','LOSS'],['WIN','LOSS','LOSS','WIN'],['LOSS','WIN','LOSS','WIN'],
  ],3,6);
  const decline=lateSessionDecline(many);
  assert.ok(decline.early>=MIN_PER_POSITION&&decline.late>=MIN_PER_POSITION);
  assert.equal(decline.extraDeaths,3);

  // Tonight: two losses, and history says the third game is measurably worse.
  const tonight=[game('LOSS',20),game('LOSS',55)];
  const r=readTilt([...tonight,...many.map(m=>({...m,createdAt:new Date(new Date(m.createdAt).getTime()-60*60*60_000).toISOString()}))],NOW);
  assert.equal(r.streak,2);
  assert.equal(r.status,'STOP','a measured decline turns a watch into a stop');
  assert.match(r.headline,/deaths worse/);
});

test('no games at all does not throw',()=>{
  const r=readTilt([],NOW);
  assert.equal(r.status,'FINE');
  assert.equal(r.gamesThisSession,0);
});

/* ---------- adherence ---------- */

test('doing the behaviour and clearing the bar banks a pass',()=>{
  const v=judgeRep('YES',true);
  assert.equal(v.outcome,'CONFIRMED');
  assert.equal(v.banksPass,true);
});

test('doing the behaviour and missing the bar is not a failure',()=>{
  const v=judgeRep('YES',false);
  assert.equal(v.outcome,'UNREWARDED');
  assert.equal(v.banksPass,false);
  assert.match(v.headline,/did the work/i);
  // The player must be told explicitly that this is not a failure, and must be
  // offered the possibility that the plan is wrong rather than that they are.
  assert.match(v.detail,/not a failed rep/i);
  assert.match(v.detail,/the plan should change/i);
  assert.doesNotMatch(v.headline,/fail/i);
});

test('clearing the bar without running the behaviour does not bank a pass',()=>{
  const v=judgeRep('NO',true);
  assert.equal(v.outcome,'UNEARNED');
  assert.equal(v.banksPass,false);
});

test('partly counts as attempted',()=>{
  assert.equal(judgeRep('PARTLY',true).outcome,'CONFIRMED');
  assert.equal(judgeRep('PARTLY',false).outcome,'UNREWARDED');
});

test('payoff rate is measured only over games where the behaviour was run',()=>{
  const s=summariseReps([
    judgeRep('YES',true),judgeRep('YES',true),judgeRep('YES',false),
    judgeRep('NO',true),judgeRep('NO',false),
  ]);
  assert.equal(s.attempted,3);
  assert.equal(s.confirmed,2);
  assert.equal(s.payoffRate,2/3);
});

test('payoff rate is null rather than zero when nothing was attempted',()=>{
  assert.equal(summariseReps([judgeRep('NO',false)]).payoffRate,null);
});

test('the session gap constant is a sane two hours',()=>{
  assert.equal(SESSION_GAP_MS,2*60*60_000);
});
