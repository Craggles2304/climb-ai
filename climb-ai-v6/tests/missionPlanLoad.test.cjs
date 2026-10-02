const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const context=fs.readFileSync('components/LearningPlanContext.tsx','utf8');
const ilp=fs.readFileSync('app/ilp/page.tsx','utf8');
const route=fs.readFileSync('app/api/ilp/plan/route.ts','utf8');

test('mission plan loads through authenticated server route',()=>{
  assert.ok(route.includes("getCurrentUser"));
  assert.ok(route.includes("eq('user_id',user.id)"));
  assert.ok(route.includes("from('ilp_tasks')"));
  assert.ok(context.includes("/api/ilp/plan?accountId="));
  assert.ok(context.includes('loadCloudRows(active.id)'));
});

test('My Climb never treats plan loading as zero active missions',()=>{
  assert.ok(context.includes('planReady'));
  assert.ok(context.includes('planError'));
  assert.ok(ilp.includes('LOADING YOUR PLAN'));
  assert.ok(ilp.includes('Your plan is still stored.'));
  assert.ok(ilp.indexOf('!planReady')<ilp.indexOf('!baselineReady'));
});

test('opening the mission plan can materialise a deferred local-first match once',()=>{
  assert.ok(route.includes('materializeDeferredLocalMatch(user.id,accountId)'));
});