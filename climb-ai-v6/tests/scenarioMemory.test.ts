import test from 'node:test';
import assert from 'node:assert/strict';
import {buildScenarioMemory,selectScenarioPrime,reviewScenarioPrime} from '../lib/scenarioMemory';
import type {HistoryAnalysisRow} from '../lib/riot/proHistory';
import type {DecisionSimulation} from '../lib/decisionSimulation';

function row(index:number,verdict:'GOOD'|'IMPROVE',tag='MULTI_ACCESS',behaviour='CARRY_PRESERVATION',withCounterfactual=true):HistoryAnalysisRow{
  return{
    champion:'Aphelios',
    role:'ADC',
    createdAt:new Date(Date.UTC(2026,8,1+index,12,0,0)).toISOString(),
    analysis:{
      version:1,
      champion:'Aphelios',
      role:'ADC',
      evidenceSources:[],
      metrics:{},
      moments:[],
      leakSignals:[],
      fingerprint:{primary:'TEST',sequence:[],explanation:'',confidence:'MEDIUM'},
      summary:{headline:'',good:[],fix:[],next:''},
      decisionGraph:{
        version:1,
        nodes:[{
          id:'node-'+index,
          minuteLabel:'14:'+String(index).padStart(2,'0'),
          title:'Second access layer',
          situation:'Pantheon starts first contact while Irelia can still access.',
          behaviourKey:behaviour,
          behaviourLabel:'Carry Preservation',
          verdict,
          confidence:'HIGH',
          planAlignment:verdict==='GOOD'?'MATCHED':'CONFLICTED',
          situationTags:[tag],
          contextEnemies:['Pantheon','Irelia'],
          decisionRead:verdict==='GOOD'?'Held range.':'Walked forward after first contact.',
          lockedPrinciple:'Hold range until both access layers are accounted for.',
          evidence:['verified'],
          counterfactual:withCounterfactual&&verdict==='IMPROVE'?{
            actual:'Walk forward after Pantheon commits.',
            alternative:'Hold range until Irelia access is spent.',
            whyBetter:'Matches the frozen plan.',
            tradeoff:'Less immediate damage.',
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

function neutralRow(index:number):HistoryAnalysisRow{
  const base=row(index,'GOOD');
  (base.analysis as any).decisionGraph.nodes=[];
  return base;
}

const context={
  tags:['MULTI_ACCESS','PICK_PRESSURE'] as any,
  champion:'Aphelios',
  role:'ADC',
  enemyAccess:['Pantheon','Irelia'],
  enemyPicks:['Pantheon'],
  enemyZones:[],
};

const simulation:DecisionSimulation={
  version:1,
  status:'READY',
  headline:'SIM',
  summary:'SIM',
  personalForecastCount:1,
  draftRehearsalCount:0,
  boundary:'bounded',
  scenarios:[{
    id:'sim:carry',
    rank:1,
    source:'PERSONAL_RISK',
    behaviourKey:'CARRY_PRESERVATION',
    behaviourLabel:'Carry Preservation',
    situationTag:'MULTI_ACCESS',
    confidence:'HIGH',
    priorityScore:95,
    title:'Survive second access',
    trigger:'WHEN PANTHEON COMMITS AND IRELIA STILL HAS ACCESS.',
    exactDraftRead:'Pantheon creates first contact; Irelia is the second access layer.',
    twinLikelyMove:'Walk forward too early.',
    targetMove:'HOLD RANGE UNTIL IRELIA ACCESS IS SPENT.',
    whyThisTestsYou:'Repeated pattern.',
    branchRules:{AHEAD:'hold',EVEN:'hold',BEHIND:'hold'},
    relevantEnemies:['Pantheon','Irelia'],
    evidence:'repeated',
    predictionBoundary:'bounded',
  }],
};

test('Scenario Memory refuses to learn or master from one game',()=>{
  const memory=buildScenarioMemory([row(0,'IMPROVE')],'2026-09-21T12:00:00.000Z');
  const card=memory.cards[0];
  assert.ok(card);
  assert.equal(card.state,'BUILDING');
  assert.equal(card.confidence,'LOW');
  assert.equal(memory.activeRep,null);
  assert.match(memory.boundary,/one game cannot create mastery/i);
});

test('Scenario Memory schedules a missed repeated decision immediately',()=>{
  const memory=buildScenarioMemory([
    row(0,'IMPROVE'),
    row(1,'GOOD'),
    row(2,'IMPROVE'),
  ]);
  const card=memory.cards[0];
  assert.equal(card.state,'DUE');
  assert.equal(card.dueNextGame,true);
  assert.equal(card.comparableGames,3);
  assert.match(card.oldBranch,/walk forward/i);
  assert.match(card.targetBranch,/hold range/i);
});

test('Scenario Memory masters only after repeated clean comparable games and spaces maintenance',()=>{
  const memory=buildScenarioMemory([
    row(0,'IMPROVE'),
    row(1,'GOOD'),
    row(2,'GOOD'),
    row(3,'GOOD'),
    row(4,'GOOD'),
  ]);
  const card=memory.cards[0];
  assert.equal(card.state,'MASTERED');
  assert.equal(card.cleanStreak,4);
  assert.equal(card.reviewIntervalGames,3);
  assert.equal(card.dueNextGame,false);
  assert.ok(card.memoryStrength>=80);
});

test('one isolated miss does not erase a previously stable memory',()=>{
  const memory=buildScenarioMemory([
    row(0,'GOOD'),
    row(1,'GOOD'),
    row(2,'GOOD'),
    row(3,'GOOD'),
    row(4,'IMPROVE'),
    row(5,'GOOD'),
  ]);
  const card=memory.cards[0];
  assert.notEqual(card.state,'REGRESSED');
  assert.equal(memory.regressed,0);
});

test('a previously stable memory reopens only after sustained comparable misses',()=>{
  const memory=buildScenarioMemory([
    row(0,'GOOD'),
    row(1,'GOOD'),
    row(2,'GOOD'),
    row(3,'GOOD'),
    row(4,'IMPROVE'),
    row(5,'IMPROVE'),
    row(6,'IMPROVE'),
  ]);
  const card=memory.cards[0];
  assert.equal(card.state,'REGRESSED');
  assert.equal(card.dueNextGame,true);
  assert.equal(memory.regressed,1);
  assert.match(memory.summary,/reopened/i);
});

test('irrelevant games cannot evict comparable evidence and manufacture a regression',()=>{
  const comparable:HistoryAnalysisRow[]=[];
  for(let i=0;i<47;i++)comparable.push(row(i,i===0||i<10?'IMPROVE':'GOOD'));
  comparable.push(row(47,'IMPROVE'),row(48,'IMPROVE'),row(49,'IMPROVE'));
  const before=buildScenarioMemory(comparable,'2026-10-25T12:00:00.000Z');
  assert.equal(before.cards[0]?.state,'DUE');
  assert.equal(before.cards[0]?.comparableGames,50);

  const after=buildScenarioMemory([...comparable,neutralRow(50)],'2026-10-26T12:00:00.000Z');
  assert.equal(after.cards[0]?.state,'DUE');
  assert.equal(after.cards[0]?.comparableGames,50);
  assert.equal(after.regressed,0);
});

test('V4 selects one draft-matched due memory and binds it to the exact V3 simulation',()=>{
  const memory=buildScenarioMemory([
    row(0,'IMPROVE'),
    row(1,'GOOD'),
    row(2,'IMPROVE'),
  ]);
  const prime=selectScenarioPrime({memory,situationContext:context,simulation});
  assert.ok(prime);
  assert.equal(prime?.behaviourKey,'CARRY_PRESERVATION');
  assert.equal(prime?.simulationScenarioId,'sim:carry');
  assert.match(prime?.exactDraftRead||'',/Irelia is the second access layer/i);
  assert.match(prime?.targetBranch||'',/hold range until irelia/i);
  assert.match(prime?.rehearsalQuestion||'',/name the better branch/i);
});

test('scheduled Scenario Memory reps are graded only when a comparable decision actually appears',()=>{
  const memory=buildScenarioMemory([
    row(0,'IMPROVE'),
    row(1,'GOOD'),
    row(2,'IMPROVE'),
  ]);
  const prime=selectScenarioPrime({memory,situationContext:context,simulation});
  const noMatch=reviewScenarioPrime(prime,[]);
  assert.equal(noMatch.status,'NOT_OBSERVED');
  assert.equal(noMatch.matchedMoments,0);

  const executed=reviewScenarioPrime(prime,[{
    behaviourKey:'CARRY_PRESERVATION',
    verdict:'GOOD',
    confidence:'HIGH',
    situationTags:['MULTI_ACCESS'],
  }]);
  assert.equal(executed.status,'EXECUTED');
  assert.equal(executed.cleanMoments,1);
  assert.match(executed.note,/one reinforcement rep, not instant mastery/i);
});
