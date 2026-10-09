'use client';

import type {CSSProperties} from 'react';
import type {SubscriptionTier} from '@/lib/subscription';
import {LADDER,TRANSFER_STATUS_LABEL,type LearningLadder,type TransferStatus} from '@/lib/dashboard/learningLadder';
import {ArenaIcon} from '@/components/arena/ArenaIcon';
import {ButtonLink,Chip,EmptyState,Panel,SectionHead,Skeleton,TierBadge,Tooltip} from '@/components/arena/Primitives';
import s from './Dashboard.module.css';

export type HabitItem={id:string;name:string;occurred:number;measured:number;level:string;colour:string;trend:'IMPROVING'|'WORSE'|'STEADY'|null};
export type HabitsBlock={stage:'SCANNING'|'FIRST_READ'|'PATTERNS'|'ESTABLISHED';careerGames:number;nextAt:number|null;items:HabitItem[];hidden:number};
export type Loadable<T>={state:'LOCKED'|'LOADING'|'ERROR'|'READY';data:T|null;error?:string|null};
export type MemorySnapshot={count:number;mastered:number;due:number;transfer:number;top:string|null};

/** Ladder names for narrow columns: a soft hyphen lets GENERALISATION break cleanly. */
const RUNG_DISPLAY=LADDER.map(rung=>rung==='GENERALISATION'?'GENERAL­ISATION':rung);
const STAGE_COPY:Record<HabitsBlock['stage'],string>={SCANNING:'Scanning',FIRST_READ:'First read',PATTERNS:'Patterns',ESTABLISHED:'Established'};
const STATUS_TONE:Record<TransferStatus,string>={
  NOT_OBSERVED:'var(--arena-muted)',NOT_READY:'var(--arena-muted)',LOCAL_ONLY:'var(--arena-gold)',TESTING:'var(--arena-cyan)',
  TRANSFERRED:'var(--arena-lime)',GENERALISING:'var(--arena-lime)',PRINCIPLE_OWNED:'var(--arena-violet)',REGRESSED:'var(--arena-loss)',
};
const STATUS_HELP:Record<TransferStatus,string>={
  NOT_OBSERVED:'The decision has not come up in a tracked game yet.',
  NOT_READY:'Still being learned in one situation. Transfer is tested only after local mastery.',
  LOCAL_ONLY:'Mastered on one champion or situation. Not yet shown anywhere new.',
  TESTING:'Being tried on a new champion or situation. Not yet proven there.',
  TRANSFERRED:'Clean decisions on a new champion or situation, not just the one you learned it on.',
  GENERALISING:'Holding across several new champions or situations.',
  PRINCIPLE_OWNED:'Clean across champions and situations, repeatedly. You own the principle.',
  REGRESSED:'Was holding, then recent games slipped. It is being rebuilt.',
};

function Block({icon,title,tone,aside,children}:{icon:Parameters<typeof ArenaIcon>[0]['name'];title:string;tone:string;aside?:React.ReactNode;children:React.ReactNode}){
  return <div className={s.intelBlock}>
    <div className={s.intelBlockHead} style={{'--tone':tone} as CSSProperties}><h3><ArenaIcon name={icon} size={18}/>{title}</h3>{aside}</div>
    {children}
  </div>;
}

/** E. What the coach has learned — habits, how lessons transfer, and what it remembers. */
export function CoachingIntelligence({tier,baselineReady,habits,ladder,memory,improvement}:{
  tier:SubscriptionTier;baselineReady:boolean;habits:HabitsBlock|null;
  ladder:Loadable<LearningLadder>;memory:Loadable<MemorySnapshot>;
  improvement:{mastered:number;broken:number|null};
}){
  return <Panel aria-labelledby="hq-intel-title" className={s.intel}>
    <SectionHead titleId="hq-intel-title" eyebrow="Coaching intelligence" toneColor="var(--arena-violet)" title="What your coach has learned"
      aside={<TierBadge tier={tier} label={tier+' plan'}/>}/>

    <Block icon="pulse" title="Recurring habits" tone="var(--arena-warning)" aside={habits&&<Chip>{STAGE_COPY[habits.stage]} · {habits.careerGames} games</Chip>}>
      {!habits||habits.stage==='SCANNING'
        ?<p className={s.detailBody} style={{color:'var(--arena-muted)'}}>Habits are read from your real games: a first read at 3, patterns at 5, your DNA at 10.{habits?.nextAt?` ${Math.max(0,habits.nextAt-habits.careerGames)} more to the next read.`:''}</p>
        :habits.items.length===0?<p className={s.detailBody}>No recurring habit flagged in your recent games.</p>
        :<ul className={s.habitList}>
          {habits.items.map(item=><li key={item.id} className={s.habitItem} style={{'--habit':item.colour} as CSSProperties}>
            <i aria-hidden="true"/>
            <span><b>{item.name}</b><small>{item.occurred} of {item.measured} games{item.trend?` · ${item.trend==='IMPROVING'?'improving':item.trend==='WORSE'?'getting worse':'steady'} vs your first 10`:''}</small></span>
            <Chip toneColor={item.level==='HABIT'?'var(--arena-loss)':'var(--arena-warning)'}>{item.level}</Chip>
          </li>)}
        </ul>}
      {habits&&habits.hidden>0&&<div className={s.lockedNote}><TierBadge tier="PLUS"/>{habits.hidden} more habit{habits.hidden===1?'':'s'} read · <ButtonLink href="/pricing" variant="ghost">See every habit</ButtonLink></div>}
    </Block>

    <Block icon="transfer" title="Learning ladder" tone="var(--arena-violet)" aside={<TierBadge tier="PRO" label="Decision Twin"/>}>
      {ladder.state==='LOCKED'?<div className={s.lockedPreview}>
        <p className={s.detailBody}>PRO follows each lesson up this ladder. Learning something on one champion stays <b>LOCAL ONLY</b> until clean decisions show up on another champion or in a new situation.</p>
        <div className={s.lockedLadder} role="list" aria-label="Decision Twin learning ladder stages">{RUNG_DISPLAY.map((rung,index)=><span key={LADDER[index]} role="listitem">{rung}</span>)}</div>
        <ButtonLink href="/pricing" variant="secondary" small>Explore PRO</ButtonLink>
      </div>
      :ladder.state==='LOADING'?<div style={{display:'grid',gap:10}} aria-busy="true"><Skeleton height={12}/><Skeleton height={32}/><Skeleton height={32}/></div>
      :ladder.state==='ERROR'?<p className={s.detailBody} style={{color:'var(--arena-muted)'}}>{ladder.error||'The Decision Twin could not be built right now.'}</p>
      :!ladder.data||ladder.data.rows.length===0?<EmptyState icon="eye" toneColor="var(--arena-violet)" title="Not observed yet" body={`The Decision Twin needs fully tracked games with analysed decisions${ladder.data?.gamesAnalyzed?` (${ladder.data.gamesAnalyzed} analysed so far)`:''}. Nothing is promoted without repeated evidence.`}/>
      :<>
        <div className={s.ladderLegend} aria-hidden="true">{RUNG_DISPLAY.map((rung,index)=><span key={LADDER[index]}>{rung}</span>)}</div>
        <ul className={s.ladderRows}>
          {ladder.data.rows.map(row=><li key={row.behaviourKey} className={s.ladderRow}>
            <div className={s.ladderTop}>
              <b>{row.label}</b>
              <Tooltip label={STATUS_HELP[row.status]}><Chip toneColor={STATUS_TONE[row.status]}>{TRANSFER_STATUS_LABEL[row.status]}</Chip></Tooltip>
            </div>
            <div className={s.ladder} role="img" aria-label={`${row.label}: reached ${LADDER[row.reached]}${row.working!==null?`, working on ${LADDER[row.working]}`:''}`}>
              {LADDER.map((rung,index)=><i key={rung} className={index<row.reached?s.rungReached:index===row.reached?s.rungTop:index===row.working?s.rungWorking:''}/>)}
            </div>
            <p className={s.ladderPath}>
              {row.sourceChampion?<><span>Learned on <b>{row.sourceChampion}</b></span><ArenaIcon name="arrow" size={13}/><span>{row.testedOn.length?<>tested on <b>{row.testedOn.slice(0,3).join(', ')}</b> · {row.cleanTransferGames}/{row.transferGames} clean</>:'not yet seen anywhere new'}</span></>
                :<span>{row.next}</span>}
            </p>
          </li>)}
        </ul>
      </>}
    </Block>

    <Block icon="memory" title="Coach memory" tone="var(--arena-violet)" aside={<TierBadge tier="PRO"/>}>
      {memory.state==='LOCKED'?<p className={s.detailBody} style={{color:'var(--arena-muted)'}}>PRO keeps a memory of your recurring habits, what you mastered and what is slipping, and coaches every game from it.</p>
      :memory.state==='LOADING'?<Skeleton height={56}/>
      :memory.state==='ERROR'||!memory.data?<p className={s.detailBody} style={{color:'var(--arena-muted)'}}>Coach Memory is unavailable right now.</p>
      :memory.data.count===0?<p className={s.detailBody}>Nothing remembered yet. Coach Memory starts once your missions have tracked games.</p>
      :<>
        <div className={s.memoryStats}>
          <div><b>{memory.data.count}</b><small>Remembered</small></div>
          <div><b>{memory.data.mastered}</b><small>Mastered</small></div>
          <div><b>{memory.data.due}</b><small>Due / slipping</small></div>
        </div>
        {memory.data.top&&<p className={s.memoryQuote}>{memory.data.top}</p>}
        <ButtonLink href="/coach" variant="ghost">Open Coach Memory</ButtonLink>
      </>}
    </Block>

    <div className={s.improve}>
      <b>{baselineReady?improvement.mastered:'—'}</b>
      <span>{baselineReady?<>verified mission{improvement.mastered===1?'':'s'} mastered{improvement.broken!==null?<> · <b style={{fontSize:'inherit',color:'var(--arena-gold)'}}>{improvement.broken}</b> habit{improvement.broken===1?'':'s'} broken since your first 10 games</>:''}</>:'Verified improvement starts after your baseline.'}</span>
    </div>
  </Panel>;
}
