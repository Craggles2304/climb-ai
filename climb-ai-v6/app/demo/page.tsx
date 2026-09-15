import Link from 'next/link';
import {Wordmark} from '@/components/UI';
import {PublicFooter} from '@/components/PublicFooter';

const moments=[
  {time:'02:12',kind:'RESET',tone:'amber'},
  {time:'03:48',kind:'RESET',tone:'amber'},
  {time:'08:50',kind:'POWER',tone:'blue'},
  {time:'10:37',kind:'CHECK',tone:'neutral'},
  {time:'12:27',kind:'GOOD',tone:'good'},
];

const reassurance=<small className="muted" style={{display:'block',marginTop:8,fontSize:11}}>Free to start · No card required</small>;

export default function Demo(){return <>
  <header className="container public-topbar"><Link href="/" aria-label="OP CLIMB home"><Wordmark size="sm"/></Link><nav><Link href="/pricing">PRICING</Link><Link href="/login">LOG IN</Link><Link className="btn primary" href="/signup">START FREE</Link></nav></header>
  <main className="container demo-page">
    <section className="demo-hero">
      <div><div className="eyebrow">PUBLIC PRODUCT DEMO</div><h1>SEE WHAT OP CLIMB DOES<br/><span>BEFORE YOU SIGN UP.</span></h1><p>Not another profile page. OP CLIMB finds the repeated decision costing you games, gives you one rule for the next match, then checks whether you fixed it.</p><div className="demo-actions"><div><Link className="btn primary" href="/signup">START FREE</Link>{reassurance}</div></div></div>
      <div className="demo-score"><span>OP DECISION SCORE</span><strong>63</strong><b>STABLE</b><small>Sample tracked match</small></div>
    </section>

    <section className="demo-grid">
      <article className="demo-panel demo-priority"><div className="eyebrow">CURRENT PRIORITY</div><div className="demo-stage">02 · CONTROL</div><h2>STOP ACCEPTING<br/>RED-STATE FIGHTS.</h2><p>If level/item state is red, add numbers, setup or first damage before committing.</p><div className="demo-evidence"><span>4× DETECTED</span><span>REPEATED PATTERN</span></div></article>
      <article className="demo-panel"><div className="eyebrow">WHY THIS IS DIFFERENT</div><div className="demo-signal-grid"><div><strong>1</strong><span>priority</span></div><div><strong>5</strong><span>ladder stages</span></div><div><strong>3</strong><span>clean games to master</span></div></div><p className="muted">The goal is not to show more numbers. It is to turn evidence into a behaviour you can actually remember next game.</p></article>
    </section>

    <section className="demo-panel demo-live-sample" id="live-demo">
      <div className="demo-section-head"><div><div className="eyebrow">LIVE COMPANION · POST-GAME SAMPLE</div><h2>YOUR MATCH AS A DECISION TIMELINE</h2></div><span className="demo-pill">NO LIVE SHOTCALLING</span></div>
      <div className="demo-stat-row"><div><span>KDA</span><strong>4 / 5 / 7</strong></div><div><span>CS/MIN</span><strong>6.3</strong></div><div><span>VISION</span><strong>11</strong></div><div><span>UNSPENT</span><strong>1,140g</strong></div></div>
      <div className="demo-timeline" aria-label="Sample map tempo timeline">{moments.map((m,i)=><div className={`demo-moment is-${m.tone}`} key={`${m.time}-${i}`}><i/><strong>{m.time}</strong><span>{m.kind}</span></div>)}</div>
      <details className="demo-detail" open><summary>COACHING MOMENT · 10:37</summary><div><b>10:37 · CHECK</b><span>Map window: no major objective evidence nearby.</span><span>Next rule: do not force a rotation just because teammates are moving. Finish the safe resource or create a numbers edge first.</span></div></details>
    </section>

    <section className="demo-pricing"><div><div className="eyebrow">SUBSCRIPTIONS</div><h2>THE HIGHER THE TIER, THE DEEPER THE DIAGNOSIS.</h2></div><div className="demo-plan-row"><div><b>FREE</b><span>Grade + basic fixes</span></div><div><b>PLUS</b><span>Economy + fight-state coaching</span></div><div className="is-pro"><b>PRO</b><span>Decision Fingerprint + full history</span></div></div></section>

    <section className="demo-cta"><div className="eyebrow">READY TO USE YOUR OWN EVIDENCE?</div><h2>PLAY. REVIEW. FIX ONE THING. PROVE IT.</h2><div><Link className="btn primary" href="/signup">START FREE</Link>{reassurance}</div></section>
  </main>
  <PublicFooter/>
</>}
