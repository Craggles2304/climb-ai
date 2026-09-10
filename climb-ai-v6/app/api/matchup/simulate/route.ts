import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {championDetail,latestPatch,resolveChampionId} from '@/lib/champions/source';
import {statsAtLevel,damageType} from '@/lib/champions/ddragon';
import {championSpells} from '@/lib/combat/source';
import {assembleKit,combatDamageType,DAMAGE_TYPE_NOTE,SLOTS,type DataDragonSpell} from '@/lib/combat/abilities';
import {ATTACK_SPEED_CAP,simulateCombo,type AbilitySlot,type ComboStep} from '@/lib/combat/combos';
import {compareTrades} from '@/lib/combat/trades';
import {killThreshold,noPenetration,type Penetration} from '@/lib/combat/damage';
import {assessConfidence,combineConfidence} from '@/lib/combat/confidence';
import type {CombatStats} from '@/lib/combat/formula';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {humanError} from '@/lib/errors';
import {matchupItemCatalogue} from '@/lib/combat/itemSource';
import {buildLoadout,type LoadoutResult,type MatchupItem} from '@/lib/combat/itemLoadout';
import {
  buildRuneCombatProfile,buildSummonerCombatProfile,
  type RuneCombatProfile,type SummonerCombatProfile,
} from '@/lib/combat/effects';
import {
  buildChampionCombatProfile,type ChampionCombatProfile,
} from '@/lib/combat/championEffects';
import {normaliseStandardRanks} from '@/lib/combat/skillRanks';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const side=z.object({
  champion:z.string().min(1).max(32),
  level:z.coerce.number().int().min(1).max(18).default(1),
  itemIds:z.array(z.coerce.number().int().positive()).max(6).default([]),
  runeIds:z.array(z.coerce.number().int().positive()).max(6).default([]),
  summonerIds:z.array(z.string().min(1).max(48)).max(2).default([]),
  activeSummonerIds:z.array(z.string().min(1).max(48)).max(2).default([]),
  activeChampionEffects:z.array(z.string().min(1).max(48)).max(8).default([]),
  shield:z.coerce.number().min(0).max(10000).default(0),
  bonusAttackDamage:z.coerce.number().min(0).max(1000).default(0),
  bonusAbilityPower:z.coerce.number().min(0).max(2000).default(0),
  bonusArmor:z.coerce.number().min(0).max(1000).default(0),
  bonusMagicResist:z.coerce.number().min(0).max(1000).default(0),
  bonusHealth:z.coerce.number().min(0).max(5000).default(0),
  lethality:z.coerce.number().min(0).max(100).default(0),
  abilityHaste:z.coerce.number().min(0).max(500).default(0),
  ranks:z.record(z.enum(['Q','W','E','R']),z.coerce.number().int().min(0).max(5)).optional(),
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
    const yourLoadout=buildLoadout(catalogue,you.itemIds,you.bonusAbilityPower);
    const theirLoadout=buildLoadout(catalogue,them.itemIds,them.bonusAbilityPower);

    const [yourChampion,theirChampion]=await Promise.all([
      championDetail(yourId,patch),
      championDetail(theirId,patch),
    ]);
    const [yourSpells,theirSpells]=await Promise.all([
      championSpells(yourId),
      championSpells(theirId),
    ]);

    const yourRanks=normaliseStandardRanks(you.ranks,you.level);
    const theirRanks=normaliseStandardRanks(them.ranks,them.level);

    const yourChampionFx=buildChampionCombatProfile(
      yourChampion.id,you.activeChampionEffects,yourRanks,
      {abilityPower:you.bonusAbilityPower+yourLoadout.stats.abilityPower},
    );
    const theirChampionFx=buildChampionCombatProfile(
      theirChampion.id,them.activeChampionEffects,theirRanks,
      {abilityPower:them.bonusAbilityPower+theirLoadout.stats.abilityPower},
    );

    const yourStats=combatStats(yourChampion,you,yourLoadout,yourChampionFx);
    const theirStats=combatStats(theirChampion,them,theirLoadout,theirChampionFx);
    const yourDamage=combatDamageType(yourChampion.info);
    const theirDamage=combatDamageType(theirChampion.info);

    const yourKit=assembleKit(
      yourChampion.spells as DataDragonSpell[],
      yourSpells?.spells??[],
      {caster:yourStats,level:you.level,ranks:yourRanks,damageType:yourDamage.type},
    );
    const theirKit=assembleKit(
      theirChampion.spells as DataDragonSpell[],
      theirSpells?.spells??[],
      {caster:theirStats,level:them.level,ranks:theirRanks,damageType:theirDamage.type},
    );
    applyRankAvailability(yourKit,yourRanks);
    applyRankAvailability(theirKit,theirRanks);
    applyChampionAbilityDebuffs(yourKit,yourChampionFx);
    applyChampionAbilityDebuffs(theirKit,theirChampionFx);

    const yourBase=statsAtLevel(yourChampion.stats,you.level);
    const theirBase=statsAtLevel(theirChampion.stats,them.level);
    const yourRuneFx=buildRuneCombatProfile(you.runeIds,{
      level:you.level,
      isRanged:(yourBase.attackRange+yourChampionFx.attackRangeBonus)>=300,
      healthPercent:you.healthPercent,
      baseAttackSpeed:yourBase.baseAttackSpeed,
      bonusAttackSpeedRatio:(yourBase.bonusAttackSpeedRatio+yourLoadout.stats.attackSpeedRatio+yourChampionFx.permanentAttackSpeedRatio)*yourChampionFx.bonusAttackSpeedScalar,
      adaptiveDamageType:yourDamage.type,
    });
    const theirRuneFx=buildRuneCombatProfile(them.runeIds,{
      level:them.level,
      isRanged:(theirBase.attackRange+theirChampionFx.attackRangeBonus)>=300,
      healthPercent:them.healthPercent,
      baseAttackSpeed:theirBase.baseAttackSpeed,
      bonusAttackSpeedRatio:(theirBase.bonusAttackSpeedRatio+theirLoadout.stats.attackSpeedRatio+theirChampionFx.permanentAttackSpeedRatio)*theirChampionFx.bonusAttackSpeedScalar,
      adaptiveDamageType:theirDamage.type,
    });

    const yourBaseCurrent=yourStats.maxHealth*(you.healthPercent/100);
    const theirBaseCurrent=theirStats.maxHealth*(them.healthPercent/100);
    const yourSummonerFx=buildSummonerCombatProfile(
      you.summonerIds,you.activeSummonerIds,
      {level:you.level,maxHealth:yourStats.maxHealth,currentHealth:yourBaseCurrent},
    );
    const theirSummonerFx=buildSummonerCombatProfile(
      them.summonerIds,them.activeSummonerIds,
      {level:them.level,maxHealth:theirStats.maxHealth,currentHealth:theirBaseCurrent},
    );

    const yourCurrent=Math.min(yourStats.maxHealth,yourBaseCurrent+yourSummonerFx.heal);
    const theirCurrent=Math.min(theirStats.maxHealth,theirBaseCurrent+theirSummonerFx.heal);
    const yourShield=you.shield+yourSummonerFx.bonusShield;
    const theirShield=them.shield+theirSummonerFx.bonusShield;

    const yourPen=penetrationFromInput(you,yourLoadout);
    const theirPen=penetrationFromInput(them,theirLoadout);
    const yourHaste=you.abilityHaste+yourLoadout.stats.abilityHaste;
    const theirHaste=them.abilityHaste+theirLoadout.stats.abilityHaste;

    const yourAuto=autoAttackModel(yourStats,yourLoadout,yourRuneFx,yourChampionFx);
    const theirAuto=autoAttackModel(theirStats,theirLoadout,theirRuneFx,theirChampionFx);

    const combo=simulateCombo({
      sequence:(sequence?.length?sequence:defaultSequence(you.level)) as ComboStep[],
      abilities:yourKit.models,
      autoAttack:yourAuto,
      caster:{mana:yourStats.mana*(you.resourcePercent/100)},
      target:{
        health:theirCurrent,maxHealth:theirStats.maxHealth,shield:theirShield,
        armor:theirStats.armor,magicResist:theirStats.magicResist,
      },
      penetration:yourPen,
      abilityHaste:yourHaste,
      damageRules:yourRuneFx.damageRules,
      outgoingDamageMultiplier:theirSummonerFx.exhaustDamageMultiplier,
      outgoingDamageMultiplierDurationSeconds:theirSummonerFx.exhaustDurationSeconds,
    });

    const allInDamage=combo.totalMitigatedDamage+yourSummonerFx.igniteDamage;
    const kill=killThreshold(allInDamage,theirCurrent,theirShield);

    const tradeSide=(
      champion:string,
      kit:ReturnType<typeof assembleKit>,
      stats:CombatStats,
      input:SideInput,
      currentHealth:number,
      shield:number,
      opposing:CombatStats,
      pen:Penetration,
      haste:number,
      loadout:LoadoutResult,
      runeFx:RuneCombatProfile,
      championFx:ChampionCombatProfile,
      opposingSummonerFx:SummonerCombatProfile,
    )=>({
      champion,
      abilities:kit.models,
      autoAttack:autoAttackModel(stats,loadout,runeFx,championFx),
      mana:stats.mana*(input.resourcePercent/100),
      maxHealth:stats.maxHealth,
      currentHealth,
      shield,
      resistances:{armor:opposing.armor,magicResist:opposing.magicResist},
      penetration:pen,
      abilityHaste:haste,
      damageRules:runeFx.damageRules,
      outgoingDamageMultiplier:opposingSummonerFx.exhaustDamageMultiplier,
      outgoingDamageMultiplierDurationSeconds:opposingSummonerFx.exhaustDurationSeconds,
    });

    const trades=compareTrades(
      tradeSide(
        yourChampion.name,yourKit,yourStats,you,yourCurrent,yourShield,
        theirStats,yourPen,yourHaste,yourLoadout,yourRuneFx,yourChampionFx,theirSummonerFx,
      ),
      tradeSide(
        theirChampion.name,theirKit,theirStats,them,theirCurrent,theirShield,
        yourStats,theirPen,theirHaste,theirLoadout,theirRuneFx,theirChampionFx,yourSummonerFx,
      ),
    );

    const setupApproximations=[
      ...effectCaveats('Your',yourRuneFx,yourSummonerFx,yourChampionFx),
      ...effectCaveats('Enemy',theirRuneFx,theirSummonerFx,theirChampionFx),
      ...(yourSummonerFx.bonusShield>0||theirSummonerFx.bonusShield>0
        ?['Barrier is applied as an opening shield. Its 2.5s expiry is not yet removed mid-sequence, so a combo lasting longer than 2.5s can slightly overstate Barrier protection.']
        :[]),
      ...(yourSummonerFx.igniteDamage>0||theirSummonerFx.igniteDamage>0
        ?['Ignite is not treated as instant damage. The custom all-in kill check can include its eventual 5-second total; the generic trade-duration table does not yet schedule Ignite ticks.']
        :[]),
    ];

    const confidence=combineConfidence([
      yourKit.confidence,
      trades.confidence,
      assessConfidence({
        approximations:[
          ...yourDamage.approximations,
          ...theirDamage.approximations,
          ...yourLoadout.approximations,
          ...theirLoadout.approximations,
          ...setupApproximations,
        ],
      }),
    ]);

    const yourEffectNotes=[...yourRuneFx.notes,...yourSummonerFx.notes,...yourChampionFx.notes];
    const theirEffectNotes=[...theirRuneFx.notes,...theirSummonerFx.notes,...theirChampionFx.notes];

    return NextResponse.json({
      ok:true,
      patch,
      dataSources:[
        {name:'Data Dragon',use:'champion stats, items, runes, summoners, ability slots, cooldowns and costs',official:true},
        {name:'CommunityDragon',use:'ability damage formulas',official:false},
      ],
      you:sideReport(
        yourChampion,you,yourStats,yourKit,yourLoadout,yourHaste,
        yourCurrent,yourShield,yourChampionFx.attackRangeBonus,yourRanks,
      ),
      them:sideReport(
        theirChampion,them,theirStats,theirKit,theirLoadout,theirHaste,
        theirCurrent,theirShield,theirChampionFx.attackRangeBonus,theirRanks,
      ),
      combo,
      trades,
      kill,
      allIn:{
        comboDamage:round(combo.totalMitigatedDamage),
        igniteDamage:round(yourSummonerFx.igniteDamage),
        totalDamageForKillCheck:round(allInDamage),
        targetCurrentHealth:round(theirCurrent),
        targetShield:round(theirShield),
        includesFiveSecondIgnite:yourSummonerFx.igniteDamage>0,
      },
      effects:{
        you:{
          modelledRunes:yourRuneFx.modelledRuneIds,
          unmodelledRunes:yourRuneFx.unmodelledRuneIds,
          modelledSummoners:yourSummonerFx.modelledIds,
          unmodelledActiveSummoners:yourSummonerFx.unmodelledActiveIds,
          modelledChampionEffects:yourChampionFx.modelledEffects,
          unmodelledChampionEffects:yourChampionFx.unmodelledEffects,
          itemOnHits:yourLoadout.onHits.map(x=>x.label),
          notes:yourEffectNotes,
        },
        them:{
          modelledRunes:theirRuneFx.modelledRuneIds,
          unmodelledRunes:theirRuneFx.unmodelledRuneIds,
          modelledSummoners:theirSummonerFx.modelledIds,
          unmodelledActiveSummoners:theirSummonerFx.unmodelledActiveIds,
          modelledChampionEffects:theirChampionFx.modelledEffects,
          unmodelledChampionEffects:theirChampionFx.unmodelledEffects,
          itemOnHits:theirLoadout.onHits.map(x=>x.label),
          notes:theirEffectNotes,
        },
      },
      confidence,
      setup:{
        yourRunes:you.runeIds,enemyRunes:them.runeIds,
        yourSummoners:you.summonerIds,enemySummoners:them.summonerIds,
        yourActiveSummoners:you.activeSummonerIds,enemyActiveSummoners:them.activeSummonerIds,
        yourChampionEffects:you.activeChampionEffects,enemyChampionEffects:them.activeChampionEffects,
        yourShield,enemyShield:theirShield,
      },
      notes:[DAMAGE_TYPE_NOTE,combo.timingNote,...setupApproximations],
    });
  }catch(err){
    const {title,body:detail}=humanError(err);
    return NextResponse.json({ok:false,error:`${title} ${detail}`},{status:502});
  }
}

type SideInput=z.infer<typeof side>;

function applyRankAvailability(
  kit:ReturnType<typeof assembleKit>,
  ranks:Record<AbilitySlot,number>,
){
  for(const slot of SLOTS){
    const rank=ranks[slot]??0;
    const ability=kit.abilities[slot];
    if(ability&&rank<=0){
      ability.rank=0;
      ability.cooldownSeconds=0;
      ability.cost=0;
      ability.damage=[];
      ability.calculations=[];
      delete kit.models[slot];
    }
  }
}

function applyChampionAbilityDebuffs(
  kit:ReturnType<typeof assembleKit>,
  profile:ChampionCombatProfile,
){
  for(const slot of SLOTS){
    const model=kit.models[slot];
    const debuff=profile.abilityDebuffs[slot];
    if(model&&debuff)model.targetDebuff=debuff;
  }
}

function effectCaveats(
  owner:'Your'|'Enemy',
  runeFx:RuneCombatProfile,
  summonerFx:SummonerCombatProfile,
  championFx:ChampionCombatProfile,
):string[]{
  const out:string[]=[];
  if(runeFx.unmodelledRuneIds.length)
    out.push(`${owner} rune effects not yet modelled: ${runeFx.unmodelledRuneIds.join(', ')}.`);
  if(summonerFx.unmodelledActiveIds.length)
    out.push(`${owner} active summoner effects not yet modelled: ${summonerFx.unmodelledActiveIds.join(', ')}.`);
  if(championFx.unmodelledEffects.length)
    out.push(`${owner} active champion effects not yet modelled: ${championFx.unmodelledEffects.join(', ')}.`);
  return out;
}

function combatStats(
  champion:Awaited<ReturnType<typeof championDetail>>,
  input:SideInput,
  loadout:LoadoutResult,
  championFx:ChampionCombatProfile,
):CombatStats{
  const base=statsAtLevel(champion.stats,input.level);
  const item=loadout.stats;
  const bonusAttackSpeed=(
    base.bonusAttackSpeedRatio+item.attackSpeedRatio+championFx.permanentAttackSpeedRatio
  )*championFx.bonusAttackSpeedScalar;
  const rawAttackSpeed=base.baseAttackSpeed*(1+bonusAttackSpeed)*championFx.totalAttackSpeedMultiplier;
  const attackSpeedCap=championFx.attackSpeedCap??ATTACK_SPEED_CAP;
  return {
    abilityPower:input.bonusAbilityPower+item.abilityPower,
    attackDamage:base.attackDamage+input.bonusAttackDamage+item.attackDamage,
    armor:base.armor+input.bonusArmor+item.armor,
    magicResist:base.magicResist+input.bonusMagicResist+item.magicResist,
    maxHealth:base.hp+input.bonusHealth+item.health,
    critChance:Math.min(1,Math.max(0,item.critChance)),
    critDamageMultiplier:1.75,
    attackSpeed:Math.min(attackSpeedCap,rawAttackSpeed),
    moveSpeed:(base.moveSpeed+item.flatMoveSpeed)*(1+item.percentMoveSpeed),
    mana:base.mana+item.mana,
  };
}

function autoAttackModel(
  stats:CombatStats,
  loadout:LoadoutResult,
  runeFx:RuneCombatProfile,
  championFx:ChampionCombatProfile,
){
  return {
    damage:stats.attackDamage*championFx.basicAttackDamageMultiplier,
    attackSpeed:stats.attackSpeed,
    resourceCost:championFx.basicAttackResourceCost,
    attackSpeedCap:championFx.attackSpeedCap??ATTACK_SPEED_CAP,
    onHits:[...loadout.onHits,...championFx.onHits],
    attackStack:runeFx.attackStack,
    autoProcs:runeFx.autoProcs,
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
  effectiveCurrentHealth:number,
  effectiveShield:number,
  attackRangeBonus:number,
  ranks:Record<AbilitySlot,number>,
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
    setup:{
      runeIds:input.runeIds,
      summonerIds:input.summonerIds,
      activeSummonerIds:input.activeSummonerIds,
      activeChampionEffects:input.activeChampionEffects,
      shield:round(effectiveShield),
      ranks,
    },
    stats:{
      attackDamage:round(stats.attackDamage),
      abilityPower:round(stats.abilityPower),
      armor:round(stats.armor),
      magicResist:round(stats.magicResist),
      health:round(stats.maxHealth),
      healthNow:round(effectiveCurrentHealth),
      mana:round(stats.mana),
      manaNow:round(stats.mana*(input.resourcePercent/100)),
      attackSpeed:round3(stats.attackSpeed),
      attackRange:base.attackRange+attackRangeBonus,
      moveSpeed:round(stats.moveSpeed),
    },
    abilities:SLOTS.map(slot=>kit.abilities[slot]).filter(Boolean),
    confidence:kit.confidence,
  };
}

const defaultSequence=(level:number):ComboStep[]=>
  level>=6?['Q','AA','W','AA','E','R']:level>=3?['Q','AA','W','AA','E']:level===2?['Q','AA','W','AA']:['Q','AA'];

const round=(n:number)=>Math.round(n*10)/10;
const round3=(n:number)=>Math.round(n*1000)/1000;