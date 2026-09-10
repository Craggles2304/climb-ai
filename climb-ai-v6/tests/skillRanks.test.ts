import test from 'node:test';
import assert from 'node:assert/strict';
import {
  legalDefaultRanks,normaliseStandardRanks,maxRankAtLevel,
} from '../lib/combat/skillRanks';

test('level 1 fallback spends exactly one skill point and has no ultimate',()=>{
  assert.deepEqual(legalDefaultRanks(1),{Q:1,W:0,E:0,R:0});
});

test('standard fallback spends exactly one point per champion level',()=>{
  for(let level=1;level<=18;level++){
    const ranks=legalDefaultRanks(level);
    assert.equal(ranks.Q+ranks.W+ranks.E+ranks.R,level);
  }
});

test('ultimate unlocks only at levels 6, 11 and 16',()=>{
  assert.equal(legalDefaultRanks(5).R,0);
  assert.equal(legalDefaultRanks(6).R,1);
  assert.equal(legalDefaultRanks(10).R,1);
  assert.equal(legalDefaultRanks(11).R,2);
  assert.equal(legalDefaultRanks(15).R,2);
  assert.equal(legalDefaultRanks(16).R,3);
});

test('normalisation clamps individually impossible ranks and excess points',()=>{
  const ranks=normaliseStandardRanks({Q:5,W:5,E:5,R:3},6);
  assert.ok(ranks.Q<=3&&ranks.W<=3&&ranks.E<=3);
  assert.ok(ranks.R<=1);
  assert.ok(ranks.Q+ranks.W+ranks.E+ranks.R<=6);
});

test('rank caps follow normal basic and ultimate unlock rules',()=>{
  assert.equal(maxRankAtLevel('Q',1),1);
  assert.equal(maxRankAtLevel('Q',4),2);
  assert.equal(maxRankAtLevel('Q',9),5);
  assert.equal(maxRankAtLevel('R',5),0);
  assert.equal(maxRankAtLevel('R',6),1);
  assert.equal(maxRankAtLevel('R',11),2);
  assert.equal(maxRankAtLevel('R',16),3);
});
