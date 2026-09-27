const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const context=fs.readFileSync('components/LearningPlanContext.tsx','utf8');
const missions=fs.readFileSync('app/missions/page.tsx','utf8');
const route=fs.readFileSync('app/api/ilp/plan/route.ts','utf8');

test('mission plan loads through authenticated server route',()=>{
  assert.ok(route.includes("getCurrentUser"));
  assert.ok(route.includes("eq('user_id',user.id)"));
  assert.ok(route.includes("from('ilp_tasks')"));
  assert.ok(context.includes("/api/ilp/plan?accountId="));
  assert.ok(context.includes('loadCloudRows(active.id)'));
});

test('mission page never treats plan loading as zero active missions',()=>{
  assert.ok(context.includes('planReady'));
  assert.ok(context.includes('planError'));
  assert.ok(missions.includes('LOADING YOUR PLAN'));
  assert.ok(missions.includes('Your missions are still stored.'));
  assert.ok(missions.indexOf('!planReady')<missions.indexOf('activeThree.length===0'));
});

test('opening the mission plan can materialise a deferred local-first match once',()=>{
  assert.ok(route.includes('materializeDeferredLocalMatch(user.id,accountId)'));
});
