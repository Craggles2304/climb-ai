'use client';

import {useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {DNA_DOMAINS,DNA_DOMAIN_COLORS,DNA_DOMAIN_LABELS,DNA_DOMAIN_GUIDE} from '@/lib/dnaDomain';
import {gameDnaStrands} from '@/lib/gameDnaSnapshot';
import {missionSummary} from '@/lib/missionLoop';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import type {DnaDomain,ILPTask,Role} from '@/lib/types';

export function DashboardDnaInspector({tasks,role,baselineReady,baselineGames,baselineRequired}:{tasks:ILPTask[];role:Role;baselineReady:boolean;baselineGames:number;baselineRequired:number}){
  const [selected,setSelected]=useState<DnaDomain>('LANING');
  const strands=gameDnaStrands(tasks,role,baselineReady);
  const strand=strands.find(row=>row.domain===selected);
  const task=tasks.find(row=>row.dnaDomain===selected&&row.status!=='PAUSED'&&row.status!=='MASTERED')??null;
  const summary=task?missionSummary(task):null;
  const plain=task?plainLanguageFocus(task):null;
  const guide=DNA_DOMAIN_GUIDE[selected];
  return <div className="arena-original-dna-inspector">
    <div className="op-home-dna-legend arena-original-dna-tabs" role="group" aria-label="Inspect one of your six Game DNA strands">
      {DNA_DOMAINS.map(domain=><button key={domain} type="button"
        aria-pressed={selected===domain} className={selected===domain?'is-selected':''}
        style={{'--strand-color':baselineReady?DNA_DOMAIN_COLORS[domain]:'#7d8b99'} as CSSProperties}
        onClick={()=>setSelected(domain)}><i aria-hidden="true"/>{DNA_DOMAIN_LABELS[domain]}</button>)}
    </div>
    <div className="arena-original-dna-selected" style={{'--strand-color':baselineReady?DNA_DOMAIN_COLORS[selected]:'#7d8b99'} as CSSProperties} aria-live="polite">
      <div className="arena-original-dna-summary">
        <span className="arena-original-dna-id">STRAND INTELLIGENCE / {String(DNA_DOMAINS.indexOf(selected)+1).padStart(2,'0')}</span>
        <h3>{DNA_DOMAIN_LABELS[selected]}</h3>
        <p>{!baselineReady?guide.summary:task?(plain?.nextGame||task.gameRule):guide.summary}</p>
      </div>
      <div className="arena-original-dna-proof">
        <small>{!baselineReady?'ROLE BASELINE':task?'VERIFIED MISSION REPS':'DEVELOPMENT STATUS'}</small>
        <strong>{!baselineReady?Math.min(baselineGames,baselineRequired)+' / '+baselineRequired:task&&summary?summary.confirmed+' / '+summary.required:strand?.mastered?'MISSION MASTERED':'NOT OBSERVED'}</strong>
        <span>{!baselineReady?'Your DNA stays neutral until the baseline is ready.':task?'Only reviewed, verified evidence moves this mission.':'No active evidence for this strand yet.'}</span>
      </div>
      <Link className="arena-original-dna-cta" href="/ilp">EXPLORE STRAND ↗</Link>
    </div>
  </div>;
}
