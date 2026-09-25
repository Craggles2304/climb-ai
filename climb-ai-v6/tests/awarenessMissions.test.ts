import test from 'node:test';
import assert from 'node:assert/strict';
import {awarenessMissions} from '../lib/awarenessMissions';

test('farm missions surface unscored map-awareness side missions',()=>{
  const side=awarenessMissions({metric:'laneCsPerMin',category:'LANING',title:'Leave lane at 6.5+ CS/min'} as any,'ADC');
  assert.ok(side.some(item=>item.name==='EYES UP BEFORE THE WAVE'));
  assert.ok(side.length<=2);
});

test('late survival missions surface threat-awareness side missions',()=>{
  const side=awarenessMissions({metric:'deathsPost20',category:'TEAMFIGHTING',title:'Survive the first threat cycle'} as any,'ADC');
  assert.ok(side.some(item=>item.name==='TRACK THE ENGAGE'));
});

test('side missions are coaching cues only and carry no progression fields',()=>{
  const side=awarenessMissions({metric:'visionScore',category:'VISION',title:'Own vision'} as any,'SUPPORT');
  for(const item of side){
    assert.equal('progress' in item,false);
    assert.equal('xp' in item,false);
    assert.ok(item.cue.length>20);
  }
});
