'use client';
import {useMemo,useState} from 'react';
import {useSubscription} from './SubscriptionContext';
import {PLAN_COPY} from '@/lib/subscription';
import type {FightReview} from './FightDecisionReview';
import type {ProLearningProfile,ProHistoryFix} from '@/lib/riot/proHistory';

type Severity='CRITICAL LEAK'|'MAJOR LEAK'|'ACTIVE LEAK'|'POLISH';
type FixStage='QUICK WIN'|'CONTROL'|'DISCIPLINE'|'ADVANCED'|'MASTERY';
type MatchFix={id:string;stage:FixStage;severity:Severity;title:string;oneLine:string;rule:string;mastery:string;why:string;evidence:FightReview[]};
type LadderFix={id:string;stage:FixStage;severity:string;title:string;oneLine:string;rule:string;mastery:string;why:string;evidence:FightReview[];persistent:boolean;gamesSeen?:number;occurrences?:number};

const STAGES:FixStage[]=['QUICK WIN','CONTROL','DISCIPLINE','ADVANCED','MASTERY'];

export function CompactFixLadder({fights,historyProfile}:{fights:FightReview[];historyProfile?:ProLearningProfile|null}){
  const {tier}=useSubscription();
  const [open,setOpen]=useState<string|null>(null);
  const matchFixes=useMemo(()=>buildMatchFixes(fights),[fights]);
  const current=useMemo<LadderFix[]>(()=>matchFixes.map(fix=>({...fix,persistent:false})),[matchFixes]);
  const persistent=useMemo<LadderFix[]>(()=>tier==='PRO'?(historyProfile?.fixLadder??[]).map(fromHistory):[],[historyProfile,tier]);
  const sourceFixes:LadderFix[]=persistent.length?mergeFixes(persistent,current):current;
  const depth=PLAN_COPY[tier].fixDepth;
  const visible=sourceFixes.slice(0,depth);
  const locked=sourceFixes.slice(depth);
  const active=visible[0]??null;
  const next=visible.slice(1);

  return <section className="glass card" style={{display:'grid',gap:14}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',gap:12,flexWrap:'wrap'}}>
      <div><div className="eyebrow">OP FIX LADDER</div><h2 style={{margin:'5px 0 4px'}}>Fix one leak. Prove it. Move up.</h2><p className="muted" style={{margin:0,maxWidth:680}}>OP CLIMB prioritises the simplest high-impact behaviour first. Harder coaching stays behind it instead of giving you five things to remember at once.</p></div>
      <span style={tierPill}>{tier} · {depth} FIXES</span>
    </div>

    <div style={stageRail} aria-label="Fix Ladder progression">
      {STAGES.map((stage,index)=>{const stageFix=sourceFixes.find(f=>f.stage===stage);const isActive=active?.stage===stage;const available=Boolean(stageFix&&visible.includes(stageFix));return <div key={stage} style={{...stageCell,opacity:isActive?1:available?.72:.36,borderColor:isActive?'rgba(214,255,47,.55)':'rgba(255,255,255,.08)'}}><span style={{fontSize:9,fontWeight:950,letterSpacing:'.1em'}}>{String(index+1).padStart(2,'0')}</span><b style={{fontSize:10}}>{stage}</b><small style={{fontSize:9}}>{isActive?'ACTIVE':available?'READY':stageFix?'LOCKED':'LATER'}</small></div>})}
    </div>

    {active?<div style={activeShell}>
      <button type="button" onClick={()=>setOpen(open===active.id?null:active.id)} style={activeButton}>
        <div style={{display:'grid',gap:5}}>
          <div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}><span className="eyebrow">CURRENT PRIORITY · {active.stage}</span><span style={severityPill}>{active.severity}</span>{active.persistent&&<span style={persistentPill}>REPEATED PATTERN</span>}</div>
          <strong style={{fontSize:24,lineHeight:1.08}}>{active.title}</strong>
          <span className="muted" style={{fontSize:12}}>{active.oneLine}</span>
        </div>
        <span style={{fontSize:20,fontWeight:900}}>{open===active.id?'−':'+'}</span>
      </button>
      <div style={ruleBar}><span>YOUR NEXT-GAME RULE</span><b>{active.rule}</b></div>
      {open===active.id&&<FixDetail fix={active}/>} 
    </div>:<div style={empty}><b>No major decision leak detected in the latest evidence.</b><span className="muted">Keep recording games. OP CLIMB will promote a repeated pattern when it has enough evidence.</span></div>}

    {next.length>0&&<div style={{display:'grid',gap:7}}>
      <div className="eyebrow">NEXT IN YOUR LADDER</div>
      {next.map((fix,index)=><CompactRow key={fix.id} fix={fix} number={index+2} open={open===fix.id} onToggle={()=>setOpen(open===fix.id?null:fix.id)}/>) }
    </div>}

    {locked.length>0&&<details style={detailsShell}><summary style={summaryStyle}>{locked.length} MORE DETECTED FIX{locked.length===1?'':'ES'} · UPGRADE TO UNLOCK</summary><div style={{display:'grid',gap:6,marginTop:10}}>{locked.map((fix,index)=><div key={fix.id} style={lockedRow}><b>{String(depth+index+1).padStart(2,'0')}</b><span>{fix.stage} · {fix.title}</span><strong>🔒</strong></div>)}</div></details>}

    {tier==='PRO'&&historyProfile&&<div style={historyBar}><span><b>{historyProfile.gamesAnalyzed}</b> games learned</span><span><b>{historyProfile.fingerprint.patternRate}%</b> primary-pattern rate</span><span><b>{historyProfile.fingerprint.trend}</b> trend</span></div>}
  </section>;
}

function CompactRow({fix,number,open,onToggle}:{fix:LadderFix;number:number;open:boolean;onToggle:()=>void}){return <div style={rowShell}><button type="button" onClick={onToggle} style={rowButton}><b style={{fontSize:15}}>{String(number).padStart(2,'0')}</b><div><div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}><small style={{fontWeight:900}}>{fix.stage}</small><span style={miniSeverity}>{fix.severity}</span>{fix.persistent&&<span style={persistentPill}>REPEATED</span>}</div><strong style={{display:'block',marginTop:3}}>{fix.title}</strong></div><span>{open?'−':'+'}</span></button>{open&&<FixDetail fix={fix}/>}</div>}

function FixDetail({fix}:{fix:LadderFix}){return <div style={detailBody}><div style={detailGrid}><MiniBlock label="WHY THIS MATTERS" text={fix.why}/><MiniBlock label="MASTER IT WHEN" text={fix.mastery}/></div>{fix.persistent?<div className="muted" style={{fontSize:11,marginTop:10}}>Detected {fix.occurrences??0} time{fix.occurrences===1?'':'s'} across {fix.gamesSeen??0} tracked game{fix.gamesSeen===1?'':'s'}.</div>:fix.evidence.length?<div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>{fix.evidence.slice(0,6).map((fight,index)=><span key={index} style={evidencePill}>{clock(fight.atSeconds)} · {fight.outcome}</span>)}</div>:null}</div>}

function MiniBlock({label,text}:{label:string;text:string}){return <div style={miniBlock}><div className="eyebrow">{label}</div><div style={{fontSize:12,lineHeight:1.45,marginTop:5}}>{text}</div></div>}

function fromHistory(fix:ProHistoryFix):LadderFix{return{id:`history-${fix.key}`,stage:fix.stage,severity:fix.severity,title:fix.title,oneLine:`Repeated in ${fix.gamesSeen} tracked game${fix.gamesSeen===1?'':'s'}.`,rule:fix.rule,mastery:fix.mastery,why:fix.why,evidence:[],persistent:true,gamesSeen:fix.gamesSeen,occurrences:fix.occurrences}}
function mergeFixes(history:LadderFix[],current:LadderFix[]):LadderFix[]{const seen=new Set<string>();const out:LadderFix[]=[];for(const fix of history){out.push(fix);seen.add(normalize(fix.title))}for(const fix of current){if(!seen.has(normalize(fix.title)))out.push(fix)}return out.slice(0,7)}
function normalize(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}

function buildMatchFixes(fights:FightReview[]):MatchFix[]{
  const deaths=fights.filter(f=>f.outcome==='DEATH'),rows:MatchFix[]=[];
  const high=deaths.filter(f=>f.evidence.currentGold>=900),red=deaths.filter(f=>f.verdict==='THEM_STRONGER'),chain=deaths.filter((f,i)=>i>0&&f.atSeconds-deaths[i-1].atSeconds<=90),thrown=deaths.filter(f=>f.verdict==='YOU_STRONGER'),low=deaths.filter(f=>(f.evidence.healthPct??1)<.55||(f.evidence.manaPct??1)<.3),even=deaths.filter(f=>f.verdict==='EVEN');
  const add=(id:string,stage:FixStage,evidence:FightReview[],title:string,oneLine:string,rule:string,mastery:string,why:string)=>{if(evidence.length)rows.push({id:`match-${id}`,stage,severity:severity(evidence.length),title,oneLine,rule,mastery,why,evidence})};
  add('bank','QUICK WIN',high,'Spend before you fight','You died with meaningful gold still unspent.','If a safe reset buys meaningful power, bank before the next voluntary fight.','3 completed games with no reviewed death while carrying 900g+.','Unspent gold gives you no combat stats until it is converted into items.');
  add('red','CONTROL',red,'Stop accepting red-state fights','You died after visible power had already moved against you.','If level/item state is red, add numbers, setup or first damage before committing.','3 games with zero deaths from clearly enemy-favoured visible states.','The leak starts with fight selection, before mechanics can save the play.');
  add('chain','CONTROL',chain,'Break the second death','Another death followed within 90 seconds.','After dying: collect safe resources, rebuild information, then re-enter.','3 games with no second death inside 90 seconds.','The second death compounds the first loss and removes your recovery window.');
  add('throw','DISCIPLINE',thrown,'Protect your advantage','You created a stronger visible state and still gave it back.','When ahead, force the enemy to enter your threat instead of turning the lead into an uncontrolled chase.','3 games with zero reviewed deaths from a clearly stronger state.','A lead only matters when it survives long enough to convert into the next advantage.');
  add('resource','DISCIPLINE',low,'Stop fighting on empty','Low HP or resource reduced your margin for error.','Check HP/resource before committing; shorten the play or leave when the state is red.','3 games with no reviewed death beginning below the danger threshold.','Low resources make otherwise recoverable execution errors lethal.');
  add('even','ADVANCED',even,'Win the setup before the fight','Visible combat power was close, so setup mattered more.','Earn numbers, first damage, terrain, ally CC or safer target access before committing.','Across 3 games, convert more even-state reviewed fights than you lose.','When raw stats are close, setup quality becomes the deciding advantage.');
  return rows.slice(0,5);
}
function severity(n:number):Severity{return n>=4?'CRITICAL LEAK':n>=3?'MAJOR LEAK':n>=2?'ACTIVE LEAK':'POLISH'}
function clock(seconds:number){const s=Math.max(0,Math.floor(seconds));return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}

const tierPill:React.CSSProperties={padding:'7px 10px',borderRadius:999,border:'1px solid rgba(214,255,47,.3)',fontSize:10,fontWeight:950,letterSpacing:'.08em'};
const stageRail:React.CSSProperties={display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:6};
const stageCell:React.CSSProperties={display:'grid',gap:3,padding:'9px 8px',border:'1px solid rgba(255,255,255,.08)',borderRadius:11,minWidth:0};
const activeShell:React.CSSProperties={border:'1px solid rgba(214,255,47,.28)',borderRadius:16,overflow:'hidden',background:'rgba(214,255,47,.025)'};
const activeButton:React.CSSProperties={width:'100%',display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:14,alignItems:'center',padding:'16px',border:0,background:'transparent',color:'inherit',textAlign:'left',cursor:'pointer'};
const ruleBar:React.CSSProperties={display:'grid',gap:4,padding:'11px 16px',borderTop:'1px solid rgba(214,255,47,.15)',background:'rgba(214,255,47,.035)',fontSize:12};
const severityPill:React.CSSProperties={padding:'4px 7px',borderRadius:999,border:'1px solid rgba(255,120,120,.3)',fontSize:8,fontWeight:950,letterSpacing:'.07em'};
const persistentPill:React.CSSProperties={padding:'4px 7px',borderRadius:999,border:'1px solid rgba(214,255,47,.22)',fontSize:8,fontWeight:900,letterSpacing:'.06em'};
const rowShell:React.CSSProperties={border:'1px solid rgba(255,255,255,.08)',borderRadius:13,overflow:'hidden',background:'rgba(255,255,255,.018)'};
const rowButton:React.CSSProperties={width:'100%',display:'grid',gridTemplateColumns:'38px minmax(0,1fr) auto',gap:10,alignItems:'center',padding:'11px 13px',border:0,background:'transparent',color:'inherit',textAlign:'left',cursor:'pointer'};
const miniSeverity:React.CSSProperties={padding:'3px 6px',borderRadius:999,border:'1px solid rgba(255,255,255,.1)',fontSize:8,fontWeight:800};
const detailBody:React.CSSProperties={padding:'12px 14px 14px',borderTop:'1px solid rgba(255,255,255,.07)'};
const detailGrid:React.CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:8};
const miniBlock:React.CSSProperties={padding:'10px',border:'1px solid rgba(255,255,255,.07)',borderRadius:11};
const evidencePill:React.CSSProperties={padding:'5px 7px',borderRadius:999,border:'1px solid rgba(255,255,255,.09)',fontSize:9};
const detailsShell:React.CSSProperties={padding:'10px 12px',border:'1px solid rgba(255,255,255,.07)',borderRadius:12};
const summaryStyle:React.CSSProperties={cursor:'pointer',fontSize:10,fontWeight:900,letterSpacing:'.07em'};
const lockedRow:React.CSSProperties={display:'grid',gridTemplateColumns:'34px minmax(0,1fr) auto',gap:8,alignItems:'center',fontSize:11,opacity:.6};
const historyBar:React.CSSProperties={display:'flex',gap:14,flexWrap:'wrap',paddingTop:3,fontSize:10,opacity:.72};
const empty:React.CSSProperties={display:'grid',gap:4,padding:14,border:'1px solid rgba(255,255,255,.08)',borderRadius:13};
