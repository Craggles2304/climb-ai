'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {TftShell} from '@/components/TftShell';
import {useAccount} from '@/components/AccountContext';
import {useSubscription} from '@/components/SubscriptionContext';
import {getBrowserClient} from '@/lib/supabase/client';
import {summarizeTft,tftCoachingRead,type TftDecisionReview,type TftGamePlan,type TftMatch} from '@/lib/tft/types';
import {buildTacticianProfile} from '@/lib/tft/advancedCoach';

function map(row:any):TftMatch{
  const raw=row.raw&&typeof row.raw==='object'?row.raw:{};
  return{id:row.external_match_id,riotAccountId:row.riot_account_id,playedAt:row.game_datetime,gameLengthSeconds:Number(row.game_length_seconds||0),gameVersion:row.game_version||'',placement:Number(row.placement),level:row.level??undefined,lastRound:row.last_round??undefined,playersEliminated:row.players_eliminated??undefined,totalDamageToPlayers:row.total_damage_to_players??undefined,goldLeft:row.gold_left??undefined,augments:Array.isArray(row.augments)?row.augments:[],traits:Array.isArray(row.traits)?row.traits:[],units:Array.isArray(row.units)?row.units:[],compSignature:row.comp_signature||'UNRESOLVED COMP',note:typeof raw.note==='string'?raw.note:undefined,decisionReview:raw.decisionReview as TftDecisionReview|undefined,planSnapshot:raw.planSnapshot as TftGamePlan|undefined};
}

function scoreTone(score:number|null){if(score===null)return 'UNKNOWN';if(score>=85)return 'ELITE';if(score>=72)return 'STRONG';if(score>=60)return 'STABLE';if(score>=45)return 'LEAK';return 'CRITICAL';}

export default function TftCoach(){
  const {active}=useAccount();const {tftTier}=useSubscription();const [matches,setMatches]=useState<TftMatch[]>([]);const [loading,setLoading]=useState(true);
  useEffect(()=>{void (async()=>{setLoading(true);const client=await getBrowserClient();if(!client){setLoading(false);return;}const {data:userData}=await client.auth.getUser();if(!userData.user){setLoading(false);return;}const {data}=await client.from('tft_matches').select('*').eq('user_id',userData.user.id).eq('riot_account_id',active.id).order('game_datetime',{ascending:false}).limit(20);setMatches((data||[]).map(map));setLoading(false);})()},[active.id]);
  const summary=useMemo(()=>summarizeTft(matches),[matches]);
  const read=useMemo(()=>tftCoachingRead(matches),[matches]);
  const profile=useMemo(()=>buildTacticianProfile(matches),[matches]);
  const spread=matches.length?Math.max(...matches.map(m=>m.placement))-Math.min(...matches.map(m=>m.placement)):0;
  const nextAction=profile.primaryLeak?profile.ilp.find(task=>task.skill===profile.primaryLeak?.key)?.target||read.target:read.target;

  return <TftShell><main className="container section">
    <div className="eyebrow">ADVANCED TFT DEVELOPMENT COACH</div><h1>BUILD THE TACTICIAN, NOT JUST THE COMP.</h1><p className="muted" style={{maxWidth:820}}>OP CLIMB separates five trainable skills and attaches confidence to every score. Missing evidence stays unknown; the system does not pretend placement alone proves why you won or lost.</p>

    <section style={{display:'grid',gridTemplateColumns:'minmax(250px,.7fr) minmax(0,1.3fr)',gap:16,marginTop:20}}>
      <div className="glass card">
        <div className="eyebrow">TACTICIAN GRADE</div>
        <div style={{display:'flex',alignItems:'baseline',gap:10,marginTop:6}}><h1 style={{fontSize:54,margin:0}}>{profile.grade??'—'}</h1><b>/100</b></div>
        <div className="cue-row"><span>MODEL CONFIDENCE</span><b>{profile.confidence}%</b></div>
        <p className="muted" style={{fontSize:12}}>This is an explicit coaching grade from tracked evidence, not Riot MMR and not a prediction of hidden rank.</p>
      </div>
      <div className="glass card">
        <div className="eyebrow">PRIMARY DEVELOPMENT LEAK</div>
        <h2>{profile.primaryLeak?profile.primaryLeak.label:read.title}</h2>
        <p>{profile.primaryLeak?.rationale||read.detail}</p>
        <div className="cue-row"><span>NEXT ACTION</span><b>{nextAction}</b></div>
      </div>
    </section>

    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12,marginTop:16}}>
      {profile.skills.map(skill=><div className="glass card" key={skill.key} style={{padding:16}}>
        <div className="eyebrow">{skill.label.toUpperCase()}</div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8}}><h2 style={{margin:'6px 0'}}>{skill.score??'—'}</h2><span className="op-tier op-tier-free">{scoreTone(skill.score)}</span></div>
        <div style={{height:7,borderRadius:99,background:'rgba(255,255,255,.08)',overflow:'hidden'}}><div style={{height:'100%',width:`${skill.score||0}%`,background:'currentColor'}}/></div>
        <div className="cue-row" style={{marginTop:10}}><span>CONFIDENCE</span><b>{skill.confidence}%</b></div>
        <p className="muted" style={{fontSize:11,minHeight:48}}>{skill.rationale}</p>
      </div>)}
    </section>

    <section className="glass card" style={{marginTop:16}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'end',flexWrap:'wrap'}}><div><div className="eyebrow">ADAPTIVE TFT ILP</div><h2>5 ACTIVE DEVELOPMENT MISSIONS</h2></div><Link href="/tft/decision-lab" className="btn secondary">OPEN DECISION REPLAY LAB</Link></div>
      <div style={{display:'grid',gap:10,marginTop:14}}>{profile.ilp.map(task=><div key={task.id} style={{display:'grid',gridTemplateColumns:'52px minmax(0,1fr) 110px',gap:12,alignItems:'center',padding:'13px 0',borderTop:'1px solid rgba(255,255,255,.08)'}}>
        <div style={{fontSize:22,fontWeight:900}}>#{task.priority}</div>
        <div><div className="eyebrow">{task.skill}</div><b>{task.title}</b><p className="muted" style={{fontSize:11,margin:'4px 0 0'}}>{task.target}</p></div>
        <div style={{textAlign:'right'}}><b>{task.progress}/{task.goal}</b><div className="muted" style={{fontSize:10}}>EVIDENCE HITS</div></div>
      </div>)}</div>
    </section>

    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:14,marginTop:16}}>
      <div className="glass card"><div className="eyebrow">CONSISTENCY</div><h2>{matches.length?`${spread} places`:'—'}</h2><p className="muted">Placement spread across the tracked sample.</p></div>
      <div className="glass card"><div className="eyebrow">RECENT FORM</div><h2>{summary.games?summary.recentForm.toFixed(2):'—'}</h2><p className="muted">Average placement across the latest five tracked games.</p></div>
      <div className="glass card"><div className="eyebrow">TOP-4 RATE</div><h2>{summary.games?`${Math.round(summary.top4Rate*100)}%`:'—'}</h2><p className="muted">Outcome context only; never treated as hidden MMR.</p></div>
      <div className="glass card"><div className="eyebrow">DATA DEPTH</div><h2>{loading?'…':matches.filter(m=>m.decisionReview).length}</h2><p className="muted">Games with structured Decision Review evidence.</p></div>
    </section>

    <section className="glass card" style={{marginTop:16}}><div className="eyebrow">ACCESS DEPTH</div><h3>TFT {tftTier}</h3>{tftTier==='FREE'?<p className="muted">FREE can build the core profile and five missions. Paid TFT tiers can later add longer memory, set-specific benchmarking and deeper comp/augment clustering without sharing League entitlements.</p>:<p className="muted">Your paid TFT entitlement remains separate from League access.</p>}</section>
  </main></TftShell>;
}
