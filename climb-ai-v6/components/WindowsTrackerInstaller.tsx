'use client';

const INSTALLER_URL='/download/windows';

export function WindowsTrackerInstaller({code}:{code:string}){
  const pairUrl=`opclimb://pair?code=${encodeURIComponent(code)}`;

  return <div className="glass card" style={{marginTop:18,display:'grid',gap:14}}>
    <div className="eyebrow">OP CLIMB COMPANION · WINDOWS BETA</div>
    <h3 style={{margin:0}}>Install once. Then it runs quietly in your tray.</h3>
    <p className="muted" style={{margin:0}}>The Companion includes everything it needs. There is no Node.js install, no CMD window and no tracker key to copy. Once paired, it detects League and records permitted match data in the background for your post-game coaching.</p>

    <div className="grid three" style={{marginTop:4}}>
      <Step number="1" title="DOWNLOAD" detail="Install OP CLIMB Companion on this Windows PC."/>
      <Step number="2" title="CONNECT" detail="Click Open Companion below to pair this PC securely."/>
      <Step number="3" title="PLAY" detail="Leave it in the tray and play League normally."/>
    </div>

    <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
      <a className="btn" href={INSTALLER_URL}>DOWNLOAD WINDOWS APP</a>
      <a className="btn primary" href={pairUrl}>OPEN COMPANION &amp; CONNECT</a>
    </div>

    <div className="auth-message" role="status">This pairing is temporary and one-use. If you install the app after the pairing expires, choose <b>Pair a new PC</b> again to create a fresh connection.</div>
    <small className="muted">Beta note: this build is not code-signed yet, so Windows SmartScreen may show an unknown publisher warning. The public release will use a signed installer.</small>
  </div>;
}

function Step({number,title,detail}:{number:string;title:string;detail:string}){
  return <div className="glass" style={{padding:14,borderRadius:14}}>
    <div className="eyebrow">STEP {number}</div>
    <b style={{display:'block',marginTop:5}}>{title}</b>
    <small className="muted" style={{display:'block',marginTop:5,lineHeight:1.45}}>{detail}</small>
  </div>;
}
