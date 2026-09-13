'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {ILPTask,IssueCategory} from '@/lib/types';

type Suggestion={title:string;category:IssueCategory;why:string;gameRule:string;metric:string;target:string;source:'COACH';priority?:number};
type Msg={who:'user'|'ai';text:string;task?:Suggestion};
const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;

function reply(q:string,active:any,matches:any[],tasks:ILPTask[]):{text:string;task?:Suggestion}{
  const s=q.toLowerCase(),r=matches.slice(0,5),cs=avg(r.map(m=>m.metrics.csPerMin)),post=avg(r.map(m=>m.metrics.post15CsPerMin||m.metrics.csPerMin)),lane=avg(r.map(m=>m.metrics.laneCsPerMin||m.metrics.csPerMin)),d=avg(r.map(m=>m.deaths)),postD=avg(r.map(m=>m.metrics.deathsPost20||0));
  const activeFive=tasks.filter(t=>t.status!=='MASTERED'&&t.status!=='PAUSED').slice(0,5);
  const plan=activeFive.map((t,i)=>`${i+1}. ${t.title} · ${t.progress}%`).join('\n');
  if(/learning plan|ilp|tasks|my plan/.test(s))return{text:`Your active five:\n${plan}\n\nOP CLIMB keeps the plan narrow. Match evidence moves progress, mastered behaviours leave, and a new higher-priority leak can replace the weakest active task.`};
  if(/plat|platinum|climb|next rank/.test(s))return{text:`Recent five: ${cs.toFixed(1)} CS/min · ${d.toFixed(1)} deaths/game · ${postD.toFixed(1)} post-20 deaths.\n\nThe first thing I would protect is your current #1 ILP behaviour. Climbing comes from removing repeated leaks, not adding five new concepts at once.`};
  if(/cs|farm|wave|after lane|economy/.test(s)){const task:Suggestion={title:'Decide final wave 90s before objective',category:'TEMPO',why:'Your farm drop is most useful when linked to objective timing rather than “farm more”.',gameRule:'At 90 seconds before Dragon/Baron, choose your final wave and route to setup.',metric:'objectivePreparation',target:'3 reviewed correct setup decisions',source:'COACH',priority:84};return{text:`Lane ${lane.toFixed(1)} → post-15 ${post.toFixed(1)} CS/min. The key question is not “farm more”; it is whether your last wave makes you late.\n\nDecision: timer → safe wave → reset/spend → move. If taking the wave makes setup late, rotate instead.`,task};}
  if(/death|position|teamfight|spacing/.test(s)){const task:Suggestion={title:'Survive the first threat cycle',category:'TEAMFIGHTING',why:'Late ADC deaths are expensive, but scoreboard data alone cannot prove spacing.',gameRule:'Before sustained DPS range, identify the primary engage/assassin threat and wait until it is committed, blocked or covered by peel.',metric:'deathsPost20',target:'≤2 post-20 deaths in 3 of 5 games',source:'COACH',priority:90};return{text:`You are averaging ${d.toFixed(1)} deaths, with ${postD.toFixed(1)} after 20 minutes in the recent sample.\n\nUse one question before entering: “What kills me first?” Wait for that threat to commit, get blocked, or become covered by peel before stepping into sustained DPS range.`,task};}
  if(/live|during game|watch me|follow game/.test(s))return{text:`Live Companion silently records permitted League telemetry, then coaches the decisions after the match. It should not become an automated live shotcaller. Your ILP cue stays the focus; the review proves whether you followed it.`};
  if(/kog/.test(s))return{text:`Kog'Maw focus:\n• protect HP + CS in lane\n• preserve post-15 farm\n• front-to-back by default\n• identify engage/assassin threat before W uptime\n• short catch-and-rotate side waves, not deep solo pressure`};
  if(/build|rune|item/.test(s))return{text:`Build choice and build execution are separate. The useful question is: did your recalls, deaths or missed waves delay the item breakpoint? OP CLIMB should grade both the purchase and whether you reached it on time.`};
  return{text:`Ask me about the behaviour costing you games, not generic League trivia. Current priority: ${activeFive[0]?.title||'play a tracked game first'}.`};
}

const promptCards=[
  {icon:'↗',title:'CLIMB',text:'What is stopping me reaching the next rank?',ask:'How do I get to Platinum?'},
  {icon:'◫',title:'ECONOMY',text:'Why does my farm disappear after lane?',ask:'Why does my CS drop after lane?'},
  {icon:'✕',title:'DEATHS',text:'Which deaths are actually costing games?',ask:'Are my late deaths a positioning problem?'},
  {icon:'◎',title:'LIVE',text:'How does the tracker coach this after a game?',ask:'Can Live Companion follow my game?'},
];

function Message({m}:{m:Msg}){
  const long=m.who==='ai'&&m.text.length>280;
  if(!long)return <div className={`vf-message ${m.who}`}><div>{m.text}</div></div>;
  const preview=m.text.slice(0,220).replace(/\s+\S*$/,'').trim();
  return <details className="vf-message ai"><summary><span>{preview}…</span><b>OPEN FULL COACHING</b></summary><div className="vf-message-full">{m.text}</div></details>;
}

export default function Coach(){
  const {active}=useAccount();
  const matches=matchesFor(active.id);
  const {tasks,addTask}=useLearningPlan();
  const activeFive=tasks.filter(t=>t.status!=='MASTERED'&&t.status!=='PAUSED').slice(0,5);
  const [q,setQ]=useState('');
  const [messages,setMessages]=useState<Msg[]>([{who:'ai',text:`Your current priority is ${activeFive[0]?.title||'waiting for match evidence'}. Ask me what to change next.`}]);
  const context=useMemo(()=>`${active.gameName}${active.tagline} · ${active.rank} · ${active.role}`,[active]);
  function send(t?:string){const text=(t??q).trim();if(!text)return;const a=reply(text,active,matches,tasks);setMessages(m=>[...m,{who:'user',text},{who:'ai',text:a.text,task:a.task}]);setQ('')}

  return <AppShell>
    <PageHead title="Coach" subtitle={context} action={<Link href="/ilp" className="btn secondary">MY PLAN</Link>}/>

    <section className="vf-coach-hero">
      <div><div className="eyebrow">COACHING LENS</div><h2>{activeFive[0]?.title||'Build your first priority'}</h2><p>{activeFive[0]?.gameRule||'Track a game and OP CLIMB will promote the first evidence-backed behaviour.'}</p></div>
      <Link href="/live" className="vf-live-orb"><span>●</span><b>LIVE</b><small>TRACK A GAME</small></Link>
    </section>

    <div className="vf-plan-rail">
      {activeFive.map((t,i)=><Link href="/ilp" key={t.id} className={i===0?'active':''}><span>0{i+1}</span><div><b>{t.title}</b><i style={{width:`${t.progress}%`}}/></div><strong>{t.progress}%</strong></Link>)}
    </div>

    <section className="vf-coach-prompts">
      {promptCards.map(card=><button key={card.title} onClick={()=>send(card.ask)}><span>{card.icon}</span><div><b>{card.title}</b><small>{card.text}</small></div></button>)}
    </section>

    <section className="vf-coach-console">
      <div className="vf-chat-head"><div><div className="eyebrow">COACH THREAD</div><b>Ask one decision at a time.</b></div><span>{messages.length} MESSAGES</span></div>
      <div className="vf-chat-list">
        {messages.map((m,i)=><div key={i}><Message m={m}/>{m.task&&<div className="vf-coach-proposal"><div><span>ILP PROPOSAL</span><h3>{m.task.title}</h3><p>{m.task.gameRule}</p></div><button className="btn primary" onClick={()=>addTask(m.task!)}>ADD TO PLAN</button></div>}</div>)}
      </div>
      <div className="vf-coach-input"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Ask about the next decision to fix…"/><button onClick={()=>send()}>SEND ↗</button></div>
    </section>
  </AppShell>;
}
