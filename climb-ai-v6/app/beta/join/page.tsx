import Link from 'next/link';
import {Wordmark} from '@/components/UI';
import {BetaInviteClaim} from '@/components/BetaInviteClaim';

export const dynamic='force-dynamic';

export default async function BetaJoin({searchParams}:{searchParams:Promise<{token?:string}>}){
  const params=await searchParams;
  const token=String(params.token||'');
  const valid=/^[A-Za-z0-9_-]{20,160}$/.test(token);
  return <main className="container section">
    <Link href="/" aria-label="OP CLIMB home"><Wordmark/></Link>
    {valid?<BetaInviteClaim token={token}/>:<div className="glass card" style={{maxWidth:720,margin:'64px auto'}}><div className="eyebrow">FOUNDING BETA</div><h1>That invite link is invalid.</h1><p className="muted">Ask the OP CLIMB founder for a new controlled-beta invite.</p><Link className="btn secondary" href="/demo">OPEN PUBLIC DEMO</Link></div>}
  </main>;
}
