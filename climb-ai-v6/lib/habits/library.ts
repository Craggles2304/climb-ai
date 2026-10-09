import {IssueCategory,Role} from '../types';

/**
 * The bad-habit library.
 *
 * Every habit is something that can be COUNTED in a single game from Riot data,
 * so every habit is measured the same way: how often it happens, and whether that
 * is going down. No habit depends on a target number a player might never reach.
 *
 * Adding a habit = adding an entry here + a detector in detect.ts + a test.
 */

export type HabitId=
  |'deathWithGold'
  |'hoardingGold'
  |'deathBeforeObjective'
  |'backToBackDeaths'
  |'deepDeath'
  |'soloDeath'
  |'earlyDeaths'
  |'noControlWard'
  |'lateFarmDrop';

export interface HabitDef{
  id:HabitId;
  name:string;
  /** One line a player understands without League jargon beyond the basics. */
  description:string;
  /** Why it loses games. */
  why:string;
  /** The in-game rule that breaks it. */
  rule:string;
  category:IssueCategory;
  /** A game "has" the habit when its count reaches this. */
  occursAt:number;
  /** What one unit of the count is, for "3 deaths", "1 game". */
  unit:string;
  /** Roles this habit is judged for. Missing = every role. */
  roles?:Role[];
  /** Where the evidence comes from, shown to the player so nothing is a black box. */
  source:string;
  /** Honest caveat shown next to the number, when there is one. */
  caveat?:string;
}

const NOT_SUPPORT:Role[]=['TOP','JUNGLE','MID','ADC'];

export const HABITS:Record<HabitId,HabitDef>={
  deathWithGold:{
    id:'deathWithGold',name:'Dying with unspent gold',
    description:'Dying while holding 1,200+ gold you could have turned into an item.',
    why:'Gold you die with is power you never used, and the death costs you the next wave too.',
    rule:'At 1,200+ gold, your next move is towards a recall window — not a new fight.',
    category:'RECALL_TIMING',occursAt:1,unit:'death',source:'Riot match timeline',
    caveat:'Read from minute-by-minute gold, so the true figure at death was this or higher.',
  },
  hoardingGold:{
    id:'hoardingGold',name:'Sitting on gold',
    description:'Holding 1,500+ gold for two minutes or more without spending it.',
    why:'Every minute an item sits in your wallet, your opponent is fighting with theirs.',
    rule:'When you cross 1,500 gold, plan your recall within the next wave.',
    category:'RECALL_TIMING',occursAt:1,unit:'time',source:'Riot match timeline',
  },
  deathBeforeObjective:{
    id:'deathBeforeObjective',name:'Dying before objectives',
    description:'Dying in the 90 seconds before the enemy takes a dragon, Baron, Herald or Grubs.',
    why:'Your death is what makes the objective free for them.',
    rule:'From 90 seconds before an objective, do not start a fight you cannot walk away from.',
    category:'OBJECTIVES',occursAt:1,unit:'death',source:'Riot match timeline',
  },
  backToBackDeaths:{
    id:'backToBackDeaths',name:'Back-to-back deaths',
    description:'Dying again within about a minute and a half of coming back from a death.',
    why:'The second death is almost always tilt or a rushed return — and it doubles the cost of the first.',
    rule:'After a death, your first job is getting back to the map safely, not getting it back.',
    category:'CONSISTENCY',occursAt:1,unit:'death',source:'Riot match timeline',
  },
  deepDeath:{
    id:'deepDeath',name:'Overextending',
    description:'Dying deep in the enemy half of the map before 25 minutes.',
    why:'Deep deaths happen where the enemy has vision and numbers and you have neither.',
    rule:'Past the river without vision, assume every missing enemy is coming for you.',
    category:'MAP_AWARENESS',occursAt:1,unit:'death',source:'Riot match timeline (death positions)',
    caveat:'Based on where the death happened. Sieges and dives you meant to take also count.',
  },
  soloDeath:{
    id:'soloDeath',name:'Solo deaths',
    description:'Being killed by a single enemy with no one else involved.',
    why:'A solo death is a duel you did not need to take, or a fight you did not see coming.',
    rule:'If you cannot see their jungler and you are not ahead, do not take the duel.',
    category:'POSITIONING',occursAt:1,unit:'death',source:'Riot match timeline',
  },
  earlyDeaths:{
    id:'earlyDeaths',name:'Throwing the lane early',
    description:'Dying two or more times before 10 minutes.',
    why:'Two early deaths usually decide the lane before it has really started.',
    rule:'Before 10 minutes, respect the enemy’s level spikes and the jungler’s likely side.',
    category:'LANING',occursAt:2,unit:'death',source:'Riot match timeline',
  },
  noControlWard:{
    id:'noControlWard',name:'No control wards',
    description:'Playing a 20+ minute game without buying a single control ward.',
    why:'One control ward is the cheapest vision in the game, and without it your side of the map is dark.',
    rule:'Buy a control ward on your first or second recall, every game.',
    category:'VISION',occursAt:1,unit:'game',source:'Riot match summary',
  },
  lateFarmDrop:{
    id:'lateFarmDrop',name:'Farm falls off after lane',
    description:'Your CS rate after 15 minutes drops to under 80% of your lane rate.',
    why:'Most gold after lane is in the side waves; losing it slows every item after your first.',
    rule:'After each recall past 15:00, pick the next wave you can safely catch before you move.',
    category:'RESOURCE_COLLECTION',occursAt:1,unit:'game',roles:NOT_SUPPORT,source:'Riot match timeline',
  },
};

export const HABIT_IDS=Object.keys(HABITS) as HabitId[];

export const habitAppliesTo=(h:HabitDef,role:Role)=>!h.roles||h.roles.includes(role);
