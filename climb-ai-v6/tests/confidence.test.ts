import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessConfidence,combineConfidence,classify,
  type ConfidenceLevel,
} from '../lib/combat/confidence';
import {evaluateCalculation,type CombatStats,type EvalContext} from '../lib/combat/formula';
import {mitigateAll} from '../lib/combat/damage';
import {simulateCombo} from '../lib/combat/combos';

const stats=(over:Partial<CombatStats>={}):CombatStats=>({
  abilityPower:0,attackDamage:100,armor:0,magicResist:0,
  maxHealth:1000,critChance:0,critDamageMultiplier:1.75,
  attackSpeed:1,moveSpeed:340,mana:500,...over,
});

const ctx=(over:Partial<EvalContext>={}):EvalContext=>({
  caster:stats(),level:11,rank:3,dataValues:[],...over,
});

const calc=(parts:unknown[])=>({mFormulaParts:parts,__type:'GameCalculation'});

/* ---------------------------------------------------------------- levels -- */

test('nothing unmodelled is HIGH',()=>{
  const report=assessConfidence({});
  assert.equal(report.level,'HIGH');
  assert.equal(report.totalIsFloor,false);
  assert.deepEqual(report.causes,[]);
  assert.match(report.summary,/^HIGH/);
  assert.match(report.summary,/modelled from Riot/);
});

test('an approximation alone is MEDIUM, not LOW',()=>{
  // A timing floor makes a duration slightly wrong. It does not make a kill
  // threshold wrong, so it must not be rated the same as a missing mechanic.
  const report=assessConfidence({approximations:['Duration is a floor.']});
  assert.equal(report.level,'MEDIUM');
  assert.equal(report.totalIsFloor,false,'an approximation does not make a total a floor');
});

test('a gap in this engine is LOW',()=>{
  const report=assessConfidence({
    unmodelled:['Formula scales with stat #31, which is not mapped yet.'],
  });
  assert.equal(report.level,'LOW');
  assert.equal(report.totalIsFloor,true);
});

test('a live-state mechanic is PARTIAL, the worst rating',()=>{
  // The player knows their champion has a stacking passive. A total that omits
  // it silently is the most misleading output this engine can produce.
  const report=assessConfidence({
    unmodelled:['Scales with buff stacks, which depend on live game state.'],
  });
  assert.equal(report.level,'PARTIAL');
  assert.equal(report.totalIsFloor,true);
});

test('the worst cause sets the level',()=>{
  const report=assessConfidence({
    unmodelled:[
      'Scales with buff stacks, which depend on live game state.',
      'Formula part "X" is not modelled yet.',
    ],
    approximations:['Duration is a floor.'],
  });
  assert.equal(report.level,'PARTIAL','live state outranks the others');
  assert.equal(report.causes.length,3,'but every cause is still listed');
});

test('a blocked combo step reduces confidence without making a total a floor',()=>{
  // "This combo cannot happen" is a correct answer, not a missing number.
  const report=assessConfidence({blocked:['Q is still on cooldown for 2s at this point.']});
  assert.equal(report.level,'MEDIUM');
  assert.equal(report.totalIsFloor,false);
});

/* ------------------------------------------------------------- reporting -- */

test('the summary names the rating, the count and an actual reason',()=>{
  const report=assessConfidence({
    unmodelled:[
      'Scales with buff stacks, which depend on live game state.',
      'Only applies under a buff condition that depends on live game state.',
    ],
  });
  assert.match(report.summary,/^PARTIAL/);
  assert.match(report.summary,/2 mechanics/);
  assert.match(report.summary,/depends on live game state/);
  assert.match(report.summary,/buff stacks/,'and quotes a real cause, not a category');
});

test('the summary counts further caveats separately',()=>{
  const report=assessConfidence({
    unmodelled:['Scales with buff stacks, which depend on live game state.'],
    approximations:['Duration is a floor.','Crit is averaged.'],
  });
  assert.match(report.summary,/1 mechanic depends on live game state/);
  assert.match(report.summary,/plus 2 further caveats/);
});

test('duplicate reasons are collapsed',()=>{
  const repeated='Scales with buff stacks, which depend on live game state.';
  const report=assessConfidence({unmodelled:[repeated,repeated,repeated]});
  assert.equal(report.causes.length,1);
});

test('blank and malformed reasons are ignored',()=>{
  const report=assessConfidence({unmodelled:['','   ',undefined as unknown as string]});
  assert.equal(report.level,'HIGH');
  assert.deepEqual(report.causes,[]);
});

/* ------------------------------------------------------------- combining -- */

test('combining keeps the worst rating and every distinct cause',()=>{
  const clean=assessConfidence({});
  const approximate=assessConfidence({approximations:['Duration is a floor.']});
  const partial=assessConfidence({
    unmodelled:['Scales with buff stacks, which depend on live game state.'],
  });
  const combined=combineConfidence([clean,approximate,partial]);
  assert.equal(combined.level,'PARTIAL');
  assert.equal(combined.causes.length,2);
  assert.equal(combined.totalIsFloor,true);
});

test('combining nothing is HIGH rather than an error',()=>{
  assert.equal(combineConfidence([]).level,'HIGH');
});

test('combining identical reports does not duplicate causes',()=>{
  const one=assessConfidence({unmodelled:['Formula part "X" is not modelled yet.']});
  const combined=combineConfidence([one,one,one]);
  assert.equal(combined.causes.length,1);
  assert.equal(combined.level,one.level);
});

/* ------------------------------------------------------------------ guard -- */

/**
 * The guard that matters. Reasons are matched on their wording, which couples
 * this file to three others. So the engine is driven until it emits every
 * reason it can, and each one must classify to something real — an engine
 * change that adds a new reason has to show up as reduced confidence rather
 * than quietly passing as harmless.
 */
test('every reason the engine can emit classifies to a real category',()=>{
  const reasons=new Set<string>();
  const collect=(list:string[])=>list.forEach(r=>reasons.add(r));

  // formula.ts — data and structure problems
  collect(evaluateCalculation({__type:'GameCalculation'},ctx()).unmodelled);
  collect(evaluateCalculation(calc([]),ctx()).unmodelled);
  collect(evaluateCalculation(
    calc([{mDataValue:'Nope',__type:'NamedDataValueCalculationPart'}]),ctx()).unmodelled);
  collect(evaluateCalculation(
    calc([{mDataValue:'Nope',__type:'StatByNamedDataValueCalculationPart'}]),ctx()).unmodelled);
  collect(evaluateCalculation(
    {mModifiedGameCalculation:'Gone',__type:'GameCalculationModified'},
    ctx({calculations:{}})).unmodelled);
  collect(evaluateCalculation(
    calc([{mSpellCalculationKey:'Gone',__type:'{f3cbe7b2}'}]),ctx({calculations:{}})).unmodelled);

  // formula.ts — engine gaps
  collect(evaluateCalculation(
    calc([{mStat:31,mCoefficient:1,__type:'StatByCoefficientCalculationPart'}]),ctx()).unmodelled);
  collect(evaluateCalculation(
    calc([{mStat:'odd',mCoefficient:1,__type:'StatByCoefficientCalculationPart'}]),ctx()).unmodelled);
  collect(evaluateCalculation(calc([{__type:'SomethingNew'}]),ctx()).unmodelled);
  collect(evaluateCalculation(calc([{__type:'{abcdef12}'}]),ctx()).unmodelled);

  // formula.ts — live state
  collect(evaluateCalculation(
    calc([{mCoefficient:1,__type:'BuffCounterByCoefficientCalculationPart'}]),ctx()).unmodelled);
  collect(evaluateCalculation(
    calc([{mDataValue:'X',__type:'BuffCounterByNamedDataValueCalculationPart'}]),ctx()).unmodelled);
  collect(evaluateCalculation(
    calc([{mConditionalGameCalculation:'X',__type:'GameCalculationConditional'}]),ctx()).unmodelled);
  collect(evaluateCalculation(
    calc([{buffName:'X',Coefficient:1,__type:'PercentageOfBuffNameElapsed'}]),ctx()).unmodelled);

  // formula.ts — level scaling and effect rows
  collect(evaluateCalculation(
    calc([{values:[1,2],__type:'ByCharLevelFormulaCalculationPart'}]),ctx({level:11})).unmodelled);
  collect(evaluateCalculation(
    calc([{__type:'ByCharLevelInterpolationCalculationPart'}]),ctx()).unmodelled);
  collect(evaluateCalculation(
    calc([{__type:'ByCharLevelBreakpointsCalculationPart'}]),ctx()).unmodelled);
  collect(evaluateCalculation(
    calc([{__type:'EffectValueCalculationPart'}]),ctx()).unmodelled);
  collect(evaluateCalculation(
    calc([{mEffectIndex:1,__type:'EffectValueCalculationPart'}]),ctx()).unmodelled);
  collect(evaluateCalculation(
    calc([{mEffectIndex:9,__type:'EffectValueCalculationPart'}]),
    ctx({effectAmounts:[[],[1,2]]})).unmodelled);
  collect(evaluateCalculation(
    calc([{__type:'{ee18a47b}'}]),ctx()).unmodelled);
  collect(evaluateCalculation(
    calc([{a:'Start',b:'End',__type:'{ee18a47b}'}]),ctx()).unmodelled);

  // damage.ts
  collect(mitigateAll([{label:'x',type:'TRUE',raw:null}],{armor:0,magicResist:0})
    .skipped.flatMap(s=>s.reasons));

  // combos.ts — every blocked status
  const combo=simulateCombo({
    sequence:['W','Q','Q','E'],
    abilities:{
      Q:{slot:'Q',name:'Q',rank:1,cooldownSeconds:30,cost:10,castTimeSeconds:0.2,
        damage:[{label:'h',type:'PHYSICAL',raw:10}]},
      E:{slot:'E',name:'E',rank:1,cooldownSeconds:1,cost:9999,castTimeSeconds:0.2,
        damage:[{label:'h',type:'PHYSICAL',raw:10}]},
    },
    autoAttack:{damage:50,attackSpeed:1},
    caster:{mana:100},
    target:{health:1000,armor:0,magicResist:0},
  });
  collect(combo.blocked.map(b=>b.reason));

  assert.ok(reasons.size>=20,`expected a broad sweep, got ${reasons.size}`);

  const unclassified=[...reasons].filter(r=>classify(r)==='UNCLASSIFIED');
  assert.deepEqual(unclassified,[],
    `these reasons are not classified, so they would pass as harmless:\n${unclassified.join('\n')}`);
});

test('an unrecognised reason is not treated as harmless',()=>{
  // The failure mode this protects against: a new reason appears, matches no
  // pattern, and a PARTIAL simulation reports itself HIGH.
  assert.equal(classify('Something nobody has written a pattern for.'),'UNCLASSIFIED');
  const report=assessConfidence({unmodelled:['Something nobody has written a pattern for.']});
  assert.notEqual(report.level,'HIGH');
  assert.equal(report.level,'LOW');
  assert.equal(report.totalIsFloor,true);
});

test('the levels are ordered as the spec describes them',()=>{
  const order:ConfidenceLevel[]=['HIGH','MEDIUM','LOW','PARTIAL'];
  const levels=[
    assessConfidence({}).level,
    assessConfidence({approximations:['x']}).level,
    assessConfidence({unmodelled:['Formula part "X" is not modelled yet.']}).level,
    assessConfidence({unmodelled:['Scales with buff stacks, which depend on live game state.']}).level,
  ];
  assert.deepEqual(levels,order);
});
