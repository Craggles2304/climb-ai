import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareTrades,runTrade,TRADE_SCENARIOS,EVEN_TRADE_POINTS,
  type TradeSide,type TradeScenario,
} from '../lib/combat/trades';
import type {AbilityModel,AbilitySlot} from '../lib/combat/combos';

const ability=(
  slot:AbilitySlot,raw:number,
  over:Partial<AbilityModel>={},
):AbilityModel=>({
  slot,name:`${slot} ability`,rank:1,
  cooldownSeconds:8,cost:40,castTimeSeconds:0.25,
  damage:[{label:'hit',type:'PHYSICAL',raw}],...over,
});

const side=(over:Partial<TradeSide>={}):TradeSide=>({
  champion:'Tester',
  abilities:{Q:ability('Q',150)},
  autoAttack:{damage:60,attackSpeed:1},
  mana:400,
  maxHealth:1000,
  resistances:{armor:0,magicResist:0},
  ...over,
});

/** Burst: one big ability, weak autos, long cooldown. */
const burst=():TradeSide=>side({
  champion:'Burst',
  abilities:{Q:ability('Q',400,{cooldownSeconds:12})},
  autoAttack:{damage:20,attackSpeed:0.6},
});

/** Sustained: no abilities worth casting, strong fast autos. */
const sustained=():TradeSide=>side({
  champion:'Sustained',
  abilities:{},
  autoAttack:{damage:50,attackSpeed:1.6},
});

const scenario=(key:string):TradeScenario=>
  TRADE_SCENARIOS.find(s=>s.key===key)!;

/* ------------------------------------------------------------- scenarios -- */

test('every scenario produces an outcome for both sides',()=>{
  const report=compareTrades(side(),side());
  assert.equal(report.outcomes.length,TRADE_SCENARIOS.length);
  for(const outcome of report.outcomes){
    assert.ok(outcome.you.champion);
    assert.ok(outcome.them.champion);
    assert.ok(Number.isFinite(outcome.marginPoints));
    assert.ok(outcome.explanation.length>20);
  }
});

test('one auto is exactly one auto and no abilities',()=>{
  const result=runTrade(side(),side(),scenario('ONE_AUTO'));
  assert.equal(result.steps.length,1);
  assert.equal(result.steps[0].label,'Auto attack');
  assert.equal(result.manaUsed,0);
});

test('a longer budget deals at least as much as a shorter one',()=>{
  const three=runTrade(side(),side(),scenario('SHORT_3S'));
  const five=runTrade(side(),side(),scenario('MEDIUM_5S'));
  const ten=runTrade(side(),side(),scenario('EXTENDED_10S'));
  assert.ok(five.damageDealt>=three.damageDealt);
  assert.ok(ten.damageDealt>=five.damageDealt);
});

test('a full combo uses each ability at most once',()=>{
  const actor=side({abilities:{
    Q:ability('Q',150,{cooldownSeconds:0}),
    W:ability('W',100,{cooldownSeconds:0}),
  }});
  const result=runTrade(actor,side(),scenario('FULL_COMBO'));
  const casts=result.steps.filter(s=>s.label!=='Auto attack');
  assert.equal(casts.length,2,'two abilities, two casts');
  assert.equal(new Set(casts.map(s=>s.label)).size,2,'and not the same one twice');
});

test('an action starting inside the budget counts',()=>{
  // An ability cast at 2.9s lands in a 3s trade. Refusing it would understate
  // every champion whose cast time straddles the boundary.
  const slowAutos=side({
    abilities:{Q:ability('Q',200,{cooldownSeconds:0,castTimeSeconds:0.2})},
    autoAttack:{damage:10,attackSpeed:0.4},
  });
  const result=runTrade(slowAutos,side(),scenario('SHORT_3S'));
  assert.ok(result.steps.length>0);
  assert.ok(result.steps[result.steps.length-1].atSeconds<3);
});

/* -------------------------------------------------- the point of all this -- */

test('burst wins short and sustained wins long',()=>{
  // The whole reason this module exists. One number for "who wins the fight"
  // hides the fact that these two have opposite lane plans.
  const report=compareTrades(burst(),sustained());
  const short=report.outcomes.find(o=>o.scenario.key==='SHORT_3S')!;
  const long=report.outcomes.find(o=>o.scenario.key==='EXTENDED_10S')!;
  assert.equal(short.verdict,'YOU','burst takes the short trade');
  assert.equal(long.verdict,'THEM','sustained takes the long one');
});

test('a flip in the verdict is reported as the actionable sentence',()=>{
  const report=compareTrades(burst(),sustained());
  assert.ok(report.flip,'a flip was detected');
  assert.match(report.flip!,/leave early|the longer you stand/i);
});

test('a flip the other way round reads as the opposite advice',()=>{
  const report=compareTrades(sustained(),burst());
  assert.ok(report.flip);
  assert.match(report.flip!,/Survive the opening|do not disengage/i);
});

test('no flip is reported when one side wins throughout',()=>{
  const strong=side({champion:'Strong',autoAttack:{damage:200,attackSpeed:2}});
  const weak=side({champion:'Weak',abilities:{},autoAttack:{damage:5,attackSpeed:0.5}});
  const report=compareTrades(strong,weak);
  assert.equal(report.flip,null);
});

/* --------------------------------------------------------------- verdicts -- */

test('damage is compared as a share of health, not as a raw number',()=>{
  // 400 damage means something different to a 1,200-health target than to a
  // 2,400-health one, and a raw comparison would call those equal.
  const squishy=side({champion:'Squishy',maxHealth:1000});
  const tanky=side({champion:'Tanky',maxHealth:3000});
  const report=compareTrades(squishy,tanky);
  const long=report.outcomes.find(o=>o.scenario.key==='EXTENDED_10S')!;
  assert.ok(long.you.healthSharePercent<long.them.healthSharePercent,
    'identical damage into more health is a smaller share');
});

test('a mirror matchup is even at every duration',()=>{
  for(const outcome of compareTrades(side(),side()).outcomes){
    assert.equal(outcome.verdict,'EVEN');
    assert.equal(outcome.marginPoints,0);
    assert.match(outcome.explanation,/who starts it/);
  }
});

test('a margin inside the even band is not called a win',()=>{
  const a=side({champion:'A',autoAttack:{damage:60,attackSpeed:1}});
  const b=side({champion:'B',autoAttack:{damage:61,attackSpeed:1}});
  const outcome=compareTrades(a,b).outcomes.find(o=>o.scenario.key==='SHORT_3S')!;
  assert.ok(Math.abs(outcome.marginPoints)<EVEN_TRADE_POINTS);
  assert.equal(outcome.verdict,'EVEN');
});

test('health share is capped at 100 rather than reporting 180% of a health bar',()=>{
  const overkill=side({abilities:{Q:ability('Q',9000,{cooldownSeconds:0,cost:0})}});
  const result=runTrade(overkill,side({maxHealth:500}),scenario('EXTENDED_10S'));
  assert.equal(result.healthSharePercent,100);
});

/* -------------------------------------------------- resistances and mana -- */

test('resistances are applied, so armour changes who wins',()=>{
  const attacker=side({champion:'Attacker'});
  const naked=compareTrades(attacker,side({champion:'Naked'}));
  const armoured=compareTrades(attacker,side({
    champion:'Armoured',resistances:{armor:200,magicResist:0},
  }));
  const a=naked.outcomes.find(o=>o.scenario.key==='MEDIUM_5S')!;
  const b=armoured.outcomes.find(o=>o.scenario.key==='MEDIUM_5S')!;
  assert.ok(b.you.healthSharePercent<a.you.healthSharePercent,'armour reduces what you take off them');
});

test('mana limits what a side can cast',()=>{
  const poor=side({
    abilities:{Q:ability('Q',150,{cost:100,cooldownSeconds:0})},
    mana:150,
  });
  const result=runTrade(poor,side(),scenario('EXTENDED_10S'));
  const casts=result.steps.filter(s=>s.label!=='Auto attack');
  assert.equal(casts.length,1,'only one cast is affordable');
  assert.ok(result.manaLeft<100);
  assert.ok(result.steps.length>1,'and it keeps attacking after running dry');
});

test('a manaless side casts freely',()=>{
  const free=side({
    abilities:{Q:ability('Q',150,{cost:0,cooldownSeconds:1})},
    mana:0,
  });
  const result=runTrade(free,side(),scenario('EXTENDED_10S'));
  assert.ok(result.steps.filter(s=>s.label!=='Auto attack').length>1);
  assert.equal(result.manaUsed,0);
});

test('cooldowns keep an ability from being spammed',()=>{
  const result=runTrade(
    side({abilities:{Q:ability('Q',150,{cooldownSeconds:4,cost:0})}}),
    side(),scenario('EXTENDED_10S'));
  const casts=result.steps.filter(s=>s.label!=='Auto attack');
  assert.ok(casts.length<=3,`a 4s cooldown in 10s allows at most 3, got ${casts.length}`);
});

test('ability haste allows more casts in the same window',()=>{
  const base=side({abilities:{Q:ability('Q',150,{cooldownSeconds:5,cost:0})}});
  const hasted={...base,abilityHaste:200};
  const without=runTrade(base,side(),scenario('EXTENDED_10S'));
  const with_=runTrade(hasted,side(),scenario('EXTENDED_10S'));
  const casts=(r:typeof without)=>r.steps.filter(s=>s.label!=='Auto attack').length;
  assert.ok(casts(with_)>casts(without));
});

/* ----------------------------------------------------- a missed ability -- */

test('disabling a slot models the ability missing',()=>{
  const full=runTrade(burst(),sustained(),scenario('SHORT_3S'));
  const missed=runTrade({...burst(),disabled:['Q']},sustained(),scenario('SHORT_3S'));
  assert.ok(missed.damageDealt<full.damageDealt,'a missed ability deals less');
  assert.ok(!missed.steps.some(s=>s.label.startsWith('Q')),'and is never cast');
});

test('a missed key ability can turn the trade around',()=>{
  const withIt=compareTrades(burst(),sustained())
    .outcomes.find(o=>o.scenario.key==='SHORT_3S')!;
  const withoutIt=compareTrades({...burst(),disabled:['Q']},sustained())
    .outcomes.find(o=>o.scenario.key==='SHORT_3S')!;
  assert.equal(withIt.verdict,'YOU');
  assert.notEqual(withoutIt.verdict,'YOU','losing the ability loses the trade');
});

/* --------------------------------------------------------------- honesty -- */

test('the model says what it leaves out',()=>{
  const report=compareTrades(side(),side());
  assert.match(report.modelNote,/damage race, not a fight/);
  assert.match(report.modelNote,/no crowd control/);
  assert.match(report.modelNote,/not the same\s+question as who wins the lane/);
});

test('the model note is carried as an approximation in the confidence',()=>{
  const report=compareTrades(side(),side());
  assert.notEqual(report.confidence.level,'HIGH','a standing damage race is never HIGH');
  assert.equal(report.confidence.level,'MEDIUM');
});

test('a missing damage figure makes the totals floors and says so',()=>{
  const broken=side({abilities:{Q:ability('Q',0,{
    damage:[{label:'stacks',type:'PHYSICAL',raw:null,unmodelled:['Scales with buff stacks.']}],
  })}});
  const report=compareTrades(broken,side());
  const outcome=report.outcomes.find(o=>o.scenario.key==='FULL_COMBO')!;
  assert.ok(outcome.you.incomplete||outcome.them.incomplete||report.confidence.level!=='MEDIUM');
});

test('no NaN or Infinity anywhere, on any scenario',()=>{
  const odd=side({
    abilities:{Q:ability('Q',NaN,{cost:NaN,cooldownSeconds:NaN,castTimeSeconds:NaN})},
    autoAttack:{damage:NaN,attackSpeed:0},
    mana:NaN,maxHealth:NaN,
    resistances:{armor:NaN,magicResist:NaN},
  });
  const report=compareTrades(odd,odd);
  assert.doesNotMatch(JSON.stringify(report),/NaN|Infinity/);
  for(const outcome of report.outcomes){
    assert.ok(Number.isFinite(outcome.marginPoints));
    assert.ok(Number.isFinite(outcome.you.healthSharePercent));
  }
});

test('a side with nothing at all still produces a result',()=>{
  const empty=side({abilities:{},autoAttack:{damage:0,attackSpeed:0},mana:0});
  const report=compareTrades(empty,side());
  const long=report.outcomes.find(o=>o.scenario.key==='EXTENDED_10S')!;
  assert.equal(long.you.damageDealt,0);
  assert.equal(long.verdict,'THEM');
});

/* --- a trend without a sign change is still the same lesson -------------- */

test('a decaying advantage is reported even when the verdict never crosses over',()=>{
  // Veigar into Yasuo on real data goes +38.5, +17.2, +3.7. The verdict stays
  // YOU or EVEN throughout, so sign-change detection alone said nothing — and
  // "commit early, leave early" was the most useful thing on the page.
  const frontLoaded=side({
    champion:'FrontLoaded',maxHealth:3000,
    abilities:{Q:ability('Q',700,{cooldownSeconds:30,cost:0})},
    autoAttack:{damage:40,attackSpeed:0.8},
  });
  const grinder=side({
    champion:'Grinder',maxHealth:3000,abilities:{},
    autoAttack:{damage:85,attackSpeed:1},
  });
  const report=compareTrades(frontLoaded,grinder);
  const three=report.outcomes.find(o=>o.scenario.key==='SHORT_3S')!;
  const ten=report.outcomes.find(o=>o.scenario.key==='EXTENDED_10S')!;
  assert.ok(three.marginPoints>ten.marginPoints,'the edge does shrink');
  assert.ok(report.flip,'and it is reported');
  assert.match(report.flip!,/shrinks|front-loaded/i);
});

test('a growing advantage reads as the opposite advice',()=>{
  const grinder=side({
    champion:'Grinder',maxHealth:3000,abilities:{},
    autoAttack:{damage:85,attackSpeed:1},
  });
  const frontLoaded=side({
    champion:'FrontLoaded',maxHealth:3000,
    abilities:{Q:ability('Q',700,{cooldownSeconds:30,cost:0})},
    autoAttack:{damage:40,attackSpeed:0.8},
  });
  const report=compareTrades(grinder,frontLoaded);
  assert.ok(report.flip);
  assert.match(report.flip!,/grows|Time is on your side/i);
});

test('a steady margin reports no trend',()=>{
  const report=compareTrades(side(),side());
  assert.equal(report.flip,null,'a mirror has no trend to report');
});

test('a sign change is still preferred over a mere trend',()=>{
  const report=compareTrades(burst(),sustained());
  assert.ok(report.flip);
  assert.match(report.flip!,/and lose the/,'the crossover wording, not the drift wording');
});

test('the model admits it assumes both champions are in range',()=>{
  // Darius loses this race to Caitlyn on real data, which is true and also
  // beside the point: across 475 units of range he never gets to start it.
  const report=compareTrades(side(),side());
  assert.match(report.modelNote,/in range of each other/);
  assert.match(report.modelNote,/may\s+simply never get to start it/);
});
