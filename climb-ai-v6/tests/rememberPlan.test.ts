import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRememberPlan} from '../lib/champions/rememberPlan';

const adcTeam={
  ourIdentity:'Front-to-back teamfight',
  teamfight:{label:'FRONT TO BACK',summary:'Keep formation.'},
  ourTeam:[
    {name:'Ornn',role:'TOP'},
    {name:'Sejuani',role:'JUNGLE'},
    {name:'Viktor',role:'MID'},
    {name:'Aphelios',role:'ADC'},
    {name:'Lulu',role:'SUPPORT'},
  ],
  theirTeam:[
    {name:'Camille',role:'TOP'},
    {name:'Vi',role:'JUNGLE'},
    {name:'Ahri',role:'MID'},
    {name:"Kai'Sa",role:'ADC'},
    {name:'Nautilus',role:'SUPPORT'},
  ],
  roleWinCondition:{
    steps:[
      {key:'GET_TO',label:'GET TO',value:'CORE ITEMS'},
      {key:'STAY_WITH',label:'STAY WITH',value:'Sejuani / Lulu'},
      {key:'SURVIVE',label:'SURVIVE',value:'Vi / Camille — DO NOT STEP OUT BEFORE THEIR ACCESS IS COMMITTED'},
      {key:'DAMAGE',label:'DAMAGE',value:'PLAY BEHIND LULU → HIT THE NEAREST SAFE TARGET'},
      {key:'CONVERT',label:'CONVERT',value:'WON FIGHT → DRAGON, BARON OR TOWER → RESET'},
    ],
    lossCondition:'Vi / Camille reach Aphelios before peel is set.',
  },
  theirWinCondition:'They want simultaneous access to Aphelios.',
};

test('ADC remember plan compresses the locked draft into a five-second memory HUD',()=>{
  const plan=buildRememberPlan({champion:'Aphelios',role:'ADC',rank:'Gold II',teamPlan:adcTeam});
  assert.equal(plan.frozenFromChampSelect,true);
  assert.equal(plan.usesLiveTelemetry,false);
  assert.equal(plan.draft.powerCurve,'SCALING');
  assert.equal(plan.draft.teamShape,'FRONT TO BACK');
  assert.equal(plan.playWith,'Sejuani / Lulu');
  assert.equal(plan.watch,'Camille / Vi');
  assert.match(plan.winPath,/SCALE/);
  assert.match(plan.winPath,/DPS/);
  assert.equal(plan.resourceTarget.label,'CS TARGET');
  assert.equal(plan.resourceTarget.headline,'7.2 CS/MIN');
  assert.deepEqual(plan.resourceTarget.checkpoints,[{minute:10,target:70},{minute:15,target:110},{minute:20,target:145}]);
  assert.match(plan.behindPlan,/SAFE FARM/);
  assert.deepEqual(plan.checks.map(check=>check.minute),[5,10,15]);
});

test('support gets a map target rather than a fake CS target',()=>{
  const supportTeam={...adcTeam,roleWinCondition:{steps:[
    {key:'ENABLE',label:'ENABLE',value:'Aphelios'},
    {key:'SET_UP',label:'SET UP',value:'MOVE WITH Sejuani → VISION FIRST'},
    {key:'STOP',label:'STOP',value:'Vi / Camille REACHING Aphelios'},
    {key:'EXECUTE',label:'EXECUTE',value:'PROTECT APHELIOS'},
    {key:'CONVERT',label:'CONVERT',value:'VISION → OBJECTIVE'},
  ],lossCondition:'Leave Aphelios alone.'}};
  const plan=buildRememberPlan({champion:'Lulu',role:'SUPPORT',rank:'Gold II',teamPlan:supportTeam});
  assert.equal(plan.resourceTarget.kind,'MAP');
  assert.equal(plan.resourceTarget.label,'MAP TARGET');
  assert.equal(plan.resourceTarget.checkpoints.length,0);
  assert.match(plan.winPath,/SET VISION/);
});

test('early-game drafts produce an early pressure reminder and prebuilt fallback',()=>{
  const team={...adcTeam,ourIdentity:'Dive and collapse',teamfight:{label:'DIVE & COLLAPSE',summary:'Enter together.'},ourTeam:[
    {name:'Renekton',role:'TOP'},
    {name:'Lee Sin',role:'JUNGLE'},
    {name:'LeBlanc',role:'MID'},
    {name:'Draven',role:'ADC'},
    {name:'Nautilus',role:'SUPPORT'},
  ]};
  const plan=buildRememberPlan({champion:'Draven',role:'ADC',rank:'Platinum IV',teamPlan:team});
  assert.equal(plan.draft.powerCurve,'EARLY');
  assert.equal(plan.draft.teamShape,'DIVE');
  assert.match(plan.winPath,/CREATE EARLY LEAD/);
  assert.match(plan.statePlans.behind,/STOP FORCING|SAFE FARM/);
});
