'use client';
import {useEffect,useState,useCallback} from 'react';
import {LiveGameRead} from '@/lib/riot/liveGame';
import {ILPTask} from '@/lib/types';
import {track} from '@/lib/analytics';

/**
 * Tracking-only live status.
 *
 * OP CLIMB never turns current match state into tactical instructions. The
 * dashboard may confirm that a pre-game mission is being measured, but all
 * coaching judgement waits until the post-game review.
 */

interface Props{
  gameName:string;
  tagline:string;
  region:string;
  task:ILPTask|undefined;
}

export function LiveGameCard({gameName,tagline,region,task}:Props){
  const [game,setGame]=useState<LiveGameRead|null>(null);
  const [checked,setChecked]=useState(false);
  const [available,setAvailable]=useState(true);

  const check=useCallback(async()=>{
    try{
      const res=await fetch('/api/riot/live',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({gameName,tagline,region}),
      });
      if(res.status===503){setAvailable(false);return}
      if(!res.ok)return;
      const data=await res.json();
      setGame(data.game??null);
      if(data.inGame)track('dashboard_view',{live:true,phase:data.game?.phase});
    }catch{
      // A failed poll is not worth telling the player about.
    }finally{
      setChecked(true);
    }
  },[gameName,tagline,region]);

  useEffect(()=>{
    if(!gameName)return;
    void check();
    // One minute: often enough to catch a game, rare enough to be kind to the
    // shared Riot rate budget.
    const id=setInterval(()=>{void check()},60_000);
    return ()=>clearInterval(id);
  },[check,gameName]);

  // Nothing to say until we know, and nothing to say when they are not playing.
  if(!available||!checked||!game)return null;

  const tone=game.phase==='MID'?'now':game.phase==='LATE'?'late':'';

  return <section className={`glass livegame livegame-${tone}`} aria-live="polite">
    <div className="livegame-top">
      <span className="v7-badge engine">
        <i className="live-dot" aria-hidden="true"/>IN GAME · {game.clock}
      </span>
      <span className="v7-badge">{game.queue}</span>
      <span className="v7-badge">{game.me.championName}</span>
    </div>

    {task
      ? <>
          <div className="eyebrow">MISSION BEING TRACKED</div>
          <h2 className="livegame-rule">{task.title}</h2>
          <p className="livegame-pass">Target locked before the game: {task.target}</p>
        </>
      : <h2 className="livegame-rule">MATCH TRACKING ACTIVE</h2>}

    <p className="livegame-phase">Tracking only · coaching unlocks after the match.</p>

    {!game.isRankedSolo&&<p className="livegame-note">
      This is {game.queue}. Your plan is measured on ranked solo/duo, so this game will not
      count towards it either way.
    </p>}

    <div className="livegame-teams">
      <div>
        <span className="label">Your team</span>
        <p>{game.allies.map(a=>a.championName).join(' · ')||'—'}</p>
      </div>
      <div>
        <span className="label">Against</span>
        <p>{game.enemies.map(e=>e.championName).join(' · ')||'—'}</p>
      </div>
    </div>

    <p className="livegame-caveat">
      Riot only tells us who is in the game and how long it has been running. Your live CS,
      gold and deaths are not available here — those come from the match once it ends.
    </p>
  </section>;
}
