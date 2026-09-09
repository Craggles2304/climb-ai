'use client';
import {TiltRead} from '@/lib/tilt';
import {TrackView} from './TrackView';

/**
 * The stop-playing banner.
 *
 * Shown above everything else when it fires, because a farm tip is worthless
 * advice to give someone who should not be queuing. On a FINE read it renders a
 * single quiet line rather than nothing, so the player learns the app is
 * watching the session and the silence means something.
 */
export function TiltBanner({read,results}:{read:TiltRead;results:('WIN'|'LOSS')[]}){
  if(read.status==='FINE'&&read.gamesThisSession===0)return null;

  const tone=read.status==='STOP'?'stop':read.status==='WATCH'?'watch':'fine';

  return <section className={`glass tilt tilt-${tone}`} role={read.status==='STOP'?'alert':undefined}>
    {read.status!=='FINE'&&<TrackView event="dashboard_view" props={{tilt:read.status,streak:read.streak}}/>}
    <div className="tilt-head">
      <div className="eyebrow">SESSION CHECK</div>
      {results.length>0&&<div className="tilt-strip" aria-label={`This session: ${results.join(', ')}`}>
        {results.map((r,i)=><i key={i} className={r==='WIN'?'w':'l'} title={r}/>)}
      </div>}
    </div>

    <h2 className="tilt-headline">{read.headline}</h2>

    <ul className="tilt-evidence">
      {read.evidence.map(e=><li key={e}>{e}</li>)}
    </ul>

    {read.status==='STOP'&&<p className="tilt-note">
      Nothing below this is worth reading until tomorrow. Your plan will still be here.
    </p>}
  </section>;
}
