/**
 * Replacement for Vercel's /api/cron/postgame schedule.
 * Deploy only AFTER production is moved to Cloudflare and the old schedule is
 * disabled. CRON_SECRET must be set as a Cloudflare Worker secret and match
 * the application's CRON_SECRET. Never commit the secret.
 */
export default {
  async scheduled(_event, env, ctx) {
    if (!env.CRON_SECRET) {
      throw new Error('Missing CRON_SECRET on scheduled Worker');
    }
    const base = new URL(env.OPCLIMB_ORIGIN);
    if (base.protocol !== 'https:') throw new Error('OPCLIMB_ORIGIN must use HTTPS');
    const endpoint = new URL('/api/cron/postgame', base);
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`OP CLIMB post-game queue HTTP ${response.status}`);
    // Read to ensure the request finishes within this scheduled invocation.
    const body = await response.json();
    if (!body.ok) throw new Error('OP CLIMB post-game queue reported failure');
    console.log(JSON.stringify({ event: 'postgame-drain', claimed: body.claimed, completed: body.completed, failed: body.failed }));
    if (body.failed > 0) throw new Error('OP CLIMB post-game queue had failed jobs');
  },
};
