'use client';

import Link from 'next/link';
import type {CSSProperties} from 'react';
import type {DnaDomain,Role} from '@/lib/types';
import type {EvidenceState,JourneyStageView,MissionView} from '@/lib/dashboard/model';
import type {JourneyState} from '@/lib/journeyState';
import {ArenaIcon} from '@/components/arena/ArenaIcon';
import {ButtonLink,Chip,EmptyState,Eyebrow,Panel,Pips,Skeleton} from '@/components/arena/Primitives';
import {STRAND_META} from '@/components/arena/strands';
import s from './Dashboard.module.css';

export type MissionPhase='CHECKING'|'BASELINE'|'REVEAL'|'MISSION'|'EMPTY'|'ERROR';

const EVIDENCE_COPY:Record<EvidenceState,{label:string;tone:string;icon:'check'|'cross'|'eye'}>={
  BANKED:{label:'Verified',tone:'var(--arena-lime)',icon:'check'},
  MISSED:{label:'Missed',tone:'var(--arena-loss)',icon:'cross'},
  NOT_OBSERVED:{label:'Not observed',tone:'var(--arena-muted)',icon:'eye'},
};
const STEP_STATE:Record<JourneyStageView['status'],string>={DONE:'Done',CURRENT:'Now',READY:'Ready',LOCKED:'Locked'};
const STAGE_HELP:Record<string,string>={
  RECOGNISE:'Waiting for the first game where this moment happens.',
  EXECUTE:'Seen in your games. Not yet verified.',
  REPEAT:'Verified at least once. Repeat it.',
  MASTERED:'Mastered from verified games.',
};

export function EvidenceChip({state}:{state:EvidenceState}){
  const copy=EVIDENCE_COPY[state];
  return <Chip toneColor={copy.tone} icon={copy.icon}>{copy.label}</Chip>;
}

/** Compact strand + outcome marker for dense rows; the full wording is in its label. */
export function EvidencePill({domain,state,name}:{domain:DnaDomain;state:EvidenceState;name:string}){
  const copy=EVIDENCE_COPY[state];
  const meta=STRAND_META[domain];
  const label=`${name}: ${copy.label.toLowerCase()} this game`;
  return <span className={s.evidencePill} style={{'--tone':copy.tone,'--strand':meta.color} as CSSProperties} title={label} aria-label={label} role="img">
    <ArenaIcon name={meta.icon} size={13}/><b>{meta.code}</b><ArenaIcon name={copy.icon} size={13} strokeWidth={2.4}/>
  </span>;
}

/** The last graded games for a mission, oldest to newest. */
function EvidenceTrail({history}:{history:MissionView['history']}){
  if(!history.length)return null;
  return <div className={s.trail}>
    <span className={s.proofLabel}>Evidence trail · last {history.length} graded</span>
    <ol className={s.trailList}>
      {history.map((item,index)=><li key={item.matchId+index} className={s['trail'+item.state]} title={EVIDENCE_COPY[item.state].label}>
        <ArenaIcon name={EVIDENCE_COPY[item.state].icon} size={13} strokeWidth={2.4}/><span className={s.trailText}>{EVIDENCE_COPY[item.state].label}</span>
      </li>)}
    </ol>
  </div>;
}

/** B. The next coaching objective — the most visible thing after the player's identity. */
export function MissionCard({phase,role,baseline,primary,secondary,error,primaryAction=true}:{
  phase:MissionPhase;role:Role;baseline:{games:number;required:number};
  primary:MissionView|null;secondary:MissionView|null;error?:string|null;
  /** False while the journey's next step is elsewhere (pair the Companion, reveal the DNA). */
  primaryAction?:boolean;
}){
  if(phase==='CHECKING')return <section className={s.mission} aria-busy="true" aria-label="Loading your mission">
    <Skeleton width={160} height={14}/><Skeleton width="70%" height={44}/><Skeleton width="90%" height={18}/><Skeleton height={74}/><Skeleton width={220} height={30}/>
  </section>;

  if(phase==='ERROR')return <section className={s.mission} aria-labelledby="hq-mission-title">
    <p className={s.missionKicker}><i aria-hidden="true"/>Active mission</p>
    <h2 className={s.missionTitle} id="hq-mission-title">Mission plan unavailable</h2>
    <EmptyState icon="sync" title="We could not load your plan" body={error||'Refresh the page to retry. Nothing has been lost; your verified games are stored.'}/>
  </section>;

  if(phase==='BASELINE'){
    const next=Math.min(baseline.games+1,baseline.required);
    return <section className={s.mission} aria-labelledby="hq-mission-title">
      <div className={s.missionTop}>
        <p className={s.missionKicker}><i aria-hidden="true"/>DNA baseline</p>
        <div className={s.missionTags}><Chip toneColor="var(--arena-cyan)">{role} · game {next} of {baseline.required}</Chip></div>
      </div>
      <div>
        <h2 className={s.missionTitle} id="hq-mission-title">Play baseline game {next}.</h2>
        <p className={s.missionMeaning}>Play normally. OP CLIMB keeps your Game DNA neutral until it has seen {baseline.required} real {role} games, then it chooses your first missions from what actually happened.</p>
      </div>
      <div className={s.job}><span>Your job next game</span><b>Play your normal {role} game with the Companion running. Do not play for the system.</b></div>
      <div className={s.proof}>
        <div className={s.proofMain}>
          <span className={s.proofLabel}>Baseline games observed</span>
          <div className={s.proofCount}>
            <Pips filled={baseline.games} total={baseline.required} toneColor="var(--arena-cyan)" label={`${baseline.games} of ${baseline.required} baseline games observed`} width={34} height={10}/>
            <strong>{Math.min(baseline.games,baseline.required)}<small>/{baseline.required}</small></strong>
          </div>
        </div>
        <p className={s.proofNote}>Coaching before game {baseline.required} is provisional. Permanent missions unlock after the reveal.</p>
      </div>
      <div className={s.actions}><ButtonLink href="/live" variant={primaryAction?'primary':'secondary'}>Open Match Room</ButtonLink><ButtonLink href="/ilp" variant="secondary" icon={null}>How Game DNA works</ButtonLink></div>
    </section>;
  }

  if(phase==='REVEAL')return <section className={s.mission} aria-labelledby="hq-mission-title" style={{'--strand':'var(--arena-violet)'} as CSSProperties}>
    <div className={s.missionTop}>
      <p className={s.missionKicker}><i aria-hidden="true"/>Baseline complete</p>
      <Chip toneColor="var(--arena-violet)" icon="dna">{baseline.required}/{baseline.required} {role} games</Chip>
    </div>
    <div>
      <h2 className={s.missionTitle} id="hq-mission-title">Your Game DNA is ready.</h2>
      <p className={s.missionMeaning}>All six strands are measured. Reveal your DNA, then choose the two DNA trees that will bank verified progress first.</p>
    </div>
    <ol className={s.nextList} aria-label="What revealing unlocks">
      <li><b>01</b><span>See all six strands of your {role} DNA and the habits inside them.</span></li>
      <li><b>02</b><span>Choose the two DNA trees that score first. The other four keep being measured.</span></li>
      <li><b>03</b><span>From then on, each tracked game can bank verified proof toward a mission.</span></li>
    </ol>
    <div className={s.actions}><ButtonLink href="/ilp" variant={primaryAction?'primary':'secondary'}>Reveal my DNA</ButtonLink></div>
  </section>;

  if(phase==='EMPTY'||!primary)return <section className={s.mission} aria-labelledby="hq-mission-title">
    <p className={s.missionKicker}><i aria-hidden="true"/>Active mission</p>
    <h2 className={s.missionTitle} id="hq-mission-title">No mission open right now</h2>
    <EmptyState icon="missions" title="OP CLIMB opens a mission when evidence shows the next need" body="Keep playing tracked games. Nothing is invented from missing evidence." action={<ButtonLink href="/ilp" variant="secondary" small icon="arrow">Open My DNA</ButtonLink>}/>
  </section>;

  const meta=STRAND_META[primary.domain];
  const latest=primary.latest;
  return <section className={s.mission} aria-labelledby="hq-mission-title" style={{'--strand':meta.color} as CSSProperties}>
    <div className={s.missionTop}>
      <p className={s.missionKicker}><i aria-hidden="true"/>Active mission</p>
      <div className={s.missionTags}>
        <Chip toneColor={meta.color} icon={meta.icon}>{String(primary.strandNumber).padStart(2,'0')} · {primary.domainLabel}</Chip>
        <Chip title={STAGE_HELP[primary.stageLabel]}>{primary.stageLabel}</Chip>
        {primary.habit&&<Chip toneColor="var(--arena-gold)">Career DNA habit</Chip>}
      </div>
    </div>
    <div>
      <h2 className={s.missionTitle} id="hq-mission-title">{primary.name}</h2>
      <p className={s.missionMeaning}>{primary.meaning}</p>
    </div>
    <div className={s.job}><span>Your job next game</span><b>{primary.nextGame}</b></div>
    <div className={s.proof}>
      <div className={s.proofMain}>
        <span className={s.proofLabel}>Proof · verified games</span>
        <div className={s.proofCount}>
          <Pips filled={primary.confirmed} total={primary.required} toneColor={meta.color} label={`${primary.confirmed} of ${primary.required} verified games`} width={38} height={11}/>
          <strong>{Math.min(primary.confirmed,primary.required)}<small>/{primary.required}</small></strong>
        </div>
        <span className={s.latest}>
          {latest?<><EvidenceChip state={latest.state}/>{latest.state==='NOT_OBSERVED'?'Last game: the moment never came up, so nothing was scored.':latest.valueLabel?`Last game · ${latest.valueLabel}`:'Last game graded'}</>
            :'No graded game yet — progress starts with your next tracked game.'}
        </span>
      </div>
      <p className={s.proofNote}>Only tracked games with a verified receipt count. Entering a game is not proof.</p>
    </div>
    <EvidenceTrail history={primary.history}/>
    <div className={s.actions}>
      {/* The single lime action on the page is whatever the journey says comes next. */}
      <ButtonLink href="/live" variant={primaryAction?'primary':'secondary'} icon={primaryAction?'arrow':null}>Play next game</ButtonLink>
      <ButtonLink href="/missions" variant="secondary">Explore the coaching plan</ButtonLink>
    </div>
    {secondary&&<Link className={s.alsoTraining} href="/missions" style={{'--tone':STRAND_META[secondary.domain].color} as CSSProperties}>
      <span className={s.alsoIcon}><ArenaIcon name={STRAND_META[secondary.domain].icon} size={18}/></span>
      <span className={s.alsoCopy}><small>Also training · {String(secondary.strandNumber).padStart(2,'0')} {secondary.domainLabel}</small><b>{secondary.name}</b></span>
      <Pips filled={secondary.confirmed} total={secondary.required} toneColor={STRAND_META[secondary.domain].color} label={`${secondary.confirmed} of ${secondary.required} verified games`} width={18} height={8}/>
    </Link>}
  </section>;
}

/** F. CONNECT → PLAY → REVEAL DNA → TRAIN → VERIFY → EVOLVE, each with its real status. */
export function ClimbJourney({stages,next}:{stages:JourneyStageView[];next:JourneyState}){
  const current=stages.find(stage=>stage.status==='CURRENT')??null;
  return <Panel aria-labelledby="hq-journey-title" className={s.journey}>
    <div>
      <Eyebrow toneColor="var(--arena-lime)">Your development journey</Eyebrow>
      <h2 className={s.journeyTitle} id="hq-journey-title">Your climb path</h2>
    </div>
    <div className={s.journeyNext} role="status">
      <span>{next.status}</span>
      <strong>{next.title}</strong>
      <p>{next.body}</p>
    </div>
    <ol className={s.steps}>
      {stages.map((stage,index)=><li key={stage.key} className={[s.step,stage.status==='DONE'?s.stepDone:stage.status==='CURRENT'?s.stepCurrent:stage.status==='READY'?s.stepReady:s.stepLocked].join(' ')} aria-current={stage.status==='CURRENT'?'step':undefined}>
        <span className={s.stepMark} aria-hidden="true">{stage.status==='DONE'?<ArenaIcon name="check" size={15} strokeWidth={2.6}/>:stage.status==='LOCKED'?<ArenaIcon name="lock" size={13}/>:index+1}</span>
        <span className={s.stepCopy}><b>{stage.label}</b><small>{stage.detail}</small></span>
        <span className={s.stepState}>{STEP_STATE[stage.status]}</span>
      </li>)}
    </ol>
    {/* In the mission phase the mission card carries the lime action; here it would only repeat it. */}
    <ButtonLink href={next.href} small variant={next.phase==='MISSION'?'secondary':'primary'} disabled={next.phase==='CHECKING'}>{next.cta.replace(/\s*→$/,'')}</ButtonLink>
    {current&&current.href!==next.href&&<ButtonLink href={current.href} variant="ghost" icon="arrow">{current.cta}</ButtonLink>}
  </Panel>;
}
