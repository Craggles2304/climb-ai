import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Founding Beta invite storage never persists the plaintext token',()=>{
  const migration=fs.readFileSync('supabase/migrations/20260923090000_stage7_controlled_beta_cohort.sql','utf8');
  const repo=fs.readFileSync('lib/server/betaCohortRepository.ts','utf8');
  assert.ok(migration.includes('token_hash text not null unique'));
  assert.ok(!migration.includes('token text'));
  assert.ok(repo.includes("createHash('sha256')"));
  assert.ok(repo.includes("randomBytes(24).toString('base64url')"));
  assert.ok(repo.includes('token_hash:hash(token)'));
});

test('beta invite claim is one-time, email-lockable, atomic and service-role-only',()=>{
  const migration=fs.readFileSync('supabase/migrations/20260923090000_stage7_controlled_beta_cohort.sql','utf8');
  assert.ok(migration.includes('for update'));
  assert.ok(migration.includes("v_invite.status<>'PENDING'"));
  assert.ok(migration.includes("raise exception 'INVITE_EMAIL_MISMATCH'"));
  assert.ok(migration.includes("set status='CLAIMED',claimed_by=p_user_id,claimed_at=now()"));
  assert.ok(migration.includes('revoke all on function public.claim_beta_invite(text,uuid,text) from public, anon, authenticated'));
  assert.ok(migration.includes('grant execute on function public.claim_beta_invite(text,uuid,text) to service_role'));
});

test('Founding Beta remains capped and does not replace the public signup funnel',()=>{
  const repository=fs.readFileSync('lib/server/betaCohortRepository.ts','utf8');
  const signup=fs.readFileSync('app/signup/page.tsx','utf8');
  assert.ok(repository.includes('FOUNDING_BETA_CAP=25'));
  assert.ok(repository.includes('Founding Beta is at the 25-slot cap.'));
  assert.ok(signup.includes("return token&&/^[A-Za-z0-9_-]{20,160}$/.test(token)"));
  assert.ok(signup.includes(":'/onboarding'"));
  assert.ok(signup.includes('authService.signUp(email,password,next)'));
  assert.ok(signup.includes('authService.signInWithGoogle(betaNext())'));
});

test('invite journey survives auth and only authenticated users can claim',()=>{
  const join=fs.readFileSync('components/BetaInviteClaim.tsx','utf8');
  const claim=fs.readFileSync('app/api/beta/claim/route.ts','utf8');
  const auth=fs.readFileSync('lib/services/authService.ts','utf8');
  assert.ok(join.includes('/signup?beta='));
  assert.ok(join.includes('/login?next='));
  assert.ok(join.includes("track('beta_invite_claimed'"));
  assert.ok(claim.includes('getCurrentUser'));
  assert.ok(claim.includes("status:401"));
  assert.ok(auth.includes("emailRedirectTo:authCallback(safeNext(redirectTo||'/onboarding'))"));
});

test('only active controlled-beta testers can submit build-linked reports',()=>{
  const repository=fs.readFileSync('lib/server/betaCohortRepository.ts','utf8');
  const route=fs.readFileSync('app/api/beta/report/route.ts','utf8');
  const reporter=fs.readFileSync('components/BetaReporter.tsx','utf8');
  assert.ok(repository.includes("tester.status!=='ACTIVE'"));
  assert.ok(repository.includes('VERCEL_GIT_COMMIT_SHA'));
  assert.ok(repository.includes('RELEASE_MANIFEST.webVersion'));
  assert.ok(route.includes("kind:z.enum(['BUG','FRICTION','COACHING'])"));
  assert.ok(route.includes("severity:z.enum(['BLOCKER','HIGH','MEDIUM','LOW'])"));
  assert.ok(reporter.includes("tester?.status!=='ACTIVE'"));
  assert.ok(reporter.includes("track('beta_report_submitted'"));
});

test('beta cohort tables are server-only with RLS and explicit deny policies',()=>{
  const migration=fs.readFileSync('supabase/migrations/20260923090000_stage7_controlled_beta_cohort.sql','utf8');
  for(const table of ['beta_invites','beta_testers','beta_reports']){
    assert.ok(migration.includes('alter table public.'+table+' enable row level security'));
    assert.ok(migration.includes('revoke all on table public.'+table+' from anon, authenticated'));
    assert.ok(migration.includes(table+'_no_client_access'));
  }
});

test('founder admin exposes cohort slots, invite ledger, testers and report triage',()=>{
  const admin=fs.readFileSync('app/admin/page.tsx','utf8');
  const console=fs.readFileSync('components/BetaCohortConsole.tsx','utf8');
  const api=fs.readFileSync('app/api/admin/beta-cohort/route.ts','utf8');
  assert.ok(admin.includes('getBetaCohortAdminSnapshot'));
  assert.ok(admin.includes('<BetaCohortConsole snapshot={cohort}/>'));
  assert.ok(console.includes('STAGE 7 · CONTROLLED FOUNDING BETA'));
  assert.ok(console.includes('CREATE ONE-TIME INVITE'));
  assert.ok(console.includes('ACTIVE TESTERS'));
  assert.ok(console.includes('BETA REPORT TRIAGE'));
  assert.ok(api.includes("select('is_founder')"));
  assert.ok(api.includes('CREATE_INVITE'));
  assert.ok(api.includes('REVOKE_INVITE'));
  assert.ok(api.includes('UPDATE_REPORT'));
});
