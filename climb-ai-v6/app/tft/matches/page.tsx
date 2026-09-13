'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {TftShell} from '@/components/TftShell';
import {useAccount} from '@/components/AccountContext';
import {getBrowserClient} from '@/lib/supabase/client';

export default function TftMatches(){
  const {active}=useAccount();
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{void (async()=>{
    setLoading(true);
    const client=await getBrowserClient();
    if(!client){setRows([]);setLoading(false);return}
    const {data:userData}=await client.auth.getUser();
    if(!userData.user){setRows([]);setLoading(false);return}
    const {data}=await client.from('tft_matches').select('external_match_id,game_datetime,placement,level,last_round,players_eliminated,total_damage_to_players,gold_left,augments,comp_signature,set_number,raw').eq('user_id',userData.user.id).eq('riot_account_id',active.id).order('game_datetime',{ascending:false}).limit(50);
    setRows(data||[]);setLoading(false);
  })()},[active.id]);

  return <TftShell><main className="container section">
    <div className="eyebrow">TFT · POST-GAME EVIDENCE</div><h1>MATCH HISTORY</h1><p className="muted">Placements are not the diagnosis. Manual games can carry the decision context Riot history cannot know: whether you followed the plan, rolled late or identified economy, tempo, positioning or a contested line as the key issue.</p>
    <div className="glass card" style={{marginTop:20}}>
      {loading?<p className="muted">Loading TFT games…</p>:!rows.length?<div><p className="muted">No TFT matches tracked yet. You do not need a Riot key to start.</p><Link className="btn primary" href="/tft#log-game">LOG YOUR FIRST GAME</Link></div>:<div style={{display:'grid',gap:0}}>{rows.map(row=>{const review=row.raw?.review;return <div key={row.external_match_id} style={{padding:'14px 0',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
        <div style={{display:'grid',gridTemplateColumns:'64px minmax(170px,1fr) repeat(4,minmax(70px,.45fr))',gap:12,alignItems:'center'}}>
          <strong style={{fontSize:22}}>#{row.placement}</strong><div><b>{row.comp_signature||'UNRESOLVED COMP'}</b><div className="muted" style={{fontSize:11}}>Set {row.set_number||'—'} · {new Date(row.game_datetime).toLocaleDateString()} · {row.raw?.source==='manual'?'MANUAL REVIEW':'RIOT DATA'}</div></div>
          <div><small className="muted">LEVEL</small><b style={{display:'block'}}>{row.level??'—'}</b></div>
          <div><small className="muted">ROUND</small><b style={{display:'block'}}>{row.last_round??'—'}</b></div>
          <div><small className="muted">DAMAGE</small><b style={{display:'block'}}>{row.total_damage_to_players??'—'}</b></div>
          <div><small className="muted">GOLD LEFT</small><b style={{display:'block'}}>{row.gold_left??'—'}</b></div>
        </div>
        {review&&<div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'10px 0 0 76px'}}>
          {review.lossReason&&<span className="btn secondary" style={{padding:'5px 8px',pointerEvents:'none'}}>CAUSE · {String(review.lossReason).toUpperCase()}</span>}
          {review.firstUnstableStage&&<span className="btn secondary" style={{padding:'5px 8px',pointerEvents:'none'}}>UNSTABLE · STAGE {review.firstUnstableStage}</span>}
          {review.rolledTooLate===true&&<span className="btn secondary" style={{padding:'5px 8px',pointerEvents:'none'}}>ROLL · LATE</span>}
          {review.planFollowed&&review.planFollowed!=='unknown'&&<span className="btn secondary" style={{padding:'5px 8px',pointerEvents:'none'}}>PLAN · {String(review.planFollowed).toUpperCase()}</span>}
          {review.keyDecision&&<span className="muted" style={{fontSize:11,width:'100%'}}>Decision: {review.keyDecision}</span>}
        </div>}
      </div>})}</div>}
    </div>
  </main></TftShell>;
}
