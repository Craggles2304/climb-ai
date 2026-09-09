import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { MetricCard, PageHead } from '@/components/UI';
import { demoMatches } from '@/data/demo';
import { analyseMatch } from '@/lib/engine';
import { buildReview } from '@/lib/review';
import { TurningPoints } from '@/components/TurningPoints';

const pct = (n?: number) =>
  n === undefined ? 'Unavailable' : `${Math.round(n * 100)}%`;

const num = (n?: number, suffix = '') =>
  n === undefined
    ? 'Unavailable'
    : `${n > 0 && suffix === 'g' ? '+' : ''}${
        Number.isInteger(n) ? n : n.toFixed(1)
      }${suffix}`;

export default async function Analysis({
  params,
}: {
  params: Promise<{ match: string }>;
}) {
  const { match: id } = await params;
  const match = demoMatches.find((m) => m.id === id) || demoMatches[0];
  const recent = demoMatches.filter(
    (m) => m.riotAccountId === match.riotAccountId && m.id !== match.id,
  );
  const report = analyseMatch(match, recent);
  const review = buildReview(match, report);

  return (
    <AppShell>
      <PageHead
        title={`${match.champion} vs ${match.opponent || 'Unknown'}`}
        subtitle={`${match.result} · ${match.rank} · ${Math.floor(
          match.durationSeconds / 60,
        )}:${String(match.durationSeconds % 60).padStart(2, '0')}`}
      />

      <div className="grid five">
        <MetricCard
          label="KDA"
          value={`${match.kills}/${match.deaths}/${match.assists}`}
        />
        <MetricCard label="CS/MIN" value={match.metrics.csPerMin.toFixed(1)} />
        <MetricCard label="GOLD/MIN" value={match.metrics.goldPerMin ?? 'N/A'} />
        <MetricCard
          label="KILL PARTICIPATION"
          value={pct(match.metrics.killParticipation)}
        />
        <MetricCard label="DAMAGE SHARE" value={pct(match.metrics.damageShare)} />
      </div>

      <div className="phase-grid" style={{ marginTop: 18 }}>
        <div className="glass card">
          <div className="eyebrow">LANE PHASE</div>
          <div className="league-row">
            <span>CS @ 10</span>
            <b>{match.metrics.csAt10 ?? 'Unavailable'}</b>
          </div>
          <div className="league-row">
            <span>CS @ 15</span>
            <b>{match.metrics.csAt15 ?? 'Unavailable'}</b>
          </div>
          <div className="league-row">
            <span>Lane CS/min</span>
            <b>{num(match.metrics.laneCsPerMin)}</b>
          </div>
          <div className="league-row">
            <span>Gold diff @ 15</span>
            <b>{num(match.metrics.goldDiffAt15, 'g')}</b>
          </div>
          <div className="league-row">
            <span>XP diff @ 15</span>
            <b>{num(match.metrics.xpDiffAt15)}</b>
          </div>
          <div className="league-row">
            <span>Level @ 15</span>
            <b>{match.metrics.levelAt15 ?? 'Unavailable'}</b>
          </div>
        </div>

        <div className="glass card">
          <div className="eyebrow">MID / LATE ECONOMY</div>
          <div className="league-row">
            <span>Post-15 CS/min</span>
            <b>{num(match.metrics.post15CsPerMin)}</b>
          </div>
          <div className="league-row">
            <span>First item</span>
            <b>
              {match.metrics.firstItemMinute
                ? `${match.metrics.firstItemMinute.toFixed(1)}m`
                : 'Unavailable'}
            </b>
          </div>
          <div className="league-row">
            <span>Second item</span>
            <b>
              {match.metrics.secondItemMinute
                ? `${match.metrics.secondItemMinute.toFixed(1)}m`
                : 'Unavailable'}
            </b>
          </div>
          <div className="league-row">
            <span>Objective involvement</span>
            <b>{pct(match.metrics.objectiveParticipation)}</b>
          </div>
          <div className="league-row">
            <span>Items shown</span>
            <b>{match.items?.join(' · ') || 'Unavailable'}</b>
          </div>
        </div>

        <div className="glass card">
          <div className="eyebrow">DEATH PROFILE</div>
          <div className="league-row">
            <span>Before 10</span>
            <b>{match.metrics.deathsPre10 ?? 'Unavailable'}</b>
          </div>
          <div className="league-row">
            <span>10–20</span>
            <b>{match.metrics.deaths10to20 ?? 'Unavailable'}</b>
          </div>
          <div className="league-row">
            <span>After 20</span>
            <b>{match.metrics.deathsPost20 ?? 'Unavailable'}</b>
          </div>
          <div className="league-row">
            <span>Solo deaths</span>
            <b>{match.metrics.soloDeaths ?? 'Unavailable'}</b>
          </div>
          <div className="league-row">
            <span>Teamfight deaths</span>
            <b>{match.metrics.teamfightDeaths ?? 'Unavailable'}</b>
          </div>
        </div>
      </div>

      {/* Timeline-derived, so it renders only for Riot-synced matches. */}
      <TurningPoints matchId={id} />

      <section className="glass review" style={{ marginTop: 18 }}>
        <div className="review-top">
          <div className="eyebrow">MATCH REVIEW</div>
          <span className="v7-badge">
            {review.band === 'BEGINNER'
              ? 'SIMPLIFIED'
              : review.band === 'ADVANCED'
                ? 'DETAILED'
                : 'STANDARD'}{' '}
            · {review.performance}/10
          </span>
        </div>
        <h2 className="review-headline">{review.headline}</h2>

        <div className="review-grid">
          <div>
            <span className="label">What you did well</span>
            <ul className="review-list">
              {review.didWell.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <span className="label">What to do instead</span>
            <ol className="review-list is-ordered">
              {review.whatToDoInstead.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </div>
        </div>

        <div className="review-mistake">
          <span className="label">Biggest mistake</span>
          <h3>{review.biggestMistake.title}</h3>
          <ul className="review-evidence">
            {review.biggestMistake.evidence.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
          <p className="review-why">{review.biggestMistake.whyItMatters}</p>
        </div>

        <p className="review-note">
          Written from your measured metrics, not generated. The same match always
          produces the same review.
        </p>
      </section>

      <div className="glass card mission-card" style={{ marginTop: 18 }}>
        <div className="eyebrow">BIGGEST REPEATABLE LEAK</div>
        <h2>{report.primary.category.replaceAll('_', ' ')}</h2>

        <div className="grid three">
          <div>
            <div className="label">FACTS FROM MATCH DATA</div>
            {report.primary.facts.map((fact) => (
              <p key={fact}>{fact}</p>
            ))}
          </div>

          <div>
            <div className="label">INTERPRETATION</div>
            <p className="muted">{report.primary.inference}</p>
            <div className="label">CONFIDENCE</div>
            <p>{Math.round(report.primary.confidence * 100)}%</p>
          </div>

          <div>
            <div className="label">NEXT BEHAVIOUR</div>
            <p className="muted">{report.primary.suggestion}</p>
          </div>
        </div>
      </div>

      <div className="glass card" style={{ marginTop: 18 }}>
        <div className="eyebrow">NEXT GAME HUNT CARD</div>
        <h2>{report.mission.title}</h2>
        {report.mission.rules.map((rule, index) => (
          <div className="cue-row" key={rule}>
            <span>{['WHEN', 'DO', 'CHECK'][index] ?? 'RULE'}</span>
            <b>{rule}</b>
          </div>
        ))}
        <p className="muted">
          Pass condition: {report.mission.target} {report.mission.unit} across{' '}
          {report.mission.gamesRequired} relevant games.
        </p>
        <Link href="/missions" className="btn primary">
          TRACK THIS MISSION
        </Link>
      </div>

      <div className="glass card data-note" style={{ marginTop: 18 }}>
        <div className="eyebrow">DATA RELIABILITY</div>
        <p className="muted">
          Visible numbers above are demo/internal match fields. In production,
          only metrics available from Riot match/timeline data or confirmed
          uploads should be populated. Concepts such as “bad recall”, “spacing
          error” or “wrong target” require timeline/video evidence and must not
          be asserted from a scoreboard alone.
        </p>
      </div>
    </AppShell>
  );
}
