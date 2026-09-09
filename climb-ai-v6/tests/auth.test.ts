import test from 'node:test';
import assert from 'node:assert/strict';
import {decideAccess,isProtected,isAdminRoute,isAuthPage,PROTECTED_PREFIXES} from '../lib/auth/config';

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
