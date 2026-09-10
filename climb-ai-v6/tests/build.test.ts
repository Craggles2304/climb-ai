import test from 'node:test';
import assert from 'node:assert/strict';
import {bestBuild,maxDpsBySize,orderForBuying,buildStats,toBuildItems,MAX_BUILD_SIZE,type BuildItem} from '../lib/champions/build';
import {combatProfile,emptyStats} from '../lib/champions/dps';
import {skillOrder,CONVENTIONAL_FIRST_MAX,ULT_LEVELS} from '../lib/champions/skillOrder';
import type {ChampionDetail,ChampionStatBlock} from '../lib/champions/ddragon';

const CAITLYN:ChampionStatBlock={
  hp:580,hpperlevel:107,mp:315,mpperlevel:40,movespeed:325,
  armor:27,armorperlevel:4.7,spellblock:33,spellblockperlevel:1.1,
  attackrange:650,hpregen:3.5,hpregenperlevel:0.55,mpregen:7.4,mpregenperlevel:0.7,
  crit:0,critperlevel:0,attackdamage:62,attackdamageperlevel:0,
  attackspeedperlevel:4,attackspeed:0.681,
};

const CATALOGUE:Record<string,{name:string;gold:{total:number};stats:Record<string,number>}>={
  '3031':{name:'Infinity Edge',gold:{total:3500},stats:{FlatCritChanceMod:0.25,FlatPhysicalDamageMod:75}},
  '3072':{name:'Bloodthirster',gold:{total:3400},stats:{FlatPhysicalDamageMod:80,PercentLifeStealMod:0.15}},
  '3006':{name:"Berserker's Greaves",gold:{total:1100},stats:{PercentAttackSpeedMod:0.35}},
  '3094':{name:'Rapid Firecannon',gold:{total:2650},stats:{PercentAttackSpeedMod:0.35,FlatCritChanceMod:0.25}},
  '6673':{name:'Immortal Shieldbow',gold:{total:3000},stats:{FlatPhysicalDamageMod:55,FlatCritChanceMod:0.25}},
  '3075':{name:'Thornmail',gold:{total:2450},stats:{FlatHPPoolMod:150,FlatArmorMod:75}},
  '3089':{name:"Rabadon's Deathcap",gold:{total:3500},stats:{FlatMagicDamageMod:130}},
};

const items=()=>toBuildItems(CATALOGUE);

/* -------------------------------------------------------------- builds -- */

test('converts a Data Dragon catalogue into build items',()=>{
  const list=items();
  assert.equal(list.length,7);
  const ie=list.find(i=>i.name==='Infinity Edge')!;
  assert.equal(ie.id,3031);
  assert.equal(ie.gold,3500);
  assert.equal(ie.stats.critChance,0.25);
});

test('build stats sum every item in the build',()=>{
  const list=items();
  const two=[list.find(i=>i.id===3031)!,list.find(i=>i.id===3072)!];
  const total=buildStats(two);
  assert.equal(total.attackDamage,155);
  assert.equal(total.critChance,0.25);
});

test('an empty build sums to nothing rather than throwing',()=>{
  const total=buildStats([]);
  for(const v of Object.values(total))assert.equal(v,0);
});

test('the best build raises DPS above having nothing',()=>{
  const bare=combatProfile(CAITLYN,11).dps;
  const best=bestBuild(CAITLYN,11,items(),3);
  assert.equal(best.items.length,3);
  assert.ok(best.dps>bare);
  assert.equal(best.gold,best.items.reduce((g,i)=>g+i.gold,0));
});

test('never picks an item that cannot affect auto-attack damage',()=>{
  // Thornmail and Rabadon's raise no DPS, so a DPS-max build must not spend a
  // slot on them however many slots are free.
  const best=bestBuild(CAITLYN,11,items(),MAX_BUILD_SIZE);
  const names=best.items.map(i=>i.name);
  assert.ok(!names.includes('Thornmail'));
  assert.ok(!names.includes("Rabadon's Deathcap"));
});

test('a larger build is never worse than a smaller one',()=>{
  const sizes=maxDpsBySize(CAITLYN,11,items(),4);
  for(let i=1;i<sizes.length;i++)
    assert.ok(sizes[i].dps>=sizes[i-1].dps,`size ${i+1} is at least as good as ${i}`);
});

test('build size is capped at six however many are asked for',()=>{
  const best=bestBuild(CAITLYN,11,items(),50);
  assert.ok(best.items.length<=MAX_BUILD_SIZE);
});

test('asking for no items returns the bare champion, not an error',()=>{
  const none=bestBuild(CAITLYN,11,items(),0);
  assert.deepEqual(none.items,[]);
  assert.equal(none.dps,combatProfile(CAITLYN,11).dps);
  assert.equal(none.exhaustive,true);
});

test('a catalogue with no damage items returns an empty build',()=>{
  const defensive=toBuildItems({'3075':CATALOGUE['3075'],'3089':CATALOGUE['3089']});
  const best=bestBuild(CAITLYN,11,defensive,6);
  assert.deepEqual(best.items,[]);
  assert.equal(best.dps,combatProfile(CAITLYN,11).dps);
});

test('the same item is never picked twice',()=>{
  const best=bestBuild(CAITLYN,11,items(),MAX_BUILD_SIZE);
  const ids=best.items.map(i=>i.id);
  assert.equal(new Set(ids).size,ids.length);
});

/**
 * The claim that matters: beam search finds the same answer as checking every
 * combination. Verified here on a catalogue small enough to check exhaustively.
 */
test('beam search matches exhaustive search on a checkable catalogue',()=>{
  const list=items();
  for(let size=1;size<=4;size++){
    const beam=bestBuild(CAITLYN,11,list,size,2);   // deliberately narrow beam
    const exact=bruteForce(CAITLYN,11,list,size);
    assert.equal(beam.dps,exact.dps,`size ${size}: beam ${beam.dps} vs exact ${exact.dps}`);
  }
});

test('greedy picking is not assumed to be optimal',()=>{
  // Crit and attack damage only pay off together, so the single best item is
  // not always in the best pair. The search must be free to swap it out.
  const list=items();
  const single=bestBuild(CAITLYN,11,list,1).items[0].name;
  const pair=bestBuild(CAITLYN,11,list,2).items.map(i=>i.name);
  const exactPair=bruteForce(CAITLYN,11,list,2).ids;
  assert.deepEqual(
    [...pair].sort(),
    exactPair.map(id=>list.find(i=>i.id===id)!.name).sort(),
    'the pair matches exhaustive search whether or not it contains the best single');
  assert.ok(single.length>0);
});

test('reports whether the answer was proven or searched',()=>{
  const small=bestBuild(CAITLYN,11,items(),2);
  assert.equal(small.exhaustive,true,'a tiny space is checked in full');
  assert.ok(small.evaluated>0,'and says how much work it did');
});

/* ------------------------------------------------------- buying order -- */

test('buying order spends on the item that pays off soonest',()=>{
  const best=bestBuild(CAITLYN,11,items(),3);
  assert.equal(best.steps.length,3);
  for(let i=1;i<best.steps.length;i++)
    assert.ok(best.steps[i].dpsAfter>=best.steps[i-1].dpsAfter,'DPS never falls as you buy');
  assert.ok(best.steps[0].gain>0);
  assert.equal(
    best.steps[best.steps.length-1].dpsAfter,best.dps,
    'the finished build matches the build it was ordering');
});

test('buying order covers exactly the items in the build',()=>{
  const best=bestBuild(CAITLYN,11,items(),4);
  assert.deepEqual(best.steps.map(s=>s.name).sort(),best.items.map(i=>i.name).sort());
  assert.equal(best.steps[best.steps.length-1].goldAfter,best.gold);
});

test('ordering an empty build produces no steps',()=>{
  assert.deepEqual(orderForBuying(CAITLYN,11,[]),[]);
});

/* -------------------------------------------------------- skill order -- */

const spell=(id:string,name:string,cooldown?:number[],maxrank=5)=>({id,name,maxrank,cooldown});

const darius:ChampionDetail={
  id:'Darius',key:'122',name:'Darius',title:'the Hand of Noxus',
  tags:['Fighter'],partype:'Mana',
  info:{attack:9,defense:5,magic:1,difficulty:2},
  stats:CAITLYN,
  passive:{name:'Hemorrhage',description:''},
  spells:[
    spell('Q','Decimate',[9,8,7,6,5]),
    spell('W','Crippling Strike',[9,8,7,6,5]),
    spell('E','Apprehend',[24,21,18,15,12]),
    spell('R','Noxian Guillotine',[120,100,80],3),
  ],
};

test('maxes the ability that gains the most uptime first',()=>{
  const order=skillOrder(darius);
  // Apprehend 24s -> 12s is +100% uptime; Decimate 9s -> 5s is +80%.
  assert.equal(order.maxOrder[0].name,'Apprehend');
  assert.equal(order.shorthand.startsWith('E'),true);
  assert.match(order.maxOrder[0].fact,/100% more often/);
});

test('says plainly that this is uptime and not damage',()=>{
  const order=skillOrder(darius);
  assert.match(order.basis,/not a damage ordering/);
  assert.ok(order.unavailable.some(u=>/damage-optimal order/.test(u)));
});

test('the sequence spends all eighteen levels',()=>{
  const seq=skillOrder(darius).sequence;
  assert.equal(seq.length,18);
  assert.deepEqual(seq.map(s=>s.level),Array.from({length:18},(_,i)=>i+1));
});

test('the ultimate ranks at 6, 11 and 16 and nowhere else',()=>{
  const seq=skillOrder(darius).sequence;
  const ultLevels=seq.filter(s=>s.slot==='R').map(s=>s.level);
  assert.deepEqual(ultLevels,ULT_LEVELS);
});

test('each basic reaches rank five, in the order it is maxed',()=>{
  const order=skillOrder(darius);
  const seq=order.sequence;
  for(const slot of ['Q','W','E'] as const){
    const ranks=seq.filter(s=>s.slot===slot);
    assert.equal(ranks.length,5,`${slot} gets five points`);
    assert.deepEqual(ranks.map(r=>r.rankAfter),[1,2,3,4,5],'ranks climb one at a time');
  }
  // Completion levels are derived, not asserted: every spare level goes to the
  // ability being maxed, so the first finishes at 8 rather than the 9 guides use.
  assert.deepEqual(order.maxOrder.map(a=>a.maxedAtLevel),[8,13,18]);
  order.maxOrder.forEach(ability=>{
    const finished=seq.filter(s=>s.slot===ability.slot).pop()!;
    assert.equal(finished.level,ability.maxedAtLevel,'maxedAtLevel matches the sequence');
  });
  assert.equal(CONVENTIONAL_FIRST_MAX,9,'and we know that differs from the convention');
});

test('every basic gets a point in the first three levels',()=>{
  const early=skillOrder(darius).sequence.slice(0,3).map(s=>s.slot);
  assert.deepEqual([...early].sort(),['E','Q','W']);
});

test('an ability with a flat cooldown is not claimed to gain uptime',()=>{
  const flat={...darius,spells:[
    spell('Q','Flat One',[10,10,10,10,10]),
    spell('W','Improving',[20,17,14,11,8]),
    spell('E','Also Flat',[8,8,8,8,8]),
    spell('R','Ult',[100,90,80],3),
  ]} as ChampionDetail;
  const order=skillOrder(flat);
  assert.equal(order.maxOrder[0].name,'Improving','the one that actually improves goes first');
  const flatAbility=order.maxOrder.find(a=>a.name==='Flat One')!;
  assert.equal(flatAbility.uptimeGainPercent,0);
  assert.match(flatAbility.fact,/buys power rather than uptime/);
});

test('an ability reaching zero cooldown does not produce Infinity',()=>{
  const urgot={...darius,spells:[
    spell('Q','Corrosive Charge',[15,13,11,9,7]),
    spell('W','Purge',[12,9,6,3,0]),
    spell('E','Disdain',[16,15,14,13,12]),
    spell('R','Fear Beyond Death',[120,100,80],3),
  ]} as ChampionDetail;
  const purge=skillOrder(urgot).maxOrder.find(a=>a.name==='Purge')!;
  assert.equal(purge.uptimeGainPercent,null);
  assert.match(purge.fact,/no cooldown at all/);
  assert.doesNotMatch(JSON.stringify(skillOrder(urgot)),/Infinity|NaN/);
});

test('a champion with no spells still returns a usable shape',()=>{
  const bare={...darius,spells:[]} as ChampionDetail;
  const order=skillOrder(bare);
  assert.equal(order.ultimate,null);
  assert.ok(order.unavailable.length>0);
  assert.doesNotMatch(JSON.stringify(order),/undefined/);
});

/* ------------------------------------------------------------ helpers -- */

/** Checks every combination. Only viable for tiny catalogues. */
function bruteForce(base:ChampionStatBlock,level:number,list:BuildItem[],size:number){
  const relevant=list.filter(i=>
    i.stats.attackDamage>0||i.stats.attackSpeedRatio>0||i.stats.critChance>0);
  let best={dps:-1,ids:[] as number[]};
  const walk=(start:number,chosen:BuildItem[])=>{
    if(chosen.length===size){
      const dps=combatProfile(base,level,chosen.reduce(
        (t,i)=>({...t,
          attackDamage:t.attackDamage+i.stats.attackDamage,
          attackSpeedRatio:t.attackSpeedRatio+i.stats.attackSpeedRatio,
          critChance:t.critChance+i.stats.critChance,
        }),emptyStats())).dps;
      if(dps>best.dps)best={dps,ids:chosen.map(i=>i.id)};
      return;
    }
    for(let i=start;i<relevant.length;i++)walk(i+1,[...chosen,relevant[i]]);
  };
  walk(0,[]);
  return best;
}


/* --- gold budget: the unconstrained maximum costs ~18,000g, which no game reaches --- */

test('respects a gold budget',()=>{
  const budget=7000;
  const best=bestBuild(CAITLYN,18,items(),6,250,budget);
  assert.ok(best.gold<=budget,`spent ${best.gold} within ${budget}`);
  assert.ok(best.items.length>0,'and still buys something');
});

test('a budget that affords nothing returns an empty build, not a crash',()=>{
  const best=bestBuild(CAITLYN,18,items(),6,250,10);
  assert.deepEqual(best.items,[]);
  assert.equal(best.dps,combatProfile(CAITLYN,18).dps);
});

test('a tighter budget never beats a looser one',()=>{
  const tight=bestBuild(CAITLYN,18,items(),6,250,6000);
  const loose=bestBuild(CAITLYN,18,items(),6,250,12000);
  const none=bestBuild(CAITLYN,18,items(),6);
  assert.ok(loose.dps>=tight.dps);
  assert.ok(none.dps>=loose.dps);
});

test('a budget can stop the build short of the size asked for',()=>{
  // Six items are wanted but only a few are affordable. Returning the best
  // affordable build beats returning nothing.
  const best=bestBuild(CAITLYN,18,items(),6,250,4000);
  assert.ok(best.items.length<6);
  assert.ok(best.gold<=4000);
  assert.equal(best.steps.length,best.items.length,'steps still describe the build');
});

test('budget threads through the by-size table',()=>{
  for(const b of maxDpsBySize(CAITLYN,18,items(),4,250,7000))
    assert.ok(b.gold<=7000);
});
