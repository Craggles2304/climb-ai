'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {IssueCategory,Match} from '@/lib/types';
import {coachingLevelFor} from '@/lib/coachingLevel';

type Suggestion={title:string;category:IssueCategory;why:string;gameRule:string;metric:string;target:string;source:'COACH';priority?:number};
type Msg={who:'user'|'ai';text:string;task?:Suggestion;grounding?:string;factsUsed?:string[];applied?:boolean};
type CoachResponse={answer?:string;error?:string;suggestion?:Suggestion;grounding?:string;factsUsed?:string[]};
type HistoryTurn={role:'user'|'assistant';content:string};

const THREAD_KEY='op_climb_coach_thread_v1';
const MAX_SAVED_MESSAGES=30;
const MAX_CONTEXT_MESSAGES=10;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const promptCards=[
  {icon:'↗',title:'CLIMB',text:'What is stopping my next rank?',ask:'What is stopping me reaching the next rank based on my Active Five and recent games?'},
  {icon:'◫',title:'FARM',text:'Where am I losing farm?',ask:'Why does my CS drop and what should I change in my Active Five?'},
  {icon:'✕',title:'DEATHS',text:'Why am I dying?',ask:'What is the main reason I am dying and what should I practise next?'},
  {icon:'◎',title:'OBJECTIVES',text:'Am I arriving too late?',ask:'Am I setting up objectives too late and what is the next-game cue?'},
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
function isTrendQuestion(text:string){
  const q=text.toLowerCase();
  if(/\b(last|past|previous|recent)\s+[2-5]\s+games?\b/.test(q))return true;
  if(/\b(over|across|based on)\b.{0,35}\b(last|past|previous|recent)\b.{0,25}\bgames?\b/.test(q))return true;
  return /\b(improv(?:e|ed|ement)?|progress|trend|better|worse|changed?|compare|comparison)\b/.test(q)&&/\bgames?\b/.test(q);
}
function requestedTrendGames(text:string){
  const match=text.toLowerCase().match(/\b(?:last|past|previous|recent)\s+([2-5])\s+games?\b/);
  const n=match?Number(match[1]):3;
  return Math.max(2,Math.min(5,Number.isFinite(n)?n:3));
}
function validStoredMessages(value:unknown):Msg[]{
  if(!Array.isArray(value))return [];
  return value.filter((m):m is Msg=>Boolean(m&&typeof m==='object'&&((m as Msg).who==='user'||(m as Msg).who==='ai')&&typeof (m as Msg).text==='string')).slice(-MAX_SAVED_MESSAGES);
}
function threadHistory(messages:Msg[]):HistoryTurn[]{
  return messages.filter(m=>m.text.trim()).slice(-MAX_CONTEXT_MESSAGES).map(m=>({role:m.who==='ai'?'assistant':'user',content:m.text.slice(0,2200)}));
}
function welcome(priority:string|undefined,tier:string,summary:string):Msg{
  return{who:'ai',text:`I’m your ${tier} Coach. ${summary}${priority?` Your first focus is “${priority}”.`:' Play a tracked game and I’ll build your first evidence-backed focus.'}`,grounding:'ilp-and-profile',factsUsed:['active_ilp_tasks','rank']};
}

function Grounding({m}:{m:Msg}){
  if(m.who!=='ai'||!m.grounding)return null;
  const label=m.grounding==='recorded-live-telemetry'?'LIVE EVIDENCE':m.grounding.includes('recent-match')?'RECENT GAMES + ACTIVE FIVE':m.grounding.includes('conversation')?'THREAD + ACTIVE FIVE':m.grounding.includes('champion')?'CHAMPION + ACTIVE FIVE':'ACTIVE FIVE';
  return <div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap',marginBottom:7}}><span className="op-tier op-tier-plus" style={{fontSize:8}}>{label}</span>{m.factsUsed?.slice(0,3).map(f=><span key={f} className="muted" style={{fontSize:9}}>{f.replaceAll('_',' ')}</span>)}</div>;
}

function Message({m,collapseAt}:{m:Msg;collapseAt:number}){
  const body=<><Grounding m={m}/><div style={{whiteSpace:'pre-line'}}>{m.text}</div></>;
  const long=m.who==='ai'&&m.text.length>collapseAt;
  if(!long)return <div className={`vf-message ${m.who}`}>{body}</div>;
  const preview=m.text.slice(0,Math.max(180,collapseAt-80)).replace(/\s+\S*$/,'').trim();
  return <details className="vf-message ai"><summary><span>{preview}…</span><b>SHOW MORE</b></summary><div className="vf-message-full"><Grounding m={m}/><div style={{whiteSpace:'pre-line'}}>{m.text}</div></div></details>;
}

export default function Coach(){
  const {active}=useAccount();
  const matches=matchesFor(active.id).filter(match=>match.durationSeconds>=300);
  const {tasks,addTask}=useLearningPlan();
  const activeFive=tasks.filter(t=>t.status!=='MASTERED'&&t.status!=='PAUSED').slice(0,5);
  const priorityTitle=activeFive[0]?.title;
  const detail=useMemo(()=>coachingLevelFor(active.rank),[active.rank]);
  const [q,setQ]=useState('');
  const [pending,setPending]=useState(false);
  const [messages,setMessages]=useState<Msg[]>([]);
  const loadedAccount=useRef('');
  const context=useMemo(()=>`${active.gameName}${active.tagline} · ${active.rank} · ${active.role}`,[active]);
  const summary=useMemo(()=>recentSummary(matches),[matches]);
  const collapseAt=detail.depth<=2?300:detail.depth<=4?390:detail.depth<=6?520:680;

  useEffect(()=>{
    if(loadedAccount.current===active.id)return;
    let restored:Msg[]=[];
    try{const raw=localStorage.getItem(`${THREAD_KEY}:${active.id}`);if(raw)restored=validStoredMessages(JSON.parse(raw))}catch{}
    loadedAccount.current=active.id;
    setMessages(restored.length?restored:[welcome(priorityTitle,detail.tier,detail.summary)]);
  },[active.id,priorityTitle,detail.tier,detail.summary]);

  useEffect(()=>{
    if(loadedAccount.current!==active.id||!messages.length)return;
    try{localStorage.setItem(`${THREAD_KEY}:${active.id}`,JSON.stringify(messages.slice(-MAX_SAVED_MESSAGES)))}catch{}
  },[active.id,messages]);

  async function send(t?:string){
    const text=(t??q).trim();if(!text||pending)return;
    const history=threadHistory(messages);
    const userMessage:Msg={who:'user',text};
    const activeTaskContext=activeFive.map(task=>({title:task.title,category:task.category,metric:task.metric,progress:task.progress,target:task.target,gameRule:task.gameRule}));
    const useTrend=isTrendQuestion(text)&&UUID.test(active.id);
    setQ('');setPending(true);setMessages(m=>[...m,userMessage].slice(-MAX_SAVED_MESSAGES));
    try{
      const endpoint=useTrend?'/api/coach/trend':'/api/coach';
      const payload=useTrend
        ?{message:text,history,accountId:active.id,requestedGames:requestedTrendGames(text),activeTasks:activeTaskContext,rank:active.rank}
        :{message:text,history,context:{rank:active.rank,role:active.role,mission:activeFive[0]?.title,champions:active.champions,activeTasks:activeTaskContext,recent:summary}};
      const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const body=await res.json() as CoachResponse;
      if(!res.ok)throw new Error(body.error||'Coach request failed.');
      const aiMessage:Msg={who:'ai',text:body.answer||'I do not have enough evidence to answer that yet.',task:body.suggestion,grounding:body.grounding,factsUsed:body.factsUsed};
      setMessages(m=>[...m,aiMessage].slice(-MAX_SAVED_MESSAGES));
    }catch(error){
      const errorMessage:Msg={who:'ai',text:`I couldn’t load that evidence just now. Your first focus is still “${activeFive[0]?.title||'waiting for evidence'}”. ${error instanceof Error?error.message:''}`,grounding:'ilp-and-profile',factsUsed:['active_ilp_tasks']};
      setMessages(m=>[...m,errorMessage].slice(-MAX_SAVED_MESSAGES));
    }finally{setPending(false)}
  }

  function applyProposal(index:number,task:Suggestion){
    addTask(task);
    setMessages(current=>current.map((m,i)=>i===index?{...m,applied:true}:m));
  }

  function resetThread(){
    const next:Msg[]=[welcome(activeFive[0]?.title,detail.tier,detail.summary)];
    setMessages(next);
    try{localStorage.setItem(`${THREAD_KEY}:${active.id}`,JSON.stringify(next))}catch{}
  }

  return <AppShell>
    <PageHead title={`${detail.tier} Coach`} subtitle={context} action={<Link href="/ilp" className="btn secondary">MY ACTIVE FIVE</Link>}/>

    <section className="vf-coach-hero">
      <div><div className="eyebrow">COACHING DEPTH · {detail.depth}/10</div><h2>{activeFive[0]?.title||'Build your first focus'}</h2><p>{detail.summary} {activeFive[0]?.gameRule||'Track a game and your Coach will turn the strongest evidence into one clear next-game action.'}</p><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}><span className="op-tier op-tier-pro">{detail.tier} COACH</span><span className="op-tier op-tier-plus">5 ACTIVE</span><span className="op-tier op-tier-plus">{summary.games} RECENT GAME{summary.games===1?'':'S'}</span></div></div>
      <Link href="/live" className="vf-live-orb"><span>●</span><b>LIVE</b><small>TRACK GAME</small></Link>
    </section>

    <div className="vf-plan-rail">
      {activeFive.map((t,i)=><Link href="/ilp" key={t.id} className={i===0?'active':''}><span>0{i+1}</span><div><b>{t.title}</b><i style={{width:`${t.progress}%`}}/></div><strong>{t.progress}%</strong></Link>)}
    </div>

    <section className="vf-coach-prompts">
      {promptCards.slice(0,detail.visiblePoints<=2?3:4).map(card=><button key={card.title} onClick={()=>void send(card.ask)} disabled={pending}><span>{card.icon}</span><div><b>{card.title}</b><small>{card.text}</small></div></button>)}
    </section>

    <section className="vf-coach-console">
      <div className="vf-chat-head"><div><div className="eyebrow">{detail.tier} COACH</div><b>Ask one thing. Get the amount of detail that matches your rank.</b></div><div style={{display:'flex',gap:8,alignItems:'center'}}><span>{pending?'READING YOUR GAMES…':`${messages.length} MESSAGES`}</span><button className="btn secondary" style={{padding:'7px 9px',fontSize:9}} onClick={resetThread} disabled={pending}>RESET</button></div></div>
      <div className="vf-chat-list">
        {messages.map((m,i)=><div key={i}><Message m={m} collapseAt={collapseAt}/>{m.task&&<div className="vf-coach-proposal"><div><span>{m.applied?'ACTIVE FIVE UPDATED':'NEXT FOCUS'}</span><h3>{m.task.title}</h3><p>{m.task.gameRule}</p>{detail.depth>=3&&<small className="muted">{m.task.target}</small>}</div><button className={`btn ${m.applied?'secondary':'primary'}`} disabled={m.applied} onClick={()=>applyProposal(i,m.task!)}>{m.applied?'IN ACTIVE FIVE':'ADD TO ACTIVE FIVE'}</button></div>}</div>)}
        {pending&&<div className="vf-message ai"><div>Reading your Active Five and recent evidence…</div></div>}
      </div>
      <div className="vf-coach-input"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void send()}} placeholder="Ask your Coach about a death, farm, fight, objective or recent game…" disabled={pending}/><button onClick={()=>void send()} disabled={pending}>{pending?'…':'SEND ↗'}</button></div>
    </section>
  </AppShell>;
}
