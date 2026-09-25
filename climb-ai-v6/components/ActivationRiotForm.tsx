'use client';
import Link from 'next/link';
import {FormEvent,useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Wordmark} from '@/components/UI';
import {matchesFor,useAccount} from '@/components/AccountContext';
import {saveProfile,seedFor} from '@/lib/profile';
import {track} from '@/lib/analytics';
import type {Role} from '@/lib/types';

const REGIONS=['EUW','EUNE','NA','OCE','KR','BR','LAN','LAS','JP','TR','RU'];
const ROLES:Role[]=['TOP','JUNGLE','MID','ADC','SUPPORT'];
const GOALS=['I do not know why I am losing','I die too much','My CS is poor','I win lane but lose games','I struggle with positioning','I do not know what to do after lane','I struggle in teamfights'];

export function ActivationRiotForm(){
  const router=useRouter();
  const {active,profile,authenticated,hydrated,refresh}=useAccount();
  const existingMatches=matchesFor(active.id);
  const [gameName,setGameName]=useState('');
  const [tagline,setTagline]=useState('EUW');
  const [region,setRegion]=useState('EUW');
  const [fallbackRole,setFallbackRole]=useState<Role>('ADC');
  const [goal,setGoal]=useState(GOALS[0]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [manual,setManual]=useState(false);
  const seed=useMemo(()=>seedFor(goal),[goal]);

  useEffect(()=>{if(hydrated&&!authenticated)setError('Your sign-in session expired. Sign in again to continue.')},[hydrated,authenticated]);

  useEffect(()=>{
    if(!hydrated||!authenticated)return;
    if(!gameName&&active.gameName&&active.gameName!=='Complete onboarding')setGameName(active.gameName);
    if(active.tagline)setTagline(active.tagline.replace(/^#/,''));
    if(active.region)setRegion(active.region);
    if(active.role)setFallbackRole(active.role);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[hydrated,authenticated,active.id]);

  useEffect(()=>{
    if(!hydrated||!authenticated||existingMatches.length===0)return;
    track('activation_existing_history_found',{matches:existingMatches.length});
    router.replace('/activate');
  },[hydrated,authenticated,existingMatches.length,router]);

  const submit=async(e:FormEvent)=>{
    e.preventDefault();if(!authenticated||!gameName.trim())return;
    if(existingMatches.length>0){
      setBusy(true);setError('');setManual(false);
      await refresh();
      router.push('/activate');router.refresh();
      setBusy(false);
      return;
    }
    setBusy(true);setError('');setManual(false);
    track('activation_started',{source:'riot_bootstrap'});track('analysis_started',{source:'riot_bootstrap'});
    try{
      const res=await fetch('/api/activate/bootstrap',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({gameName:gameName.trim(),tagline:tagline.replace(/^#/,''),region,fallbackRole,frustration:goal})});
      const body=await res.json().catch(()=>({}));
      if(!res.ok||!body.ok){const err=new Error(body.error||'OP CLIMB could not verify that Riot account.') as Error&{code?:string;status?:number};err.code=body.code;err.status=res.status;throw err}
      const detectedRole=String(body.profile?.role||fallbackRole),rank=String(body.profile?.rank||'UNRANKED');
      track('signup_completed',{role:detectedRole,rank});track('riot_profile_added',{region,verified:true});
      track('match_synced',{source:body.reusedExisting?'stored_history':'riot_bootstrap',matches:body.matchImported?1:body.reusedExisting?1:0});
      if(body.matchImported)track('first_match_added',{source:'riot_bootstrap'});
      track('first_mission_generated',{metric:seed.metric,category:seed.category,fromFrustration:goal});
      await refresh();router.push('/activate');router.refresh();
    }catch(raw){
      const err=raw as Error&{code?:string;status?:number};setError(err.message||'OP CLIMB could not verify that Riot account.');
      setManual(err.code==='RIOT_DISABLED'||err.code==='BOOTSTRAP_FAILED'||Number(err.status)>=500);
    }finally{setBusy(false)}
  };

  const continueManual=async()=>{
    const profile=saveProfile({gameName:gameName.trim()||'Your account',tagline:tagline.startsWith('#')?tagline:`#${tagline}`,region,role:fallbackRole,rank:'UNRANKED',champions:[],frustration:goal});
    track('signup_completed',{role:profile.role,rank:profile.rank,fallback:true});track('riot_profile_added',{region,verified:false,fallback:true});
    track('first_mission_generated',{metric:seed.metric,category:seed.category,fromFrustration:goal});
    await refresh();router.push('/activate');router.refresh();
  };

  if(!hydrated)return <main className="container section onboarding-page"><Wordmark/><section className="glass card" style={{maxWidth:760,margin:'42px auto',textAlign:'center'}}><div className="eyebrow">GETTING READY</div><h1>Loading your account…</h1></section></main>;

  return <main className="container section onboarding-page"><Wordmark/><div style={{maxWidth:880,margin:'36px auto 70px',display:'grid',gap:16}}>
    <section className="glass card" style={{padding:'clamp(24px,4vw,44px)'}}><div className="eyebrow">START WITH A REAL GAME</div><h1 style={{fontSize:'clamp(38px,6vw,68px)',lineHeight:.94}}>Connect your account. We’ll use the games OP CLIMB already has first.</h1><p className="muted" style={{fontSize:16,lineHeight:1.65}}>Existing tracked games come first. Riot import is only used when we genuinely need another match, and manual entry is the final fallback.</p><div className="profile-strip"><div><span>01</span><strong>FIND YOU</strong></div><div><span>02</span><strong>GET A GAME</strong></div><div><span>03</span><strong>YOUR FIRST FOCUS</strong></div></div></section>
    <form className="glass card" onSubmit={submit}><div className="eyebrow">RIOT ACCOUNT</div><h2>Who are we coaching?</h2><div className="grid two"><label className="field">Game name<input className="input" value={gameName} onChange={e=>setGameName(e.target.value)} placeholder="Craggles" required autoFocus/></label><label className="field">Tagline<input className="input" value={tagline} onChange={e=>setTagline(e.target.value)} placeholder="EUW" required/></label></div><div className="grid two"><label className="field">Region<select className="input" value={region} onChange={e=>setRegion(e.target.value)}>{REGIONS.map(x=><option key={x}>{x}</option>)}</select></label><label className="field">Main role <small className="muted">only if Riot cannot tell us</small><select className="input" value={fallbackRole} onChange={e=>setFallbackRole(e.target.value as Role)}>{ROLES.map(x=><option key={x}>{x}</option>)}</select></label></div><label className="field">Anything you want us to pay attention to? <small className="muted">optional</small><select className="input" value={goal} onChange={e=>setGoal(e.target.value)}>{GOALS.map(x=><option key={x} value={x}>{x===GOALS[0]?'No — find it from my games':x}</option>)}</select></label>
    {existingMatches.length>0&&<div className="auth-message"><b>{existingMatches.length} EXISTING GAME{existingMatches.length===1?'':'S'} FOUND</b><br/>OP CLIMB will analyse your stored history instead of asking Riot to import the same game again.</div>}
    {error&&<div className="auth-message" role="alert">{error}</div>}<button className="btn primary" disabled={busy||!authenticated||!gameName.trim()} style={{width:'100%',marginTop:16}}>{busy?'CHECKING YOUR GAME HISTORY…':'SHOW ME WHAT TO FIX'}</button>{busy&&<p className="muted" style={{fontSize:12,textAlign:'center'}}>Checking stored games → linked account → Riot only if needed.</p>}{manual&&<button type="button" className="btn secondary" onClick={()=>void continueManual()} style={{width:'100%',marginTop:10}}>CONTINUE WITHOUT RIOT IMPORT</button>}{!authenticated&&<p className="muted">Session expired. <Link className="text-link" href="/login">SIGN IN AGAIN →</Link></p>}</form>
  </div></main>;
}
