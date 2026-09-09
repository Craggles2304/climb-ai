import test from 'node:test';
import assert from 'node:assert/strict';
import {statsAtLevel,growthMultiplier,rangeClass,damageType,ordinal,isTrackableUltimate,MIN_ULT_WINDOW_S} from '../lib/champions/ddragon';
import {championProfile,percentilesFor,scalingFor,ULT_LEVELS,SCALING_SHIFT} from '../lib/champions/profile';
import {matchupRead,MIN_RANGE_GAP} from '../lib/champions/matchup';
import type {ChampionDetail,ChampionListEntry} from '../lib/champions/ddragon';

/**
 * Fixtures are real Data Dragon values taken from patch 16.18.1, not invented
 * numbers. If Riot changes them the maths is still correct; only the fixture
 * would need refreshing.
 */

const DARIUS_STATS={
  hp:652,hpperlevel:114,mp:263,mpperlevel:58,movespeed:340,
  armor:37,armorperlevel:5.2,spellblock:32,spellblockperlevel:2.05,
  attackrange:175,hpregen:10,hpregenperlevel:0.95,mpregen:6.6,mpregenperlevel:0.35,
  crit:0,critperlevel:0,attackdamage:64,attackdamageperlevel:0,
  attackspeedperlevel:1,attackspeed:0.625,
};

const CAITLYN_STATS={
  hp:580,hpperlevel:107,mp:315,mpperlevel:40,movespeed:325,
  armor:27,armorperlevel:4.7,spellblock:33,spellblockperlevel:1.1,
  attackrange:650,hpregen:3.5,hpregenperlevel:0.55,mpregen:7.4,mpregenperlevel:0.7,
  crit:0,critperlevel:0,attackdamage:62,attackdamageperlevel:0,
  attackspeedperlevel:4,attackspeed:0.681,
};

const darius:ChampionDetail={
  id:'Darius',key:'122',name:'Darius',title:'the Hand of Noxus',
  tags:['Fighter','Tank'],partype:'Mana',
  info:{attack:9,defense:5,magic:1,difficulty:2},
  stats:DARIUS_STATS,
  passive:{name:'Hemorrhage',description:''},
  spells:[
    {id:'DariusCleave',name:'Decimate',maxrank:5,cooldown:[9,8,7,6,5],range:[1,1,1,1,1]},
    {id:'DariusNoxianTacticsONH',name:'Crippling Strike',maxrank:5,cooldown:[9,8,7,6,5]},
    {id:'DariusAxeGrabCone',name:'Apprehend',maxrank:5,cooldown:[24,21,18,15,12]},
    {id:'DariusExecute',name:'Noxian Guillotine',maxrank:3,cooldown:[120,100,80],range:[460,460,460]},
  ],
  allytips:['Decimate is a powerful harassment ability.'],
  enemytips:["When Darius's axe grab is on cooldown, he is vulnerable to harassment attacks."],
};

const caitlyn:ChampionDetail={
  id:'Caitlyn',key:'51',name:'Caitlyn',title:'the Sheriff of Piltover',
  tags:['Marksman'],partype:'Mana',
  info:{attack:8,defense:2,magic:2,difficulty:6},
  stats:CAITLYN_STATS,
  passive:{name:'Headshot',description:''},
  spells:[
    {id:'CaitlynQ',name:'Piltover Peacemaker',maxrank:5,cooldown:[10,9,8,7,6]},
    {id:'CaitlynW',name:'Yordle Snap Trap',maxrank:5,cooldown:[1,1,1,1,1]},
    {id:'CaitlynE',name:'90 Caliber Net',maxrank:5,cooldown:[16,14,12,10,8]},
    {id:'CaitlynR',name:'Ace in the Hole',maxrank:3,cooldown:[90,90,90],range:[3500,3500,3500]},
  ],
  allytips:['Make use of her Yordle Snap Traps by placing them pre-emptively.'],
  enemytips:['Keep behind allied minions if Caitlyn is harassing you with Piltover Peacemaker.'],
};

const listEntry=(c:ChampionDetail):ChampionListEntry=>({
  id:c.id,key:c.key,name:c.name,title:c.title,tags:c.tags,
  partype:c.partype,info:c.info,stats:c.stats,
});

/** A roster with enough spread that percentiles mean something. */
const roster=():Record<string,ChampionListEntry>=>{
  const out:Record<string,ChampionListEntry>={
    Darius:listEntry(darius),Caitlyn:listEntry(caitlyn),
  };
  for(let i=0;i<10;i++){
    out[`Filler${i}`]={
      ...listEntry(caitlyn),id:`Filler${i}`,name:`Filler${i}`,
      stats:{...CAITLYN_STATS,hp:500+i*20,hpperlevel:80+i*4,attackrange:400+i*10,attackdamage:55+i},
    };
  }
  return out;
};

/* --------------------------------------------------------- stat maths -- */

test("Riot's growth curve gives exactly 17x growth at level 18",()=>{
  // The curve is designed so level 18 lands on base + 17 x growth. If this
  // drifts, every stat this codebase derives is silently wrong.
  assert.equal(Number(growthMultiplier(18).toFixed(10)),17);
  assert.equal(growthMultiplier(1),0,'level 1 is the base stat');
});

test('stats at level 18 match base plus 17 growth',()=>{
  const s=statsAtLevel(DARIUS_STATS,18);
  assert.equal(s.hp,652+114*17);
  assert.equal(s.armor,Math.round((37+5.2*17)*10)/10);
});

test('growth is non-linear early, not a straight line',()=>{
  const l2=statsAtLevel(DARIUS_STATS,2).hp;
  const linear=652+114*1;
  assert.ok(l2<linear,'level 2 gains less than a flat per-level add');
});

test('level is clamped rather than extrapolated past 18',()=>{
  assert.equal(statsAtLevel(DARIUS_STATS,40).hp,statsAtLevel(DARIUS_STATS,18).hp);
  assert.equal(statsAtLevel(DARIUS_STATS,0).hp,statsAtLevel(DARIUS_STATS,1).hp);
});

test('effective HP accounts for resistances',()=>{
  const s=statsAtLevel(DARIUS_STATS,1);
  assert.equal(s.effectiveHpVsPhysical,Math.round(652*(1+37/100)*10)/10);
  assert.ok(s.effectiveHpVsPhysical>s.hp,'armour makes you take more damage to kill');
});

test('attack speed grows as a percentage of base, not a flat add',()=>{
  const l18=statsAtLevel(CAITLYN_STATS,18).attackSpeed;
  assert.ok(l18>CAITLYN_STATS.attackspeed);
  assert.ok(l18<CAITLYN_STATS.attackspeed*2,'4% per level over 17 levels is +68%, not +400%');
});

test('range and damage type are banded from the real numbers',()=>{
  assert.equal(rangeClass(175),'MELEE');
  assert.equal(rangeClass(650),'LONG');
  assert.equal(rangeClass(550),'RANGED');
  assert.equal(damageType({attack:9,defense:5,magic:1,difficulty:2}),'PHYSICAL');
  assert.equal(damageType({attack:2,defense:2,magic:9,difficulty:5}),'MAGIC');
  assert.equal(damageType({attack:6,defense:5,magic:5,difficulty:4}),'MIXED');
});

/* ----------------------------------------------------------- profiles -- */

test('ultimate spikes land on 6/11/16 with the real cooldowns',()=>{
  const p=championProfile(darius);
  const ults=p.spikes.filter(s=>s.kind==='ULTIMATE');
  assert.deepEqual(ults.map(s=>s.level),[...ULT_LEVELS]);
  assert.match(ults[0].fact,/120s/);
  assert.match(ults[2].inference!,/20s sooner/);
});

test('a flat ultimate cooldown is called out rather than faked as a spike',()=>{
  // Ace in the Hole is 90s at every rank. Claiming level 11 gives Caitlyn more
  // ultimate uptime would be a straightforward lie about the data.
  const p=championProfile(caitlyn);
  const rank2=p.spikes.find(s=>s.level===11)!;
  assert.match(rank2.inference!,/adds power, not uptime/);
  assert.doesNotMatch(rank2.inference!,/sooner/);
});

test('picks the basic ability with the biggest cooldown gain',()=>{
  const p=championProfile(darius);
  const max=p.spikes.find(s=>s.kind==='ABILITY_MAX')!;
  assert.equal(max.level,9);
  assert.match(max.fact,/Apprehend/,'24s to 12s beats Decimate 9s to 5s');
});

test('all-in windows are stated as downtime in both directions',()=>{
  const p=championProfile(darius);
  assert.equal(p.allInWindows.length,3);
  assert.equal(p.allInWindows[0].cooldownSeconds,120);
  assert.match(p.allInWindows[0].inference,/2m 00s/);
  assert.match(p.allInWindows[0].inference,/when the enemy has just used theirs/);
});

test('Riot tips are passed through verbatim, not reworded',()=>{
  const p=championProfile(darius);
  assert.deepEqual(p.riotEnemyTips,darius.enemytips);
  assert.deepEqual(p.riotAllyTips,darius.allytips);
});

test('a champion with no spell data still produces a profile',()=>{
  const bare={...darius,spells:[],allytips:undefined,enemytips:undefined};
  const p=championProfile(bare as ChampionDetail);
  assert.deepEqual(p.spikes,[]);
  assert.deepEqual(p.allInWindows,[]);
  assert.deepEqual(p.riotEnemyTips,[]);
  assert.ok(p.lanePlan.length>0,'stat-derived plan does not need spells');
});

test('percentiles are empty rather than invented when no roster is given',()=>{
  const p=championProfile(darius);
  assert.deepEqual(p.percentiles,[]);
  assert.deepEqual(p.scaling,[]);
  assert.ok(p.unavailable.some(u=>/Roster comparison/.test(u)),'the gap is declared');
});

test('pathing is declared unavailable rather than guessed',()=>{
  const p=championProfile(darius,roster());
  assert.ok(p.unavailable.some(u=>/pathing/i.test(u)));
});

test('percentiles rank a champion against the roster',()=>{
  const r=roster();
  const range=percentilesFor(r,'Caitlyn',11).find(p=>p.stat==='ATTACK_RANGE')!;
  assert.equal(range.percentile,100,'650 is the longest range in this roster');
  const dariusRange=percentilesFor(r,'Darius',11).find(p=>p.stat==='ATTACK_RANGE')!;
  assert.equal(dariusRange.percentile,0,'175 is the shortest');
});

test('percentiles are empty for a champion not in the roster',()=>{
  assert.deepEqual(percentilesFor(roster(),'Nobody',11),[]);
});

test('scaling compares one champion against the roster early and late',()=>{
  const reads=scalingFor(roster(),'Darius');
  const ehp=reads.find(r=>r.stat==='EFFECTIVE_HP')!;
  assert.equal(ehp.shift,ehp.latePercentile-ehp.earlyPercentile);
  assert.ok(['EARLY_GAME','SCALING','FLAT'].includes(ehp.verdict));
  if(Math.abs(ehp.shift)<SCALING_SHIFT)assert.equal(ehp.verdict,'FLAT');
  assert.match(ehp.fact,/percentile of the roster at level 2/);
});

/* ----------------------------------------------------------- matchups -- */

test('names the range gap and says what to do about it',()=>{
  const m=matchupRead(darius,caitlyn);
  const range=m.facts.find(f=>f.key==='attackRange')!;
  assert.equal(range.edge,'THEM');
  assert.match(range.note!,/475 units further/);
  assert.ok(m.howToPlayIt.some(x=>/475-unit gap/.test(x)));
});

test('the range edge flips with the point of view',()=>{
  const m=matchupRead(caitlyn,darius);
  assert.equal(m.facts.find(f=>f.key==='attackRange')!.edge,'YOU');
});

test('a small range difference is called even, not an edge',()=>{
  const near={...caitlyn,id:'Near',name:'Near',
    stats:{...CAITLYN_STATS,attackrange:CAITLYN_STATS.attackrange-(MIN_RANGE_GAP-1)}};
  const m=matchupRead(caitlyn,near as ChampionDetail);
  assert.equal(m.facts.find(f=>f.key==='attackRange')!.edge,'EVEN');
});

test('durability is measured against the damage actually coming at you',()=>{
  const m=matchupRead(darius,caitlyn);
  const ehp=m.facts.find(f=>f.key==='effectiveHp')!;
  assert.match(ehp.you,/vs physical damage/,'Caitlyn deals physical, so Darius is read on armour');
  assert.equal(ehp.edge,'YOU','Darius is far more durable at level 6');
});

test('the enemy ultimate cooldown is offered as the all-in window',()=>{
  const m=matchupRead(darius,caitlyn);
  const ult=m.facts.find(f=>f.key==='ultimate')!;
  assert.match(ult.note!,/without it for 90s/);
  assert.ok(m.howToPlayIt.some(x=>/Ace in the Hole/.test(x)));
});

test("surfaces Riot's own advice about the opponent, not about you",()=>{
  const m=matchupRead(darius,caitlyn);
  assert.deepEqual(m.riotSaysAboutThem,caitlyn.enemytips);
});

test('never claims a win rate, and says so',()=>{
  const m=matchupRead(darius,caitlyn);
  assert.match(m.caveat,/not a win rate/);
  assert.ok(m.unavailable.some(u=>/Win rate/.test(u)));
  const text=[...m.facts.map(f=>`${f.note??''} ${f.you} ${f.them}`),...m.howToPlayIt].join(' ');
  assert.doesNotMatch(text,/\d+\s*%\s*win/i);
  assert.doesNotMatch(text,/win rate/i);
  assert.doesNotMatch(text,/\b\d\d\/\d\d\b/,'no fabricated 55/45 style splits');
});

test('does not claim one champion counters the other outright',()=>{
  const text=JSON.stringify(matchupRead(darius,caitlyn));
  for(const banned of [/hard counter/i,/guaranteed/i,/always wins/i,/free lane/i])
    assert.doesNotMatch(text,banned);
});

test('scaling advice only appears when the two actually differ',()=>{
  const mirror=matchupRead(darius,{...darius,id:'DariusB',name:'Darius B'} as ChampionDetail,{roster:roster()});
  assert.ok(!mirror.howToPlayIt.some(x=>/strongest relative to the roster/.test(x)),
    'a mirror has no scaling story to tell');
});

test('declares the scaling gap when no roster is supplied',()=>{
  const m=matchupRead(darius,caitlyn);
  assert.ok(m.unavailable.some(u=>/Scaling comparison/.test(u)));
});

test('reads at the requested level and clamps out-of-range ones',()=>{
  assert.equal(matchupRead(darius,caitlyn,{level:11}).level,11);
  assert.equal(matchupRead(darius,caitlyn,{level:99}).level,18);
  assert.equal(matchupRead(darius,caitlyn,{level:-4}).level,1);
});

test('both-melee lanes get the commitment note',()=>{
  const m=matchupRead(darius,{...darius,id:'D2',name:'D2'} as ChampionDetail);
  assert.ok(m.howToPlayIt.some(x=>/Both of you are melee/.test(x)));
});

/* ------------------------------ stance and charge ultimates ------------- */

/** Elise's real values: Spider Form is a 3s stance swap, not an ultimate. */
const elise:ChampionDetail={
  ...darius,id:'Elise',name:'Elise',title:'the Spider Queen',
  tags:['Mage','Assassin'],info:{attack:6,defense:5,magic:7,difficulty:9},
  spells:[
    {id:'EliseQ',name:'Neurotoxin',maxrank:5,cooldown:[6,6,6,6,6]},
    {id:'EliseW',name:'Volatile Spiderling',maxrank:5,cooldown:[12,11,10,9,8]},
    {id:'EliseE',name:'Cocoon',maxrank:5,cooldown:[14,13,12,11,10]},
    {id:'EliseR',name:'Spider Form',maxrank:3,cooldown:[3,3,3],maxammo:'-1'},
  ],
  enemytips:['Elise is vulnerable after using Rappel.'],
};

/** Teemo's ultimate is charge-based: 0.25s between placements, 3 charges. */
const teemo:ChampionDetail={
  ...caitlyn,id:'Teemo',name:'Teemo',title:'the Swift Scout',
  spells:[
    {id:'TeemoQ',name:'Blinding Dart',maxrank:5,cooldown:[8,7,6,5,4]},
    {id:'TeemoW',name:'Move Quick',maxrank:5,cooldown:[17,16,15,14,13]},
    {id:'TeemoE',name:'Toxic Shot',maxrank:5},
    {id:'TeemoR',name:'Noxious Trap',maxrank:3,cooldown:[0.25,0.25,0.25],maxammo:'3'},
  ],
  enemytips:['Buy an Oracle Lens to clear his traps.'],
};

test('a stance ultimate is not offered as an all-in window',()=>{
  // Waiting out a 3s cooldown is not advice anyone can act on. The old version
  // of this happily told players to track Spider Form.
  const p=championProfile(elise);
  assert.deepEqual(p.allInWindows,[],'Spider Form is not a window');
  assert.ok(p.unavailable.some(u=>/Spider Form/.test(u)&&/stance or charge/.test(u)),
    'and the reason is stated rather than the gap being hidden');
});

test('a charge-based ultimate is not offered as an all-in window either',()=>{
  const p=championProfile(teemo);
  assert.deepEqual(p.allInWindows,[]);
});

test('a stance ultimate still spikes at 6/11/16 but not for uptime',()=>{
  const spikes=championProfile(elise).spikes.filter(s=>s.kind==='ULTIMATE');
  assert.deepEqual(spikes.map(s=>s.level),[...ULT_LEVELS]);
  assert.match(spikes[1].inference!,/effectively always available/);
  assert.doesNotMatch(spikes[1].inference!,/sooner|one more fight/);
});

test('a real ultimate is still tracked normally',()=>{
  assert.equal(championProfile(darius).allInWindows.length,3);
  assert.ok(!championProfile(darius).unavailable.some(u=>/stance or charge/.test(u)));
});

test('a matchup never tells you to wait out a stance ultimate',()=>{
  const m=matchupRead(darius,elise);
  assert.ok(!m.howToPlayIt.some(x=>/Track Spider Form/.test(x)));
  const ult=m.facts.find(f=>f.key==='ultimate')!;
  assert.match(ult.them,/always up/);
  assert.match(ult.note!,/no window to wait for/);
  assert.equal(ult.edge,'EVEN','a stance is not an ultimate-cooldown advantage');
});

test('a matchup still tells you to wait out a real ultimate',()=>{
  const m=matchupRead(elise,darius);
  assert.ok(m.howToPlayIt.some(x=>/Track Noxian Guillotine/.test(x)));
});

test('ordinals read correctly, including the teens',()=>{
  assert.equal(ordinal(1),'1st');
  assert.equal(ordinal(2),'2nd');
  assert.equal(ordinal(3),'3rd');
  assert.equal(ordinal(4),'4th');
  assert.equal(ordinal(11),'11th');
  assert.equal(ordinal(12),'12th');
  assert.equal(ordinal(13),'13th');
  assert.equal(ordinal(21),'21st');
  assert.equal(ordinal(93),'93rd','this said "93th" against real roster data');
  assert.equal(ordinal(100),'100th');
  assert.equal(ordinal(0),'0th');
});

test('scaling facts use real ordinals',()=>{
  for(const id of ['Darius','Caitlyn'])
    for(const s of scalingFor(roster(),id))
      assert.doesNotMatch(s.fact,/\d(?:1th|2th|3th)\b/,'no "93th"');
});

test('an ability that reaches zero cooldown does not produce Infinity%',()=>{
  // Urgot's Purge really does go 12s -> 0s. Against the live roster this
  // rendered as "available about Infinity% more often".
  const urgot={...darius,id:'Urgot',name:'Urgot',spells:[
    {id:'UrgotQ',name:'Corrosive Charge',maxrank:5,cooldown:[15,13,11,9,7]},
    {id:'UrgotW',name:'Purge',maxrank:5,cooldown:[12,9,6,3,0]},
    {id:'UrgotE',name:'Disdain',maxrank:5,cooldown:[16,15,14,13,12]},
    {id:'UrgotR',name:'Fear Beyond Death',maxrank:3,cooldown:[120,100,80]},
  ]} as ChampionDetail;
  const max=championProfile(urgot).spikes.find(s=>s.kind==='ABILITY_MAX')!;
  assert.match(max.fact,/Purge/);
  assert.match(max.inference!,/no cooldown left at all/);
  for(const s of championProfile(urgot).spikes)
    assert.doesNotMatch(`${s.fact} ${s.inference}`,/Infinity|NaN|undefined/);
});
