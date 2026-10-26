import Link from 'next/link';
import {Wordmark} from '@/components/UI';

/** Shared top bar for public pages: same links everywhere, Demo + Log in stay visible on phones. */
export function PublicHeader(){
  return <header className="container public-topbar"><Link href="/" aria-label="OP CLIMB home"><Wordmark size="sm"/></Link><nav aria-label="Main"><Link href="/#how-it-works">HOW IT WORKS</Link><Link href="/pricing">PRICING</Link><Link className="keep-sm" href="/client">DEMO</Link><Link className="keep-sm" href="/login">LOG IN</Link><Link className="btn primary" href="/signup">START FREE</Link></nav></header>;
}
