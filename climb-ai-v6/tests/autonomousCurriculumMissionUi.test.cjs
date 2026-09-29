const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('Progress leads with the single curriculum mission and keeps detailed views available',()=>{
  const progress=fs.readFileSync('app/progress/page.tsx','utf8');
  const command=fs.readFileSync('components/DecisionTwinCommandCenter.tsx','utf8');
  const css=fs.readFileSync('app/globals.css','utf8');
  assert.ok(progress.indexOf('<DecisionTwinCommandCenter')<progress.indexOf('vf-progress-hero'));
  assert.match(command,/YOUR NEXT GAME/);
  assert.match(command,/PLAY<\/span><i>→<\/i><span>MISSION<\/span>/);
  assert.match(command,/currentLesson\.gameRule/);
  assert.match(command,/If its decision window never appears, there is no pass or fail/);
  assert.match(command,/<details className="dt9-intelligence">/);
  assert.match(progress,/<details className="vf-progress-detail">/);
  assert.match(css,/\.dt9-mission-bottom/);
});
