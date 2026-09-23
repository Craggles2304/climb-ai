import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGameReadCalibration} from '../lib/gameReadCalibration';

const points=[
  {atSeconds:305,verdict:'YOU_STRONGER',headline:'You had the stronger visible state',score:78},
  {atSeconds:602,verdict:'EVEN',headline:'Visible state was even',score:66},
  {atSeconds:901,verdict:'THEM_STRONGER',headline:'Opponent had the stronger visible state',score:48},
];

test('read calibration scores frozen 5 10 15 minute state reads against nearby evidence',()=>{
  const result=buildGameReadCalibration({
    reads:[
      {checkpointMinute:5,gameSeconds:300,stateRead:'AHEAD',confidenceRead:'HIGH',threatRead:null,priorityRead:'FIGHT'},
      {checkpointMinute:10,gameSeconds:600,stateRead:'EVEN',confidenceRead:'MEDIUM',threatRead:null,priorityRead:'RESET'},
      {checkpointMinute:15,gameSeconds:900,stateRead:'EVEN',confidenceRead:'HIGH',threatRead:null,priorityRead:'OBJECTIVE SETUP'},
    ],
    points,
  });
  assert.equal(result.active,true);
  assert.equal(result.gradedReads,3);
  assert.equal(result.supportedReads,2);
  assert.equal(result.reviewReads,1);
  assert.equal(result.supportRate,67);
  assert.equal(result.underestimatedDeficit,1);
  assert.equal(result.highConfidenceErrors,1);
  assert.equal(result.confidenceProfile,'OVERCONFIDENT');
});

test('correct low-confidence reads are preserved as underconfidence evidence',()=>{
  const result=buildGameReadCalibration({
    reads:[
      {checkpointMinute:5,gameSeconds:300,stateRead:'AHEAD',confidenceRead:'LOW',threatRead:null,priorityRead:'FARM'},
      {checkpointMinute:10,gameSeconds:600,stateRead:'EVEN',confidenceRead:'LOW',threatRead:null,priorityRead:'RESET'},
    ],
    points,
  });
  assert.equal(result.supportedReads,2);
  assert.equal(result.lowConfidenceCorrect,2);
  assert.equal(result.confidenceProfile,'UNDERCONFIDENT');
  assert.equal(result.profile,'WELL_CALIBRATED');
});

test('a checkpoint without close visible-state evidence stays neutral',()=>{
  const result=buildGameReadCalibration({
    reads:[{checkpointMinute:5,gameSeconds:300,stateRead:'AHEAD',confidenceRead:'HIGH',threatRead:null,priorityRead:'FIGHT'}],
    points:[{atSeconds:900,verdict:'THEM_STRONGER'}],
  });
  assert.equal(result.gradedReads,0);
  assert.equal(result.notVerifiable,1);
  assert.equal(result.supportRate,null);
  assert.equal(result.profile,'BUILDING');
  assert.equal(result.items[0].status,'NOT_VERIFIABLE');
});
