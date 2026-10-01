import test from 'node:test';
import assert from 'node:assert/strict';
import {positiveEvidenceForMatch} from '../lib/positiveEvidence';
import type {Match} from '../lib/types';

function match(overrides:Partial<Match['metrics']>={},rank='Bronze IV'):Match{
  return{
    id:'EUW1-TEST',riotAccountId:'acc',champion:'Jinx',role:'ADC',result:'WIN',
    kills:5,deaths:3,assists:7,durationSeconds:1800,rank,source:'riot',createdAt:new Date().toISOString(),
    metrics:{cs:180,csPerMin:6,...overrides},
  };
}

test('good play only becomes a verified strength when it clears the rank benchmark',()=>{
  const below=positiveEvidenceForMatch(match({csAt10:45}));
  assert.equal(below.some(item=>item.id==='rank:csAt10'),false);

  const above=positiveEvidenceForMatch(match({csAt10:50}));
  const strength=above.find(item=>item.id==='rank:csAt10');
  assert.ok(strength);
  assert.equal(strength?.dnaDomain,'LANING');
  assert.equal(strength?.value,'50');
  assert.match(strength?.target??'',/CS at 10m/);
});

test('positive evidence keeps the DNA strand attached to the measurable behaviour',()=>{
  const strengths=positiveEvidenceForMatch(match({
    deathsPre10:0,
    objectiveParticipation:.6,
    damageShare:.25,
    killParticipation:.6,
  }));
  assert.ok(strengths.some(item=>item.dnaDomain==='LANING'&&item.id==='rank:deathsPre10'));
  assert.ok(strengths.some(item=>item.dnaDomain==='OBJECTIVES'&&item.id==='rank:objectiveParticipation'));
  assert.ok(strengths.some(item=>item.dnaDomain==='TEAMFIGHTS'&&item.id==='rank:damageShare'));
  assert.ok(strengths.some(item=>item.dnaDomain==='VISION_MAP'&&item.id==='rank:killParticipation'));
});

test('high decision scores become verified strengths instead of only being used for leak detection',()=>{
  const game=match();
  game.proAnalysis={
    version:1,
    champion:'Jinx',
    role:'ADC',
    evidenceSources:['TEST'],
    metrics:{
      fight_selection:{
        key:'fight_selection',label:'FIGHT SELECTION',score:84,value:'84/100',
        status:'DERIVED',confidence:'HIGH',sources:['TEST'],summary:'Avoided poor fight entries.',
        evidence:[{atSeconds:1200,label:'Clean entry',detail:'Waited for the first threat cycle.'}],
      },
    },
    leakSignals:[],
    fingerprint:{primary:'TEST',sequence:[],confidence:'LOW',explanation:'Test'},
  };
  const strengths=positiveEvidenceForMatch(game);
  const item=strengths.find(strength=>strength.id==='decision:fight_selection');
  assert.ok(item);
  assert.equal(item?.dnaDomain,'TEAMFIGHTS');
  assert.equal(item?.score,84);
});
