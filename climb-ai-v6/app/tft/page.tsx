'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {TftShell} from '@/components/TftShell';
import {ManualTftMatchForm} from '@/components/ManualTftMatchForm';
import {useAccount} from '@/components/AccountContext';
import {useSubscription} from '@/components/SubscriptionContext';
import {getBrowserClient} from '@/lib/supabase/client';
import {summarizeTft,tftCoachingRead,type TftDecisionReview,type TftGamePlan,type TftMatch} from '@/lib/tft/types';
import {buildTacticianProfile} from '@/lib/tft/advancedCoach';
import {track} from '@/lib/analytics';

function mapRow(row:any):TftMatch{
  const raw=row.raw&&typeof row.raw==='object'?row.raw:{};
  return{
    id:row.external_match_id,riotAccountId:row.riot_account_id,queueId:row.queue_id??undefined,
    playedAt:row.game_datetime||row.created_at,gameLengthSeconds:Number(row.game_length_seconds||0),gameVersion:row.game_version||'',
    setNumber:row.set_number??undefined,setCoreName:row.set_core_name??undefined,placement:Number(row.placement),level:row.level??undefined,
    lastRound:row.last_round??undefined,playersEliminated:row.players_eliminated??undefined,totalDamageToPlayers:row.total_damage_to_players??undefined,
    goldLeft:row.gold_left??undefined,augments:Array.isArray(row.augments)?row.augments:[],traits:Array.isArray(row.traits)?row.traits:[],
    units:Array.isArray(row.units)?row.units:[],companion:row.companion||undefined,compSignature:row.comp_signature||'UNRESOLVED COMP',
    note:typeof raw.note==='string'?raw.note:undefined,decisionReview:raw.decisionReview as TftDecisionReview|undefined,planSnapshot:raw.planSnapshot as TftGamePlan|undefined,
  };
}

export default function TftHome(){
  const {active,authenticated}=useAccount();
  const {tftTier}=useSubscription();
  const [matches,setMatches]=useState<TftMatch[]>([]);
  const [rank,setRank]=useState('UNRANKED');
  const [loading,setLoading]=useState(true);
  const [syncing,setSyncing]=useState(false);
  const [syncAvailable,setSyncAvailable]=useState<boolean|null>(null);
  const [message,setMessage]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);
    const client=await getBrowserClient();
    if(!client){setMatches([]);setLoading(false);return}
    const {data:userData}=await client.auth.getUser();
    if(!userData.user){setMatches([]);setLoading(false);return}
    const [{data:rows,error},{data:profile}]=await Promise.all([
      client.from('tft_matches').select('external_match_id,riot_account_id,queue_id,game_datetime,game_length_seconds,game_version,set_number,set_core_name,placement,level,last_round,players_eliminated,total_damage_to_players,gold_left,augments,traits,units,companion,comp_signature,created_at,raw').eq('user_id',userData.user.id).eq('riot_account_id',active.id).order('game_datetime',{ascending:false}).limit(20),
      client.from('tft_profiles').select('rank_tier,rank_division,league_points').eq('user_id',userData.user.id).eq('riot_account_id',active.id).maybeSingle(),
    ]);
    if(error)setMessage(error.message);
    setMatches((rows||[]).map(mapRow));
    setRank(profile?.rank_tier?`${profile.rank_tier} ${profile.rank_division||''} · ${profile.league_points??0} LP`.trim():'UNRANKED');
    setLoading(false);
  },[active.id]);

  useEffect(()=>{void load()},[load]);
  useEffect(()=>{let cancelled=false;void fetch('/api/tft/sync').then(r=>r.json()).then(x=>{if(!cancelled)setSyncAvailable(Boolean(x.enabled))}).catch(()=>{if(!cancelled)setSyncAvailable(false)});return()=>{cancelled=true}},[]);
  const summary=useMemo(()=>summarizeTft(matches),[matches]);
  const read=useMemo(()=>tftCoachingRead(matches),[matches]);
  const profile=useMemo(()=>buildTacticianProfile(matches),[matches]);

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
      <div><h1 style={{marginBottom:8}}>TACTICIAN DEVELOPMENT HQ</h1><p className="muted" style={{maxWidth:790}}>TFT CLIMB can run without a Riot API key. The advanced path learns from your own decision evidence, then turns repeated leaks into five active development missions.</p></div>
      {syncAvailable?<button className="btn primary" onClick={sync} disabled={syncing||!authenticated}>{syncing?'SYNCING TFT…':'SYNC TFT MATCHES'}</button>:<span className="op-tier op-tier-plus">NO-API MODE ACTIVE</span>}
    </div>

    {syncAvailable===false&&<section className="glass card" style={{marginTop:16,padding:14,display:'grid',gridTemplateColumns:'1fr auto',gap:14,alignItems:'center'}}><div><div className="eyebrow">RIOT KEY NOT REQUIRED</div><b>The coaching loop is fully usable without automatic history.</b><p className="muted" style={{margin:'4px 0 0'}}>Lock a plan, log the finished game, review the decision, and let the profile detect repeated economy, tempo, flexibility, positioning and conversion leaks.</p></div><Link href="/tft/game-plan" className="btn secondary">BUILD GAME PLAN</Link></section>}
    {message&&<div className="glass card" style={{marginTop:16,padding:14}}><b>{message}</b></div>}

    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginTop:22}}>
      <div className="glass card"><div className="eyebrow">TACTICIAN GRADE</div><h2>{profile.grade??'—'}</h2><span className="muted">{profile.confidence}% confidence</span></div>
      <div className="glass card"><div className="eyebrow">TFT RANK</div><h2>{rank}</h2><span className="muted">Riot sync only</span></div>
      <div className="glass card"><div className="eyebrow">AVG PLACE</div><h2>{summary.games?summary.averagePlacement.toFixed(2):'—'}</h2><span className="muted">last {summary.games} tracked</span></div>
      <div className="glass card"><div className="eyebrow">TOP 4</div><h2>{summary.games?`${Math.round(summary.top4Rate*100)}%`:'—'}</h2></div>
      <div className="glass card"><div className="eyebrow">1ST PLACE</div><h2>{summary.games?`${Math.round(summary.winRate*100)}%`:'—'}</h2></div>
      <div className="glass card"><div className="eyebrow">TFT ACCESS</div><h2>{tftTier}</h2><Link href="/tft/pricing" className="text-link">MANAGE TFT PLAN →</Link></div>
    </section>

    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,marginTop:16}}>
      <Link href="/tft/game-plan" className="glass card" style={{textDecoration:'none'}}><div className="eyebrow">BEFORE QUEUE</div><h3>LOCK GAME PLAN</h3><p className="muted">Set economy, stabilise, flex and positioning rules before the result exists.</p></Link>
      <Link href="/tft/decision-lab" className="glass card" style={{textDecoration:'none'}}><div className="eyebrow">AFTER GAME / PRACTICE</div><h3>DECISION REPLAY</h3><p className="muted">Rebuild a past board state and test the principle behind hold, level, roll or pivot.</p></Link>
      <Link href="/tft/coach" className="glass card" style={{textDecoration:'none'}}><div className="eyebrow">LONG-TERM MODEL</div><h3>TACTICIAN PROFILE + ILP</h3><p className="muted">Five skill scores, confidence and five adaptive development missions.</p></Link>
    </section>

    <ManualTftMatchForm riotAccountId={active.id} disabled={!authenticated} onSaved={load}/>

    <section className="glass card" style={{marginTop:18}}>
      <div className="eyebrow">CURRENT TFT FIX</div><h2>{read.title}</h2><p>{read.detail}</p><div className="cue-row"><span>NEXT TARGET</span><b>{read.target}</b></div>
      {profile.primaryLeak&&<div className="cue-row" style={{marginTop:8}}><span>PROFILE PRIORITY</span><b>{profile.primaryLeak.label} · {profile.primaryLeak.score??'—'}/100 · {profile.primaryLeak.confidence}% confidence</b></div>}
      {tftTier==='FREE'&&<p className="muted" style={{fontSize:12,marginTop:12}}>FREE keeps the baseline coaching loop. TFT PLUS/PRO can later add longer memory, set-specific benchmarking and deeper comp/augment clustering independently from League access.</p>}
    </section>

    <section style={{display:'grid',gridTemplateColumns:'minmax(0,1.5fr) minmax(260px,.7fr)',gap:16,marginTop:18}}>
      <div className="glass card"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div className="eyebrow">RECENT BOARDS</div><h2>LATEST TFT RESULTS</h2></div><Link href="/tft/matches" className="text-link">ALL MATCHES →</Link></div>
        {loading?<p className="muted">Loading TFT history…</p>:matches.length===0?<div><p className="muted">No TFT evidence yet. Log your next finished game above. Five games is enough to start producing a useful baseline.</p></div>:<div style={{display:'grid',gap:8}}>{matches.slice(0,6).map(m=><div key={m.id} style={{display:'grid',gridTemplateColumns:'70px 1fr auto',gap:12,alignItems:'center',padding:'11px 0',borderBottom:'1px solid rgba(255,255,255,.08)'}}><strong>#{m.placement}</strong><div><b>{m.compSignature}</b><div className="muted" style={{fontSize:11}}>Level {m.level||'—'} · Round {m.lastRound||'—'} · {m.goldLeft??'—'}g left · {m.decisionReview?'reviewed':'scoreboard only'}</div></div><span className="muted">{new Date(m.playedAt).toLocaleDateString()}</span></div>)}</div>}
      </div>
      <div className="glass card"><div className="eyebrow">NO-KEY TOOLKIT</div><h3>STATIC DATA STILL WORKS</h3><p className="muted">Champions, items, augments and traits can come from Riot Data Dragon without a match API key.</p><Link className="btn primary" href="/tft/set-lab">OPEN TFT SET LAB</Link><Link className="btn secondary" href="/tft/coach" style={{marginTop:8}}>OPEN TFT COACH</Link></div>
    </section>
  </main></TftShell>;
}
