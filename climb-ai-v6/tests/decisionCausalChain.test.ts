import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGameReadCalibration} from '../lib/gameReadCalibration';
import {buildDecisionCausalChain} from '../lib/decisionCausalChain';

function calibration(input:{stateRead:'AHEAD'|'EVEN'|'BEHIND';actualVerdict:'YOU_STRONGER'|'EVEN'|'THEM_STRONGER';priorityRead:string;confidenceRead:'HIGH'|'MEDIUM'|'LOW'}){
  return buildGameReadCalibration({
    reads:[{checkpointMinute:5,gameSeconds:300,stateRead:input.stateRead,confidenceRead:input.confidenceRead,threatRead:null,priorityRead:input.priorityRead}],
    points:[{atSeconds:302,verdict:input.actualVerdict,headline:'Recorded visible state',score:70}],
  });
}
function node(overrides:Record<string,unknown>={}){
  return{
    id:'fight:fight_selection:330:0',
    atSeconds:330,
    minuteLabel:'5:30',
    type:'FIGHT',
    behaviourKey:'FIGHT_SELECTION',
    behaviourLabel:'Fight Selection',
    verdict:'IMPROVE',
    confidence:'HIGH',
    title:'Bad fight',
    decisionRead:'Accepted a fight from a poor state.',
    consequence:'The exchange ended in a death.',
    evidence:['Visible power: THEM_STRONGER'],
    ...overrides,
  } as any;
}

test('wrong read followed by a bad decision diagnoses the game read first',()=>{
  const result=buildDecisionCausalChain({
    readCalibration:calibration({stateRead:'AHEAD',actualVerdict:'THEM_STRONGER',priorityRead:'FIGHT',confidenceRead:'HIGH'}),
    nodes:[node()],
  });
  assert.equal(result.verifiableChains,1);
  assert.equal(result.chains[0].diagnosis,'MISREAD_COMPOUNDED');
  assert.equal(result.chains[0].coachLayer,'GAME_READ');
  assert.equal(result.primaryDiagnosis,'MISREAD_COMPOUNDED');
});

test('correct read but action outside the frozen priority diagnoses follow-through',()=>{
  const result=buildDecisionCausalChain({
    readCalibration:calibration({stateRead:'EVEN',actualVerdict:'EVEN',priorityRead:'RESET',confidenceRead:'HIGH'}),
    nodes:[node({type:'FIGHT'})],
  });
  assert.equal(result.chains[0].priorityAlignment,'CONFLICTED');
  assert.equal(result.chains[0].diagnosis,'PRIORITY_DEVIATION');
  assert.equal(result.chains[0].coachLayer,'FOLLOW_THROUGH');
});

test('correct read and matching priority followed by a bad decision diagnoses execution',()=>{
  const result=buildDecisionCausalChain({
    readCalibration:calibration({stateRead:'EVEN',actualVerdict:'EVEN',priorityRead:'FIGHT',confidenceRead:'HIGH'}),
    nodes:[node({type:'FIGHT'})],
  });
  assert.equal(result.chains[0].priorityAlignment,'MATCHED');
  assert.equal(result.chains[0].diagnosis,'EXECUTION_GAP');
  assert.equal(result.chains[0].coachLayer,'EXECUTION');
});

test('wrong read followed by a clean verified decision credits recovery rather than blaming execution',()=>{
  const result=buildDecisionCausalChain({
    readCalibration:calibration({stateRead:'AHEAD',actualVerdict:'THEM_STRONGER',priorityRead:'STABILISE',confidenceRead:'MEDIUM'}),
    nodes:[node({type:'SURVIVAL',verdict:'GOOD',consequence:'Stayed alive through the pressure.'})],
  });
  assert.equal(result.chains[0].diagnosis,'MISREAD_RECOVERED');
  assert.equal(result.chains[0].coachLayer,'RECOGNITION');
});

test('supported read and clean next decision creates a clean chain',()=>{
  const result=buildDecisionCausalChain({
    readCalibration:calibration({stateRead:'AHEAD',actualVerdict:'YOU_STRONGER',priorityRead:'FIGHT',confidenceRead:'MEDIUM'}),
    nodes:[node({type:'FIGHT',verdict:'GOOD',consequence:'Converted the stronger state cleanly.'})],
  });
  assert.equal(result.chains[0].diagnosis,'CLEAN_CHAIN');
  assert.equal(result.chains[0].coachLayer,'AUTONOMY');
});

test('no close later decision remains not verifiable',()=>{
  const result=buildDecisionCausalChain({
    readCalibration:calibration({stateRead:'EVEN',actualVerdict:'EVEN',priorityRead:'RESET',confidenceRead:'HIGH'}),
    nodes:[node({atSeconds:700})],
  });
  assert.equal(result.verifiableChains,0);
  assert.equal(result.chains[0].diagnosis,'NOT_VERIFIABLE');
  assert.equal(result.primaryCoachLayer,'EVIDENCE');
});
