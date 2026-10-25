"use client";
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {matchesFor,useAccount} from '@/components/AccountContext';
export default function Uploads(){
  const {active,authenticated,hydrated}=useAccount();
  const matches=authenticated?matchesFor(active.id).slice(0,10):[];
  return <AppShell><PageHead title="Ranked recordings" subtitle="Solo/Duo 5v5 evidence, saved to your account."/>
    <section className="glass card"><div className="eyebrow">ONE CONNECTED CLIMB</div><h2>Play ranked. Review the recorded decisions.</h2><p className="muted">Companion 0.12.0 or newer records the queue and uploads your completed Solo/Duo game. Its match, review, DNA and mission evidence stay linked to this Riot account. Manual scoreboards and demo extractions do not award ranked progress.</p><div className="hero-actions"><Link className="btn primary" href="/live">CONNECT COMPANION →</Link><Link className="btn secondary" href="/download/windows">GET THE LATEST VERSION →</Link></div></section>
    <section className="glass card"><div className="eyebrow">{active.gameName} · RANKED SOLO/DUO</div><h2>Saved games</h2>{!hydrated?<p>Loading your account…</p>:!authenticated?<p>Sign in to see recordings saved to your account.</p>:!matches.length?<p className="muted">No queue-verified Solo/Duo games yet. Older recordings remain stored, but games with an unknown queue do not count towards ranked development.</p>:matches.map(match=><Link className="btn secondary" style={{display:'flex',justifyContent:'space-between',marginTop:10}} key={match.id} href={'/analyse/'+encodeURIComponent(match.id)}><span>{match.champion} · {match.role} · {match.result}</span><span>OPEN REVIEW →</span></Link>)}</section>
  </AppShell>;
}
