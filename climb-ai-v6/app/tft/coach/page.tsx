'use client';
import {useEffect,useMemo,useState} from 'react';
import {TftShell} from '@/components/TftShell';
import {useAccount} from '@/components/AccountContext';
import {useSubscription} from '@/components/SubscriptionContext';
import {getBrowserClient} from '@/lib/supabase/client';
import {summarizeTft,tftCoachingRead,type TftMatch} from '@/lib/tft/types';

function map(row:any):TftMatch{return{id:row.external_match_id,riotAccountId:row.riot_account_id,playedAt:row.game_datetime,gameLengthSeconds:Number(row.game_length_seconds||0),gameVersion:row.game_version||'',placement:Number(row.placement),level:row.level??undefined,lastRound:row.last_round??undefined,playersEliminated:row.players_eliminated??undefined,totalDamageToPlayers:row.total_damage_to_players??undefined,goldLeft:row.gold_left??undefined,augments:Array.isArray(row.augments)?row.augments:[],traits:Array.isArray(row.traits)?row.traits:[],units:Array.isArray(row.units)?row.units:[],compSignature:row.comp_signature||'UNRESOLVED COMP'};}

export default function TftCoach(){
  const {active}=useAccount();const {tftTier}=useSubscription();const [matches,setMatches]=useState<TftMatch[]>([]);
  useEffect(()=>{void (async()=>{const client=await getBrowserClient();if(!client)return;const {data:userData}=await client.auth.getUser();if(!userData.user)return;const {data}=await client.from('tft_matches').select('*').eq('user_id',userData.user.id).eq('riot_account_id',active.id).order('game_datetime',{ascending:false}).limit(20);setMatches((data||[]).map(map));})()},[active.id]);
  const summary=useMemo(()=>summarizeTft(matches),[matches]);const read=useMemo(()=>tftCoachingRead(matches),[matches]);
  const spread=matches.length?Math.max(...matches.map(m=>m.placement))-Math.min(...matches.map(m=>m.placement)):0;
  return <TftShell><main className="container section">
    <div className="eyebrow">TFT DEVELOPMENT COACH</div><h1>FIX THE PATTERN, NOT ONE ROLL.</h1><p className="muted" style={{maxWidth:760}}>This coach reads repeated post-game evidence. It does not give live prescriptions based on your current board state.</p>
    <section className="glass card" style={{marginTop:20}}><div className="eyebrow">#1 CURRENT LEAK</div><h2>{read.title}</h2><p>{read.detail}</p><div className="cue-row"><span>NEXT 3–5 GAMES</span><b>{read.target}</b></div></section>
    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:14,marginTop:16}}>
      <div className="glass card"><div className="eyebrow">CONSISTENCY</div><h2>{matches.length?`${spread} places`:'—'}</h2><p className="muted">Placement spread across the tracked sample. Narrowing the floor usually matters before chasing more 1sts.</p></div>
      <div className="glass card"><div className="eyebrow">RECENT FORM</div><h2>{summary.games?summary.recentForm.toFixed(2):'—'}</h2><p className="muted">Average placement across the latest five tracked games.</p></div>
      <div className="glass card"><div className="eyebrow">TOP-4 RATE</div><h2>{summary.games?`${Math.round(summary.top4Rate*100)}%`:'—'}</h2><p className="muted">Used as outcome context, never as a replacement MMR or hidden skill rating.</p></div>
    </section>
    <section className="glass card" style={{marginTop:16}}><div className="eyebrow">ACCESS DEPTH</div><h3>TFT {tftTier}</h3>{tftTier==='FREE'?<p className="muted">FREE keeps one primary coaching focus. TFT PLUS/PRO will add longer memory, comp/augment pattern grouping and deeper recurring-decision review without granting League features.</p>:<p className="muted">Your paid TFT entitlement is separate from League access.</p>}</section>
  </main></TftShell>;
}
