const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'app','api','live','champion-plan','route.ts'),'utf8');
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

test('server removes win and loss conditions for FREE users',()=>{
  assert.match(route,/strategyAccess\.paidStrategy/);
  assert.match(route,/ourWinCondition:null,roleWinCondition:null,theirWinCondition:null,biggestThrow:null,compositionRead:null/);
  assert.match(route,/hasTier\(tier,'PLUS'\)/);
});

test('PRO alone receives the deep composition interaction graph',()=>{
  assert.ok(route.includes("const deepStrategy=hasTier(tier,'PRO')"));
  assert.ok(route.includes('strategyAccess.deepStrategy'));
  assert.ok(route.includes('compositionRead:null'));
  assert.ok(preload.includes('PRO · WHY THIS PLAN WORKS'));
  assert.ok(preload.includes("Boolean(access?.deepStrategy)&&renderDeepRead(team,set)"));
  assert.match(preload,/toggle\('opDeepRead',!hasDeep\)/);
});

test('active trial entitlement receives paid match strategy',()=>{
  assert.ok(route.includes("['active','trialing'].includes(status)"));
  assert.ok(route.includes("trialing:paidStrategy&&status==='trialing'"));
});

test('Companion keeps simple plan visible while paid structured match read is gated',()=>{
  assert.ok(preload.includes('YOUR SIMPLE GAME PLAN'));
  assert.ok(preload.includes('PLUS MATCH READ'));
  assert.ok(preload.includes('OUR WIN CONDITION'));
  assert.ok(preload.includes('THEY WIN IF'));
  assert.ok(preload.includes('opRoleWin'));
  assert.match(preload,/toggle\('opPaidWin',!paid\|\|hasRoleWin\)/);
  assert.match(preload,/toggle\('opPaidLoss',!paid\)/);
  assert.match(preload,/toggle\('opSimpleFlow',hasRoleWin\)/);
});
