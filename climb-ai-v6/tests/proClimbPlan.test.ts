import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('PRO Climb Plan is a first-class navigation destination',()=>{
  const shell=fs.readFileSync('components/AppShell.tsx','utf8');
  const page=fs.readFileSync('app/progress/page.tsx','utf8');
  assert.match(shell,/Climb Plan','\/progress'/);
  assert.match(shell,/MY CLIMB PLAN/);
  assert.match(page,/WHAT SHOULD I DO NOW\?/);
  assert.match(page,/YOUR WHOLE GAME DNA/);
  assert.match(page,/CRITICAL PATTERNS/);
  assert.match(page,/YOUR HISTORY, CONNECTED/);
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
