'use client';
import {useCallback,useEffect,useState} from 'react';
import {useAccount} from './AccountContext';
import {FightDecisionReview,type FightReview} from './FightDecisionReview';
import {CompactFixLadder} from './CompactFixLadder';
import {MapTempoReview} from './MapTempoReview';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';
import type {ProLearningProfile} from '@/lib/riot/proHistory';

type Review={sessionId:string;status:string;snapshotCount:number;summary?:{fightReviews?:FightReview[]};proAnalysis?:ProMatchAnalysis|null;historyProfile?:ProLearningProfile|null};
type Pick={championId:number;championName:string|null;role:string|null;lockedIn:boolean};
type Ban={championId:number;championName:string|null};
type Pregame={linkedSessionId:string|null;status:'CHAMP_SELECT'|'ENDED';context:{localChampionName:string|null;localRole:string|null;allies:Pick[];enemies:Pick[];bans:{allies:Ban[];enemies:Ban[]}}};

export function LiveFightReviewMount(){
  const {active}=useAccount();
  const [review,setReview]=useState<Review|null>(null);
  const [pregame,setPregame]=useState<Pregame|null>(null);
  const refresh=useCallback(async()=>{
    try{
      const [reviewResponse,pregameResponse]=await Promise.all([
        fetch(`/api/live/telemetry?accountId=${encodeURIComponent(active.id)}`,{cache:'no-store'}),
        fetch(`/api/live/pregame?accountId=${encodeURIComponent(active.id)}`,{cache:'no-store'}),
      ]);
      if(reviewResponse.ok){const body=await reviewResponse.json();setReview(body.review??null)}
      if(pregameResponse.ok){const body=await pregameResponse.json();setPregame(body.pregame??null)}
    }catch{}
  },[active.id]);
  useEffect(()=>{void refresh();const id=window.setInterval(()=>void refresh(),15_000);return()=>window.clearInterval(id)},[refresh]);
  if(!review||!['COMPLETE','ABORTED'].includes(review.status))return null;
  const fights=review.summary?.fightReviews??[];
  const matchDraft=pregame?.linkedSessionId===review.sessionId?pregame:null;
  return <section className="dash-section" style={{display:'grid',gap:14}}>
    {matchDraft&&<DraftEvidence pregame={matchDraft}/>} 
    <div><div className="eyebrow">OP COACHING</div><h2 style={{margin:'5px 0 0'}}>One priority first. Deeper evidence only when you open it.</h2></div>
    <CompactFixLadder fights={fights} historyProfile={review.historyProfile}/>
    <MapTempoReview fights={fights} analysis={review.proAnalysis}/>
    <div className="op-review-with-compact-ladder">
      <FightDecisionReview fights={fights} proAnalysis={review.proAnalysis} historyProfile={review.historyProfile}/>
    </div>
    <style jsx global>{`
      .op-review-with-compact-ladder > div > section:nth-of-type(4){display:none!important;}
    `}</style>
  </section>;
}

function DraftEvidence({pregame}:{pregame:Pregame}){const c=pregame.context;return <details className="glass card"><summary style={{cursor:'pointer',fontWeight:900}}>DRAFT CONTEXT · {c.localChampionName||'Your pick'}{c.localRole?` · ${roleLabel(c.localRole)}`:''}</summary><p className="muted">This champion-select snapshot is linked to this exact tracked match and remains part of the saved learning evidence.</p><div className="grid two" style={{marginTop:12}}><DraftList title="YOUR DRAFT" picks={c.allies}/><DraftList title="ENEMY DRAFT" picks={c.enemies}/></div><div style={{marginTop:12,fontSize:12}}><b>Ally bans:</b> {banText(c.bans.allies)}<br/><b>Enemy bans:</b> {banText(c.bans.enemies)}</div></details>}
function DraftList({title,picks}:{title:string;picks:Pick[]}){return <div><div className="eyebrow">{title}</div><div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:7}}>{picks.filter(p=>p.championId>0).map((p,i)=><span key={`${p.championId}-${i}`} style={{padding:'6px 8px',border:'1px solid rgba(255,255,255,.09)',borderRadius:999,fontSize:11}}>{p.championName||`Champion ${p.championId}`}{p.role?` · ${roleLabel(p.role)}`:''}</span>)}</div></div>}
function roleLabel(role:string){const r=role.toUpperCase();if(r==='BOTTOM'||r==='ADC')return'ADC';if(r==='MIDDLE'||r==='MID')return'MID';if(r==='UTILITY'||r==='SUPPORT')return'SUPPORT';return r}
function banText(bans:Ban[]){const names=bans.filter(b=>b.championId>0).map(b=>b.championName||`Champion ${b.championId}`);return names.length?names.join(' · '):'None recorded'}
