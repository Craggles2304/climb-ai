'use client';
import {useMemo,useState,useEffect,useRef} from 'react';
import type {KeyboardEvent,ReactNode} from 'react';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';
import type {FightReview} from '@/lib/riot/liveStrength';
import type {Match} from '@/lib/types';
import type {DecisionGraphNode} from '@/lib/decisionGraph';
import './decision-moments.css';

type Kind='good'|'review'|'event'|'mark';
type Moment={id:string;kind:Kind;at:number;time:string;title:string;type?:string;confidence?:string;happened:string[];mattered?:string;improve?:string;whyBetter?:string;tradeoff?:string;principle?:string;plan?:string;evidence:string[];limitation?:string};
export type MomentBookmark={atSeconds:number;detail?:string;status?:string};
type Props={analysis?:ProMatchAnalysis|null;fights?:FightReview[];match?:Pick<Match,'durationSeconds'|'moments'>|null;bookmarks?:MomentBookmark[]};
const valid=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const clean=(value:unknown)=>typeof value==='string'?value.replace(/\s+/g,' ').trim():'';
const clock=(seconds:number)=>{const n=Math.max(0,Math.floor(seconds));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
const titleCase=(value:string)=>value.toLowerCase().replace(/\b\w/g,l=>l.toUpperCase());

function fromDecision(node:DecisionGraphNode):Moment{
  const good=node.verdict==='GOOD';
  return{id:'decision-'+node.id,kind:good?'good':'review',at:node.atSeconds,time:node.minuteLabel||clock(node.atSeconds),
    title:node.title||node.behaviourLabel||'Reviewed decision',type:titleCase(node.type.replace(/_/g,' ')),confidence:node.confidence,
    happened:[clean(node.situation),clean(node.decisionRead)].filter(Boolean),mattered:clean(node.consequence),
    improve:good?'':clean(node.counterfactual?.alternative)||clean(node.coachingResponse?.cue),
    whyBetter:good?'':clean(node.counterfactual?.whyBetter),tradeoff:good?'':clean(node.counterfactual?.tradeoff),
    principle:clean(node.lockedPrinciple),plan:node.planAlignment,
    evidence:(node.evidence||[]).map(clean).filter(Boolean).slice(0,5),limitation:clean(node.limitation)};
}
function fromFight(fight:FightReview,index:number):Moment{
  const good=fight.category==='STRENGTH';
  return{id:'fight-'+fight.atSeconds+'-'+index,kind:good?'good':'review',at:fight.atSeconds,time:clock(fight.atSeconds),
    title:clean(fight.headline)||'Reviewed fight',type:'Fight',confidence:'VISIBLE STATE',
    happened:[clean(fight.summary),...(fight.why||[]).map(clean)].filter(Boolean),mattered:clean(fight.outcome),
    improve:good?'':clean(fight.betterDecision?.[0]),evidence:(fight.why||[]).map(clean).filter(Boolean).slice(0,4)};
}
function makeMoments(analysis?:ProMatchAnalysis|null,fights:FightReview[]=[],match?:Props['match'],bookmarks:MomentBookmark[]=[]){
  const nodes=(analysis?.decisionGraph?.nodes??[]).filter(n=>(n.verdict==='GOOD'||n.verdict==='IMPROVE')&&valid(n.atSeconds)&&n.atSeconds>=0);
  let decisions:Moment[]=nodes.map(fromDecision);
  if(!decisions.length)decisions=(analysis?.reconstruction?.stories??[]).filter(s=>valid(s.atSeconds)&&s.atSeconds>=0).map(s=>({
    id:'reconstruction-'+s.id,kind:s.side==='GOOD'?'good' as const:'review' as const,at:s.atSeconds,time:s.clock||clock(s.atSeconds),title:s.title,
    type:s.behaviourLabel,confidence:s.confidence,happened:[clean(s.before),clean(s.decision)].filter(Boolean),
    mattered:clean(s.consequence),improve:s.side==='CRITICAL'?clean(s.coaching):'',
    evidence:(s.evidence??[]).map(e=>clean(e.detail)).filter(Boolean).slice(0,5)}));
  if(!decisions.length)decisions=fights.filter(f=>valid(f.atSeconds)&&f.atSeconds>=0).map(fromFight);
  const events:Moment[]=(match?.moments??[]).filter(e=>valid(e.atMs)&&e.atMs>=0).map((e,i)=>({
    id:'event-'+i+'-'+e.atMs,kind:'event',at:e.atMs/1000,time:e.clock||clock(e.atMs/1000),title:e.text,type:e.type.replace(/_/g,' '),
    happened:[e.text],mattered:e.cost,evidence:[]}));
  const marks:Moment[]=bookmarks.filter(m=>valid(m.atSeconds)&&m.atSeconds>=0).map((m,i)=>({
    id:'mark-'+i+'-'+m.atSeconds,kind:'mark',at:m.atSeconds,time:clock(m.atSeconds),title:clean(m.detail)||'Your bookmark',
    happened:m.detail?[m.detail]:[],evidence:[]}));
  return{decisions,marks,items:[...decisions,...events,...marks].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id))};
}

function SummaryColumn({kind,items}:{kind:'good'|'review';items:Moment[]}){
  const good=kind==='good';
  return <section className={'dmr-summary dmr-summary--'+kind} aria-label={good?'What went well':'What to work on'}>
    <div className="dmr-kicker">{good?'WHAT WENT WELL':'WHAT TO WORK ON'}</div>
    {items.length?<ol>{items.slice(0,3).map(m=><li key={m.id}>
      <span className="dmr-summary-icon" aria-hidden="true">{good?'✓':'!'}</span>
      <div><b>{m.title}{m.title.includes(m.time)?'':' at '+m.time}</b>
      <p>{good?(m.mattered||m.happened[0]||'Verified positive decision.'):(m.improve||m.mattered||m.happened[0]||'Review this decision.')}</p></div>
    </li>)}</ol>:<p className="dmr-summary-empty">{good?'No positive decision cleared the available evidence bar.':'No reviewable decision was verified in this game.'}</p>}
  </section>;
}

function Detail({moment:m}:{moment:Moment}){
  const section=(label:string,children:ReactNode)=><div className="dmr-detail-section"><span>{label}</span>{children}</div>;
  return <div className={'dmr-detail dmr-detail--'+m.kind} aria-live="polite" aria-atomic="true">
    <div className="dmr-detail-head"><div className="dmr-badges">
      <span className={'dmr-badge dmr-badge--'+m.kind}>{m.kind==='good'?'GOOD DECISION':m.kind==='review'?'NEEDS REVIEW':m.kind==='mark'?'BOOKMARK':'RECORDED EVENT'}</span>
      {m.type&&<span className="dmr-badge dmr-badge--plain">{m.type}</span>}
      {m.confidence&&<span className="dmr-badge dmr-badge--plain">{titleCase(m.confidence)} confidence</span>}
    </div><strong className="dmr-detail-time">{m.time}</strong></div>
    <h3>{m.title}</h3>
    {m.happened.length>0&&section('WHAT HAPPENED',m.happened.map((value,i)=><p key={i}>{value}</p>))}
    {m.mattered&&section(m.kind==='event'?'RECORDED CONSEQUENCE':'WHY IT MATTERED',<p>{m.mattered}</p>)}
    {m.improve&&section('WHAT COULD BE IMPROVED',<><p className="dmr-better">{m.improve}</p>
      {m.whyBetter&&<p>{m.whyBetter}</p>}{m.tradeoff&&<p>Trade-off: {m.tradeoff}</p>}</>)}
    {m.principle&&section(m.plan==='CONFLICTED'?'YOUR LOCKED PLAN SAID':'YOUR PLAN PRINCIPLE',<p>{m.principle}</p>)}
    {m.evidence.length>0&&section('RECORDED EVIDENCE',<ul className="dmr-evidence">{m.evidence.map((e,i)=><li key={i}>{e}</li>)}</ul>)}
    {m.limitation&&<p className="dmr-limitation">◇ {m.limitation}</p>}
    {m.kind==='event'&&<p className="dmr-limitation">This Riot timeline event is not automatically graded as a good or bad decision.</p>}
  </div>;
}
const EMPTY_FIGHTS:FightReview[]=[];
const EMPTY_BOOKMARKS:MomentBookmark[]=[];
export function DecisionMomentsReview({analysis,fights=EMPTY_FIGHTS,match,bookmarks=EMPTY_BOOKMARKS}:Props){
  const {items,decisions,marks}=useMemo(()=>makeMoments(analysis,fights,match,bookmarks),[analysis,fights,match,bookmarks]);
  const [selectedId,setSelectedId]=useState('');
  const selected=items.find(m=>m.id===selectedId)??decisions.find(m=>m.kind==='review')??decisions[0]??items[0];
  const countGood=decisions.filter(m=>m.kind==='good').length,countReview=decisions.filter(m=>m.kind==='review').length;
  const duration=Math.max(60,valid(match?.durationSeconds)?match.durationSeconds:0,...items.map(m=>m.at+15));
  const markerRefs=useRef<Record<string,HTMLButtonElement|null>>({});
  useEffect(()=>{if(selected&&!items.some(m=>m.id===selectedId))setSelectedId(selected.id)},[items,selected,selectedId]);
  function markerKey(event:KeyboardEvent<HTMLButtonElement>,id:string){
    if(event.key!=='ArrowRight'&&event.key!=='ArrowLeft')return;
    const index=items.findIndex(m=>m.id===id);
    const next=items[Math.max(0,Math.min(items.length-1,index+(event.key==='ArrowRight'?1:-1)))];
    if(next){event.preventDefault();setSelectedId(next.id);markerRefs.current[next.id]?.focus()}
  }
  return <div className="dmr-root">
    <section className="dmr-panel" aria-label="Match decision timeline">
      <header className="dmr-header"><div><div className="dmr-kicker dmr-kicker--cyan">MATCH TIMELINE</div><h2>DECISION MOMENTS</h2></div>
      <div className="dmr-counts">
        <span className="dmr-count dmr-count--good"><i/> {countGood} GOOD</span>
        <span className="dmr-count dmr-count--review"><i/> {countReview} TO REVIEW</span>
        <span className="dmr-count dmr-count--mark"><i/> {marks.length} BOOKMARKED</span>
      </div></header>
      {items.length?<><div className="dmr-timeline" role="group" aria-label="Interactive game timeline">
        <div className="dmr-track"/>
        {items.map(m=><button key={m.id} type="button" ref={el=>{markerRefs.current[m.id]=el}}
          className={'dmr-marker dmr-marker--'+m.kind+(m.id===selected?.id?' dmr-marker--selected':'')}
          style={{left:Math.min(98.5,Math.max(1.5,m.at/duration*100))+'%'}}
          onClick={()=>setSelectedId(m.id)} onKeyDown={e=>markerKey(e,m.id)}
          aria-pressed={m.id===selected?.id} aria-label={m.time+': '+m.title}>
          {m.id===selected?.id&&<span className="dmr-marker-label">{m.time}</span>}
        </button>)}
        <div className="dmr-ticks" aria-hidden="true">
          {Array.from({length:Math.floor(duration/300)+1},(_,i)=><span key={i} style={{left:i*300/duration*100+'%'}}>{i*5}</span>)}<em>min</em>
        </div>
      </div><div className="dmr-events"><div className="dmr-event-list" role="group" aria-label="Match events and decisions">
        {items.map(m=><button key={m.id} type="button" onClick={()=>setSelectedId(m.id)}
          aria-pressed={m.id===selected?.id}
          className={'dmr-event dmr-event--'+m.kind+(m.id===selected?.id?' dmr-event--selected':'')}>
          <time>{m.time}</time><i aria-hidden="true"/><span>{m.title}</span></button>)}
      </div>{selected&&<Detail moment={selected}/>}</div></>
      :<div className="dmr-empty"><h3>No verified moments yet</h3><p>This match has no time-stamped decisions or events available. OP CLIMB won’t invent a coaching verdict without evidence.</p></div>}
    </section>
    <div className="dmr-columns">
      <SummaryColumn kind="good" items={decisions.filter(m=>m.kind==='good')}/>
      <SummaryColumn kind="review" items={decisions.filter(m=>m.kind==='review')}/>
    </div>
  </div>;
}
