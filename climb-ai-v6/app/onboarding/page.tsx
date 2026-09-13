"use client";

import {useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Wordmark} from '@/components/UI';
import {saveProfile,seedFor} from '@/lib/profile';
import {track} from '@/lib/analytics';
import {Role} from '@/lib/types';

const roles=['Top','Jungle','Mid','ADC','Support'];
const ranks=['Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Master+'];
const frustrations=[
  'I die too much',
  'My CS is poor',
  'I win lane but lose games',
  'I struggle with positioning',
  'I do not know what to do after lane',
  'I struggle in teamfights',
  'I do not know why I am losing',
  'Other',
];

export default function Onboarding(){
  const router=useRouter();
  const [step,setStep]=useState(1);
  const [gameName,setGameName]=useState('');
  const [tagline,setTagline]=useState('EUW');
  const [region,setRegion]=useState('EUW');
  const [role,setRole]=useState('ADC');
  const [rank,setRank]=useState('Gold');
  const [frustration,setFrustration]=useState('');
  const seed=useMemo(()=>seedFor(frustration),[frustration]);
  const canContinue=step===1?Boolean(gameName.trim()):step===3?Boolean(frustration):true;

  const complete=()=>{
    const profile=saveProfile({
      gameName:gameName.trim(),
      tagline:tagline.startsWith('#')?tagline:`#${tagline}`,
      region,
      role:role.toUpperCase() as Role,
      rank,
      // Champion context is learned from real matches instead of adding another
      // onboarding gate before the player receives value.
      champions:[],
      frustration,
    });
    track('signup_completed',{role:profile.role,rank:profile.rank});
    track('riot_profile_added',{region:profile.region});
    track('first_mission_generated',{metric:seed.metric,category:seed.category,fromFrustration:frustration});
    router.push('/activate');
  };

  const next=()=>{
    if(!canContinue)return;
    setStep(s=>Math.min(4,s+1));
  };

  return <main className="container section onboarding-page">
    <Wordmark/>
    <div className="glass card form onboarding-card" style={{margin:'40px auto'}}>
      <div className="onboarding-topline">
        <div className="eyebrow">STEP {step} OF 4</div>
        <div className="muted" style={{fontSize:12}}>{Math.round(step/4*100)}% TO FIRST GRADE</div>
      </div>
      <div className="progress" style={{margin:'14px 0 28px'}}><i style={{width:`${step/4*100}%`}}/></div>

      {step===1&&<>
        <div className="eyebrow">FIND YOUR PLAYER</div>
        <h1>What is your Riot ID?</h1>
        <p className="muted">This is the only identity OP CLIMB needs to look for your match evidence.</p>
        <label className="field">Game name<input className="input" value={gameName} onChange={e=>setGameName(e.target.value)} placeholder="Your Riot game name" autoFocus/></label>
        <label className="field">Tagline<input className="input" value={tagline} onChange={e=>setTagline(e.target.value)} placeholder="EUW"/></label>
        <label className="field">Region<select className="input" value={region} onChange={e=>setRegion(e.target.value)}>{['EUW','EUNE','NA','OCE','KR','BR','LAN','LAS','JP','TR','RU'].map(r=><option key={r} value={r}>{r}</option>)}</select></label>
      </>}

      {step===2&&<>
        <div className="eyebrow">COACHING CONTEXT</div>
        <h1>Role and current rank.</h1>
        <p className="muted">Two quick choices. Champion pool can come from the matches themselves.</p>
        <div className="label" style={{marginTop:20}}>MAIN ROLE</div>
        <div className="option-grid">{roles.map(x=><button type="button" className={`option ${role===x?'active':''}`} onClick={()=>setRole(x)} key={x}>{x}</button>)}</div>
        <div className="label" style={{marginTop:22}}>CURRENT RANK</div>
        <div className="option-grid">{ranks.map(x=><button type="button" className={`option ${rank===x?'active':''}`} onClick={()=>setRank(x)} key={x}>{x}</button>)}</div>
      </>}

      {step===3&&<>
        <div className="eyebrow">FIRST HYPOTHESIS</div>
        <h1>What usually feels like it breaks first?</h1>
        <p className="muted">Pick the closest answer. OP CLIMB is allowed to prove you wrong once it sees a real match.</p>
        <div className="option-grid frustration-grid">{frustrations.map(x=><button type="button" aria-pressed={frustration===x} className={`option ${frustration===x?'active':''}`} onClick={()=>setFrustration(x)} key={x}><span>{x}</span>{frustration===x&&<b className="selected-dot">SELECTED</b>}</button>)}</div>
        {!frustration&&<div className="selection-hint">Select the closest answer to continue.</div>}
      </>}

      {step===4&&<>
        <div className="eyebrow">NEXT · REAL EVIDENCE</div>
        <h1>Now we test the guess.</h1>
        <div className="profile-strip">
          <div><span>ROLE</span><strong>{role}</strong></div>
          <div><span>RANK</span><strong>{rank}</strong></div>
          <div><span>YOU SAID</span><strong>{frustration}</strong></div>
        </div>
        <div className="climb-card-preview" style={{marginTop:18}}>
          <div className="climb-card-head"><span>STARTING HYPOTHESIS</span><strong>{seed.title.toUpperCase()}</strong></div>
          <div className="cue-row"><span>WHY</span><b>{seed.why}</b></div>
          <div className="cue-row"><span>RULE</span><b>{seed.gameRule}</b></div>
        </div>
        <p className="muted" style={{fontSize:13,marginTop:16}}>You will not land in Development HQ yet. First, OP CLIMB will use one real game to give you a first OP Grade, your #1 evidence-backed leak and a Fix Ladder.</p>
        <button className="btn primary" onClick={complete} style={{marginTop:8}}>BUILD MY FIRST OP GRADE</button>
      </>}

      {step<4&&<button className="btn primary" disabled={!canContinue} onClick={next} style={{marginTop:20}}>CONTINUE</button>}
    </div>
  </main>;
}
