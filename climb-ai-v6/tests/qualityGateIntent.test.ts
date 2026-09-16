import test from 'node:test';
import assert from 'node:assert/strict';
import {roundCombat} from '../lib/combat/decimal';

test('quality gate uses conventional half-up combat timestamp rounding',()=>{
  assert.equal(roundCombat(.165),.17);
});
