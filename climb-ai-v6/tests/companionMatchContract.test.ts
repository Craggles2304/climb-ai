import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCompanionMatchContract,reviewCompanionMatchContract} from '../lib/companionMatchContract';

const branch=(key:string)=>({
  key,
  headline:key+' CALL',
  rule:'RULE',
  fight:'FIGHT RULE',
  objective:'OBJECTIVE RULE',
  never:'STOP RULE',
  decisionRisk:'RISK RULE',
  priority:key==='BEHIND'?'STABILISE':'SET UP',
  job:key+' JOB',
  fightWhen:'FIGHT WHEN READY',
  stop:'STOP THE BAD FIGHT',
});

const playbook:any={
  version:'FROZEN_V1',
  draftFingerprint:'draft',
  champion:'Jinx',
  role:'ADC',
  rank:'Gold IV',
  baseCall:'FRONT TO BACK · PROTECT JINX',
  baseWhy:'Jinx is the primary sustained damage condition.',
  fightRule:'WAIT FOR FIRST ACCESS THEN HIT THE CLOSEST SAFE TARGET.',
  objectiveRule:'RESET FIRST AND ARRIVE WITH YOUR FRONT LINE.',
  threatRule:'TRACK THE SECOND ACCESS LAYER.',
  never:'DO NOT CROSS THE THREAT LINE FOR THE BACK LINE.',
  branches:{AHEAD:branch('AHEAD'),EVEN:branch('EVEN'),BEHIND:branch('BEHIND')},
  checkpoints:[
    {minute:5,prompt:'5 MIN',questions:['CHOOSE AHEAD / EVEN / BEHIND','PLAN A?','IS LANE STILL PLAYABLE?']},
    {minute:10,prompt:'10 MIN',questions:['CHOOSE AHEAD / EVEN / BEHIND']},
    {minute:15,prompt:'15 MIN',questions:['CHOOSE AHEAD / EVEN / BEHIND']},
  ],
  carryMap:{playerJob:'SURVIVE FIRST CONTACT → KEEP DPS UPTIME'},
  contingencyMap:{},
};

const coach:any={
  headline:'FRONT TO BACK',
  why:'Your team wins by keeping Jinx alive through first contact.',
  theirPlan:'BLITZCRANK PICK → COLLAPSE BEFORE YOUR FRONT LINE SETS.',
  threats:['Blitzcrank','Nocturne'],
  threatAnswer:'KEEP RANGE AND TRACK THE SECOND ACCESS LAYER.',
  fightTrigger:'FIGHT AFTER FIRST ACCESS IS SPENT OR CONTROLLED.',
  objectiveSetup:'RESET FIRST, THEN ENTER WITH FRONT LINE.',
  never:'DO NOT WALK PAST FRONT LINE FOR A LOW-VALUE TARGET.',
};

const mission:any={
  status:'READY',
  behaviourLabel:'Carry Preservation',
  cue:'FIRST CONTACT DOES NOT REMOVE THE SECOND THREAT.',
  trigger:'WHEN BLITZCRANK OR NOCTURNE START FIRST CONTACT.',
  successDefinition:'KEEP SAFE DPS UPTIME UNTIL BOTH ACCESS LAYERS ARE ACCOUNTED FOR.',
  failureDefinition:'CROSS THE THREAT LINE WHILE A SECOND ACCESS LAYER IS LIVE.',
  rehearsalQuestion:'WHAT THREAT IS STILL LIVE AFTER FIRST CONTACT?',
  reviewRule:'SCORE ONLY VERIFIED CARRY-PRESERVATION DECISIONS.',
};

const transfer:any={
  transferId:'transfer-1',
  behaviourLabel:'Carry Preservation',
  state:'TESTING',
  title:'TRANSFER TEST · CARRY PRESERVATION',
  targetMove:'APPLY THE PRINCIPLE WITHOUT THE OLD CHAMPION CUE.',
  principle:'FIRST CONTACT DOES NOT REMOVE THE REMAINING THREAT.',
  trigger:'WHEN THE FIRST ACCESS LAYER COMMITS.',
  whyNow:'This draft gives the learned principle a novel champion/context test.',
};

test('Match Contract gives one coherent player-facing hierarchy',()=>{
  const contract=buildCompanionMatchContract({
    champion:'Jinx',role:'ADC',rank:'Gold IV',coach,playbook,
    personalTrap:{status:'READY',title:'SECOND ACCESS',cue:'DO NOT WALK FORWARD AFTER FIRST CONTACT.',proof:'Repeated evidence'} as any,
    mission,scenarioPrime:null,transferPrime:transfer,
    coachIntervention:{primaryCue:'NAME THE SECOND THREAT BEFORE YOU STEP FORWARD.',deliveryPolicy:'LIGHT'} as any,
    coachingStrategy:{deliveryPolicy:'LIGHT'} as any,
    experimentSchedule:null,
    intentProbe:{version:1,id:'probe-1',response:null,prompt:'WHICH BRANCH WILL YOU TAKE?'} as any,
  });
  assert.equal(contract.version,'MATCH_OS_V1');
  assert.equal(contract.learning.mode,'TRANSFER_TEST');
  assert.equal(contract.strategic.yourJob,'SURVIVE FIRST CONTACT → KEEP DPS UPTIME');
  assert.equal(contract.phaseDeck.length,5);
  assert.equal(contract.policy.usesLiveTelemetryForTactics,false);
  assert.equal(contract.policy.playerChoosesGameState,true);
  assert.equal(contract.scaffolding.deliveryPolicy,'LIGHT');
  assert.equal(contract.scaffolding.intentRequiredBeforeCue,true);
  assert.equal(contract.scaffolding.revealSpecificCueAfterIntent,true);
});

test('Match Contract review keeps NOT OBSERVED neutral and recognises transfer success',()=>{
  const contract=buildCompanionMatchContract({
    champion:'Jinx',role:'ADC',rank:'Gold IV',coach,playbook,
    personalTrap:null,mission,scenarioPrime:null,transferPrime:transfer,
    coachIntervention:null,coachingStrategy:null,experimentSchedule:null,
  });
  const baseMission:any={status:'NOT_OBSERVED',matchedMoments:0,cleanMoments:0,improveMoments:0,note:'No mission window.'};
  const baseMemory:any={status:'NO_REP',matchedMoments:0,cleanMoments:0,improveMoments:0,note:'No spaced rep.'};
  const notObserved=reviewCompanionMatchContract({
    contract,mission:baseMission,scenarioPrime:baseMemory,
    transfer:{status:'NOT_OBSERVED',matchedMoments:0,cleanMoments:0,improveMoments:0,note:'Transfer window did not occur.'} as any,
  });
  assert.equal(notObserved.status,'NOT_OBSERVED');

  const executed=reviewCompanionMatchContract({
    contract,mission:baseMission,scenarioPrime:baseMemory,
    transfer:{status:'TRANSFERRED',matchedMoments:1,cleanMoments:1,improveMoments:0,note:'Novel carry-preservation branch executed.'} as any,
  });
  assert.equal(executed.status,'EXECUTED');
  assert.equal(executed.cleanMoments,1);
});


test('Autonomy mode keeps the strategic plan visible but fades the learning answer',()=>{
  const contract=buildCompanionMatchContract({
    champion:'Jinx',role:'ADC',rank:'Gold IV',coach,playbook,
    personalTrap:null,mission,scenarioPrime:null,transferPrime:null,
    coachIntervention:null,
    coachingStrategy:{deliveryPolicy:'NONE',autonomyTest:true,mode:'FADE'} as any,
    experimentSchedule:null,
    intentProbe:null,
  });
  assert.equal(contract.scaffolding.autonomyTest,true);
  assert.equal(contract.scaffolding.deliveryPolicy,'NONE');
  assert.equal(contract.scaffolding.revealSpecificCueAfterIntent,false);
  assert.equal(contract.strategic.ourWinCondition,'FRONT TO BACK · PROTECT JINX');
});


test('Coach Memory carries verified prior-game evidence into the next Match Contract',()=>{
  const historyRows:any[]=[{
    createdAt:'2026-09-22T20:00:00.000Z',
    analysis:{
      version:1,
      decisionGraph:{summary:{matchContract:{
        active:true,
        status:'MISSED',
        behaviour:'Carry Preservation',
        mode:'CURRICULUM_REP',
        proof:'The second-access branch was missed in the verified decision window.',
      }}},
    },
  }];
  const contract=buildCompanionMatchContract({
    champion:'Jinx',role:'ADC',rank:'Gold IV',coach,playbook,
    personalTrap:null,mission,scenarioPrime:null,transferPrime:transfer,
    coachIntervention:null,coachingStrategy:{deliveryPolicy:'LIGHT'} as any,
    experimentSchedule:null,intentProbe:null,historyRows,
  });
  assert.equal(contract.continuity.available,true);
  assert.equal(contract.continuity.previousStatus,'MISSED');
  assert.equal(contract.continuity.previousBehaviour,'Carry Preservation');
  assert.match(contract.continuity.whyNow,/novel champion\/context test/i);
});
