import test from 'node:test';
import assert from 'node:assert/strict';
import {rawDamageSnapshot} from '../lib/champions/rawDamageBuild';
import {emptyStats} from '../lib/champions/dps';
import type {ChampionStatBlock} from '../lib/champions/ddragon';
import type {ChampionAbilityDataset} from '../lib/champions/abilityDamage';

const STATS:ChampionStatBlock={
  hp:600,hpperlevel:100,mp:400,mpperlevel:30,movespeed:330,
  armor:30,armorperlevel:4,spellblock:30,spellblockperlevel:1.3,
  attackrange:550,attackdamage:60,attackdamageperlevel:3,
  attackspeed:.65,attackspeedperlevel:2,
};

const data:ChampionAbilityDataset={
  source:'MERAKI',
  abilities:{
    Q:[{name:'Q',icon:'',effects:[{description:'',leveling:[{attribute:'Magic Damage',modifiers:[{values:[100,200,300,400,500],units:['','','','','']}]}]}]}],
    W:[{name:'W',icon:'',effects:[{description:'',leveling:[{attribute:'Magic Damage',modifiers:[{values:[90,180,270,360,450],units:['','','','','']}]}]}]}],
    E:[{name:'E',icon:'',effects:[{description:'',leveling:[{attribute:'Magic Damage',modifiers:[{values:[80,160,240,320,400],units:['','','','','']}]}]}]}],
    R:[{name:'R',icon:'',effects:[{description:'',leveling:[{attribute:'Magic Damage',modifiers:[{values:[300,450,600],units:['','','']}]}]}]}],
  },
};

test('level 1 damage uses only one legally available basic ability rank',()=>{
  const result=rawDamageSnapshot(STATS,1,emptyStats(),data);
  assert.equal(result.comboDamage,100);
});

test('level 6 damage includes only one ultimate rank',()=>{
  const result=rawDamageSnapshot(STATS,6,emptyStats(),data);
  assert.ok(result.comboDamage>=300,'ultimate rank one is included');
  assert.ok(result.comboDamage<1200,'does not silently use fully ranked Q/W/E/R');
});
