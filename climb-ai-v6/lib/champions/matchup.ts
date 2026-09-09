import {ChampionDetail,ChampionListEntry,DamageType,damageType,isTrackableUltimate,rangeClass,statsAtLevel} from './ddragon';
import {ScalingRead,scalingFor} from './profile';

/**
 * Matchups: what beats what, and specifically how.
 *
 * There are two honest ways to answer "does X beat Y". One is to sample a
 * large population of games and report a win rate — which needs a player base
 * this app does not have, so it is not attempted here. The other is to compare
 * what the two champions can physically do, which is exactly what Riot's
 * static data describes, and is what this module does.
 *
 * So a matchup read here is a list of measured differences plus the lane
 * consequence of each. It never says "you win this 55% of the time", because
 * that number would be fabricated. It says "they out-range you by 375 units,
 * which is why every trade you take standing still is theirs".
 *
 * Riot's own enemytips are surfaced verbatim and attributed. They are the one
 * piece of genuine matchup advice in the static data and rewording them as
 * ours would be both dishonest and worse.
 */

/** Below these, a difference is noise rather than something you can play around. */
export const MIN_RANGE_GAP=75;
export const MIN_STAT_GAP_PCT=8;
export const MIN_MOVE_SPEED_GAP=15;

/** The level a lane matchup is read at by default: both ultimates online. */
export const DEFAULT_MATCHUP_LEVEL=6;

export type Edge='YOU'|'THEM'|'EVEN';

export interface MatchupFact{
  key:string;
  label:string;
  you:string;
  them:string;
  edge:Edge;
  /** The lane consequence. An inference from the numbers above it. */
  note?:string;
}

export interface MatchupRead{
  you:{id:string;name:string};
  them:{id:string;name:string};
  level:number;
  facts:MatchupFact[];
  /** Ordered actions that follow from the facts. Never a win-rate claim. */
  howToPlayIt:string[];
  /** Riot's published advice for playing against the opponent. Verbatim. */
  riotSaysAboutThem:string[];
  caveat:string;
  unavailable:string[];
}

const CAVEAT=
  'This compares what the two champions can do, not how games between them '+
  'actually end. It is not a win rate — no games are being sampled here.';

export function matchupRead(
  you:ChampionDetail,
  them:ChampionDetail,
  opts:{level?:number;roster?:Record<string,ChampionListEntry>}={},
):MatchupRead{
  const level=Math.min(18,Math.max(1,Math.round(opts.level??DEFAULT_MATCHUP_LEVEL)));
  const mine=statsAtLevel(you.stats,level);
  const theirs=statsAtLevel(them.stats,level);
  const myDamage=damageType(you.info);
  const theirDamage=damageType(them.info);

  const facts:MatchupFact[]=[];
  const howToPlayIt:string[]=[];

  /* --- range: the single most decisive static fact in a lane ------------ */
  const rangeGap=mine.attackRange-theirs.attackRange;
  const rangeEdge:Edge=Math.abs(rangeGap)<MIN_RANGE_GAP?'EVEN':rangeGap>0?'YOU':'THEM';
  facts.push({
    key:'attackRange',label:'Attack range',
    you:`${mine.attackRange}`,them:`${theirs.attackRange}`,
    edge:rangeEdge,
    note:rangeEdge==='EVEN'
      ?'Close enough that neither of you can auto the other for free.'
      :rangeEdge==='YOU'
        ?`You reach ${rangeGap} units further. Any auto you land at your maximum range costs them a walk to answer.`
        :`They reach ${-rangeGap} units further. Standing still in lane hands them free damage.`,
  });
  if(rangeEdge==='THEM')
    howToPlayIt.push(`Do not trade autos at their range. Close the ${-rangeGap}-unit gap with an ability or a minion wave, or do not take the trade.`);
  if(rangeEdge==='YOU')
    howToPlayIt.push(`Your ${rangeGap}-unit reach advantage only exists if you hold spacing. Auto and step back rather than committing.`);

  /* --- durability, measured against the damage type actually facing you - */
  const myEhp=vs(mine,theirDamage);
  const theirEhp=vs(theirs,myDamage);
  const ehpEdge=gapEdge(myEhp,theirEhp,MIN_STAT_GAP_PCT);
  facts.push({
    key:'effectiveHp',label:`Effective HP at level ${level}`,
    you:`${Math.round(myEhp)} vs ${describe(theirDamage)}`,
    them:`${Math.round(theirEhp)} vs ${describe(myDamage)}`,
    edge:ehpEdge,
    note:ehpEdge==='EVEN'
      ?'Neither of you survives a committed all-in noticeably better than the other.'
      :ehpEdge==='YOU'
        ?`You take ${pct(myEhp,theirEhp)}% more of their damage before dying than they take of yours.`
        :`They take ${pct(theirEhp,myEhp)}% more of your damage before dying than you take of theirs.`,
  });

  /* --- attack damage at the same level --------------------------------- */
  const adEdge=gapEdge(mine.attackDamage,theirs.attackDamage,MIN_STAT_GAP_PCT);
  facts.push({
    key:'attackDamage',label:`Attack damage at level ${level}`,
    you:`${mine.attackDamage}`,them:`${theirs.attackDamage}`,
    edge:adEdge,
    note:adEdge==='EVEN'?undefined
      :adEdge==='YOU'?'Your autos hit harder before either of you buys anything.'
        :'Their autos hit harder before either of you buys anything.',
  });

  /* --- move speed: who decides whether a fight happens ------------------ */
  const msGap=mine.moveSpeed-theirs.moveSpeed;
  const msEdge:Edge=Math.abs(msGap)<MIN_MOVE_SPEED_GAP?'EVEN':msGap>0?'YOU':'THEM';
  if(msEdge!=='EVEN')
    facts.push({
      key:'moveSpeed',label:'Base move speed',
      you:`${mine.moveSpeed}`,them:`${theirs.moveSpeed}`,edge:msEdge,
      note:msEdge==='YOU'
        ?`You are ${msGap} faster with no items, so disengaging is your choice to make.`
        :`They are ${-msGap} faster with no items, so they choose whether a fight happens.`,
    });

  /* --- ultimates: the all-in windows, both directions ------------------- */
  const myUlt=ultRank1(you);
  const theirUlt=ultRank1(them);
  if(myUlt&&theirUlt){
    // Only a real cooldown is a window. Telling someone to wait out Elise's
    // Spider Form or Teemo's traps is advice that cannot be followed.
    const edge=theirUlt.trackable&&myUlt.trackable
      ?gapEdge(theirUlt.cd,myUlt.cd,MIN_STAT_GAP_PCT):'EVEN';
    facts.push({
      key:'ultimate',label:'Ultimate cooldown (rank 1)',
      you:myUlt.trackable?`${myUlt.name} · ${myUlt.cd}s`:`${myUlt.name} · always up`,
      them:theirUlt.trackable?`${theirUlt.name} · ${theirUlt.cd}s`:`${theirUlt.name} · always up`,
      edge,
      note:theirUlt.trackable
        ?`After they use ${theirUlt.name} they are without it for ${theirUlt.cd}s. That is the window where this lane is at its most even.`
        :`${theirUlt.name} is a stance or charge ability rather than a cooldown, so there is no window to wait for. Plan around their abilities instead.`,
    });
    if(theirUlt.trackable)
      howToPlayIt.push(`Track ${theirUlt.name}. The ${theirUlt.cd}s after they use it is the most reliable all-in window this matchup gives you.`);
  }else if(theirUlt){
    facts.push({
      key:'ultimate',label:'Ultimate cooldown (rank 1)',
      you:'—',them:`${theirUlt.name} · ${theirUlt.trackable?`${theirUlt.cd}s`:'always up'}`,
      edge:'THEM',
    });
  }

  /* --- scaling, when the full roster is available ----------------------- */
  const unavailable:string[]=[];
  if(opts.roster){
    const mineScale=scalingFor(opts.roster,you.id);
    const theirScale=scalingFor(opts.roster,them.id);
    const line=scalingLine(you.name,them.name,mineScale,theirScale);
    if(line)howToPlayIt.push(line);
  }else{
    unavailable.push('Scaling comparison (needs the full champion list).');
  }
  unavailable.push('Win rate for this matchup — that needs a large sample of real games, which this does not have.');

  if(rangeClass(mine.attackRange)==='MELEE'&&rangeClass(theirs.attackRange)==='MELEE')
    howToPlayIt.push('Both of you are melee, so nobody gets free damage. Whoever commits first with the wave on their side usually wins the trade.');

  return {
    you:{id:you.id,name:you.name},
    them:{id:them.id,name:them.name},
    level,facts,howToPlayIt,
    riotSaysAboutThem:them.enemytips??[],
    caveat:CAVEAT,
    unavailable,
  };
}

/* ------------------------------------------------------------- helpers -- */

const vs=(s:ReturnType<typeof statsAtLevel>,incoming:DamageType)=>
  incoming==='MAGIC'?s.effectiveHpVsMagic
    :incoming==='PHYSICAL'?s.effectiveHpVsPhysical
      :(s.effectiveHpVsPhysical+s.effectiveHpVsMagic)/2;

const describe=(d:DamageType)=>
  d==='MAGIC'?'magic damage':d==='PHYSICAL'?'physical damage':'mixed damage';

function gapEdge(mine:number,theirs:number,minPct:number):Edge{
  if(theirs<=0||mine<=0)return 'EVEN';
  const diff=Math.abs(mine-theirs)/Math.min(mine,theirs)*100;
  if(diff<minPct)return 'EVEN';
  return mine>theirs?'YOU':'THEM';
}

const pct=(a:number,b:number)=>Math.round((a/b-1)*100);

function ultRank1(c:ChampionDetail):{name:string;cd:number;trackable:boolean}|null{
  const ult=(c.spells??[])[3];
  if(!ult||!ult.cooldown||!ult.cooldown.length)return null;
  return {name:ult.name,cd:ult.cooldown[0],trackable:isTrackableUltimate(ult)};
}

/**
 * Only speaks when the two champions actually pull in opposite directions.
 * "Both scale" is true of most of the roster and tells a player nothing.
 */
function scalingLine(
  myName:string,theirName:string,mine:ScalingRead[],theirs:ScalingRead[],
):string|null{
  const read=(rs:ScalingRead[])=>rs.find(r=>r.stat==='EFFECTIVE_HP');
  const a=read(mine);const b=read(theirs);
  if(!a||!b)return null;
  if(a.verdict===b.verdict)return null;
  if(a.verdict==='SCALING'&&b.verdict==='EARLY_GAME')
    return `${theirName} is at their strongest relative to the roster early, ${myName} later. Surviving the first ten minutes even is a win for you.`;
  if(a.verdict==='EARLY_GAME'&&b.verdict==='SCALING')
    return `${myName} is at their strongest relative to the roster early, ${theirName} later. If you have not converted a lead by mid-game, this gets harder, not easier.`;
  return null;
}
