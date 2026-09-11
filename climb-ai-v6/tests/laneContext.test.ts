import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLaneContext} from '../lib/combat/laneContext';

test('enemy minion advantage is surfaced without inventing minion damage',()=>{
  const report=buildLaneContext({wavePosition:'CENTER',yourMinions:3,enemyMinions:6});
  assert.equal(report.facts.minionDelta,-3);
  assert.equal(report.waveNumbers,'THEM');
  assert.ok(report.constraints.some(line=>/enemy wave has 3 more minions/i.test(line)));
  assert.match(report.modelNote,/does not add guessed minion DPS/i);
});

test('your minion advantage is not silently added to champion damage',()=>{
  const report=buildLaneContext({wavePosition:'YOUR_SIDE',yourMinions:7,enemyMinions:4,yourCannon:true});
  assert.equal(report.waveNumbers,'YOU');
  assert.ok(report.constraints.some(line=>/does not add their damage/i.test(line)));
  assert.ok(report.constraints.some(line=>/cannon advantage/i.test(line)));
});

test('enemy tower position explicitly refuses to call the result a dive calculation',()=>{
  const report=buildLaneContext({wavePosition:'THEIR_TOWER',yourMinions:5,enemyMinions:5});
  assert.ok(report.constraints.some(line=>/not a dive calculation/i.test(line)));
  assert.ok(report.constraints.some(line=>/turret shots.*excluded/i.test(line)));
});

test('your tower position does not invent allied turret damage',()=>{
  const report=buildLaneContext({wavePosition:'YOUR_TOWER',yourMinions:4,enemyMinions:7,enemyCannon:true});
  assert.ok(report.constraints.some(line=>/does not add allied turret damage/i.test(line)));
  assert.ok(report.constraints.some(line=>/enemy wave has the cannon advantage/i.test(line)));
});

test('minion counts are clamped to explicit sane bounds',()=>{
  const report=buildLaneContext({wavePosition:'CENTER',yourMinions:-10,enemyMinions:99});
  assert.equal(report.facts.yourMinions,0);
  assert.equal(report.facts.enemyMinions,30);
  assert.equal(report.facts.minionDelta,-30);
});
