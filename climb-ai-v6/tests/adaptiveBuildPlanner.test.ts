import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAdaptiveItemPlan} from '../lib/adaptiveBuildPlanner';
import type {ChampionDetail} from '../lib/champions/ddragon';
import type {DataDragonItemFull} from '../lib/champions/source';

function champion(name:string,tags:string[],attack:number,magic:number,range:number,spellText=''):ChampionDetail{
  return{
    id:name.replace(/\W/g,''),key:'1',name,title:'test',tags,partype:'Mana',
    info:{attack,defense:5,magic,difficulty:5},
    stats:{
      hp:600,hpperlevel:100,armor:30,armorperlevel:4,spellblock:30,spellblockperlevel:1.3,
      attackdamage:60,attackdamageperlevel:3,attackspeed:.65,attackspeedperlevel:3,
      movespeed:330,attackrange:range,mp:300,mpperlevel:40,
    },
    spells:[
      {id:'q',name:'Q',maxrank:5,description:spellText} as any,
      {id:'w',name:'W',maxrank:5,description:''} as any,
      {id:'e',name:'E',maxrank:5,description:''} as any,
      {id:'r',name:'R',maxrank:3,description:''} as any,
    ],
    passive:{name:'Passive',description:''},
    allytips:[],enemytips:[],
  };
}
function item(name:string,gold:number,stats:Record<string,number>,description:string,tags:string[]=[]):DataDragonItemFull{
  return{name,gold:{total:gold},stats,description,plaintext:description,from:['1000'],maps:{'11':true},tags} as DataDragonItemFull;
}
const items:Record<string,DataDragonItemFull>={
  '10001':item('Crit Engine',3000,{FlatPhysicalDamageMod:70,FlatCritChanceMod:.25},'Critical strike damage item',['Damage','CriticalStrike']),
  '10002':item('Attack Speed Engine',2900,{FlatPhysicalDamageMod:35,PercentAttackSpeedMod:.45,FlatCritChanceMod:.25},'Attack speed on-hit item',['AttackSpeed','Damage']),
  '10003':item('Giant Piercer',3000,{FlatPhysicalDamageMod:45,FlatCritChanceMod:.25},'Armor penetration. Deals extra damage based on maximum health.',['ArmorPenetration','Damage']),
  '10004':item('Cleanse Blade',3000,{FlatPhysicalDamageMod:45,FlatCritChanceMod:.25},'Active: remove all crowd control effects from yourself.',['Damage']),
  '10005':item('Execution Blade',2800,{FlatPhysicalDamageMod:40,FlatCritChanceMod:.25},'Applies Grievous Wounds to enemies.',['Damage']),
  '10006':item('Spell Guard',2900,{FlatPhysicalDamageMod:45,FlatSpellBlockMod:40},'Lifeline spell shield against magic damage.',['Damage','SpellBlock']),
  '10007':item('Armor Guard',2800,{FlatPhysicalDamageMod:40,FlatArmorMod:45},'Revive after taking lethal physical damage.',['Damage','Armor']),
  '20001':item('Steel Boots',1100,{FlatArmorMod:25},'Reduces damage from basic attacks.',['Boots','Armor']),
  '20002':item('Mercury Boots',1100,{FlatSpellBlockMod:25},'Grants magic resistance and tenacity.',['Boots','SpellBlock']),
  '20003':item('Attack Speed Boots',1100,{PercentAttackSpeedMod:.30},'Attack speed boots.',['Boots','AttackSpeed']),
};

const aphelios=champion('Aphelios',['Marksman'],9,1,550);
const ally=(name:string)=>({champion:name,role:'TOP',detail:champion(name,['Fighter'],7,3,175)});
const enemy=(detail:ChampionDetail,role:string)=>({champion:detail.name,role,detail});

test('same ADC gets an anti-tank draft item into a tank-heavy enemy team',()=>{
  const tanks=['TankA','TankB','TankC'].map(name=>champion(name,['Tank'],3,4,175,'Very durable frontliner with high health and armor.'));
  const plan=buildAdaptiveItemPlan({
    patch:'test',you:aphelios,role:'ADC',allies:[{champion:'Aphelios',role:'ADC',detail:aphelios},ally('Garen')],
    enemies:[
      enemy(tanks[0],'TOP'),enemy(tanks[1],'JUNGLE'),enemy(tanks[2],'SUPPORT'),
      enemy(champion('Viktor',['Mage'],2,9,525),'MID'),enemy(champion('Jinx',['Marksman'],9,1,525),'ADC'),
    ],items,
  });
  assert.ok(plan.draftItem);
  assert.ok(plan.draftItem?.flags.includes('ANTI_TANK'),JSON.stringify(plan.draftItem));
  assert.ok(plan.enemyProfile.tanks>=3);
});

test('same ADC changes the tech slot into cleanse against a CC-heavy dive draft',()=>{
  const divers=[
    champion('Camille',['Fighter'],8,2,125,'Dashes to a target and stuns them.'),
    champion('Vi',['Fighter'],8,2,125,'Charges and knocks up the target.'),
    champion('Lissandra',['Mage'],2,9,550,'Roots enemies and can stun a target.'),
    champion('Leona',['Tank','Support'],2,4,125,'Stuns and roots enemies.'),
  ];
  const plan=buildAdaptiveItemPlan({
    patch:'test',you:aphelios,role:'ADC',allies:[{champion:'Aphelios',role:'ADC',detail:aphelios},ally('Garen')],
    enemies:[
      enemy(divers[0],'TOP'),enemy(divers[1],'JUNGLE'),enemy(divers[2],'MID'),
      enemy(champion('Xayah',['Marksman'],9,1,525),'ADC'),enemy(divers[3],'SUPPORT'),
    ],items,
  });
  assert.ok(plan.draftItem);
  assert.ok(plan.draftItem?.flags.includes('CLEANSE'),JSON.stringify(plan.draftItem));
  assert.ok(plan.enemyProfile.hardCc>=4);
});

test('boots react to physical versus magic/CC enemy profiles',()=>{
  const physical=Array.from({length:5},(_,i)=>enemy(champion('AD'+i,['Fighter'],9,1,175),'TOP'));
  const magicCc=Array.from({length:5},(_,i)=>enemy(champion('AP'+i,['Mage'],1,9,525,'Stuns the target.'),'MID'));
  const base={patch:'test',you:aphelios,role:'ADC' as const,allies:[{champion:'Aphelios',role:'ADC',detail:aphelios}],items};
  const vsPhysical=buildAdaptiveItemPlan({...base,enemies:physical});
  const vsMagic=buildAdaptiveItemPlan({...base,enemies:magicCc});
  assert.equal(vsPhysical.boots?.name,'Steel Boots');
  assert.equal(vsMagic.boots?.name,'Mercury Boots');
});

test('adaptive build is a current-draft recommendation, not a fixed champion build',()=>{
  const tankPlan=buildAdaptiveItemPlan({
    patch:'test',you:aphelios,role:'ADC',allies:[{champion:'Aphelios',role:'ADC',detail:aphelios}],
    enemies:Array.from({length:5},(_,i)=>enemy(champion('Tank'+i,['Tank'],3,4,175,'Stun.'),'TOP')),items,
  });
  const healPlan=buildAdaptiveItemPlan({
    patch:'test',you:aphelios,role:'ADC',allies:[{champion:'Aphelios',role:'ADC',detail:aphelios}],
    enemies:Array.from({length:5},(_,i)=>enemy(champion('Healer'+i,['Mage'],2,8,550,'Heals and restores health.'),'MID')),items,
  });
  assert.notEqual(tankPlan.draftItem?.name,healPlan.draftItem?.name);
  assert.ok(healPlan.draftItem?.flags.includes('ANTI_HEAL'),JSON.stringify(healPlan.draftItem));
  assert.equal(tankPlan.role,'ADC');
  assert.equal(healPlan.role,'ADC');
});


test('mage draft tech stays inside AP-compatible item pool',()=>{
  const ahri=champion('Ahri',['Mage','Assassin'],3,9,550,'Dashes and charms the target.');
  const mageItems:Record<string,DataDragonItemFull>={
    ...items,
    '30001':item('Large AP',3400,{FlatMagicDamageMod:130},'Large ability power.',['SpellDamage']),
    '30002':item('AP Stasis',3200,{FlatMagicDamageMod:105,FlatArmorMod:50},'Stasis active.',['SpellDamage','Armor']),
    '30003':item('Wrong AD Cleanse',3200,{FlatPhysicalDamageMod:60,FlatSpellBlockMod:35},'Remove all crowd control.',['Damage']),
    '30004':item('Wrong Tank Tech',2800,{FlatHPPoolMod:600},'Maximum health anti tank wording.',['Health']),
    '30005':item('AP Pen',3000,{FlatMagicDamageMod:85},'Magic penetration.',['SpellDamage']),
  };
  const enemies=Array.from({length:5},(_,i)=>enemy(champion('Enemy'+i,i<2?['Tank']:['Fighter'],7,4,175,'Stuns and dashes.'),'TOP'));
  const plan=buildAdaptiveItemPlan({
    patch:'test',you:ahri,role:'MID',allies:[{champion:'Ahri',role:'MID',detail:ahri}],enemies,items:mageItems,
  });
  const selected=[...plan.core,...(plan.draftItem?[plan.draftItem]:[]),...(plan.finish?[plan.finish]:[]),...plan.swaps];
  assert.ok(selected.length>0);
  assert.ok(!selected.some(value=>value.name==='Wrong AD Cleanse'),JSON.stringify(selected));
  assert.ok(!selected.some(value=>value.name==='Wrong Tank Tech'),JSON.stringify(selected));
  assert.ok(selected.some(value=>/AP|Large AP/.test(value.name)),JSON.stringify(selected));
});
