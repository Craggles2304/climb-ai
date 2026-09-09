import {ILPTask,IssueCategory,Role} from './types';

/**
 * The onboarded player.
 *
 * Before this existed, onboarding collected seven screens of answers and threw
 * all of them away — a new player then landed on the demo account's dashboard
 * and looked at a stranger's games. This turns those answers into a real (empty)
 * account and a first plan, so the first session has something honest in it.
 *
 * The plan generated here is explicitly a *hypothesis*. It is what the player
 * told us, not what their matches show, and every surface says so until real
 * evidence replaces it.
 */

export interface PlayerProfile{
  id:string;
  gameName:string;
  tagline:string;
  region:string;
  role:Role;
  rank:string;
  champions:string[];
  frustration:string;
  createdAt:string;
}

export const PROFILE_KEY='op_profile';
/** Fired when the profile changes, so mounted providers can re-read it. */
export const PROFILE_EVENT='op:profile-changed';
/** The synthetic account id an onboarded player gets before auth exists. */
export const PROFILE_ACCOUNT_ID='acct-you';

/* ---------- frustration → starting behaviour ---------- */

interface Seed{
  category:IssueCategory;
  metric:string;
  title:string;
  why:string;
  gameRule:string;
  target:string;
}

/**
 * Maps what the player says frustrates them onto one measurable starting
 * behaviour. Chosen so the first plan is testable from match data alone — a
 * hypothesis the evidence can overturn, which is the whole point of asking.
 */
const SEEDS:Record<string,Seed>={
  'I die too much':{
    category:'POSITIONING',metric:'deathsPost20',
    title:'Cut your post-20 deaths',
    why:'You told us deaths are the problem. Late deaths are the ones that cost objectives, so that is where we will look first.',
    gameRule:'Before a major fight, name the enemy who can reach you, and do not step forward until it is committed or covered.',
    target:'2 or fewer post-20 deaths in 3 of 5 games',
  },
  'My CS is poor':{
    category:'RESOURCE_COLLECTION',metric:'post15CsPerMin',
    title:'Hold 6.0+ post-15 CS/min',
    why:'You told us farm is the problem. Lane farm is usually fine; the drop almost always happens after lane, so that is what we will measure.',
    gameRule:'After every recall past 15:00, pick your next wave before you move, and do not default mid.',
    target:'6.0+ post-15 CS/min across 3 relevant games',
  },
  'I win lane but lose games':{
    category:'TEMPO',metric:'post15CsPerMin',
    title:'Convert your lane lead into map value',
    why:'Winning lane and losing the game usually means the lead stops compounding once lane ends. Post-lane resource access is the cleanest measure of that.',
    gameRule:'At 90 seconds before an objective, decide your final wave and your route. Do not decide at 20 seconds.',
    target:'6.0+ post-15 CS/min across 3 relevant games',
  },
  'I struggle with positioning':{
    category:'POSITIONING',metric:'deathsPost20',
    title:'Survive the first threat cycle',
    why:'Positioning is hard to measure directly, but late deaths are a reliable shadow of it and they are visible in every match.',
    gameRule:'Enter fights through your frontline, not the shortest path to damage.',
    target:'2 or fewer post-20 deaths in 3 of 5 games',
  },
  'I do not know what to do after lane':{
    category:'RESOURCE_COLLECTION',metric:'post15CsPerMin',
    title:'Make your post-lane move deliberate',
    why:'You told us the game gets unclear after lane. The measurable version of that is whether you keep collecting gold once the map opens up.',
    gameRule:'Every recall after 15:00: check the objective timer, then the safest wave, then decide whether to group.',
    target:'6.0+ post-15 CS/min across 3 relevant games',
  },
  'I struggle in teamfights':{
    category:'TEAMFIGHTING',metric:'deathsPost20',
    title:'Stay alive through the first engage',
    why:'Teamfight execution needs clip review to judge properly, but staying alive through the opening is measurable from match data today.',
    gameRule:'Hold position until the enemy engage tool is spent, then commit.',
    target:'2 or fewer post-20 deaths in 3 of 5 games',
  },
  'I do not know why I am losing':{
    category:'CONSISTENCY',metric:'post15CsPerMin',
    title:'Establish a baseline we can read',
    why:'You do not have a diagnosis yet, and neither do we. We will start with the leak most common at your rank and let your matches confirm or replace it.',
    gameRule:'Every recall after 15:00: check the objective timer, then the safest wave, then decide whether to group.',
    target:'6.0+ post-15 CS/min across 3 relevant games',
  },
};

const FALLBACK=SEEDS['I do not know why I am losing'];

export function seedFor(frustration:string):Seed{
  return SEEDS[frustration]??FALLBACK;
}

/**
 * The first plan. One task, not five — five behaviours from zero evidence would
 * be five guesses, and the product's whole discipline is one thing at a time.
 */
export function firstPlan(profile:PlayerProfile):ILPTask[]{
  const seed=seedFor(profile.frustration);
  return [{
    id:'ilp-first',
    accountId:profile.id,
    title:seed.title,
    category:seed.category,
    why:seed.why,
    gameRule:seed.gameRule,
    metric:seed.metric,
    target:seed.target,
    progress:0,
    status:'ACTIVE',
    source:'SYSTEM',
    evidence:['Starting hypothesis from onboarding — no match evidence yet.'],
    priority:80,
    successfulGames:0,
    gamesObserved:0,
    masteryRequired:3,
    lastUpdatedReason:'Created from what you told us. Your first analysed match can overturn it.',
  }];
}

/* ---------- storage (pre-auth) ---------- */

export function loadProfile():PlayerProfile|null{
  if(typeof window==='undefined')return null;
  try{
    const raw=window.localStorage.getItem(PROFILE_KEY);
    return raw?JSON.parse(raw) as PlayerProfile:null;
  }catch{return null}
}

export function saveProfile(p:Omit<PlayerProfile,'id'|'createdAt'>):PlayerProfile{
  const profile:PlayerProfile={...p,id:PROFILE_ACCOUNT_ID,createdAt:new Date().toISOString()};
  try{window.localStorage.setItem(PROFILE_KEY,JSON.stringify(profile))}catch{/* private mode */}
  window.dispatchEvent(new CustomEvent(PROFILE_EVENT));
  return profile;
}
