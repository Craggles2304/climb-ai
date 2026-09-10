import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {championDetail,latestPatch,resolveChampionId} from '@/lib/champions/source';
import {statsAtLevel,damageType} from '@/lib/champions/ddragon';
import {championSpells} from '@/lib/combat/source';
import {assembleKit,combatDamageType,defaultRanks,DAMAGE_TYPE_NOTE,SLOTS,type DataDragonSpell} from '@/lib/combat/abilities';
import {simulateCombo,type ComboStep} from '@/lib/combat/combos';
import {compareTrades} from '@/lib/combat/trades';
import {killThreshold,noPenetration,type Penetration} from '@/lib/combat/damage';
import {assessConfidence,combineConfidence} from '@/lib/combat/confidence';
import type {CombatStats} from '@/lib/combat/formula';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {humanError} from '@/lib/errors';
import {matchupItemCatalogue} from '@/lib/combat/itemSource';
import {buildLoadout,type LoadoutResult,type MatchupItem} from '@/lib/combat/itemLoadout';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/**
 * Matchup Lab simulation.
 *
 * The normal player input is champion + level + item IDs. Stats are derived
 * from Riot item data here, never typed by the player. Legacy custom bonuses
 * remain optional for backwards compatibility and future sandbox/debug mode.
 */
const side=z.object({
  champion:z.string().min(1).max(32),
  level:z.coerce.number().int().min(1).max(18).default(1),
  itemIds:z.array(z.coerce.number().int().positive()).max(6).default([]),
  bonusAttackDamage:z.coerce.number().min(0).max(1000).default(0),
  bonusAbilityPower:z.coerce.number().min(0).max(2000).default(0),
  bonusArmor:z.coerce.number().min(0).max(1000).default(0),
  bonusMagicResist:z.coerce.number().min(0).max(1000).default(0),
  bonusHealth:z.coerce.number().min(0).max(5000).default(0),
  lethality:z.coerce.number().min(0).max(100).default(0),
  abilityHaste:z.coerce.number().min(0).max(500).default(0),
  ranks:z.record(z.enum(['Q','W','E','R']),z.coerce.number().int().min(1).max(5)).optional(),
  healthPercent:z.coerce.number().min(1).max(100).default(100),
  resourcePercent:z.coerce.number().min(0).max(100).default(100),
});

const schema=z.object({
  you:side,
  them:side,
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
    const [yourId,theirId,catalogueRaw]=await Promise.all([
      resolveChampionId(you.champion,patch),
      resolveChampionId(them.champion,patch),
      matchupItemCatalogue(patch),
    ]);
    if(!yourId)return NextResponse.json({ok:false,error:`No champion called "${you.champion}".`},{status:404});
    if(!theirId)return NextResponse.json({ok:false,error:`No champion called "${them.champion}".`},{status:404});

    const catalogue=catalogueRaw as Record<string,MatchupItem>;
    const yourLoadout=buildLoadout(catalogue,you.itemIds);
    const theirLoadout=buildLoadout(catalogue,them.itemIds);

    const [yourChampion,theirChampion]=await Promise.all([
      championDetail(yourId,patch),
      championDetail(theirId,patch),
    ]);
    const [yourSpells,theirSpells]=await Promise.all([
      championSpells(yourId),
      championSpells(theirId),
    ]);

    const yourStats=combatStats(yourChampion,you,yourLoadout);
    const theirStats=combatStats(theirChampion,them,theirLoadout);
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

    const targetHealth=theirStats.maxHealth*(them.healthPercent/100);
    const yourPen=penetrationFromInput(you,yourLoadout);
    const theirPen=penetrationFromInput(them,theirLoadout);
    const yourHaste=you.abilityHaste+yourLoadout.stats.abilityHaste;
    const theirHaste=them.abilityHaste+theirLoadout.stats.abilityHaste;

    const combo=simulateCombo({
      sequence:(sequence?.length?sequence:defaultSequence(you.level)) as ComboStep[],
      abilities:yourKit.models,
      autoAttack:{damage:yourStats.attackDamage,attackSpeed:yourStats.attackSpeed},
      caster:{mana:yourStats.mana*(you.resourcePercent/100)},
      target:{health:targetHealth,armor:theirStats.armor,magicResist:theirStats.magicResist},
      penetration:yourPen,
      abilityHaste:yourHaste,
    });

    const tradeSide=(
      champion:string,
      kit:ReturnType<typeof assembleKit>,
      stats:CombatStats,
      input:SideInput,
      opposing:CombatStats,
      pen:Penetration,
      haste:number,
    )=>({
      champion,
      abilities:kit.models,
      autoAttack:{damage:stats.attackDamage,attackSpeed:stats.attackSpeed},
      mana:stats.mana*(input.resourcePercent/100),
      maxHealth:stats.maxHealth,
      resistances:{armor:opposing.armor,magicResist:opposing.magicResist},
      penetration:pen,
      abilityHaste:haste,
    });

    const trades=compareTrades(
      tradeSide(yourChampion.name,yourKit,yourStats,you,theirStats,yourPen,yourHaste),
      tradeSide(theirChampion.name,theirKit,theirStats,them,yourStats,theirPen,theirHaste),
    );

    const confidence=combineConfidence([
      yourKit.confidence,
      trades.confidence,
      assessConfidence({
        approximations:[
          ...yourDamage.approximations,
          ...theirDamage.approximations,
          ...yourLoadout.approximations,
          ...theirLoadout.approximations,
        ],
      }),
    ]);

    return NextResponse.json({
      ok:true,
      patch,
      dataSources:[
        {name:'Data Dragon',use:'champion stats, items, ability slots, cooldowns, costs',official:true},
        {name:'CommunityDragon',use:'ability damage formulas',official:false},
      ],
      you:sideReport(yourChampion,you,yourStats,yourKit,yourLoadout,yourHaste),
      them:sideReport(theirChampion,them,theirStats,theirKit,theirLoadout,theirHaste),
      combo,
      trades,
      kill:killThreshold(combo.totalMitigatedDamage,targetHealth),
      confidence,
      notes:[DAMAGE_TYPE_NOTE,combo.timingNote],
    });
  }catch(err){
    const {title,body:detail}=humanError(err);
    return NextResponse.json({ok:false,error:`${title} ${detail}`},{status:502});
  }
}

type SideInput=z.infer<typeof side>;

function combatStats(
  champion:Awaited<ReturnType<typeof championDetail>>,
  input:SideInput,
  loadout:LoadoutResult,
):CombatStats{
  const base=statsAtLevel(champion.stats,input.level);
  const item=loadout.stats;
  const rawAttackSpeed=base.baseAttackSpeed*(1+base.bonusAttackSpeedRatio+item.attackSpeedRatio);
  return {
    abilityPower:input.bonusAbilityPower+item.abilityPower,
    attackDamage:base.attackDamage+input.bonusAttackDamage+item.attackDamage,
    armor:base.armor+input.bonusArmor+item.armor,
    magicResist:base.magicResist+input.bonusMagicResist+item.magicResist,
    maxHealth:base.hp+input.bonusHealth+item.health,
    critChance:Math.min(1,Math.max(0,item.critChance)),
    critDamageMultiplier:1.75,
    attackSpeed:Math.min(2.5,rawAttackSpeed),
    moveSpeed:(base.moveSpeed+item.flatMoveSpeed)*(1+item.percentMoveSpeed),
    mana:base.mana+item.mana,
  };
}

function penetrationFromInput(input:SideInput,loadout:LoadoutResult):Penetration{
  return {
    ...noPenetration(),
    flatArmorPen:Math.max(0,input.lethality+loadout.stats.lethality),
    percentArmorPen:loadout.stats.percentArmorPen,
    flatMagicPen:loadout.stats.flatMagicPen,
    percentMagicPen:loadout.stats.percentMagicPen,
  };
}

function sideReport(
  champion:Awaited<ReturnType<typeof championDetail>>,
  input:SideInput,
  stats:CombatStats,
  kit:ReturnType<typeof assembleKit>,
  loadout:LoadoutResult,
  abilityHaste:number,
){
  const base=statsAtLevel(champion.stats,input.level);
  return {
    id:champion.id,
    name:champion.name,
    level:input.level,
    damageType:damageType(champion.info),
    items:loadout.items,
    totalGold:loadout.totalGold,
    itemStats:{...loadout.stats,abilityHaste},
    stats:{
      attackDamage:round(stats.attackDamage),
      abilityPower:round(stats.abilityPower),
      armor:round(stats.armor),
      magicResist:round(stats.magicResist),
      health:round(stats.maxHealth),
      healthNow:round(stats.maxHealth*(input.healthPercent/100)),
      mana:round(stats.mana),
      manaNow:round(stats.mana*(input.resourcePercent/100)),
      attackSpeed:round3(stats.attackSpeed),
      attackRange:base.attackRange,
      moveSpeed:round(stats.moveSpeed),
    },
    abilities:SLOTS.map(slot=>kit.abilities[slot]).filter(Boolean),
    confidence:kit.confidence,
  };
}

const defaultSequence=(level:number):ComboStep[]=>
  level>=6?['Q','AA','W','AA','E','R']:['Q','AA','W','AA','E'];

const round=(n:number)=>Math.round(n*10)/10;
const round3=(n:number)=>Math.round(n*1000)/1000;
