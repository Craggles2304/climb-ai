import test from 'node:test';
import assert from 'node:assert/strict';
import {abilityRanksFromSequence,comboSnapshot,mitigate} from '../lib/champions/damageLab';

test('ability ranks follow the supplied level-by-level sequence',()=>{
  const ranks=abilityRanksFromSequence(['W','Q','E','Q','Q','R','Q','W','Q'],9);
  assert.deepEqual(ranks,{Q:5,W:2,E:1,R:1});
});

test('physical and magic damage respect target resistances',()=>{
  const target={hp:2000,armor:100,magicResist:50};
  assert.equal(mitigate(1000,'PHYSICAL_DAMAGE',target),500);
  assert.equal(mitigate(900,'MAGIC_DAMAGE',target),600);
  assert.equal(mitigate(777,'TRUE_DAMAGE',target),777);
});

test('combo snapshot reports post mitigation target hp percentage',()=>{
  const target={hp:2000,armor:100,magicResist:50};
  const result=comboSnapshot(
    ['Q','W'],
    {
      Q:{raw:1000,damageType:'PHYSICAL_DAMAGE'},
      W:{raw:900,damageType:'MAGIC_DAMAGE'},
    },
    target,
  );
  assert.equal(result.raw,1900);
  assert.equal(result.postMitigation,1100);
  assert.equal(result.percentHp,55);
});
