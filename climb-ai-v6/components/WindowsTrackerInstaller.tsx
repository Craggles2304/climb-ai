'use client';

import {useEffect,useRef,useState} from 'react';

const INSTALLER_URL='/download/windows';

export function WindowsTrackerInstaller({code}:{code:string}){
  const pairUrl=`opclimb://pair?code=${encodeURIComponent(code)}`;
  const attemptedCode=useRef('');
  const [autoLaunchAttempted,setAutoLaunchAttempted]=useState(false);

  useEffect(()=>{
    if(!code||attemptedCode.current===code)return;
    attemptedCode.current=code;
    setAutoLaunchAttempted(false);
    const timer=window.setTimeout(()=>{
      setAutoLaunchAttempted(true);
      window.location.href=pairUrl;
    },250);
    return()=>window.clearTimeout(timer);
  },[code,pairUrl]);

  return <div className="glass card" style={{marginTop:18,display:'grid',gap:14}}>
    <div className="eyebrow">SECURE COMPANION PAIRING</div>
    <h3 style={{margin:0}}>{autoLaunchAttempted?'Opening OP CLIMB Companion…':'Pairing this PC…'}</h3>
    <p className="muted" style={{margin:0}}>OP CLIMB is opening the installed Companion automatically. If Windows asks for permission, choose <b>Open OP CLIMB Companion</b>. You should not need to download or reinstall it.</p>

    <div className="grid three" style={{marginTop:4}}>
      <Step number="1" title="PAIRING CREATED" detail="A secure one-use pairing has been created for this PC."/>
      <Step number="2" title="COMPANION OPENS" detail="Windows opens the installed OP CLIMB Companion automatically."/>
      <Step number="3" title="CONNECTED" detail="The Companion stores the pairing securely and starts the tracker."/>
    </div>

    <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
      <a className="btn primary" href={pairUrl}>COMPANION DIDN'T OPEN? TRY AGAIN</a>
      <a className="btn" href={INSTALLER_URL} target="_blank" rel="noopener">DON'T HAVE THE APP? DOWNLOAD</a>
    </div>

    <div className="auth-message" role="status">Keep this page open for a few seconds. As soon as the Companion heartbeat arrives, OP CLIMB will mark this PC connected automatically.</div>
    <small className="muted">Beta note: the installer is not code-signed yet, so Windows SmartScreen may show an unknown publisher warning on first install.</small>
  </div>;
}

function Step({number,title,detail}:{number:string;title:string;detail:string}){
  return <div className="glass" style={{padding:14,borderRadius:14}}>
    <div className="eyebrow">STEP {number}</div>
    <b style={{display:'block',marginTop:5}}>{title}</b>
    <small className="muted" style={{display:'block',marginTop:5,lineHeight:1.45}}>{detail}</small>
  </div>;
}
