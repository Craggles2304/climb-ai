const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('Progress leads with the single curriculum mission and keeps detailed views available',()=>{
  const progress=fs.readFileSync('app/progress/page.tsx','utf8');
  const command=fs.readFileSync('components/DecisionTwinCommandCenter.tsx','utf8');
  const css=fs.readFileSync('app/globals.css','utf8');
  // The page is tabbed now: the plan leads, and the detailed coach views sit
  // behind the Deep tab rather than inline under a hero.
  assert.ok(progress.indexOf('cp-now')<progress.indexOf("tab==='deep'"));
  assert.match(progress,/tab==='deep'[\s\S]*<DecisionTwinCommandCenter/);
  assert.match(progress,/You do not need this to follow the plan/);
  assert.match(command,/YOUR NEXT GAME/);
  assert.match(command,/PLAY<\/span><i>→<\/i><span>MISSION<\/span>/);
  assert.match(command,/currentLesson\.gameRule/);
  assert.match(command,/If its decision window never appears, there is no pass or fail/);
  assert.match(command,/<details className="dt9-intelligence">/);
  assert.match(progress,/<CareerDevelopmentMap[\s\S]*<LearningJourneyTimeline/);
  assert.match(css,/\.dt9-mission-bottom/);
});
