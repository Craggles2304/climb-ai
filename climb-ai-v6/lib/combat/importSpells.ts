import {SpellDataValue} from './formula';

/**
 * Importer: CommunityDragon game files into a normalised spell shape.
 *
 * CommunityDragon mirrors the League client's own data files, which is where the
 * damage formulas live. Data Dragon does not publish them — its `coefficients`
 * are zeroed and its tooltips reference placeholders that resolve to nothing.
 *
 * This is an unofficial mirror of official files, so it is isolated behind this
 * one module: the combat engine consumes `NormalisedSpell` and knows nothing
 * about where it came from, which is what lets the source be replaced without
 * touching the maths.
 *
 * Shape of the source, from reading it:
 *   characters/<id>/<id>.bin.json is an object keyed by full spell paths.
 *   Entries carrying `mSpell` are spells. Each has:
 *     DataValues          named per-rank arrays, index 0 being rank 0
 *     mSpellCalculations  named GameCalculation trees
 *     mana / manaValues   resource cost per rank
 *     cooldownTime / Cooldown
 *     castRange / castRangeValues
 *   DataValuesModeOverride holds per-mode overrides — `cherry` is Arena and must
 *   be ignored for Summoner's Rift.
 */

export const COMMUNITY_DRAGON='https://raw.communitydragon.org';

/** Arena and other mode overrides that must not be applied to Rift maths. */
export const IGNORED_MODE_OVERRIDES=['cherry','nexusblitz','urf','oneforall'];

export interface NormalisedSpell{
  /** Full game path, e.g. Characters/Darius/Spells/DariusCleaveAbility/DariusCleave. */
  path:string;
  /** Short name, the last path segment. */
  name:string;
  dataValues:SpellDataValue[];
  /** Named calculation trees, passed to the evaluator as-is. */
  calculations:Record<string,unknown>;
  /** mEffectAmount rows, each a per-rank array. Row 0 is a placeholder. */
  effectAmounts:number[][];
  cooldownByRank:number[];
  costByRank:number[];
  rangeByRank:number[];
  castTime:number|null;
}

export interface NormalisedChampionSpells{
  championId:string;
  /** The CommunityDragon path segment used, for traceability. */
  sourceId:string;
  patch:string;
  source:'communitydragon';
  spells:NormalisedSpell[];
}

/**
 * Data Dragon ids map to CommunityDragon directories by lowercasing and
 * stripping punctuation — "Kog'Maw" is `kogmaw`, "MonkeyKing" is `monkeyking`.
 */
export const sourceIdFor=(championId:string)=>
  championId.toLowerCase().replace(/[^a-z0-9]/g,'');

export const binUrlFor=(championId:string,patch='latest')=>{
  const id=sourceIdFor(championId);
  return `${COMMUNITY_DRAGON}/${patch}/game/data/characters/${id}/${id}.bin.json`;
};

interface RawBin{[path:string]:unknown}

/** Parses one champion's bin file. Returns an empty spell list rather than throwing. */
export function normaliseChampionSpells(
  championId:string,raw:RawBin,patch:string,
):NormalisedChampionSpells{
  const spells:NormalisedSpell[]=[];

  for(const [path,entry] of Object.entries(raw)){
    if(!entry||typeof entry!=='object')continue;
    const node=entry as Record<string,unknown>;
    const spell=node.mSpell;
    if(!spell||typeof spell!=='object')continue;
    spells.push(normaliseSpell(path,spell as Record<string,unknown>));
  }

  return {
    championId,
    sourceId:sourceIdFor(championId),
    patch,
    source:'communitydragon',
    spells,
  };
}

function normaliseSpell(path:string,spell:Record<string,unknown>):NormalisedSpell{
  const calculations=spell.mSpellCalculations&&typeof spell.mSpellCalculations==='object'
    ?spell.mSpellCalculations as Record<string,unknown>
    :{};

  return {
    path,
    name:path.split('/').pop()??path,
    dataValues:readDataValues(spell),
    effectAmounts:readEffectAmounts(spell),
    calculations,
    cooldownByRank:numberArray(spell.Cooldown??spell.cooldownTime),
    costByRank:numberArray(spell.manaValues??spell.mana),
    rangeByRank:numberArray(spell.castRangeValues??spell.castRange),
    castTime:singleNumber(spell.mCastTime??spell.spellCastTime),
  };
}

/**
 * Mode overrides are deliberately not merged. `DataValuesModeOverride.cherry`
 * carries Arena-balanced numbers, and folding those into a Rift calculation
 * would produce damage figures for a game mode the player is not in.
 */
function readDataValues(spell:Record<string,unknown>):SpellDataValue[]{
  const raw=spell.DataValues;
  if(!Array.isArray(raw))return [];
  const out:SpellDataValue[]=[];
  for(const item of raw){
    if(!item||typeof item!=='object')continue;
    const entry=item as Record<string,unknown>;
    const name=typeof entry.name==='string'?entry.name:null;
    const values=numberArray(entry.values);
    if(name&&values.length)out.push({name,values});
  }
  return out;
}

function numberArray(value:unknown):number[]{
  if(typeof value==='number')return [value];
  if(!Array.isArray(value))return [];
  return value
    .map(v=>{
      if(typeof v==='number')return v;
      if(v&&typeof v==='object'){
        const entry=v as Record<string,unknown>;
        if(typeof entry.value==='number')return entry.value;
        // SpellEffectAmount entries can carry an array under `value`.
        if(Array.isArray(entry.value))return null;
      }
      return null;
    })
    .filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));
}

const singleNumber=(value:unknown):number|null=>
  typeof value==='number'&&Number.isFinite(value)?value:null;

/**
 * Spells whose name marks them as something other than a cast ability. The bin
 * file contains missiles, buffs, markers and internal sub-spells alongside the
 * four the player presses, and counting those as "unsupported abilities" would
 * understate coverage badly.
 */
const NON_ABILITY=/missile|buff|marker|internal|visual|indicator|particle|dummy|toggle|sound|aura/i;

export const looksLikeCastAbility=(spell:NormalisedSpell)=>
  !NON_ABILITY.test(spell.name)&&Object.keys(spell.calculations).length>0;

/**
 * mEffectAmount is a list of unnamed per-rank rows, referenced by index from
 * EffectValueCalculationPart. The first row is a placeholder with no values.
 */
function readEffectAmounts(spell:Record<string,unknown>):number[][]{
  const raw=spell.mEffectAmount;
  if(!Array.isArray(raw))return [];
  return raw.map(row=>{
    if(!row||typeof row!=='object')return [];
    const values=(row as Record<string,unknown>).value;
    return Array.isArray(values)
      ?values.filter((v):v is number=>typeof v==='number'&&Number.isFinite(v))
      :[];
  });
}
