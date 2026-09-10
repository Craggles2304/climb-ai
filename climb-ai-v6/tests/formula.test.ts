import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCalculation,dataValue,STAT_ENUM,DEFAULT_STAT,
  type CombatStats,type EvalContext,type SpellDataValue,
} from '../lib/combat/formula';

/**
 * Fixtures are copied verbatim from CommunityDragon's game files, not invented.
 * Darius Q and Lux Q are the anchors because their decoded formulas can be
 * checked against the abilities as they actually behave:
 *
 *   Darius Q rank 1 = 50 + 100% total AD
 *   Lux Q    rank 1 = 80 + 0.75 x AP
 */

const stats=(over:Partial<CombatStats>={}):CombatStats=>({
  abilityPower:0,attackDamage:0,armor:0,magicResist:0,
  maxHealth:0,critChance:0,critDamageMultiplier:1.75,
  attackSpeed:0,moveSpeed:0,mana:0,...over,
});

const ctx=(over:Partial<EvalContext>={}):EvalContext=>({
  caster:stats(),level:1,rank:1,dataValues:[],...over,
});

/* --- Darius Q: NamedDataValue + StatBySubPart(Product) ------------------- */

const DARIUS_Q_VALUES:SpellDataValue[]=[
  {name:'TotalADRatio',values:[90,100,110,120,130,140,150]},
  {name:'BaseDamage',values:[10,50,80,110,140,170,200]},
];

const DARIUS_BLADE={
  tooltipOnly:true,
  mFormulaParts:[
    {mDataValue:'BaseDamage',__type:'NamedDataValueCalculationPart'},
    {
      mStat:2,
      mSubpart:{
        mPart1:{mDataValue:'TotalADRatio',__type:'NamedDataValueCalculationPart'},
        mPart2:{mNumber:0.01,__type:'NumberCalculationPart'},
        __type:'ProductOfSubPartsCalculationPart',
      },
      __type:'StatBySubPartCalculationPart',
    },
  ],
  __type:'GameCalculation',
};

test('Darius Q decodes to its real damage',()=>{
  const result=evaluateCalculation(DARIUS_BLADE,ctx({
    caster:stats({attackDamage:64}),rank:1,dataValues:DARIUS_Q_VALUES,
  }));
  assert.deepEqual(result.unmodelled,[]);
  // 50 base + 64 AD x (100 x 0.01) = 114
  assert.equal(result.value,114);
});

test('Darius Q scales correctly with rank and attack damage',()=>{
  const at=(rank:number,ad:number)=>evaluateCalculation(DARIUS_BLADE,ctx({
    caster:stats({attackDamage:ad}),rank,dataValues:DARIUS_Q_VALUES,
  })).value;
  // Index 5 of TotalADRatio is 140, not 150 — the seventh array slot exists for
  // ranks above 5 and is not what rank 5 reads.
  assert.equal(at(5,100),170+100*1.4,'rank 5 is 170 + 140% AD');
  assert.equal(at(1,0),50,'no attack damage leaves only the base');
  assert.ok(at(3,80)!>at(1,80)!,'a higher rank hits harder');
});

test('rank indexes past the placeholder at index 0',()=>{
  // values[0] is rank 0 and is never the rank-1 figure. Reading it would make
  // Darius Q 10 base damage instead of 50.
  const c=ctx({rank:1,dataValues:DARIUS_Q_VALUES});
  assert.equal(dataValue('BaseDamage',c),50);
  assert.equal(dataValue('BaseDamage',ctx({rank:5,dataValues:DARIUS_Q_VALUES})),170);
});

test('a rank beyond the array clamps rather than returning undefined',()=>{
  assert.equal(dataValue('BaseDamage',ctx({rank:99,dataValues:DARIUS_Q_VALUES})),200);
  assert.equal(dataValue('BaseDamage',ctx({rank:-4,dataValues:DARIUS_Q_VALUES})),10);
});

/* --- GameCalculationModified: Darius Q handle ---------------------------- */

test('a modified calculation multiplies the one it references',()=>{
  const handle={
    mMultiplier:{mNumber:0.35,__type:'NumberCalculationPart'},
    mModifiedGameCalculation:'BladeDamage',
    __type:'GameCalculationModified',
  };
  const result=evaluateCalculation(handle,ctx({
    caster:stats({attackDamage:64}),rank:1,dataValues:DARIUS_Q_VALUES,
    calculations:{BladeDamage:DARIUS_BLADE},
  }));
  assert.deepEqual(result.unmodelled,[]);
  assert.ok(Math.abs(result.value!-114*0.35)<0.001);
});

test('a modified calculation that references a missing one is reported',()=>{
  const orphan={
    mMultiplier:{mNumber:0.5,__type:'NumberCalculationPart'},
    mModifiedGameCalculation:'DoesNotExist',
    __type:'GameCalculationModified',
  };
  const result=evaluateCalculation(orphan,ctx({calculations:{}}));
  assert.equal(result.value,null);
  assert.match(result.unmodelled[0],/DoesNotExist/);
});

/* --- Lux Q: the absent-mStat rule --------------------------------------- */

const LUX_Q={
  mSimpleTooltipCalculationDisplay:6,
  mFormulaParts:[
    {mDataValue:'BaseDamage',__type:'NamedDataValueCalculationPart'},
    {mDataValue:'APRatio',__type:'StatByNamedDataValueCalculationPart'},
  ],
  __type:'GameCalculation',
};

const LUX_Q_VALUES:SpellDataValue[]=[
  {name:'BaseDamage',values:[40,80,120,160,200,240]},
  {name:'APRatio',values:[0.75,0.75,0.75,0.75,0.75,0.75]},
];

test('a part with no mStat scales with ability power',()=>{
  // This is the rule a survey of mStat values cannot find, because AP parts
  // omit the field entirely. Getting it wrong silently zeroes every mage.
  const result=evaluateCalculation(LUX_Q,ctx({
    caster:stats({abilityPower:100}),rank:1,dataValues:LUX_Q_VALUES,
  }));
  assert.deepEqual(result.unmodelled,[]);
  assert.equal(result.value,80+100*0.75);
  assert.equal(DEFAULT_STAT,'abilityPower');
});

test('ratios already expressed as decimals are not rescaled',()=>{
  // Darius carries TotalADRatio 100 with an explicit x0.01 in the tree; Lux
  // carries APRatio 0.75 with none. Helpfully rescaling either breaks the other.
  const result=evaluateCalculation(LUX_Q,ctx({
    caster:stats({abilityPower:400}),rank:5,dataValues:LUX_Q_VALUES,
  }));
  assert.equal(result.value,240+400*0.75);
});

test('StatByCoefficient multiplies a stat by a literal',()=>{
  const ahriQ={
    mFormulaParts:[
      {mDataValue:'BaseDamage',__type:'NamedDataValueCalculationPart'},
      {mCoefficient:0.5,__type:'StatByCoefficientCalculationPart'},
    ],
    __type:'GameCalculation',
  };
  const result=evaluateCalculation(ahriQ,ctx({
    caster:stats({abilityPower:200}),rank:1,
    dataValues:[{name:'BaseDamage',values:[10,35,60,85,110,135]}],
  }));
  assert.equal(result.value,35+200*0.5);
});

/* --- stat enum mapping -------------------------------------------------- */

test('the mapped stat enums are the ones evidence confirmed',()=>{
  assert.equal(STAT_ENUM[1],'armor');
  assert.equal(STAT_ENUM[2],'attackDamage');
  assert.equal(STAT_ENUM[8],'critChance');
  assert.equal(STAT_ENUM[12],'maxHealth');
});

test('an unmapped stat enum is refused, not guessed at',()=>{
  // A wrong stat produces a plausible wrong number, which is worse than no
  // number at all.
  const unknown={
    mFormulaParts:[{mStat:31,mCoefficient:1,__type:'StatByCoefficientCalculationPart'}],
    __type:'GameCalculation',
  };
  const result=evaluateCalculation(unknown,ctx({caster:stats({abilityPower:500})}));
  assert.equal(result.value,null);
  assert.match(result.unmodelled[0],/stat #31/);
});

test('armor scaling reads the caster armor',()=>{
  const thunderclap={
    mFormulaParts:[{mStat:1,mCoefficient:0.2,__type:'StatByCoefficientCalculationPart'}],
    __type:'GameCalculation',
  };
  const result=evaluateCalculation(thunderclap,ctx({caster:stats({armor:150})}));
  assert.equal(result.value,30);
});

/* --- level scaling ------------------------------------------------------ */

test('level interpolation runs from level 1 to 18',()=>{
  const part={
    mFormulaParts:[{
      mStartValue:10,mEndValue:180,
      __type:'ByCharLevelInterpolationCalculationPart',
    }],
    __type:'GameCalculation',
  };
  assert.equal(evaluateCalculation(part,ctx({level:1})).value,10);
  assert.equal(evaluateCalculation(part,ctx({level:18})).value,180);
  const mid=evaluateCalculation(part,ctx({level:9})).value!;
  assert.ok(mid>10&&mid<180,'and is between at a middle level');
});

test('level breakpoints change the growth rate at their own level',()=>{
  // Garen's real structure: 1.5 at level 1, +0.2 per level, then +0.8 per level
  // from 7, then +0.4 per level from 14.
  const garen={
    mFormulaParts:[{
      mLevel1Value:1.5,
      mInitialBonusPerLevel:0.2,
      mBreakpoints:[
        {mLevel:7,mBonusPerLevelAtAndAfter:0.8,__type:'Breakpoint'},
        {mLevel:14,mBonusPerLevelAtAndAfter:0.4,__type:'Breakpoint'},
      ],
      __type:'ByCharLevelBreakpointsCalculationPart',
    }],
    __type:'GameCalculation',
  };
  const at=(level:number)=>evaluateCalculation(garen,ctx({level})).value!;
  assert.equal(at(1),1.5,'level 1 is the base');
  assert.ok(Math.abs(at(2)-1.7)<1e-9,'one level at the initial rate');
  assert.ok(Math.abs(at(6)-(1.5+0.2*5))<1e-9,'still the initial rate up to 6');
  assert.ok(Math.abs(at(7)-(1.5+0.2*5+0.8))<1e-9,'the level-7 rate applies at 7');
  assert.ok(at(18)>at(14)&&at(14)>at(7),'it keeps climbing');
});

/* --- honest failure ----------------------------------------------------- */

test('stack scaling is refused unless the caller supplies the stacks',()=>{
  const stacking={
    mFormulaParts:[{mCoefficient:12,__type:'BuffCounterByCoefficientCalculationPart'}],
    __type:'GameCalculation',
  };
  const blind=evaluateCalculation(stacking,ctx());
  assert.equal(blind.value,null);
  assert.match(blind.unmodelled[0],/buff stacks/);

  const known=evaluateCalculation(stacking,ctx({stacks:5}));
  assert.equal(known.value,60,'given the stacks it computes');
  assert.deepEqual(known.unmodelled,[]);
});

test('an unknown part type is named rather than treated as zero',()=>{
  const weird={
    mFormulaParts:[
      {mDataValue:'BaseDamage',__type:'NamedDataValueCalculationPart'},
      {__type:'SomethingRiotAdded'},
    ],
    __type:'GameCalculation',
  };
  const result=evaluateCalculation(weird,ctx({
    rank:1,dataValues:[{name:'BaseDamage',values:[0,50]}],
  }));
  assert.equal(result.value,null,'a partial sum must not pass as a real number');
  assert.match(result.unmodelled[0],/SomethingRiotAdded/);
});

test('a hashed part type Riot never named is reported as such',()=>{
  const hashed={mFormulaParts:[{__type:'{f3cbe7b2}'}],__type:'GameCalculation'};
  const result=evaluateCalculation(hashed,ctx());
  assert.equal(result.value,null);
  assert.ok(result.unmodelled.length>0);
});

test('a missing data value is named',()=>{
  const result=evaluateCalculation(
    {mFormulaParts:[{mDataValue:'Nope',__type:'NamedDataValueCalculationPart'}],__type:'GameCalculation'},
    ctx({dataValues:DARIUS_Q_VALUES}));
  assert.equal(result.value,null);
  assert.match(result.unmodelled[0],/"Nope"/);
});

test('an empty or malformed calculation never returns a number',()=>{
  for(const bad of [null,undefined,{},{__type:'GameCalculation'},{__type:'GameCalculation',mFormulaParts:[]}]){
    const result=evaluateCalculation(bad,ctx());
    assert.equal(result.value,null,JSON.stringify(bad));
  }
});

test('a circular modified calculation terminates',()=>{
  const loop:Record<string,unknown>={
    mModifiedGameCalculation:'Self',
    mMultiplier:{mNumber:1,__type:'NumberCalculationPart'},
    __type:'GameCalculationModified',
  };
  const result=evaluateCalculation(loop,ctx({calculations:{Self:loop}}));
  assert.equal(result.value,null);
  assert.ok(result.unmodelled.some(u=>/too deeply/.test(u)));
});

test('one unmodelled part poisons the whole result',()=>{
  // A sum that silently drops a term looks exactly like a correct one.
  const mixed={
    mFormulaParts:[
      {mDataValue:'BaseDamage',__type:'NamedDataValueCalculationPart'},
      {mStat:99,mCoefficient:1,__type:'StatByCoefficientCalculationPart'},
    ],
    __type:'GameCalculation',
  };
  const result=evaluateCalculation(mixed,ctx({
    rank:1,dataValues:[{name:'BaseDamage',values:[0,50]}],
    caster:stats({attackDamage:100}),
  }));
  assert.equal(result.value,null);
  assert.ok(result.unmodelled.length>0);
});

/* --- part types added after measuring what blocked coverage ------------- */

const calc=(parts:unknown[])=>({mFormulaParts:parts,__type:'GameCalculation'});

test('a keyed reference evaluates the calculation it points at',()=>{
  const result=evaluateCalculation(
    calc([{mSpellCalculationKey:'Base',__type:'{f3cbe7b2}'}]),
    ctx({rank:1,dataValues:[{name:'BaseDamage',values:[0,75]}],
      calculations:{Base:calc([{mDataValue:'BaseDamage',__type:'NamedDataValueCalculationPart'}])}}));
  assert.equal(result.value,75);
});

test('a keyed reference to something absent is named, not zeroed',()=>{
  const result=evaluateCalculation(
    calc([{mSpellCalculationKey:'Missing',__type:'{f3cbe7b2}'}]),ctx({calculations:{}}));
  assert.equal(result.value,null);
  assert.match(result.unmodelled[0],/"Missing"/);
});

test('a per-level value table is read by champion level',()=>{
  const table=calc([{values:[16,26,36,46,56],__type:'ByCharLevelFormulaCalculationPart'}]);
  assert.equal(evaluateCalculation(table,ctx({level:1})).value,16);
  assert.equal(evaluateCalculation(table,ctx({level:3})).value,36);
});

test('a per-level table that does not reach this level is reported',()=>{
  const short=calc([{values:[10,20],__type:'ByCharLevelFormulaCalculationPart'}]);
  const result=evaluateCalculation(short,ctx({level:11}));
  assert.equal(result.value,null);
  assert.match(result.unmodelled[0],/does not cover this level/);
});

test('effect values read the unnamed per-rank rows',()=>{
  const result=evaluateCalculation(
    calc([{mEffectIndex:1,__type:'EffectValueCalculationPart'}]),
    ctx({rank:2,effectAmounts:[[],[5,10,20,30],[1,2,3,4]]}));
  assert.equal(result.value,20,'row 1, rank 2');
});

test('effect values refuse rather than guess when not supplied',()=>{
  const result=evaluateCalculation(
    calc([{mEffectIndex:1,__type:'EffectValueCalculationPart'}]),ctx());
  assert.equal(result.value,null);
  assert.match(result.unmodelled[0],/were not supplied/);
});

test('resource scaling reads the caster mana pool',()=>{
  const result=evaluateCalculation(
    calc([{mCoefficient:0.02,__type:'AbilityResourceByCoefficientCalculationPart'}]),
    ctx({caster:stats({mana:1500})}));
  assert.equal(result.value,30);
});

test('a clamped sum is held between its floor and ceiling',()=>{
  const clamped=(attackSpeed:number)=>evaluateCalculation(
    calc([{
      mCeiling:2,mFloor:1,
      mSubparts:[
        {mStat:4,mCoefficient:1,__type:'StatByCoefficientCalculationPart'},
        {mNumber:0,__type:'NumberCalculationPart'},
      ],
      __type:'ClampSubPartsCalculationPart',
    }]),ctx({caster:stats({attackSpeed})})).value;
  assert.equal(clamped(0.5),1,'below the floor clamps up');
  assert.equal(clamped(1.5),1.5,'inside the band passes through');
  assert.equal(clamped(4),2,'above the ceiling clamps down');
});

test('the cooldown multiplier is 1 with no ability haste',()=>{
  const cd=calc([{__type:'CooldownMultiplierCalculationPart'}]);
  assert.equal(evaluateCalculation(cd,ctx()).value,1);
  // Standard League haste maths: 100/(100+haste).
  assert.equal(evaluateCalculation(cd,ctx({abilityHaste:100})).value,0.5);
});

test('crit damage uses the multiplier stat, not ability power',()=>{
  // Garen's CriticalDamage is TotalDamage x (1 + CritMod x (stat9 - 1)).
  // Reading stat 9 as ability power would make this nonsense.
  const garen={
    mMultiplier:{
      mSubparts:[
        {mNumber:1,__type:'NumberCalculationPart'},
        {
          mPart1:{mDataValue:'CritMod',__type:'NamedDataValueCalculationPart'},
          mPart2:{mSubparts:[
            {mStat:9,mCoefficient:1,__type:'StatByCoefficientCalculationPart'},
            {mNumber:-1,__type:'NumberCalculationPart'},
          ],__type:'SumOfSubPartsCalculationPart'},
          __type:'ProductOfSubPartsCalculationPart',
        },
      ],
      __type:'SumOfSubPartsCalculationPart',
    },
    mModifiedGameCalculation:'TotalDamage',
    __type:'GameCalculationModified',
  };
  const result=evaluateCalculation(garen,ctx({
    caster:stats({critDamageMultiplier:1.75,abilityPower:999}),
    rank:1,
    dataValues:[{name:'CritMod',values:[1,1]},{name:'Base',values:[0,100]}],
    calculations:{TotalDamage:calc([{mDataValue:'Base',__type:'NamedDataValueCalculationPart'}])},
  }));
  // 100 x (1 + 1 x (1.75 - 1)) = 175
  assert.equal(result.value,175);
});

test('the newly mapped stat enums read the right stats',()=>{
  const byStat=(mStat:number,caster:Partial<CombatStats>)=>evaluateCalculation(
    calc([{mStat,mCoefficient:1,__type:'StatByCoefficientCalculationPart'}]),
    ctx({caster:stats(caster)})).value;
  assert.equal(byStat(4,{attackSpeed:1.4}),1.4,'4 is attack speed');
  assert.equal(byStat(6,{magicResist:55}),55,'6 is magic resist');
  assert.equal(byStat(7,{moveSpeed:345}),345,'7 is move speed');
  assert.equal(byStat(9,{critDamageMultiplier:1.75}),1.75,'9 is crit damage');
});

test('buff conditions and buff timing are named as live-state gaps',()=>{
  const conditional=evaluateCalculation(
    calc([{mConditionalGameCalculation:'X',__type:'GameCalculationConditional'}]),ctx());
  assert.equal(conditional.value,null);
  assert.match(conditional.unmodelled[0],/buff condition/);

  const elapsed=evaluateCalculation(
    calc([{buffName:'X',Coefficient:2,__type:'PercentageOfBuffNameElapsed'}]),ctx());
  assert.equal(elapsed.value,null);
  assert.match(elapsed.unmodelled[0],/how long a buff has been running/);
});
