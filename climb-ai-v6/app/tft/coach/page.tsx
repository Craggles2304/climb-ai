'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {TftShell} from '@/components/TftShell';
import {useAccount} from '@/components/AccountContext';
import {useSubscription} from '@/components/SubscriptionContext';
import {getBrowserClient} from '@/lib/supabase/client';
import {summarizeTft,tftCoachingRead,type TftMatch} from '@/lib/tft/types';
import {track} from '@/lib/analytics';

function map(row:any):TftMatch{return{id:row.external_match_id,riotAccountId:row.riot_account_id,playedAt:row.game_datetime||row.created_at,gameLengthSeconds:Number(row.game_length_seconds||0),gameVersion:row.game_version||'',placement:Number(row.placement),level:row.level??undefined,lastRound:row.last_round??undefined,playersEliminated:row.players_eliminated??undefined,totalDamageToPlayers:row.total_damage_to_players??undefined,goldLeft:row.gold_left??undefined,augments:Array.isArray(row.augments)?row.augments:[],traits:Array.isArray(row.traits)?row.traits:[],units:Array.isArray(row.units)?row.units:[],compSignature:row.comp_signature||'UNRESOLVED COMP',review:row.raw?.review||undefined};}

export default function TftCoach(){
  const {active}=useAccount();const {tftTier}=useSubscription();const [matches,setMatches]=useState<TftMatch[]>([]);
  useEffect(()=>{track('tft_coach_view');void (async()=>{const client=await getBrowserClient();if(!client)return;const {data:userData}=await client.auth.getUser();if(!userData.user)return;const {data}=await client.from('tft_matches').select('*').eq('user_id',userData.user.id).eq('riot_account_id',active.id).order('game_datetime',{ascending:false}).limit(20);setMatches((data||[]).map(map));})()},[active.id]);
  const summary=useMemo(()=>summarizeTft(matches),[matches]);const read=useMemo(()=>tftCoachingRead(matches),[matches]);
  const spread=matches.length?Math.max(...matches.map(m=>m.placement))-Math.min(...matches.map(m=>m.placement)):0;
  const reviews=matches.filter(m=>m.review);
  const reasons=reviews.reduce<Record<string,number>>((acc,m)=>{const r=m.review?.lossReason;if(r)acc[r]=(acc[r]||0)+1;return acc},{});
  const topReasons=Object.entries(reasons).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const planMisses=reviews.filter(m=>m.review?.planFollowed==='no').length;
  const lateRolls=reviews.filter(m=>m.review?.rolledTooLate===true).length;

  return <TftShell><main className="container section">
    <div className="eyebrow">TFT DEVELOPMENT COACH</div><h1>FIX THE PATTERN, NOT ONE ROLL.</h1><p className="muted" style={{maxWidth:760}}>This coach combines outcome evidence with your own post-game decision reviews. A leak only becomes active after it repeats.</p>
    <section className="glass card" style={{marginTop:20}}><div className="eyebrow">#1 CURRENT LEAK</div><h2>{read.title}</h2><p>{read.detail}</p><div className="cue-row"><span>NEXT 3–5 GAMES</span><b>{read.target}</b></div><Link className="btn primary" href="/tft/game-plan" style={{marginTop:14}}>LOCK PLAN FOR NEXT GAME</Link></section>
    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:14,marginTop:16}}>
      <div className="glass card"><div className="eyebrow">CONSISTENCY</div><h2>{matches.length?`${spread} places`:'—'}</h2><p className="muted">Placement spread across the tracked sample. Narrowing the floor usually matters before chasing more 1sts.</p></div>
      <div className="glass card"><div className="eyebrow">RECENT FORM</div><h2>{summary.games?summary.recentForm.toFixed(2):'—'}</h2><p className="muted">Average placement across the latest five tracked games.</p></div>
      <div className="glass card"><div className="eyebrow">DECISION REVIEWS</div><h2>{reviews.length}</h2><p className="muted">Manual reflections available to the pattern engine.</p></div>
      <div className="glass card"><div className="eyebrow">PLAN MISSES</div><h2>{reviews.length?planMisses:'—'}</h2><p className="muted">Games where you marked the locked plan as not followed.</p></div>
    </section>

    <section className="glass card" style={{marginTop:16}}>
      <div className="eyebrow">DECISION FINGERPRINT · CURRENT SAMPLE</div><h3>WHAT YOU SAY IS REPEATING</h3>
      {reviews.length===0?<p className="muted">Complete the Decision Review after manual games. Two matching reviews are required before OP CLIMB treats a problem as repeated evidence.</p>:<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginTop:12}}>
        {topReasons.map(([reason,count])=><div key={reason} style={{padding:12,border:'1px solid rgba(255,255,255,.08)',borderRadius:14}}><small className="muted">{reason.toUpperCase()}</small><b style={{display:'block',fontSize:22}}>{count}×</b></div>)}
        <div style={{padding:12,border:'1px solid rgba(255,255,255,.08)',borderRadius:14}}><small className="muted">LATE ROLL</small><b style={{display:'block',fontSize:22}}>{lateRolls}×</b></div>
      </div>}
    </section>

    <section className="glass card" style={{marginTop:16}}><div className="eyebrow">ACCESS DEPTH</div><h3>TFT {tftTier}</h3>{tftTier==='FREE'?<p className="muted">FREE keeps one primary coaching focus. TFT PLUS/PRO can later add longer memory, comp/augment grouping and deeper recurring-decision review without granting League features.</p>:<p className="muted">Your paid TFT entitlement is separate from League access.</p>}</section>
  </main></TftShell>;
}
