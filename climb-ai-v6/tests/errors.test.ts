import test from 'node:test';
import assert from 'node:assert/strict';
import {humanError,errorKind} from '../lib/errors';

test('never leaks a raw exception message to the player',()=>{
  const nasty=new Error('PGRST301 at https://xyz.supabase.co/rest/v1/matches?apikey=sb_secret_EXAMPLE_FAKE_FIXTURE');
  const shown=humanError(nasty);
  const text=`${shown.title} ${shown.body}`;
  assert.doesNotMatch(text,/supabase\.co/);
  assert.doesNotMatch(text,/sb_secret/);
  assert.doesNotMatch(text,/PGRST/);
  assert.doesNotMatch(text,/https?:\/\//);
});

test('every message tells the player what is still true',()=>{
  const cases=[
    new Error('riot timeline unavailable'),
    new Error('429 too many requests'),
    new Error('supabase relation does not exist'),
    new Error('network fetch failed'),
    new Error('something entirely unexpected'),
  ];
  for(const e of cases){
    const {body}=humanError(e);
    assert.match(body,/safe|lost|nothing has been/i,`no reassurance in: ${body}`);
  }
});

test('every message offers a way forward',()=>{
  const cases=[
    new Error('riot is down'),new Error('401 not signed in'),
    new Error('404 not found'),new Error('unknown failure'),
  ];
  for(const e of cases){
    const h=humanError(e);
    assert.ok(h.retryable||h.action,`dead end for: ${e.message}`);
  }
});

test('maps a Riot failure to the manual-upload escape hatch',()=>{
  const h=humanError(new Error('Riot API returned 503'));
  assert.match(h.title,/could not reach Riot/i);
  assert.equal(h.action?.href,'/uploads');
  assert.equal(h.retryable,true);
});

test('an expired session is not offered a pointless retry',()=>{
  const h=humanError(new Error('JWT expired'));
  assert.equal(h.retryable,false,'retrying will not fix an expired session');
  assert.equal(h.action?.href,'/login');
});

test('a 404 sends the player somewhere real',()=>{
  const h=humanError(new Error('404 not found'));
  assert.equal(h.retryable,false);
  assert.equal(h.action?.href,'/dashboard');
});

test('an unrecognised failure still produces a usable message',()=>{
  const h=humanError(new Error('kaboom'));
  assert.ok(h.title.length>0&&h.body.length>0);
  assert.equal(h.retryable,true);
});

test('handles non-Error values without throwing',()=>{
  for(const value of [null,undefined,42,{},'plain string']){
    assert.doesNotThrow(()=>humanError(value));
    assert.ok(humanError(value).title.length>0);
  }
});

test('never blames the player',()=>{
  const cases=[new Error('riot down'),new Error('database gone'),new Error('kaboom')];
  // Phrases that assign fault. Deliberately not "you did", which appears inside
  // the reassurance "this is not something you did" — a plain substring check
  // cannot tell blame from its own negation.
  const blame=[/\byour fault\b/,/\byou broke\b/,/\byou caused\b/,/\binvalid input\b/,/\byou should have\b/];
  for(const e of cases){
    const text=`${humanError(e).title} ${humanError(e).body}`.toLowerCase();
    for(const pattern of blame){
      assert.doesNotMatch(text,pattern,`blames the player: ${text}`);
    }
  }
});

test('errorKind is a short label, never the raw message',()=>{
  const kind=errorKind(new Error('Riot API returned 503 at https://euw1.api.riotgames.com'));
  assert.ok(kind.length<40);
  assert.doesNotMatch(kind,/https?:\/\//);
  assert.doesNotMatch(kind,/riotgames\.com/);
  assert.equal(errorKind(new Error('kaboom')),'unknown');
});
