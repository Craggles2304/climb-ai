import test from 'node:test';
import assert from 'node:assert/strict';
import {buildScenarioMemory} from '../lib/scenarioMemory';
import {buildDecisionTransfer,selectDecisionTransferPrime,reviewDecisionTransfer} from '../lib/decisionTransfer';
import type {HistoryAnalysisRow} from '../lib/riot/proHistory';
import type {DecisionSituationTag} from '../lib/decisionTwin';

function row(
  index:number,
  champion:string,
  verdict:'GOOD'|'IMPROVE',
  tag:DecisionSituationTag='MULTI_ACCESS',
):HistoryAnalysisRow{
  return{
    champion,
    role:'ADC',
    createdAt:'2026-09-'+String(index+1).padStart(2,'0')+'T12:00:00.000Z',
    analysis:{
      version:1,
      champion,
      role:'ADC',
      evidenceSources:['TEST'],
      metrics:{},
      moments:[],
      leakSignals:[],
      fingerprint:{primary:'TEST',sequence:[],explanation:'',confidence:'HIGH'},
      summary:{headline:'',good:[],fix:[],next:''},
      decisionGraph:{
        version:1,
        nodes:[{
          id:'node-'+index,
          minuteLabel:'14:'+String(index).padStart(2,'0'),
          title:'Carry access decision',
          situation:tag==='PICK_PRESSURE'?'Enemy pick pressure starts before formation.':'Second access layer remains available after first contact.',
          behaviourKey:'CARRY_PRESERVATION',
          behaviourLabel:'Carry Preservation',
          verdict,
          confidence:'HIGH',
          planAlignment:verdict==='GOOD'?'MATCHED':'CONFLICTED',
          situationTags:[tag],
          contextEnemies:['Pantheon','Irelia'],
          decisionRead:verdict==='GOOD'?'Held the safe line.':'Walked forward after first contact.',
          lockedPrinciple:'FIRST CONTACT DOES NOT REMOVE THE SECOND THREAT.',
          evidence:['verified'],
          counterfactual:verdict==='IMPROVE'?{
            actual:'Walk forward after first contact.',
            alternative:'Hold the safe line until remaining access is spent.',
            whyBetter:'Preserves damage uptime.',
            tradeoff:'Delays immediate damage.',
            confidence:'HIGH',
            basis:['LOCKED_PLAN'],
            priority:95,
            outcomeBoundary:'No guarantee.',
          }:null,
          coachingResponse:null,
        }],
        summary:{},
      },
    } as any,
  };
}

function build(rows:HistoryAnalysisRow[]){
  const memory=buildScenarioMemory(rows,'2026-09-21T12:00:00.000Z');
  const transfer=buildDecisionTransfer(rows,memory,'2026-09-21T12:00:00.000Z');
  return{memory,transfer};
}

test('V5 refuses transfer claims before the underlying Scenario Memory is locally mastered',()=>{
  const {transfer}=build([
    row(0,'Aphelios','IMPROVE'),
    row(1,'Aphelios','GOOD'),
    row(2,'Aphelios','IMPROVE'),
  ]);
  assert.equal(transfer.cards.length,0);
  assert.equal(transfer.locallyMastered,0);
  assert.match(transfer.summary,/waiting for a locally mastered/i);
});

test('same champion and same context after mastery is retention, not transfer',()=>{
  const {transfer}=build([
    row(0,'Aphelios','IMPROVE'),
    row(1,'Aphelios','GOOD'),
    row(2,'Aphelios','GOOD'),
    row(3,'Aphelios','GOOD'),
    row(4,'Aphelios','GOOD'),
    row(5,'Aphelios','GOOD'),
  ]);
  const card=transfer.cards[0];
  assert.ok(card);
  assert.equal(card.state,'LOCAL_ONLY');
  assert.equal(card.transferGames,0);
  assert.equal(card.dimension,'NONE');
  assert.equal(card.transferStrength,0);
});

test('historically mastered local learning keeps its transfer record after one local miss',()=>{
  const {memory,transfer}=build([
    row(0,'Aphelios','IMPROVE'),
    row(1,'Aphelios','GOOD'),
    row(2,'Aphelios','GOOD'),
    row(3,'Aphelios','GOOD'),
    row(4,'Aphelios','GOOD'),
    row(5,'Jinx','GOOD','PICK_PRESSURE'),
    row(6,'Jinx','GOOD','PICK_PRESSURE'),
    row(7,'Aphelios','IMPROVE','MULTI_ACCESS'),
  ]);
  const local=memory.cards.find(card=>card.behaviourKey==='CARRY_PRESERVATION'&&card.situationTag==='MULTI_ACCESS');
  assert.ok(local);
  assert.notEqual(local?.state,'MASTERED');
  const card=transfer.cards[0];
  assert.ok(card);
  assert.equal(card.sourceChampion,'Aphelios');
  assert.equal(card.transferGames,2);
  assert.match(transfer.boundary,/does not erase/i);
});

test('clean decisions on a different champion begin transfer but do not instantly own the principle',()=>{
  const {transfer}=build([
    row(0,'Aphelios','IMPROVE'),
    row(1,'Aphelios','GOOD'),
    row(2,'Aphelios','GOOD'),
    row(3,'Aphelios','GOOD'),
    row(4,'Aphelios','GOOD'),
    row(5,'Jinx','GOOD'),
    row(6,'Jinx','GOOD'),
  ]);
  const card=transfer.cards[0];
  assert.equal(card.state,'TRANSFERRING');
  assert.deepEqual(card.novelChampions,['Jinx']);
  assert.equal(card.novelContexts.length,0);
  assert.equal(card.transferGames,2);
  assert.equal(card.cleanTransferGames,2);
  assert.notEqual(card.state,'PRINCIPLE_OWNED');
});

test('repeated clean decisions across different champion and context can promote principle ownership',()=>{
  const {transfer}=build([
    row(0,'Aphelios','IMPROVE'),
    row(1,'Aphelios','GOOD'),
    row(2,'Aphelios','GOOD'),
    row(3,'Aphelios','GOOD'),
    row(4,'Aphelios','GOOD'),
    row(5,'Jinx','GOOD','MULTI_ACCESS'),
    row(6,'Aphelios','GOOD','PICK_PRESSURE'),
    row(7,'Jinx','GOOD','PICK_PRESSURE'),
    row(8,'Kai\'Sa','GOOD','PICK_PRESSURE'),
  ]);
  const card=transfer.cards[0];
  assert.equal(card.state,'PRINCIPLE_OWNED');
  assert.equal(card.dimension,'BOTH');
  assert.ok(card.novelChampions.includes('Jinx'));
  assert.ok(card.novelContexts.includes('PICK_PRESSURE'));
  assert.ok(card.breadthScore>=2);
  assert.ok(card.transferStrength>=80);
});

test('one isolated novel miss does not erase transferred learning',()=>{
  const {transfer}=build([
    row(0,'Aphelios','IMPROVE'),
    row(1,'Aphelios','GOOD'),
    row(2,'Aphelios','GOOD'),
    row(3,'Aphelios','GOOD'),
    row(4,'Aphelios','GOOD'),
    row(5,'Jinx','GOOD','PICK_PRESSURE'),
    row(6,'Jinx','GOOD','PICK_PRESSURE'),
    row(7,'Kai\'Sa','GOOD','PICK_PRESSURE'),
    row(8,'Jinx','GOOD','PICK_PRESSURE'),
    row(9,'Jinx','IMPROVE','PICK_PRESSURE'),
    row(10,'Jinx','GOOD','PICK_PRESSURE'),
  ]);
  const card=transfer.cards[0];
  assert.notEqual(card.state,'REGRESSED');
  assert.equal(transfer.regressed,0);
});

test('a transferred principle reopens after sustained novel mistakes',()=>{
  const {transfer}=build([
    row(0,'Aphelios','IMPROVE'),
    row(1,'Aphelios','GOOD'),
    row(2,'Aphelios','GOOD'),
    row(3,'Aphelios','GOOD'),
    row(4,'Aphelios','GOOD'),
    row(5,'Jinx','GOOD','PICK_PRESSURE'),
    row(6,'Jinx','GOOD','PICK_PRESSURE'),
    row(7,'Kai\'Sa','GOOD','PICK_PRESSURE'),
    row(8,'Jinx','GOOD','PICK_PRESSURE'),
    row(9,'Jinx','IMPROVE','PICK_PRESSURE'),
    row(10,'Kai\'Sa','IMPROVE','PICK_PRESSURE'),
    row(11,'Jinx','IMPROVE','PICK_PRESSURE'),
  ]);
  const card=transfer.cards[0];
  assert.equal(card.state,'REGRESSED');
  assert.equal(transfer.regressed,1);
  assert.equal(card.nextTransferNeeded,true);
});

test('exact-draft V5 selector yields one novel transfer test and defers to unstable V4 reps',()=>{
  const {memory,transfer}=build([
    row(0,'Aphelios','IMPROVE'),
    row(1,'Aphelios','GOOD'),
    row(2,'Aphelios','GOOD'),
    row(3,'Aphelios','GOOD'),
    row(4,'Aphelios','GOOD'),
  ]);
  const situationContext={
    tags:['PICK_PRESSURE'] as DecisionSituationTag[],
    champion:'Jinx',
    role:'ADC',
    enemyAccess:[],
    enemyPicks:['Blitzcrank'],
    enemyZones:[],
  } as any;

  const blocked=selectDecisionTransferPrime({
    transfer,memory,
    scenarioPrime:{state:'LEARNING'} as any,
    situationContext,
    simulation:null,
    champion:'Jinx',
    role:'ADC',
  });
  assert.equal(blocked,null);

  const prime=selectDecisionTransferPrime({
    transfer,memory,
    scenarioPrime:null,
    situationContext,
    simulation:null,
    champion:'Jinx',
    role:'ADC',
  });
  assert.ok(prime);
  assert.equal(prime?.dimension,'BOTH');
  assert.equal(prime?.sourceChampion,'Aphelios');
  assert.equal(prime?.targetChampion,'Jinx');
  assert.equal(prime?.targetTag,'PICK_PRESSURE');
  assert.match(prime?.rehearsalQuestion||'',/without relying on the original/i);
});

test('post-game transfer review scores only the frozen novel decision when it actually appears',()=>{
  const {memory,transfer}=build([
    row(0,'Aphelios','IMPROVE'),
    row(1,'Aphelios','GOOD'),
    row(2,'Aphelios','GOOD'),
    row(3,'Aphelios','GOOD'),
    row(4,'Aphelios','GOOD'),
  ]);
  const prime=selectDecisionTransferPrime({
    transfer,memory,scenarioPrime:null,
    situationContext:{tags:['PICK_PRESSURE'],champion:'Jinx',role:'ADC',enemyAccess:[],enemyPicks:['Blitzcrank'],enemyZones:[]} as any,
    simulation:null,champion:'Jinx',role:'ADC',
  });
  assert.ok(prime);

  const noMatch=reviewDecisionTransfer(prime,[]);
  assert.equal(noMatch.status,'NOT_OBSERVED');

  const transferred=reviewDecisionTransfer(prime,[{
    behaviourKey:'CARRY_PRESERVATION',
    verdict:'GOOD',
    confidence:'HIGH',
    situationTags:['PICK_PRESSURE'],
  }]);
  assert.equal(transferred.status,'TRANSFERRED');
  assert.equal(transferred.cleanMoments,1);
  assert.match(transferred.note,/transfer evidence, not proof/i);

  const wrongContext=reviewDecisionTransfer(prime,[{
    behaviourKey:'CARRY_PRESERVATION',
    verdict:'GOOD',
    confidence:'HIGH',
    situationTags:['MULTI_ACCESS'],
  }]);
  assert.equal(wrongContext.status,'NOT_OBSERVED');
});
