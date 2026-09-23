import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPlayerCoachingIdentity} from '../lib/playerCoachingIdentity';

function rows(count=8,diagnosis='ALIGNED'){
  return Array.from({length:count},(_,i)=>({
    champion:'Aphelios',
    role:'ADC',
    createdAt:new Date(Date.UTC(2026,0,i+1)).toISOString(),
    analysis:{
      version:1,
      decisionGraph:{
        summary:{
          intentGap:{
            version:1,active:true,behaviourKey:'FIGHT_SELECTION',diagnosis,status:diagnosis==='KNOWLEDGE_GAP'?'KNOWLEDGE_GAP':diagnosis==='EXECUTION_GAP'?'EXECUTION_GAP':'ALIGNED',
          },
        },
      },
    },
  })) as any;
}
function twin(games=8){
  return{
    version:2,gamesAnalyzed:games,
    identity:{
      status:games>=3?'READY':'BUILDING',
      headline:'THE FIGHT INHERITOR',
      summary:'Repeated fight selection evidence.',
      confidence:games>=6?'HIGH':'MEDIUM',
      primary:{key:'FIGHT_SELECTION',label:'THE FIGHT INHERITOR',behaviourLabel:'Fight Selection'},
      strongest:{key:'CARRY_PRESERVATION',label:'THE UPTIME CARRY',behaviourLabel:'Carry Preservation'},
    },
    activeFive:[{key:'FIGHT_SELECTION',label:'Fight Selection'}],
  } as any;
}
function curriculum(games=8){
  return{
    version:1,gamesAnalyzed:games,status:games>=3?'ACTIVE':'BUILDING',
    currentLesson:games>=3?{
      behaviourKey:'FIGHT_SELECTION',label:'Fight Selection',phase:'STABILISE',
      repLadder:{level:3,stage:'STABILISE'},gameRule:'ENTER ONLY WHEN THE FIGHT MATCHES YOUR TRIGGER.',
      graduationRule:'THREE CLEAN VERIFIED REPS.',whyNow:'Current verified limiter.',nextUnlock:'Lead Protection',
    }:null,
    nextLesson:{label:'Lead Protection'},
  } as any;
}
function coachTwin(status='PREFERRED'){
  return{
    version:1,gamesAnalyzed:8,
    behaviourProfiles:[{
      behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',targetTag:'ANY',
      totalObserved:5,status,preferredMethod:'SELF_EXPLAIN',preferredMethodLabel:'Self-Explain',
      preferenceConfidence:'HIGH',preferenceEdge:28,evidence:'Self-Explain has the strongest repeated response association.',
    }],
    summary:'Coach Twin profile.',
  } as any;
}
function causal(layer='GAME_READ',status='REPEATED_ROOT_CAUSE'){
  return{
    version:1,gamesAnalyzed:8,status,dominantLayer:layer,
    dominantLayerLabel:layer==='GAME_READ'?'Game-State Recognition':layer==='EXECUTION'?'Decision Execution':layer==='AUTONOMY'?'Autonomy / Support Fade':layer,
    dominantShare:70,dominantGames:4,summary:'Repeated causal evidence.',nextCoachRule:'Use the repeated root cause.',
  } as any;
}
function autonomy(state='SCAFFOLDED',supportNeed='LIGHT'){
  return{
    version:1,gamesAnalyzed:8,
    cards:[{
      behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',state,supportNeed,observedGames:6,
      autonomyStrength:state==='AUTONOMOUS'?86:48,supportDependenceGap:state==='SUPPORT_DEPENDENT'?32:4,
      evidence:'Repeated autonomy evidence.',nextTest:'Run the next evidence-backed support test.',
    }],
    summary:'Autonomy profile.',
  } as any;
}
function value(){
  return{
    version:1,gamesAnalyzed:8,
    cards:[{
      behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',state:'SUPPORT_ASSOCIATED_LIFT',confidence:'MEDIUM',
      comparablePairs:4,matchedResponseDifference:18,interpretation:'Supported reps are associated with cleaner response.',evidence:'Matched support evidence.',
    }],
    summary:'Intervention value.',
  } as any;
}

test('Stage 13 refuses to create a stable coaching identity before repeated evidence exists',()=>{
  const model=buildPlayerCoachingIdentity({
    rows:rows(2),
    twin:twin(2),
    curriculum:curriculum(2),
    coachTwin:coachTwin('BUILDING'),
    causalProfile:causal(null as any,'BUILDING'),
    autonomyProfile:{...autonomy('BUILDING','UNKNOWN'),gamesAnalyzed:2} as any,
    interventionValue:value(),
  });
  assert.equal(model.status,'BUILDING');
  assert.equal(model.confidence,'LOW');
  assert.equal(model.rootCause.layer,null);
  assert.equal(model.coachingResponse.preferredMethod,null);
  assert.match(model.boundary,/ONE MATCH CANNOT REWRITE/);
});

test('repeated game-read + knowledge-gap evidence creates recognition-first Coach Brief',()=>{
  const model=buildPlayerCoachingIdentity({
    rows:rows(8,'KNOWLEDGE_GAP'),
    twin:twin(),
    curriculum:curriculum(),
    coachTwin:coachTwin(),
    causalProfile:causal('GAME_READ'),
    autonomyProfile:autonomy('SUPPORT_DEPENDENT','FULL'),
    interventionValue:value(),
  });
  assert.equal(model.rootCause.layer,'GAME_READ');
  assert.equal(model.knowledgeExecution.diagnosis,'KNOWLEDGE_GAP');
  assert.equal(model.coachingResponse.preferredMethod,'SELF_EXPLAIN');
  assert.equal(model.autonomy.supportNeed,'FULL');
  assert.match(model.coachBrief.firstQuestion,/WHAT STATE ARE WE IN/);
  assert.match(model.coachBrief.support,/FULL SCAFFOLDING/);
  assert.ok(model.coachBrief.avoid.some(item=>item.includes('DO NOT FADE SUPPORT')));
});

test('execution root cause tells the coach to stop reteaching state theory',()=>{
  const model=buildPlayerCoachingIdentity({
    rows:rows(8,'EXECUTION_GAP'),
    twin:twin(),
    curriculum:curriculum(),
    coachTwin:coachTwin(),
    causalProfile:causal('EXECUTION'),
    autonomyProfile:autonomy('EMERGING','LIGHT'),
    interventionValue:value(),
  });
  assert.equal(model.rootCause.layer,'EXECUTION');
  assert.equal(model.knowledgeExecution.diagnosis,'EXECUTION_GAP');
  assert.equal(model.coachBrief.liveInterruptions,1);
  assert.ok(model.coachBrief.avoid.some(item=>item.includes('DO NOT RETEACH GAME-STATE THEORY')));
});

test('stable clean autonomous evidence produces a minimal-interruption identity',()=>{
  const model=buildPlayerCoachingIdentity({
    rows:rows(10,'ALIGNED'),
    twin:twin(10),
    curriculum:curriculum(10),
    coachTwin:coachTwin(),
    causalProfile:causal('AUTONOMY','STABLE_CLEAN'),
    autonomyProfile:autonomy('AUTONOMOUS','MINIMAL'),
    interventionValue:value(),
  });
  assert.equal(model.rootCause.layer,'AUTONOMY');
  assert.equal(model.autonomy.supportNeed,'MINIMAL');
  assert.equal(model.coachBrief.liveInterruptions,1);
  assert.match(model.coachBrief.firstQuestion,/WITHOUT AN EXTRA COACH CUE/);
  assert.ok(['READY','STABLE'].includes(model.status));
});

test('unchanged repeated evidence reinforces identity rather than inventing a shift',()=>{
  const first=buildPlayerCoachingIdentity({
    rows:rows(),twin:twin(),curriculum:curriculum(),coachTwin:coachTwin(),causalProfile:causal('GAME_READ'),
    autonomyProfile:autonomy('SCAFFOLDED','LIGHT'),interventionValue:value(),
  });
  const second=buildPlayerCoachingIdentity({
    rows:rows(),twin:twin(),curriculum:curriculum(),coachTwin:coachTwin(),causalProfile:causal('GAME_READ'),
    autonomyProfile:autonomy('SCAFFOLDED','LIGHT'),interventionValue:value(),previous:first,
  });
  assert.equal(second.change.status,'UNCHANGED');
  assert.deepEqual(second.change.changedFields,[]);
});

test('a structural root-cause change is explicitly reported as a coaching identity shift',()=>{
  const first=buildPlayerCoachingIdentity({
    rows:rows(),twin:twin(),curriculum:curriculum(),coachTwin:coachTwin(),causalProfile:causal('GAME_READ'),
    autonomyProfile:autonomy('SCAFFOLDED','LIGHT'),interventionValue:value(),
  });
  const shifted=buildPlayerCoachingIdentity({
    rows:rows(8,'EXECUTION_GAP'),twin:twin(),curriculum:curriculum(),coachTwin:coachTwin(),causalProfile:causal('EXECUTION'),
    autonomyProfile:autonomy('EMERGING','LIGHT'),interventionValue:value(),previous:first,
  });
  assert.equal(shifted.change.status,'SHIFTED');
  assert.ok(shifted.change.changedFields.includes('ROOT_CAUSE_LAYER'));
});
