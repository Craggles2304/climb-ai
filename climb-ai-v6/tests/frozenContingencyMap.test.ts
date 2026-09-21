import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDraftCarryMap} from '../lib/carryRoleMap';
import {buildFrozenContingencyMap} from '../lib/frozenContingencyMap';
import {buildFrozenGamePlaybook} from '../lib/frozenGamePlaybook';
import {buildRankAwareDraftPlan} from '../lib/draftCoachEngine';
import type {DraftRolePlayer} from '../lib/draftRoleResolver';

const P=(champion:string,role:string):DraftRolePlayer=>({champion,role} as DraftRolePlayer);

function plan(overrides:any={}){
  return{
    headline:'PLAY FRONT TO BACK',
    why:'PROTECT THE MAIN DAMAGE CONDITION AND FORCE THEM THROUGH YOUR FRONT LINE',
    threatLabel:'MAIN ACCESS THREAT',
    threats:['Vi'],
    threatAnswer:'LET VI COMMIT FIRST → PEEL BACK → RE-ENTER',
    lanePlan:{wave:'FIX THE SAFE WAVE',trade:'TRADE AFTER COOLDOWN',respect:'DO NOT OVERCHASE'},
    fightTrigger:'VI COMMITS FIRST AND YOUR DAMAGE CAN HIT SAFELY',
    objectiveSetup:'RESET EARLY → CONTROL ENTRANCES → HOLD FORMATION',
    never:'DO NOT CHASE PAST YOUR CARRY',
    ifBehind:'SAFE WAVES → GIVE LOST SPACE → BUY TIME',
    steps:[
      {label:'1',value:'FARM'},
      {label:'2',value:'SET UP'},
      {label:'3',value:'ABSORB'},
      {label:'4',value:'DPS'},
      {label:'5',value:'CONVERT'},
    ],
    ...overrides,
  } as any;
}

test('contingency map is frozen before game and always player-selected',()=>{
  const ours=[P('Ornn','TOP'),P('Sejuani','JUNGLE'),P('Orianna','MID'),P('Jinx','ADC'),P('Lulu','SUPPORT')];
  const enemies=[P('Jax','TOP'),P('Vi','JUNGLE'),P('Akali','MID'),P('Varus','ADC'),P('Nautilus','SUPPORT')];
  const carryMap=buildDraftCarryMap({champion:'Ornn',ours,enemies,mainThreat:'Vi'});
  const map=buildFrozenContingencyMap({champion:'Ornn',role:'TOP',carryMap,plan:plan()});
  assert.equal(map.version,'CONTINGENCY_V1');
  assert.equal(map.frozenFromPregame,true);
  assert.equal(map.usesLiveTelemetry,false);
  assert.equal(map.playerSelects,true);
  assert.equal(map.primaryCarry,'Jinx');
  assert.equal(map.contingencies.PLAN_A.available,true);
  assert.equal(map.contingencies.RECOVERY.available,true);
  assert.equal(map.contingencies.PLAN_A.priority,'ORIGINAL');
  assert.equal(map.contingencies.RECOVERY.priority,'STABILISE');
  assert.match(map.boundary,/PLAYER SELECTS/i);
  assert.match(map.boundary,/NEVER AUTO-SWITCHES/i);
});

test('Plan B promotes the credible secondary carry rather than inventing a new win condition',()=>{
  const ours=[P('Ornn','TOP'),P('Sejuani','JUNGLE'),P('Orianna','MID'),P('Jinx','ADC'),P('Lulu','SUPPORT')];
  const enemies=[P('Jax','TOP'),P('Vi','JUNGLE'),P('Akali','MID'),P('Varus','ADC'),P('Nautilus','SUPPORT')];
  const carryMap=buildDraftCarryMap({champion:'Ornn',ours,enemies,mainThreat:'Vi'});
  const map=buildFrozenContingencyMap({champion:'Ornn',role:'TOP',carryMap,plan:plan()});
  const b=map.contingencies.PLAN_B;
  assert.equal(b.available,true);
  assert.equal(b.priority,'SET UP');
  assert.equal(b.resourceOwner,'Orianna');
  assert.match(b.when,/Jinx CANNOT SAFELY FUNCTION/i);
  assert.match(b.when,/Orianna CAN STILL/i);
  assert.match(b.job,/KEEP Orianna PLAYABLE/i);
  assert.match(b.never,/DO NOT KEEP FUNNELLING THE ORIGINAL PLAN/i);
});

test('Plan B is disabled when champion select has no credible second carry',()=>{
  const ours=[P('Ornn','TOP'),P('Sejuani','JUNGLE'),P('Galio','MID'),P('Jhin','ADC'),P('Braum','SUPPORT')];
  const enemies=[P('Sion','TOP'),P('Jarvan IV','JUNGLE'),P('Lissandra','MID'),P('Ashe','ADC'),P('Leona','SUPPORT')];
  const carryMap=buildDraftCarryMap({champion:'Braum',ours,enemies,mainThreat:'Jarvan IV'});
  const map=buildFrozenContingencyMap({champion:'Braum',role:'SUPPORT',carryMap,plan:plan()});
  assert.equal(map.primaryCarry,'Jhin');
  assert.equal(map.secondaryCarry,null);
  assert.equal(map.contingencies.PLAN_B.available,false);
  assert.match(map.contingencies.PLAN_B.job,/NO VERIFIED SECONDARY CARRY/i);
  assert.equal(map.contingencies.RECOVERY.available,true);
});

test('secondary carry gets an explicit resource responsibility when Plan B is selected',()=>{
  const ours=[P('Ornn','TOP'),P('Sejuani','JUNGLE'),P('Orianna','MID'),P('Jinx','ADC'),P('Lulu','SUPPORT')];
  const enemies=[P('Jax','TOP'),P('Vi','JUNGLE'),P('Akali','MID'),P('Varus','ADC'),P('Nautilus','SUPPORT')];
  const carryMap=buildDraftCarryMap({champion:'Orianna',ours,enemies,mainThreat:'Vi'});
  const map=buildFrozenContingencyMap({champion:'Orianna',role:'MID',carryMap,plan:plan()});
  assert.equal(map.contingencies.PLAN_B.resourceOwner,'Orianna');
  assert.match(map.contingencies.PLAN_B.job,/BECOME THE MAIN DAMAGE CONDITION/i);
  assert.match(map.contingencies.PLAN_B.job,/SAFE HIGH-VALUE RESOURCES/i);
});

test('Recovery changes the shape of the game without pretending to detect live state',()=>{
  const ours=[P('Camille','TOP'),P('Vi','JUNGLE'),P('Ahri','MID'),P('Jhin','ADC'),P('Thresh','SUPPORT')];
  const enemies=[P('Ornn','TOP'),P('Sejuani','JUNGLE'),P('Viktor','MID'),P('Jinx','ADC'),P('Lulu','SUPPORT')];
  const carryMap=buildDraftCarryMap({champion:'Thresh',ours,enemies,mainThreat:'Jinx'});
  const map=buildFrozenContingencyMap({
    champion:'Thresh',
    role:'SUPPORT',
    carryMap,
    plan:plan({
      headline:'PICK FIRST → PLAY THE 5V4',
      why:'AHRI / VI / THRESH CREATE THE NUMBERS EDGE FROM FOG',
      fightTrigger:'CATCH ONE PLAYER BEFORE THE OBJECTIVE',
      objectiveSetup:'CONTROL VISION → HOLD FOG → CATCH ENTRY',
      steps:[{label:'1',value:'VISION'},{label:'2',value:'FOG PICK'}],
    }),
  });
  const recovery=map.contingencies.RECOVERY;
  assert.equal(recovery.playAround,'PICK / FOG');
  assert.match(recovery.job,/VISION \/ PICK TOOLS/i);
  assert.match(recovery.fightWhen,/ENEMY SPENDS ACCESS/i);
  assert.equal(map.usesLiveTelemetry,false);
});

test('frozen game playbook carries the contingency map through all fake game-state branches',()=>{
  const ours=[P('Ornn','TOP'),P('Sejuani','JUNGLE'),P('Orianna','MID'),P('Jinx','ADC'),P('Lulu','SUPPORT')];
  const enemies=[P('Jax','TOP'),P('Vi','JUNGLE'),P('Akali','MID'),P('Varus','ADC'),P('Nautilus','SUPPORT')];
  const draftPlan=buildRankAwareDraftPlan({champion:'Ornn',role:'TOP',ours,enemies,rank:'GOLD'});
  const playbook=buildFrozenGamePlaybook({champion:'Ornn',role:'TOP',rank:'GOLD',ours,enemies,plan:draftPlan});
  assert.equal(playbook.contingencyMap.version,'CONTINGENCY_V1');
  assert.equal(playbook.contingencyMap.playerSelects,true);
  assert.equal(playbook.contingencyMap.usesLiveTelemetry,false);
  assert.deepEqual(Object.keys(playbook.contingencyMap.contingencies),['PLAN_A','PLAN_B','RECOVERY']);
  for(const checkpoint of playbook.checkpoints){
    assert.ok(checkpoint.questions.some(question=>/PLAN A|FROZEN PLAN|CONTINGENCY/i.test(question)));
  }
});
