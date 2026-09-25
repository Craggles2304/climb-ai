import test from 'node:test';
import assert from 'node:assert/strict';
import {abilityDamageRows,type AbilityDamageContext,type ChampionAbilityDataset} from '../lib/champions/abilityDamage';

const context:AbilityDamageContext={
  level:11,
  abilityPower:200,
  totalAttackDamage:150,
  baseAttackDamage:90,
  bonusAttackDamage:60,
  maxHealth:2000,
  bonusHealth:500,
  armor:100,
  bonusArmor:40,
  magicResistance:70,
  bonusMagicResistance:20,
  maxMana:1200,
  bonusMana:400,
  attackSpeed:1.2,
  bonusAttackSpeedPercent:65,
  critChancePercent:50,
};

const ability=(attribute:string,modifiers:Array<{values:number[];units:string[]}>):ChampionAbilityDataset=>({
  source:'MERAKI',
  abilities:{
    Q:[{
      name:'Test Q',
      icon:'',
      effects:[{description:'',leveling:[{attribute,modifiers}]}],
      damageType:'MAGIC_DAMAGE',
      cooldown:null,
      cost:null,
    }],
  },
});

test('adds flat spell damage and AP scaling at each rank',()=>{
  const data=ability('Magic Damage',[
    {values:[40,65,90,115,140],units:['','','','','']},
    {values:[50,50,50,50,50],units:['% AP','% AP','% AP','% AP','% AP']},
  ]);
  const row=abilityDamageRows(data,context)[0];
  assert.equal(row.ranks[0].value,140);
  assert.equal(row.ranks[4].value,240);
  assert.equal(row.ranks[0].exact,true);
});

test('uses the selected build bonus AD in spell damage',()=>{
  const data=ability('Physical Damage',[
    {values:[100],units:['']},
    {values:[120],units:['% bonus AD']},
  ]);
  const row=abilityDamageRows(data,context)[0];
  assert.equal(row.ranks[0].value,172);
});

test('uses item mana for max-mana scaling',()=>{
  const data=ability('Magic Damage',[
    {values:[50],units:['']},
    {values:[5],units:['% max mana']},
  ]);
  const row=abilityDamageRows(data,context)[0];
  assert.equal(row.ranks[0].value,110);
});

test('does not invent target-dependent damage',()=>{
  const data=ability('Magic Damage',[
    {values:[100],units:['']},
    {values:[10],units:['% target maximum health']},
  ]);
  const row=abilityDamageRows(data,context)[0];
  assert.equal(row.ranks[0].value,100,'known portion is still shown');
  assert.equal(row.ranks[0].exact,false);
  assert.deepEqual(row.ranks[0].unresolved,['% target maximum health']);
});
