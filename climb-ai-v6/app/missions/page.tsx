'use client';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {missionEvidence,missionSummary} from '@/lib/missionLoop';
import {coachingLevelFor} from '@/lib/coachingLevel';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {missionRankBand} from '@/lib/rankMissionBenchmarks';

export default function Missions(){
  const {active}=useAccount();
  const matches=matchesFor(active.id).filter(match=>match.durationSeconds>=300);
  const last=matches[0];
  const {tasks}=useLearningPlan();
  const detail=coachingLevelFor(active.rank);
  const activeThree=tasks.filter(task=>task.status!=='MASTERED'&&task.status!=='PAUSED').slice(0,3);
  const mastered=tasks.filter(task=>task.status==='MASTERED').length;

  return <AppShell>
    <PageHead title="Mission Lab" subtitle={`${active.gameName}${active.tagline} · ${active.rank} · ${detail.tier} MISSIONS ${detail.depth}/10`} action={<Link href="/ilp" className="btn secondary">MY 3 MISSIONS</Link>}/>

    <section className="glass card" style={{marginBottom:18,borderColor:'rgba(182,246,107,.22)'}}>
      <div className="eyebrow">{detail.tier} MISSION VIEW</div>
      <h2 style={{fontSize:'clamp(28px,4vw,46px)',margin:'8px 0 10px',letterSpacing:'-.04em'}}>{detail.depth<=2?'Do it. Prove it. Move on.':'Plan it → run it → prove it → replace it.'}</h2>
      <p className="muted" style={{maxWidth:820,lineHeight:1.6}}>{detail.depth<=2?'One core mission is your main job. Two support missions keep other important habits moving without stealing your attention.':'Your core mission is the biggest measurable limiter. Two support missions stay active behind it. Every target scales to your current rank and updates from finished-game evidence.'}</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}><span className="op-tier op-tier-pro">{activeThree.length}/3 ACTIVE</span><span className="op-tier op-tier-plus">{missionRankBand(active.rank)} TARGETS</span>{detail.depth>=3&&<span className="op-tier op-tier-plus">{mastered} MASTERED</span>}{detail.depth>=4&&<span className="op-tier op-tier-plus">{last?`LAST GAME: ${last.champion} ${last.result}`:'WAITING FOR MATCH EVIDENCE'}</span>}</div>
    </section>

    {activeThree.length===0?<section className="glass card"><div className="eyebrow">WAITING FOR PLAN</div><h2>No active missions yet.</h2><p className="muted">Track a game and OP CLIMB will build your first evidence-backed priorities.</p></section>:
    <div style={{display:'grid',gap:16}}>{activeThree.map((task,index)=>{
      const summary=missionSummary(task);
      const evidence=missionEvidence(task,last);
      return <section key={task.id} className="glass card" style={{borderColor:index===0?'rgba(182,246,107,.34)':'var(--border)',padding:22}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}>
          <div style={{minWidth:0,flex:'1 1 520px'}}>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><span className="eyebrow">{index===0?'CORE MISSION':'SUPPORT 0'+index}{detail.depth>=3?` · ${task.category.replaceAll('_',' ')}`:''}</span>{detail.depth>=4&&<span className={`op-tier ${index===0?'op-tier-pro':'op-tier-plus'}`}>{summary.stage}</span>}</div>
            <h2 style={{fontSize:'clamp(25px,3vw,38px)',lineHeight:1.03,letterSpacing:'-.04em',margin:'10px 0'}}>{plainLanguageFocus(task).name}</h2>
            <p style={{fontSize:16,lineHeight:1.55,margin:'0 0 12px'}}><b>PLAIN ENGLISH:</b> {plainLanguageFocus(task).meaning}</p>
            {detail.depth>=2&&<p className="muted" style={{lineHeight:1.55,margin:0}}>{task.why}</p>}
          </div>
          <div style={{minWidth:210,padding:'14px 16px',border:'1px solid var(--border)',background:'rgba(255,255,255,.025)'}}>
            <div className="label">{detail.depth<=2?'PROGRESS':'CONFIRMED REPS'}</div><div style={{fontSize:34,fontWeight:950,letterSpacing:'-.05em',margin:'4px 0'}}>{detail.depth<=2?`${task.progress}%`:`${summary.confirmed}/${summary.required}`}</div>{detail.depth>=3&&<div className="muted" style={{fontSize:12}}>{summary.reviewed} mission review{summary.reviewed===1?'':'s'} · {task.progress}% plan progress</div>}
          </div>
        </div>

        <div style={{margin:'18px 0 14px',height:8,background:'rgba(255,255,255,.06)',overflow:'hidden'}}><div style={{width:`${Math.max(0,Math.min(100,task.progress))}%`,height:'100%',background:'linear-gradient(90deg,#b6f66b,#b6f66b)'}}/></div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:10,marginBottom:14}}>
          {detail.depth>=2&&<div style={{padding:13,border:'1px solid var(--border)'}}><div className="label">PASS WHEN</div><b>{task.target}</b></div>}
          {detail.depth>=3&&<div style={{padding:13,border:'1px solid var(--border)'}}><div className="label">LAST GAME</div><b className={evidence.available?(evidence.clearedBar?'success':'danger'):''}>{evidence.valueLabel}</b>{detail.depth>=4&&<small className="muted" style={{display:'block',marginTop:5}}>{evidence.reason}</small>}</div>}
          {detail.depth>=5&&<div style={{padding:13,border:'1px solid var(--border)'}}><div className="label">WHY IT CHANGED</div><b>{task.source==='COACH'?'COACH + GAME PLAN':'MATCH EVIDENCE'}</b><small className="muted" style={{display:'block',marginTop:5}}>{task.lastUpdatedReason||'Evidence is still building.'}</small></div>}
        </div>

        {detail.depth>=3&&<div style={{padding:14,border:'1px solid rgba(182,246,107,.2)',background:'rgba(182,246,107,.05)'}}><div className="eyebrow">{last&&evidence.available?'AUTOMATIC TRACKING':'WAITING FOR EVIDENCE'}</div><p className="muted" style={{margin:'6px 0 0'}}>{last&&evidence.available?(evidence.clearedBar?'Last game cleared this mission bar. OP CLIMB banks the rep automatically.':'Last game did not clear the mission bar. No manual pass can override it.'):evidence.reason}</p></div>}
      </section>;
    })}</div>}

    <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:18}}><Link className="btn primary" href="/live">PLAY + TRACK</Link><Link className="btn secondary" href="/coach">ASK {detail.tier} COACH</Link><Link className="btn secondary" href="/ilp">MY 3 MISSIONS</Link>{detail.depth>=3&&<Link className="btn secondary" href="/analyse">REVIEW LAST GAME</Link>}</div>
  </AppShell>;
}
