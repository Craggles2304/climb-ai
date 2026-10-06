import {test,expect} from 'vitest';
import {analyzeTftTimeline,parseTftTimeline} from '../lib/tft/timeline';

test('unsupported decisions remain NOT OBSERVED',()=>{
  const timeline=parseTftTimeline({version:1,source:'local-player',matchId:'EUW1_123',points:[{at:'2026-10-06T10:00:00Z',round:'2-1',gold:30}]});
  expect(analyzeTftTimeline(timeline).every(f=>f.status==='NOT OBSERVED')).toBe(true);
});

test('late stabilisation requires health, economy and later refresh evidence',()=>{
  const timeline=parseTftTimeline({version:1,source:'local-player',matchId:'EUW1_123',points:[
    {at:'2026-10-06T10:00:00Z',round:'3-3',hp:62,gold:48},
    {at:'2026-10-06T10:01:00Z',round:'3-5',hp:43,gold:52},
    {at:'2026-10-06T10:02:00Z',round:'4-1',hp:21,gold:45,shopRefreshes:3},
  ]});
  expect(analyzeTftTimeline(timeline)[0].status).toBe('OBSERVED');
});
