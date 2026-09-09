import {
  ChampionDetail,ChampionListEntry,ChampionSpell,DamageType,LevelStats,RangeClass,
  damageType,isTrackableUltimate,ordinal,rangeClass,statsAtLevel,
} from './ddragon';

/**
 * Champion profiles: power spikes, all-in windows and a lane plan, derived
 * entirely from Riot's own static champion data.
 *
 * The discipline here is the same as everywhere else in this codebase. A FACT
 * is read straight out of Data Dragon or computed from it by arithmetic that
 * cannot be wrong (a cooldown, a stat at a level, a percentile against the
 * roster). An INFERENCE is a lane consequence of those facts and is labelled
 * as one. Nothing here is a win rate, because champion data contains no
 * outcomes — only capabilities.
 *
 * What this deliberately does NOT do:
 *  - claim win rates by champion, item or skin (no games are sampled)
 *  - claim jungle pathing routes (clear speed is not in the data)
 *  - claim a matchup is "60/40" (see matchup.ts for what is actually knowable)
 */

/** The levels a champion's ultimate can be ranked up. */
export const ULT_LEVELS=[6,11,16] as const;

/** Basic abilities rank at 1,3,5,7,9 — so the first one maxes at level 9. */
export const FIRST_MAX_LEVEL=9;

/** How far a roster percentile must move before it counts as real scaling. */
export const SCALING_SHIFT=15;

export type SpikeKind='ULTIMATE'|'ABILITY_MAX';

export interface PowerSpike{
  level:number;
  kind:SpikeKind;
  title:string;
  /** Read from champion data. Never a guess. */
  fact:string;
  /** What it means for how you play the level. A consequence, not data. */
  inference?:string;
}

export interface AllInWindow{
  ability:string;
  rank:number;
  cooldownSeconds:number;
  fact:string;
  inference:string;
}

export type PercentileStat=
  'HP'|'ARMOR'|'MAGIC_RESIST'|'ATTACK_DAMAGE'|'ATTACK_SPEED'|'ATTACK_RANGE'|'MOVE_SPEED';

export interface StatPercentile{
  stat:PercentileStat;
  value:number;
  /** 0-100: the share of the roster this champion is above at the same level. */
  percentile:number;
}

export type ScalingVerdict='EARLY_GAME'|'SCALING'|'FLAT';

export interface ScalingRead{
  stat:'EFFECTIVE_HP'|'ATTACK_DAMAGE';
  earlyPercentile:number;
  latePercentile:number;
  shift:number;
  verdict:ScalingVerdict;
  fact:string;
}

export interface ChampionProfile{
  id:string;
  name:string;
  title:string;
  tags:string[];
  resource:string;
  difficulty:number;
  rangeClass:RangeClass;
  damageType:DamageType;
  atLevel:(level:number)=>LevelStats;
  spikes:PowerSpike[];
  allInWindows:AllInWindow[];
  /** Empty when no roster was supplied — never fabricated. */
  percentiles:StatPercentile[];
  scaling:ScalingRead[];
  lanePlan:string[];
  /** Riot's own tips, quoted and attributed rather than reworded as ours. */
  riotAllyTips:string[];
  riotEnemyTips:string[];
  /** Anything the static data could not tell us. Shown, not hidden. */
  unavailable:string[];
}

export function championProfile(
  champion:ChampionDetail,
  roster?:Record<string,ChampionListEntry>,
):ChampionProfile{
  const rc=rangeClass(champion.stats.attackrange);
  const dt=damageType(champion.info);
  const spells=champion.spells??[];
  const ult=spells[3];
  const basics=spells.slice(0,3);

  const unavailable:string[]=[];
  if(!roster)unavailable.push('Roster comparison (needs the full champion list).');
  if(ult&&!isTrackableUltimate(ult))
    unavailable.push(`All-in window from ${ult.name} — it is a stance or charge ability, not a cooldown anyone can wait out.`);
  // Jungle routing depends on camp clear times and respawn timers, none of
  // which exist in champion data. Claiming a route would be inventing it.
  unavailable.push('Jungle pathing routes — clear speed is not in Riot static data.');

  return {
    id:champion.id,
    name:champion.name,
    title:champion.title,
    tags:champion.tags,
    resource:champion.partype,
    difficulty:champion.info.difficulty,
    rangeClass:rc,
    damageType:dt,
    atLevel:(level:number)=>statsAtLevel(champion.stats,level),
    spikes:spikesFor(ult,basics),
    allInWindows:isTrackableUltimate(ult)?allInWindowsFor(ult):[],
    percentiles:roster?percentilesFor(roster,champion.id,11):[],
    scaling:roster?scalingFor(roster,champion.id):[],
    lanePlan:lanePlanFor(champion,rc,dt),
    riotAllyTips:champion.allytips??[],
    riotEnemyTips:champion.enemytips??[],
    unavailable,
  };
}

/* ---------------------------------------------------------------- spikes -- */

function spikesFor(ult:ChampionSpell|undefined,basics:ChampionSpell[]):PowerSpike[]{
  const spikes:PowerSpike[]=[];

  if(ult&&ult.cooldown&&ult.cooldown.length){
    const cds=ult.cooldown;
    // A stance or charge ultimate is always up, so no rank of it changes your
    // fight cadence. Saying "comes back 2s sooner" about Spider Form would be
    // technically true and completely useless.
    const trackable=isTrackableUltimate(ult);
    for(let rank=0;rank<Math.min(cds.length,ULT_LEVELS.length);rank++){
      const level=ULT_LEVELS[rank];
      const cd=cds[rank];
      const previous=rank>0?cds[rank-1]:null;
      // A flat ultimate cooldown is a real and commonly missed fact: ranking it
      // buys damage, not uptime, so it does not change your fight cadence.
      const inference=previous===null
        ?`Your first real all-in threat. Until this level you had no ${ult.name} at all.`
        :!trackable
          ?`${ult.name} is effectively always available, so this rank is straight power rather than uptime.`
          :previous===cd
            ?`${ult.name} still costs ${cd}s to use, exactly as it did at rank ${rank}. This rank adds power, not uptime.`
            :`${ult.name} comes back ${previous-cd}s sooner, so you can contest roughly one more fight per rotation.`;
      spikes.push({
        level,kind:'ULTIMATE',
        title:`Level ${level} — ${ult.name} rank ${rank+1}`,
        fact:`${ult.name} cooldown at rank ${rank+1}: ${cd}s.`,
        inference,
      });
    }
  }

  // The basic ability whose cooldown improves most is the one that gains the
  // most uptime from being maxed. That is a fact about the numbers, not a
  // build recommendation — damage per rank is not comparable across abilities.
  const ranked=basics
    .filter(s=>Array.isArray(s.cooldown)&&s.cooldown.length>1)
    .map(s=>({spell:s,cds:s.cooldown as number[]}))
    .map(x=>({...x,drop:x.cds[0]-x.cds[x.cds.length-1]}))
    .sort((a,b)=>b.drop-a.drop);

  const best=ranked[0];
  if(best&&best.drop>0){
    const first=best.cds[0];
    const last=best.cds[best.cds.length-1];
    // Urgot's Purge reaches 0s at max rank, which made the ratio Infinity.
    // A cooldown that reaches zero is better described as gone than as a
    // percentage improvement.
    const ratio=last>0?(first/last-1)*100:null;
    spikes.push({
      level:FIRST_MAX_LEVEL,kind:'ABILITY_MAX',
      title:`Level ${FIRST_MAX_LEVEL} — first ability maxed`,
      fact:`${best.spell.name} drops from ${first}s to ${last}s across its ${best.cds.length} ranks — the largest cooldown gain of your basic abilities.`,
      inference:ratio===null
        ?`Maxed, ${best.spell.name} has no cooldown left at all.`
        :`Maxed, ${best.spell.name} is available about ${Math.round(ratio)}% more often than at rank 1.`,
    });
  }

  return spikes.sort((a,b)=>a.level-b.level);
}

/* -------------------------------------------------------- all-in windows -- */

/**
 * The honest version of "when is my all-in strongest": an ultimate on cooldown
 * is a measurable window in which a champion cannot do the thing that makes
 * them scary. It cuts both ways, which is why the text says so.
 */
function allInWindowsFor(ult:ChampionSpell|undefined):AllInWindow[]{
  if(!ult||!ult.cooldown||!ult.cooldown.length)return [];
  return ult.cooldown.slice(0,ULT_LEVELS.length).map((cd,i)=>({
    ability:ult.name,rank:i+1,cooldownSeconds:cd,
    fact:`At rank ${i+1}, ${ult.name} is unavailable for ${cd}s after use.`,
    inference:`That is a ${formatSeconds(cd)} window where you fight without it — and the same window for you when the enemy has just used theirs.`,
  }));
}

const formatSeconds=(s:number)=>
  s>=60?`${Math.floor(s/60)}m ${String(s%60).padStart(2,'0')}s`:`${s}s`;

/* ----------------------------------------------------------- percentiles -- */

const STAT_READERS:{stat:PercentileStat;read:(s:LevelStats)=>number}[]=[
  {stat:'HP',read:s=>s.hp},
  {stat:'ARMOR',read:s=>s.armor},
  {stat:'MAGIC_RESIST',read:s=>s.magicResist},
  {stat:'ATTACK_DAMAGE',read:s=>s.attackDamage},
  {stat:'ATTACK_SPEED',read:s=>s.attackSpeed},
  {stat:'ATTACK_RANGE',read:s=>s.attackRange},
  {stat:'MOVE_SPEED',read:s=>s.moveSpeed},
];

export function percentilesFor(
  roster:Record<string,ChampionListEntry>,id:string,level:number,
):StatPercentile[]{
  const entries=Object.values(roster);
  const me=roster[id];
  if(!me||entries.length<2)return [];
  const mine=statsAtLevel(me.stats,level);
  return STAT_READERS.map(({stat,read})=>{
    const value=read(mine);
    const below=entries.filter(e=>read(statsAtLevel(e.stats,level))<value).length;
    return {stat,value,percentile:Math.round(below/(entries.length-1)*100)};
  });
}

/**
 * Whether a champion gets relatively stronger or weaker as the game runs.
 * Comparing one champion's roster percentile early against late is a statement
 * about champion data only — it makes no claim about who wins a game.
 */
export function scalingFor(
  roster:Record<string,ChampionListEntry>,id:string,
):ScalingRead[]{
  const entries=Object.values(roster);
  const me=roster[id];
  if(!me||entries.length<2)return [];

  const reads:{stat:ScalingRead['stat'];read:(s:LevelStats)=>number;label:string}[]=[
    {stat:'EFFECTIVE_HP',read:s=>s.effectiveHpVsPhysical,label:'effective health'},
    {stat:'ATTACK_DAMAGE',read:s=>s.attackDamage,label:'attack damage'},
  ];

  return reads.map(({stat,read,label})=>{
    const pct=(level:number)=>{
      const value=read(statsAtLevel(me.stats,level));
      const below=entries.filter(e=>read(statsAtLevel(e.stats,level))<value).length;
      return Math.round(below/(entries.length-1)*100);
    };
    const earlyPercentile=pct(2);
    const latePercentile=pct(16);
    const shift=latePercentile-earlyPercentile;
    const verdict:ScalingVerdict=
      shift>=SCALING_SHIFT?'SCALING':shift<=-SCALING_SHIFT?'EARLY_GAME':'FLAT';
    return {
      stat,earlyPercentile,latePercentile,shift,verdict,
      fact:`${capitalise(label)}: ${ordinal(earlyPercentile)} percentile of the roster at level 2, ${ordinal(latePercentile)} at level 16.`,
    };
  });
}

/* ------------------------------------------------------------- lane plan -- */

function lanePlanFor(champion:ChampionDetail,rc:RangeClass,dt:DamageType):string[]{
  const plan:string[]=[];
  const range=champion.stats.attackrange;

  if(rc==='MELEE')
    plan.push(`You attack from ${range} units — melee. Every auto you land is a step into their range, so a trade starts when you decide to walk, not when you decide to click.`);
  else if(rc==='LONG')
    plan.push(`You attack from ${range} units, longer than almost anything you will lane against. Landing autos at your maximum range is the whole plan; at their range you are just a squishier version of them.`);
  else
    plan.push(`You attack from ${range} units. That beats melee and loses to the long-range marksmen, so check the number before you decide who is allowed to walk forward.`);

  const resource=champion.partype||'';
  if(resource==='None'||resource==='Rage'||resource==='Fury'||resource==='Ferocity')
    plan.push('You have no mana bar. Your only cost in lane is cooldowns, so trading pattern matters more for you than resource management does.');
  else if(resource==='Energy')
    plan.push('Energy refills fast but caps low: you cannot chain a long fight, only short ones with gaps between them.');
  else if(resource)
    plan.push(`You pay ${resource.toLowerCase()} for every ability. Below roughly a third of your bar you can no longer complete a full combo, which is a real decision point before you commit.`);

  if(dt==='PHYSICAL')
    plan.push('Riot rates your damage as mostly physical, so armour on the enemy hurts you more than magic resist does.');
  else if(dt==='MAGIC')
    plan.push('Riot rates your damage as mostly magic, so an early magic-resist item is worth more against you than armour.');
  else
    plan.push('Riot rates your damage as mixed, which means no single resistance item shuts you down.');

  if(champion.info.difficulty>=8)
    plan.push(`Riot rates this champion ${champion.info.difficulty}/10 for difficulty, among the hardest in the game. Expect the learning curve, and judge yourself on the trend rather than on any single game.`);

  return plan;
}

const capitalise=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
