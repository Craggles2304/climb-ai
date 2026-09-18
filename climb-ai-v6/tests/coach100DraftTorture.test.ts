import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRankAwareDraftPlan} from '../lib/draftCoachEngine';
import type {DraftRole,DraftRolePlayer} from '../lib/draftRoleResolver';

const ROLES:DraftRole[]=['TOP','JUNGLE','MID','ADC','SUPPORT'];
const P=(champion:string,role:DraftRole):DraftRolePlayer=>({champion,role});

const drafts=[
  {
    name:'protect Jinx into dive',
    ours:[P('Ornn','TOP'),P('Sejuani','JUNGLE'),P('Orianna','MID'),P('Jinx','ADC'),P('Lulu','SUPPORT')],
    enemies:[P('Camille','TOP'),P('Vi','JUNGLE'),P('Akali','MID'),P("Kai'Sa",'ADC'),P('Nautilus','SUPPORT')],
    threats:['Camille','Vi','Akali','Nautilus'],
  },
  {
    name:'Nocturne Ahri catch',
    ours:[P('Shen','TOP'),P('Nocturne','JUNGLE'),P('Ahri','MID'),P('Jhin','ADC'),P('Nautilus','SUPPORT')],
    enemies:[P('Sion','TOP'),P('Graves','JUNGLE'),P('Viktor','MID'),P('Xayah','ADC'),P('Rakan','SUPPORT')],
    threats:['Rakan','Sion'],
  },
  {
    name:'long range poke',
    ours:[P('Jayce','TOP'),P('Nidalee','JUNGLE'),P('Zoe','MID'),P('Varus','ADC'),P('Karma','SUPPORT')],
    enemies:[P('Ornn','TOP'),P('Maokai','JUNGLE'),P('Azir','MID'),P('Aphelios','ADC'),P('Lulu','SUPPORT')],
    threats:['Ornn','Maokai'],
  },
  {
    name:'Camille side catch',
    ours:[P('Camille','TOP'),P('Vi','JUNGLE'),P('Ahri','MID'),P('Jinx','ADC'),P('Thresh','SUPPORT')],
    enemies:[P('Ornn','TOP'),P('Xin Zhao','JUNGLE'),P('Viktor','MID'),P('Sivir','ADC'),P('Braum','SUPPORT')],
    threats:['Xin Zhao','Ornn','Braum'],
  },
  {
    name:'scaling into early snowball',
    ours:[P('Kayle','TOP'),P('Master Yi','JUNGLE'),P('Kassadin','MID'),P('Sivir','ADC'),P('Soraka','SUPPORT')],
    enemies:[P('Renekton','TOP'),P('Elise','JUNGLE'),P('Pantheon','MID'),P('Draven','ADC'),P('Leona','SUPPORT')],
    threats:['Renekton','Elise','Pantheon','Leona'],
  },
] as const;

test('first 25 torture cases resolve role, lane and threats',()=>{
  let cases=0;
  for(const draft of drafts){
    for(const role of ROLES){
      cases++;
      const player=draft.ours.find(p=>p.role===role)!;
      const plan=buildRankAwareDraftPlan({champion:player.champion,role,ours:[...draft.ours],enemies:[...draft.enemies],rank:'PLATINUM'});
      const enemyRole=role==='ADC'||role==='SUPPORT'?'ADC':role;
      const expected=draft.enemies.find(p=>p.role===enemyRole)!.champion;
      assert.equal(plan.laneOpponent,expected,draft.name+' '+role+' lane');
      assert.ok(plan.threats.some(name=>draft.threats.includes(name as any)),draft.name+' '+role+' threat');
      assert.equal(plan.steps.length,5);
    }
  }
  assert.equal(cases,25);
});
