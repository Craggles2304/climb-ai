import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDraftPickAdvice} from '../lib/champions/draftPickAdvisor';
import type {ChampionListEntry} from '../lib/champions/ddragon';

const champs=[
 ['Jinx',['Marksman'],9,1,4],['Ashe',['Marksman','Support'],8,1,5],
 ['Caitlyn',['Marksman'],9,1,3],['Zeri',['Marksman'],8,1,6],
 ['Vayne',['Marksman','Assassin'],9,1,8],['Draven',['Marksman'],9,1,7],
 ['Malphite',['Tank','Fighter'],3,3,2],['Ornn',['Tank','Fighter'],3,5,6],
 ['Darius',['Fighter','Tank'],8,1,2],['Ahri',['Mage','Assassin'],2,9,5],
 ['Lux',['Mage','Support'],1,9,5],['Lulu',['Support','Mage'],1,8,5],
 ['Leona',['Tank','Support'],1,2,5],['Zed',['Assassin'],8,1,7],
 ['Vi',['Fighter'],7,3,4],['Amumu',['Tank','Mage'],1,7,3],
 ['Thresh',['Support','Tank'],2,4,8],
] as const;
const roster=Object.fromEntries(champs.map(([name,tags,attack,magic,difficulty],i)=>[
 name,{id:name,key:String(i+1),name,title:'',tags:[...tags],partype:'Mana',
 info:{attack,magic,defense:5,difficulty},stats:{hp:550,hpperlevel:90,armor:30,armorperlevel:4,spellblock:30,spellblockperlevel:2,
 attackdamage:60,attackdamageperlevel:3,attackspeed:.65,attackspeedperlevel:2,movespeed:330,attackrange:500}}
])) as Record<string,ChampionListEntry>;
const picks=(names:string[])=>names.map(name=>({name,lockedIn:true}));
const input=(over:Record<string,unknown>={})=>({roster,role:'ADC',patch:'16.21.1',localChampion:null,
 localLocked:false,allies:picks(['Darius','Ahri','Vi']),enemies:picks(['Zed','Malphite','Leona']),bans:[],...over});
test('best candidate is role-specific, known picks and bans are never recommended',()=>{
 const result=buildDraftPickAdvice(input({bans:['Jinx','Ashe'],allies:picks(['Darius','Ahri','Vi','Caitlyn']),enemies:picks(['Zed','Malphite','Leona'])}));
 assert.equal(result.available,true);
 assert.ok(result.recommended.length>=1);
 assert.ok(result.recommended.every(x=>!['Jinx','Ashe','Caitlyn','Zed','Malphite'].includes(x.champion)));
 assert.ok(result.recommended.every(x=>x.champion&&x.reason.length));
 assert.equal(result.role,'ADC');
});
test('updates recommendations when revealed enemy team changes',()=>{
 const againstDive=buildDraftPickAdvice(input({role:'SUPPORT',allies:picks(['Jinx','Ahri']),enemies:picks(['Zed','Zed','Zed'])}));
 const againstFrontline=buildDraftPickAdvice(input({role:'SUPPORT',allies:picks(['Jinx','Ahri']),enemies:picks(['Malphite','Ornn','Darius'])}));
 assert.ok(againstDive.available&&againstFrontline.available);
 assert.notDeepEqual(againstDive.recommended.map(x=>x.score),againstFrontline.recommended.map(x=>x.score));
});
test('no enemy data means a neutral bar with no invented win odds',()=>{
 const advice=buildDraftPickAdvice(input({enemies:[],allies:picks(['Darius'])}));
 assert.equal(advice.edge.confidence,'FORMING');
 assert.equal(advice.edge.ours,50);
 assert.equal(advice.edge.theirs,50);
 assert.match(advice.edge.label,/NOT VERIFIED WIN ODDS/);
});
test('more revealed data can enable a bounded draft comparison but never a 90% victory prediction',()=>{
 const advice=buildDraftPickAdvice(input({allies:picks(['Ahri','Vi','Darius','Lulu']),enemies:picks(['Zed','Malphite','Leona','Ashe','Lux'])}));
 assert.equal(advice.edge.confidence,'FULL');
 assert.ok(advice.edge.ours>=40&&advice.edge.ours<=60);
 assert.equal(advice.edge.ours+advice.edge.theirs,100);
 assert.match(advice.caveat,/No personal mastery/);
});
test('role is required and alternate Riot role names are normalised',()=>{
 assert.equal(buildDraftPickAdvice(input({role:'UNKNOWN'})).available,false);
 assert.equal(buildDraftPickAdvice(input({role:'BOTTOM'})).role,'ADC');
 assert.equal(buildDraftPickAdvice(input({role:'UTILITY'})).role,'SUPPORT');
});
test('actual native Companion UI reads the advisor even before a champion is hovered',()=>{
 const server=readFileSync('app/api/live/champion-plan/route-core.ts','utf8');
 const native=readFileSync('companion/electron/main.cjs','utf8');
 const views=readFileSync('companion/electron/draft-view.js','utf8');
 const html=readFileSync('companion/electron/index.html','utf8');
 const rendered=readFileSync('companion/electron/draft-advisor-view.js','utf8');
 assert.ok(server.indexOf('draftAdvice=buildDraftPickAdvice')<server.indexOf('if(!champion)return'));
 assert.match(server,/draftAdvice,/);
 assert.match(native,/draftAdvice:body.draftAdvice/);
 assert.match(views,/ocDraftAdvisor\?\.render\(state\)/);
 assert.match(html,/draft-advisor-view\.js/);
 assert.match(rendered,/NOT REAL WIN ODDS/);
});
