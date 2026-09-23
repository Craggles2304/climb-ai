import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildClimbCareerExperience} from '../lib/climbCareerExperience';

function lesson(key:string,phase:string,readiness:string,extra:any={}):any{
  return{
    behaviourKey:key,
    label:key.replaceAll('_',' '),
    phase,
    readiness,
    confidence:'HIGH',
    priority:80,
    prerequisite:null,
    prerequisiteLabel:null,
    whyNow:'Synthetic verified development reason.',
    gameRule:'SYNTHETIC GAME RULE.',
    graduationRule:'Synthetic graduation gate.',
    evidence:'Synthetic curriculum evidence.',
    comparableGames:5,
    cleanStreak:3,
    memoryStrength:75,
    transferStrength:phase==='TRANSFER'?45:null,
    transferGames:phase==='TRANSFER'?1:0,
    transferCleanStreak:phase==='TRANSFER'?1:0,
    repLadder:{version:1,level:3,maxLevel:5,stage:'STABILISE',label:'Synthetic',objective:'Synthetic',difficultyRule:'Synthetic',promotionGate:'Synthetic',demotionRule:'Synthetic',reason:'Synthetic',evidence:'Synthetic'},
    nextUnlock:null,
    ...extra,
  };
}

function curriculum():any{
  const owned=lesson('THREAT_ADAPTATION','GRADUATED','COMPLETE');
  const active=lesson('CARRY_PRESERVATION','TRANSFER','ACTIVE',{prerequisite:'THREAT_ADAPTATION',prerequisiteLabel:'Threat Adaptation'});
  const next=lesson('FIGHT_SELECTION','PRACTISE','READY');
  const locked=lesson('SURVIVAL_VALUE','FOUNDATION','LOCKED',{prerequisite:'CARRY_PRESERVATION',prerequisiteLabel:'Carry Preservation'});
  return{
    version:1,
    generatedAt:'2026-09-23T00:00:00.000Z',
    gamesAnalyzed:18,
    status:'ACTIVE',
    currentLesson:active,
    nextLesson:next,
    queue:[active,next,locked],
    graduated:[owned],
    repLedger:{},
    careerMatrix:{
      version:1,
      generatedAt:'x',
      gamesAnalyzed:18,
      recommendedSkill:'CARRY_PRESERVATION',
      selectionMode:'HOLD',
      recommendationReason:'Hold active contract.',
      candidates:[],
      deferred:[],
      boundary:'test',
    },
    autonomous:{
      version:1,
      generatedAt:'x',
      gamesAnalyzed:18,
      state:'TRANSFER_TEST',
      action:'RETEST_TRANSFER',
      activeContract:{
        id:'learning-contract:carry-preservation:g12',
        objectiveKey:'CARRY_PRESERVATION',
        objectiveLabel:'Carry Preservation',
        state:'TRANSFER_TEST',
        action:'RETEST_TRANSFER',
        startedGame:12,
        ageGames:7,
        supportPolicy:'FADED',
        testDirective:{mode:'TRANSFER_TEST',required:true,behaviourKey:'CARRY_PRESERVATION',freezeBeforeGame:true,needsNovelChampionOrContext:true,scoreNotObservedAs:'NO_CHANGE',instruction:'Prove Carry Preservation on a new champion or pressure pattern.'},
        gates:[],
        completion:84,
        stopTeachingWhen:'When owned.',
        graduateWhen:'When principle owned.',
        replacement:{nextBehaviourKey:'FIGHT_SELECTION',nextLabel:'Fight Selection',reason:'Next unlocked lesson.',blockedBy:null},
        decisionReason:'Hold current objective.',
        evidenceSummary:'Local mastery secure; transfer incomplete.',
      },
      previousObjectiveKey:'CARRY_PRESERVATION',
      objectiveChanges:2,
      summary:'Synthetic',
      boundary:'Synthetic',
    },
    decision:{action:'KEEP',previousLesson:'CARRY_PRESERVATION',currentLesson:'CARRY_PRESERVATION',changed:false,reason:'Hold.'},
    summary:'Synthetic curriculum.',
    boundary:'Synthetic boundary.',
  };
}

function journey():any{
  return{
    version:1,
    generatedAt:'2026-09-23T00:00:00.000Z',
    gamesAnalyzed:18,
    stage:'MASTERING',
    headline:'Synthetic journey.',
    currentFocus:null,
    summary:{verifiedPatterns:3,improvingPatterns:1,masteredPatterns:1,regressingPatterns:1,coachedDecisions:5,coachedExecuted:4,coachedMissed:1,coachingExecutionRate:80},
    events:[
      {id:'mastered',type:'MASTERED',at:'2026-09-22T20:00:00.000Z',gameNumber:17,title:'Pattern mastered · Threat Adaptation',detail:'Repeated verified transfer proved the principle.',behaviourKey:'THREAT_ADAPTATION',behaviourLabel:'Threat Adaptation',situationTag:'MULTI_ACCESS',patternId:'x',state:'MASTERED',evidence:{}},
      {id:'regressed',type:'REGRESSED',at:'2026-09-21T20:00:00.000Z',gameNumber:15,title:'Regression detected · Reset Discipline',detail:'Comparable mistakes returned.',behaviourKey:'RESET_DISCIPLINE',behaviourLabel:'Reset Discipline',situationTag:'HIGH_BANK_FIGHT',patternId:'y',state:'REGRESSING',evidence:{}},
    ],
  };
}

test('Career Experience converts curriculum truth into owned active next locked career states',()=>{
  const career=buildClimbCareerExperience(curriculum(),journey(),'2026-09-23T00:00:00.000Z');
  const byKey=new Map(career.skills.map(skill=>[skill.key,skill]));
  assert.equal(byKey.get('THREAT_ADAPTATION')?.state,'OWNED');
  assert.equal(byKey.get('CARRY_PRESERVATION')?.state,'ACTIVE');
  assert.equal(byKey.get('FIGHT_SELECTION')?.state,'NEXT');
  assert.equal(byKey.get('SURVIVAL_VALUE')?.state,'LOCKED');
  assert.equal(career.activeObjective?.completion,84);
  assert.equal(career.activeObjective?.supportPolicy,'FADED');
  assert.equal(career.activeObjective?.replacementLabel,'Fight Selection');
  assert.equal(career.developmentStage,'PRINCIPLE_OWNERSHIP');
});

test('Career Experience never labels unseen skills owned or active',()=>{
  const career=buildClimbCareerExperience(curriculum(),journey());
  const unseen=career.skills.filter(skill=>!['THREAT_ADAPTATION','CARRY_PRESERVATION','FIGHT_SELECTION','SURVIVAL_VALUE'].includes(skill.key));
  assert.ok(unseen.every(skill=>!['OWNED','ACTIVE','REOPENED'].includes(skill.state)));
});

test('Career Experience exposes verified breakthroughs and regressions without inventing history',()=>{
  const career=buildClimbCareerExperience(curriculum(),journey());
  assert.equal(career.recentBreakthrough?.tone,'BREAKTHROUGH');
  assert.equal(career.recentBreakthrough?.behaviourKey,'THREAT_ADAPTATION');
  assert.equal(career.latestRegression?.tone,'REGRESSION');
  assert.equal(career.latestRegression?.behaviourKey,'RESET_DISCIPLINE');
  assert.equal(career.summary.milestones,2);
});

test('Stage 3 Progress surface and API are wired to the career projection',()=>{
  const page=fs.readFileSync('app/progress/page.tsx','utf8');
  const component=fs.readFileSync('components/CareerDevelopmentMap.tsx','utf8');
  const route=fs.readFileSync('app/api/career-experience/route.ts','utf8');
  assert.ok(page.includes('CareerDevelopmentMap'));
  assert.ok(component.includes('PLAYER DEVELOPMENT CAREER · STAGE 3'));
  assert.ok(component.includes('WHAT REPLACES IT'));
  assert.ok(component.includes('CAREER HISTORY'));
  assert.ok(route.includes('buildClimbCareerExperience'));
  assert.ok(route.includes("grounding:'verified-curriculum+autonomous-learning-contract+learning-journey'"));
});
