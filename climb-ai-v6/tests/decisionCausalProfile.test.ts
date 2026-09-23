import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionCausalProfile} from '../lib/decisionCausalProfile';

type D='MISREAD_COMPOUNDED'|'PRIORITY_DEVIATION'|'EXECUTION_GAP'|'MISREAD_RECOVERED'|'CLEAN_CHAIN'|'NOT_VERIFIABLE';
const layerFor=(d:D)=>d==='MISREAD_COMPOUNDED'?'GAME_READ':d==='PRIORITY_DEVIATION'?'FOLLOW_THROUGH':d==='EXECUTION_GAP'?'EXECUTION':d==='MISREAD_RECOVERED'?'RECOGNITION':d==='CLEAN_CHAIN'?'AUTONOMY':'EVIDENCE';

function row(day:number,diagnoses:D[]){
  return{
    champion:'Ashe',
    role:'ADC',
    createdAt:'2026-09-'+String(day).padStart(2,'0')+'T12:00:00.000Z',
    analysis:{
      version:1,
      decisionGraph:{
        summary:{
          causalChain:{
            version:1,
            active:true,
            totalChains:diagnoses.length,
            verifiableChains:diagnoses.filter(d=>d!=='NOT_VERIFIABLE').length,
            diagnosisCounts:{},
            primaryDiagnosis:diagnoses[0]??'BUILDING',
            primaryCoachLayer:diagnoses[0]?layerFor(diagnoses[0]):'BUILDING',
            primaryHeadline:'test',
            primaryAction:'test',
            boundary:'test',
            chains:diagnoses.map((diagnosis,index)=>({
              version:1,checkpointMinute:5+index*5,readAtSeconds:300+index*300,decisionAtSeconds:330+index*300,delaySeconds:30,
              stateRead:'EVEN',actualState:'EVEN',readStatus:'SUPPORTED',confidenceRead:'HIGH',priorityRead:'FIGHT',priorityAlignment:'MATCHED',
              decisionNodeId:'node-'+index,decisionType:'FIGHT',behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',
              decisionVerdict:diagnosis==='CLEAN_CHAIN'||diagnosis==='MISREAD_RECOVERED'?'GOOD':'IMPROVE',decisionConfidence:'HIGH',
              diagnosis,coachLayer:layerFor(diagnosis),title:'test',readEvidence:'test',decisionEvidence:'test',outcome:'test',
              explanation:'test',nextCoachAction:'test',confidence:'HIGH',boundary:'test',
            })),
          },
        },
      },
    },
  } as any;
}

test('one match cannot create a repeated causal root cause',()=>{
  const profile=buildDecisionCausalProfile([row(20,['MISREAD_COMPOUNDED','MISREAD_COMPOUNDED'])]);
  assert.equal(profile.status,'BUILDING');
  assert.equal(profile.dominantLayer,null);
});

test('game-read failures become a repeated root cause only across multiple games',()=>{
  const profile=buildDecisionCausalProfile([
    row(20,['MISREAD_COMPOUNDED','MISREAD_COMPOUNDED']),
    row(21,['MISREAD_COMPOUNDED','EXECUTION_GAP']),
  ]);
  assert.equal(profile.status,'REPEATED_ROOT_CAUSE');
  assert.equal(profile.dominantLayer,'GAME_READ');
  assert.equal(profile.dominantGames,2);
  assert.equal(profile.dominantShare,75);
  assert.match(profile.nextCoachRule,/TEACH RECOGNITION BEFORE EXECUTION/);
});

test('repeated execution gaps preserve the self-read and move coaching downstream',()=>{
  const profile=buildDecisionCausalProfile([
    row(20,['EXECUTION_GAP','EXECUTION_GAP']),
    row(21,['EXECUTION_GAP']),
    row(22,['CLEAN_CHAIN']),
  ]);
  assert.equal(profile.status,'REPEATED_ROOT_CAUSE');
  assert.equal(profile.dominantLayer,'EXECUTION');
  assert.match(profile.nextCoachRule,/DO NOT RETEACH THE GAME STATE/);
});

test('repeated clean chains create a stable-clean autonomy signal',()=>{
  const profile=buildDecisionCausalProfile([
    row(20,['CLEAN_CHAIN','CLEAN_CHAIN']),
    row(21,['CLEAN_CHAIN']),
    row(22,['CLEAN_CHAIN','EXECUTION_GAP']),
  ]);
  assert.equal(profile.status,'STABLE_CLEAN');
  assert.equal(profile.dominantLayer,'AUTONOMY');
  assert.equal(profile.dominantGames,3);
  assert.match(profile.nextCoachRule,/FADE EXTRA INSTRUCTION/);
});
