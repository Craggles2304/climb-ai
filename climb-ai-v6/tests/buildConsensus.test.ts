import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTrustedConsensus,consensusScoreForItem} from '../lib/buildConsensus';

const source=(source:'U.GG'|'LOLALYTICS'|'OP.GG',items:string[])=>({
  source,
  url:'https://example.test/'+source,
  items,
  patchReported:'26.19',
  sample:12000,
  fetchedAt:'2026-09-24T20:00:00.000Z',
  usable:true,
  note:'Current-patch build evidence',
});

test('trusted build consensus rewards multi-source agreement',()=>{
  const consensus=buildTrustedConsensus({
    patch:'26.19',
    champion:'Aphelios',
    role:'ADC',
    sources:[
      source('U.GG',['The Collector','Infinity Edge',"Lord Dominik's Regards",'Runaan\'s Hurricane']),
      source('LOLALYTICS',['The Collector','Infinity Edge',"Lord Dominik's Regards",'Bloodthirster']),
      source('OP.GG',['The Collector','Infinity Edge',"Lord Dominik's Regards",'Guardian Angel']),
    ],
  });
  assert.equal(consensus.usableSources,3);
  assert.equal(consensus.confidence,'HIGH');
  assert.equal(consensus.items[0].name,'The Collector');
  assert.equal(consensus.items[0].sources.length,3);
  assert.ok(consensusScoreForItem(consensus,'Infinity Edge')>0);
});

test('one source alone cannot influence optimal scoring',()=>{
  const consensus=buildTrustedConsensus({
    patch:'26.19',champion:'Aphelios',role:'ADC',
    sources:[source('U.GG',['The Collector','Infinity Edge'])],
  });
  assert.equal(consensus.usableSources,1);
  assert.equal(consensusScoreForItem(consensus,'The Collector'),0);
});

test('unusable sources are excluded from confidence and consensus',()=>{
  const stale={...source('U.GG',['The Collector','Infinity Edge']),usable:false,note:'Patch mismatch'};
  const consensus=buildTrustedConsensus({
    patch:'26.19',champion:'Aphelios',role:'ADC',
    sources:[stale,source('OP.GG',['The Collector','Infinity Edge'])],
  });
  assert.equal(consensus.usableSources,1);
  assert.equal(consensus.confidence,'LOW');
});
