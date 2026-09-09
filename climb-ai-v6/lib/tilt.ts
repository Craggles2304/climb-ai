import {Match} from './types';
import {groupSessions,currentSession,lossStreak,Session} from './sessions';

/**
 * Tilt read — should this player keep queuing tonight?
 *
 * This is the one feature in the product that tells someone to use it less, and
 * that is exactly why it is worth building: it is the highest-value coaching act
 * in League and no competitor will ship it.
 *
 * It follows the same evidence discipline as everything else. The claim "your
 * later games are worse" is only made when this player's own history actually
 * shows it, with enough games on both sides to mean anything. Without that
 * evidence it reports the streak and nothing more, because a losing streak on
 * its own is not proof of decline — it might just be a hard queue.
 */

export type TiltStatus='FINE'|'WATCH'|'STOP';

export interface TiltRead{
  status:TiltStatus;
  /** Consecutive losses at the end of the live session. */
  streak:number;
  gamesThisSession:number;
  headline:string;
  evidence:string[];
  /** True when the late-session decline claim is backed by enough history. */
  declineMeasured:boolean;
  /** Extra deaths per game late in a session versus the first game. Null if unmeasured. */
  extraDeathsLate:number|null;
}

/** Games needed at each session position before the decline claim is allowed. */
export const MIN_PER_POSITION=5;
/** A session position of this or higher counts as "late". */
export const LATE_FROM=3;

/**
 * Compares this player's deaths in the first game of a session against their
 * deaths in the third-or-later games, across their whole history.
 */
export function lateSessionDecline(matches:Match[]):{extraDeaths:number|null;early:number;late:number}{
  const early:number[]=[];
  const late:number[]=[];
  for(const session of groupSessions(matches)){
    // Within a session the array is newest-first, so reverse for play order.
    const inOrder=[...session.matches].reverse();
    inOrder.forEach((m,i)=>{
      if(i===0)early.push(m.deaths);
      else if(i>=LATE_FROM-1)late.push(m.deaths);
    });
  }
  if(early.length<MIN_PER_POSITION||late.length<MIN_PER_POSITION){
    return {extraDeaths:null,early:early.length,late:late.length};
  }
  const avg=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
  return {extraDeaths:+(avg(late)-avg(early)).toFixed(1),early:early.length,late:late.length};
}

export function readTilt(matches:Match[],now=Date.now()):TiltRead{
  const session=currentSession(matches,now);
  const streak=lossStreak(session);
  const games=session?.matches.length??0;
  const decline=lateSessionDecline(matches);
  const declineMeasured=decline.extraDeaths!==null;
  const declining=declineMeasured&&(decline.extraDeaths as number)>=0.5;

  const evidence:string[]=[];
  if(session)evidence.push(`${games} ${games===1?'game':'games'} this session.`);
  if(streak>0)evidence.push(`${streak} straight ${streak===1?'loss':'losses'}.`);
  if(declineMeasured){
    const d=decline.extraDeaths as number;
    evidence.push(d>0
      ?`Across your history you average ${d} more deaths per game from the third game of a session onward.`
      :`Across your history your later-session games are not measurably worse.`);
  }else{
    evidence.push('Not enough session history yet to say whether your later games get worse.');
  }

  const status=decide(streak,games,declining);
  return {
    status,streak,gamesThisSession:games,
    headline:headlineFor(status,streak,games,declining,decline.extraDeaths),
    evidence,declineMeasured,extraDeathsLate:decline.extraDeaths,
  };
}

function decide(streak:number,games:number,declining:boolean):TiltStatus{
  if(streak>=3)return 'STOP';
  if(streak>=2&&declining)return 'STOP';
  if(streak>=2||games>=5)return 'WATCH';
  return 'FINE';
}

function headlineFor(
  status:TiltStatus,streak:number,games:number,declining:boolean,extra:number|null,
):string{
  if(status==='STOP'){
    if(declining&&extra)return `Stop for tonight. You are ${streak} down, and your games get ${extra} deaths worse from here.`;
    return `Stop for tonight. ${streak} straight losses is where your session stops paying.`;
  }
  if(status==='WATCH'){
    if(streak>=2)return 'Two down. Win the next one or call it — do not queue a fourth on tilt.';
    return `${games} games in. Take a break before the next queue.`;
  }
  return games?'Session looks fine. Queue up.':'No games this session yet.';
}

/** Exposed so a UI can style the whole session strip. */
export const sessionResults=(s:Session|null)=>
  s?[...s.matches].reverse().map(m=>m.result):[];
