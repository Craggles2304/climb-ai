/**
 * Coverage validation for the combat engine.
 *
 * Walks every champion, pulls their game-file spells, evaluates every damage
 * calculation, and reports what actually resolved to a number and what did not
 * and why.
 *
 * This exists so coverage is never claimed, only measured. Run it before
 * telling anyone a champion is supported.
 *
 *   npx tsx scripts/lol-data/validate-spells.ts
 *   npx tsx scripts/lol-data/validate-spells.ts Darius Lux
 */

import {evaluateCalculation,type CombatStats} from '../../lib/combat/formula';
import {
  binUrlFor,normaliseChampionSpells,looksLikeCastAbility,
  type NormalisedSpell,
} from '../../lib/combat/importSpells';

const CONCURRENCY=6;
const RETRIES=4;

/** A mid-game statline, so ratio terms contribute something visible. */
const TEST_CASTER:CombatStats={
  abilityPower:200,attackDamage:150,armor:80,magicResist:60,
  maxHealth:2200,critChance:0.25,attackSpeed:1.1,moveSpeed:340,
};

const TEST_LEVEL=11;
const TEST_RANK=3;

async function getJson<T>(url:string):Promise<T|null>{
  for(let attempt=0;attempt<RETRIES;attempt++){
    try{
      const res=await fetch(url);
      if(res.status===404)return null;
      if(res.ok)return await res.json() as T;
    }catch{
      // Network flake; fall through to the backoff below.
    }
    await new Promise(r=>setTimeout(r,500*(attempt+1)));
  }
  return null;
}

interface ChampionResult{
  id:string;
  spells:number;
  castAbilities:number;
  calculations:number;
  resolved:number;
  blocked:number;
  reasons:string[];
  fetched:boolean;
}

async function validateChampion(id:string,patch:string):Promise<ChampionResult>{
  const raw=await getJson<Record<string,unknown>>(binUrlFor(id,patch));
  if(!raw)
    return {id,spells:0,castAbilities:0,calculations:0,resolved:0,blocked:0,reasons:[],fetched:false};

  const normalised=normaliseChampionSpells(id,raw,patch);
  const abilities=normalised.spells.filter(looksLikeCastAbility);

  let calculations=0,resolved=0,blocked=0;
  const reasons:string[]=[];

  for(const spell of abilities){
    for(const [,calculation] of Object.entries(spell.calculations)){
      calculations++;
      const result=evaluateCalculation(calculation,{
        caster:TEST_CASTER,
        level:TEST_LEVEL,
        rank:TEST_RANK,
        dataValues:spell.dataValues,
        calculations:spell.calculations,
      });
      if(result.value!==null&&Number.isFinite(result.value))resolved++;
      else{blocked++;reasons.push(...result.unmodelled)}
    }
  }

  return {
    id,
    spells:normalised.spells.length,
    castAbilities:abilities.length,
    calculations,resolved,blocked,reasons,
    fetched:true,
  };
}

async function main(){
  const requested=process.argv.slice(2);

  const versions=await getJson<string[]>('https://ddragon.leagueoflegends.com/api/versions.json');
  const ddPatch=versions?.[0]??'unknown';
  const roster=await getJson<{data:Record<string,{id:string;name:string}>}>(
    `https://ddragon.leagueoflegends.com/cdn/${ddPatch}/data/en_US/champion.json`);
  if(!roster){console.error('Could not load the champion roster.');process.exit(1)}

  const ids=requested.length?requested:Object.keys(roster.data);
  // CommunityDragon's `latest` tracks the live client, which may be a patch
  // ahead of or behind Data Dragon. Both are reported rather than assumed equal.
  const cdPatch='latest';

  console.log(`Data Dragon patch: ${ddPatch}`);
  console.log(`CommunityDragon:   ${cdPatch}`);
  console.log(`Champions to check: ${ids.length}\n`);

  const results:ChampionResult[]=[];
  for(let i=0;i<ids.length;i+=CONCURRENCY){
    const batch=ids.slice(i,i+CONCURRENCY);
    results.push(...await Promise.all(batch.map(id=>validateChampion(id,cdPatch))));
    process.stderr.write(`\r  checked ${Math.min(i+CONCURRENCY,ids.length)}/${ids.length}`);
  }
  process.stderr.write('\n\n');

  const fetched=results.filter(r=>r.fetched);
  const missing=results.filter(r=>!r.fetched);
  const totals=fetched.reduce((acc,r)=>({
    spells:acc.spells+r.spells,
    abilities:acc.abilities+r.castAbilities,
    calculations:acc.calculations+r.calculations,
    resolved:acc.resolved+r.resolved,
    blocked:acc.blocked+r.blocked,
  }),{spells:0,abilities:0,calculations:0,resolved:0,blocked:0});

  const full=fetched.filter(r=>r.calculations>0&&r.blocked===0);
  const partial=fetched.filter(r=>r.resolved>0&&r.blocked>0);
  const none=fetched.filter(r=>r.calculations>0&&r.resolved===0);
  const noCalcs=fetched.filter(r=>r.calculations===0);

  console.log('COVERAGE');
  console.log(`  champions fetched        ${fetched.length}/${results.length}`);
  console.log(`  spell entries            ${totals.spells}`);
  console.log(`  cast abilities w/ maths  ${totals.abilities}`);
  console.log(`  damage calculations      ${totals.calculations}`);
  console.log(`  resolved to a number     ${totals.resolved} (${pct(totals.resolved,totals.calculations)})`);
  console.log(`  blocked                  ${totals.blocked} (${pct(totals.blocked,totals.calculations)})`);
  console.log('');
  console.log('CHAMPIONS');
  console.log(`  FULL     every calculation resolved   ${full.length}`);
  console.log(`  PARTIAL  some resolved, some blocked  ${partial.length}`);
  console.log(`  NONE     nothing resolved             ${none.length}`);
  console.log(`  NO MATHS no calculations found        ${noCalcs.length}`);
  if(missing.length)
    console.log(`  UNFETCHED                             ${missing.length} (${missing.slice(0,8).map(m=>m.id).join(', ')}${missing.length>8?'…':''})`);

  const reasonCounts=new Map<string,number>();
  for(const r of fetched)
    for(const reason of r.reasons){
      const key=reason.replace(/"[^"]*"/g,'"…"').replace(/#\d+/,'#N');
      reasonCounts.set(key,(reasonCounts.get(key)??0)+1);
    }

  console.log('\nWHY CALCULATIONS WERE BLOCKED');
  [...reasonCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,14)
    .forEach(([reason,count])=>console.log(`  ${String(count).padStart(5)}  ${reason}`));

  if(partial.length){
    console.log('\nWORST PARTIAL CHAMPIONS');
    [...partial].sort((a,b)=>b.blocked-a.blocked).slice(0,10)
      .forEach(r=>console.log(`  ${r.id.padEnd(14)} ${r.resolved} resolved, ${r.blocked} blocked`));
  }

  if(requested.length)
    for(const r of fetched)
      console.log(`\n${r.id}: ${r.spells} spells, ${r.castAbilities} abilities, ${r.resolved}/${r.calculations} calculations resolved`);
}

const pct=(part:number,whole:number)=>
  whole>0?`${Math.round(part/whole*100)}%`:'n/a';

void main();
