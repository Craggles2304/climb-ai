import Link from 'next/link';
import {Wordmark} from '@/components/UI';
import {PublicFooter} from '@/components/PublicFooter';
import {BRAND} from '@/lib/brand';

export default function Terms(){return <>
  <main className="container section"><Wordmark/><article className="glass card legal">
    <h1>Terms of Service</h1><p className="muted">Last updated 13 September 2026</p>
    <h2>What you are getting</h2><p>{BRAND.name} provides player-development tools for League of Legends and Teamfight Tactics. Depending on the product and evidence available, this may include match analysis, manually logged results, static Riot game data, user-supplied decision reviews, recurring-pattern detection and measurable coaching tasks for later games.</p>
    <h2>No guarantee of results</h2><p>We do not promise that using OP CLIMB will improve your rank, win rate, placement or matchmaking results. Coaching is based on available evidence. Missing evidence stays unknown rather than being presented as a measured fact.</p>
    <h2>Using the service</h2><p>Use your own Riot account, your own match information and, where applicable, your own local companion installation. Do not attempt to scrape, overload, reverse engineer restricted services, access another user&apos;s private data or resell access without permission.</p>
    <h2>Your account</h2><p>You are responsible for keeping your login details and local pairing information secure. Do not share tracker pairing tokens, passwords or API keys. You can request account deletion as described in the <Link className="text-link" href="/privacy">Privacy Policy</Link>.</p>
    <h2>The Windows companion</h2><p>Where available, the League companion reads Riot-visible local League client data for the account using it and sends recorded evidence to OP CLIMB for analysis. It is not intended to automate gameplay or provide prohibited live tactical shotcalling.</p>
    <h2>Teamfight Tactics coaching</h2><p>TFT CLIMB is designed around static preparation and post-game development. It may use manually entered match evidence, your own decision reflections and Riot static data even when Riot match-history API access is unavailable. It is not intended to provide adaptive real-time instructions telling you what to buy, roll or reposition in response to your current live board.</p>
    <h2>Availability and data sources</h2><p>This product is under active development. Features may change and some features depend on local League client interfaces, Riot static data, Riot APIs, hosting providers and other services outside our control. OP CLIMB can continue operating in reduced or manual-evidence modes when an automated source is unavailable, but some information such as official rank or automatic match history may then be unavailable.</p>
    <h2>Subscriptions</h2><p>League and TFT may be offered as separate products with separate entitlements. Paid tiers, where offered, unlock the analysis depth and history shown on the relevant pricing page before purchase. A bundle may grant access to both products without merging their coaching histories.</p>
    <h2>Liability</h2><p>{BRAND.name} is provided as is. We are not liable for losses arising from reliance on coaching output or temporary service unavailability. Nothing in these terms removes rights that cannot legally be excluded under applicable consumer law.</p>
    <h2>Riot Games</h2><p>{BRAND.name} is an independent service and is not endorsed by, sponsored by or affiliated with Riot Games. It does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, League of Legends and Teamfight Tactics are trademarks or registered trademarks of Riot Games, Inc.</p>
    <h2>Contact</h2><p>Questions about these terms: <b>boxtoboxfootballacademy@gmail.com</b> or <Link className="text-link" href="/support">open Support</Link>.</p>
    <p className="muted legal-links"><Link className="text-link" href="/privacy">PRIVACY POLICY →</Link> · <Link className="text-link" href="/support">SUPPORT →</Link></p>
  </article></main><PublicFooter compact/>
</>}
