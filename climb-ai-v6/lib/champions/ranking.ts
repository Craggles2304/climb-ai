import {
  ChampionListEntry,DamageType,damageType,statsAtLevel,
} from './ddragon';

/**
 * Ranking every matchup for one champion: hardest, easiest, and the reason for
 * each. This is the "who beats who" page.
 *
 * READ THIS BEFORE TRUSTING A NUMBER HERE.
 *
 * This is a STAT advantage score, not a win rate, and the difference is not
 * pedantic. It compares published numbers — attack range, effective health
 * against the damage type facing you, attack damage, move speed. It cannot see
 * ability kits, crowd control, dashes, shields, sustain, wave clear, or
 * ability damage (Riot no longer publishes ability coefficients at all).
 *
 * So it will be wrong about matchups that are decided by a kit rather than by
 * a stat line, and there are many of those. It is offered because the stat
 * line genuinely does decide a lot of lanes — a 475-unit range gap is not an
 * opinion — and because every score here opens into the exact facts that
 * produced it. Nothing is a black box, and `blindSpots` travels with the
 * result so the limits arrive at the same time as the ranking.
 *
 * A win rate would need a large population of real games. When this app has
 * that, it belongs here alongside this, not instead of it: the stat line
 * explains WHY, which a win rate never does.
 */

export type Edge='YOU'|'THEM'|'EVEN';

/** How much each measured difference moves the score, out of 100. */
export const WEIGHTS={
  attackRange:40,
  effectiveHp:25,
  attackDamage:15,
  moveSpeed:10,
  attackSpeed:10,
} as const;

/**
 * The gap at which a difference counts for full weight. Beyond this, more is
 * not meaningfully worse — a 900-unit range gap plays the same as a 400 one.
 */
export const SATURATION={
  attackRange:300,
  effectiveHp:0.40,
  attackDamage:0.30,
  moveSpeed:45,
  attackSpeed:0.35,
} as const;

/** Below this the two champions are called even rather than ranked apart. */
export const EVEN_BAND=6;

export interface Contribution{
  key:keyof typeof WEIGHTS;
  label:string;
  you:string;
  them:string;
  /** Signed: positive favours you. */
  points:number;
  edge:Edge;
  note:string;
}

export interface MatchupScore{
  opponentId:string;
  opponentName:string;
  opponentTags:string[];
  /** -100 (worst) to +100 (best), from the stat line only. */
  score:number;
  edge:Edge;
  contributions:Contribution[];
}

export interface MatchupRanking{
  championId:string;
  championName:string;
  level:number;
  all:MatchupScore[];
  /** Best stat matchups first. */
  strongest:MatchupScore[];
  /** Worst stat matchups first. */
  weakest:MatchupScore[];
  spread:{best:number;worst:number;favourable:number;unfavourable:number;even:number};
  /**
   * What the two ends of this particular ranking actually mean. Adapts,
   * because for some champions neither end is a losing matchup.
   */
  summary:string;
  blindSpots:string[];
}

export const BLIND_SPOTS=[
  'Ability damage — Riot stopped publishing ability coefficients, so none of it is counted.',
  'Crowd control, dashes, shields and untargetability.',
  'Sustain, wave clear and how the matchup plays once items arrive.',
  'Who actually wins these games — that needs a large sample of real matches.',
];

export interface RankOptions{
  level?:number;
  topN?:number;
  /**
   * Restrict opponents to champions carrying one of these Riot tags. The full
   * roster includes champions you would never actually lane against, so this
   * exists to narrow it without inventing a role model Riot does not publish.
   */
  tags?:string[];
}

export function rankMatchups(
  roster:Record<string,ChampionListEntry>,
  championId:string,
  opts:RankOptions={},
):MatchupRanking|null{
  const me=roster[championId];
  if(!me)return null;
  const level=opts.level??6;
  const topN=opts.topN??8;
  const tags=opts.tags?.length?opts.tags:null;

  const all=Object.values(roster)
    .filter(other=>other.id!==championId)
    .filter(other=>!tags||other.tags.some(t=>tags.includes(t)))
    .map(other=>scoreMatchup(me,other,level))
    .sort((a,b)=>b.score-a.score);

  const favourable=all.filter(m=>m.edge==='YOU').length;
  const unfavourable=all.filter(m=>m.edge==='THEM').length;
  const even=all.length-favourable-unfavourable;
  const best=all.length?all[0].score:0;
  const worst=all.length?all[all.length-1].score:0;

  return {
    championId:me.id,
    championName:me.name,
    level,
    all,
    strongest:all.slice(0,topN),
    weakest:[...all].reverse().slice(0,topN),
    spread:{best,worst,favourable,unfavourable,even},
    summary:summarise(me.name,all.length,worst,unfavourable,even),
    blindSpots:[...BLIND_SPOTS],
  };
}

/**
 * Caitlyn's worst stat matchup scores +8: with the longest attack range in the
 * game she is never behind on the stat line, so labelling that end "weakest"
 * would tell a player she loses a lane she does not. The wording has to follow
 * the data instead of assuming the ranking straddles zero.
 */
function summarise(
  name:string,total:number,worst:number,unfavourable:number,even:number,
):string{
  if(total===0)return 'No opponents matched that filter.';
  if(unfavourable===0&&even===0)
    return `On the stat line alone, ${name} is ahead of every champion here — the lowest score is ${worst >= 0 ? '+' : ''}${worst}. So the bottom of this list is ${name}'s smallest advantage, not a losing matchup. What actually beats ${name} is a kit, and a kit is exactly what these numbers cannot see.`;
  if(unfavourable===0)
    return `${name} is never behind on the stat line here: ${even} matchup${even===1?' is':'s are'} level and the rest favour ${name}. The bottom of this list is the smallest edge, not a losing lane — what beats ${name} is a kit, which these numbers cannot see.`;
  return `${unfavourable} of ${total} matchups are against ${name} on the stat line, ${even} are level. Bear in mind this reads stats only — a kit can turn any of them around.`;
}

export function scoreMatchup(
  me:ChampionListEntry,them:ChampionListEntry,level:number,
):MatchupScore{
  const mine=statsAtLevel(me.stats,level);
  const theirs=statsAtLevel(them.stats,level);
  const myDamage=damageType(me.info);
  const theirDamage=damageType(them.info);

  const contributions:Contribution[]=[];

  contributions.push(build(
    'attackRange','Attack range',
    mine.attackRange,theirs.attackRange,
    `${mine.attackRange}`,`${theirs.attackRange}`,
    gap=>gap>0
      ?`You out-range them by ${Math.round(gap)} units.`
      :`They out-range you by ${Math.round(-gap)} units.`,
    'Neither of you can auto the other for free.',
  ));

  // Durability is only meaningful against the damage actually coming at you.
  const myEhp=versus(mine,theirDamage);
  const theirEhp=versus(theirs,myDamage);
  contributions.push(buildRatio(
    'effectiveHp',`Effective HP at level ${level}`,
    myEhp,theirEhp,
    `${Math.round(myEhp)}`,`${Math.round(theirEhp)}`,
    pct=>pct>0
      ?`You survive ${Math.round(pct*100)}% more of their damage.`
      :`They survive ${Math.round(-pct*100)}% more of yours.`,
    'Neither of you is meaningfully tankier against the other.',
  ));

  contributions.push(buildRatio(
    'attackDamage',`Attack damage at level ${level}`,
    mine.attackDamage,theirs.attackDamage,
    `${mine.attackDamage}`,`${theirs.attackDamage}`,
    pct=>pct>0?`Your autos hit ${Math.round(pct*100)}% harder.`
      :`Their autos hit ${Math.round(-pct*100)}% harder.`,
    'Auto-attack damage is level.',
  ));

  contributions.push(buildRatio(
    'attackSpeed',`Attack speed at level ${level}`,
    mine.attackSpeed,theirs.attackSpeed,
    mine.attackSpeed.toFixed(2),theirs.attackSpeed.toFixed(2),
    pct=>pct>0?`You attack ${Math.round(pct*100)}% faster.`
      :`They attack ${Math.round(-pct*100)}% faster.`,
    'You trade autos at the same rate.',
  ));

  contributions.push(build(
    'moveSpeed','Base move speed',
    mine.moveSpeed,theirs.moveSpeed,
    `${mine.moveSpeed}`,`${theirs.moveSpeed}`,
    gap=>gap>0
      ?`You are ${Math.round(gap)} faster, so disengaging is your choice.`
      :`They are ${Math.round(-gap)} faster, so they choose whether a fight happens.`,
    'Neither of you can walk away from the other.',
  ));

  const score=Math.round(contributions.reduce((sum,c)=>sum+c.points,0));
  return {
    opponentId:them.id,opponentName:them.name,opponentTags:them.tags,
    score,
    edge:score>=EVEN_BAND?'YOU':score<=-EVEN_BAND?'THEM':'EVEN',
    contributions,
  };
}

/* ---------------------------------------------------------------- maths -- */

/** Absolute-difference stats: range and move speed. */
function build(
  key:keyof typeof WEIGHTS,label:string,
  mine:number,theirs:number,
  youText:string,themText:string,
  describe:(gap:number)=>string,
  evenText:string,
):Contribution{
  const gap=mine-theirs;
  const ratio=clamp(gap/SATURATION[key],-1,1);
  return finish(key,label,youText,themText,ratio,gap===0?evenText:describe(gap),evenText);
}

/** Proportional stats, where a 10% edge means the same at any absolute size. */
function buildRatio(
  key:keyof typeof WEIGHTS,label:string,
  mine:number,theirs:number,
  youText:string,themText:string,
  describe:(pct:number)=>string,
  evenText:string,
):Contribution{
  const denominator=Math.min(mine,theirs);
  const pct=denominator>0?(mine-theirs)/denominator:0;
  const ratio=clamp(pct/SATURATION[key],-1,1);
  return finish(key,label,youText,themText,ratio,pct===0?evenText:describe(pct),evenText);
}

function finish(
  key:keyof typeof WEIGHTS,label:string,
  you:string,them:string,ratio:number,note:string,evenText:string,
):Contribution{
  const points=Number((WEIGHTS[key]*ratio).toFixed(1));
  // A contribution worth under a point is noise; call it even and say so,
  // rather than showing a decimal that implies a real difference.
  const edge:Edge=Math.abs(points)<1?'EVEN':points>0?'YOU':'THEM';
  return {key,label,you,them,points,edge,note:edge==='EVEN'?evenText:note};
}

const versus=(s:ReturnType<typeof statsAtLevel>,incoming:DamageType)=>
  incoming==='MAGIC'?s.effectiveHpVsMagic
    :incoming==='PHYSICAL'?s.effectiveHpVsPhysical
      :(s.effectiveHpVsPhysical+s.effectiveHpVsMagic)/2;

const clamp=(n:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,n));
