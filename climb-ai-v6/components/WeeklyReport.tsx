'use client';
import Link from 'next/link';
import {WeeklyReport as Report,ReportLine} from '@/lib/dna/report';
import {HABITS} from '@/lib/habits/library';
import {HABIT_COLOURS} from '@/lib/habits/colours';

const pct=(n:number)=>`${Math.round(n*100)}%`;
const CHANGE_LABEL:Record<ReportLine['change'],string>={IMPROVED:'Improved',WORSE:'Worse',UNCHANGED:'Unchanged',NEW:'This week'};

/** The weekly DNA report. `compact` shows the headline and focus only; `linkOut` adds a link to the full week in My DNA. */
export function WeeklyReport({report,compact=false,linkOut=false}:{report:Report;compact?:boolean;linkOut?:boolean}){
  const range=`${new Date(report.from).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – ${new Date(report.to).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`;
  return <section className="glass card week">
    <div className="week-head">
      <div>
        <div className="dna-kicker"><span>7D</span><i aria-hidden="true"/>WEEKLY REPORT</div>
        <h2 className="dna-title">Your week</h2>
      </div>
      <span className="muted">{range}{report.games?` · ${report.wins}W ${report.losses}L`:''}</span>
    </div>
    <p className="week-headline">{report.headline}</p>

    {!compact&&report.lines.length>0&&<ul className="week-lines">
      {report.lines.map(l=><li key={l.id} className={l.change.toLowerCase()} style={{'--habit':HABIT_COLOURS[l.id]} as React.CSSProperties}>
        <b><i className="habit-dot" aria-hidden="true"/>{l.name}</b>
        <span className="week-change">{CHANGE_LABEL[l.change]}</span>
        <span className="week-nums">{l.before===null?pct(l.now):`${pct(l.before)} → ${pct(l.now)}`}</span>
      </li>)}
    </ul>}

    {report.focus&&<div className="dna-rule week-focus" style={{'--habit':HABIT_COLOURS[report.focus.id]} as React.CSSProperties}>
      <span>FOCUS FOR NEXT WEEK · {HABITS[report.focus.id].name.toUpperCase()}</span>
      <b>{HABITS[report.focus.id].rule}</b>
    </div>}
    {report.status==='FIRST_WEEK'&&!compact&&<p className="dna-source">Your first report. From next week, each habit is compared with the games before it.</p>}
    {linkOut&&<Link className="text-link" href="/ilp#week">OPEN YOUR WEEK IN MY DNA</Link>}
  </section>;
}
