import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {championDetail,latestPatch,resolveChampionId} from '@/lib/champions/source';
import {statsAtLevel,damageType} from '@/lib/champions/ddragon';
import {championSpells} from '@/lib/combat/source';
import {assembleKit,combatDamageType,defaultRanks,DAMAGE_TYPE_NOTE,SLOTS,type DataDragonSpell} from '@/lib/combat/abilities';
import {simulateCombo,type AbilitySlot,type ComboStep} from '@/lib/combat/combos';
import {killThreshold,penetrationFromLethality,noPenetration} from '@/lib/combat/damage';
import {assessConfidence,combineConfidence} from '@/lib/combat/confidence';
import type {CombatStats} from '@/lib/combat/formula';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {humanError} from '@/lib/errors';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/**
 * Matchup Lab simulation.
 *
 * Deterministic: the same input always produces the same output, and every
 * number comes from the combat engine rather than from prose. The response
 * carries its own confidence rating and the reasons behind it, so a caller
 * cannot display a figure without the caveat that belongs to it.
 */

const side=z.object({
  champion:z.string().min(1).max(32),
  level:z.coerce.number().int().min(1).max(18).default(1),
  /** Bonus stats from items, supplied directly so the UI owns item choice. */
  bonusAttackDamage:z.coerce.number().min(0).max(1000).default(0),
  bonusAbilityPower:z.coerce.number().min(0).max(2000).default(0),
  bonusArmor:z.coerce.number().min(0).max(1000).default(0),
  bonusMagicResist:z.coerce.number().min(0).max(1000).default(0),
  bonusHealth:z.coerce.number().min(0).max(5000).default(0),
  lethality:z.coerce.number().min(0).max(100).default(0),
  abilityHaste:z.coerce.number().min(0).max(500).default(0),
  /** Per-slot ability ranks. Defaults derived from level when omitted. */
  ranks:z.record(z.enum(['Q','W','E','R']),z.coerce.number().int().min(1).max(5)).optional(),
  healthPercent:z.coerce.number().min(1).max(100).default(100),
  resourcePercent:z.coerce.number().min(0).max(100).default(100),
});

const schema=z.object({
  you:side,
  them:side,
  /** The sequence to simulate. Defaults to a plain Q/W/E/R with autos. */
  sequence:z.array(z.enum(['AA','Q','W','E','R'])).max(24).optional(),
});

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'matchup-simulate'),40,60_000);
  if(!limit.ok)
    return NextResponse.json(
      {ok:false,error:'Simulating too fast. Wait a moment.'},
      {status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}},
    );

  let body:unknown;
  try{body=await req.json()}
  catch{return NextResponse.json({ok:false,error:'Could not read the request.'},{status:400})}

  const parsed=schema.safeParse(body);
  if(!parsed.success)
    return NextResponse.json(
      {ok:false,error:'That simulation request is not valid.',detail:parsed.error.issues.slice(0,4)},
      {status:400});

  const {you,them,sequence}=parsed.data;

  try{
    const patch=await latestPatch();
    const [yourId,theirId]=await Promise.all([
      resolveChampionId(you.champion,patch),
      resolveChampionId(them.champion,patch),
    ]);
    if(!yourId)return NextResponse.json({ok:false,error:`No champion called "${you.champion}".`},{status:404});
    if(!theirId)return NextResponse.json({ok:false,error:`No champion called "${them.champion}".`},{status:404});

    const [yourChampion,theirChampion]=await Promise.all([
      championDetail(yourId,patch),
      championDetail(theirId,patch),
    ]);
    const [yourSpells,theirSpells]=await Promise.all([
      championSpells(yourId),
      championSpells(theirId),
    ]);

    const yourStats=combatStats(yourChampion,you);
    const theirStats=combatStats(theirChampion,them);
    const yourDamage=combatDamageType(yourChampion.info);
    const theirDamage=combatDamageType(theirChampion.info);

    const yourKit=assembleKit(
      yourChampion.spells as DataDragonSpell[],
      yourSpells?.spells??[],
      {
        caster:yourStats,
        level:you.level,
        ranks:you.ranks??defaultRanks(you.level),
        damageType:yourDamage.type,
      });

    const theirKit=assembleKit(
      theirChampion.spells as DataDragonSpell[],
      theirSpells?.spells??[],
      {
        caster:theirStats,
        level:them.level,
        ranks:them.ranks??defaultRanks(them.level),
        damageType:theirDamage.type,
      });

    const theirLevelStats=statsAtLevel(theirChampion.stats,them.level);
    const targetHealth=(theirLevelStats.hp+them.bonusHealth)*(them.healthPercent/100);

    const combo=simulateCombo({
      sequence:(sequence?.length?sequence:defaultSequence(you.level)) as ComboStep[],
      abilities:yourKit.models,
      autoAttack:{damage:yourStats.attackDamage,attackSpeed:yourStats.attackSpeed},
      caster:{mana:yourStats.mana*(you.resourcePercent/100)},
      target:{
        health:targetHealth,
        armor:theirStats.armor,
        magicResist:theirStats.magicResist,
      },
      penetration:you.lethality>0?penetrationFromLethality(you.lethality):noPenetration(),
      abilityHaste:you.abilityHaste,
    });

    const confidence=combineConfidence([
      yourKit.confidence,
      assessConfidence({approximations:[...yourDamage.approximations,...theirDamage.approximations]}),
    ]);

    return NextResponse.json({
      ok:true,
      patch,
      dataSources:[
        {name:'Data Dragon',use:'champion stats, ability slots, cooldowns, costs',official:true},
        {name:'CommunityDragon',use:'ability damage formulas',official:false},
      ],
      you:sideReport(yourChampion,you,yourStats,yourKit),
      them:sideReport(theirChampion,them,theirStats,theirKit),
      combo,
      kill:killThreshold(combo.totalMitigatedDamage,targetHealth),
      confidence,
      notes:[DAMAGE_TYPE_NOTE,combo.timingNote],
    });
  }catch(err){
    const {title,body:detail}=humanError(err);
    return NextResponse.json({ok:false,error:`${title} ${detail}`},{status:502});
  }
}

/* ------------------------------------------------------------- helpers -- */

type SideInput=z.infer<typeof side>;

function combatStats(
  champion:Awaited<ReturnType<typeof championDetail>>,input:SideInput,
):CombatStats{
  const base=statsAtLevel(champion.stats,input.level);
  return {
    abilityPower:input.bonusAbilityPower,
    attackDamage:base.attackDamage+input.bonusAttackDamage,
    armor:base.armor+input.bonusArmor,
    magicResist:base.magicResist+input.bonusMagicResist,
    maxHealth:base.hp+input.bonusHealth,
    critChance:0,
    critDamageMultiplier:1.75,
    attackSpeed:base.attackSpeed,
    moveSpeed:base.moveSpeed,
    mana:base.mana,
  };
}

function sideReport(
  champion:Awaited<ReturnType<typeof championDetail>>,
  input:SideInput,
  stats:CombatStats,
  kit:ReturnType<typeof assembleKit>,
){
  const base=statsAtLevel(champion.stats,input.level);
  return {
    id:champion.id,
    name:champion.name,
    level:input.level,
    damageType:damageType(champion.info),
    stats:{
      attackDamage:stats.attackDamage,
      abilityPower:stats.abilityPower,
      armor:stats.armor,
      magicResist:stats.magicResist,
      health:Math.round((base.hp+input.bonusHealth)*10)/10,
      healthNow:Math.round((base.hp+input.bonusHealth)*(input.healthPercent/100)*10)/10,
      mana:base.mana,
      manaNow:Math.round(base.mana*(input.resourcePercent/100)*10)/10,
      attackSpeed:stats.attackSpeed,
      attackRange:base.attackRange,
      moveSpeed:stats.moveSpeed,
    },
    abilities:SLOTS.map(slot=>kit.abilities[slot]).filter(Boolean),
    confidence:kit.confidence,
  };
}

/** A full rotation once the ultimate exists, otherwise basics and autos. */
const defaultSequence=(level:number):ComboStep[]=>
  level>=6
    ?['Q','AA','W','AA','E','R']
    :['Q','AA','W','AA','E'];
