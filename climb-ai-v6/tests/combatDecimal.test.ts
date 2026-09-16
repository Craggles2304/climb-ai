import test from 'node:test';
import assert from 'node:assert/strict';
import {roundCombat} from '../lib/combat/decimal';

test('combat rounding is stable on decimal half-boundaries',()=>{
  const galioWindup=.20625/1.25;
  assert.ok(galioWindup<.165,'fixture should expose the binary floating-point edge');
  assert.equal(roundCombat(galioWindup),.17);
  assert.equal(roundCombat(1+galioWindup),1.17);
});

test('combat rounding does not promote values materially below a boundary',()=>{
  assert.equal(roundCombat(.1649),.16);
  assert.equal(roundCombat(1.1649),1.16);
  assert.equal(roundCombat(12.3451),12.35);
});
