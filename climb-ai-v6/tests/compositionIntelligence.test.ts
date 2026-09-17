import test from 'node:test';
import assert from 'node:assert/strict';
import type {ChampionDetail} from '../lib/champions/ddragon';
import type {RoleWinCondition,TeamPickInput} from '../lib/champions/teamCompPlan';
import {buildCompositionStrategy} from '../lib/champions/compositionIntelligence';

const base=(role:string):RoleWinCondition=>({
  role,
  title:`YOUR ${role} WIN CONDITION`,
  summary:'BASE',
  lossCondition:'BASE LOSS',
  compPlan:'BASE PLAN',
  steps:[
    {key:'ONE',label:'GET TO',value:'CORE ITEM WINDOW'},
    {key:'TWO',label:'STEP 2',value:'TWO'},
    {key:'THREE',label:'STEP 3',value:'THREE'},
    {key:'FOUR',label:'STEP 4',value:'FOUR'},
    {key:'FIVE',label:'CONVERT',value:'FIVE'},
  ],
});

function detail(name:string,tags:string[],attackRange=175,tips:string[]=[]):ChampionDetail{
  return {
    id:name.replace(/[^A-Za-z0-9]/g,''),key:'1',name,title:'',tags,partype:'Mana',
    info:{attack:5,defense:5,magic:5,difficulty:5},
    stats:{hp:600,hpperlevel:100,armor:30,armorperlevel:4,spellblock:30,spellblockperlevel:1.3,attackdamage:60,attackdamageperlevel:3,attackspeed:.65,attackspeedperlevel:2,movespeed:335,attackrange:attackRange},
    spells:[],passive:{name:'Passive',description:''},allytips:tips,enemytips:[],
  } as ChampionDetail;
}

function mapOf(list:ChampionDetail[]){return new Map(list.map(item=>[item.name.toLowerCase().replace(/[^a-z0-9]/g,''),item]));}
function pick(name:string,role:string):TeamPickInput{return{name,role,lockedIn:true};}

const roster=[
  detail('Ornn',['Tank','Fighter'],175,['Initiate fights and knock up enemies.']),
  detail('Sejuani',['Tank','Fighter'],175,['Stun enemies and initiate with your team.']),
  detail('Orianna',['Mage','Support'],525,['Shield an ally and control team fights.']),
  detail('Jinx',['Marksman'],525,['Attack speed helps sustained damage.']),
  detail('Lulu',['Support','Mage'],550,['Shield and protect an ally. Slow divers.']),
  detail('Camille',['Fighter','Assassin'],125,['Dive isolated targets and duel in a side lane.']),
  detail('Vi',['Fighter','Assassin'],125,['Charge and dive the enemy back line.']),
  detail('Ahri',['Mage','Assassin'],550,['Charm and pick off isolated targets.']),
  detail("Kai'Sa",['Marksman','Mage'],525,['Follow allied engage and deal sustained damage.']),
  detail('Nautilus',['Tank','Support'],175,['Hook enemies and initiate fights.']),
  detail('Zed',['Assassin'],125,['Assassinate isolated targets from a flank.']),
  detail('Jarvan IV',['Tank','Fighter'],175,['Initiate and trap enemy carries.']),
  detail('Aphelios',['Marksman'],550,['Deal sustained damage from range.']),
];
const details=mapOf(roster);

const frontAllies=[pick('Ornn','TOP'),pick('Sejuani','JUNGLE'),pick('Orianna','MID'),pick('Jinx','ADC'),pick('Lulu','SUPPORT')];
const diveEnemies=[pick('Camille','TOP'),pick('Vi','JUNGLE'),pick('Ahri','MID'),pick("Kai'Sa",'ADC'),pick('Nautilus','SUPPORT')];

test('ADC read names real protectors and real access threats from the locked 5v5',()=>{
  const result=buildCompositionStrategy({localChampion:'Jinx',localRole:'ADC',allies:frontAllies,enemies:diveEnemies,details,baseRoleWinCondition:base('ADC')});
  assert.equal(result.roleWinCondition.steps.length,5);
  assert.deepEqual(result.roleWinCondition.steps.map(step=>step.label),['GET TO','STAY WITH','SURVIVE','DAMAGE','CONVERT']);
  assert.match(result.roleWinCondition.steps[1].value,/Lulu|Orianna|Ornn|Sejuani/);
  assert.match(result.roleWinCondition.steps[2].value,/Vi|Camille|Nautilus|Ahri/);
  assert.match(result.roleWinCondition.steps[3].value,/NEAREST SAFE TARGET/);
  assert.equal(result.compositionRead.frozenFromChampSelect,true);
  assert.equal(result.compositionRead.usesLiveTelemetry,false);
  assert.equal(result.compositionRead.confidence,'HIGH');
  assert.ok(result.compositionRead.interactions.some(edge=>edge.type==='THREATENS'&&edge.to==='Jinx'));
});

test('assassin mid is told to create angle instead of standing front-to-back',()=>{
  const allies=[pick('Ornn','TOP'),pick('Jarvan IV','JUNGLE'),pick('Zed','MID'),pick('Aphelios','ADC'),pick('Lulu','SUPPORT')];
  const result=buildCompositionStrategy({localChampion:'Zed',localRole:'MID',allies,enemies:diveEnemies,details,baseRoleWinCondition:base('MID')});
  const execute=result.roleWinCondition.steps.find(step=>step.label==='EXECUTE');
  assert.ok(execute);
  assert.match(execute!.value,/WAIT FOR FIRST CONTACT|THREATEN/);
  assert.match(execute!.value,/Kai'Sa|Ahri/);
  assert.match(result.biggestThrow,/FRONT-TO-BACK|ANGLE/);
});

test('support read explicitly protects the team damage core from enemy access',()=>{
  const result=buildCompositionStrategy({localChampion:'Lulu',localRole:'SUPPORT',allies:frontAllies,enemies:diveEnemies,details,baseRoleWinCondition:base('SUPPORT')});
  assert.deepEqual(result.roleWinCondition.steps.map(step=>step.label),['ENABLE','SET UP','STOP','EXECUTE','CONVERT']);
  assert.match(result.roleWinCondition.steps[0].value,/Jinx|Orianna/);
  assert.match(result.roleWinCondition.steps[2].value,/Vi|Camille|Nautilus|Ahri/);
  assert.match(result.biggestThrow,/PEEL|PROTECTION|FOLLOW-UP/);
});

test('all five roles receive exactly five composition-aware steps',()=>{
  const cases:[string,string][]=[['Ornn','TOP'],['Sejuani','JUNGLE'],['Orianna','MID'],['Jinx','ADC'],['Lulu','SUPPORT']];
  for(const [champion,role] of cases){
    const result=buildCompositionStrategy({localChampion:champion,localRole:role,allies:frontAllies,enemies:diveEnemies,details,baseRoleWinCondition:base(role)});
    assert.equal(result.roleWinCondition.steps.length,5,`${role} did not receive five steps`);
    assert.ok(result.ourWinCondition.includes('→'),`${role} did not receive a playable sequence`);
    assert.ok(result.theirWinCondition.length>25,`${role} did not receive a loss read`);
    assert.ok(result.compositionRead.enemyThreats.length>0,`${role} had no enemy threat ranking`);
  }
});

test('partial drafts are marked forming or medium rather than pretending to be final',()=>{
  const result=buildCompositionStrategy({
    localChampion:'Jinx',localRole:'ADC',
    allies:frontAllies.slice(0,4).concat(pick('Jinx','ADC')),
    enemies:diveEnemies.slice(0,2),
    details,baseRoleWinCondition:base('ADC'),
  });
  assert.notEqual(result.compositionRead.confidence,'HIGH');
});
