'use client';
import {useCallback,useEffect,useState} from 'react';
import {useAccount} from './AccountContext';

type Pick={cellId:number;championId:number;championName:string|null;role:string|null;lockedIn:boolean};
type Ban={championId:number;championName:string|null};
type Pregame={status:'CHAMP_SELECT'|'ENDED';startedAt:string;lastSeenAt:string;context:{phase:string|null;localChampionName:string|null;localRole:string|null;localLockedIn:boolean;allies:Pick[];enemies:Pick[];bans:{allies:Ban[];enemies:Ban[]}}};

export function LivePregameMount(){
  const {active}=useAccount();
  const [pregame,setPregame]=useState<Pregame|null>(null);
  const refresh=useCallback(async()=>{
    try{
      const response=await fetch(`/api/live/pregame?accountId=${encodeURIComponent(active.id)}`,{cache:'no-store'});
      if(!response.ok)return;
      const body=await response.json();
      setPregame(body.pregame??null);
    }catch{}
  },[active.id]);
  useEffect(()=>{
    void refresh();
    const tick=()=>{if(document.visibilityState==='visible')void refresh()};
    const id=window.setInterval(tick,8_000);
    document.addEventListener('visibilitychange',tick);
    return()=>{window.clearInterval(id);document.removeEventListener('visibilitychange',tick)};
  },[refresh]);
  if(!pregame||pregame.status!=='CHAMP_SELECT')return null;
  const c=pregame.context;
  return <section className="dash-section" style={{display:'grid',gap:14}}>
    <div className="glass card" style={{borderColor:'rgba(214,255,47,.34)'}}>
      <div className="eyebrow">CHAMP SELECT DETECTED · LOCAL LCU</div>
      <h2 style={{marginBottom:6}}>{c.localChampionName||'Selecting champion'}{c.localRole?` · ${roleLabel(c.localRole)}`:''}</h2>
      <p className="muted" style={{marginTop:0}}>Captured directly from the League client on your PC. This does not need Riot&apos;s production API. OP CLIMB stores the draft as learning context; it does not provide live shotcalling.</p>
      <div className="grid two" style={{marginTop:16}}>
        <DraftTeam title="YOUR TEAM" picks={c.allies}/>
        <DraftTeam title="ENEMY TEAM" picks={c.enemies}/>
      </div>
      <details style={{marginTop:12,padding:'11px 13px',border:'1px solid rgba(255,255,255,.08)',borderRadius:13}}>
        <summary style={{cursor:'pointer',fontSize:11,fontWeight:900,letterSpacing:'.1em'}}>DRAFT DETAILS</summary>
        <div className="grid three" style={{marginTop:12}}>
          <Mini label="PHASE" value={c.phase||'CHAMP SELECT'}/>
          <Mini label="YOUR PICK" value={c.localLockedIn?'LOCKED IN':'SELECTING'}/>
          <Mini label="VISIBLE ENEMIES" value={`${c.enemies.filter(p=>p.championId>0).length}/5`}/>
        </div>
        <div style={{display:'grid',gap:6,marginTop:12}}>
          <div className="muted" style={{fontSize:11,fontWeight:800}}>ALLY BANS</div><div>{banText(c.bans.allies)}</div>
          <div className="muted" style={{fontSize:11,fontWeight:800,marginTop:4}}>ENEMY BANS</div><div>{banText(c.bans.enemies)}</div>
        </div>
      </details>
    </div>
  </section>;
}

function DraftTeam({title,picks}:{title:string;picks:Pick[]}){return <div className="glass card"><div className="eyebrow">{title}</div><div style={{display:'grid',gap:8,marginTop:10}}>{picks.length?picks.map((pick,index)=><div key={`${pick.cellId}-${index}`} style={{display:'grid',gridTemplateColumns:'72px minmax(0,1fr) auto',gap:9,alignItems:'center',padding:'9px 10px',border:'1px solid rgba(255,255,255,.07)',borderRadius:11}}><span className="muted" style={{fontSize:10,fontWeight:900}}>{roleLabel(pick.role)}</span><b>{pick.championName||'Hidden / selecting'}</b><span style={{fontSize:9,fontWeight:900,opacity:pick.lockedIn?1:.5}}>{pick.lockedIn?'LOCKED':'PICKING'}</span></div>):<p className="muted" style={{margin:0}}>No picks exposed yet.</p>}</div></div>}
function Mini({label,value}:{label:string;value:string}){return <div style={{padding:'10px 12px',border:'1px solid rgba(255,255,255,.08)',borderRadius:12}}><span className="muted" style={{fontSize:9,fontWeight:900,letterSpacing:'.1em'}}>{label}</span><strong style={{display:'block',marginTop:4}}>{value}</strong></div>}
function roleLabel(role:string|null){const r=String(role||'').toUpperCase();if(r==='BOTTOM'||r==='ADC')return'ADC';if(r==='MIDDLE'||r==='MID')return'MID';if(r==='UTILITY'||r==='SUPPORT')return'SUPPORT';if(r==='JUNGLE')return'JUNGLE';if(r==='TOP')return'TOP';return r||'—'}
function banText(bans:Ban[]){const names=bans.filter(b=>b.championId>0).map(b=>b.championName||`Champion ${b.championId}`);return names.length?names.join(' · '):'None exposed yet'}