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

  return <TftShell><main className="tft-page">
    <section className="tft-hero">
      <div className="tft-hero-copy">
        <div className="eyebrow">OP CLIMB · TEAMFIGHT TACTICS</div>
        <h1>YOUR TFT CLIMB STARTS WITH YOUR DECISIONS.</h1>
        <p>Same coaching system as League. Your Companion records the game, TFT DNA turns repeated decisions into a player profile, and Decision Twin chooses what you should train next.</p>
        <div className="tft-hero-actions">
          <Link className="btn primary" href="/tft/coach">OPEN MY TFT DNA →</Link>
          <Link className="btn secondary" href="/tft/timeline">REVIEW LAST GAME</Link>
          {syncAvailable?<button className="btn secondary" onClick={sync} disabled={syncing||!authenticated}>{syncing?'SYNCING TFT…':'SYNC TFT MATCHES'}</button>:null}
        </div>
      </div>
      <div className="tft-hero-side">
        <div className="tft-hero-signal primary"><span>TACTICIAN GRADE</span><strong>{profile.grade??'—'}</strong></div>
        <div className="tft-hero-signal"><span>PRIMARY LEAK</span><strong>{profile.primaryLeak?.label||read.title}</strong></div>
        <div className="tft-hero-signal"><span>MODEL CONFIDENCE</span><strong>{profile.confidence}%</strong></div>
      </div>
    </section>

    <section className="tft-path" aria-label="TFT climb flow">
      <div className="tft-path-head"><span>YOUR TFT CLIMB</span><b>ONE CLEAR LOOP</b></div>
      <ol>
        <li className="done"><i>1</i><span>COMPANION</span></li>
        <li className={matches.length?'done':'active'}><i>2</i><span>PLAY TFT</span></li>
        <li className={matches.length?'done':''}><i>3</i><span>REVIEW TIMELINE</span></li>
        <li className={matches.length?'active':''}><i>4</i><span>TRAIN DNA</span></li>
        <li><i>5</i><span>PROVE TRANSFER</span></li>
      </ol>
    </section>

    {message&&<div className="glass card" style={{marginBottom:14,padding:14}}><b>{message}</b></div>}

    <section className="tft-stat-strip">
      <div className="tft-stat"><span>TACTICIAN GRADE</span><b>{profile.grade??'—'}</b><small>{profile.confidence}% evidence confidence</small></div>
      <div className="tft-stat"><span>TFT RANK</span><b>{rank}</b><small>{syncAvailable?'Riot profile':'Connect sync to populate'}</small></div>
      <div className="tft-stat"><span>AVG PLACE</span><b>{summary.games?summary.averagePlacement.toFixed(2):'—'}</b><small>{summary.games?'last '+summary.games+' tracked games':'No games yet'}</small></div>
      <div className="tft-stat"><span>TOP 4</span><b>{summary.games?Math.round(summary.top4Rate*100)+'%':'—'}</b><small>Outcome context</small></div>
      <div className="tft-stat"><span>1ST PLACE</span><b>{summary.games?Math.round(summary.winRate*100)+'%':'—'}</b><small>Conversion context</small></div>
      <div className="tft-stat"><span>PLAN</span><b>{tftTier}</b><small>Shared across League + TFT</small></div>
    </section>

    <div className="tft-section-head">
      <div><div className="eyebrow">YOUR NEXT DEVELOPMENT ACTION</div><h2>ONE FIX, NOT TEN TOOLS.</h2><p>OP CLIMB should tell you where to go next. The labs sit underneath the coaching loop instead of competing with it.</p></div>
      <Link href="/tft/coach" className="btn primary">VIEW MY DEVELOPMENT →</Link>
    </div>

    <section className="tft-focus-grid">
      <article className="tft-focus">
        <span>CURRENT TFT FIX</span>
        <h2>{profile.primaryLeak?.label||read.title}</h2>
        <p>{profile.primaryLeak?.rationale||read.detail}</p>
        <div className="tft-focus-rule"><small>YOUR JOB NEXT GAME</small><b>{profile.primaryLeak?profile.ilp.find(task=>task.skill===profile.primaryLeak?.key)?.target||read.target:read.target}</b></div>
      </article>
      <aside className="tft-grade"><span>TACTICIAN GRADE</span><strong>{profile.grade??'—'}</strong><small>{profile.confidence}% confidence<br/>built from tracked decision evidence</small></aside>
    </section>

    <div className="tft-section-head">
      <div><div className="eyebrow">CORE COACHING</div><h2>THE PARTS THAT MOVE YOUR CLIMB.</h2><p>These are the primary destinations. Everything else is a specialist lab when you need it.</p></div>
    </div>
    <section className="tft-core-grid">
      <Link href="/tft/coach" className="tft-core-card"><span className="tft-card-number">01 · PLAYER MODEL</span><h3>MY TFT DNA</h3><p>Six decision domains, recurring patterns, missions and transfer progress.</p><span className="tft-card-link">OPEN DNA →</span></Link>
      <Link href="/tft/timeline" className="tft-core-card"><span className="tft-card-number">02 · POST-GAME</span><h3>DECISION TIMELINE</h3><p>See the rounds where economy, stabilisation and board progression actually changed the game.</p><span className="tft-card-link">REVIEW GAME →</span></Link>
      <Link href="/tft/game-plan" className="tft-core-card"><span className="tft-card-number">03 · BEFORE QUEUE</span><h3>GAME PLAN</h3><p>Lock simple rules before the result exists so the post-game review can compare intention with execution.</p><span className="tft-card-link">SET PLAN →</span></Link>
      <Link href="/tft/decision-lab" className="tft-core-card"><span className="tft-card-number">04 · DECISION TWIN</span><h3>REPLAY A DECISION</h3><p>Rebuild a key spot and test the principle behind hold, level, roll or pivot.</p><span className="tft-card-link">OPEN LAB →</span></Link>
      <Link href="/tft/transition-planner" className="tft-core-card"><span className="tft-card-number">05 · FLEXIBILITY</span><h3>PIVOT PLANNER</h3><p>Turn the board you have into a realistic target without pretending every game follows a comp sheet.</p><span className="tft-card-link">PLAN PIVOT →</span></Link>
      <Link href="/tft/roll-lab" className="tft-core-card"><span className="tft-card-number">06 · ECONOMY</span><h3>ROLL LAB</h3><p>Model shop odds, pool pressure and the cost of rolling versus levelling.</p><span className="tft-card-link">OPEN ROLL LAB →</span></Link>
    </section>

    <div className="tft-section-head">
      <div><div className="eyebrow">LATEST EVIDENCE</div><h2>YOUR LAST GAMES.</h2><p>Results give context. Decision evidence explains why the result happened.</p></div>
      <Link href="/tft/matches" className="text-link">ALL MATCHES →</Link>
    </div>
    <section className="glass card" style={{padding:22}}>
      {loading?<p className="muted">Loading TFT history…</p>:matches.length===0?<div><h3>NO TFT EVIDENCE YET</h3><p className="muted">Play normally with the Companion running. Your first recorded games will start building the profile.</p></div>:<div style={{display:'grid',gap:0}}>{matches.slice(0,6).map(m=><div key={m.id} style={{display:'grid',gridTemplateColumns:'70px minmax(0,1fr) auto',gap:12,alignItems:'center',padding:'13px 0',borderBottom:'1px solid rgba(255,255,255,.07)'}}><strong style={{fontSize:24}}>#{m.placement}</strong><div><b>{m.compSignature}</b><div className="muted" style={{fontSize:11,marginTop:3}}>Level {m.level||'—'} · Round {m.lastRound||'—'} · {m.goldLeft??'—'}g left · {m.decisionReview?'Decision Review ready':'scoreboard context'}</div></div><span className="muted" style={{fontSize:11}}>{new Date(m.playedAt).toLocaleDateString()}</span></div>)}</div>}
    </section>

    <details className="glass card" style={{marginTop:14,padding:18}}>
      <summary style={{cursor:'pointer',fontWeight:800}}>MORE TFT LABS</summary>
      <div className="tft-core-grid" style={{marginTop:14}}>
        <Link href="/tft/item-finder" className="tft-core-card"><span className="tft-card-number">ITEMS</span><h3>ITEM FINDER</h3><p>Component-to-carry directions and flex-preserving slams.</p></Link>
        <Link href="/tft/augment-lab" className="tft-core-card"><span className="tft-card-number">AUGMENTS</span><h3>AUGMENT LAB</h3><p>Compare immediate strength, scaling, synergy and commitment risk.</p></Link>
        <Link href="/tft/carry-builder" className="tft-core-card"><span className="tft-card-number">BOARD CORE</span><h3>CARRY BUILDER</h3><p>Build a coherent shell around your chosen carry.</p></Link>
        <Link href="/tft/board-lab" className="tft-core-card"><span className="tft-card-number">BOARD QUALITY</span><h3>BOARD LAB</h3><p>Score units, stars, items and structural board strength.</p></Link>
        <Link href="/tft/board-compare" className="tft-core-card"><span className="tft-card-number">COMPARE</span><h3>BOARD COMPARE</h3><p>Compare two board states without losing the context of the transition.</p></Link>
        <Link href="/tft/set-lab" className="tft-core-card"><span className="tft-card-number">SET KNOWLEDGE</span><h3>SET LAB</h3><p>Practice set-specific knowledge separately from your long-term decision identity.</p></Link>
      </div>
    </details>

    <details className="glass card" style={{marginTop:14,padding:18}}>
      <summary style={{cursor:'pointer',fontWeight:800}}>MANUAL MATCH ENTRY / FALLBACK</summary>
      <div style={{marginTop:14}}><ManualTftMatchForm riotAccountId={active.id} disabled={!authenticated} onSaved={load}/></div>
    </details>
  </main></TftShell>;
}
