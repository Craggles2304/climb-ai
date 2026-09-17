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
  assert.match(team,/ourWinCondition:ourWinCondition\(/);
  assert.ok(team.includes('TURN THE FIRST CLEAN ADVANTAGE INTO THE NEXT OBJECTIVE'));
  assert.ok(team.includes('CONVERT THE KILL INTO THE OBJECTIVE'));
  assert.ok(team.includes('TAKE THE OBJECTIVE INSTEAD OF CHASING'));
});

test('server removes win and loss conditions for FREE users',()=>{
  assert.match(route,/strategyAccess\.paidStrategy/);
  assert.match(route,/ourWinCondition:null,theirWinCondition:null,biggestThrow:null/);
  assert.match(route,/hasTier\(tier,'PLUS'\)/);
});

test('active trial entitlement receives paid match strategy',()=>{
  assert.ok(route.includes("['active','trialing'].includes(status)"));
  assert.ok(route.includes("trialing:paidStrategy&&status==='trialing'"));
});

test('Companion keeps simple plan visible while paid match read is gated',()=>{
  assert.ok(preload.includes('YOUR SIMPLE GAME PLAN'));
  assert.ok(preload.includes('PLUS MATCH READ'));
  assert.ok(preload.includes('OUR WIN CONDITION'));
  assert.ok(preload.includes('THEY WIN IF'));
  assert.match(preload,/toggle\('opPaidWin',!paid\)/);
  assert.match(preload,/toggle\('opPaidLoss',!paid\)/);
});
