import {Match,Role} from '../types';
import {HabitCounts,habitsOf,isHabitRelevant} from '../habits/detect';

/**
 * Career memory: one small record per game, the unit the Career DNA is read from.
 *
 * Every synced ranked game lives in Supabase, so the career is simply the
 * account's matches reduced to what the DNA needs. Pure: same matches in,
 * same career out.
 */

export interface GameRecord{
  id:string;
  at:string;
  champion:string;
  role:Role;
  result:'WIN'|'LOSS';
  minutes:number;
  relevant:boolean;
  habits:HabitCounts;
}

export const MAX_CAREER_GAMES=1000;

export function recordFromMatch(m:Match):GameRecord{
  return {
    id:m.id,at:m.createdAt,champion:m.champion,role:m.role,result:m.result,
    minutes:Math.round(m.durationSeconds/6)/10,
    relevant:m.habitRelevant??isHabitRelevant(m.durationSeconds),
    habits:habitsOf(m),
  };
}

const byOldest=(a:GameRecord,b:GameRecord)=>Date.parse(a.at)-Date.parse(b.at);

/** Union by game id, oldest first. A newer reading of the same game wins. */
export function mergeRecords(...lists:GameRecord[][]):GameRecord[]{
  const map=new Map<string,GameRecord>();
  for(const list of lists)for(const r of list)if(r&&r.id)map.set(r.id,r);
  const all=[...map.values()].sort(byOldest);
  return all.slice(Math.max(0,all.length-MAX_CAREER_GAMES));
}

/**
 * The career for an account, oldest first. Games without a timeline still
 * count, but only for the habits their stored metrics can actually show.
 */
export function careerFor(matches:Match[]):GameRecord[]{
  return mergeRecords(matches.map(recordFromMatch));
}
