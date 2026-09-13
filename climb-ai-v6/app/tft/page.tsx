'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {TftShell} from '@/components/TftShell';
import {useAccount} from '@/components/AccountContext';
import {useSubscription} from '@/components/SubscriptionContext';
import {getBrowserClient} from '@/lib/supabase/client';
import {summarizeTft,tftCoachingRead,type TftMatch} from '@/lib/tft/types';
import {track} from '@/lib/analytics';

function mapRow(row:any):TftMatch{return{
  id:row.external_match_id,riotAccountId:row.riot_account_id,queueId:row.queue_id??undefined,
  playedAt:row.game_datetime||row.created_at,gameLengthSeconds:Number(row.game_length_seconds||0),gameVersion:row.game_version||'',
  setNumber:row.set_number??undefined,setCoreName:row.set_core_name??undefined,placement:Number(row.placement),level:row.level??undefined,
  lastRound:row.last_round??undefined,playersEliminated:row.players_eliminated??undefined,totalDamageToPlayers:row.total_damage_to_players??undefined,
  goldLeft:row.gold_left??undefined,augments:Array.isArray(row.augments)?row.augments:[],traits:Array.isArray(row.traits)?row.traits:[],
  units:Array.isArray(row.units)?row.units:[],companion:row.companion||undefined,compSignature:row.comp_signature||'UNRESOLVED COMP',
}}

export default function TftHome(){
  const {active,authenticated}=useAccount();
  const {tftTier}=useSubscription();
  const [matches,setMatches]=useState<TftMatch[]>([]);
  const [rank,setRank]=useState('UNRANKED');
  const [loading,setLoading]=useState(true);
  const [syncing,setSyncing]=useState(false);
  const [message,setMessage]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);setMessage('');
    const client=await getBrowserClient();
    if(!client){setMatches([]);setLoading(false);return}
    const {data:userData}=await client.auth.getUser();
    if(!userData.user){setMatches([]);setLoading(false);return}
    const [{data:rows,error},{data:profile}]=await Promise.all([
      client.from('tft_matches').select('external_match_id,riot_account_id,queue_id,game_datetime,game_length_seconds,game_version,set_number,set_core_name,placement,level,last_round,players_eliminated,total_damage_to_players,gold_left,augments,traits,units,companion,comp_signature,created_at').eq('user_id',userData.user.id).eq('riot_account_id',active.id).order('game_datetime',{ascending:false}).limit(20),
      client.from('tft_profiles').select('rank_tier,rank_division,league_points').eq('user_id',userData.user.id).eq('riot_account_id',active.id).maybeSingle(),
    ]);
    if(error)setMessage(error.message);
    setMatches((rows||[]).map(mapRow));
    setRank(profile?.rank_tier?`${profile.rank_tier} ${profile.rank_division||''} · ${profile.league_points??0} LP`.trim():'UNRANKED');
    setLoading(false);
  },[active.id]);

  useEffect(()=>{void load()},[load]);
  const summary=useMemo(()=>summarizeTft(matches),[matches]);
  const read=useMemo(()=>tftCoachingRead(matches),[matches]);

  const sync=async()=>{
    setSyncing(true);setMessage('');track('tft_sync_started',{accountId:active.id});
    try{
      const res=await fetch('/api/tft/sync',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({riotAccountId:active.id,count:10})});
      const body=await res.json();
      if(!res.ok)throw new Error(body.error||'TFT sync failed.');
      track('tft_match_synced',{inserted:body.matchesImported||0});
      setMessage(`${body.matchesImported||0} new TFT match${body.matchesImported===1?'':'es'} imported.`);
      await load();
    }catch(err){setMessage(err instanceof Error?err.message:'TFT sync failed.')}finally{setSyncing(false)}
  };

  return <TftShell><main className="container section">
    <div className="eyebrow">SEPARATE PRODUCT · TFT CLIMB</div>
    <div style={{display:'flex',justifyContent:'space-between',gap:18,alignItems:'flex-end',flexWrap:'wrap'}}>
      <div><h1 style={{marginBottom:8}}>TACTICIAN DEVELOPMENT HQ</h1><p className="muted" style={{maxWidth:720}}>Your League account identity carries across. Your TFT rank, match model, coaching history and subscription do not.</p></div>
      <button className="btn primary" onClick={sync} disabled={syncing||!authenticated}>{syncing?'SYNCING TFT…':'SYNC TFT MATCHES'}</button>
    </div>

    {message&&<div className="glass card" style={{marginTop:16,padding:14}}><b>{message}</b></div>}

    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginTop:22}}>
      <div className="glass card"><div className="eyebrow">TFT RANK</div><h2>{rank}</h2></div>
      <div className="glass card"><div className="eyebrow">AVG PLACE</div><h2>{summary.games?summary.averagePlacement.toFixed(2):'—'}</h2><span className="muted">last {summary.games} tracked</span></div>
      <div className="glass card"><div className="eyebrow">TOP 4</div><h2>{summary.games?`${Math.round(summary.top4Rate*100)}%`:'—'}</h2></div>
      <div className="glass card"><div className="eyebrow">1ST PLACE</div><h2>{summary.games?`${Math.round(summary.winRate*100)}%`:'—'}</h2></div>
      <div className="glass card"><div className="eyebrow">TFT ACCESS</div><h2>{tftTier}</h2><Link href="/tft/pricing" className="text-link">MANAGE TFT PLAN →</Link></div>
    </section>

    <section className="glass card" style={{marginTop:18}}>
      <div className="eyebrow">CURRENT TFT FIX</div><h2>{read.title}</h2><p>{read.detail}</p><div className="cue-row"><span>NEXT TARGET</span><b>{read.target}</b></div>
      {tftTier==='FREE'&&<p className="muted" style={{fontSize:12,marginTop:12}}>FREE keeps the baseline and one coaching focus. TFT PLUS/PRO will unlock deeper comp, augment and recurring-pattern memory independently from League access.</p>}
    </section>

    <section style={{display:'grid',gridTemplateColumns:'minmax(0,1.5fr) minmax(260px,.7fr)',gap:16,marginTop:18}}>
      <div className="glass card"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div className="eyebrow">RECENT BOARDS</div><h2>LATEST TFT RESULTS</h2></div><Link href="/tft/matches" className="text-link">ALL MATCHES →</Link></div>
        {loading?<p className="muted">Loading TFT history…</p>:matches.length===0?<div><p className="muted">No TFT evidence yet. Sync recent ranked games to create the first baseline.</p><button className="btn primary" onClick={sync} disabled={syncing||!authenticated}>IMPORT FIRST TFT GAMES</button></div>:<div style={{display:'grid',gap:8}}>{matches.slice(0,6).map(m=><div key={m.id} style={{display:'grid',gridTemplateColumns:'70px 1fr auto',gap:12,alignItems:'center',padding:'11px 0',borderBottom:'1px solid rgba(255,255,255,.08)'}}><strong>#{m.placement}</strong><div><b>{m.compSignature}</b><div className="muted" style={{fontSize:11}}>Level {m.level||'—'} · Round {m.lastRound||'—'} · {m.goldLeft??'—'}g left</div></div><span className="muted">{new Date(m.playedAt).toLocaleDateString()}</span></div>)}</div>}
      </div>
      <div className="glass card"><div className="eyebrow">PRODUCT RULE</div><h3>NO LIVE AUTOPILOT</h3><p className="muted">TFT CLIMB analyses finished games and gives static preparation. It will not dynamically prescribe rolls, buys or positioning from your live actions.</p><Link className="btn secondary" href="/tft/coach">OPEN TFT COACH</Link></div>
    </section>
  </main></TftShell>;
}
