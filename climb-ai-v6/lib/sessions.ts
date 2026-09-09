import {Match} from './types';

/**
 * Session grouping.
 *
 * A "session" is a run of games played back to back. Almost everything about
 * tilt is a within-session property — three losses spread over a week is
 * variance, three losses in ninety minutes is a night that should have ended.
 */

/** Games further apart than this start a new session. */
export const SESSION_GAP_MS=2*60*60_000;

export interface Session{
  /** Newest game first, matching the rest of the app's ordering. */
  matches:Match[];
  startedAt:number;
  endedAt:number;
}

const time=(m:Match)=>new Date(m.createdAt).getTime();

/**
 * Splits matches into sessions. Input may be in any order; output is newest
 * session first, and newest match first within each session.
 */
export function groupSessions(matches:Match[],gapMs=SESSION_GAP_MS):Session[]{
  const usable=matches.filter(m=>Number.isFinite(time(m)));
  if(!usable.length)return [];

  const sorted=[...usable].sort((a,b)=>time(b)-time(a)); // newest first
  const sessions:Session[]=[];
  let current:Match[]=[sorted[0]];

  for(let i=1;i<sorted.length;i++){
    const gap=time(sorted[i-1])-time(sorted[i]);
    if(gap>gapMs){
      sessions.push(toSession(current));
      current=[sorted[i]];
    }else{
      current.push(sorted[i]);
    }
  }
  sessions.push(toSession(current));
  return sessions;
}

function toSession(matches:Match[]):Session{
  const times=matches.map(time);
  return {matches,startedAt:Math.min(...times),endedAt:Math.max(...times)};
}

/** The session still in progress, if the last game was recent enough. */
export function currentSession(matches:Match[],now=Date.now(),gapMs=SESSION_GAP_MS):Session|null{
  const [latest]=groupSessions(matches,gapMs);
  if(!latest)return null;
  return now-latest.endedAt<=gapMs?latest:null;
}

/** Consecutive losses at the end of a session, counted backwards from the newest. */
export function lossStreak(session:Session|null):number{
  if(!session)return 0;
  let n=0;
  for(const m of session.matches){
    if(m.result!=='LOSS')break;
    n++;
  }
  return n;
}
