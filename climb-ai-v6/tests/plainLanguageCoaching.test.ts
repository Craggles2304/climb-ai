import test from 'node:test';
import assert from 'node:assert/strict';
import {plainLanguageFocus} from '../lib/plainLanguageCoaching';

const task=(title:string,category='POSITIONING',gameRule='Technical coach rule.',why='Technical coach reason.')=>({title,category,gameRule,why});

test('current Active Five jargon has beginner-safe translations',()=>{
  const cases=[
    ['Preserve carry uptime','important damage dealers'],
    ['Protect the advantage','easy way back into the game'],
    ['Stop accepting red-state fights','enemy is clearly stronger right now'],
    ['Spend before voluntary fights','Gold in your pocket'],
    ['Survive the first threat cycle','start of a teamfight'],
  ] as const;
  for(const [title,phrase] of cases){
    const plain=plainLanguageFocus(task(title) as any);
    assert.ok(plain.meaning.includes(phrase),title);
    assert.ok(plain.nextGame.length>30,title+' next-game cue');
    assert.ok(!plain.meaning.toLowerCase().includes('red-state'),title+' must not require jargon');
  }
});

test('common coaching categories still get a useful fallback translation',()=>{
  for(const category of ['POSITIONING','TEMPO','TRADING','TEAMFIGHTING','CONSISTENCY']){
    const plain=plainLanguageFocus(task('Improve this habit',category) as any);
    assert.ok(plain.meaning.length>35,category);
    assert.ok(plain.nextGame.length>25,category);
  }
});
