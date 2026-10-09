'use client';
import {useRef} from 'react';
import Link from 'next/link';
import type {CareerDNA,HabitReading,Level,Stage} from '@/lib/dna/dna';
import {clock} from '@/lib/habits/detect';

/**
 * Career DNA page panels, in the app's broadcast-HUD language: clipped
 * modules, mono data labels, condensed display numbers. Each habit carries
 * its own colour through the --habit custom property.
 */

const pct=(n:number)=>`${Math.round(n*100)}%`;
const pad2=(n:number)=>String(n).padStart(2,'0');

const STAGE_LABEL:Record<Stage,string>={
  SCANNING:'SCANNING',FIRST_READ:'FIRST READ',PATTERNS:'PATTERNS FORMING',ESTABLISHED:'DNA ESTABLISHED',
};
const LEVEL_LABEL:Record<Level,string>={HABIT:'HABIT',PATTERN:'PATTERN',SIGNAL:'EARLY SIGNAL',WATCH:'WATCH',CLEAN:'CLEAN'};

export interface DnaTab{id:string;label:string;hint:string;locked?:boolean}

/**
 * Sub-tabs for the page, so each part gets the screen instead of one long scroll.
 * Sticky like the Champion HQ tabs; arrow keys, Home and End move between tabs.
 */
export function DnaTabs({tabs,active,onChange}:{tabs:DnaTab[];active:string;onChange:(id:string)=>void}){
  const refs=useRef<(HTMLButtonElement|null)[]>([]);
  const go=(i:number)=>{
    const n=(i+tabs.length)%tabs.length;
    onChange(tabs[n].id);
    refs.current[n]?.focus();
  };
  return <div className="dna-tabs" role="tablist" aria-label="Career DNA sections"
    onKeyDown={e=>{
      const i=tabs.findIndex(t=>t.id===active);
      if(e.key==='ArrowRight'){e.preventDefault();go(i+1)}
      else if(e.key==='ArrowLeft'){e.preventDefault();go(i-1)}
      else if(e.key==='Home'){e.preventDefault();go(0)}
      else if(e.key==='End'){e.preventDefault();go(tabs.length-1)}
    }}>
    {tabs.map((t,i)=><button key={t.id} ref={el=>{refs.current[i]=el}} type="button" role="tab"
      id={`dna-tab-${t.id}`} aria-controls={`dna-panel-${t.id}`} aria-selected={active===t.id} tabIndex={active===t.id?0:-1}
      className={`${active===t.id?'active':''}${t.locked?' locked':''}`} onClick={()=>onChange(t.id)}>
      <b><span>{pad2(i+1)}</span>{t.label}{t.locked&&<em>PRO</em>}</b>
      <small>{t.hint}</small>
    </button>)}
  </div>;
}

/** Section heading: mono index kicker over a condensed title. */
export function DnaSectionHead({index,kicker,title,aside}:{index:number;kicker:string;title:string;aside?:React.ReactNode}){
  return <div className="dna-section-head">
    <div>
      <div className="dna-kicker"><span>{pad2(index)}</span><i aria-hidden="true"/>{kicker}</div>
      <h2 className="dna-title">{title}</h2>
    </div>
    {aside&&<div className="dna-section-aside">{aside}</div>}
  </div>;
}

/**
 * The scan readout: stage, headline, a 10-cell sequencing bar with the 3/5/10
 * milestones, and the key numbers as broadcast stat tiles.
 */
export function DnaHud({dna,headline,showHistory,action}:{dna:CareerDNA;headline:string;showHistory:boolean;action?:React.ReactNode}){
  const filled=Math.min(dna.careerGames,10);
  const flagged=dna.habits.filter(h=>h.level!=='WATCH').length;
  const stats:{label:string;value:string;tone?:string}[]=[
    {label:'GAMES SEQUENCED',value:String(dna.careerGames)},
    {label:dna.stage==='ESTABLISHED'?'LAST 10':'RECORD',value:`${dna.record.wins}–${dna.record.losses}`},
    {label:'HABITS FLAGGED',value:String(flagged),tone:flagged?'warn':'good'},
    showHistory
      ?{label:'HABITS BROKEN',value:String(dna.broken.length),tone:dna.broken.length?'good':undefined}
      :{label:'CLEAN TRAITS',value:String(dna.strengths.length),tone:dna.strengths.length?'good':undefined},
  ];
  return <section className="dna-hud" aria-label="Career DNA scan">
    <div className="dna-hud-main">
      <div className="dna-kicker">
        <span className={`dna-status ${dna.stage==='ESTABLISHED'?'live':''}`}><i aria-hidden="true"/>{STAGE_LABEL[dna.stage]}</span>
        <i aria-hidden="true"/>GENOME SCAN
      </div>
      <p className="dna-headline">{headline}</p>
      <div className="dna-scan-seq" role="img" aria-label={`${filled} of the first 10 games read`}>
        <div className="dna-seq-cells">
          {Array.from({length:10},(_,i)=>{
            const n=i+1;
            const milestone=n===3||n===5||n===10;
            return <span key={n} className={`${n<=filled?'on':''} ${milestone?'mark':''} ${n===filled&&dna.stage!=='ESTABLISHED'?'head':''}`}/>;
          })}
        </div>
        <div className="dna-seq-labels" aria-hidden="true">
          <span style={{left:'30%'}} className={dna.careerGames>=3?'on':''}>G03</span>
          <span style={{left:'50%'}} className={dna.careerGames>=5?'on':''}>G05</span>
          <span style={{left:'100%'}} className={dna.careerGames>=10?'on':''}>G10 · DNA</span>
        </div>
        <p className="dna-seq-note">
          {dna.stage==='ESTABLISHED'
            ?`Updated after every game · reading your last ${dna.windowGames}`
            :dna.next?`${dna.next.remaining} more ranked game${dna.next.remaining===1?'':'s'} to ${dna.next.at===3?'your first read':dna.next.at===5?'patterns':'your full DNA'}`:''}
        </p>
      </div>
      {action&&<div className="dna-hud-action">{action}</div>}
    </div>
    <div className="dna-hud-stats">
      {stats.map(s=><div key={s.label} className={`dna-stat ${s.tone||''}`}>
        <span>{s.label}</span><strong>{s.value}</strong>
      </div>)}
    </div>
  </section>;
}

export interface RecentMoment{matchId:string;champion:string;when:string;t:number;d:string}

/** Where a habit stands as a Game DNA strand mission. */
export type HabitMissionState=
  |{state:'NONE'}
  |{state:'ACTIVE';confirmed:number;required:number;locked:boolean};

/** One habit as an esports stat card: rank, rate, cost, the fix, where to watch it, and its strand mission. */
export function HabitCard({h,rank,stage,moments,showTrend,colour,strand,mission,focused,dimmed,onMakeMission,onOpenMission,onShow}:{
  h:HabitReading;rank:number;stage:Stage;moments:RecentMoment[];showTrend:boolean;colour:string;
  /** The Game DNA strand this habit belongs to. */
  strand:{label:string;colour:string};
  mission:HabitMissionState;
  focused:boolean;dimmed:boolean;onMakeMission:()=>void;onOpenMission:()=>void;onShow:()=>void;
}){
  const t=showTrend?h.trend:undefined;
  const costly=h.cost&&h.cost.withoutIt>h.cost.withIt?h.cost:undefined;
  return <article className={`glass card dna-habit level-${h.level.toLowerCase()}${focused?' is-focus':''}${dimmed?' is-dim':''}`}
    style={{'--habit':colour} as React.CSSProperties}>
    <span className="dna-habit-rank" aria-hidden="true">{pad2(rank)}</span>
    <header>
      <span className="dna-habit-level"><i aria-hidden="true"/>{LEVEL_LABEL[h.level]}
        <em className="dna-habit-strand" style={{'--strand':strand.colour} as React.CSSProperties}>{strand.label.toUpperCase()} STRAND</em></span>
      <h3>{h.def.name}</h3>
    </header>

    <div className="dna-habit-numbers">
      <strong>{pct(h.rate)}</strong>
      <div>
        <span>{h.occurred} / {h.measured} GAMES</span>
        {h.perGame>=1&&<span>{h.perGame.toFixed(1)} {h.def.unit.toUpperCase()}S / GAME</span>}
      </div>
    </div>
    <div className="dna-habit-meter" aria-hidden="true">
      {Array.from({length:h.measured},(_,i)=><i key={i} className={i<h.occurred?'hit':''}/>)}
    </div>
    <p className="dna-habit-desc">{h.def.description}</p>

    {t&&<p className={`dna-trend ${t.direction.toLowerCase()}`}>
      <b>{t.direction==='IMPROVING'?'▼ IMPROVING':t.direction==='WORSE'?'▲ GETTING WORSE':'■ HOLDING'}</b>
      {pct(t.birthRate)} first 10 → {pct(t.currentRate)} last 10
    </p>}

    {costly&&<div className="dna-cost" aria-label={`Win rate ${pct(costly.withIt)} with it, ${pct(costly.withoutIt)} without`}>
      <div className="dna-cost-row with"><span>WITH IT</span><i style={{width:pct(costly.withIt)}}/><b>{pct(costly.withIt)}</b></div>
      <div className="dna-cost-row without"><span>WITHOUT</span><i style={{width:pct(costly.withoutIt)}}/><b>{pct(costly.withoutIt)}</b></div>
      <small>WIN RATE</small>
    </div>}

    <div className="dna-rule"><span>THE FIX</span><b>{h.def.rule}</b></div>

    {moments.length>0&&<div className="dna-moments-wrap">
      <span className="dna-label">WATCH IT BACK</span>
      <ul className="dna-moments">{moments.map(m=><li key={`${m.matchId}-${m.t}`}>
        <time>{clock(m.t)}</time>
        <Link href={`/analyse/${encodeURIComponent(m.matchId)}`}>{m.champion} · {m.when} — {m.d}</Link>
      </li>)}</ul>
    </div>}

    <div className="dna-habit-actions">
      {mission.state==='ACTIVE'
        ?<button type="button" className="dna-in-plan" onClick={onOpenMission}>
          ✓ YOUR {strand.label.toUpperCase()} MISSION · {mission.confirmed}/{mission.required} CLEAN
        </button>
        :<button type="button" className="btn primary" onClick={onMakeMission}>MAKE IT MY {strand.label.toUpperCase()} MISSION</button>}
      <button type="button" className="dna-show" onClick={onShow} aria-pressed={focused}>SHOW ON STRAND →</button>
    </div>
    {mission.state==='ACTIVE'&&mission.locked&&<p className="dna-mission-note">
      Your {strand.label} tree is locked, so games are measured but not banked yet. <Link href="/missions">Unlock it on Missions →</Link>
    </p>}
    {mission.state==='NONE'&&<p className="dna-mission-note">
      Replaces your current {strand.label} mission until you have played 3 clean games. Your current mission comes back after.
    </p>}
    <p className="dna-source">
      {h.def.source}{h.def.caveat?` — ${h.def.caveat}`:''}
      {stage!=='ESTABLISHED'&&' Early reads can change as more games come in.'}
    </p>
  </article>;
}
