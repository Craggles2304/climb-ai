import test from 'node:test';
import assert from 'node:assert/strict';
import {coachRankRubric,evaluateWinConditionPlan,type CoachEvalPlan} from '../lib/coachWinConditionEval';

const ours=[
  {champion:'Shen',role:'TOP'},
  {champion:'Master Yi',role:'JUNGLE'},
  {champion:'Annie',role:'MID'},
  {champion:"Kog'Maw",role:'ADC'},
  {champion:'Karma',role:'SUPPORT'},
];
const enemies=[
  {champion:'Irelia',role:'TOP'},
  {champion:'Volibear',role:'JUNGLE'},
  {champion:'Heimerdinger',role:'MID'},
  {champion:'Miss Fortune',role:'ADC'},
  {champion:'Fiddlesticks',role:'SUPPORT'},
];
const kits=[
  {champion:"Kog'Maw",spells:[{name:'Bio-Arcane Barrage'}]},
  {champion:'Shen',spells:[{name:'Stand United'}]},
  {champion:'Master Yi',spells:[{name:'Alpha Strike'}]},
  {champion:'Annie',passive:'Pyromania: after four spells Annie stuns',spells:[{name:'Disintegrate'},{name:'Summon: Tibbers'}]},
  {champion:'Karma',spells:[{name:'Focused Resolve'},{name:'Inspire'}]},
  {champion:'Irelia',spells:[{name:'Flawless Duet'},{name:"Vanguard's Edge"}]},
  {champion:'Volibear',spells:[{name:'Thundering Smash'},{name:'Stormbringer'}]},
  {champion:'Heimerdinger',spells:[{name:'H-28 G Evolution Turret'},{name:'CH-2 Electron Storm Grenade'}]},
  {champion:'Miss Fortune',spells:[{name:'Double Up'},{name:'Bullet Time'}]},
  {champion:'Fiddlesticks',spells:[{name:'Terrify'},{name:'Crowstorm'}]},
];

const tiers=['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER'] as const;

function planForRank(tier:typeof tiers[number]):CoachEvalPlan{
  const depth=tiers.indexOf(tier);
  const silver=depth>=2,gold=depth>=3,platinum=depth>=4,emerald=depth>=5,diamond=depth>=6,master=depth>=7,grandmaster=depth>=8,challenger=depth>=9;
  const laneTrade=gold
    ?'AFTER Miss Fortune spends Double Up on the wave, take one short trade and return to farm range.'
    :'Miss Fortune is the trade reference: punish her only from your normal farm range.';
  const threatAnswer=grandmaster
    ?`WHEN Volibear uses Thundering Smash or Irelia commits Vanguard's Edge, keep Annie / Shen between them and Kog'Maw; IF Fiddlesticks remains unseen, preserve your second defensive resource${challenger?'; WHEN Heimerdinger owns the choke, shift the fight to the opposite entry before extending':''}.`
    :silver
    ?platinum
      ?'WHEN Volibear uses Thundering Smash or Irelia commits, keep Annie between them and Kog\'Maw; preserve your escape for the second entry.'
      :'WHEN Irelia or Volibear enters, keep Annie between them and Kog\'Maw and kite backward.'
    :'Keep Annie between Irelia / Volibear and Kog\'Maw; kite backward instead of crossing their front line.';
  const fightTrigger=master
    ?'AFTER Irelia shows Flawless Duet and Volibear commits Thundering Smash, Kog\'Maw can extend Bio-Arcane Barrage range and hit the closest safe target; respect Crowstorm from fog.'
    :platinum
      ?'AFTER Irelia or Volibear commits into Annie, Kog\'Maw starts DPS on the closest safe target.'
      :'WHEN Irelia commits into Annie, Kog\'Maw starts DPS on the closest safe target.';
  const objectiveSetup=emerald
    ?'BEFORE dragon, arrive first so Heimerdinger cannot own the choke and Fiddlesticks cannot approach unseen from fog.'
    :'Arrive first at dragon so Heimerdinger cannot own the choke before Kog\'Maw is in position.';
  const why=diamond
    ?'IF Irelia / Volibear cannot cross Annie and Shen to reach Kog\'Maw, their first contact stalls and your sustained damage wins the long fight.'
    :'Irelia / Volibear must reach Kog\'Maw; Annie and Shen can turn that first contact into your sustained-DPS window.';
  const ifBehind=master
    ?'IF behind, concede the first unsafe river entrance, clear the nearest safe wave, then make Volibear / Irelia enter Annie and Shen to reach Kog\'Maw.'
    :'Clear the nearest safe wave, group around Annie / Shen, and make Irelia / Volibear enter your formation.';
  const theirPlan=master
    ?'Volibear starts with Thundering Smash, Irelia layers Flawless Duet, Fiddlesticks looks for Crowstorm from fog, then Miss Fortune channels Bullet Time while Heimerdinger owns the choke.'
    :emerald
      ?'Volibear and Irelia force Kog\'Maw backward while Fiddlesticks attacks from fog and Heimerdinger controls the retreat space.'
      :'Irelia and Volibear want to reach Kog\'Maw first so Miss Fortune can damage a disrupted back line.';

  return{
    headline:'SCALE WITHOUT GIVING DIVE ACCESS',
    why,
    theirPlan,
    threatLabel:'DIVE PACKAGE',
    threats:['Irelia','Volibear','Fiddlesticks'],
    threatAnswer,
    laneOpponent:'Miss Fortune',
    lanePlan:{
      wave:'Keep the wave on Kog\'Maw\'s side of centre versus Miss Fortune so one missed CS is cheaper than losing the HP needed for the next wave.',
      trade:laneTrade,
      respect:'Do not step through the wave toward Miss Fortune while Volibear can reach bot first.',
    },
    fightTrigger,
    objectiveSetup,
    never:'Do not walk through Irelia / Volibear just to reach Miss Fortune; Kog\'Maw hits the closest safe target.',
    ifBehind,
    steps:[
      {label:'1 · ECONOMY',value:"Kog'Maw reaches the first two damage items without donating deaths."},
      {label:'2 · POSITION',value:'Annie / Shen stay between Kog\'Maw and Irelia / Volibear.'},
      {label:'3 · ABSORB',value:'Irelia / Volibear spend first access into the front edge → Kog\'Maw keeps range.'},
      {label:'4 · DPS',value:'Kog\'Maw hits the closest safe target → move forward only as their access disappears.'},
      {label:'5 · CONVERT',value:'Won front-to-back fight → dragon / Baron before Heimerdinger can rebuild the zone.'},
    ],
  };
}

test('the paid-coach benchmark covers every solo-queue tier from Iron through Challenger',()=>{
  const results=tiers.map(tier=>{
    const result=evaluateWinConditionPlan({plan:planForRank(tier),ours,enemies,kits,rank:tier,role:'ADC'});
    assert.equal(result.tier,tier);
    assert.equal(result.pass,true,`${tier} failed ${result.score}/${result.rubric.passScore}: ${result.issues.join('; ')}`);
    return result;
  });
  for(let i=1;i<results.length;i++){
    assert.ok(results[i].rubric.passScore>=results[i-1].rubric.passScore,'rank pass standard must never get easier as rank rises');
    assert.ok(results[i].rubric.minConditionalRules>=results[i-1].rubric.minConditionalRules,'decision-rule depth must scale upward');
    assert.ok(results[i].rubric.minAbilityMentions>=results[i-1].rubric.minAbilityMentions,'kit-specific requirement must scale upward');
  }
});

test('an Iron-level answer is deliberately not accepted as Master coaching',()=>{
  const iron=planForRank('IRON');
  const result=evaluateWinConditionPlan({plan:iron,ours,enemies,kits,rank:'MASTER',role:'ADC'});
  assert.equal(result.pass,false);
  assert.ok(result.issues.some(issue=>issue.includes('ability/passive')||issue.includes('decision rules')));
});

test('a Master answer is too branched for Iron presentation even when the underlying read is strong',()=>{
  const master=planForRank('MASTER');
  const result=evaluateWinConditionPlan({plan:master,ours,enemies,kits,rank:'IRON',role:'ADC'});
  assert.equal(result.pass,false);
  assert.ok(result.issues.some(issue=>issue.includes('too many branches')));
});

test('generic League advice fails a paid-coach win-condition benchmark',()=>{
  const generic:CoachEvalPlan={
    headline:'FARM AND SCALE',
    why:'Play safe and scale up.',
    theirPlan:'They want to fight.',
    threatLabel:'MAIN THREAT',
    threats:['Irelia'],
    threatAnswer:'Stay connected and play safe.',
    laneOpponent:'Miss Fortune',
    lanePlan:{wave:'Farm clean.',trade:'Trade when a key spell misses.',respect:'Do not die.'},
    fightTrigger:'Wait for team.',
    objectiveSetup:'Focus objectives.',
    never:'Do not force.',
    ifBehind:'Farm clean and group with your team.',
    steps:[
      {label:'1',value:'Farm clean'},
      {label:'2',value:'Play safe'},
      {label:'3',value:'Stay connected'},
      {label:'4',value:'Take a good fight'},
      {label:'5',value:'Focus objectives'},
    ],
  };
  for(const tier of ['GOLD','PLATINUM','EMERALD','DIAMOND','MASTER'] as const){
    const result=evaluateWinConditionPlan({plan:generic,ours,enemies,kits,rank:tier,role:'ADC'});
    assert.equal(result.pass,false,`${tier} unexpectedly accepted generic advice`);
    assert.ok(result.score<result.rubric.passScore||result.issues.length>0);
  }
});

test('Master coaching requires real champion and kit interactions, not just more words',()=>{
  const result=evaluateWinConditionPlan({plan:planForRank('MASTER'),ours,enemies,kits,rank:'MASTER',role:'ADC'});
  assert.ok(result.metrics.championMentions.length>=5);
  assert.ok(result.metrics.abilityMentions.length>=3);
  assert.ok(result.metrics.conditionalRules>=6);
  assert.equal(result.metrics.laneSpecific,true);
  assert.equal(result.metrics.threatCounterSpecific,true);
  assert.equal(result.metrics.theirPlanSpecific,true);
  assert.equal(result.metrics.fightTriggerSpecific,true);
  assert.equal(result.metrics.objectiveSetupSpecific,true);
  assert.equal(result.metrics.causalSteps,true);
  assert.equal(result.metrics.adcTargetRule,true);
});

test('rank rubrics explicitly step from simple decisions to Challenger fine-margin analysis',()=>{
  const iron=coachRankRubric('Iron IV');
  const gold=coachRankRubric('Gold II');
  const emerald=coachRankRubric('Emerald I');
  const master=coachRankRubric('Master 200 LP');
  const grandmaster=coachRankRubric('Grandmaster 500 LP');
  const challenger=coachRankRubric('Challenger 900 LP');
  assert.equal(iron.tier,'IRON');
  assert.equal(challenger.tier,'CHALLENGER');
  assert.ok(iron.passScore<gold.passScore&&gold.passScore<emerald.passScore&&emerald.passScore<master.passScore&&master.passScore<grandmaster.passScore&&grandmaster.passScore<challenger.passScore);
  assert.equal(iron.minAbilityMentions,0);
  assert.ok(master.minAbilityMentions>=3);
  assert.ok(grandmaster.minAbilityMentions>=4);
  assert.ok(challenger.minConditionalRules>=8);
  assert.ok(challenger.theirPlanEnemyMentions>=3);
  assert.equal(challenger.maxGenericHits,0);
});
