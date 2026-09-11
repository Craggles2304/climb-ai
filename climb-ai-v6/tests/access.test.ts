import test from 'node:test';
import assert from 'node:assert/strict';
import {blocksActionForRange,resolveStaticRangeAccess} from '../lib/combat/access';

test('explicit distance inside range is deterministic in-range access',()=>{
  const access=resolveStaticRangeAccess(525,550,'Basic attack');
  assert.equal(access.status,'IN_RANGE');
  assert.equal(blocksActionForRange(access),false);
  assert.match(access.reason,/525u.*550u/i);
});

test('explicit distance outside range blocks the action',()=>{
  const access=resolveStaticRangeAccess(650,550,'Basic attack');
  assert.equal(access.status,'OUT_OF_RANGE');
  assert.equal(blocksActionForRange(access),true);
  assert.match(access.reason,/outside/i);
});

test('missing distance stays unknown rather than being guessed',()=>{
  const access=resolveStaticRangeAccess(undefined,550,'Basic attack');
  assert.equal(access.status,'UNKNOWN');
  assert.equal(blocksActionForRange(access),false);
  assert.match(access.reason,/not inferred/i);
});

test('missing or zero spell range stays unknown even with an explicit distance',()=>{
  assert.equal(resolveStaticRangeAccess(400,null,'Spell').status,'UNKNOWN');
  assert.equal(resolveStaticRangeAccess(400,0,'Spell').status,'UNKNOWN');
});

test('range boundary counts as reachable',()=>{
  assert.equal(resolveStaticRangeAccess(600,600,'Spell').status,'IN_RANGE');
});
