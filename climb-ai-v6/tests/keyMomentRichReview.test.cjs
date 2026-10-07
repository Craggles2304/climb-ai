const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const live=fs.readFileSync('components/LiveCommandCenter.tsx','utf8');
const css=fs.readFileSync('app/client-system.css','utf8');

test('Match Room key moments use decision graph evidence and rich coaching context',()=>{
  assert.ok(live.includes('analysis.decisionGraph?.nodes'));
  assert.ok(live.includes("moment.verdict==='GOOD'?'✓ GOOD'"));
  assert.ok(live.includes('WHY IT MATTERED'));
  assert.ok(live.includes('NEXT TIME'));
  assert.ok(live.includes('moment.stats.map'));
  assert.ok(live.includes('metric.evidence'));
  assert.ok(live.includes('slice(0,6)'));
  assert.ok(css.includes('.match-room-moment-stats'));
  assert.ok(css.includes('.match-room-moment-why'));
  assert.ok(css.includes('.match-room-moment-next'));
});

test('Match Room compares the two selected DNA missions with timestamped proof',()=>{
  assert.ok(live.includes('gameMissionFocusPair(tasks,active.role)'));
  assert.ok(live.includes('missionComparisonForMatch(task,latestMissionMatch?.id)'));
  assert.ok(live.includes('missionRepView(task)'));
  assert.ok(live.includes('comparison.events'));
  assert.ok(live.includes('REVIEW PENDING'));
  assert.ok(css.includes('.match-room-missions-grid'));
});
