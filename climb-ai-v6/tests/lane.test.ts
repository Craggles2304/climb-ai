import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyseLane,tradeAt,ranksAtLevel,REPORT_LEVELS,EVEN_TRADE_SECONDS,
  type LaneChampion,
} from '../lib/champions/lane';
import {emptyStats,parseItemStats} from '../lib/champions/dps';
import {statsAtLevel} from '../lib/champions/ddragon';
import type {ChampionDetail,ChampionStatBlock} from '../lib/champions/ddragon';

/**
 * Real Data Dragon values, patch 16.18.1, with attackdamageperlevel from 16.4.1
 * — the current patch publishes 0 for all 173 champions, so lib/champions/source
 * merges the last published figures and production sees these numbers.
 */
const CAITLYN:ChampionStatBlock={
  hp:580,hpperlevel:107,mp:315,mpperlevel:40,movespeed:325,
  armor:27,armorperlevel:4.7,spellblock:33,spellblockperlevel:1.1,
  attackrange:650,hpregen:3.5,hpregenperlevel:0.55,mpregen:7.4,mpregenperlevel:0.7,
  crit:0,critperlevel:0,attackdamage:62,attackdamageperlevel:3.8,
  attackspeedperlevel:4,attackspeed:0.681,
};
const DARIUS:ChampionStatBlock={
  hp:652,hpperlevel:114,mp:263,mpperlevel:58,movespeed:340,
  armor:37,armorperlevel:5.2,spellblock:32,spellblockperlevel:2.05,
  attackrange:175,hpregen:10,hpregenperlevel:0.95,mpregen:6.6,mpregenperlevel:0.35,
  crit:0,critperlevel:0,attackdamage:64,attackdamageperlevel:5,
  attackspeedperlevel:1,attackspeed:0.625,
};
const LEONA:ChampionStatBlock={
  hp:646,hpperlevel:109,mp:302,mpperlevel:40,movespeed:335,
  armor:47,armorperlevel:4.8,spellblock:32,spellblockperlevel:2.05,
  attackrange:125,hpregen:8.5,hpregenperlevel:0.85,mpregen:6,mpregenperlevel:0.8,
  crit:0,critperlevel:0,attackdamage:60,attackdamageperlevel:3,
  attackspeedperlevel:2.9,attackspeed:0.625,
};

const champ=(
  id:string,stats:ChampionStatBlock,
  info:{attack:number;defense:number;magic:number;difficulty:number},
  partype='Mana',
  spells:ChampionDetail['spells']=[],
):ChampionDetail=>({
  id,key:id,name:id,title:'',tags:['Marksman'],partype,info,stats,
  passive:{name:'',description:''},spells,
});

const CAIT_SPELLS:ChampionDetail['spells']=[
  {id:'Q',name:'Piltover Peacemaker',maxrank:5,cooldown:[10,9,8,7,6],cost:[55,60,65,70,75]},
  {id:'W',name:'Yordle Snap Trap',maxrank:5,cooldown:[1,1,1,1,1],cost:[20,20,20,20,20]},
  {id:'E',name:'90 Caliber Net',maxrank:5,cooldown:[16,14,12,10,8],cost:[75,75,75,75,75]},
  {id:'R',name:'Ace in the Hole',maxrank:3,cooldown:[90,90,90],cost:[100,100,100]},
];
const DARIUS_SPELLS:ChampionDetail['spells']=[
  {id:'Q',name:'Decimate',maxrank:5,cooldown:[9,8,7,6,5],cost:[25,30,35,40,45]},
  {id:'W',name:'Crippling Strike',maxrank:5,cooldown:[9,8,7,6,5],cost:[40,40,40,40,40]},
  {id:'E',name:'Apprehend',maxrank:5,cooldown:[24,21,18,15,12],cost:[70,60,50,40,30]},
  {id:'R',name:'Noxian Guillotine',maxrank:3,cooldown:[120,100,80],cost:[100,100,0]},
];

const caitlyn=champ('Caitlyn',CAITLYN,{attack:8,defense:2,magic:2,difficulty:6},'Mana',CAIT_SPELLS);
const darius=champ('Darius',DARIUS,{attack:9,defense:5,magic:1,difficulty:2},'Mana',DARIUS_SPELLS);
const leona=champ('Leona',LEONA,{attack:4,defense:8,magic:3,difficulty:4},'Mana',[]);
const garen=champ('Garen',DARIUS,{attack:7,defense:7,magic:1,difficulty:5},'None',[
  {id:'Q',name:'Decisive Strike',maxrank:5,cooldown:[8,7,6,5,4],cost:[0,0,0,0,0]},
]);

const side=(...details:ChampionDetail[]):LaneChampion[]=>
  details.map(detail=>({detail,items:emptyStats()}));

/* ---------------------------------------------------------- time to kill -- */

test('time to kill is effective HP divided by DPS',()=>{
  const t=tradeAt(side(caitlyn),side(darius),6);
  const expected=t.them.weakestEffectiveHp/t.you.dps;
  assert.ok(Math.abs(t.yourTimeToKill!-expected)<0.15,'matches the arithmetic');
  assert.ok(t.yourTimeToKill!>0&&t.theirTimeToKill!>0);
});

test('the tankier, harder-hitting champion wins the raw auto trade',()=>{
  // Darius at level 6 has far more effective HP than Caitlyn and similar AD,
  // so standing still trading autos is his trade, not hers.
  const t=tradeAt(side(darius),side(caitlyn),6);
  assert.equal(t.verdict,'YOU');
  assert.ok(t.yourTimeToKill!<t.theirTimeToKill!);
});

test('the verdict flips with the point of view',()=>{
  const a=tradeAt(side(caitlyn),side(darius),6);
  const b=tradeAt(side(darius),side(caitlyn),6);
  assert.equal(a.verdict,'THEM');
  assert.equal(b.verdict,'YOU');
  assert.ok(Math.abs(a.yourTimeToKill!-b.theirTimeToKill!)<0.05,'the same duel either way round');
});

test('a mirror matchup is even',()=>{
  const t=tradeAt(side(caitlyn),side(caitlyn),6);
  assert.equal(t.verdict,'EVEN');
  assert.equal(t.yourTimeToKill,t.theirTimeToKill);
  assert.match(t.explanation,/whoever lands the first hit/);
});

test('a near-tie inside the even band is not called a win',()=>{
  const t=tradeAt(side(caitlyn),side(caitlyn),6);
  assert.ok(Math.abs(t.theirTimeToKill!-t.yourTimeToKill!)<EVEN_TRADE_SECONDS);
  assert.equal(t.verdict,'EVEN');
});

test('items change who wins the trade',()=>{
  const ie=parseItemStats({FlatCritChanceMod:0.25,FlatPhysicalDamageMod:75});
  const bare=tradeAt(side(caitlyn),side(darius),6);
  const armed=tradeAt(
    [{detail:caitlyn,items:ie}],
    side(darius),6);
  assert.ok(armed.yourTimeToKill!<bare.yourTimeToKill!,'an item makes you kill faster');
  assert.ok(armed.you.dps>bare.you.dps);
});

test('the explanation names the numbers it used',()=>{
  const t=tradeAt(side(caitlyn),side(darius),6);
  assert.match(t.explanation,new RegExp(`${t.you.dps}`),'your DPS appears');
  assert.match(t.explanation,new RegExp(`${t.them.weakestEffectiveHp}`),'their effective HP appears');
  assert.match(t.explanation,/Darius/);
});

/* ------------------------------------------------------------- duo lane -- */

test('a duo lane adds both champions DPS together',()=>{
  const solo=tradeAt(side(caitlyn),side(darius),6);
  const duo=tradeAt(side(caitlyn,leona),side(darius),6);
  assert.ok(duo.you.dps>solo.you.dps,'two champions out-damage one');
  assert.ok(duo.yourTimeToKill!<solo.yourTimeToKill!);
  assert.deepEqual(duo.you.names,['Caitlyn','Leona']);
});

test('focus fire targets the squishier of the two, not the average',()=>{
  // Caitlyn has far less effective HP than Leona, so she is the one who dies.
  const t=tradeAt(side(darius),side(caitlyn,leona),6);
  assert.equal(t.them.weakestName,'Caitlyn');
  const cait=statsAtLevel(CAITLYN,6).effectiveHpVsPhysical;
  assert.ok(Math.abs(t.them.weakestEffectiveHp-cait)<1);
});

test('a duo lane is labelled as one',()=>{
  assert.equal(analyseLane(side(caitlyn,leona),side(darius,leona),6).lane,'DUO');
  assert.equal(analyseLane(side(caitlyn),side(darius),6).lane,'SOLO');
});

/* ------------------------------------------------------------- resources -- */

test('counts how many casts a mana bar actually buys',()=>{
  const analysis=analyseLane(side(caitlyn),side(darius),6);
  const cait=analysis.resources.find(r=>r.champion==='Caitlyn')!;
  assert.equal(cait.hasBar,true);
  assert.ok(cait.maxAtLevel>315,'mana grows with level');
  const q=cait.casts.find(c=>c.slot==='Q')!;
  assert.equal(q.castsFromFull,Math.floor(cait.maxAtLevel/q.cost));
  assert.ok(cait.rotationsFromFull!>0);
  assert.match(cait.explanation,/rotation/);
});

test('a champion with no resource bar is described, not given a fake number',()=>{
  const analysis=analyseLane(side(garen),side(darius),6);
  const g=analysis.resources.find(r=>r.champion==='Garen')!;
  assert.equal(g.hasBar,false);
  assert.equal(g.rotationsFromFull,null);
  for(const c of g.casts)assert.equal(c.castsFromFull,null);
  assert.match(g.explanation,/no resource bar/);
  assert.match(g.explanation,/cooldowns/);
});

test('a combat-generated resource is not treated as a spendable pool',()=>{
  const flow=champ('Yasuo',DARIUS,{attack:8,defense:4,magic:4,difficulty:10},'Flow',DARIUS_SPELLS);
  const read=analyseLane(side(flow),side(darius),6).resources.find(r=>r.champion==='Yasuo')!;
  assert.equal(read.hasBar,false);
  assert.match(read.explanation,/generated in combat/);
});

test('ability costs are read at the rank a champion would actually have',()=>{
  const early=analyseLane(side(darius),side(caitlyn),2)
    .resources.find(r=>r.champion==='Darius')!;
  const late=analyseLane(side(darius),side(caitlyn),18)
    .resources.find(r=>r.champion==='Darius')!;
  const earlyQ=early.casts.find(c=>c.slot==='Q')!;
  const lateQ=late.casts.find(c=>c.slot==='Q')!;
  assert.equal(earlyQ.rank,1);
  assert.equal(earlyQ.cost,25,'Decimate rank 1 costs 25');
  assert.equal(lateQ.rank,5);
  assert.equal(lateQ.cost,45,'and rank 5 costs 45');
});

test('rank allocation spends every level and caps at five',()=>{
  assert.deepEqual(ranksAtLevel(1),[1,0,0]);
  assert.deepEqual(ranksAtLevel(3),[1,1,1]);
  for(const level of [9,13,18]){
    const ranks=ranksAtLevel(level);
    const ultPoints=[6,11,16].filter(l=>l<=level).length;
    assert.equal(ranks.reduce((a,b)=>a+b,0),level-ultPoints,`level ${level} spends every point`);
    for(const r of ranks)assert.ok(r<=5,'no ability passes rank 5');
  }
});

/* ---------------------------------------------------------------- shape -- */

test('reports every level it promises, in order',()=>{
  const a=analyseLane(side(caitlyn),side(darius),6);
  assert.deepEqual(a.trades.map(t=>t.level),REPORT_LEVELS);
  assert.equal(a.atLevel.level,6);
});

test('the requested level is clamped rather than extrapolated',()=>{
  assert.equal(analyseLane(side(caitlyn),side(darius),99).level,18);
  assert.equal(analyseLane(side(caitlyn),side(darius),-3).level,1);
});

test('advice is produced and every line says something concrete',()=>{
  const a=analyseLane(side(caitlyn),side(darius),6);
  assert.ok(a.howToPlayIt.length>0);
  for(const line of a.howToPlayIt){
    assert.ok(line.length>20,'no stub advice');
    assert.doesNotMatch(line,/undefined|NaN|Infinity/);
  }
});

test('the enemy ultimate window is offered, the ally one is not',()=>{
  const a=analyseLane(side(caitlyn),side(darius),6);
  assert.ok(a.allInWindows.some(w=>/Noxian Guillotine/.test(w)));
  assert.ok(!a.allInWindows.some(w=>/Ace in the Hole/.test(w)),'your own ult is not a window for you');
});

/* -------------------------------------------------------------- honesty -- */

test('says plainly what the model does not include',()=>{
  const a=analyseLane(side(caitlyn),side(darius),6);
  assert.match(a.modelNote,/auto-attack duel/);
  assert.match(a.modelNote,/No abilities/);
  assert.match(a.modelNote,/not as "who wins the lane"/);
  assert.ok(a.unavailable.some(u=>/Ability and combo damage/.test(u)));
  assert.ok(a.unavailable.some(u=>/Win rates/.test(u)));
});

test('never claims to have costed an ability combo',()=>{
  // The honesty fields legitimately contain the phrase 'win rate' because they
  // declare it unavailable, so they are excluded from the ban rather than the
  // ban being loosened.
  const {unavailable,modelNote,...claims}=analyseLane(side(caitlyn),side(darius),6);
  const text=JSON.stringify(claims);
  assert.ok(unavailable.length>0&&modelNote.length>0,'the declarations still exist');
  assert.doesNotMatch(text,/combo damage of|deals \d+ damage|burst of \d+/i);
  assert.doesNotMatch(text,/win rate/i);
  assert.doesNotMatch(text,/guaranteed|hard counter|free kill/i);
});

test('produces no NaN or Infinity anywhere, at any level',()=>{
  for(const level of REPORT_LEVELS){
    const text=JSON.stringify(analyseLane(side(caitlyn,leona),side(darius,garen),level));
    assert.doesNotMatch(text,/NaN|Infinity|undefined/,`level ${level} is clean`);
  }
});

test('a champion with no spells still analyses without crashing',()=>{
  const bare=champ('Bare',CAITLYN,{attack:5,defense:5,magic:5,difficulty:5},'Mana',[]);
  const a=analyseLane(side(bare),side(darius),6);
  assert.ok(a.trades.length>0);
  assert.deepEqual(a.resources.find(r=>r.champion==='Bare')!.casts,[]);
  assert.doesNotMatch(JSON.stringify(a),/NaN|undefined/);
});
