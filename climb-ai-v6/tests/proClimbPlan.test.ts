import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('PRO Climb Plan is a first-class navigation destination',()=>{
  const shell=fs.readFileSync('components/AppShell.tsx','utf8');
  const page=fs.readFileSync('app/progress/page.tsx','utf8');
  assert.match(shell,/Climb Plan','\/progress'/);
  assert.match(shell,/MY CLIMB PLAN/);
  assert.match(page,/MY CLIMB PLAN/);
  assert.match(page,/Your route/);
  assert.match(page,/Before your next game/);
  assert.match(page,/How you pass it/);
  assert.match(page,/Your 6 DNA strands/);
  assert.match(page,/What keeps repeating/);
});

test('Climb Plan is split into sub-heading tabs instead of one long scroll',()=>{
  const page=fs.readFileSync('app/progress/page.tsx','utf8');
  assert.match(page,/role="tablist"/);
  for(const id of ['plan','skill','progress','mistakes','games','deep'])assert.match(page,new RegExp(`tab==='${id}'`));
});

test('Climb Plan API exposes pass steps and a plain-English pass mark',()=>{
  const route=fs.readFileSync('app/api/climb-plan/route.ts','utf8');
  assert.match(route,/gates:\(contract\?\.gates/);
  assert.match(route,/plainSuccess/);
});

test('Climb Plan API is PRO-only and history-driven',()=>{
  const route=fs.readFileSync('app/api/climb-plan/route.ts','utf8');
  assert.match(route,/requireLeagueTier\(user\.id,'PRO'\)/);
  assert.match(route,/op_match_analysis/);
  assert.match(route,/buildDecisionTwinV2/);
  assert.match(route,/buildScenarioMemory/);
  assert.match(route,/buildDecisionTransfer/);
  assert.match(route,/buildClimbCurriculum/);
  assert.match(route,/reconstruction/);
  assert.match(route,/leakSignals/);
  assert.match(route,/DNA_DOMAINS/);
});

test('Climb Plan preserves the evidence boundary',()=>{
  const route=fs.readFileSync('app/api/climb-plan/route.ts','utf8');
  assert.match(route,/NOT OBSERVED is neutral/);
  assert.match(route,/single good or bad game cannot define the player/);
});
