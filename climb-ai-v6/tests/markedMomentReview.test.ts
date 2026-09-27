import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewMarkedMoments} from '../lib/markedMomentReview';

test('player marks are paired only with nearby recorded review evidence',()=>{
  const moments=reviewMarkedMoments(
    [{gameSeconds:601},{gameSeconds:1200},{gameSeconds:1900}],
    [{atSeconds:620,headline:'A recorded fight began here.'}],
    [{atSeconds:1190,comparisonReason:'The recorded decision was reviewed.'}],
    1800,
  );
  assert.deepEqual(moments,[
    {atSeconds:601,status:'MATCHED',detail:'A recorded fight began here.'},
    {atSeconds:1200,status:'MATCHED',detail:'The recorded decision was reviewed.'},
  ]);
});

test('a mark without nearby evidence remains visible without a coaching verdict',()=>{
  assert.deepEqual(reviewMarkedMoments([{gameSeconds:500}],[],[{atSeconds:600,comparisonReason:'Too far away.'}],1200),[
    {atSeconds:500,status:'NO_EVIDENCE',detail:'No nearby review evidence was captured for this moment.'},
  ]);
});
