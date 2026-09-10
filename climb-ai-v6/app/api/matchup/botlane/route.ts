import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {championDetail,latestPatch,resolveChampionId} from '@/lib/champions/source';
import {statsAtLevel} from '@/lib/champions/ddragon';
import {championSpells} from '@/lib/combat/source';
import {assembleKit,combatDamageType,SLOTS,type DataDragonSpell} from '@/lib/combat/abilities';
import {ATTACK_SPEED_CAP,type AbilitySlot,type ComboStep} from '@/lib/combat/combos';
import {matchupItemCatalogue} from '@/lib/combat/itemSource';
import {buildLoadout,type LoadoutResult,type MatchupItem} from '@/lib/combat/itemLoadout';
import {buildChampionCombatProfile,type ChampionCombatProfile} from '@/lib/combat/championEffects';
import {
  applyConfiguredAttackReplacement,configureChampionAttackReplacement,
} from '@/lib/combat/championAttackReplacements';
import {applyChampionAbilityState} from '@/lib/combat/championAbilityState';
import {applyConditionalChampionSpells} from '@/lib/combat/conditionalChampionSpells';
import {applyExecuteChampionSpells} from '@/lib/combat/executeChampionSpells';
import {buildChampionDuelProfile} from '@/lib/combat/championDuel';
import {buildBotLaneUtilityProfile} from '@/lib/combat/botlaneSupport';
import {buildRuneCombatProfile,buildSummonerCombatProfile,type RuneCombatProfile} from '@/lib/combat/effects';
import {normaliseStandardRanks} from '@/lib/combat/skillRanks';
import {compareYourFocusTargets,simulateBotLane,type BotLaneKey,type BotLaneParticipantInput} from '@/lib/combat/botlane';
import {buildBotLaneCoachPlan,type AccessMode} from '@/lib/combat/botlaneCoach';
import {noPenetration,type Penetration} from '@/lib/combat/damage';
import type {CombatStats} from '@/lib/combat/formula';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {humanError} from '@/lib/errors';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const step=z.enum(['AA','Q','W','E','R']);
const abilitySlot=z.enum(['Q','W','E','R']);
const accessMode=z.enum(['FULL','NO_AUTOS']);
const side=z.object({
  champion:z.string().min(1).max(32),
  level:z.coerce.number().int().min(1).max(18).default(6),
  itemIds:z.array(z.coerce.number().int().positive()).max(6).default([]),
  runeIds:z.array(z.coerce.number().int().positive()).max(6).default([]),
  summonerIds:z.array(z.string().min(1).max(48)).max(2).default([]),
  activeSummonerIds:z.array(z.string().min(1).max(48)).max(2).default([]),
  activeChampionEffects:z.array(z.string().min(1).max(48)).max(8).default([]),
  ranks:z.record(z.enum(['Q','W','E','R']),z.coerce.number().int().min(0).max(5)).optional(),
  healthPercent:z.coerce.number().min(1).max(100).default(100),
  resourcePercent:z.coerce.number().min(0).max(100).default(100),
  shield:z.coerce.number().min(0).max(10000).default(0),
  sequence:z.array(step).max(24).default(['Q','AA','W','AA','E','R']),
  accessMode:accessMode.default('FULL'),
  missedAbilities:z.array(abilitySlot).max(4).default([]),
});
const schema=z.object({
  yourAdc:side,
  yourSupport:side,
  enemyAdc:side,
  enemySupport:side,
  yourFocus:z.enum(['THEM_ADC','THEM_SUPPORT']).default('THEM_ADC'),
  enemyFocus:z.enum(['YOU_ADC','YOU_SUPPORT']).default('YOU_ADC'),
  yourProtect:z.enum(['YOU_ADC','YOU_SUPPORT']).default('YOU_ADC'),
  enemyProtect:z.enum(['THEM_ADC','THEM_SUPPORT']).default('THEM_ADC'),
  durationSeconds:z.coerce.number().min(1).max(20).default(10),
});

type SideInput=z.infer<typeof side>;

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'matchup-botlane'),25,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Simulating too fast. Wait a moment.'},{status:429});
  let body:unknown;
  try{body=await req.json()}catch{return NextResponse.json({ok:false,error:'Could not read the request.'},{status:400})}
  const parsed=schema.safeParse(body);
  if(!parsed.success)return NextResponse.json({ok:false,error:'That bot-lane simulation request is not valid.',detail:parsed.error.issues.slice(0,6)},{status:400});

  const input=parsed.data;
  try{
    const patch=await latestPatch();
    const catalogueRaw=await matchupItemCatalogue(patch);
    const catalogue=catalogueRaw as Record<string,MatchupItem>;

    const configs=[
      ['YOU_ADC','YOU','ADC',input.yourAdc,input.yourFocus,input.yourProtect],
      ['YOU_SUPPORT','YOU','SUPPORT',input.yourSupport,input.yourFocus,input.yourProtect],
      ['THEM_ADC','THEM','ADC',input.enemyAdc,input.enemyFocus,input.enemyProtect],
      ['THEM_SUPPORT','THEM','SUPPORT',input.enemySupport,input.enemyFocus,input.enemyProtect],
    ] as const;

    const prepared=await Promise.all(configs.map(async([key,team,role,form,focus,protect])=>
      prepareParticipant(patch,catalogue,key,team,role,form,focus,protect),
    ));
    const participants=Object.fromEntries(prepared.map(x=>[x.input.key,x.input])) as Record<BotLaneKey,BotLaneParticipantInput>;
    const current=simulateBotLane(participants,input.durationSeconds);
    const focusComparison=compareYourFocusTargets(participants,input.durationSeconds);
    const preparedByKey=Object.fromEntries(prepared.map(x=>[x.input.key,x])) as Record<BotLaneKey,(typeof prepared)[number]>;
    const lanePlan=buildBotLaneCoachPlan({
      result:current,
      focus:focusComparison,
      yourAdc:preparedByKey.YOU_ADC.coach,
      yourSupport:preparedByKey.YOU_SUPPORT.coach,
      enemyAdc:preparedByKey.THEM_ADC.coach,
      enemySupport:preparedByKey.THEM_SUPPORT.coach,
    });

    const partials=prepared.flatMap(x=>x.partial.map(reason=>`${x.input.champion}: ${reason}`));
    const notes=prepared.flatMap(x=>x.notes);
    const confidence=partials.length?'PARTIAL':'HIGH';

    return NextResponse.json({
      ok:true,patch,confidence,
      setup:{
        yourFocus:input.yourFocus,enemyFocus:input.enemyFocus,
        yourProtect:input.yourProtect,enemyProtect:input.enemyProtect,
        durationSeconds:input.durationSeconds,
      },
      participants:Object.fromEntries(prepared.map(x=>[x.input.key,x.report])),
      result:current,
      lanePlan,
      focusComparison:{
        recommendedTarget:focusComparison.recommendedTarget,
        recommendedRole:focusComparison.recommendedRole,
        reason:focusComparison.reason,
        adcFocus:summary(focusComparison.adcFocus),
        supportFocus:summary(focusComparison.supportFocus),
      },
      coverage:{partial:partials,notes:[...new Set(notes)].slice(0,40)},
      dataSources:[
        {name:'Data Dragon',use:'champion/item/rune/summoner identity and visible stats'},
        {name:'CommunityDragon',use:'ability damage formulas'},
        {name:'CLIMB interaction registry',use:'validated shared-clock CC, shields, heals, champion states, conditional spell variants, dynamic executes, supported ability-applied on-hits, attack replacements and explicit access/hit assumptions'},
      ],
    });
  }catch(err){
    const {title,body:detail}=humanError(err);
    return NextResponse.json({ok:false,error:`${title} ${detail}`},{status:502});
  }
}

async function prepareParticipant(
  patch:string,
  catalogue:Record<string,MatchupItem>,
  key:BotLaneKey,
  team:'YOU'|'THEM',
  role:'ADC'|'SUPPORT',
  input:SideInput,
  focusTarget:BotLaneKey,
  protectTarget:BotLaneKey,
){
  const id=await resolveChampionId(input.champion,patch);
  if(!id)throw new Error(`No champion called "${input.champion}".`);
  const [champion,spellSource]=await Promise.all([championDetail(id,patch),championSpells(id)]);
  const loadout=buildLoadout(catalogue,input.itemIds,0);
  const ranks=normaliseStandardRanks(input.ranks,input.level);
  const base=statsAtLevel(champion.stats,input.level);
  const championFx=buildChampionCombatProfile(champion.id,input.activeChampionEffects,ranks,{
    abilityPower:loadout.stats.abilityPower,
    bonusAttackDamage:loadout.stats.attackDamage,
    level:input.level,
  });
  const stats=combatStats(champion,input,loadout,championFx);
  configureChampionAttackReplacement(
    champion.id,input.activeChampionEffects,championFx,{
      patch,level:input.level,attackDamage:stats.attackDamage,
      abilityPower:stats.abilityPower,
      bonusMagicResist:Math.max(0,stats.magicResist-base.magicResist),
      critChance:stats.critChance,
    },
  );
  const damage=combatDamageType(champion.info);
  const kit=assembleKit(
    champion.spells as DataDragonSpell[],spellSource?.spells??[],
    {caster:stats,level:input.level,ranks,damageType:damage.type},
  );
  applyRankAvailability(kit,ranks);
  applyChampionAbilityState(kit,championFx);
  applyConditionalChampionSpells(champion.id,input.activeChampionEffects,kit,championFx);
  applyExecuteChampionSpells(champion.id,kit,championFx,{
    patch,
    bonusAttackDamage:loadout.stats.attackDamage,
    ranks,
    itemOnHits:loadout.onHits,
  });

  const runeFx=buildRuneCombatProfile(input.runeIds,{
    level:input.level,isRanged:(base.attackRange+championFx.attackRangeBonus)>=300,
    healthPercent:input.healthPercent,baseAttackSpeed:base.baseAttackSpeed,
    bonusAttackSpeedRatio:(base.bonusAttackSpeedRatio+loadout.stats.attackSpeedRatio+championFx.permanentAttackSpeedRatio)*championFx.bonusAttackSpeedScalar,
    adaptiveDamageType:damage.type,
  });
  const baseCurrent=stats.maxHealth*(input.healthPercent/100);
  const summonerFx=buildSummonerCombatProfile(input.summonerIds,input.activeSummonerIds,{level:input.level,maxHealth:stats.maxHealth,currentHealth:baseCurrent});
  const current=Math.min(stats.maxHealth,baseCurrent+summonerFx.heal);
  const duelFx=buildChampionDuelProfile(champion.id,input.activeChampionEffects,ranks,{
    level:input.level,abilityPower:stats.abilityPower,maxHealth:stats.maxHealth,bonusHealth:Math.max(0,stats.maxHealth-base.hp),
  });
  const utilityFx=buildBotLaneUtilityProfile(champion.id,ranks,{level:input.level,abilityPower:stats.abilityPower,maxHealth:stats.maxHealth});

  // Ally-targeted support casts must not simultaneously use the enemy-cast
  // damage branch of the imported spell. The omitted bounce/alternate target is
  // explicitly carried as PARTIAL by the utility profile instead.
  for(const slot of Object.keys(utilityFx.allyUtility) as AbilitySlot[]){
    if(kit.models[slot])kit.models[slot]={...kit.models[slot]!,damage:[]};
  }

  // HIT/MISS is a player-controlled assumption. A forced miss still consumes
  // its cast in the script but contributes no enemy damage, target debuff, CC,
  // or ally-targeted utility. We do not invent hit probability.
  for(const slot of input.missedAbilities as AbilitySlot[]){
    const model=kit.models[slot];
    if(model)kit.models[slot]={...model,damage:[],dynamicDamage:[],targetDebuff:undefined};
    delete duelFx.abilityOverlays[slot];
    delete utilityFx.abilityOverlays[slot];
    delete utilityFx.allyUtility[slot];
  }

  const penetration=penetrationFromLoadout(loadout);
  const haste=loadout.stats.abilityHaste;
  const sequence=(input.accessMode==='NO_AUTOS'
    ?input.sequence.filter(action=>action!=='AA')
    :input.sequence) as ComboStep[];
  const participant:BotLaneParticipantInput={
    key,team,role,champion:champion.name,sequence,
    abilities:kit.models,autoAttack:autoAttackModel(stats,loadout,runeFx,championFx),
    mana:stats.mana*(input.resourcePercent/100),maxHealth:stats.maxHealth,currentHealth:current,
    shield:input.shield,
    openingShields:[
      ...(summonerFx.bonusShield>0?[{label:'Barrier',amount:summonerFx.bonusShield,durationSeconds:2.5,scope:'ALL' as const}]:[]),
      ...duelFx.openingShields,
    ],
    resistances:{armor:stats.armor,magicResist:stats.magicResist},penetration,
    abilityHaste:haste,damageRules:runeFx.damageRules,initialTargetMarks:championFx.initialTargetMarks,
    abilityOverlays:mergeOverlays(duelFx.abilityOverlays,utilityFx.abilityOverlays),
    sustainEffects:duelFx.sustainEffects,
    focusTarget,protectTarget,allyUtility:utilityFx.allyUtility,
  };

  const partial=[
    ...championFx.unmodelledEffects,
    ...duelFx.partial,
    ...utilityFx.partial,
    ...runeFx.unmodelledRuneIds.map(id=>`rune ${id}`),
    ...summonerFx.unmodelledActiveIds.map(id=>`summoner ${id}`),
    ...(summonerFx.igniteDamage>0?['Ignite tick timing is not yet scheduled in 2v2']:[]),
    ...(summonerFx.exhaustDamageMultiplier<1?['Exhaust target selection is not yet explicit in 2v2']:[]),
  ];
  const notes=[
    ...championFx.notes,...duelFx.notes,...utilityFx.notes,...runeFx.notes,...summonerFx.notes,
    ...(input.accessMode==='NO_AUTOS'?[`${champion.name}: NO AUTO ACCESS is explicit, so basic attacks are removed from the four-champion script.`]:[]),
    ...(input.missedAbilities.length?[`${champion.name}: ${input.missedAbilities.join('/')} is explicitly forced to MISS for this simulation.`]:[]),
  ];
  const attackRange=base.attackRange+championFx.attackRangeBonus;
  return {
    input:participant,partial,notes,
    coach:{
      champion:champion.name,
      attackRange,
      accessMode:input.accessMode as AccessMode,
      missedAbilities:input.missedAbilities as AbilitySlot[],
    },
    report:{
      key,team,role,champion:champion.name,level:input.level,items:loadout.items,totalGold:loadout.totalGold,
      stats:{attackDamage:round(stats.attackDamage),abilityPower:round(stats.abilityPower),armor:round(stats.armor),magicResist:round(stats.magicResist),health:round(stats.maxHealth),healthNow:round(current),mana:round(stats.mana),attackSpeed:round3(stats.attackSpeed),attackRange},
      ranks,sequence,focusTarget,protectTarget,
      setup:{
        runeIds:input.runeIds,summonerIds:input.summonerIds,activeSummonerIds:input.activeSummonerIds,
        activeChampionEffects:input.activeChampionEffects,accessMode:input.accessMode,missedAbilities:input.missedAbilities,
      },
    },
  };
}

function mergeOverlays(
  a:ReturnType<typeof buildChampionDuelProfile>['abilityOverlays'],
  b:ReturnType<typeof buildBotLaneUtilityProfile>['abilityOverlays'],
){
  const out={...a};
  for(const slot of SLOTS)if(b[slot])out[slot]={...(out[slot]??{}),...b[slot]};
  return out;
}

function applyRankAvailability(kit:ReturnType<typeof assembleKit>,ranks:Record<AbilitySlot,number>){
  for(const slot of SLOTS)if((ranks[slot]??0)<=0)delete kit.models[slot];
}
function combatStats(champion:Awaited<ReturnType<typeof championDetail>>,input:SideInput,loadout:LoadoutResult,fx:ChampionCombatProfile):CombatStats{
  const base=statsAtLevel(champion.stats,input.level);const item=loadout.stats;
  const bonusAs=(base.bonusAttackSpeedRatio+item.attackSpeedRatio+fx.permanentAttackSpeedRatio)*fx.bonusAttackSpeedScalar;
  const cap=fx.attackSpeedCap??ATTACK_SPEED_CAP;
  return {abilityPower:item.abilityPower,attackDamage:base.attackDamage+item.attackDamage,armor:base.armor+item.armor,magicResist:base.magicResist+item.magicResist,maxHealth:base.hp+item.health,critChance:Math.min(1,Math.max(0,item.critChance)),critDamageMultiplier:1.75,attackSpeed:Math.min(cap,base.baseAttackSpeed*(1+bonusAs)*fx.totalAttackSpeedMultiplier),moveSpeed:(base.moveSpeed+item.flatMoveSpeed)*(1+item.percentMoveSpeed),mana:base.mana+item.mana};
}
function autoAttackModel(stats:CombatStats,loadout:LoadoutResult,runeFx:RuneCombatProfile,fx:ChampionCombatProfile){
  const model={damage:stats.attackDamage*fx.basicAttackDamageMultiplier,attackSpeed:stats.attackSpeed,resourceCost:fx.basicAttackResourceCost,attackSpeedCap:fx.attackSpeedCap??ATTACK_SPEED_CAP,onHits:[...loadout.onHits,...fx.onHits],attackStack:runeFx.attackStack,autoProcs:[...runeFx.autoProcs,...fx.autoProcs],timedStates:fx.timedAutoStates,eventState:fx.autoEventState};
  return applyConfiguredAttackReplacement(model,fx);
}
function penetrationFromLoadout(loadout:LoadoutResult):Penetration{return {...noPenetration(),flatArmorPen:loadout.stats.lethality,percentArmorPen:loadout.stats.percentArmorPen,flatMagicPen:loadout.stats.flatMagicPen,percentMagicPen:loadout.stats.percentMagicPen}}
function summary(result:ReturnType<typeof simulateBotLane>){return {verdict:result.verdict,winner:result.winner,firstKill:result.firstKill,kills:result.kills,teamDamage:result.teamDamage,participants:result.participants}}
const round=(n:number)=>Math.round(n*10)/10;const round3=(n:number)=>Math.round(n*1000)/1000;