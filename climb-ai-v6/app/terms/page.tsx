import Link from 'next/link';
import {Wordmark} from '@/components/UI';
import {PublicFooter} from '@/components/PublicFooter';
import {BRAND} from '@/lib/brand';

export default function Terms(){return <>
  <main className="container section"><Wordmark/><article className="glass card legal">
    <h1>Terms of Service</h1><p className="muted">Last updated 13 September 2026</p>
    <h2>What you are getting</h2><p>{BRAND.name} analyses your own League of Legends match evidence, identifies recurring patterns and gives you measurable coaching tasks to work on in later games.</p>
    <h2>No guarantee of results</h2><p>We do not promise that using OP CLIMB will improve your rank, win rate or matchmaking results. Coaching is based on available evidence and cannot reconstruct information Riot does not expose, such as every exact input, camera decision or hidden cooldown.</p>
    <h2>Using the service</h2><p>Use your own Riot account and your own local companion installation. Do not attempt to scrape, overload, reverse engineer restricted services, access another user&apos;s private data or resell access without permission.</p>
    <h2>Your account</h2><p>You are responsible for keeping your login details and local pairing information secure. Do not share tracker pairing tokens, passwords or API keys. You can request account deletion as described in the <Link className="text-link" href="/privacy">Privacy Policy</Link>.</p>
    <h2>The Windows companion</h2><p>The companion reads Riot-visible local League client data for the account using it and sends recorded evidence to OP CLIMB for post-game analysis. It is not intended to provide live tactical shotcalling or automate gameplay.</p>
    <h2>Availability and data sources</h2><p>This product is under active development. Features may change and some features depend on local League client interfaces, Riot static data, Riot APIs, hosting providers and other services outside our control. If one source is unavailable, some analysis may be reduced or unavailable.</p>
    <h2>Subscriptions</h2><p>Paid tiers, where offered, unlock additional analysis depth and history features. The current price and included features are shown on the <Link className="text-link" href="/pricing">Pricing</Link> page before purchase.</p>
    <h2>Liability</h2><p>{BRAND.name} is provided as is. We are not liable for losses arising from reliance on coaching output or temporary service unavailability. Nothing in these terms removes rights that cannot legally be excluded under applicable consumer law.</p>
    <h2>Riot Games</h2><p>{BRAND.name} is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc.</p>
    <h2>Contact</h2><p>Questions about these terms: <b>boxtoboxfootballacademy@gmail.com</b> or <Link className="text-link" href="/support">open Support</Link>.</p>
    <p className="muted legal-links"><Link className="text-link" href="/privacy">PRIVACY POLICY →</Link> · <Link className="text-link" href="/support">SUPPORT →</Link></p>
  </article></main><PublicFooter compact/>
</>}
