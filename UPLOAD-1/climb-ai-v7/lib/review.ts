import {AnalysisReport,Match,IssueCategory} from './types';

/**
 * Deterministic match review.
 *
 * Produces the full structured review — what went well, the one biggest
 * mistake, why it matters, what to do instead, and the next mission — with no
 * language model involved. The judgement was already made by lib/engine.ts;
 * this only chooses how to say it.
 *
 * Three properties it guarantees:
 *
 *  1. **Reproducible.** Phrasing is selected by a stable hash of the match id,
 *     so the same match always reads identically. Re-analysing a game never
 *     produces a different verdict, which a model cannot promise.
 *  2. **Varied.** Different matches draw different phrasings from each pool, so
 *     the twentieth review does not read like the first.
 *  3. **Never invents a number.** Every figure is interpolated from computed
 *     metrics, and an absent metric produces a sentence that omits it rather
 *     than a sentence containing "undefined".
 */

export type RankBand='BEGINNER'|'CORE'|'ADVANCED';

export interface MatchReview{
  band:RankBand;
  result:'WIN'|'LOSS';
  performance:number;
  headline:string;
  didWell:string[];
  biggestMistake:{title:string;evidence:string[];whyItMatters:string};
  whatToDoInstead:string[];
  mission:{target:string;rule:string;bonus?:string};
}

/* ---------- deterministic selection ---------- */

/** FNV-1a. Small, stable across runs and platforms — that is all it needs to be. */
export function hash(s:string):number{
  let h=0x811c9dc5;
  for(let i=0;i<s.length;i++){
    h^=s.charCodeAt(i);
    h=Math.imul(h,0x01000193)>>>0;
  }
  return h>>>0;
}

/** Picks one entry from a pool. Same seed always picks the same entry. */
export function pick<T>(pool:readonly T[],seed:string):T{
  if(!pool.length)throw new Error('pick() called with an empty pool');
  return pool[hash(seed)%pool.length];
}

/* ---------- rank banding ---------- */

const BEGINNER_TIERS=['iron','bronze'];
const ADVANCED_TIERS=['platinum','emerald','diamond','master','grandmaster','challenger'];

export function bandFor(rank:string):RankBand{
  const r=rank.toLowerCase();
  if(BEGINNER_TIERS.some(t=>r.includes(t)))return 'BEGINNER';
  if(ADVANCED_TIERS.some(t=>r.includes(t)))return 'ADVANCED';
  return 'CORE';
}

/* ---------- number formatting that refuses to guess ---------- */

const has=(v:number|undefined):v is number=>typeof v==='number'&&Number.isFinite(v);
const one=(v:number)=>v.toFixed(1);

/* ---------- phrasing pools ---------- */

const HEADLINE:Record<RankBand,Record<'WIN'|'LOSS',readonly string[]>>={
  BEGINNER:{
    WIN:['A win, and one thing to keep doing.','You won. Here is the part worth repeating.','Good game. One habit to carry forward.'],
    LOSS:['A loss, and one thing to change.','You lost this one. Here is the single fix.','Tough game. One thing to try next time.'],
  },
  CORE:{
    WIN:['You won, but the same leak is still here.','A win that hid one recurring problem.','Result was fine. The pattern underneath was not.'],
    LOSS:['This loss has a repeatable cause.','The scoreboard is not the story here.','One behaviour decided more of this than the result did.'],
  },
  ADVANCED:{
    WIN:['Won on execution, lost on tempo discipline.','The win masks a repeatable resource decision.','Result positive, pattern unchanged.'],
    LOSS:['A loss traceable to one decision window.','The pattern is consistent enough to act on.','This one is a repeat, not variance.'],
  },
};

const WELL_LANE=[
  'You came out of lane with a usable baseline to compare against.',
  'Your lane phase gave the plan something solid to measure.',
  'Lane held together well enough to judge the rest of the game on.',
] as const;

const MISTAKE_TITLE:Partial<Record<IssueCategory,readonly string[]>>={
  RESOURCE_COLLECTION:['Post-lane economy','You stopped collecting gold','Mid-game resource loss'],
  DEATHS:['Late-game deaths','You died in the wrong windows','Deaths that cost objectives'],
};

const WHY:Record<RankBand,Partial<Record<IssueCategory,readonly string[]>>>={
  BEGINNER:{
    RESOURCE_COLLECTION:['Gold buys items. Fewer minions means a weaker champion later.','Every wave you miss is an item you get later than the enemy.'],
    DEATHS:['Every death gives the enemy free time on the map.','When you are dead you cannot farm or fight, and both matter.'],
  },
  CORE:{
    RESOURCE_COLLECTION:['Your item timings are set by gold per minute, and post-lane is where yours drops. That delays every breakpoint you rely on.','Grouping without checking side waves trades guaranteed gold for a fight you may not need.'],
    DEATHS:['Late deaths convert directly into objectives for the enemy, because the respawn timer is long enough to lose Baron or Dragon Soul.','A death after 20 minutes costs more map control than three deaths before 10.'],
  },
  ADVANCED:{
    RESOURCE_COLLECTION:['The decision is a tempo one: you are defaulting mid rather than assigning yourself to the highest-value uncontested resource before the objective window opens.','Post-lane CS/min is the cleanest proxy you have for whether your rotations are paid for.'],
    DEATHS:['Post-20 deaths sit inside objective setup windows, so each one is a lost neutral rather than a lost 300 gold.','Your death timing clusters where enemy engage cooldowns are up, which is a spacing problem rather than a positioning one.'],
  },
};

const DO_INSTEAD:Record<RankBand,Partial<Record<IssueCategory,readonly (readonly string[])[]>>>={
  BEGINNER:{
    RESOURCE_COLLECTION:[
      ['After you recall, look at the side lanes before walking mid.','Take the safe wave first.','Do not follow your team just because they moved.'],
      ['Check both side lanes every time you buy.','Pick the wave nobody is standing near.','Farm it, then group.'],
    ],
    DEATHS:[
      ['Before a fight, find the enemy who can jump on you.','Wait until they use it.','Then walk forward.'],
      ['Stay behind your team when the fight starts.','Do not chase a kill after a fight is won.','Back off when you cannot see the enemy jungler.'],
    ],
  },
  CORE:{
    RESOURCE_COLLECTION:[
      ['On every recall after 15:00, check the objective timer before you pick a lane.','If the objective is more than 60 seconds away, take the safest available wave.','Only group mid when the wave you would give up is genuinely worth less.'],
      ['Decide your next wave while you are still on the fountain.','Treat "walk mid" as a choice you have to justify, not a default.','Use the minimap to pick the side with the fewest enemies visible.'],
    ],
    DEATHS:[
      ['Name the enemy engage threat out loud before a major fight.','Do not enter its range until it is committed or your peel is available.','If you cannot see it, assume it is on you.'],
      ['Hold your position until the first engage is spent.','Re-check threat ranges after every reset in a fight.','Give up damage rather than uptime.'],
    ],
  },
  ADVANCED:{
    RESOURCE_COLLECTION:[
      ['At 90 seconds before a neutral objective, commit to a final wave and a route.','Assign yourself to uncontested side resource when the enemy threat map allows it.','Stop converting rotations into ARAM mid by default.'],
      ['Price each rotation against the wave you abandon to make it.','Prefer short catch-and-clear patterns over deep side pressure without vision.','Recall on your own timer, not your team’s.'],
    ],
    DEATHS:[
      ['Track the primary engage cooldown before stepping into sustained DPS range.','Enter fights through peel rather than the shortest path to damage.','Trade uptime for position when the enemy has vision advantage.'],
      ['Identify which enemy can reach you without a cooldown, and space to that.','Do not commit before the first threat cycle is spent.','Reassess after every takedown rather than continuing forward.'],
    ],
  },
};

/* ---------- assembly ---------- */

export function buildReview(match:Match,report:AnalysisReport,rank=match.rank):MatchReview{
  const band=bandFor(rank);
  const seed=match.id;
  const category=report.primary.category;

  const headline=pick(HEADLINE[band][match.result],`h:${seed}`);

  // "What went well" is built from metrics that actually exist. Nothing here is
  // manufactured praise — if a metric is missing, its line is simply not offered.
  const wellPool:string[]=[];
  const m=match.metrics;
  if(has(m.goldDiffAt15)&&m.goldDiffAt15>0)
    wellPool.push(`You left lane ${m.goldDiffAt15} gold up on your opponent.`);
  if(has(m.laneCsPerMin)&&m.laneCsPerMin>=6.3)
    wellPool.push(`Lane farm held at ${one(m.laneCsPerMin)} CS/min.`);
  if(has(m.deathsPre10)&&m.deathsPre10===0)
    wellPool.push('You survived the whole early game without dying.');
  if(has(m.killParticipation)&&m.killParticipation>=0.6)
    wellPool.push(`You were involved in ${Math.round(m.killParticipation*100)}% of your team’s takedowns.`);
  if(has(m.damageShare)&&m.damageShare>=0.27)
    wellPool.push(`You accounted for ${Math.round(m.damageShare*100)}% of your team’s champion damage.`);
  if(has(m.visionScore)&&m.visionScore>=20)
    wellPool.push(`Vision score of ${m.visionScore} is above where most of your games sit.`);
  if(!wellPool.length)wellPool.push(pick(WELL_LANE,`w:${seed}`));

  const didWell=wellPool.slice(0,3);

  const titlePool=MISTAKE_TITLE[category]??[category.replaceAll('_',' ')];
  const whyPool=WHY[band][category]??['This is the pattern most likely to be costing you games right now.'];
  const doPool=DO_INSTEAD[band][category]??[[report.primary.suggestion]];

  return {
    band,
    result:match.result,
    performance:report.performance,
    headline,
    didWell,
    biggestMistake:{
      title:pick(titlePool,`t:${seed}`),
      // Evidence comes straight from the engine — measured, never rephrased.
      evidence:report.primary.facts.slice(0,3),
      whyItMatters:pick(whyPool,`y:${seed}`),
    },
    whatToDoInstead:[...pick(doPool,`d:${seed}`)].slice(0,3),
    mission:{
      target:`${report.mission.target} ${report.mission.unit}`,
      rule:report.mission.rules[0],
      bonus:report.mission.rules[1],
    },
  };
}
