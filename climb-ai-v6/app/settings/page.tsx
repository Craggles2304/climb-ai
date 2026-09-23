import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {RELEASE_MANIFEST} from '@/lib/releaseManifest';

export default function Settings(){
  return <AppShell>
    <PageHead title="Settings" subtitle="Keep notifications useful rather than noisy."/>
    <div className="grid two">
      <div className="glass card form">
        <label className="field"><span>Language</span><select className="input"><option>English</option></select></label>
        <label className="field"><span>Primary role</span><select className="input"><option>ADC</option><option>Support</option><option>Mid</option><option>Jungle</option><option>Top</option></select></label>
        <label style={{display:'flex',gap:10,alignItems:'center'}}><input type="checkbox" defaultChecked/> Weekly report ready notification</label>
        <label style={{display:'flex',gap:10,alignItems:'center',marginTop:12}}><input type="checkbox" defaultChecked/> Mission completed notification</label>
      </div>
      <div className="glass card">
        <div className="eyebrow">BETA RELEASE</div>
        <h2 style={{marginBottom:8}}>Know exactly what build you are testing.</h2>
        <p className="muted">These versions are the supported web + Windows Companion pair for the current controlled beta.</p>
        <div className="grid two" style={{marginTop:18}}>
          <div><span className="label">WEB APP</span><b style={{display:'block',marginTop:5}}>v{RELEASE_MANIFEST.webVersion}</b></div>
          <div><span className="label">WINDOWS COMPANION</span><b style={{display:'block',marginTop:5}}>v{RELEASE_MANIFEST.companionVersion}</b></div>
        </div>
        <div className="hero-actions">
          <Link className="btn primary" href={RELEASE_MANIFEST.windowsDownloadPath}>DOWNLOAD CURRENT COMPANION</Link>
          <Link className="btn secondary" href={RELEASE_MANIFEST.supportPath}>GET SUPPORT</Link>
        </div>
        <p className="muted" style={{fontSize:11,lineHeight:1.5}}>The Companion checks for updates automatically. It will not restart to install while champion select, recording or upload is active.</p>
      </div>
    </div>
  </AppShell>;
}
