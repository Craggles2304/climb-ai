'use client';
import {Match} from '@/lib/types';
import {HABITS,HabitId} from '@/lib/habits/library';
import {HABIT_COLOURS} from '@/lib/habits/colours';
import {clock} from '@/lib/habits/detect';
import {groupMoments,MomentGroup} from '@/lib/habits/moments';

/**
 * "Watch these moments" — the timestamps worth opening in League's replay viewer.
 * Several habits often land on the same death, so moments at the same second are
 * shown as one row with every habit it involved.
 */

/** The most useful sentence for a group: the one with the most detail. */
const lead=(g:MomentGroup)=>[...g.items].sort((a,b)=>b.d.length-a.d.length)[0].d;

export function ReplayMoments({match,focus}:{match:Match;focus?:HabitId[]}){
  const moments=match.habitMoments;
  if(!Array.isArray(moments)){
    return <section className="glass card replay">
      <div className="eyebrow">CAREER DNA · WATCH IT BACK</div>
      <h2>Watch these moments</h2>
      <p className="muted">This game was synced before moment tracking existed, so it has no timestamps to watch back. Games you sync from now on will.</p>
    </section>;
  }
  const groups=groupMoments(moments);
  if(!groups.length){
    return <section className="glass card replay">
      <div className="eyebrow">CAREER DNA · WATCH IT BACK</div>
      <h2>Watch these moments</h2>
      <p className="muted">None of your tracked habits happened at a specific moment in this game.</p>
    </section>;
  }
  const focusSet=new Set(focus||[]);
  return <section className="glass card replay">
    <div className="eyebrow">CAREER DNA · WATCH IT BACK</div>
      <h2>Watch these moments</h2>
    <p className="muted replay-how">
      Open League, go to your match history and download this game’s replay, then jump to each time below.
      Replays are only available while the game is on the current patch.
    </p>
    <ol className="replay-list">
      {groups.map(g=><li key={g.t} className={g.items.some(i=>focusSet.has(i.h))?'focus':''}>
        <time>{clock(g.t)}</time>
        <div>
          <b>{lead(g)}</b>
          <span className="replay-tags">{g.items.map(i=><em key={i.h} style={{'--habit':HABIT_COLOURS[i.h]} as React.CSSProperties}>{HABITS[i.h].name}</em>)}</span>
        </div>
      </li>)}
    </ol>
  </section>;
}
