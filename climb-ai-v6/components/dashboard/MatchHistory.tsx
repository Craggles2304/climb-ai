'use client';

import Link from 'next/link';
import type {MatchRowView} from '@/lib/dashboard/model';
import type {SubscriptionTier} from '@/lib/subscription';
import {ArenaIcon} from '@/components/arena/ArenaIcon';
import {ChampionPortrait} from '@/components/arena/ChampionPortrait';
import {ButtonLink,Chip,EmptyState,SectionHead,Skeleton,TierBadge} from '@/components/arena/Primitives';
import {EvidencePill} from './MissionPanel';
import s from './Dashboard.module.css';

const ROLE_SHORT:Record<string,string>={TOP:'TOP',JUNGLE:'JG',MID:'MID',ADC:'BOT',SUPPORT:'SUP'};

/** D. Recent matches as dense, scannable rows. Every number shown was measured. */
export function MatchHistory({rows,windowLabel,tier,loading,olderHidden}:{
  rows:MatchRowView[];windowLabel:string;tier:SubscriptionTier;loading:boolean;olderHidden:number;
}){
  return <section className={[s.panelShell,s.matches].join(' ')} aria-labelledby="hq-matches-title">
    <div className={s.matchesHead}>
      <SectionHead titleId="hq-matches-title" eyebrow={<>Recent matches · {windowLabel}</>} toneColor="var(--arena-win)" title="Your last games"
        aside={<ButtonLink href="/analyse" variant="secondary" small>All games</ButtonLink>}/>
    </div>
    {loading?<ul className={s.matchList} aria-busy="true">{Array.from({length:4},(_,index)=><li key={index}><Skeleton height={62}/></li>)}</ul>
      :rows.length===0?<div style={{padding:'0 26px 24px'}}><EmptyState icon="match" title="No tracked games in this window" body={olderHidden>0?`You have ${olderHidden} older game${olderHidden===1?'':'s'} outside ${windowLabel.toLowerCase()}. Play a tracked game to see it here.`:'Your first tracked game appears here with its coaching focus. Connect the Companion and queue up.'} action={<ButtonLink href="/live" small>Open Match Room</ButtonLink>}/></div>
      :<ol className={s.matchList}>
        {rows.map(row=><li key={row.id}>
          <Link href={'/analyse/'+encodeURIComponent(row.id)} className={[s.matchRow,row.result==='LOSS'?s.loss:''].join(' ')} aria-label={`${row.result==='WIN'?'Victory':'Defeat'} as ${row.championName}, ${row.kills} ${row.deaths} ${row.assists}, ${row.ago}. Review this game.`}>
            <span className={s.matchChamp}><ChampionPortrait champion={row.championId||row.championName} size={46} label={row.championName}/><span className={s.roleTag}>{ROLE_SHORT[row.role]??row.role}</span></span>
            <span className={s.matchResult}><b>{row.result==='WIN'?'Victory':'Defeat'}</b><small>{row.championName} · {row.durationLabel} · {row.ago}</small></span>
            <span className={s.matchKda}><b>{row.kills} / <em>{row.deaths}</em> / {row.assists}</b><small>{row.kdaRatio.toFixed(2)} KDA</small></span>
            <span className={s.matchMetric}><b>{row.csPerMin===null?'—':row.csPerMin.toFixed(1)}</b><small>CS/min</small></span>
            <span className={s.matchMetric}><b>{row.killParticipation===null?'—':row.killParticipation+'%'}</b><small>KP</small></span>
            <span className={s.matchFocus}>
              {row.missions.length?row.missions.slice(0,2).map(mission=><EvidencePill key={mission.domain} domain={mission.domain} state={mission.state} name={mission.name}/>)
                :<span className={s.noFocus}>No mission graded</span>}
              {row.habitsShown!==null&&tier!=='FREE'&&<Chip toneColor={row.habitsShown?'var(--arena-warning)':'var(--arena-positive)'}>{row.habitsShown?`${row.habitsShown} habit${row.habitsShown===1?'':'s'}`:'Clean'}</Chip>}
            </span>
            <span className={s.matchGo} aria-hidden="true"><ArenaIcon name="chevron" size={17}/></span>
          </Link>
        </li>)}
      </ol>}
    <div className={s.matchesFoot}>
      <span className={s.windowNote}>Mission chips show what each game proved · rows open the full review</span>
      {tier==='FREE'&&<span style={{display:'inline-flex',alignItems:'center',gap:10}}><TierBadge tier="PLUS"/><ButtonLink href="/pricing" variant="ghost">Keep 90 days of history</ButtonLink></span>}
    </div>
  </section>;
}
