'use client';

import type {CSSProperties} from 'react';
import {DNA_DOMAINS,DNA_DOMAIN_LABELS} from '@/lib/dnaDomain';
import {careerFor} from '@/lib/dna/career';
import {buildDNA} from '@/lib/dna/dna';
import {HABIT_COLOURS} from '@/lib/habits/colours';
import {gameMissionFocusPair} from '@/lib/gameDnaSnapshot';
import {verifiedMissionMastery} from '@/lib/verifiedMissionProof';
import {buildJourneyState} from '@/lib/journeyState';
import {buildLearningLadder} from '@/lib/dashboard/learningLadder';
import {climbJourney,mainChampion,matchRowViews,missionView,parseRank,RANK_TIERS,recentForm,strandViews} from '@/lib/dashboard/model';
import {ArenaIcon} from '@/components/arena/ArenaIcon';
import {ChampionPortrait} from '@/components/arena/ChampionPortrait';
import {RankEmblem} from '@/components/arena/RankEmblem';
import {Button,ButtonLink,Chip,EmptyState,Meter,Panel,Pips,SampleBanner,SectionHead,Skeleton,Stat,TierBadge,Tooltip} from '@/components/arena/Primitives';
import {STRAND_META} from '@/components/arena/strands';
import {PlayerHero} from '@/components/dashboard/PlayerHero';
import {ClimbJourney,EvidenceChip,MissionCard} from '@/components/dashboard/MissionPanel';
import {GameDnaOverview} from '@/components/dashboard/GameDnaOverview';
import {MatchHistory} from '@/components/dashboard/MatchHistory';
import {CoachingIntelligence} from '@/components/dashboard/CoachingIntelligence';
import ds from '@/components/dashboard/Dashboard.module.css';
import {SAMPLE_MATCHES,SAMPLE_MEMORY,SAMPLE_TASKS,SAMPLE_TWIN} from './sample';
import s from './lab.module.css';

const NOW=Date.parse('2026-10-09T18:00:00.000Z');
const SWATCHES:Array<[string,string,string]>=[
  ['--arena-obsidian','Obsidian','Page'],['--arena-midnight','Midnight','App chrome'],['--arena-ink','Ink','Panel'],['--arena-surface','Slate','Raised panel'],['--arena-charcoal','Charcoal','Controls'],
  ['--arena-lime','Lime','Primary action, selected progression'],['--arena-cyan','Cyan','Waves, technical performance'],['--arena-violet','Violet','Vision, intelligence, learning'],
  ['--arena-gold','Gold','Objectives, rank, achievement'],['--arena-crimson','Crimson','Teamfights, critical moments'],['--arena-blue','Blue','Consistency, development'],
  ['--arena-win','Victory','Match outcome'],['--arena-loss','Defeat','Match outcome'],
];

export function ArenaDesignLab(){
  const role='ADC' as const;
  const tasks=SAMPLE_TASKS;
  const pair=gameMissionFocusPair(tasks,role);
  const missions=pair.map(({task})=>missionView(task));
  const dna=buildDNA(careerFor(SAMPLE_MATCHES));
  const strands=strandViews({tasks,role,baselineReady:true,dna,allHabits:true});
  const neutralStrands=strandViews({tasks,role,baselineReady:false,dna:null,allHabits:false});
  const rows=matchRowViews(SAMPLE_MATCHES,pair.map(({task})=>task),NOW);
  const mastered=tasks.filter(verifiedMissionMastery).length;
  const journey=climbJourney({deviceLoaded:true,linked:true,online:true,baselineGames:14,role,dnaRevealed:true,missions,masteredCount:mastered});
  const next=buildJourneyState({deviceLoaded:true,linked:true,online:true,baselineGames:14,dnaRevealed:true,focusName:'Two DNA trees unlocked',focusJob:`1. ${missions[0]?.nextGame}  2. ${missions[1]?.nextGame}`,focusConfirmed:missions[0]?.confirmed,focusRequired:missions[0]?.required});
  const ladder=buildLearningLadder(SAMPLE_TWIN);
  const habits={stage:dna.stage,careerGames:dna.careerGames,nextAt:dna.next?.at??null,hidden:0,
    items:dna.habits.slice(0,3).map(reading=>({id:reading.id,name:reading.def.name,occurred:reading.occurred,measured:reading.measured,level:reading.level,colour:HABIT_COLOURS[reading.id],trend:reading.trend?.direction??null}))};

  return <div className={s.lab} data-arena="">
    <header className={s.head}>
      <div><p className={s.kicker}>OP CLIMB · ARENA V2.1</p><h1>Design system lab</h1><p>Tokens, components and every dashboard state, rendered by the same code the product runs.</p></div>
      <SampleBanner>Sample data · not a real player · development only</SampleBanner>
    </header>

    <section className={s.block} aria-labelledby="lab-tokens"><h2 id="lab-tokens">Colour · one job per accent</h2>
      <div className={s.swatches}>{SWATCHES.map(([token,name,job])=><div key={token} className={s.swatch}><i style={{background:`var(${token})`}}/><b>{name}</b><small>{job}</small><code>{token}</code></div>)}</div>
      <div className={s.swatches}>{DNA_DOMAINS.map((domain,index)=><div key={domain} className={s.swatch}><i style={{background:STRAND_META[domain].color}}/><b><ArenaIcon name={STRAND_META[domain].icon} size={15}/> {String(index+1).padStart(2,'0')} {DNA_DOMAIN_LABELS[domain]}</b><small>Game DNA strand</small><code>{STRAND_META[domain].color.replace(/var\(|\)/g,'')}</code></div>)}</div>
    </section>

    <section className={s.block} aria-labelledby="lab-type"><h2 id="lab-type">Type</h2>
      <div className={s.typeRow}>
        <p className={s.typeHero}>Your climb</p>
        <p className={s.typeTitle}>Six strands. One player.</p>
        <p className={s.typeLabel}>Stat label · 12px mono caps</p>
        <p className={s.typeNumber}>2.83 <small>KDA</small></p>
        <p className={s.typeBody}>Body copy is DM Sans at 15px and above for anything a player must read to act.</p>
      </div>
    </section>

    <section className={s.block} aria-labelledby="lab-components"><h2 id="lab-components">Components</h2>
      <div className={s.componentGrid}>
        <Panel><SectionHead eyebrow="Buttons" title="Actions"/><div className={s.row}><ButtonLink href="#">Primary</ButtonLink><ButtonLink href="#" variant="secondary">Secondary</ButtonLink><ButtonLink href="#" variant="ghost">Ghost link</ButtonLink><Button small>Small</Button></div></Panel>
        <Panel><SectionHead eyebrow="Chips &amp; tiers" title="States"/><div className={s.row}><Chip toneColor="var(--arena-lime)" icon="check">Verified</Chip><EvidenceChip state="MISSED"/><EvidenceChip state="NOT_OBSERVED"/><Chip toneColor="var(--arena-gold)">Local only</Chip><TierBadge tier="FREE"/><TierBadge tier="PLUS"/><TierBadge tier="PRO"/></div></Panel>
        <Panel><SectionHead eyebrow="Stats" title="Numbers"/><div className={s.row}><Stat label="Win rate" value="60%" sub="10 games"/><Stat label="CS / min" value="—" sub="Not measured" unknown/><Tooltip label="Tooltips open on hover and on keyboard focus.">Hover or focus me ⓘ</Tooltip></div></Panel>
        <Panel><SectionHead eyebrow="Progress" title="Evidence"/><div className={s.stack}><Pips filled={2} total={3} label="2 of 3 verified" toneColor="var(--arena-crimson)" width={36} height={10}/><Meter value={45} max={125} toneColor="var(--arena-cyan)" label="XP"/><Skeleton height={18}/></div></Panel>
        <Panel><SectionHead eyebrow="Champion portraits" title="Riot Data Dragon"/><div className={s.row}>{['Aphelios','MonkeyKing',"Kha'Zix",'Jinx','Unknown'].map(name=><ChampionPortrait key={name} champion={name} size={52}/>)}</div></Panel>
        <Panel><SectionHead eyebrow="Rank emblems" title="OP CLIMB originals"/><div className={s.row}>{RANK_TIERS.map(tier=><RankEmblem key={tier} rank={parseRank(tier+(['MASTER','GRANDMASTER','CHALLENGER'].includes(tier)?'':' II'))} size={54}/>)}<RankEmblem rank={parseRank('UNRANKED')} size={54}/></div></Panel>
        <Panel><EmptyState icon="match" title="No tracked games yet" body="Empty states say what happens next, never just that something is missing." action={<ButtonLink href="#" small>Open Match Room</ButtonLink>}/></Panel>
      </div>
    </section>

    <section className={s.block} aria-labelledby="lab-pro"><h2 id="lab-pro">Dashboard · sample PRO player</h2>
      <div className={ds.page} style={{maxWidth:'none'} as CSSProperties}>
        <PlayerHero gameName="SampleCarry" tagline="#LAB" region="EUW" rank={parseRank('DIAMOND II · 47 LP')} role={role} main={mainChampion(SAMPLE_MATCHES,[],null)} form={recentForm(SAMPLE_MATCHES,10)} formWindow="Last 10" companion={{loaded:true,linked:true,online:true}} baseline={{games:14,required:3,ready:true}}/>
        <div className={ds.rowMission}>
          <MissionCard phase="MISSION" role={role} baseline={{games:14,required:3}} primary={missions[0]??null} secondary={missions[1]??null} primaryAction/>
          <ClimbJourney stages={journey} next={next}/>
        </div>
        <GameDnaOverview role={role} strands={strands} baseline={{games:14,required:3,ready:true}} tier="PRO" initialDomain={missions[0]?.domain}/>
        <div className={ds.rowLower}>
          <MatchHistory rows={rows} windowLabel="Long-term history" tier="PRO" loading={false} olderHidden={0}/>
          <CoachingIntelligence tier="PRO" baselineReady habits={habits} ladder={{state:'READY',data:ladder}} memory={{state:'READY',data:SAMPLE_MEMORY}} improvement={{mastered,broken:dna.broken.length}}/>
        </div>
      </div>
    </section>

    <section className={s.block} aria-labelledby="lab-new"><h2 id="lab-new">States · new player before the baseline</h2>
      <div className={ds.page} style={{maxWidth:'none'} as CSSProperties}>
        <div className={ds.rowMission}>
          <MissionCard phase="BASELINE" role="MID" baseline={{games:1,required:3}} primary={null} secondary={null} primaryAction={false}/>
          <ClimbJourney stages={climbJourney({deviceLoaded:true,linked:true,online:false,baselineGames:1,role:'MID',dnaRevealed:false,missions:[],masteredCount:0})} next={buildJourneyState({deviceLoaded:true,linked:true,online:true,baselineGames:1})}/>
        </div>
        <GameDnaOverview role="MID" strands={neutralStrands} baseline={{games:1,required:3,ready:false}} tier="FREE"/>
        <div className={ds.rowLower}>
          <MatchHistory rows={[]} windowLabel="Last 7 days" tier="FREE" loading={false} olderHidden={0}/>
          <CoachingIntelligence tier="FREE" baselineReady={false} habits={{stage:'SCANNING',careerGames:1,nextAt:3,items:[],hidden:0}} ladder={{state:'LOCKED',data:null}} memory={{state:'LOCKED',data:null}} improvement={{mastered:0,broken:null}}/>
        </div>
        <div className={ds.rowMission}>
          <MissionCard phase="CHECKING" role="MID" baseline={{games:0,required:3}} primary={null} secondary={null}/>
          <CoachingIntelligence tier="PRO" baselineReady habits={null} ladder={{state:'LOADING',data:null}} memory={{state:'LOADING',data:null}} improvement={{mastered:0,broken:0}}/>
        </div>
      </div>
    </section>
  </div>;
}
