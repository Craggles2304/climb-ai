'use client';

import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';

const tools=[
  {
    title:'Progress',
    href:'/progress',
    kicker:'YOUR PERFORMANCE',
    copy:'Longer-term trends across your tracked games: deaths, farm, consistency and whether the habits you are working on are actually improving.',
    badge:'TRENDS',
  },
  {
    title:'Champion Statistics',
    href:'/champions',
    kicker:'YOUR CHAMPIONS',
    copy:'Tracked champion performance, recurring strengths, weak points and champion-specific coaching from your own games.',
    badge:'CHAMPIONS',
  },
  {
    title:'Matchup Assistant',
    href:'/matchups',
    kicker:'RIOT DATA',
    copy:'Compare two champions using measured Riot champion data before you go into the deeper matchup models.',
    badge:'MATCHUPS',
  },
  {
    title:'Matchup Lab',
    href:'/matchup-lab',
    kicker:'DEEP MATCHUP',
    copy:'The detailed matchup model: power windows, lane states, trade patterns and the numbers behind the simpler Coach advice.',
    badge:'LAB',
  },
  {
    title:'Bot Duo Lab',
    href:'/matchup-lab/bot-duo',
    kicker:'BOT LANE',
    copy:'ADC and support interaction modelling for players who want the deeper lane, duo and matchup layer.',
    badge:'LAB',
  },
  {
    title:'Main Champion Lab',
    href:'/champions/main',
    kicker:'MAIN CHAMPION',
    copy:'A deeper model of your main champion, including the detailed numbers and patterns that stay hidden from the normal coaching flow.',
    badge:'LAB',
  },
  {
    title:'Mission Lab',
    href:'/missions',
    kicker:'DEVELOPMENT DATA',
    copy:'Open the detailed mission, evidence and mastery view behind the simple one-focus coaching experience.',
    badge:'DEEP VIEW',
  },
  {
    title:'Add Game Data',
    href:'/uploads',
    kicker:'DATA TOOLS',
    copy:'Add extra match data when you need to. This feeds the same coaching system without cluttering your normal Home screen.',
    badge:'INPUT',
  },
] as const;

export default function AdvancedStatistics(){
  const {active}=useAccount();
  const matches=matchesFor(active.id);
  const {tasks}=useLearningPlan();
  const activeTasks=tasks.filter(task=>task.status!=='MASTERED'&&task.status!=='PAUSED').length;
  const champions=active.champions?.length||0;

  return <AppShell>
    <PageHead title="Advanced Statistics" subtitle={`${active.gameName}${active.tagline} · Optional deeper analysis`}/>

    <section className="glass card" style={{padding:'clamp(24px,4vw,42px)',marginBottom:18}}>
      <div className="eyebrow">OPTIONAL · NOTHING HERE CHANGES YOUR MAIN FOCUS</div>
      <h1 style={{fontSize:'clamp(34px,5vw,58px)',lineHeight:.96,margin:'10px 0 12px'}}>Want the numbers? They’re all still here.</h1>
      <p className="muted" style={{fontSize:16,lineHeight:1.65,maxWidth:760,marginBottom:0}}>
        Home and Coach keep the experience simple. This section keeps the deeper statistics, labs and modelling for players who want to go further.
      </p>
      <div className="grid three" style={{marginTop:20}}>
        <div><span className="label">TRACKED GAMES</span><b>{matches.length}</b></div>
        <div><span className="label">CHAMPIONS</span><b>{champions}</b></div>
        <div><span className="label">ACTIVE FOCUSES</span><b>{activeTasks}</b></div>
      </div>
    </section>

    <section className="v7-section">
      <div className="v7-section-head">
        <div><div className="eyebrow">DEEPER TOOLS</div><h2>Everything advanced, in one place.</h2><p className="muted">Use these when you want more detail. You do not need them to follow your normal coaching plan.</p></div>
      </div>

      <div className="grid two">
        {tools.map(tool=><Link href={tool.href} key={tool.href} className="glass card" style={{display:'grid',gap:10,minHeight:190,textDecoration:'none'}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}>
            <span className="eyebrow">{tool.kicker}</span>
            <span className="v7-badge">{tool.badge}</span>
          </div>
          <h2 style={{margin:'4px 0 0'}}>{tool.title}</h2>
          <p className="muted" style={{lineHeight:1.55,margin:0}}>{tool.copy}</p>
          <span className="text-link" style={{marginTop:'auto'}}>OPEN →</span>
        </Link>)}
      </div>
    </section>

    <section className="glass card" style={{marginTop:18,border:'1px solid rgba(182,246,107,.18)'}}>
      <div className="eyebrow">KEEP THE MAIN LOOP SIMPLE</div>
      <h2>Stats explain. Coaching changes behaviour.</h2>
      <p className="muted">When you are done looking deeper, go back to the one thing you are fixing and take it into your next game.</p>
      <div className="hero-actions"><Link className="btn primary" href="/dashboard">BACK TO MY FOCUS</Link><Link className="btn secondary" href="/coach">ASK COACH</Link></div>
    </section>
  </AppShell>;
}
