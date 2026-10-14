import test from 'node:test';
import assert from 'node:assert/strict';
import type {ChampionListEntry} from '../lib/champions/ddragon';
import {adviseChampionDraft} from '../lib/champions/draftPickAdvisor';

function champion(id:string,tags:string[],attack:number,magic:number,defense:number):ChampionListEntry{
 return{id,key:id,name:id,title:'',tags,partype:'Mana',info:{attack,magic,defense,difficulty:3},
 stats:{hp:600,hpperlevel:90,armor:25,armorperlevel:4,spellblock:30,spellblockperlevel:2,
 attackdamage:60,attackdamageperlevel:3,attackspeed:.6,attackspeedperlevel:2,
 movespeed:330,attackrange:550}};
}
const roster:Record<string,ChampionListEntry>={
 Jinx:champion('Jinx',['Marksman'],10,0,1),
 Ashe:champion('Ashe',['Marksman','Support'],7,1,2),
 Caitlyn:champion('Caitlyn',['Marksman'],9,0,1),
 Jhin:champion('Jhin',['Marksman'],9,0,1),
 Ezreal:champion('Ezreal',['Marksman','Mage'],7,6,2),
 Vayne:champion('Vayne',['Marksman'],10,0,2),
 Leona:champion('Leona',['Tank','Support'],1,2,9),
 Malphite:champion('Malphite',['Tank'],1,2,9),
 Orianna:champion('Orianna',['Mage'],1,9,2),
 Zed:champion('Zed',['Assassin'],8,2,1),
};
const draft=(overrides:Partial<Parameters<typeof adviseChampionDraft>[0]>={})=>
 adviseChampionDraft({roster,role:'ADC',allies:[],enemies:[],banned:[],patch:'16.20.1',...overrides});

test('role-filtered picks never recommend an assassin top or unavailable pick for ADC',()=>{
 const output=draft({allies:[{name:'Leona'}],enemies:[{name:'Zed'}],banned:['Ashe'],hover:'Jinx'});
 assert.equal(output.role,'ADC');
 assert.ok(output.top.length<=3);
 assert.ok(output.top.every(x=>x.role==='ADC'));
 assert.ok(output.top.every(x=>!['Ashe','Leona','Malphite','Orianna','Zed'].includes(x.champion)));
});
test('always responds before local hover when role is known',()=>{
 const x=draft({role:'ADC',allies:[{name:'Leona'}]});
 assert.equal(x.status,'FORMING');
 assert.ok(x.top.length);
 assert.equal(x.draftEdge,null);
});
test('the candidate list excludes banned, taken and champions missing from the patch roster',()=>{
 const x=draft({banned:['Jinx','Ashe','Ezreal'],allies:[{name:'Caitlyn'}],enemies:[{name:'Vayne'}]});
 assert.equal(x.top.length,1);
 assert.equal(x.top[0].champion,'Jhin');
});
test('personal familiarity influences tie-breaks without pretending to know mastery win rates',()=>{
 const x=draft({familiar:['Jhin']});
 assert.equal(x.top[0].champion,'Jhin');
 assert.equal(x.top[0].familiar,true);
});
test('role unknown, uncertain and uncovered enemy slots never get fabricated win odds',()=>{
 const unknown=draft({role:'UNKNOWN'});
 assert.equal(unknown.status,'UNAVAILABLE');
 assert.equal(unknown.top.length,0);
 assert.equal(unknown.draftEdge,null);
 const partial=draft({allies:[{name:'Leona'}],enemies:[{name:'Zed'}]});
 assert.equal(partial.draftEdge,null);
 const complete=draft({allies:[{name:'Leona'},{name:'Orianna'}],enemies:[{name:'Zed'},{name:'Malphite'}]});
 assert.ok(complete.draftEdge);
 assert.equal(complete.draftEdge!.method,'HEURISTIC_DRAFT_FIT_NOT_WIN_PROBABILITY');
 assert.equal(complete.draftEdge!.ours+complete.draftEdge!.theirs,100);
 assert.equal(complete.draftEdge!.confidence,'LOW');
 assert.match(complete.caveat,/not calibrated win odds/i);
});
test('suggestions are deterministic for the same revealed draft',()=>{
 const input={allies:[{name:'Leona'}],enemies:[{name:'Zed'},{name:'Malphite'}],hover:'Jinx'};
 assert.deepEqual(draft(input),draft(input));
});
