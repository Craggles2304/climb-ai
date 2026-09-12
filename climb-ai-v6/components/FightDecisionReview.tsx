'use client';
import {useMemo,useState} from 'react';

export type FightReview={
  atSeconds:number;
  category:'STRENGTH'|'WEAKNESS';
  outcome:'KILL'|'DEATH'|'ASSIST';
  opponent:string|null;
  opponentChampion:string|null;
  score:number;
  verdict:'YOU_STRONGER'|'EVEN'|'THEM_STRONGER';
  headline:string;
  summary:string;
  evidence:{
    youLevel:number;themLevel:number|null;levelDelta:number|null;
    youItemGold:number;themItemGold:number|null;itemGoldDelta:number|null;
    currentGold:number;healthPct:number|null;manaPct:number|null;
  };
  why:string[];
  howToWin:string[];
  howYouLose:string[];
  betterDecision:string[];
  limitation:string;
};

export function FightDecisionReview({fights}:{fights:FightReview[]}){
  const [tab,setTab]=useState<'STRENGTH'|'WEAKNESS'>('STRENGTH');
  const [openKey,setOpenKey]=useState<string|null>(null);
  const strengths=useMemo(()=>fights.filter(fight=>fight.category==='STRENGTH'),[fights]);
  const weaknesses=useMemo(()=>fights.filter(fight=>fight.category==='WEAKNESS'),[fights]);
  const visible=tab==='STRENGTH'?strengths:weaknesses;

  if(!fights.length)return <div className="glass card"><div className="eyebrow">FIGHT DECISION REVIEW</div><h3>No player-involved kill/death events were available</h3><p className="muted">OP CLIMB still has the power-state timeline below, but Riot&apos;s recorded event feed did not expose a fight involving you that could be classified here.</p></div>;

  return <div className="glass card">
    <div className="eyebrow">FIGHT DECISION REVIEW</div>
    <h2 style={{marginBottom:6}}>Strengths or weaknesses → choose the time → open the coaching</h2>
    <p className="muted" style={{marginTop:0}}>Each timestamp is tied to a recorded kill, death or assist. Click a time to see why the fight worked or failed, how the winning version should be played, how the losing version happens and what the better decision was.</p>

    <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,marginTop:18}}>
      <button type="button" onClick={()=>{setTab('STRENGTH');setOpenKey(null)}} style={tabButtonStyle(tab==='STRENGTH','strength')}>
        <span style={{fontSize:11,letterSpacing:'.13em',fontWeight:900}}>STRENGTHS</span>
        <strong style={{fontSize:24}}>{strengths.length}</strong>
        <small style={{opacity:.72}}>kills / assists / positive conversions</small>
      </button>
      <button type="button" onClick={()=>{setTab('WEAKNESS');setOpenKey(null)}} style={tabButtonStyle(tab==='WEAKNESS','weakness')}>
        <span style={{fontSize:11,letterSpacing:'.13em',fontWeight:900}}>WEAKNESSES</span>
        <strong style={{fontSize:24}}>{weaknesses.length}</strong>
        <small style={{opacity:.72}}>deaths / thrown or unfavourable fights</small>
      </button>
    </div>

    <div style={{display:'grid',gap:9,marginTop:18}}>
      {visible.length?visible.map((fight,index)=>{
        const key=`${fight.category}-${fight.atSeconds}-${fight.outcome}-${index}`;
        const open=openKey===key;
        return <div key={key} style={{border:'1px solid rgba(255,255,255,.1)',borderRadius:16,overflow:'hidden',background:'rgba(255,255,255,.025)'}}>
          <button type="button" onClick={()=>setOpenKey(open?null:key)} style={{width:'100%',display:'grid',gridTemplateColumns:'82px minmax(0,1fr) auto',gap:12,alignItems:'center',padding:'14px 16px',border:0,background:'transparent',color:'inherit',textAlign:'left',cursor:'pointer'}}>
            <strong style={{fontSize:18}}>{formatClock(fight.atSeconds)}</strong>
            <div><b>{fight.headline}</b><div className="muted" style={{fontSize:12,marginTop:2}}>{verdictLabel(fight.verdict)} · power score {signed(fight.score)}</div></div>
            <span style={{fontSize:20,opacity:.75}}>{open?'−':'+'}</span>
          </button>
          {open&&<FightDetail fight={fight}/>} 
        </div>;
      }):<div className="glass card"><p className="muted" style={{margin:0}}>No {tab==='STRENGTH'?'strength':'weakness'} fight events were captured in this game.</p></div>}
    </div>
  </div>;
}

function FightDetail({fight}:{fight:FightReview}){
  const e=fight.evidence;
  return <div style={{padding:'0 16px 18px',borderTop:'1px solid rgba(255,255,255,.08)'}}>
    <div style={{paddingTop:16}}>
      <div className="eyebrow">WHAT HAPPENED</div>
      <p style={{fontSize:15,lineHeight:1.65,marginBottom:0}}>{fight.summary}</p>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(135px,1fr))',gap:9,marginTop:16}}>
      <Evidence label="LEVEL" value={e.themLevel===null?`You L${e.youLevel}`:`L${e.youLevel} vs L${e.themLevel}`}/>
      <Evidence label="ITEM VALUE" value={e.itemGoldDelta===null?`${Math.round(e.youItemGold)}g`:`${signedGold(e.itemGoldDelta)}`}/>
      <Evidence label="YOUR HP" value={pct(e.healthPct)}/>
      <Evidence label="YOUR RESOURCE" value={pct(e.manaPct)}/>
      <Evidence label="POCKET GOLD" value={`${Math.round(e.currentGold)}g`}/>
    </div>

    <CoachBlock title={fight.category==='STRENGTH'?'WHY THIS WAS A STRENGTH':'WHY THIS WAS A WEAKNESS'} lines={fight.why}/>
    <CoachBlock title="HOW YOU WIN THIS FIGHT" lines={fight.howToWin}/>
    <CoachBlock title="HOW THIS FIGHT GETS LOST" lines={fight.howYouLose}/>
    <CoachBlock title="BETTER / REPEATABLE DECISION" lines={fight.betterDecision}/>

    <small className="muted" style={{display:'block',marginTop:16,lineHeight:1.5}}>{fight.limitation}</small>
  </div>;
}

function CoachBlock({title,lines}:{title:string;lines:string[]}){
  return <div style={{marginTop:18}}><div className="eyebrow">{title}</div><div style={{display:'grid',gap:8,marginTop:8}}>{lines.map((line,index)=><div key={index} style={{display:'grid',gridTemplateColumns:'18px minmax(0,1fr)',gap:8,lineHeight:1.55}}><span style={{opacity:.55}}>•</span><span>{line}</span></div>)}</div></div>;
}

function Evidence({label,value}:{label:string;value:string}){return <div style={{padding:'10px 12px',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,background:'rgba(255,255,255,.035)'}}><span className="muted" style={{fontSize:10,fontWeight:800,letterSpacing:'.11em'}}>{label}</span><strong style={{display:'block',fontSize:15,marginTop:3}}>{value}</strong></div>}

function tabButtonStyle(active:boolean,type:'strength'|'weakness'):React.CSSProperties{
  return {display:'grid',gap:4,padding:'16px',borderRadius:16,border:active?`1px solid ${type==='strength'?'rgba(92,255,160,.55)':'rgba(255,112,112,.55)'}`:'1px solid rgba(255,255,255,.1)',background:active?(type==='strength'?'rgba(92,255,160,.09)':'rgba(255,112,112,.09)'):'rgba(255,255,255,.025)',color:'inherit',textAlign:'left',cursor:'pointer'};
}
function verdictLabel(value:FightReview['verdict']){return value==='YOU_STRONGER'?'YOU WERE VISIBLY STRONGER':value==='THEM_STRONGER'?'THEY WERE VISIBLY STRONGER':'VISIBLE POWER WAS CLOSE'}
function pct(value:number|null){return value===null?'Not exposed':`${Math.round(value*100)}%`}
function signedGold(value:number){return`${value>0?'+':''}${Math.round(value)}g`}
function signed(value:number){return`${value>0?'+':''}${Math.round(value*10)/10}`}
function formatClock(seconds:number){const s=Math.max(0,Math.floor(seconds));return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
