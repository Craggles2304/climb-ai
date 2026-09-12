'use client';
import {useState} from 'react';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {useAccount} from '@/components/AccountContext';
import {Role} from '@/lib/types';

export default function Account(){
  const {accounts,active,setActive,linkAccount,authenticated}=useAccount();
  const [show,setShow]=useState(false);
  const [gameName,setGameName]=useState('');
  const [tagline,setTagline]=useState('EUW');
  const [region,setRegion]=useState('EUW');
  const [role,setRole]=useState<Role>(active.role);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  const add=async()=>{
    if(!gameName.trim())return setMessage('Enter the Riot game name first.');
    setBusy(true);setMessage('');
    try{
      await linkAccount({gameName,tagline,region,role,champions:[]});
      setMessage('Riot account linked. Pair the Live Companion on that account to verify it from League.');
      setGameName('');setTagline('EUW');setShow(false);
    }catch(err){setMessage(err instanceof Error?err.message:'Could not link that Riot account.')}finally{setBusy(false)}
  };

  return <AppShell>
    <PageHead title="Riot Accounts" subtitle="One OVERPOWERED login can track multiple Riot IDs, regions and roles independently." action={<button className="btn primary" onClick={()=>setShow(v=>!v)}>+ LINK ACCOUNT</button>}/>
    <div className="grid two">
      {accounts.map(a=><div className={`glass card account-card ${a.id===active.id?'selected-account':''}`} key={a.id}>
        <div className="section-row"><div><div className="eyebrow">{a.label}{a.isPrimary?' · PRIMARY':''}</div><h2>{a.gameName}<span className="muted">{a.tagline}</span></h2></div><span className="pill">{a.region}</span></div>
        <div className="account-meta"><div><span>RANK</span><b>{a.rank}</b></div><div><span>ROLE</span><b>{a.role}</b></div><div><span>POOL</span><b>{a.champions.slice(0,3).join(' · ')||'Build from match history'}</b></div><div><span>SYNC</span><b>{a.syncStatus}</b></div></div>
        <button className="btn secondary" disabled={a.id===active.id} onClick={()=>setActive(a.id)}>{a.id===active.id?'ACTIVE ACCOUNT':'USE THIS ACCOUNT'}</button>
      </div>)}
    </div>
    {show&&<div className="glass card form" style={{marginTop:18}}>
      <div className="eyebrow">LINK ANOTHER RIOT ID</div><h2>Add account</h2>
      <p className="muted">This saves the Riot ID to your OVERPOWERED login. The Live Companion verifies the identity from the League client when you record a match.</p>
      <div className="grid two"><label className="field">Game name<input className="input" value={gameName} onChange={e=>setGameName(e.target.value)} placeholder="Craggles"/></label><label className="field">Tagline<input className="input" value={tagline} onChange={e=>setTagline(e.target.value)} placeholder="EUW"/></label></div>
      <div className="grid two"><label className="field">Region<select className="input" value={region} onChange={e=>setRegion(e.target.value)}>{['EUW','EUNE','NA','OCE','KR','BR','LAN','LAS','JP','TR','RU'].map(x=><option key={x}>{x}</option>)}</select></label><label className="field">Role<select className="input" value={role} onChange={e=>setRole(e.target.value as Role)}>{['TOP','JUNGLE','MID','ADC','SUPPORT'].map(x=><option key={x}>{x}</option>)}</select></label></div>
      <button className="btn primary" onClick={add} disabled={busy||!authenticated}>{busy?'LINKING…':'LINK ACCOUNT'}</button>
    </div>}
    {message&&<div className="auth-message" style={{marginTop:14}}>{message}</div>}
    <div className="glass card" style={{marginTop:18}}><div className="eyebrow">ACCOUNT SEPARATION</div><p className="muted">Each Riot account now keeps its own cloud-backed matches, tracker sessions and learning-plan evidence. Your OVERPOWERED login is shared, but one tester cannot see another tester&apos;s data.</p></div>
  </AppShell>;
}
