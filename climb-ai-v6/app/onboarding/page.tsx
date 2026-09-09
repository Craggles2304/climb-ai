"use client";
import {Wordmark} from '@/components/UI';

import {useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import {saveProfile,seedFor} from '@/lib/profile';
import {track} from '@/lib/analytics';
import {Role} from '@/lib/types';
import Link from 'next/link';

const roles=['Top','Jungle','Mid','ADC','Support'];
const ranks=['Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Master+'];
const champs=["Kog'Maw",'Aphelios','Jinx','Ashe','Caitlyn',"Kai'Sa"];
const frustrations=[
  'I die too much',
  'My CS is poor',
  'I win lane but lose games',
  'I struggle with positioning',
  'I do not know what to do after lane',
  'I struggle in teamfights',
  'I do not know why I am losing',
  'Other'
];

const focusMap: Record<string,string[]> = {
  'I die too much':['Survival','Threat recognition','Fight selection'],
  'My CS is poor':['Resource collection','Recall discipline','Wave access'],
  'I win lane but lose games':['Tempo','Mid-game decisions','Objective setup'],
  'I struggle with positioning':['Spacing','Threat ranges','Teamfight positioning'],
  'I do not know what to do after lane':['Lane assignment','Resource collection','Tempo'],
  'I struggle in teamfights':['Positioning','Target access','Survival'],
  'I do not know why I am losing':['Consistency','Decision review','Recurring leak detection'],
  'Other':['Consistency','Decision review','Recurring leak detection']
};

export default function Onboarding(){
  const router=useRouter();
  const [step,setStep]=useState(1);
  const [gameName,setGameName]=useState('');
  const [tagline,setTagline]=useState('EUW');
  const [region,setRegion]=useState('EUW');
  const [role,setRole]=useState('ADC');
  const [rank,setRank]=useState('Gold');
  const [picked,setPicked]=useState(["Kog'Maw",'Aphelios']);
  const [frustration,setFrustration]=useState('');
  const focus=useMemo(()=>focusMap[frustration] ?? ['Positioning','Resource collection','Mid-game decisions'],[frustration]);
  const canContinue=step===1?Boolean(gameName.trim()):step===5?Boolean(frustration):true;
  const seed=useMemo(()=>seedFor(frustration),[frustration]);

  const complete=()=>{
    const profile=saveProfile({
      gameName:gameName.trim(),
      tagline:tagline.startsWith('#')?tagline:`#${tagline}`,
      region,role:role.toUpperCase() as Role,rank,champions:picked,frustration,
    });
    track('signup_completed',{role:profile.role,rank:profile.rank});
    track('riot_profile_added',{region:profile.region});
    // The activation event. Everything about week-one retention is measured
    // against whether a player reaches this point.
    track('first_mission_generated',{metric:seed.metric,category:seed.category,fromFrustration:frustration});
    setStep(7);
  };

  const next=()=>{
    if(!canContinue)return;
    if(step===6){complete();return;}
    setStep(s=>Math.min(7,s+1));
  };

  return <main className="container section onboarding-page">
    <Wordmark/>
    <div className="glass card form onboarding-card" style={{margin:'40px auto'}}>
      <div className="onboarding-topline"><div className="eyebrow">STEP {step} OF 7</div><div className="muted" style={{fontSize:12}}>{Math.round(step/7*100)}% PROFILED</div></div>
      <div className="progress" style={{margin:'14px 0 28px'}}><i style={{width:`${step/7*100}%`}}/></div>

      {step===1&&<><h1>Your Riot profile</h1><p className="muted">This identifies your account. Live match sync can be connected later.</p><label className="field">Game name<input className="input" value={gameName} onChange={e=>setGameName(e.target.value)} placeholder="Your summoner name" autoFocus/></label><label className="field">Tagline<input className="input" value={tagline} onChange={e=>setTagline(e.target.value)} placeholder="EUW"/></label><label className="field">Region<select className="input" value={region} onChange={e=>setRegion(e.target.value)}>{['EUW','EUNE','NA','OCE','KR','BR','LAN','LAS','JP','TR','RU'].map(r=><option key={r} value={r}>{r}</option>)}</select></label></>}

      {step===2&&<><div className="eyebrow">ROLE MODEL</div><h1>Where do you spend most of your ranked games?</h1><p className="muted">Your role changes what OVERPOWERED considers a meaningful leak.</p><div className="option-grid">{roles.map(x=><button type="button" className={`option ${role===x?'active':''}`} onClick={()=>setRole(x)} key={x}>{x}{x==='ADC'&&<small>Enhanced logic</small>}</button>)}</div></>}

      {step===3&&<><div className="eyebrow">COACHING DEPTH</div><h1>What rank are we coaching for?</h1><p className="muted">We keep Bronze advice simple and allow more detail as rank increases.</p><div className="option-grid">{ranks.map(x=><button type="button" className={`option ${rank===x?'active':''}`} onClick={()=>setRank(x)} key={x}>{x}</button>)}</div></>}

      {step===4&&<><div className="eyebrow">CHAMPION CONTEXT</div><h1>Who do you actually climb with?</h1><p className="muted">Pick up to five. We care more about your real pool than generic tier lists.</p><div className="option-grid">{champs.map(x=><button type="button" className={`option ${picked.includes(x)?'active':''}`} onClick={()=>setPicked(p=>p.includes(x)?p.filter(y=>y!==x):p.length<5?[...p,x]:p)} key={x}>{x}</button>)}</div></>}

      {step===5&&<><div className="eyebrow">FIRST HYPOTHESIS</div><h1>What usually feels like it breaks first?</h1><p className="muted">Choose one. This is only a hypothesis — your match evidence can prove you wrong.</p><div className="option-grid frustration-grid">{frustrations.map(x=><button type="button" aria-pressed={frustration===x} className={`option ${frustration===x?'active':''}`} onClick={()=>setFrustration(x)} key={x}><span>{x}</span>{frustration===x&&<b className="selected-dot">SELECTED</b>}</button>)}</div>{!frustration&&<div className="selection-hint">Select the closest answer to continue.</div>}</>}

      {step===6&&<><div className="eyebrow">COACH MODEL</div><h1>We have a starting hypothesis.</h1><div className="profile-strip"><div><span>ROLE</span><strong>{role}</strong></div><div><span>RANK</span><strong>{rank}</strong></div><div><span>YOU SAID</span><strong>{frustration || 'Not selected'}</strong></div></div><div className="glass card hypothesis-card"><div className="label">INITIAL FOCUS</div><h2>{focus[0]}</h2><p className="muted">Supporting signals: {focus.slice(1).join(' · ')}</p><div className="fact-inference"><div><b>YOUR INPUT</b><span>{frustration}</span></div><div><b>NOT YET A FACT</b><span>Match data must confirm it.</span></div></div></div></>}

      {step===7&&<><div className="eyebrow">YOUR FIRST HUNT</div><h1>Do not fix everything.</h1><p className="muted">One behaviour, tested across your next games. This is a hypothesis from what you told us — your first analysed match can overturn it.</p><div className="climb-card-preview"><div className="climb-card-head"><span>FIRST HYPOTHESIS</span><strong>{seed.title.toUpperCase()}</strong></div><div className="cue-row"><span>WHY</span><b>{seed.why}</b></div><div className="cue-row"><span>DO</span><b>{seed.gameRule}</b></div><div className="cue-row"><span>PASS IF</span><b>{seed.target}</b></div></div><p className="muted" style={{fontSize:12}}>Your account has no matches in it yet. Upload one or connect Riot sync and this becomes evidence instead of a guess.</p><button className="btn primary" onClick={()=>router.push('/dashboard')}>OPEN MY DEVELOPMENT HQ</button></>}

      {step<7&&<button className="btn primary" disabled={!canContinue} onClick={next} style={{marginTop:20}}>{step===6?'LOCK IN PROFILE':'CONTINUE'}</button>}
    </div>
  </main>
}
