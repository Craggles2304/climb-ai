import Link from 'next/link';
import {Wordmark} from '@/components/UI';
import {PublicFooter} from '@/components/PublicFooter';

const SUPPORT_EMAIL='boxtoboxfootballacademy@gmail.com';

export default function Support(){return <>
  <main className="container section">
    <Wordmark/>
    <article className="glass card legal" style={{marginTop:38}}>
      <div className="eyebrow">SUPPORT</div>
      <h1>Need help with OP CLIMB?</h1>
      <p>If something is not working, include the page you were on, what you expected to happen, and a screenshot if possible. Never send passwords, Riot credentials, pairing tokens or API keys.</p>
      <h2>Account or technical support</h2>
      <p><a className="text-link" href={`mailto:${SUPPORT_EMAIL}?subject=OP%20CLIMB%20Support`}>EMAIL SUPPORT →</a></p>
      <h2>Privacy or deletion request</h2>
      <p>Use the same support address and clearly state that your request concerns access, correction or deletion of your OP CLIMB data.</p>
      <h2>Before creating an account</h2>
      <p><Link className="text-link" href="/demo">OPEN THE PUBLIC DEMO →</Link></p>
    </article>
  </main>
  <PublicFooter compact/>
</>}
