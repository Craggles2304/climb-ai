import Link from 'next/link';
import {Wordmark} from '@/components/UI';
import {BRAND} from '@/lib/brand';

/**
 * Terms of service.
 *
 * Written to describe the product honestly rather than to over-promise. The
 * "no guarantee" and "not affiliated with Riot" sections are the two that
 * matter most and must not be softened.
 */
export default function Terms(){
  return <main className="container section">
    <Wordmark/>
    <article className="glass card legal">
      <h1>Terms of Service</h1>
      <p className="muted">Last updated 9 September 2026</p>

      <h2>What you are getting</h2>
      <p>
        {BRAND.name} analyses your own League of Legends match history, identifies a recurring
        pattern in how you play, and gives you one measurable thing to work on. It then checks
        your later games to see whether it changed.
      </p>

      <h2>No guarantee of results</h2>
      <p>
        We do not promise you will climb. Our analysis describes patterns in your own past games;
        it is not a prediction, and it cannot account for your teammates, your opponents or your
        matchmaking. Our internal improvement score is our own measure and has no relationship to
        Riot&apos;s matchmaking rating.
      </p>

      <h2>Using the service</h2>
      <p>
        Use your own Riot account. Do not use {BRAND.name} to gather data about other players, do
        not attempt to overload or scrape the service, and do not resell access to it.
      </p>

      <h2>Your account</h2>
      <p>
        You are responsible for keeping your login details secure. You can close your account at
        any time and we will delete the data attached to it — see the{' '}
        <Link className="text-link" href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Availability</h2>
      <p>
        This is a small product under active development. Features may change and the service may
        be unavailable at times. Match data depends on the Riot Games API, which is outside our
        control.
      </p>

      <h2>Liability</h2>
      <p>
        {BRAND.name} is provided as is. We are not liable for losses arising from your use of it,
        or from any advice it gives you. Nothing here limits rights you have under consumer law.
      </p>

      <h2>Riot Games</h2>
      <p>
        {BRAND.name} is not endorsed by Riot Games and does not reflect the views or opinions of
        Riot Games or anyone officially involved in producing or managing Riot Games properties.
        League of Legends and Riot Games are trademarks or registered trademarks of Riot Games,
        Inc.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <b>boxtoboxfootballacademy@gmail.com</b>
      </p>

      <p className="muted legal-links">
        <Link className="text-link" href="/privacy">PRIVACY POLICY →</Link>
      </p>
    </article>
  </main>;
}
