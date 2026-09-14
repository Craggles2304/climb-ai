'use client';

import {useEffect} from 'react';

const INSTALLER_URL='/download/windows';

export function WindowsTrackerInstaller({code}:{code:string}){
  const pairUrl=`opclimb://pair?code=${encodeURIComponent(code)}`;

  useEffect(()=>{
    const key=`op_climb_companion_download_${code}`;
    try{
      if(window.sessionStorage.getItem(key))return;
      window.sessionStorage.setItem(key,'1');
    }catch{}
    window.location.assign(INSTALLER_URL);
  },[code]);

  return <div className="glass card" style={{marginTop:18,display:'grid',gap:14}}>
    <div className="eyebrow">OP CLIMB COMPANION · WINDOWS BETA</div>
    <h3 style={{margin:0}}>Your Windows download is starting.</h3>
    <p className="muted" style={{margin:0}}>Install OP CLIMB Companion once, then return here and click <b>Open Companion &amp; Connect</b>. The Companion includes everything it needs: no Node.js, no CMD window and no tracker key to copy.</p>

    <div className="grid three" style={{marginTop:4}}>
      <Step number="1" title="DOWNLOAD" detail="The installer starts automatically from OP CLIMB."/>
      <Step number="2" title="CONNECT" detail="Install it, then click Open Companion & Connect."/>
      <Step number="3" title="PLAY" detail="Leave it in the tray and play League normally."/>
    </div>

    <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
      <a className="btn" href={INSTALLER_URL}>DOWNLOAD AGAIN</a>
      <a className="btn primary" href={pairUrl}>OPEN COMPANION &amp; CONNECT</a>
    </div>

    <div className="auth-message" role="status">This pairing is temporary and one-use. If setup takes longer than the pairing window, choose <b>Pair a new PC</b> again for a fresh connection.</div>
    <small className="muted">Beta note: the installer is not code-signed yet, so Windows SmartScreen may show an unknown publisher warning. The public release will use a signed installer.</small>
  </div>;
}

function Step({number,title,detail}:{number:string;title:string;detail:string}){
  return <div className="glass" style={{padding:14,borderRadius:14}}>
    <div className="eyebrow">STEP {number}</div>
    <b style={{display:'block',marginTop:5}}>{title}</b>
    <small className="muted" style={{display:'block',marginTop:5,lineHeight:1.45}}>{detail}</small>
  </div>;
}
