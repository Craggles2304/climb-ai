import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {preferredRiotAccountId} from '../lib/accountSelection';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

test('the same cloud-selected Riot identity restores on any browser',()=>{
  const firstBrowser='a52',otherBrowser='b66',primary='b66';
  assert.equal(preferredRiotAccountId(['a52','b66'],firstBrowser,otherBrowser,primary),'a52');
  assert.equal(preferredRiotAccountId(['a52','b66'],firstBrowser,null,primary),'a52');
});

test('no guest or another user Riot account can become active',()=>{
  const mine=['mine-one','mine-two'];
  assert.equal(preferredRiotAccountId(mine,'some-other-user','stale-guest','mine-two'),'mine-two');
  assert.equal(preferredRiotAccountId(mine,'some-other-user',null,null),'mine-one');
  assert.equal(preferredRiotAccountId([],'some-other-user','guest-id','guest-id'),null);
});

test('account browser hydrates from cloud, never silently imports anonymous profile into signed-in user',()=>{
  const ctx=source('components/AccountContext.tsx');
  assert.match(ctx,/selected_riot_account_id/);
  assert.match(ctx,/preferredRiotAccountId/);
  assert.match(ctx,/client\.from\('profiles'\)\s*\.update\(\{selected_riot_account_id:id\}\)/);
  assert.doesNotMatch(ctx,/if\(!profileRow&&local\)\{/);
  assert.match(ctx,/generation!==hydrationGeneration\.current/);
  assert.match(ctx,/authenticatedUserId\.current!==nextUserId/);
  assert.match(ctx,/runtimeMatches\.clear\(\)/);
});

test('manual onboarding is saved to authenticated Supabase rows, not just one computer',()=>{
  const activation=source('components/ActivationRiotForm.tsx');
  assert.match(activation,/client\.auth\.getUser\(\)/);
  assert.match(activation,/client\.from\('profiles'\)\.upsert\(profileData/);
  assert.match(activation,/client\.from\('riot_accounts'\)\.upsert/);
  assert.doesNotMatch(activation,/saveProfile\(/);
});

test('mission save is held against concurrent cloud refresh and signals failures',()=>{
  const ctx=source('components/LearningPlanContext.tsx');
  assert.match(ctx,/pendingSelection\.current===active\.id/);
  assert.match(ctx,/finally\{\s*if\(pendingSelection\.current===active\.id\)pendingSelection\.current=null/);
  assert.match(ctx,/Your chosen missions were not saved to your account/);
});

test('subscriptions refresh when login identity changes',()=>{
  const ctx=source('components/SubscriptionContext.tsx');
  assert.match(ctx,/auth\.onAuthStateChange/);
  assert.match(ctx,/refreshGeneration\.current/);
});

test('database migration saves account preference separately for each user',()=>{
  const sql=source('supabase/migrations/20261013_account_preference_sync.sql');
  assert.match(sql,/alter table public\.profiles/);
  assert.match(sql,/selected_riot_account_id uuid/);
  assert.match(sql,/references public\.riot_accounts\(id\)/);
  assert.doesNotMatch(sql,/drop table|truncate\s+|delete\s+from/i);
});
