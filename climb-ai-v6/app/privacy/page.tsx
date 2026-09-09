import Link from 'next/link';
import {Wordmark} from '@/components/UI';
import {BRAND} from '@/lib/brand';

/**
 * Privacy policy.
 *
 * Describes what the application actually does, checked against the code:
 * lib/analytics.ts, lib/server/telemetryRepository.ts, lib/riot/client.ts and
 * the migrations in supabase/. If any of those change, this must change too.
 */
export default function Privacy(){
  return <main className="container section">
    <Wordmark/>
    <article className="glass card legal">
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated 9 September 2026</p>

      <h2>Who we are</h2>
      <p>
        {BRAND.name} is an improvement tool for League of Legends players. This policy explains
        what we collect, why, and how to get rid of it.
      </p>

      <h2>What we collect</h2>
      <p><b>Your Riot account details.</b> When you enter a Riot ID and region, we send them to
      Riot to look up your account and retrieve your own recent ranked matches. We store the
      resulting match data — champion, result, KDA, farm, deaths, item timings and objective
      involvement — so we can compare your games over time.</p>

      <p><b>Your account details.</b> If you create an account, we store your email address and
      an encrypted password, handled by our authentication provider. We never see your password.</p>

      <p><b>How you use the app.</b> We record which pages you open and which actions you take,
      so we can tell whether the product is working. Before you sign in this is tied to a random
      identifier generated in your browser — not to your name, email or Riot ID.</p>

      <p><b>What you tell us.</b> If you rate a piece of advice, or report whether you actually
      performed a behaviour in game, we store that answer alongside the match it refers to.</p>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell your data, and we do not share it for advertising.</li>
        <li>We do not request or display other players&apos; match histories.</li>
        <li>We do not build public leaderboards or profiles.</li>
        <li>We do not use tracking cookies or third-party advertising trackers.</li>
      </ul>

      <h2>Where it is stored</h2>
      <p>
        Data is held in our database provider and on our hosting provider&apos;s servers. Some
        preferences — your plan and your answers before you sign in — are stored only in your own
        browser and never leave your device unless you create an account.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Match and progress data is kept while your account is open, because the product works by
        comparing your games over time. Delete your account and it goes with it.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask us for a copy of your data, ask us to correct it, or ask us to delete your
        account and everything attached to it. Email <b>boxtoboxfootballacademy@gmail.com</b> and
        we will action it. If you are in the UK or EU you also have the right to complain to your
        data protection regulator.
      </p>

      <h2>Riot Games data</h2>
      <p>
        Match data is retrieved through the official Riot Games API, only for the account you
        provide. {BRAND.name} is not endorsed by Riot Games and does not reflect the views or
        opinions of Riot Games or anyone officially involved in producing or managing Riot Games
        properties.
      </p>

      <h2>Changes</h2>
      <p>
        If we change what we collect, we will update this page and the date at the top.
      </p>

      <p className="muted legal-links">
        <Link className="text-link" href="/terms">TERMS OF SERVICE →</Link>
      </p>
    </article>
  </main>;
}
