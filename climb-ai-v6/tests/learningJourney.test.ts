import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildLearningJourney} from '../lib/learningJourney';
import type {HistoryAnalysisRow} from '../lib/riot/proHistory';

function row(index:number,verdict:'GOOD'|'IMPROVE',coachingResponse:'EXECUTED'|'MISSED'|null):HistoryAnalysisRow{
  const early=index<8;
  const carry=early?40:90;
  const objective=early?85:45;
  const createdAt=new Date(Date.UTC(2026,8,1+index,12)).toISOString();
  return{
    champion:'Aphelios',
    role:'ADC',
    createdAt,
    analysis:{
      version:1,
      champion:'Aphelios',
      role:'ADC',
      evidenceSources:['TEST'],
      metrics:{
        carry_preservation:{key:'carry_preservation',label:'CARRY PRESERVATION',score:carry,value:String(carry),status:'DERIVED',confidence:'HIGH',sources:['TEST'],summary:'test',evidence:[{atSeconds:700+index,label:'Carry decision',detail:'test'}]},
        objective_readiness:{key:'objective_readiness',label:'OBJECTIVE READINESS',score:objective,value:String(objective),status:'DERIVED',confidence:'HIGH',sources:['TEST'],summary:'test',evidence:[{atSeconds:800+index,label:'Objective decision',detail:'test'}]},
      },
      leakSignals:[],
      fingerprint:{primary:'TEST',sequence:[],confidence:'HIGH',explanation:'test'},
      decisionGraph:{
        version:1,
        generatedAt:createdAt,
        champion:'Aphelios',
        role:'ADC',
        nodeCount:1,
        highConfidenceCount:1,
        planAvailable:true,
        nodes:[{
          id:'decision-'+index,
          atSeconds:700+index,
          minuteLabel:'12:00',
          type:'SURVIVAL',
          behaviourKey:'CARRY_PRESERVATION',
          behaviourLabel:'Carry Preservation',
          verdict,
          confidence:'HIGH',
          title:'Multi-access carry decision',
          situation:'Comparable multi-access decision.',
          decisionRead:verdict==='GOOD'?'Held the safe line.':'Crossed the threat line early.',
          consequence:verdict==='GOOD'?'Preserved uptime.':'Lost safe uptime.',
          lockedPrinciple:'FIRST ENGAGE ≠ WALK FORWARD.',
          planAlignment:verdict==='GOOD'?'MATCHED':'CONFLICTED',
          situationTags:['MULTI_ACCESS'],
          contextEnemies:['Sett','Pantheon','Irelia'],
          evidence:['verified'],
          counterfactual:null,
          coachingResponse:coachingResponse?{
            version:1,
            status:coachingResponse,
            cue:'FIRST ENGAGE ≠ WALK FORWARD.',
            behaviourKey:'CARRY_PRESERVATION',
            situationTag:'MULTI_ACCESS',
            confidence:'HIGH',
            proof:'test',
            boundary:'association only',
          }:null,
          limitation:'test',
        }],
        summary:{
          cleanDecisions:verdict==='GOOD'?1:0,
          improveDecisions:verdict==='IMPROVE'?1:0,
          neutralDecisions:0,
          counterfactualCount:0,
          topCounterfactualNodeIds:[],
          coachingResponse:{activeCue:Boolean(coachingResponse),cue:coachingResponse?'FIRST ENGAGE ≠ WALK FORWARD.':null,behaviourKey:coachingResponse?'CARRY_PRESERVATION':null,situationTag:coachingResponse?'MULTI_ACCESS':null,matchedMoments:coachingResponse?1:0,executed:coachingResponse==='EXECUTED'?1:0,missed:coachingResponse==='MISSED'?1:0,responseRate:coachingResponse==='EXECUTED'?100:coachingResponse==='MISSED'?0:null,status:coachingResponse==='EXECUTED'?'EXECUTING':coachingResponse==='MISSED'?'MISSING':'NO_CUE',note:'test'},
          mostRepeatedBehaviour:'CARRY_PRESERVATION',
          mostRepeatedLabel:'Carry Preservation',
        },
      },
    } as any,
  };
}

test('Learning Journey reconstructs discover → coach → execute → improve → master from real history',()=>{
  const verdicts=[
    'IMPROVE','IMPROVE','IMPROVE','IMPROVE','IMPROVE','IMPROVE','IMPROVE','IMPROVE',
    'GOOD','GOOD','GOOD','GOOD','GOOD','GOOD',
  ] as const;
  const rows=verdicts.map((verdict,index)=>row(index,verdict,index>=8?'EXECUTED':null));
  const journey=buildLearningJourney(rows,'2026-09-20T22:00:00.000Z');

  assert.equal(journey.gamesAnalyzed,14);
  assert.equal(journey.stage,'MASTERING');
  assert.equal(journey.summary.masteredPatterns,1);
  assert.equal(journey.summary.coachedDecisions,6);
  assert.equal(journey.summary.coachedExecuted,6);
  assert.equal(journey.summary.coachingExecutionRate,100);

  const types=new Set(journey.events.map(event=>event.type));
  assert.ok(types.has('PATTERN_DISCOVERED'));
  assert.ok(types.has('COACHING_STARTED'));
  assert.ok(types.has('FIRST_EXECUTION'));
  assert.ok(types.has('IMPROVING'));
  assert.ok(types.has('MASTERED'));
  assert.ok(types.has('FOCUS_SELECTED'));
  assert.ok(types.has('FOCUS_CHANGED'));

  const discovered=journey.events.find(event=>event.type==='PATTERN_DISCOVERED');
  assert.equal(discovered?.situationTag,'MULTI_ACCESS');
  assert.match(discovered?.detail||'',/graded for improvement/i);

  const mastered=journey.events.find(event=>event.type==='MASTERED');
  assert.match(mastered?.detail||'',/recent comparable decisions were clean/i);
  assert.equal(mastered?.evidence.recentFailureRate,0);

  const started=journey.events.find(event=>event.type==='COACHING_STARTED');
  const executed=journey.events.find(event=>event.type==='FIRST_EXECUTION');
  assert.equal(started?.gameNumber,9);
  assert.equal(executed?.gameNumber,9);
  assert.match(executed?.detail||'',/not proof that the cue caused/i);

  assert.equal(journey.currentFocus?.key,'OBJECTIVE_READINESS');
});

test('Learning Journey stays BUILDING instead of inventing milestones from too little evidence',()=>{
  const journey=buildLearningJourney([
    row(0,'IMPROVE',null),
    row(1,'GOOD',null),
  ],'2026-09-20T22:00:00.000Z');
  assert.equal(journey.stage,'BUILDING');
  assert.equal(journey.summary.verifiedPatterns,0);
  assert.equal(journey.summary.coachedDecisions,0);
  assert.ok(!journey.events.some(event=>event.type==='PATTERN_DISCOVERED'));
  assert.ok(!journey.events.some(event=>event.type==='MASTERED'));
});

test('Learning Journey coaching totals dedupe one Decision Graph node even when multiple context tags exist',()=>{
  const base=row(0,'GOOD','EXECUTED');
  const node=(base.analysis as any).decisionGraph.nodes[0];
  node.situationTags=['MULTI_ACCESS','PICK_PRESSURE'];
  const journey=buildLearningJourney([base],'2026-09-20T22:00:00.000Z');
  assert.equal(journey.summary.coachedDecisions,1);
  assert.equal(journey.summary.coachedExecuted,1);
});


test('Progress page exposes the evidence-bounded Learning Journey and the server persists it',()=>{
  const component=fs.readFileSync('components/LearningJourneyTimeline.tsx','utf8');
  const progress=fs.readFileSync('app/progress/page.tsx','utf8');
  const route=fs.readFileSync('app/api/learning-journey/route.ts','utf8');
  const repo=fs.readFileSync('lib/server/proLearningRepository.ts','utf8');

  assert.ok(component.includes('DECISION TWIN · LEARNING JOURNEY'));
  assert.ok(component.includes('DISCOVER → COACH → EXECUTE → IMPROVE → MASTER → MOVE ON'));
  assert.ok(component.includes('AFTER-CUE EXECUTION'));
  assert.ok(component.includes('OP CLIMB will not create a “journey” from noise.'));
  assert.ok(progress.includes('<LearningJourneyTimeline accountId={active.id}/>'));
  assert.ok(route.includes('buildLearningJourney(rows)'));
  assert.ok(route.includes("grounding:'decision-twin-history'"));
  assert.ok(repo.includes('learningJourney=buildLearningJourney(rows,now)'));
  assert.ok(repo.includes('learningJourney,generatedAt:now'));
});
