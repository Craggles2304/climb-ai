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
  const finding=analyzeTftTimeline(timeline).find(f=>f.key==='late-roll');
  expect(finding?.status).toBe('OBSERVED');
});

test('native recorder can prove a roll-down without HP or board capture',()=>{
  const timeline=parseTftTimeline({version:1,source:'local-player',matchId:'native-1',points:[
    {at:'2026-10-06T10:00:00Z',round:'4-1',gold:48,level:7,shopRefreshes:0,purchases:0},
    {at:'2026-10-06T10:00:30Z',round:'4-1',gold:12,level:7,shopRefreshes:8,purchases:3},
  ]});
  const findings=analyzeTftTimeline(timeline);
  expect(findings.find(f=>f.key==='roll-down')?.status).toBe('OBSERVED');
  expect(findings.find(f=>f.key==='shop-commitment')?.status).toBe('OBSERVED');
  expect(findings.find(f=>f.key==='weak-board')?.status).toBe('NOT OBSERVED');
});

test('native recorder can prove level spend from level and gold movement',()=>{
  const timeline=parseTftTimeline({version:1,source:'local-player',matchId:'native-2',points:[
    {at:'2026-10-06T10:00:00Z',round:'3-5',gold:52,level:6},
    {at:'2026-10-06T10:01:00Z',round:'4-1',gold:36,level:7},
  ]});
  const finding=analyzeTftTimeline(timeline).find(f=>f.key==='level-spend');
  expect(finding?.status).toBe('OBSERVED');
  expect(finding?.evidence).toContain('level increased from 6 to 7');
});
