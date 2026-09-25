import test from 'node:test';
import assert from 'node:assert/strict';
import {plainLanguageFocus} from '../lib/plainLanguageCoaching';

const task=(
  title:string,
  category='POSITIONING',
  gameRule='Technical coach rule.',
  why='Technical coach reason.',
  metric='manual',
  target='3 reviewed games',
)=>({title,category,gameRule,why,metric,target});

test('missions use memorable names with beginner-safe explanations',()=>{
  const cases=[
    ['Preserve carry uptime','SURVIVE THE BURST','Stay safe'],
    ['Protect the advantage',"DON’T THROW THE LEAD",'When you are ahead'],
    ['Stop accepting red-state fights',"DON’T TAKE THE BAD FIGHT",'Stop fighting'],
    ['Spend before voluntary fights','SPEND BEFORE YOU FIGHT','Gold in your pocket'],
    ['Survive the first threat cycle','SURVIVE THE BURST','Stay safe'],
    ['Decide the final wave before objective setup','BEAT THE CLOCK','Stop getting caught'],
  ] as const;

  for(const [title,name,phrase] of cases){
    const plain=plainLanguageFocus(task(title) as any);
    assert.equal(plain.name,name,title);
    assert.ok(plain.meaning.includes(phrase),title+' meaning');
    assert.ok(plain.nextGame.length>30,title+' next-game cue');
    assert.ok(plain.success.length>15,title+' success explanation');
    assert.ok(plain.why.length>20,title+' why explanation');
    assert.ok(!plain.meaning.toLowerCase().includes('red-state'),title+' must not require jargon');
    assert.ok(!plain.meaning.toLowerCase().includes('threat cycle'),title+' must not expose coaching jargon');
  }
});

test('known role missions get short memorable names',()=>{
  const cases=[
    ['Leave lane at 6.5+ CS/min','OWN THE WAVE','laneCsPerMin'],
    ['Keep collecting after lane','KEEP THE GOLD FLOWING','post15CsPerMin'],
    ['Protect your second-item timing','HIT YOUR SPIKE','secondItemMinute'],
    ['Own the next objective vision cycle','LIGHT UP THE MAP','visionScore'],
    ['Make the map check automatic','EYES UP','mapCheck'],
  ] as const;

  for(const [title,name,metric] of cases){
    const plain=plainLanguageFocus(task(title,'POSITIONING','Technical rule.','Technical reason.',metric) as any);
    assert.equal(plain.name,name);
    assert.ok(plain.meaning.length<=180,name+' should stay concise');
    assert.ok(plain.nextGame.length<=220,name+' should stay actionable');
  }
});

test('fallback categories still get a useful simple mission',()=>{
  for(const category of ['POSITIONING','TEMPO','TRADING','TEAMFIGHTING','CONSISTENCY']){
    const plain=plainLanguageFocus(task('Improve this habit',category) as any);
    assert.ok(plain.name.length>3,category);
    assert.ok(plain.meaning.length>20,category);
    assert.ok(plain.nextGame.length>20,category);
  }
});
