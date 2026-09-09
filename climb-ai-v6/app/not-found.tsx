import Link from 'next/link';
import {Wordmark} from '@/components/UI';

export default function NotFound(){
  return <main className="container section">
    <Wordmark/>
    <div className="glass errstate-card" style={{maxWidth:600,margin:'70px auto'}}>
      <div className="errstate">
        <div className="eyebrow">NOT HERE</div>
        <h2>That page does not exist.</h2>
        <p>
          It may have moved, or it belongs to a different account. Your plan is where you
          left it.
        </p>
        <div className="errstate-actions">
          <Link className="btn primary" href="/dashboard">BACK TO DEVELOPMENT HQ</Link>
          <Link className="btn secondary" href="/">HOME</Link>
        </div>
      </div>
    </div>
  </main>;
}
