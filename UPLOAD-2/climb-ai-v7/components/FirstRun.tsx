'use client';
import Link from 'next/link';
import {ILPTask} from '@/lib/types';
import {AnimatedBar} from './Motion';

/**
 * What an onboarded player sees before they have a single match.
 *
 * The rule this follows: an empty account must still look finished. It shows the
 * hypothesis that came out of onboarding, states plainly that it is a guess, and
 * gives exactly one thing to do next. It never renders a zero as though it were
 * a measurement.
 */
export function FirstRun({task,gameName}:{task:ILPTask|undefined;gameName:string}){
  return <section className="glass firstrun">
    <div className="eyebrow">START HERE</div>
    <h2 className="firstrun-headline">
      {gameName?`${gameName}, your plan is a guess until you upload a game.`:'Your plan is a guess until you upload a game.'}
    </h2>
    <p className="firstrun-body">
      Everything below came from what you told us in onboarding, not from your matches.
      One analysed game is enough to start replacing it with evidence — and to overturn it
      entirely if we picked the wrong leak.
    </p>

    {task&&<div className="firstrun-card">
      <div className="firstrun-top">
        <span className="v7-badge">HYPOTHESIS · NOT YET EVIDENCE</span>
      </div>
      <h3>{task.title}</h3>
      <div className="firstrun-grid">
        <div><span className="label">Why we picked it</span><p>{task.why}</p></div>
        <div><span className="label">Do this in game</span><p>{task.gameRule}</p></div>
        <div><span className="label">This counts as a pass</span><p>{task.target}</p></div>
      </div>
      <div className="firstrun-progress">
        <AnimatedBar value={0} delay={200}/>
        <span>0 OF 3 PASSES · NO GAMES YET</span>
      </div>
    </div>}

    <div className="hero-actions">
      <Link className="btn primary" href="/uploads">UPLOAD YOUR FIRST MATCH</Link>
      <Link className="btn secondary" href="/account">CONNECT RIOT SYNC</Link>
      <Link className="btn secondary" href="/dashboard?demo=1">SEE IT WITH DEMO DATA</Link>
    </div>
  </section>;
}

/** Compact version for secondary pages. */
export function EmptyAccountNote({what}:{what:string}){
  return <div className="glass firstrun-note">
    <div className="eyebrow">NOTHING TO SHOW YET</div>
    <p>{what}</p>
    <Link className="btn secondary" href="/uploads">UPLOAD A MATCH</Link>
  </div>;
}
