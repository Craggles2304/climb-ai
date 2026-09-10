import test from 'node:test';
import assert from 'node:assert/strict';
import {
  combatProfile,dpsCurve,parseItemStats,addStats,emptyStats,rankItems,byDamagePerGold,
  CRIT_MULTIPLIER,ATTACK_SPEED_CAP,
} from '../lib/champions/dps';
import {statsAtLevel} from '../lib/champions/ddragon';
import {rankMatchups,scoreMatchup,WEIGHTS,EVEN_BAND,BLIND_SPOTS} from '../lib/champions/ranking';
import type {ChampionListEntry,ChampionStatBlock} from '../lib/champions/ddragon';

/** Real Data Dragon values, patch 16.18.1. */
const CAITLYN:ChampionStatBlock={
  hp:580,hpperlevel:107,mp:315,mpperlevel:40,movespeed:325,
  armor:27,armorperlevel:4.7,spellblock:33,spellblockperlevel:1.1,
  attackrange:650,hpregen:3.5,hpregenperlevel:0.55,mpregen:7.4,mpregenperlevel:0.7,
  crit:0,critperlevel:0,attackdamage:62,attackdamageperlevel:0,
  attackspeedperlevel:4,attackspeed:0.681,
};

const DARIUS:ChampionStatBlock={
  hp:652,hpperlevel:114,mp:263,mpperlevel:58,movespeed:340,
  armor:37,armorperlevel:5.2,spellblock:32,spellblockperlevel:2.05,
  attackrange:175,hpregen:10,hpregenperlevel:0.95,mpregen:6.6,mpregenperlevel:0.35,
  crit:0,critperlevel:0,attackdamage:64,attackdamageperlevel:0,
  attackspeedperlevel:1,attackspeed:0.625,
};

/** Real item payloads. */
const ITEMS={
  '3031':{name:'Infinity Edge',gold:{total:3500},stats:{FlatCritChanceMod:0.25,FlatPhysicalDamageMod:75}},
  '3072':{name:'Bloodthirster',gold:{total:3400},stats:{FlatPhysicalDamageMod:80,PercentLifeStealMod:0.15}},
  '3089':{name:"Rabadon's Deathcap",gold:{total:3500},stats:{FlatMagicDamageMod:130}},
  '3075':{name:'Thornmail',gold:{total:2450},stats:{FlatHPPoolMod:150,FlatArmorMod:75}},
  '3006':{name:'Berserker\'s Greaves',gold:{total:1100},stats:{PercentAttackSpeedMod:0.35}},
};

/* -------------------------------------------------------------- dps ----- */

test('parses every Data Dragon item stat key it is given',()=>{
  const s=parseItemStats(ITEMS['3031'].stats);
  assert.equal(s.attackDamage,75);
  assert.equal(s.critChance,0.25);
  assert.equal(s.abilityPower,0);
});

test('missing or malformed item stats parse to zeroes, never NaN',()=>{
  for(const bad of [undefined,{},{FlatPhysicalDamageMod:NaN}]){
    const s=parseItemStats(bad as Record<string,number>|undefined);
    for(const v of Object.values(s))assert.ok(Number.isFinite(v),'every stat is a real number');
  }
});

test('DPS with no items is attack damage times attack speed',()=>{
  const level=11;
  const s=statsAtLevel(CAITLYN,level);
  const c=combatProfile(CAITLYN,level);
  assert.equal(c.critChance,0,'no crit without items');
  assert.equal(c.effectiveAttackDamage,c.attackDamage,'no crit means no averaging');
  assert.ok(Math.abs(c.dps-s.attackDamage*s.attackSpeed)<0.5);
});

test('bonus attack speed is additive against base, not multiplicative',()=>{
  // Multiplying the level-scaled figure would overstate every AS item. At
  // level 11 Caitlyn already carries level bonus, so the two differ visibly.
  const level=11;
  const s=statsAtLevel(CAITLYN,level);
  const boots=parseItemStats(ITEMS['3006'].stats);
  const c=combatProfile(CAITLYN,level,boots);
  const correct=s.baseAttackSpeed*(1+s.bonusAttackSpeedRatio+0.35);
  const wrong=s.attackSpeed*1.35;
  assert.ok(Math.abs(c.attackSpeed-correct)<0.002,'uses the additive formula');
  assert.ok(Math.abs(c.attackSpeed-wrong)>0.01,'and is not the multiplicative one');
});

test('crit is averaged into expected damage at the real multiplier',()=>{
  const level=11;
  const ie=parseItemStats(ITEMS['3031'].stats);
  const c=combatProfile(CAITLYN,level,ie);
  assert.equal(c.critChance,0.25);
  const expected=c.attackDamage*(1+0.25*(CRIT_MULTIPLIER-1));
  assert.ok(Math.abs(c.effectiveAttackDamage-expected)<0.2);
});

test('crit chance and attack speed are capped at the game limits',()=>{
  const huge={...emptyStats(),critChance:5,attackSpeedRatio:10};
  const c=combatProfile(CAITLYN,18,huge);
  assert.equal(c.critChance,1,'crit cannot exceed 100%');
  assert.equal(c.attackSpeed,ATTACK_SPEED_CAP);
  assert.equal(c.attackSpeedCapped,true,'and the waste is reported');
});

test('the DPS curve covers every level and rises',()=>{
  const curve=dpsCurve(CAITLYN);
  assert.equal(curve.length,18);
  assert.equal(curve[0].level,1);
  assert.equal(curve[17].level,18);
  assert.ok(curve[17].dps>curve[0].dps,'a champion gets stronger with levels');
  for(const p of curve)assert.ok(Number.isFinite(p.dps)&&p.dps>0);
});

test('item stats add together',()=>{
  const both=addStats(parseItemStats(ITEMS['3031'].stats),parseItemStats(ITEMS['3072'].stats));
  assert.equal(both.attackDamage,155);
  assert.equal(both.critChance,0.25);
});

/* ------------------------------------------------------- item ranking --- */

test('ranks items by the damage they actually add per gold',()=>{
  const ranked=byDamagePerGold(rankItems(CAITLYN,11,ITEMS));
  assert.ok(ranked.length>0);
  for(let i=1;i<ranked.length;i++)
    assert.ok((ranked[i-1].dpsPerThousandGold??0)>=(ranked[i].dpsPerThousandGold??0),'sorted');
  assert.ok(ranked.some(r=>r.name==='Infinity Edge'));
});

test('an AP item on an auto-attacker reports zero DPS and says why',()=>{
  // This is the trap: Rabadon's adds no auto-attack damage, and presenting
  // that as "worst item" would be badly wrong for an ability-based champion.
  const rabadon=rankItems(CAITLYN,11,ITEMS).find(v=>v.name==="Rabadon's Deathcap")!;
  assert.equal(rabadon.dpsGain,0);
  assert.equal(rabadon.dpsPerThousandGold,null,'not ranked on a scale it does not belong to');
  assert.equal(rabadon.abilityPowerGain,130,'the stat it does give is still reported');
  assert.match(rabadon.note!,/Riot does not publish ability damage/);
});

test('a defensive item reports effective HP rather than damage',()=>{
  const thorn=rankItems(DARIUS,11,ITEMS).find(v=>v.name==='Thornmail')!;
  assert.equal(thorn.dpsGain,0);
  assert.ok(thorn.ehpGain>0,'armour and health are real value');
});

test('item value is measured on top of what is already built',()=>{
  const first=rankItems(CAITLYN,11,ITEMS).find(v=>v.name==='Infinity Edge')!;
  const built=parseItemStats(ITEMS['3072'].stats);
  const second=rankItems(CAITLYN,11,ITEMS,built).find(v=>v.name==='Infinity Edge')!;
  assert.ok(second.dpsGain>first.dpsGain,
    'crit scales with attack damage, so IE is worth more after an AD item');
});

test('warns when attack speed is wasted, and says how badly',()=>{
  // Crossing the cap wastes part of the item. Buying it while already capped
  // wastes all of it, and that is the case worth shouting about.
  // Caitlyn at 18 already carries +68% from levels, so this sits just under
  // the cap and the boots push it over.
  const crossing={...emptyStats(),attackSpeedRatio:1.8};
  const partial=rankItems(CAITLYN,18,ITEMS,crossing).find(v=>v.name.includes('Greaves'))!;
  assert.match(partial.note??'',/part of its attack speed is wasted/);

  const alreadyCapped={...emptyStats(),attackSpeedRatio:3};
  const total=rankItems(CAITLYN,18,ITEMS,alreadyCapped).find(v=>v.name.includes('Greaves'))!;
  assert.match(total.note??'',/does nothing at all/);
  assert.equal(total.dpsGain,0,'and the DPS gain agrees with the warning');
});

/* ---------------------------------------------------- matchup ranking --- */

const entry=(id:string,stats:ChampionStatBlock,info:{attack:number;defense:number;magic:number;difficulty:number},tags=['Fighter']):ChampionListEntry=>
  ({id,key:id,name:id,title:'',tags,partype:'Mana',info,stats});

const roster=():Record<string,ChampionListEntry>=>({
  Caitlyn:entry('Caitlyn',CAITLYN,{attack:8,defense:2,magic:2,difficulty:6},['Marksman']),
  Darius:entry('Darius',DARIUS,{attack:9,defense:5,magic:1,difficulty:2},['Fighter','Tank']),
  Twin:entry('Twin',CAITLYN,{attack:8,defense:2,magic:2,difficulty:6},['Marksman']),
  Slow:entry('Slow',{...DARIUS,movespeed:300},{attack:9,defense:5,magic:1,difficulty:2},['Fighter']),
});

test('range dominates the score, because it dominates a lane',()=>{
  const s=scoreMatchup(roster().Caitlyn,roster().Darius,6);
  const range=s.contributions.find(c=>c.key==='attackRange')!;
  assert.equal(range.edge,'YOU');
  assert.ok(range.points>0);
  assert.ok(Math.abs(range.points)<=WEIGHTS.attackRange,'never exceeds its weight');
});

test('the score flips sign when the matchup is reversed',()=>{
  const a=scoreMatchup(roster().Caitlyn,roster().Darius,6);
  const b=scoreMatchup(roster().Darius,roster().Caitlyn,6);
  assert.ok(a.score>0&&b.score<0,'someone cannot be favoured in both directions');
});

test('a mirror matchup scores zero and reads as even',()=>{
  const s=scoreMatchup(roster().Caitlyn,roster().Twin,6);
  assert.equal(s.score,0);
  assert.equal(s.edge,'EVEN');
  for(const c of s.contributions)assert.equal(c.edge,'EVEN');
});

test('contributions never exceed their declared weight',()=>{
  const r=rankMatchups(roster(),'Caitlyn',{level:6})!;
  for(const m of r.all)
    for(const c of m.contributions)
      assert.ok(Math.abs(c.points)<=WEIGHTS[c.key]+0.05,`${c.key} stayed within weight`);
});

test('the total score stays inside -100..100',()=>{
  const r=rankMatchups(roster(),'Caitlyn',{level:6})!;
  for(const m of r.all)assert.ok(m.score>=-100&&m.score<=100);
});

test('strongest and weakest are the ends of the same ordering',()=>{
  const r=rankMatchups(roster(),'Caitlyn',{level:6})!;
  assert.equal(r.strongest[0].score,r.all[0].score);
  assert.equal(r.weakest[0].score,r.all[r.all.length-1].score);
  assert.ok(!r.all.some(m=>m.opponentId==='Caitlyn'),'a champion is not its own matchup');
});

test('a near-zero contribution is called even, not shown as a decimal edge',()=>{
  const s=scoreMatchup(roster().Darius,roster().Slow,6);
  const ad=s.contributions.find(c=>c.key==='attackDamage')!;
  assert.equal(ad.edge,'EVEN','identical attack damage');
  assert.match(ad.note,/level/);
});

test('every matchup carries the full breakdown, so no score is a black box',()=>{
  const r=rankMatchups(roster(),'Caitlyn',{level:6})!;
  for(const m of r.all){
    assert.equal(m.contributions.length,Object.keys(WEIGHTS).length);
    for(const c of m.contributions)assert.ok(c.note.length>0,'every contribution explains itself');
  }
});

test('the ranking never presents itself as a win rate',()=>{
  const r=rankMatchups(roster(),'Caitlyn',{level:6})!;
  const text=JSON.stringify({all:r.all,strongest:r.strongest,weakest:r.weakest});
  assert.doesNotMatch(text,/win rate/i);
  assert.doesNotMatch(text,/\d+\s*%\s*win/i);
  assert.doesNotMatch(text,/counter/i);
  assert.doesNotMatch(text,/\b\d\d\/\d\d\b/,'no fabricated 55/45 splits');
});

test('the blind spots travel with the ranking rather than living in a doc',()=>{
  const r=rankMatchups(roster(),'Caitlyn',{level:6})!;
  assert.deepEqual(r.blindSpots,BLIND_SPOTS);
  assert.ok(r.blindSpots.some(b=>/Ability damage/.test(b)));
  assert.ok(r.blindSpots.some(b=>/large sample of real matches/.test(b)));
});

test('an unknown champion returns null rather than an empty ranking',()=>{
  assert.equal(rankMatchups(roster(),'Nobody',{level:6}),null);
});

test('the even band keeps small edges from being reported as advantages',()=>{
  const r=rankMatchups(roster(),'Caitlyn',{level:6})!;
  for(const m of r.all){
    if(Math.abs(m.score)<EVEN_BAND)assert.equal(m.edge,'EVEN');
    else assert.notEqual(m.edge,'EVEN');
  }
});

test('does not call the bottom of the list a losing matchup when it is not',()=>{
  // Caitlyn's worst stat matchup against the live roster scores +8. Labelling
  // that "weakest" would tell a player they lose a lane they do not.
  const r=rankMatchups(roster(),'Caitlyn',{level:6})!;
  assert.equal(r.spread.unfavourable,0,'this fixture has no losing matchups');
  assert.match(r.summary,/smallest advantage|smallest edge/);
  assert.match(r.summary,/kit/,'and names what the numbers cannot see');
});

test('says plainly when matchups do go against you',()=>{
  const r=rankMatchups(roster(),'Darius',{level:6})!;
  assert.ok(r.spread.unfavourable>0,'Darius is out-ranged by the marksmen here');
  assert.match(r.summary,/against Darius on the stat line/);
});

test('spread counts add up to the ranking',()=>{
  const r=rankMatchups(roster(),'Caitlyn',{level:6})!;
  const {favourable,unfavourable,even}=r.spread;
  assert.equal(favourable+unfavourable+even,r.all.length);
  assert.equal(r.spread.best,r.all[0].score);
  assert.equal(r.spread.worst,r.all[r.all.length-1].score);
});

test('a tag filter narrows opponents without inventing a role',()=>{
  const all=rankMatchups(roster(),'Caitlyn',{level:6})!;
  const fighters=rankMatchups(roster(),'Caitlyn',{level:6,tags:['Fighter']})!;
  assert.ok(fighters.all.length<all.all.length,'the filter actually filters');
  for(const m of fighters.all)assert.ok(m.opponentTags.includes('Fighter'));
});

test('a filter that matches nobody says so rather than showing an empty ranking',()=>{
  const none=rankMatchups(roster(),'Caitlyn',{level:6,tags:['NotATag']})!;
  assert.equal(none.all.length,0);
  assert.match(none.summary,/No opponents matched/);
});
