'use client';

import {useState,type CSSProperties} from 'react';
import type {DnaDomain,Role} from '@/lib/types';
import type {StrandView} from '@/lib/dashboard/model';
import type {SubscriptionTier} from '@/lib/subscription';
import {DNA_XP_PER_COMPLETED_GAME,DNA_XP_PER_MASTERED_MISSION} from '@/lib/dnaLevel';
import {ArenaIcon} from '@/components/arena/ArenaIcon';
import {ButtonLink,Chip,Meter,Pips,SectionHead,TierBadge,VisuallyHidden,handleTabKeys} from '@/components/arena/Primitives';
import {STRAND_META} from '@/components/arena/strands';
import s from './Dashboard.module.css';

// The helix sits low in its band so the strand codes above it never touch the nodes.
const W=1200,H=150,MID=84,AMP=42,PERIOD=400;
const TOP=`${((MID-AMP)/H*100).toFixed(2)}%`,BOTTOM=`${((MID+AMP)/H*100).toFixed(2)}%`,BOTTOM_INSET=`${(100-(MID+AMP)/H*100).toFixed(2)}%`;
/** Two phase-opposed strands; every column centre is a full-width rung. */
function strandPath(sign:1|-1){
  const points:string[]=[];
  for(let x=0;x<=W;x+=8)points.push(`${x},${(MID-sign*AMP*Math.sin(2*Math.PI*x/PERIOD)).toFixed(2)}`);
  return 'M'+points.join(' L');
}
const PATH_A=strandPath(1),PATH_B=strandPath(-1);

const MISSION_STATE:Record<NonNullable<StrandView['mission']>['state'],string>={LOCKED:'Locked tree',TRAINING:'Training',PROVEN:'Proven',MASTERED:'Mastered'};

/** C. Game DNA — six strands, read as one player. Neutral until the role baseline exists. */
export function GameDnaOverview({role,strands,baseline,tier,initialDomain}:{
  role:Role;strands:StrandView[];baseline:{games:number;required:number;ready:boolean};
  tier:SubscriptionTier;initialDomain?:DnaDomain|null;
}){
  const startIndex=Math.max(0,strands.findIndex(strand=>strand.domain===initialDomain));
  const [selected,setSelected]=useState(startIndex);
  const strand=strands[selected]??strands[0];
  const neutral=!baseline.ready;
  if(!strand)return null;
  const meta=STRAND_META[strand.domain];
  return <section className={[s.panelShell,s.dna].join(' ')} aria-labelledby="hq-dna-title">
    <div className={s.dnaHeadWrap}>
      <SectionHead
        titleId="hq-dna-title"
        eyebrow={<>Game DNA · {role}</>}
        toneColor="var(--arena-violet)"
        title={neutral?'Your DNA is still neutral':'Six strands. One player.'}
        lede={neutral
          ?`OP CLIMB has seen ${Math.min(baseline.games,baseline.required)} of ${baseline.required} ${role} games. No strand is scored until the baseline is complete, so nothing here is a guess.`
          :`Each strand levels only from verified games. Two DNA trees are unlocked for scored missions; every strand keeps being measured.`}
        aside={<>
          <Chip toneColor={neutral?'var(--arena-cyan)':'var(--arena-lime)'} icon={neutral?'clock':'check'}>{neutral?`Baseline ${Math.min(baseline.games,baseline.required)}/${baseline.required}`:'DNA active'}</Chip>
          <ButtonLink href="/ilp" variant="secondary" small>Open My DNA</ButtonLink>
        </>}
      />
    </div>

    <div className={[s.helixBand,neutral?s.helixNeutral:''].join(' ')} aria-hidden="true">
      <svg className={s.helixSvg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="arenaHelixA" x1="0" x2="1" y1="0" y2="0">
            {strands.map((item,index)=><stop key={item.domain} offset={(index+.5)/strands.length} stopColor={STRAND_META[item.domain].color}/>)}
          </linearGradient>
          <linearGradient id="arenaHelixB" x1="0" x2="1" y1="0" y2="0">
            {strands.map((item,index)=><stop key={item.domain} offset={(index+.5)/strands.length} stopColor={STRAND_META[item.domain].color} stopOpacity=".45"/>)}
          </linearGradient>
        </defs>
        <path className={s.helixStrandA} d={PATH_A}/>
        <path className={s.helixStrandB} d={PATH_B}/>
      </svg>
      {strands.map((item,index)=>{
        const focus=!neutral&&(item.mission?.state==='TRAINING'||item.mission?.state==='PROVEN');
        return <span key={item.domain} className={[s.rung,neutral?s.rungNeutral:'',focus?s.rungFocus:'',index===selected&&!neutral?s.rungSelected:''].join(' ')} style={{left:`${(index+.5)/strands.length*100}%`,...(neutral?{}:{'--tone':STRAND_META[item.domain].color})} as CSSProperties}>
          <span className={s.rungLine} style={{top:TOP,bottom:BOTTOM_INSET}}/>
          <span className={s.rungNode} style={{top:TOP}}/>
          <span className={s.rungNode} style={{top:BOTTOM}}/>
          <span className={s.rungLabel}>{String(item.number).padStart(2,'0')} {STRAND_META[item.domain].code}</span>
        </span>;
      })}
      {neutral&&<span className={s.scan}/>}
    </div>

    <div className={s.strandTabs} role="tablist" aria-label="Game DNA strands">
      {strands.map((item,index)=>{
        const itemMeta=STRAND_META[item.domain];
        const active=index===selected;
        const state=neutral?'Baseline':item.mission?`${MISSION_STATE[item.mission.state]}${item.mission.state==='TRAINING'?` · ${item.mission.confirmed}/${item.mission.required}`:''}`:'No mission yet';
        return <button key={item.domain} type="button" role="tab" id={'hq-strand-tab-'+index} aria-selected={active} aria-controls="hq-strand-panel" tabIndex={active?0:-1}
          className={[s.strandTab,neutral?s.strandNeutral:''].join(' ')} style={neutral?undefined:{'--tone':itemMeta.color} as CSSProperties}
          onClick={()=>setSelected(index)} onKeyDown={event=>handleTabKeys(event,index,strands.length,setSelected)}>
          <span className={s.tabTop}><span className={s.tabIcon}><ArenaIcon name={itemMeta.icon} size={18}/></span><span className={s.tabNum}>{String(item.number).padStart(2,'0')}</span></span>
          <span className={s.tabName}>{item.label}</span>
          <span className={s.tabLevel}><b><small>LV</small>{neutral?'—':item.level}</b><span>{neutral?'—':`${item.xpIntoLevel}/${item.xpForNextLevel} XP`}</span></span>
          <Meter value={neutral?0:item.xpIntoLevel} max={item.xpForNextLevel} toneColor={itemMeta.color} label={`${item.label} level progress`}/>
          <span className={s.tabFoot}><span className={[s.tabState,item.mission&&item.mission.state!=='LOCKED'&&!neutral?s.tabStateOn:''].join(' ')}>{state}</span>{item.mastered>0&&<span title={`${item.mastered} mastered`} style={{display:'inline-flex',color:itemMeta.color}}><ArenaIcon name="shield" size={15}/><VisuallyHidden>{item.mastered} mastered</VisuallyHidden></span>}</span>
        </button>;
      })}
    </div>

    <div className={s.detail} id="hq-strand-panel" role="tabpanel" aria-labelledby={'hq-strand-tab-'+selected} key={strand.domain} style={{'--tone':meta.color} as CSSProperties}>
      <div>
        <span className={s.detailLabel}>Strand {String(strand.number).padStart(2,'0')} · {meta.code}</span>
        <h3 className={s.detailTitle}><ArenaIcon name={meta.icon} size={24}/>{strand.label}</h3>
        <p className={s.detailBody}>{strand.summary}</p>
        <div className={s.subskills}>{strand.subskills.map(skill=><Chip key={skill} toneColor={meta.color}>{skill}</Chip>)}</div>
      </div>
      <div>
        <span className={s.detailLabel}>Progression</span>
        {neutral?<>
          <div className={s.levelRow}><b>Neutral</b><span>{Math.min(baseline.games,baseline.required)}/{baseline.required} games</span></div>
          <Pips filled={baseline.games} total={baseline.required} toneColor="var(--arena-cyan)" label={`${baseline.games} of ${baseline.required} baseline games`} width={30}/>
          <p className={s.fine}>Levels start after your {role} baseline. Games before that are observation only.</p>
        </>:<>
          <div className={s.levelRow}><b>Level {strand.level}</b><span>{strand.xpIntoLevel}/{strand.xpForNextLevel} XP</span></div>
          <Meter value={strand.xpIntoLevel} max={strand.xpForNextLevel} toneColor={meta.color} label={`${strand.label} XP into level ${strand.level+1}`}/>
          <p className={s.fine}>XP comes only from verified games: +{DNA_XP_PER_COMPLETED_GAME} for each verified mission game, +{DNA_XP_PER_MASTERED_MISSION} for each mastered mission{strand.mastered?` · ${strand.mastered} mastered here`:''}.</p>
          <div className={s.missionLine} style={{marginTop:14}}>
            <span className={s.detailLabel} style={{marginBottom:0}}>Current mission</span>
            {strand.mission?<>
              <b>{strand.mission.name}</b>
              <span style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                <Chip toneColor={strand.mission.state==='LOCKED'?'var(--arena-muted)':meta.color} icon={strand.mission.state==='LOCKED'?'lock':strand.mission.state==='MASTERED'?'shield':'missions'}>{MISSION_STATE[strand.mission.state]}</Chip>
                <Pips filled={strand.mission.confirmed} total={strand.mission.required} toneColor={meta.color} label={`${strand.mission.confirmed} of ${strand.mission.required} verified games`} width={22} height={8}/>
              </span>
              {strand.mission.state==='LOCKED'&&<small className={s.fine} style={{marginTop:0}}>Measured every game, but only your two unlocked trees bank proven progress.</small>}
            </>:<small className={s.fine} style={{marginTop:0}}>No mission on this strand yet. One opens when evidence shows a need.</small>}
          </div>
        </>}
      </div>
      <div>
        <span className={s.detailLabel}>Habit read · Career DNA</span>
        {neutral?<p className={s.detailBody}>Habits are first read after {baseline.required} games, then confirmed at 5 and 10.</p>
          :strand.habit?<div className={s.habitLine}>
            <b>{strand.habit.name}</b>
            <small>Happened in {strand.habit.occurred} of {strand.habit.measured} measured games{strand.habit.trend?` · ${strand.habit.trend.toLowerCase()} against your first 10`:''}.</small>
            <span><Chip toneColor={strand.habit.level==='HABIT'?'var(--arena-loss)':strand.habit.level==='WATCH'?'var(--arena-muted)':'var(--arena-warning)'}>{strand.habit.level}</Chip></span>
          </div>
          :strand.habitLocked?<div className={s.habitLine}>
            <b>A habit is flagged on this strand.</b>
            <small>Your plan shows your biggest habit. PLUS reads every habit on every strand.</small>
            <span style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><TierBadge tier="PLUS"/><ButtonLink href="/pricing" variant="ghost">See what PLUS reads</ButtonLink></span>
          </div>
          :<p className={s.detailBody}>No habit flagged on this strand in your recent {role} games.</p>}
        <div className={s.detailLink}><ButtonLink href="/ilp" variant="ghost">Develop this strand in My DNA</ButtonLink></div>
        {tier==='FREE'&&!neutral&&!strand.habitLocked&&<p className={s.fine}>FREE shows your biggest habit; PLUS reads them all.</p>}
      </div>
    </div>
  </section>;
}
