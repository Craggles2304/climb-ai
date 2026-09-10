import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mitigate,mitigateAll,damageMultiplier,effectiveResistance,killThreshold,
  noPenetration,penetrationFromLethality,
  LETHALITY_TO_FLAT_PEN,PRACTICAL_KILL_MARGIN,
  type DamageComponent,
} from '../lib/combat/damage';

const target=(armor:number,magicResist=0)=>({armor,magicResist});

/* ------------------------------------------------------- the core curve -- */

test('100 resistance halves damage',()=>{
  assert.equal(damageMultiplier(100),0.5);
  assert.equal(damageMultiplier(0),1);
  assert.equal(damageMultiplier(300),0.25);
});

test('negative resistance amplifies, but more gently than positive reduces',()=>{
  // -100 armour multiplies damage by 1.5, not by 2. Getting this backwards
  // overstates damage against every shredded target.
  assert.equal(damageMultiplier(-100),1.5);
  assert.ok(damageMultiplier(-50)>1&&damageMultiplier(-50)<1.5);
  assert.ok(damageMultiplier(-1000)<2,'it asymptotes towards 2 rather than exceeding it');
});

test('mitigation is the curve applied to raw damage',()=>{
  const result=mitigate(400,'PHYSICAL',target(100));
  assert.equal(result.raw,400);
  assert.equal(result.mitigated,200);
  assert.equal(result.absorbed,200);
  assert.equal(result.effectiveResistance,100);
  assert.equal(result.multiplier,0.5);
});

test('true damage ignores resistances entirely',()=>{
  const result=mitigate(400,'TRUE',target(300,300),penetrationFromLethality(50));
  assert.equal(result.mitigated,400);
  assert.equal(result.absorbed,0);
  assert.equal(result.multiplier,1);
  assert.equal(result.effectiveResistance,0);
});

test('magic damage reads magic resist, not armour',()=>{
  const physical=mitigate(300,'PHYSICAL',target(200,0));
  const magic=mitigate(300,'MAGIC',target(200,0));
  assert.ok(magic.mitigated>physical.mitigated,'200 armour does nothing to magic damage');
  assert.equal(magic.effectiveResistance,0);
});

/* -------------------------------------------------- penetration ordering -- */

test('penetration cannot drive a resistance below zero',()=>{
  // 20 armour against 25 lethality sits at 0, not -5. Allowing it negative
  // would hand the attacker an amplification bonus that does not exist.
  const resistance=effectiveResistance(20,{flatPen:25});
  assert.equal(resistance,0);
  const result=mitigate(100,'PHYSICAL',target(20),penetrationFromLethality(25));
  assert.equal(result.mitigated,100,'full damage, not amplified');
  assert.equal(result.multiplier,1);
});

test('reduction CAN drive a resistance below zero',()=>{
  // This is the difference between the two operations, and it is real: armour
  // reduction genuinely amplifies, penetration merely removes.
  const resistance=effectiveResistance(20,{flatReduction:50});
  assert.ok(resistance<0,`expected negative, got ${resistance}`);
  const result=mitigate(100,'PHYSICAL',target(20),
    {...noPenetration(),flatArmorReduction:50});
  assert.ok(result.mitigated>100,'reduced past zero amplifies');
});

test('percent penetration applies before flat, not after',()=>{
  // 200 armour, 40% pen then 20 flat = 100 then 80. The other order gives
  // 180 then 108, overstating the target armour and understating damage.
  const resistance=effectiveResistance(200,{percentPen:0.4,flatPen:20});
  assert.equal(resistance,100,'0.6 x 200 = 120, minus 20 flat = 100');
});

test('reduction applies before penetration',()=>{
  // 100 armour, 30 reduction, then 50% pen = 70 then 35.
  assert.equal(effectiveResistance(100,{flatReduction:30,percentPen:0.5}),35);
});

test('percent reduction and percent penetration are not the same step',()=>{
  const reductionOnly=effectiveResistance(100,{percentReduction:0.3});
  const penOnly=effectiveResistance(100,{percentPen:0.3});
  assert.equal(reductionOnly,70);
  assert.equal(penOnly,70);
  // Together they compound rather than summing to 60%.
  assert.equal(effectiveResistance(100,{percentReduction:0.3,percentPen:0.3}),49);
});

test('lethality converts to flat penetration at the documented rate',()=>{
  const pen=penetrationFromLethality(18);
  assert.equal(pen.flatArmorPen,18*LETHALITY_TO_FLAT_PEN);
  assert.equal(pen.percentArmorPen,0);
  assert.equal(penetrationFromLethality(-5).flatArmorPen,0,'negative lethality is ignored');
});

test('magic penetration is kept separate from armour penetration',()=>{
  const pen={...noPenetration(),flatArmorPen:40,flatMagicPen:0};
  assert.equal(mitigate(100,'MAGIC',target(0,40),pen).effectiveResistance,40,
    'armour pen does not touch magic resist');
  const magicPen={...noPenetration(),flatMagicPen:40};
  assert.equal(mitigate(100,'MAGIC',target(0,40),magicPen).effectiveResistance,0);
});

/* ------------------------------------------------------- malformed input -- */

test('negative or non-finite raw damage does not produce nonsense',()=>{
  for(const raw of [-50,NaN,Infinity]){
    const result=mitigate(raw,'PHYSICAL',target(50));
    assert.ok(Number.isFinite(result.mitigated)&&result.mitigated>=0,String(raw));
  }
});

test('penetration values outside their range are clamped',()=>{
  assert.equal(effectiveResistance(100,{percentPen:5}),0,'over 100% pen is still just 100%');
  assert.equal(effectiveResistance(100,{percentPen:-2}),100,'negative pen does not add armour');
});

/* ----------------------------------------------------------- components -- */

const components=():DamageComponent[]=>[
  {label:'Physical hit',type:'PHYSICAL',raw:200},
  {label:'Magic burn',type:'MAGIC',raw:100},
  {label:'Execute',type:'TRUE',raw:50},
];

test('each component is mitigated against its own resistance',()=>{
  const result=mitigateAll(components(),target(100,0));
  assert.equal(result.components.length,3);
  const physical=result.components.find(c=>c.label==='Physical hit')!;
  const magic=result.components.find(c=>c.label==='Magic burn')!;
  const trueDamage=result.components.find(c=>c.label==='Execute')!;
  assert.equal(physical.mitigated,100,'halved by 100 armour');
  assert.equal(magic.mitigated,100,'untouched by armour');
  assert.equal(trueDamage.mitigated,50);
  assert.equal(result.rawTotal,350);
  assert.equal(result.mitigatedTotal,250);
  assert.equal(result.complete,true);
});

test('a mixed-damage ability is not countered by one resistance',()=>{
  const armourStack=mitigateAll(components(),target(300,0));
  const mrStack=mitigateAll(components(),target(0,300));
  assert.ok(armourStack.mitigatedTotal>0&&mrStack.mitigatedTotal>0);
  assert.notEqual(armourStack.mitigatedTotal,mrStack.mitigatedTotal);
  assert.ok(armourStack.mitigatedTotal>mitigateAll(components(),target(300,300)).mitigatedTotal,
    'stacking both resists beats stacking one');
});

test('an unresolvable component is skipped and the total flagged incomplete',()=>{
  const partial:DamageComponent[]=[
    {label:'Known',type:'PHYSICAL',raw:200},
    {label:'Stacking passive',type:'MAGIC',raw:null,unmodelled:['Scales with buff stacks.']},
  ];
  const result=mitigateAll(partial,target(0));
  assert.equal(result.components.length,1);
  assert.equal(result.mitigatedTotal,200);
  assert.equal(result.complete,false,'the total is a floor, not a total');
  assert.deepEqual(result.skipped,[{label:'Stacking passive',reasons:['Scales with buff stacks.']}]);
});

test('a skipped component without a stated reason still gets one',()=>{
  const result=mitigateAll([{label:'Mystery',type:'TRUE',raw:null}],target(0));
  assert.equal(result.complete,false);
  assert.ok(result.skipped[0].reasons[0].length>0);
});

test('an empty component list is complete and zero, not an error',()=>{
  const result=mitigateAll([],target(50));
  assert.equal(result.mitigatedTotal,0);
  assert.equal(result.complete,true);
});

/* ------------------------------------------------------ kill thresholds -- */

test('a kill threshold is damage over health, with a practical margin below it',()=>{
  const check=killThreshold(800,1000);
  assert.equal(check.kills,false);
  assert.equal(check.thresholdPercent,80);
  assert.equal(check.practicalThresholdPercent,round(80*PRACTICAL_KILL_MARGIN));
  assert.ok(check.practicalThresholdPercent!<check.thresholdPercent!,
    'the number to act on is stricter than the theoretical one');
  assert.match(check.note,/Allow for a missed hit/);
});

test('lethal from full health says so',()=>{
  const check=killThreshold(1200,1000);
  assert.equal(check.kills,true);
  assert.equal(check.thresholdPercent,100);
  assert.match(check.note,/Lethal from full health/);
});

test('a shield is subtracted before the threshold is worked out',()=>{
  const bare=killThreshold(800,1000);
  const shielded=killThreshold(800,1000,300);
  assert.ok(shielded.thresholdPercent!<bare.thresholdPercent!);
  assert.equal(shielded.damage,500);
  assert.equal(shielded.shield,300);
});

test('a shield larger than the damage is reported as no kill, not a negative',()=>{
  const check=killThreshold(200,1000,500);
  assert.equal(check.damage,0);
  assert.equal(check.kills,false);
  assert.equal(check.thresholdPercent,null);
  assert.match(check.note,/no damage the target cannot absorb/);
});

test('zero or nonsense health does not divide by zero',()=>{
  for(const health of [0,-100,NaN]){
    const check=killThreshold(500,health);
    assert.ok(Number.isFinite(check.targetHealth)&&check.targetHealth>0,String(health));
    assert.ok(check.thresholdPercent===null||Number.isFinite(check.thresholdPercent));
  }
});

const round=(n:number)=>Math.round(n*10)/10;
