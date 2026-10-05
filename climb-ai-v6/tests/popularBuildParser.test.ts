import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePopularBuildSet} from '../lib/champions/popularBuildParser';
import type {BuildItem} from '../lib/champions/build';
import {emptyStats} from '../lib/champions/dps';

const item=(id:number,name:string):BuildItem=>({id,name,gold:3000,stats:emptyStats()});
const catalogue=[
  item(1,'The Collector'),
  item(2,'Infinity Edge'),
  item(3,'Hexoptics C44'),
  item(4,'Rapid Firecannon'),
  item(5,"Berserker's Greaves"),
  item(6,'Armored Advance'),
  item(7,'Lord Dominik\'s Regards'),
];

test('popular build parser chooses the highest-sample core instead of the first API row',()=>{
  const raw={itemSets:{
    itemSet3:[
      ['1_2_4',120,60],
      ['3_2_4',980,520],
      ['1_2_7',300,150],
    ],
    itemSet4:[
      ['3_2_4_7',700,380],
      ['3_2_4_1',180,90],
    ],
    itemSet5:[
      ['3_2_4_7_1',500,280],
    ],
    itemBootSet1:[
      ['6',2000,1000],
      ['5',1500,760],
    ],
  }};
  const parsed=parsePopularBuildSet(raw,catalogue);
  assert.ok(parsed);
  assert.deepEqual(parsed.items.slice(0,4).map(value=>value.name),[
    'Hexoptics C44',
    "Berserker's Greaves",
    'Infinity Edge',
    'Rapid Firecannon',
  ]);
  assert.equal(parsed.picks,980);
  assert.equal(parsed.wins,520);
  assert.ok(!parsed.items.some(value=>value.name==='Armored Advance'));
});

test('popular extension follows the highest-sample continuation of the chosen core',()=>{
  const raw={itemSets:{
    itemSet3:[['3_2_4',1000,520]],
    itemSet4:[
      ['3_2_4_1',120,64],
      ['3_2_4_7',640,350],
    ],
    itemSet5:[
      ['3_2_4_7_1',510,280],
      ['3_2_4_7_6',50,20],
    ],
    itemBootSet1:[['5',900,470]],
  }};
  const parsed=parsePopularBuildSet(raw,catalogue);
  assert.ok(parsed);
  assert.deepEqual(parsed.items.map(value=>value.name),[
    'Hexoptics C44',
    "Berserker's Greaves",
    'Infinity Edge',
    'Rapid Firecannon',
    "Lord Dominik's Regards",
    'The Collector',
  ]);
});
