import Link from 'next/link';
import {Wordmark} from '@/components/UI';
import {PublicFooter} from '@/components/PublicFooter';
import {BRAND} from '@/lib/brand';

export default function Privacy(){return <>
  <main className="container section"><Wordmark/><article className="glass card legal">
    <h1>Privacy Policy</h1><p className="muted">Last updated 13 September 2026</p>
    <h2>Who we are</h2><p>{BRAND.name} is a League of Legends improvement tool. This policy explains what we collect, why we use it and how to request access or deletion.</p>
    <h2>What we collect</h2>
    <p><b>Your OP CLIMB account.</b> If you create an account, our authentication provider stores your email address and authentication data. We do not see or store your plaintext password.</p>
    <p><b>Your Riot account details.</b> We store the Riot ID, tag, region and linked-account details you provide so your own matches and coaching history stay attached to the correct profile.</p>
    <p><b>Your match and companion data.</b> When you use the Windows companion, it records Riot-visible game state from your own local League client, such as champion, role, KDA, CS, visible items, current gold, health/resource state and game events. We save snapshots and derived coaching results so we can compare your behaviour across games.</p>
    <p><b>Riot API data.</b> When official Riot API features are enabled, we may enrich your tracked games with Riot-provided match, timeline, rank and account data. The service does not require that enrichment to run the local companion.</p>
    <p><b>How you use the app.</b> We record basic product events such as pages opened and actions taken so we can understand whether the product is working. Before sign-in this may be tied to a browser-generated identifier rather than your Riot account.</p>
    <p><b>What you tell us.</b> Feedback, coaching responses and learning-plan actions may be stored alongside the match or task they refer to.</p>
    <h2>What we do not do</h2><ul><li>We do not sell your personal data.</li><li>We do not share your data with advertisers.</li><li>We do not ask for your Riot password.</li><li>We do not use the companion to provide live tactical shotcalling.</li><li>We do not publish your private coaching profile as a public leaderboard.</li></ul>
    <h2>Where it is stored</h2><p>Account, match and coaching data is stored with our database and hosting providers. Some preferences may also be stored in your browser.</p>
    <h2>How long we keep it</h2><p>Match and progress data is kept while your account is open because the coaching system compares games over time. A valid deletion request removes the account data we control, subject to any legal retention requirements.</p>
    <h2>Your rights</h2><p>You can ask for a copy of your data, ask us to correct it, or ask us to delete your account and associated data. Email <b>boxtoboxfootballacademy@gmail.com</b>. If you are in the UK or EU, you may also have the right to complain to your data-protection regulator.</p>
    <h2>Riot Games</h2><p>{BRAND.name} is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.</p>
    <h2>Changes</h2><p>If what we collect or how we use it materially changes, we will update this policy and the date above.</p>
    <p className="muted legal-links"><Link className="text-link" href="/terms">TERMS OF SERVICE →</Link> · <Link className="text-link" href="/support">SUPPORT →</Link></p>
  </article></main><PublicFooter compact/>
</>}
