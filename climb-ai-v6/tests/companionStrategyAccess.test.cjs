const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'app','api','live','champion-plan','route-core.ts'),'utf8');
const wrapper=fs.readFileSync(path.join(root,'app','api','live','champion-plan','route.ts'),'utf8');
const team=fs.readFileSync(path.join(root,'lib','champions','teamCompPlan.ts'),'utf8');
const preload=fs.readFileSync(path.join(root,'companion','electron','preload.cjs'),'utf8');

test('team comp model exposes one first-class actionable win condition',()=>{
  assert.match(team,/ourWinCondition:string/);
  assert.match(team,/roleWinCondition:RoleWinCondition/);
  assert.match(team,/ourWinCondition:roleWinCondition\.summary/);
  assert.ok(team.includes('YOUR ADC WIN CONDITION'));
  assert.ok(team.includes('YOUR JUNGLE WIN CONDITION'));
  assert.ok(team.includes('YOUR TOP WIN CONDITION'));
  assert.ok(team.includes('YOUR MID WIN CONDITION'));
  assert.ok(team.includes('YOUR SUPPORT WIN CONDITION'));
  assert.ok(team.includes("step('CONVERT','CONVERT'"));
});

test('server removes paid win and loss conditions for FREE users while allowing the simple recording HUD',()=>{
  assert.match(route,/strategyAccess\.paidStrategy/);
  assert.match(route,/ourWinCondition:null,roleWinCondition:null,theirWinCondition:null,biggestThrow:null,compositionRead:null/);
  assert.match(route,/hasTier\(tier,'PLUS'\)/);
  assert.ok(wrapper.includes('rememberPlan:remember'));
  assert.ok(wrapper.includes("rememberPlanAccess:paid?'FULL':'SIMPLE'"));
});

test('PRO alone receives the deep composition interaction graph',()=>{
  assert.ok(route.includes("const deepStrategy=hasTier(tier,'PRO')"));
  assert.ok(route.includes('strategyAccess.deepStrategy'));
  assert.ok(route.includes('compositionRead:null'));
  assert.ok(preload.includes('WHY THIS PLAN WORKS +'));
  assert.ok(preload.includes("Boolean(access?.deepStrategy)&&renderDeepRead(team,set)"));
  assert.match(preload,/toggle\('opDeepRead',!hasDeep\)/);
});

test('active trial entitlement receives paid match strategy',()=>{
  assert.ok(route.includes("['active','trialing'].includes(status)"));
  assert.ok(route.includes("trialing:paidStrategy&&status==='trialing'"));
});

test('Companion keeps a simple free plan while paid match read exposes a compact win path',()=>{
  assert.ok(preload.includes('YOUR SIMPLE GAME PLAN'));
  assert.ok(preload.includes('PLUS MATCH READ'));
  assert.ok(preload.includes('WIN CONDITION'));
  assert.ok(preload.includes('THEY WANT'));
  assert.ok(preload.includes("DON'T"));
  assert.ok(preload.includes('opRoleWin'));
  assert.ok(preload.includes('opBiggestThrow'));
  assert.match(preload,/toggle\('opPaidWin',!paid\)/);
  assert.match(preload,/toggle\('opPaidLoss',!paid\)/);
  assert.match(preload,/toggle\('opBiggestThrowCard',!paid\)/);
  assert.match(preload,/toggle\('opSimpleFlow',hasRoleWin\)/);
});


test('subscription badge never falls back to player Elo as a membership plan',()=>{
  const renderer=fs.readFileSync(path.join(root,'companion','electron','renderer.js'),'utf8');
  const review=fs.readFileSync(path.join(root,'companion','electron','review-v2-core.js'),'utf8');
  const plan=fs.readFileSync(path.join(root,'app','api','live','champion-plan','route-core.ts'),'utf8');
  assert.match(renderer,/function companionCoachBadge\(state\)/);
  assert.match(renderer,/strategyAccess\?\.tier\|\|state\?\.playerHome\?\.tier/);
  assert.doesNotMatch(renderer,/activeCoachLevel\.tier\?\x60/);
  assert.doesNotMatch(preload,/access\?\.tier\|\|team\?\.coachLevel\?\.tier/);
  assert.match(review,/const planTier=clean\(state\?\.teamPlan\?\.strategyAccess\?\.tier/);
  assert.match(plan,/return String\(profileResult\?\.data\?\.rank\|\|'UNRANKED'\)/);
});
