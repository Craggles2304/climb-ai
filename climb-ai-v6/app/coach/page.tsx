'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {useSubscription} from '@/components/SubscriptionContext';
import {filterHistoryForTier} from '@/lib/subscription';
import {missionSummary} from '@/lib/missionLoop';
import type {IssueCategory,Match} from '@/lib/types';
import {coachingLevelFor} from '@/lib/coachingLevel';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady as isDnaBaselineReady} from '@/lib/dnaGrowth';
import {currentGameDnaMissions} from '@/lib/gameDnaSnapshot';

type Suggestion={title:string;category:IssueCategory;why:string;gameRule:string;metric:string;target:string;source:'COACH';priority?:number};
type Msg={who:'user'|'ai';text:string;task?:Suggestion;grounding?:string;factsUsed?:string[];applied?:boolean};
type CoachResponse={answer?:string;error?:string;suggestion?:Suggestion;grounding?:string;factsUsed?:string[]};
type HistoryTurn={role:'user'|'assistant';content:string};
type CoachTab='ASK'|'MEMORY';

const THREAD_KEY='op_climb_coach_thread_v1';
const MAX_SAVED_MESSAGES=30;
const MAX_CONTEXT_MESSAGES=10;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const promptCards=[
  {icon:'↗',title:'NEXT',text:'What should I fix next?',ask:'What is the single most important thing I should fix next based on my recent games?'},
  {icon:'✕',title:'DEATHS',text:'Why do I keep dying?',ask:'What is the main reason I am dying and what should I do differently next game?'},
  {icon:'◫',title:'FARM',text:'Why does my farm drop?',ask:'Why does my CS drop and what simple change should I make next game?'},
  {icon:'◎',title:'PROGRESS',text:'Am I getting better?',ask:'Based on my recent games, what has improved and what is still holding me back?'},
];

const avgDefined=(values:(number|undefined)[])=>{const clean=values.filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));return clean.length?clean.reduce((a,b)=>a+b,0)/clean.length:undefined};
function recentSummary(matches:Match[]){const r=matches.slice(0,5);return{games:r.length,csPerMin:avgDefined(r.map(m=>m.metrics.csPerMin)),laneCsPerMin:avgDefined(r.map(m=>m.metrics.laneCsPerMin)),post15CsPerMin:avgDefined(r.map(m=>m.metrics.post15CsPerMin)),deaths:avgDefined(r.map(m=>m.deaths)),deathsPost20:avgDefined(r.map(m=>m.metrics.deathsPost20)),objectiveParticipation:avgDefined(r.map(m=>m.metrics.objectiveParticipation)),damageShare:avgDefined(r.map(m=>m.metrics.damageShare)),killParticipation:avgDefined(r.map(m=>m.metrics.killParticipation)),visionScore:avgDefined(r.map(m=>m.metrics.visionScore)),secondItemMinute:avgDefined(r.map(m=>m.metrics.secondItemMinute))}}
function isTrendQuestion(text:string){const q=text.toLowerCase();if(/\b(last|past|previous|recent)\s+[2-5]\s+games?\b/.test(q))return true;if(/\b(over|across|based on)\b.{0,35}\b(last|past|previous|recent)\b.{0,25}\bgames?\b/.test(q))return true;return /\b(improv(?:e|ed|ement)?|progress|trend|better|worse|changed?|compare|comparison)\b/.test(q)&&/\bgames?\b/.test(q)}
function requestedTrendGames(text:string){const match=text.toLowerCase().match(/\b(?:last|past|previous|recent)\s+([2-5])\s+games?\b/);const n=match?Number(match[1]):3;return Math.max(2,Math.min(5,Number.isFinite(n)?n:3))}
function validStoredMessages(value:unknown):Msg[]{if(!Array.isArray(value))return[];return value.filter((m):m is Msg=>Boolean(m&&typeof m==='object'&&((m as Msg).who==='user'||(m as Msg).who==='ai')&&typeof (m as Msg).text==='string')).slice(-MAX_SAVED_MESSAGES)}
function threadHistory(messages:Msg[]):HistoryTurn[]{return messages.filter(m=>m.text.trim()).slice(-MAX_CONTEXT_MESSAGES).map(m=>({role:m.who==='ai'?'assistant':'user',content:m.text.slice(0,2200)}))}
function welcome(priority:string|undefined,tier:string,baselineGames=DNA_BASELINE_GAMES):Msg{return{who:'ai',text:baselineGames<DNA_BASELINE_GAMES?`I’m still learning your game. You have ${baselineGames}/${DNA_BASELINE_GAMES} baseline games. Play normally — I’ll wait until game 3 before I give you a personalised challenge.`:priority?`I’ve got your recent games. Right now I want you working on “${priority}”. Ask me why it keeps happening or what to do differently next game.`:`Your baseline is ready. Play another tracked game and I’ll keep building challenges from what repeats.`,grounding:'ilp-and-profile',factsUsed:['active_ilp_tasks','rank']}}
function Grounding({m}:{m:Msg}){if(m.who!=='ai'||!m.grounding)return null;const label=m.grounding==='recorded-live-telemetry'?'FROM THIS MATCH':m.grounding.includes('recent-match')?'FROM YOUR RECENT GAMES':m.grounding.includes('conversation')?'FROM THIS CHAT + YOUR GAMES':m.grounding.includes('champion')?'FROM YOUR CHAMPION + GAMES':'FROM YOUR CURRENT PLAN';return <span className="vf-grounding-tag">{label}</span>}
function CoachText({text}:{text:string}){
  const normalized=text.replace(/\s+(IMPROVED|STILL COSTING YOU|NEXT GAME|WHAT I SAW|WHY THIS MATTERS|THE SIMPLE FIX|KEEP WORKING|GOOD NEWS):/gi,'\n$1:');
  const parts=normalized.split(/\n+/).map(part=>part.trim()).filter(Boolean);
  return <div className="vf-coach-answer-copy">{parts.map((part,index)=>{const hit=part.match(/^(IMPROVED|STILL COSTING YOU|NEXT GAME|WHAT I SAW|WHY THIS MATTERS|THE SIMPLE FIX|KEEP WORKING|GOOD NEWS):\s*(.*)$/i);return hit?<p className="vf-coach-insight" key={index}><span>{hit[1]}</span>{hit[2]}</p>:<p className={index===0?'lead':undefined} key={index}>{part}</p>})}</div>
}
function Message({m}:{m:Msg}){
  if(m.who==='user')return <div className="vf-message-row user"><div className="vf-message user"><span className="vf-message-who">YOU</span><p>{m.text}</p></div></div>;
  return <div className="vf-message-row ai"><div className="vf-message ai"><div className="vf-message-ai-head"><span>OP CLIMB COACH</span><Grounding m={m}/></div><CoachText text={m.text}/></div></div>;
}

export default function Coach(){
  const {active}=useAccount();
  const {tier}=useSubscription();
  const accountMatches=matchesFor(active.id).filter(match=>match.durationSeconds>=300);
  const allRoleMatches=accountMatches.filter(match=>match.role===active.role);
  const matches=filterHistoryForTier(allRoleMatches,tier);
  const baselineGames=dnaBaselineGameCount(accountMatches,active.role);
  const baselineReady=isDnaBaselineReady(baselineGames);
  const {tasks,addTask}=useLearningPlan();
  const rawActiveThree=currentGameDnaMissions(tasks,active.role).flatMap(({task})=>task?[task]:[]);
  const activeThree=baselineReady?rawActiveThree:[];
  const priorityTitle=activeThree[0]?.title;
  const detail=useMemo(()=>coachingLevelFor(active.rank),[active.rank]);
  const [q,setQ]=useState('');
  const [pending,setPending]=useState(false);
  const [messages,setMessages]=useState<Msg[]>([]);
  const [tab,setTab]=useState<CoachTab>('ASK');
  const loadedAccount=useRef('');
  const context=useMemo(()=>`${active.gameName}${active.tagline} · ${active.rank} · ${active.role}`,[active]);
  const summary=useMemo(()=>recentSummary(matches),[matches]);
  const mastered=tasks.filter(task=>task.status==='MASTERED');
  const primarySummary=activeThree[0]?missionSummary(activeThree[0]):null;
  useEffect(()=>{if(loadedAccount.current===active.id)return;let restored:Msg[]=[];try{const raw=localStorage.getItem(`${THREAD_KEY}:${active.id}`);if(raw)restored=validStoredMessages(JSON.parse(raw))}catch{}loadedAccount.current=active.id;setMessages(restored.length?restored:[welcome(priorityTitle,detail.tier,baselineGames)])},[active.id,priorityTitle,detail.tier,baselineGames]);
  useEffect(()=>{if(loadedAccount.current!==active.id||!messages.length)return;try{localStorage.setItem(`${THREAD_KEY}:${active.id}`,JSON.stringify(messages.slice(-MAX_SAVED_MESSAGES)))}catch{}},[active.id,messages]);
  async function send(t?:string){const text=(t??q).trim();if(!text||pending)return;const history=threadHistory(messages);const userMessage:Msg={who:'user',text};if(!baselineReady){const baselineMessage:Msg={who:'ai',text:`I’m still building your baseline. You have ${Math.min(baselineGames,DNA_BASELINE_GAMES)}/${DNA_BASELINE_GAMES} tracked games. Play normally until game 3 is complete; then I’ll use those games to give you a personalised challenge instead of guessing early.`,grounding:'recent-match-and-ilp',factsUsed:['baseline_games','rank','role']};setQ('');setMessages(m=>[...m,userMessage,baselineMessage].slice(-MAX_SAVED_MESSAGES));return}const activeTaskContext=activeThree.map(task=>({title:task.title,dnaDomain:task.dnaDomain,category:task.category,metric:task.metric,progress:task.progress,target:task.target,gameRule:task.gameRule}));const useTrend=isTrendQuestion(text)&&UUID.test(active.id);setQ('');setPending(true);setMessages(m=>[...m,userMessage].slice(-MAX_SAVED_MESSAGES));try{const endpoint=useTrend?'/api/coach/trend':'/api/coach';const payload=useTrend?{message:text,history,accountId:active.id,requestedGames:requestedTrendGames(text),activeTasks:activeTaskContext,rank:active.rank,role:active.role}:{message:text,history,accountId:active.id,context:{rank:active.rank,role:active.role,mission:activeThree[0]?.title,champions:active.champions,activeTasks:activeTaskContext,recent:summary}};const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const body=await res.json() as CoachResponse;if(!res.ok)throw new Error(body.error||'Coach request failed.');const aiMessage:Msg={who:'ai',text:body.answer||'I do not have enough from your games to answer that properly yet.',task:body.suggestion,grounding:body.grounding,factsUsed:body.factsUsed};setMessages(m=>[...m,aiMessage].slice(-MAX_SAVED_MESSAGES))}catch(error){const errorMessage:Msg={who:'ai',text:`I can’t pull that game evidence right now. Keep your current focus: “${activeThree[0]?.title||'play one tracked game'}”. ${error instanceof Error?error.message:''}`,grounding:'ilp-and-profile',factsUsed:['active_ilp_tasks']};setMessages(m=>[...m,errorMessage].slice(-MAX_SAVED_MESSAGES))}finally{setPending(false)}}
  function applyProposal(index:number,task:Suggestion){addTask(task);setMessages(current=>current.map((m,i)=>i===index?{...m,applied:true}:m))}
  function resetThread(){const next:Msg[]=[welcome(activeThree[0]?.title,detail.tier,baselineGames)];setMessages(next);try{localStorage.setItem(`${THREAD_KEY}:${active.id}`,JSON.stringify(next))}catch{}}
  return <AppShell>
    <header className="coach-hub-head">
      <div>
        <div className="eyebrow">COACH · DIAGNOSE AND DECIDE</div>
        <h1>Turn game evidence into one clear decision.</h1>
        <p>Ask what happened, understand why it matters, and leave with a rule for your next game.</p>
      </div>
      <Link className="btn btn-small" href="/live">Prepare next game →</Link>
    </header>

    <nav className="coach-subtabs" aria-label="Coach sections">
      <button type="button" className={tab==='ASK'?'active':''} onClick={()=>setTab('ASK')}>
        <span>01</span><div><b>ASK COACH</b><small>Diagnose one real question</small></div>
      </button>
      <button type="button" className={tab==='MEMORY'?'active':''} onClick={()=>setTab('MEMORY')}>
        <span>02</span><div><b>COACH MEMORY</b><small>What carries forward</small></div>
      </button>
      <Link className="coach-climb-link" href="/game-dna">
        <span>⬡</span><div><b>OPEN GAME DNA</b><small>Your interactive player identity</small></div>
      </Link>
    </nav>

    {tab==='ASK'&&<section className="coach-tab-panel">
      <header className="page-head coach-inner-head">
        <div>
          <div className="eyebrow">ASK YOUR COACH</div>
          <h2>Ask one real question.</h2>
          <p>Your answer uses your current focus and the match evidence your plan allows.</p>
        </div>
      </header>

      <section className="coach-climb-handoff" aria-label="My Climb handoff">
        <div>
          <div className="eyebrow">YOUR PLAN LIVES IN MY CLIMB</div>
          <h3>{activeThree[0]?.title||'Your next tracked focus will appear there'}</h3>
          <p>Coach helps you understand and choose. My Climb is where your Game DNA, six missions, proven reps, and level progress live.</p>
        </div>
        <Link className="btn secondary" href="/ilp">VIEW MY CLIMB →</Link>
      </section>

      <section className="vf-coach-context">
        <div className="vf-coach-focus-card">
          <div className="eyebrow">YOUR CURRENT FOCUS</div>
          <h1>{activeThree[0]?.title||'Play one tracked game'}</h1>
          <p>{activeThree[0]?.gameRule||'Once OP CLIMB has a real game to work from, your coach will give you one clear next-game rule.'}</p>
          <div className="vf-coach-focus-actions"><Link href="/live" className="btn primary">TRACK NEXT GAME →</Link><Link href="/ilp" className="btn secondary">OPEN DEVELOPMENT PLAN</Link></div>
        </div>
        <div className="vf-coach-context-stats">
          <div><span>RECENT GAMES</span><b>{summary.games}</b><small>used for current context</small></div>
          <div><span>AVG DEATHS</span><b>{summary.deaths===undefined?'—':summary.deaths.toFixed(1)}</b><small>recent meaningful games</small></div>
          <div><span>CS / MIN</span><b>{summary.csPerMin===undefined?'—':summary.csPerMin.toFixed(1)}</b><small>full-game economy</small></div>
        </div>
      </section>

      <section className="vf-coach-prompts" aria-label="Quick coach questions">
        {promptCards.slice(0,detail.visiblePoints<=2?3:4).map(card=><button key={card.title} onClick={()=>void send(card.ask)} disabled={pending}><span>{card.icon}</span><div><b>{card.title}</b><small>{card.text}</small></div></button>)}
      </section>

      <section className="vf-coach-workspace">
        <div className="vf-coach-console">
          <div className="vf-chat-head">
            <div><div className="eyebrow">COACH CONVERSATION</div><b>Ask normally. Your game evidence stays attached to the answer.</b></div>
            <div className="vf-chat-head-actions"><span>{pending?'CHECKING YOUR GAMES…':`${messages.length} MESSAGES`}</span><button className="btn secondary" onClick={resetThread} disabled={pending}>NEW CHAT</button></div>
          </div>
          <div className="vf-chat-list">
            {messages.map((m,i)=><div className="vf-message-stack" key={i}><Message m={m}/>{m.task&&<div className="vf-coach-proposal"><div><span>{m.applied?'FOCUS UPDATED':'TRY THIS NEXT'}</span><h3>{m.task.title}</h3><p>{m.task.gameRule}</p>{detail.depth>=3&&<small className="muted">{m.task.target}</small>}</div><button className={`btn ${m.applied?'secondary':'primary'}`} disabled={m.applied} onClick={()=>applyProposal(i,m.task!)}>{m.applied?'USING THIS FOCUS':'USE THIS FOCUS'}</button></div>}</div>)}
            {pending&&<div className="vf-message-row ai"><div className="vf-message ai is-loading"><div className="vf-message-ai-head"><span>OP CLIMB COACH</span></div><p>Checking your recent games and current development plan…</p></div></div>}
          </div>
          <div className="vf-coach-input"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void send()}} placeholder="Ask what went wrong, what improved, or what to do next…" disabled={pending}/><button onClick={()=>void send()} disabled={pending}>{pending?'…':'ASK COACH ↗'}</button></div>
        </div>

        <aside className="vf-coach-rail">
          <div className="vf-coach-rail-block"><span>HOW TO USE THIS</span><strong>Ask one real question.</strong><p>Deaths, farm, fights, objectives, recalls, progress or a specific game. The answer should end in something you can actually do.</p></div>
          <div className="vf-coach-rail-block accent"><span>COACH DEPTH</span><strong>{detail.tier}</strong><p>Your visible explanation depth adapts to {active.rank}. The underlying evidence stays intact.</p></div>
          <div className="vf-coach-rail-block"><span>PLAYER CONTEXT</span><strong>{active.role}</strong><p>{active.gameName}{active.tagline} · {active.rank} · {summary.games} recent meaningful game{summary.games===1?'':'s'}.</p></div>
        </aside>
      </section>
    </section>}

    {tab==='MEMORY'&&<section className="coach-tab-panel">
      {tier==='PRO'?<>
        <header className="page-head coach-inner-head">
          <div>
            <div className="eyebrow">COACH MEMORY · YOUR DEVELOPMENT OVER TIME</div>
            <h2>What your coach carries forward.</h2>
            <p>This is the part of OP CLIMB that stops every new game from becoming a blank slate.</p>
          </div>
          <Link className="btn btn-small" href="/ilp">Open My Climb →</Link>
        </header>

        <div className="climb-grid coach-memory-summary">
          <section className="panel panel-padding">
            <div className="section-head"><h2>Current memory thread</h2><span className="tag gold">{mastered.length} mastered</span></div>
            <div className="memory-timeline">
              <div className="memory-event"><span>NOW</span><div><h3>{activeThree[0]?.title||'Build the first coaching thread'}</h3><p>{activeThree[0]?.gameRule||'Play one tracked game so the coach has real evidence to carry forward.'}</p></div></div>
              <div className="memory-event"><span>PROOF</span><div><h3>Test the same decision again.</h3><p>{primarySummary?primarySummary.confirmed+' of '+primarySummary.required+' proven reps currently support this focus.':'No proven reps yet.'}</p></div></div>
              <div className="memory-event"><span>HISTORY</span><div><h3>{mastered.length?'Mastered habits stay remembered.':'Memory builds when habits hold.'}</h3><p>{mastered.length?mastered.slice(0,3).map(task=>task.title).join(' · '):'Once a mission holds repeatedly, it moves out of the active plan but stays in your player model.'}</p></div></div>
              <div className="memory-event"><span>NEXT</span><div><h3>Use less help, not more.</h3><p>The next test is whether the current read holds in a different game state without needing another new tip.</p></div></div>
            </div>
          </section>

          <aside className="panel panel-padding">
            <span className="eyebrow accent">WHAT YOUR COACH CARRIES FORWARD</span>
            <h2 style={{marginTop:12}}>The context behind every answer.</h2>
            <div className="criteria">
              <div><span className="mint">◎</span><span>Recurring decision patterns</span></div>
              <div><span className="mint">◎</span><span>Your current focus and why it exists</span></div>
              <div><span className="mint">◎</span><span>Evidence that supports or challenges the read</span></div>
              <div><span className="mint">◎</span><span>Mastered habits that should still hold</span></div>
              <div><span className="mint">◎</span><span>The next useful test across a new situation</span></div>
            </div>
          </aside>
        </div>
      </>:<section className="panel panel-padding pro-memory-gate">
        <div className="eyebrow">COACH MEMORY · PRO</div>
        <h2>Persistent memory starts on PRO.</h2>
        <p className="muted">{tier==='PLUS'?'PLUS understands each current game in full. PRO adds cross-game memory, mastered-habit recall and transfer testing.':'FREE proves the core coaching loop. PRO adds cross-game memory, mastered-habit recall and transfer testing.'}</p>
        <Link className="btn gold" href="/pricing">Unlock Coach Memory →</Link>
      </section>}
    </section>}
  </AppShell>;

}

