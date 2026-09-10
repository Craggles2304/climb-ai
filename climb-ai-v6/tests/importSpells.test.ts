import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseChampionSpells,isCastAbility,dealsDamage,looksLikeCastAbility,
  sourceIdFor,binUrlFor,
} from '../lib/combat/importSpells';

/**
 * Fixtures are the real field shapes from CommunityDragon, including the two
 * that caused bugs: the object-wrapped number lists, and the fact that resource
 * costs are indexed from rank 1 while cooldowns are indexed from rank 0.
 *
 * Cross-checked against Data Dragon: Darius Q costs 25/30/35/40/45 for ranks
 * 1-5 on a 9/8/7/6/5 cooldown.
 */

const DARIUS_Q={
  mSpell:{
    mana:[25,30,35,40,45,50],
    manaValues:{values:[25,30,35,40,45,50],__type:'{630af303}'},
    cooldownTime:[10,9,8,7,6,5,5],
    Cooldown:{values:[10,9,8,7,6,5,5],__type:'{0a0eddc9}'},
    castRange:[270,270,270,270,270,270,270],
    mCastTime:0.2344,
    DataValues:[
      {name:'BaseDamage',values:[10,50,80,110,140,170,200],__type:'SpellDataValue'},
    ],
    mEffectAmount:[
      {__type:'SpellEffectAmount'},
      {value:[90,90,90,90,90,90,90],__type:'SpellEffectAmount'},
    ],
    mSpellCalculations:{BladeDamage:{__type:'GameCalculation',mFormulaParts:[]}},
  },
};

/** Apprehend: a real ability with cost and cooldown and no damage at all. */
const DARIUS_E={
  mSpell:{
    mana:[70,60,50,40,30,20],
    Cooldown:{values:[26,26,23.5,21,18.5,16,16],__type:'{0a0eddc9}'},
  },
};

const raw=()=>({
  'Characters/Darius/Spells/DariusCleaveAbility/DariusCleave':DARIUS_Q,
  'Characters/Darius/Spells/DariusAxeGrabConeAbility/DariusAxeGrabCone':DARIUS_E,
  'Characters/Darius/Spells/DariusCleaveAbility/DariusCleaveMissile':{mSpell:{}},
  'Characters/Darius/NotASpell':{mName:'nope'},
});

const parse=()=>normaliseChampionSpells('Darius',raw(),'latest');
const spellNamed=(name:string)=>parse().spells.find(s=>s.name===name)!;

/* ------------------------------------------------------------- structure -- */

test('only entries carrying a spell become spells',()=>{
  const names=parse().spells.map(s=>s.name);
  assert.ok(names.includes('DariusCleave'));
  assert.ok(names.includes('DariusAxeGrabCone'));
  assert.ok(!names.includes('NotASpell'),'a non-spell entry is skipped');
});

test('champion ids map to the game-file directory form',()=>{
  assert.equal(sourceIdFor("Kog'Maw"),'kogmaw');
  assert.equal(sourceIdFor('MonkeyKing'),'monkeyking');
  assert.equal(sourceIdFor('Darius'),'darius');
  assert.match(binUrlFor("Kog'Maw"),/characters\/kogmaw\/kogmaw\.bin\.json$/);
});

test('the source and patch travel with the data',()=>{
  const parsed=parse();
  assert.equal(parsed.source,'communitydragon');
  assert.equal(parsed.patch,'latest');
  assert.equal(parsed.championId,'Darius');
});

/* ------------------------------------------- the object-wrapper bug ------ */

test('reads number lists whether they are arrays or wrapped in an object',()=>{
  // manaValues and Cooldown are objects; mana and cooldownTime are arrays.
  // Reading the object first and parsing it as an array yielded nothing, which
  // made every ability cost 0 on a fallback cooldown.
  const q=spellNamed('DariusCleave');
  assert.ok(q.costByRank.length>0,'cost was read');
  assert.ok(q.cooldownByRank.length>0,'cooldown was read');
});

test('falls back to the wrapped field when the plain array is absent',()=>{
  // Apprehend has no cooldownTime, only the Cooldown object.
  const e=spellNamed('DariusAxeGrabCone');
  assert.ok(e.cooldownByRank.length>0);
  assert.equal(e.cooldownByRank[1],26,'rank 1 cooldown');
});

/* ------------------------------------------- the rank-indexing bug ------- */

test('cost is indexed by rank, matching Data Dragon',()=>{
  // Data Dragon: Darius Q costs 25/30/35/40/45 at ranks 1-5. The raw list starts
  // at rank 1, so a placeholder is prepended and rank N reads index N.
  const q=spellNamed('DariusCleave');
  assert.equal(q.costByRank[1],25,'rank 1');
  assert.equal(q.costByRank[3],35,'rank 3');
  assert.equal(q.costByRank[5],45,'rank 5');
});

test('cooldown is indexed by rank, matching Data Dragon',()=>{
  // Data Dragon: 9/8/7/6/5. The raw list already starts at rank 0.
  const q=spellNamed('DariusCleave');
  assert.equal(q.cooldownByRank[1],9,'rank 1');
  assert.equal(q.cooldownByRank[3],7,'rank 3');
  assert.equal(q.cooldownByRank[5],5,'rank 5');
});

test('cost and cooldown agree on what rank 1 means',()=>{
  // The whole point: the two source arrays use different conventions, and after
  // normalising, index 1 is rank 1 for both.
  const q=spellNamed('DariusCleave');
  assert.equal(q.costByRank[1],25);
  assert.equal(q.cooldownByRank[1],9);
});

test('an absent cost list stays empty rather than inventing a placeholder',()=>{
  const manaless=normaliseChampionSpells('Garen',{
    'Characters/Garen/Spells/GarenQAbility/GarenQ':{mSpell:{cooldownTime:[8,8,8,8,8,8]}},
  },'latest').spells[0];
  assert.deepEqual(manaless.costByRank,[],'no costs means no array, not [0]');
});

/* ----------------------------------------------------------- other fields -- */

test('data values, effect rows, range and cast time are carried through',()=>{
  const q=spellNamed('DariusCleave');
  assert.equal(q.dataValues[0].name,'BaseDamage');
  assert.equal(q.dataValues[0].values[1],50,'rank 1 base damage');
  assert.deepEqual(q.effectAmounts[0],[],'row 0 is the placeholder');
  assert.equal(q.effectAmounts[1][1],90);
  assert.equal(q.rangeByRank[1],270);
  assert.equal(q.castTime,0.2344);
});

test('a spell with nothing at all parses without throwing',()=>{
  const empty=normaliseChampionSpells('X',{'a/b':{mSpell:{}}},'latest').spells[0];
  assert.deepEqual(empty.dataValues,[]);
  assert.deepEqual(empty.costByRank,[]);
  assert.equal(empty.castTime,null);
});

/* --------------------------------------------- castable vs damaging ------ */

test('a damageless ability still counts as castable',()=>{
  // Apprehend costs mana and has a cooldown and deals nothing. A combo casting
  // it must still spend both, so requiring damage to recognise it was wrong.
  const e=spellNamed('DariusAxeGrabCone');
  assert.equal(dealsDamage(e),false,'it really does no damage');
  assert.equal(isCastAbility(e),true,'but it is still something you press');
});

test('a damaging ability counts as both',()=>{
  const q=spellNamed('DariusCleave');
  assert.equal(dealsDamage(q),true);
  assert.equal(isCastAbility(q),true);
});

test('missiles and internals are neither',()=>{
  const missile=spellNamed('DariusCleaveMissile');
  assert.equal(isCastAbility(missile),false);
  assert.equal(dealsDamage(missile),false);
});

test('the coverage helper still measures damage only',()=>{
  // The validation script counts damage calculations, so it must not start
  // counting Apprehend as an unsupported ability.
  assert.equal(looksLikeCastAbility(spellNamed('DariusAxeGrabCone')),false);
  assert.equal(looksLikeCastAbility(spellNamed('DariusCleave')),true);
});
