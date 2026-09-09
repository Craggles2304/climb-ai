'use client';
import {useEffect,useState,useCallback} from 'react';
import {LiveGameRead} from '@/lib/riot/liveGame';
import {ILPTask} from '@/lib/types';
import {track} from '@/lib/analytics';

/**
 * "You are in a game right now — here is your one rule."
 *
 * This is the closest the web app can get to reaching the player at the moment
 * the behaviour actually happens, without an overlay. It is deliberately one
 * rule and nothing else: a player glancing at a second monitor at minute 16 can
 * read one line, not a dashboard.
 *
 * It never shows live in-game state (CS, gold, deaths). Riot's spectator data
 * does not contain it, and pretending otherwise would be a lie.
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
          <div className="eyebrow">YOUR ONE RULE</div>
          <h2 className="livegame-rule">{task.gameRule}</h2>
          <p className="livegame-pass">Counts as a pass: {task.target}</p>
        </>
      : <h2 className="livegame-rule">No active behaviour yet — analyse a game to get one.</h2>}

    <p className="livegame-phase">{game.phaseNote}</p>

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
