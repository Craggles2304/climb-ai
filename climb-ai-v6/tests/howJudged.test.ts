import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SKILL_JUDGING,skillJudging,missionJudging} from '../lib/howJudged';

test('every Climb Plan skill explains how a game is judged',()=>{
  const twin=fs.readFileSync('lib/decisionTwin.ts','utf8');
  const union=twin.slice(twin.indexOf('export type DecisionBehaviourKey'),twin.indexOf(';',twin.indexOf('export type DecisionBehaviourKey')));
  const keys=[...union.matchAll(/'([A-Z_]+)'/g)].map(match=>match[1]);
  assert.ok(keys.length>=10);
  for(const key of keys){
    const copy=SKILL_JUDGING[key as keyof typeof SKILL_JUDGING];
    assert.ok(copy,`missing judging copy for ${key}`);
    for(const field of ['watches','clean','miss','skipped'] as const)assert.ok(copy[field].length>10,`${key}.${field} is empty`);
  }
});

test('threat adaptation copy matches the real verdict thresholds',()=>{
  const graph=fs.readFileSync('lib/decisionGraph.ts','utf8');
  assert.match(graph,/score>=75\?'GOOD':score<60\?'IMPROVE'/);
  const copy=skillJudging('threat_adaptation');
  assert.ok(copy);
  assert.match(copy.clean,/75\+/);
  assert.match(copy.miss,/under 60/);
});

test('mission judging explains stat and decision-score missions without repeating the game count',()=>{
  const stat=missionJudging({metric:'laneCsPerMin',target:'6.5+ lane CS/min across 3 games'});
  assert.match(stat.measures,/lane CS\/min/);
  const decision=missionJudging({metric:'fight_selection',target:'85'},'85+ decision score · 3 proven games');
  assert.match(decision.measures,/0–100 score/);
  assert.equal((decision.pass.match(/3 /g)??[]).length,1);
});

test('Climb Plan and Missions show the judging box',()=>{
  assert.match(fs.readFileSync('app/progress/page.tsx','utf8'),/HOW EACH GAME IS JUDGED/);
  assert.match(fs.readFileSync('app/missions/page.tsx','utf8'),/HOW EACH GAME IS JUDGED/);
});
