import test from 'node:test';
import assert from 'node:assert/strict';
import type {ILPTask,Role} from '../lib/types';
import {dnaLevelFromXp,dnaStrandLevel,dnaXpRequiredForLevel} from '../lib/dnaLevel';

const role:Role='ADC';

function task(overrides:Partial<ILPTask>&{id:string,dnaDomain:ILPTask['dnaDomain']}):ILPTask{
  return{
    accountId:'acct',
    title:'DNA task',
    category:'CONSISTENCY',
    why:'',
    gameRule:'',
    metric:'lead_protection',
    target:'85+ decision score · 3 proven games',
    progress:0,
    status:'ACTIVE',
    source:'SYSTEM',
    evidence:[],
    roleScope:role,
    roleEvidence:[role],
    masteryRequired:3,
    missionHistory:[],
    ...overrides,
  } as ILPTask;
}

test('DNA levels start at level 1 and have no fixed ceiling',()=>{
  assert.deepEqual(dnaLevelFromXp(0),{
    level:1,totalXp:0,xpIntoLevel:0,xpForNextLevel:100,levelProgress:0,
  });
  assert.equal(dnaLevelFromXp(100).level,2);
  assert.equal(dnaLevelFromXp(225).level,3);
  const huge=dnaLevelFromXp(1_000_000);
  assert.ok(huge.level>100);
  assert.ok(huge.xpIntoLevel<huge.xpForNextLevel);
  assert.equal(dnaXpRequiredForLevel(huge.level),huge.xpForNextLevel);
});

test('mastered missions and banked games create persistent strand XP',()=>{
  const rows=[
    task({id:'dna-strand-adc-laning-1',dnaDomain:'LANING',status:'MASTERED'}),
    task({
      id:'dna-strand-adc-laning-2',
      dnaDomain:'LANING',
      status:'EVIDENCE_BUILDING',
      missionHistory:[
        {matchId:'m1',at:'2026-10-01T00:00:00.000Z',adherence:'TRACKED',clearedBar:true,outcome:'CONFIRMED',banksPass:true},
        {matchId:'m2',at:'2026-10-02T00:00:00.000Z',adherence:'TRACKED',clearedBar:true,outcome:'CONFIRMED',banksPass:true},
      ],
    }),
  ];
  const level=dnaStrandLevel(rows,'LANING',role);
  assert.equal(level.totalXp,150);
  assert.equal(level.level,2);
  assert.equal(level.xpIntoLevel,50);
  assert.equal(level.xpForNextLevel,125);
  assert.equal(level.levelProgress,40);
  assert.equal(level.masteredMissions,1);
  assert.equal(level.currentCompletedGames,2);
});

test('DNA levels never borrow mastered missions from another role',()=>{
  const rows=[
    task({id:'dna-strand-mid-laning-1',dnaDomain:'LANING',status:'MASTERED',roleScope:'MID',roleEvidence:['MID']}),
    task({id:'dna-strand-adc-laning-1',dnaDomain:'LANING',status:'ACTIVE',roleScope:'ADC',roleEvidence:['ADC']}),
  ];
  assert.equal(dnaStrandLevel(rows,'LANING','ADC').level,1);
  assert.equal(dnaStrandLevel(rows,'LANING','ADC').totalXp,0);
});
