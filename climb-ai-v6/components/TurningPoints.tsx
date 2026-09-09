'use client';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {turningPoints,type KeyMoment} from '@/lib/riot/keyMoments';

/**
 * Where this specific game turned, read from Riot's match timeline.
 *
 * The rest of the review page answers "what was wrong with how you played".
 * This answers "at what minute", which is the part a player can actually go
 * and watch back. Every row carries a real timestamp from the timeline.
 *
 * Moments only exist on matches synced from Riot with a timeline attached, so
 * this renders nothing at all rather than inventing a narrative for demo or
 * manually uploaded games.
 */

function MomentRow({m}:{m:KeyMoment}){
  return <div className="spike">
    <div className="spike-level">{m.clock}</div>
    <div>
      <p className="spike-fact">{m.text}</p>
      {m.cost&&<p style={{color:'var(--danger)'}}>↳ {m.cost}</p>}
    </div>
  </div>;
}

export function TurningPoints({matchId}:{matchId:string}){
  const {active}=useAccount();
  const match=matchesFor(active.id).find(m=>m.id===matchId);
  const moments=match?.moments??[];
  if(moments.length===0)return null;

  const top=turningPoints(moments);

  return <>
    {top.length>0&&
      <div className="glass card" style={{marginTop:18}}>
        <div className="eyebrow">WHERE THIS GAME TURNED</div>
        <h2>{top.length} moment{top.length===1?'':'s'} worth watching back</h2>
        <p className="muted">
          Read from the match timeline. Each clock is a real timestamp — open the replay and go there.
        </p>
        <div className="spike-list">{top.map(m=><MomentRow key={`${m.atMs}-${m.type}`} m={m}/>)}</div>
      </div>}

    <div className="glass card" style={{marginTop:18}}>
      <div className="eyebrow">FULL TIMELINE</div>
      <div className="spike-list">
        {moments.map(m=><MomentRow key={`${m.atMs}-${m.type}-${m.text}`} m={m}/>)}
      </div>
    </div>
  </>;
}
