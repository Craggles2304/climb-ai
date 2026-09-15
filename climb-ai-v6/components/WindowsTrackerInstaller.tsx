'use client';

const INSTALLER_URL='/download/windows';

export function WindowsTrackerInstaller({code}:{code:string}){
  const pairUrl=`opclimb://pair?code=${encodeURIComponent(code)}`;

  return <div className="glass card" style={{marginTop:18,display:'grid',gap:14}}>
    <div className="eyebrow">SECURE COMPANION PAIRING</div>
    <h3 style={{margin:0}}>Your pairing is ready.</h3>
    <p className="muted" style={{margin:0}}>If OP CLIMB Companion is already installed, do <b>not</b> download it again. Click <b>Open Companion &amp; Connect</b> below and allow Windows to open OP CLIMB Companion.</p>

    <div className="grid three" style={{marginTop:4}}>
      <Step number="1" title="OPEN" detail="Click Open Companion & Connect."/>
      <Step number="2" title="ALLOW" detail="Let Windows open the installed OP CLIMB Companion."/>
      <Step number="3" title="CONNECTED" detail="The app stores the pairing securely and starts the tracker."/>
    </div>

    <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
      <a className="btn primary" href={pairUrl}>OPEN COMPANION &amp; CONNECT</a>
      <a className="btn" href={INSTALLER_URL} target="_blank" rel="noopener">DON'T HAVE THE APP? DOWNLOAD</a>
    </div>

    <div className="auth-message" role="status">Already installed? Use the green button only. This pairing code is temporary and one-use; once the Companion heartbeat arrives, OP CLIMB will show this PC as connected.</div>
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
