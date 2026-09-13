import Link from 'next/link';
import {BRAND} from '@/lib/brand';

const SUPPORT_EMAIL='boxtoboxfootballacademy@gmail.com';

export function PublicFooter({compact=false}:{compact?:boolean}){
  return <footer className={`public-footer ${compact?'is-compact':''}`}>
    <div className="container public-footer-inner">
      <div>
        <strong>{BRAND.short}</strong>
        <p>Post-game League of Legends coaching built around your own recorded evidence.</p>
      </div>
      <nav aria-label="Trust and legal links">
        <Link href="/demo">Demo</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/support">Support</Link>
        <a href={`mailto:${SUPPORT_EMAIL}`}>Contact</a>
      </nav>
    </div>
    {!compact&&<div className="container public-footer-riot">OP CLIMB is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.</div>}
  </footer>;
}
