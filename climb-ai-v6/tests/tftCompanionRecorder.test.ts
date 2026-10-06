import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const recorder=require('../companion/electron/tft-recorder.cjs');

test('TFT recorder parses only local board/shop evidence into compact metrics',()=>{
  const board=recorder.pieceRows(JSON.stringify({
    cell_9:{name:'TFT_Tristana',level:'2',item_1:'TFT_Item_GuinsoosRageblade',item_2:'',item_3:''},
    cell_16:{name:'TFT_KhaZix',level:'1',item_1:'',item_2:'',item_3:''},
  }));
  assert.equal(board.length,2);
  assert.equal(recorder.boardPower(board),6);
  assert.equal(recorder.roundValue('PVP Stage 4-2'),'4-2');

  const before=recorder.shopRows(JSON.stringify({slot_1:{name:'TFT_A'},slot_2:{name:'TFT_B'}}));
  const after=recorder.shopRows(JSON.stringify({slot_1:{name:'Sold'},slot_2:{name:'TFT_B'}}));
  assert.equal(recorder.soldCount(before,after),1);
  assert.deepEqual(recorder.FEATURES,['game_info','me','match_info','store','board','bench']);
  assert.equal(recorder.FEATURES.includes('roster'),false);
  assert.equal(recorder.FEATURES.includes('augments'),false);
  assert.equal(recorder.FEATURES.includes('match_stats'),false);
});
