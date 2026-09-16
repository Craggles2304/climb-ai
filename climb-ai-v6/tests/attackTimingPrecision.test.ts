import test from 'node:test';
import assert from 'node:assert/strict';
import {basicAttackHitTiming} from '../lib/combat/attackTiming';
import type {AutoAttackModel} from '../lib/combat/combos';

const galio:AutoAttackModel={
  damage:100,
  attackSpeed:1,
  eventState:{attackTiming:{championId:'galio',patch:'16.18.1',windupPercent:.20625}},
};

test('Galio empowered windup remains the exact 165ms boundary used by all simulators',()=>{
  const timing=basicAttackHitTiming(galio,0,1,.25);
  assert.equal(timing.windupSeconds,.165);
  assert.equal(timing.hitsAt,.165);
});

test('adding an attack start preserves the exact decimal boundary',()=>{
  const timing=basicAttackHitTiming(galio,1,1,.25);
  assert.equal(timing.hitsAt,1.165);
});
