import test from 'node:test';
import assert from 'node:assert/strict';
import {decideAccess,isProtected,isAdminRoute,isAuthPage,PROTECTED_PREFIXES,isUnreachable} from '../lib/auth/config';

const decide=(over:Partial<Parameters<typeof decideAccess>[0]>={})=>decideAccess({
  path:'/dashboard',configured:true,signedIn:false,isAdmin:false,demoMode:false,...over,
});

test('route classification does not match on prefix collisions',()=>{
  assert.equal(isProtected('/account'),true);
  assert.equal(isProtected('/account/settings'),true);
  assert.equal(isProtected('/accounts-of-other-people'),false,'must match a path segment, not a substring');
  assert.equal(isAdminRoute('/admin'),true);
  assert.equal(isAdminRoute('/administrator'),false);
  assert.equal(isAuthPage('/login'),true);
  assert.equal(isProtected('/'),false);
  assert.equal(isProtected('/pricing'),false,'pricing must stay public');
  assert.equal(isProtected('/privacy'),false,'legal pages must stay public');
  assert.equal(isProtected('/terms'),false);
});

test('with auth unconfigured every route stays open',()=>{
  for(const path of [...PROTECTED_PREFIXES,'/','/login']){
    assert.equal(
      decide({path,configured:false,demoMode:true}).action,'ALLOW',
      `${path} should stay usable in demo mode`,
    );
  }
});

test('a signed-out visitor is sent to login from a protected route',()=>{
  const d=decide({path:'/ilp'});
  assert.equal(d.action,'REDIRECT');
  assert.equal(d.action==='REDIRECT'&&d.to,'/login');
});

test('a signed-in user reaches protected routes',()=>{
  assert.equal(decide({path:'/ilp',signedIn:true}).action,'ALLOW');
});

test('a signed-in user is bounced off the login page',()=>{
  const d=decide({path:'/login',signedIn:true});
  assert.equal(d.action,'REDIRECT');
  assert.equal(d.action==='REDIRECT'&&d.to,'/dashboard');
});

test('public routes stay public for everyone',()=>{
  for(const path of ['/','/pricing','/privacy','/terms']){
    assert.equal(decide({path}).action,'ALLOW',`${path} must not require sign-in`);
  }
});

test('admin needs sign-in once auth exists, even in demo mode',()=>{
  const d=decide({path:'/admin',demoMode:true});
  assert.equal(d.action,'REDIRECT');
  assert.equal(d.action==='REDIRECT'&&d.to,'/login');
});

test('a signed-in non-admin cannot reach admin',()=>{
  const d=decide({path:'/admin',signedIn:true,isAdmin:false});
  assert.equal(d.action,'REDIRECT');
  assert.equal(d.action==='REDIRECT'&&d.to,'/dashboard');
});

test('an admin reaches admin',()=>{
  assert.equal(decide({path:'/admin',signedIn:true,isAdmin:true}).action,'ALLOW');
});

test('the legacy demo admin cookie still works while auth is unconfigured',()=>{
  assert.equal(decide({path:'/admin',configured:false,demoMode:true,isAdmin:true}).action,'ALLOW');
});

test('admin is not exposed by an unconfigured non-demo deployment',()=>{
  // Auth off and demo off is a misconfiguration; it must fail closed, not open.
  const d=decide({path:'/admin',configured:false,demoMode:false,isAdmin:false});
  assert.equal(d.action,'REDIRECT');
});

/* --- paused free-tier database: configured but unreachable --- */

const base={configured:true,signedIn:false,isAdmin:false,demoMode:false};

test('a paused database does not lock everyone out of the app',()=>{
  // Free-tier Supabase pauses after a week of inactivity. Before this, the
  // session read failed, signedIn became false, and every protected route
  // redirected to a /login page that could not work either.
  for(const path of ['/dashboard','/ilp','/analyse','/progress','/settings']){
    const decision=decideAccess({...base,path,authReachable:false});
    assert.equal(decision.action,'ALLOW',`${path} stays reachable`);
  }
});

test('a paused database does not block features that never used it',()=>{
  // /champions and /matchups are computed from Riot's public CDN. Gating them
  // behind a database they do not touch is the worst version of this bug.
  for(const path of ['/champions','/champions/main','/matchups']){
    assert.equal(decideAccess({...base,path,authReachable:false}).action,'ALLOW');
  }
});

test('admin still fails closed when auth cannot be verified',()=>{
  // Everything else degrades open; admin must not, because it shows aggregate
  // data belonging to other people.
  const decision=decideAccess({...base,path:'/admin',authReachable:false});
  assert.equal(decision.action,'REDIRECT');
  assert.match(decision.reason,/unreachable/i);
});

test('an admin who really is signed in is still refused while auth is down',()=>{
  const decision=decideAccess({
    ...base,path:'/admin',signedIn:true,isAdmin:true,authReachable:false,
  });
  assert.equal(decision.action,'REDIRECT','cannot trust a claim it cannot check');
});

test('a reachable database still enforces sign-in normally',()=>{
  assert.equal(decideAccess({...base,path:'/dashboard'}).action,'REDIRECT');
  assert.equal(decideAccess({...base,path:'/dashboard',authReachable:true}).action,'REDIRECT');
  assert.equal(
    decideAccess({...base,path:'/dashboard',signedIn:true}).action,'ALLOW');
});

test('authReachable defaults to true so existing callers are unchanged',()=>{
  const withoutFlag=decideAccess({...base,path:'/dashboard'});
  const withFlag=decideAccess({...base,path:'/dashboard',authReachable:true});
  assert.deepEqual(withoutFlag,withFlag);
});

/* --- telling an outage apart from a signed-out visitor --- */

test('401 and 403 are answers, not outages',()=>{
  assert.equal(isUnreachable({status:401,message:'Invalid JWT'}),false);
  assert.equal(isUnreachable({status:403,message:'Forbidden'}),false);
});

test('gateway and network failures are outages',()=>{
  for(const err of [
    {status:503,message:'Service Unavailable'},
    {status:502,message:'Bad Gateway'},
    {message:'TypeError: fetch failed'},
    {name:'FetchError',message:'request to https://x.supabase.co failed, reason: ECONNREFUSED'},
    {message:'getaddrinfo ENOTFOUND db.abc.supabase.co'},
    {message:'Project is paused'},
  ])assert.equal(isUnreachable(err),true,JSON.stringify(err));
});

test('a missing or empty error is not an outage',()=>{
  assert.equal(isUnreachable(null),false);
  assert.equal(isUnreachable(undefined),false);
  assert.equal(isUnreachable({}),false);
});

/* --- public reference pages --- */

test('champion and matchup pages need no account at all',()=>{
  // They are computed entirely from Riot's public CDN. Protecting them locked
  // visitors out of the only part of the app that works with no database.
  for(const path of ['/champions','/champions/Caitlyn','/champions/main','/matchups']){
    assert.equal(isProtected(path),false,`${path} is public`);
    assert.equal(
      decideAccess({...base,path}).action,'ALLOW',
      `${path} is reachable without signing in`);
  }
});

test('pages holding the player\'s own data still require an account',()=>{
  for(const path of ['/dashboard','/ilp','/analyse','/progress','/settings','/account','/live']){
    assert.equal(isProtected(path),true,`${path} stays protected`);
    assert.equal(decideAccess({...base,path}).action,'REDIRECT');
  }
});

test('admin is still not public',()=>{
  assert.equal(decideAccess({...base,path:'/admin'}).action,'REDIRECT');
});
