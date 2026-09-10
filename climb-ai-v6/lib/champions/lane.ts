import {
  ChampionDetail,DamageType,damageType,isTrackableUltimate,rangeClass,statsAtLevel,
} from './ddragon';
import {ItemStats,combatProfile,emptyStats} from './dps';

/**
 * Lane matchup calculator. One champion each side, or two each side for bot
 * lane. Items on either side. Level by level.
 *
 * WHAT THIS MODELS, EXACTLY
 * An auto-attack duel: both sides stand still and attack until someone dies.
 * Damage per second comes from attack damage, attack speed and crit; survival
 * comes from health and resistances against the damage type actually facing
 * them. Time-to-kill is the result, and whoever kills faster wins the trade.
 *
 * That is a model, not the lane. It contains no abilities, no movement, no
 * healing, no shields and no crowd control. It is still the single most useful
 * comparison available from published data, because the auto-attack trade is
 * what decides who can stand in range of whom — but it is named
 * `autoAttackDuel` rather than `whoWinsLane` on purpose.
 *
 * WHAT IT CANNOT MODEL, AND WHY
 * Ability damage. Riot publishes none — across all 173 champions, 0 of 692
 * spells carry `datavalues` or `vars`, and the tooltips reference placeholders
 * that resolve to nothing. So an all-in combo cannot be costed in damage. What
 * CAN be costed is the mana it takes, which is published per ability per rank,
 * and that turns out to answer a real lane question: how many times you can
 * throw the combo before you are dry.
 */

/** Levels worth reporting: the early trading levels, each spike, and full build. */
export const REPORT_LEVELS=[1,2,3,5,6,9,11,16,18];

/** Below this difference in time-to-kill, the trade is called even. */
export const EVEN_TRADE_SECONDS=0.6;

/** A trade this one-sided is not a trade, it is a death sentence. */
export const DECISIVE_TRADE_RATIO=1.5;

export interface LaneChampion{
  detail:ChampionDetail;
  items:ItemStats;
}

export interface SideSnapshot{
  names:string[];
  /** Combined auto-attack DPS of the side. */
  dps:number;
  /** Effective HP of the member most likely to be focused. */
  weakestEffectiveHp:number;
  weakestName:string;
  /** Longest attack range on the side — who can reach. */
  reach:number;
  shortestRange:number;
}

export type TradeVerdict='YOU'|'THEM'|'EVEN';

export interface TradeRead{
  level:number;
  you:SideSnapshot;
  them:SideSnapshot;
  /** Seconds for your side to kill their focus target. Null if it deals none. */
  yourTimeToKill:number|null;
  theirTimeToKill:number|null;
  verdict:TradeVerdict;
  decisive:boolean;
  /** Plain sentence naming the numbers that produced the verdict. */
  explanation:string;
}

export interface AbilityCast{
  slot:string;
  name:string;
  rank:number;
  cost:number;
  /** Times it can be cast from a full bar. Null when there is no resource. */
  castsFromFull:number|null;
}

export interface ResourceRead{
  champion:string;
  resource:string;
  maxAtLevel:number;
  hasBar:boolean;
  casts:AbilityCast[];
  /** Cost of one Q+W+E rotation at the ranks a level-N champion would have. */
  rotationCost:number;
  rotationsFromFull:number|null;
  explanation:string;
}

export interface LaneAnalysis{
  level:number;
  lane:'SOLO'|'DUO';
  you:{champions:string[]};
  them:{champions:string[]};
  trades:TradeRead[];
  atLevel:TradeRead;
  resources:ResourceRead[];
  rangeNote:string;
  allInWindows:string[];
  /** Ordered, each one traceable to a number above it. */
  howToPlayIt:string[];
  modelNote:string;
  unavailable:string[];
}

const MODEL_NOTE=
  'This is an auto-attack duel: both sides stand still and attack until someone '+
  'dies. No abilities, movement, healing, shields or crowd control are included, '+
  'because Riot publishes no ability damage. Read it as "who can stand in range '+
  'of whom", not as "who wins the lane".';

const UNAVAILABLE=[
  'Ability and combo damage — Riot publishes no ability coefficients, so no all-in can be costed in damage.',
  'Crowd control, dashes, shields and untargetability.',
  'Healing and lifesteal sustain over a long trade.',
  'Win rates — that needs a large sample of real games.',
];

export function analyseLane(
  you:LaneChampion[],
  them:LaneChampion[],
  level=6,
):LaneAnalysis{
  const atLevel=Math.min(18,Math.max(1,Math.round(level)));
  const trades=REPORT_LEVELS.map(l=>tradeAt(you,them,l));
  const here=tradeAt(you,them,atLevel);

  return {
    level:atLevel,
    lane:you.length>1||them.length>1?'DUO':'SOLO',
    you:{champions:you.map(c=>c.detail.name)},
    them:{champions:them.map(c=>c.detail.name)},
    trades,
    atLevel:here,
    resources:you.concat(them).map(c=>resourceFor(c,atLevel)),
    rangeNote:rangeNoteFor(you,them,atLevel),
    allInWindows:allInWindowsFor(them),
    howToPlayIt:adviceFor(you,them,trades,here,atLevel),
    modelNote:MODEL_NOTE,
    unavailable:[...UNAVAILABLE],
  };
}

/* ------------------------------------------------------------- trading -- */

function snapshot(side:LaneChampion[],incoming:DamageType,level:number):SideSnapshot{
  const members=side.map(c=>({
    name:c.detail.name,
    profile:combatProfile(c.detail.stats,level,c.items),
    range:c.detail.stats.attackrange,
  }));

  const dps=members.reduce((total,m)=>total+m.profile.dps,0);

  // Focus fire falls on whoever dies fastest, so that is the target modelled.
  const ehpOf=(m:typeof members[number])=>
    incoming==='MAGIC'?m.profile.effectiveHpVsMagic
      :incoming==='PHYSICAL'?m.profile.effectiveHpVsPhysical
        :(m.profile.effectiveHpVsPhysical+m.profile.effectiveHpVsMagic)/2;

  const weakest=members.reduce((lowest,m)=>ehpOf(m)<ehpOf(lowest)?m:lowest,members[0]);

  return {
    names:members.map(m=>m.name),
    dps:round(dps),
    weakestEffectiveHp:round(ehpOf(weakest)),
    weakestName:weakest.name,
    reach:Math.max(...members.map(m=>m.range)),
    shortestRange:Math.min(...members.map(m=>m.range)),
  };
}

export function tradeAt(you:LaneChampion[],them:LaneChampion[],level:number):TradeRead{
  const yourDamage=blendedDamageType(you);
  const theirDamage=blendedDamageType(them);

  const mine=snapshot(you,theirDamage,level);
  const theirs=snapshot(them,yourDamage,level);

  const yourTimeToKill=mine.dps>0?round(theirs.weakestEffectiveHp/mine.dps):null;
  const theirTimeToKill=theirs.dps>0?round(mine.weakestEffectiveHp/theirs.dps):null;

  let verdict:TradeVerdict='EVEN';
  let decisive=false;
  if(yourTimeToKill!==null&&theirTimeToKill!==null){
    const gap=theirTimeToKill-yourTimeToKill;
    if(Math.abs(gap)>=EVEN_TRADE_SECONDS)verdict=gap>0?'YOU':'THEM';
    const ratio=yourTimeToKill>0&&theirTimeToKill>0
      ?Math.max(theirTimeToKill/yourTimeToKill,yourTimeToKill/theirTimeToKill)
      :1;
    decisive=verdict!=='EVEN'&&ratio>=DECISIVE_TRADE_RATIO;
  }else if(yourTimeToKill!==null){verdict='YOU';decisive=true}
  else if(theirTimeToKill!==null){verdict='THEM';decisive=true}

  return {
    level,you:mine,them:theirs,yourTimeToKill,theirTimeToKill,verdict,decisive,
    explanation:explainTrade(mine,theirs,yourTimeToKill,theirTimeToKill,verdict,decisive),
  };
}

function explainTrade(
  mine:SideSnapshot,theirs:SideSnapshot,
  yours:number|null,their:number|null,verdict:TradeVerdict,decisive:boolean,
):string{
  if(yours===null&&their===null)return 'Neither side deals auto-attack damage worth modelling.';
  if(yours===null)return `You deal no auto-attack damage here, so this trade is theirs outright.`;
  if(their===null)return `They deal no auto-attack damage here, so this trade is yours outright.`;

  const head=`Your ${mine.dps} DPS needs ${yours}s to drop ${theirs.weakestName} `+
    `(${theirs.weakestEffectiveHp} effective HP). Their ${theirs.dps} DPS needs `+
    `${their}s to drop ${mine.weakestName} (${mine.weakestEffectiveHp}).`;

  if(verdict==='EVEN')
    return `${head} Within ${EVEN_TRADE_SECONDS}s of each other — whoever lands the first hit wins this.`;

  const margin=round(Math.abs(their-yours));
  if(verdict==='YOU')
    return decisive
      ?`${head} You kill ${margin}s sooner — that is not a trade, it is a kill if they stay.`
      :`${head} You kill ${margin}s sooner, so an even trade favours you.`;

  return decisive
    ?`${head} They kill ${margin}s sooner — do not stand in range and trade autos.`
    :`${head} They kill ${margin}s sooner, so take the trade only with a head start.`;
}

const blendedDamageType=(side:LaneChampion[]):DamageType=>{
  const types=side.map(c=>damageType(c.detail.info));
  if(types.every(t=>t==='PHYSICAL'))return 'PHYSICAL';
  if(types.every(t=>t==='MAGIC'))return 'MAGIC';
  return 'MIXED';
};

/* ------------------------------------------------------------ resources -- */

/** Ranks a champion would have at a level, maxing in Q, W, E order. */
export function ranksAtLevel(level:number):number[]{
  const ranks=[0,0,0];
  let spent=0;
  for(let l=1;l<=level;l++){
    if(l===6||l===11||l===16)continue;         // ultimate points
    const index=spent<3?spent:ranks.findIndex(r=>r<5);
    if(index>=0&&ranks[index]<5)ranks[index]++;
    spent++;
  }
  return ranks;
}

function resourceFor(champion:LaneChampion,level:number):ResourceRead{
  const {detail}=champion;
  const stats=statsAtLevel(detail.stats,level);
  const resource=detail.partype||'None';
  // Flow, Rage and the rest are generated in combat, not a pool you spend from,
  // so a "casts from full" figure would be meaningless for them.
  const hasBar=resource==='Mana'&&stats.mana>0;
  const ranks=ranksAtLevel(level);
  const spells=(detail.spells??[]).slice(0,3);

  const casts:AbilityCast[]=spells.map((spell,i)=>{
    const rank=Math.max(1,ranks[i]);
    const cost=spell.cost?.[rank-1]??0;
    return {
      slot:'QWE'[i],
      name:spell.name,
      rank:ranks[i],
      cost,
      castsFromFull:hasBar&&cost>0?Math.floor(stats.mana/cost):null,
    };
  });

  const rotationCost=casts
    .filter(c=>c.rank>0)
    .reduce((total,c)=>total+c.cost,0);
  const rotationsFromFull=hasBar&&rotationCost>0
    ?Math.floor(stats.mana/rotationCost)
    :null;

  return {
    champion:detail.name,
    resource,
    maxAtLevel:stats.mana,
    hasBar,
    casts,
    rotationCost,
    rotationsFromFull,
    explanation:explainResource(detail.name,resource,stats.mana,hasBar,rotationCost,rotationsFromFull,level),
  };
}

function explainResource(
  name:string,resource:string,mana:number,hasBar:boolean,
  rotationCost:number,rotations:number|null,level:number,
):string{
  if(!hasBar)
    return resource==='None'
      ?`${name} has no resource bar, so the only limit on casting is cooldowns.`
      :`${name} uses ${resource.toLowerCase()}, which is generated in combat rather than spent from a pool — there is no "casts from full" figure for it.`;

  if(rotations===null||rotationCost===0)
    return `${name} has ${mana} mana at level ${level}, and no basic ability ranked yet to spend it on.`;

  return `${name} has ${mana} mana at level ${level}. A full rotation of their ranked basics costs ${rotationCost}, `+
    `so they get ${rotations} rotation${rotations===1?'':'s'} from a full bar before they are dry — and a champion at zero mana is a champion who cannot answer.`;
}

/* ---------------------------------------------------------------- range -- */

function rangeNoteFor(you:LaneChampion[],them:LaneChampion[],level:number):string{
  const mine=snapshot(you,'MIXED',level);
  const theirs=snapshot(them,'MIXED',level);
  const gap=mine.reach-theirs.reach;

  if(Math.abs(gap)<75)
    return `Longest range is ${mine.reach} against ${theirs.reach} — close enough that neither side gets free damage.`;
  if(gap>0)
    return `You reach ${gap} units further (${mine.reach} against ${theirs.reach}). Every auto you land at maximum range costs them a walk to answer.`;
  return `They reach ${-gap} units further (${theirs.reach} against ${mine.reach}). Standing still in lane hands them free damage.`;
}

function allInWindowsFor(them:LaneChampion[]):string[]{
  return them.flatMap(c=>{
    const ult=(c.detail.spells??[])[3];
    if(!ult||!isTrackableUltimate(ult))return [];
    const cd=ult.cooldown![0];
    return [`${c.detail.name}'s ${ult.name} is down for ${cd}s after use — that is the window where this lane is most even.`];
  });
}

/* --------------------------------------------------------------- advice -- */

function adviceFor(
  you:LaneChampion[],them:LaneChampion[],
  trades:TradeRead[],here:TradeRead,level:number,
):string[]{
  const advice:string[]=[];

  // Level 1-3 is where a lane is won or lost, so it is called out separately.
  const early=trades.filter(t=>t.level<=3);
  const earlyWins=early.filter(t=>t.verdict==='YOU').map(t=>t.level);
  const earlyLosses=early.filter(t=>t.verdict==='THEM').map(t=>t.level);

  if(earlyLosses.length===3)
    advice.push('You lose the auto trade at every one of levels 1, 2 and 3. Farm, concede the early levels, and do not contest anything you do not have to.');
  else if(earlyLosses.length)
    advice.push(`You lose the auto trade at level${earlyLosses.length>1?'s':''} ${earlyLosses.join(' and ')}. Respect those levels specifically and look for the others.`);
  if(earlyWins.length===3)
    advice.push('You win the auto trade at all of levels 1, 2 and 3. If you are not pressuring in that window you are giving away the part of the lane you are favoured in.');
  else if(earlyWins.length)
    advice.push(`Level${earlyWins.length>1?'s':''} ${earlyWins.join(' and ')} favour you on autos — that is when to step up.`);

  // Where the verdict flips is more actionable than any single level.
  const flip=findFlip(trades);
  if(flip)advice.push(flip);

  const decisive=trades.find(t=>t.decisive&&t.verdict==='THEM');
  if(decisive)
    advice.push(`At level ${decisive.level} they kill you roughly ${round(decisive.yourTimeToKill!/decisive.theirTimeToKill!)}x faster than you kill them. Do not be in range at that level without a lead.`);

  const range=snapshot(you,'MIXED',level).reach-snapshot(them,'MIXED',level).reach;
  if(range<=-75)
    advice.push(`Close the ${-range}-unit range gap with an ability or under your own wave, or do not take the trade at all.`);
  else if(range>=75)
    advice.push(`Your ${range}-unit reach only exists if you hold spacing — auto and step back rather than walking in.`);

  // Mana is the lane resource the data actually has, so it earns a line.
  for(const side of [{list:them,mine:false},{list:you,mine:true}]){
    for(const c of side.list){
      const read=resourceFor(c,level);
      if(read.hasBar&&read.rotationsFromFull!==null&&read.rotationsFromFull<=3)
        advice.push(side.mine
          ?`You only get ${read.rotationsFromFull} full rotations from a mana bar. Past that you are a minion, so spend on the trades that matter.`
          :`${read.champion} gets only ${read.rotationsFromFull} full rotations from a mana bar. Bait the casts and the lane becomes yours for free.`);
    }
  }

  return advice;
}

function findFlip(trades:TradeRead[]):string|null{
  for(let i=1;i<trades.length;i++){
    const before=trades[i-1].verdict;
    const after=trades[i].verdict;
    if(before==='THEM'&&after==='YOU')
      return `The auto trade flips to you at level ${trades[i].level}. Surviving until then even is a win.`;
    if(before==='YOU'&&after==='THEM')
      return `The auto trade flips against you at level ${trades[i].level}. Whatever you are going to do with this lane, do it before then.`;
  }
  return null;
}

export const emptyItems=emptyStats;
export {rangeClass};

const round=(n:number)=>Math.round(n*10)/10;
