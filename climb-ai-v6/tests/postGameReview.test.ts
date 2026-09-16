import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPostGameSections,type FightReview} from '../lib/postGameReview';

const strength:FightReview={
  atSeconds:620,
  category:'STRENGTH',
  outcome:'KILL',
  score:18,
  verdict:'YOU_STRONGER',
  headline:'Converted lead',
  summary:'You used the item and level edge before the opponent could reset.',
  betterDecision:[],
  evidence:{currentGold:480,itemGoldDelta:1250,levelDelta:1},
};

const weakness:FightReview={
  atSeconds:910,
  category:'WEAKNESS',
  outcome:'DEATH',
  score:-22,
  verdict:'YOU_STRONGER',
  headline:'Gave back lead',
  summary:'You chased after the clean window had ended.',
  betterDecision:['Take the won trade, push the wave and reset instead of extending the chase.'],
  evidence:{currentGold:900,itemGoldDelta:1400,levelDelta:1},
};

test('always returns the 3 done well + 3 improve + 2 neutral contract without inventing evidence',()=>{
  const review=buildPostGameSections({
    fights:[strength,weakness],
    match:{champion:'Hecarim',role:'JUNGLE',durationSeconds:1885,kda:'7 / 4 / 9',csPerMin:6.4},
    partial:false,
    detailLimit:145,
  });

  assert.equal(review.doneWell.length,3);
  assert.equal(review.improve.length,3);
  assert.equal(review.neutral.length,2);
  assert.equal(review.doneWell[0].verified,true);
  assert.equal(review.doneWell[1].verified,false);
  assert.match(review.doneWell[1].detail,/will not invent praise/i);
  assert.equal(review.improve[0].verified,true);
  assert.equal(review.improve[1].verified,false);
  assert.match(review.neutral[0].detail,/Hecarim/);
  assert.match(review.neutral[1].detail,/2 timestamped fight decisions/i);
});

test('uses the strongest verified weakness for the next-game focus',()=>{
  const review=buildPostGameSections({
    fights:[weakness],
    match:null,
    partial:true,
    detailLimit:145,
  });

  assert.equal(review.nextFocus.title,'PROTECT THE ADVANTAGE');
  assert.match(review.nextFocus.rule,/push the wave and reset/i);
  assert.match(review.neutral[1].detail,/partial recording/i);
});
