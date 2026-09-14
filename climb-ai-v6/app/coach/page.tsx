'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {IssueCategory,Match} from '@/lib/types';

type Suggestion={title:string;category:IssueCategory;why:string;gameRule:string;metric:string;target:string;source:'COACH';priority?:number};
type Msg={who:'user'|'ai';text:string;task?:Suggestion;grounding?:string;factsUsed?:string[];applied?:boolean};
type CoachResponse={answer?:string;error?:string;suggestion?:Suggestion;grounding?:string;factsUsed?:string[]};

const promptCards=[
  {icon:'↗',title:'CLIMB',text:'What is actually blocking the next rank?',ask:'What is stopping me reaching the next rank based on my plan and recent games?'},
  {icon:'◫',title:'ECONOMY',text:'Find where my farm is actually leaking.',ask:'Why does my CS drop and what should I change in my ILP?'},
  {icon:'✕',title:'DEATHS',text:'Separate bad deaths from positioning guesses.',ask:'Are my late deaths a real teamfight problem and what should I practise?'},
  {icon:'◎',title:'OBJECTIVES',text:'Connect waves, recalls and objective setup.',ask:'Am I setting up objectives too late and what is the next-game cue?'},
];

const avgDefined=(values:(number|undefined)[])=>{const clean=values.filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));return clean.length?clean.reduce((a,b)=>a+b,0)/clean.length:undefined};
function recentSummary(matches:Match[]){
  const r=matches.slice(0,5);
  return{
    games:r.length,
    csPerMin:avgDefined(r.map(m=>m.metrics.csPerMin)),
    laneCsPerMin:avgDefined(r.map(m=>m.metrics.laneCsPerMin)),
    post15CsPerMin:avgDefined(r.map(m=>m.metrics.post15CsPerMin)),
    deaths:avgDefined(r.map(m=>m.deaths)),
    deathsPost20:avgDefined(r.map(m=>m.metrics.deathsPost20)),
    objectiveParticipation:avgDefined(r.map(m=>m.metrics.objectiveParticipation)),
    damageShare:avgDefined(r.map(m=>m.metrics.damageShare)),
    killParticipation:avgDefined(r.map(m=>m.metrics.killParticipation)),
    visionScore:avgDefined(r.map(m=>m.metrics.visionScore)),
    secondItemMinute:avgDefined(r.map(m=>m.metrics.secondItemMinute)),
  };
}

function Grounding({m}:{m:Msg}){
  if(m.who!=='ai'||!m.grounding)return null;
  const label=m.grounding==='recorded-live-telemetry'?'LIVE EVIDENCE':m.grounding.includes('recent-match')?'RECENT MATCHES + ILP':m.grounding.includes('champion')?'CHAMPION + ILP':'ILP CONTEXT';
  return <div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap',marginBottom:7}}><span className="op-tier op-tier-plus" style={{fontSize:8}}>{label}</span>{m.factsUsed?.slice(0,3).map(f=><span key={f} className="muted" style={{fontSize:9}}>{f.replaceAll('_',' ')}</span>)}</div>;
}

function Message({m}:{m:Msg}){
  const body=<><Grounding m={m}/><div>{m.text}</div></>;
  const long=m.who==='ai'&&m.text.length>340;
  if(!long)return <div className={`vf-message ${m.who}`}>{body}</div>;
  const preview=m.text.slice(0,240).replace(/\s+\S*$/,'').trim();
  return <details className="vf-message ai"><summary><span>{preview}…</span><b>OPEN FULL COACHING</b></summary><div className="vf-message-full"><Grounding m={m}/>{m.text}</div></details>;
}

export default function Coach(){
  const {active}=useAccount();
  const matches=matchesFor(active.id);
  const {tasks,addTask}=useLearningPlan();
  const activeFive=tasks.filter(t=>t.status!=='MASTERED'&&t.status!=='PAUSED').slice(0,5);
  const [q,setQ]=useState('');
  const [pending,setPending]=useState(false);
  const [messages,setMessages]=useState<Msg[]>([{who:'ai',text:`I am linked to your active ILP. Current priority: ${activeFive[0]?.title||'waiting for evidence'}. Ask me about one decision and I will ground it in your plan and recent games.`,grounding:'ilp-and-profile',factsUsed:['active_ilp_tasks']}]);
  const context=useMemo(()=>`${active.gameName}${active.tagline} · ${active.rank} · ${active.role}`,[active]);
  const summary=useMemo(()=>recentSummary(matches),[matches]);

  async function send(t?:string){
    const text=(t??q).trim();if(!text||pending)return;
    setQ('');setPending(true);setMessages(m=>[...m,{who:'user',text}]);
    try{
      const res=await fetch('/api/coach',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:text,context:{rank:active.rank,role:active.role,mission:activeFive[0]?.title,champions:active.champions,activeTasks:activeFive.map(task=>({title:task.title,category:task.category,metric:task.metric,progress:task.progress,target:task.target,gameRule:task.gameRule})),recent:summary}})});
      const body=await res.json() as CoachResponse;
      if(!res.ok)throw new Error(body.error||'Coach request failed.');
      setMessages(m=>[...m,{who:'ai',text:body.answer||'I do not have enough evidence to answer that yet.',task:body.suggestion,grounding:body.grounding,factsUsed:body.factsUsed}]);
    }catch(error){
      setMessages(m=>[...m,{who:'ai',text:`Coach could not load the evidence response. Your active #1 is still “${activeFive[0]?.title||'waiting for evidence'}”. ${error instanceof Error?error.message:''}`,grounding:'ilp-and-profile',factsUsed:['active_ilp_tasks']}]);
    }finally{setPending(false)}
  }

  function applyProposal(index:number,task:Suggestion){
    addTask(task);
    setMessages(current=>current.map((m,i)=>i===index?{...m,applied:true}:m));
  }

  return <AppShell>
    <PageHead title="Coach" subtitle={context} action={<Link href="/ilp" className="btn secondary">MY ACTIVE FIVE</Link>}/>

    <section className="vf-coach-hero">
      <div><div className="eyebrow">ADAPTIVE COACHING LENS</div><h2>{activeFive[0]?.title||'Build your first priority'}</h2><p>{activeFive[0]?.gameRule||'Track a game and OP CLIMB will promote the first evidence-backed behaviour.'}</p><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}><span className="op-tier op-tier-pro">5 ACTIVE TRACKS</span><span className="op-tier op-tier-plus">{summary.games} RECENT GAME{summary.games===1?'':'S'} READ</span></div></div>
      <Link href="/live" className="vf-live-orb"><span>●</span><b>LIVE</b><small>TRACK EVIDENCE</small></Link>
    </section>

    <div className="vf-plan-rail">
      {activeFive.map((t,i)=><Link href="/ilp" key={t.id} className={i===0?'active':''}><span>0{i+1}</span><div><b>{t.title}</b><i style={{width:`${t.progress}%`}}/></div><strong>{t.progress}%</strong></Link>)}
    </div>

    <section className="vf-coach-prompts">
      {promptCards.map(card=><button key={card.title} onClick={()=>void send(card.ask)} disabled={pending}><span>{card.icon}</span><div><b>{card.title}</b><small>{card.text}</small></div></button>)}
    </section>

    <section className="vf-coach-console">
      <div className="vf-chat-head"><div><div className="eyebrow">EVIDENCE COACH THREAD</div><b>One decision → one cue → one ILP action.</b></div><span>{pending?'READING EVIDENCE…':`${messages.length} MESSAGES`}</span></div>
      <div className="vf-chat-list">
        {messages.map((m,i)=><div key={i}><Message m={m}/>{m.task&&<div className="vf-coach-proposal"><div><span>{m.applied?'ILP UPDATED':'ILP PROPOSAL'}</span><h3>{m.task.title}</h3><p>{m.task.gameRule}</p><small className="muted">{m.task.target}</small></div><button className={`btn ${m.applied?'secondary':'primary'}`} disabled={m.applied} onClick={()=>applyProposal(i,m.task!)}>{m.applied?'APPLIED TO ACTIVE FIVE':'APPLY TO ACTIVE FIVE'}</button></div>}</div>)}
        {pending&&<div className="vf-message ai"><div>Reading your five active missions and recent match evidence…</div></div>}
      </div>
      <div className="vf-coach-input"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void send()}} placeholder="Ask about a death, farm drop, objective, recall, champion or timestamp…" disabled={pending}/><button onClick={()=>void send()} disabled={pending}>{pending?'…':'SEND ↗'}</button></div>
    </section>
  </AppShell>;
}
