# OP CLIMB — Vercel to Cloudflare Workers migration

**Status:** source preparation only. This branch is not a production deployment. Keep Vercel and its domain registration intact until the Cloudflare production service passes acceptance tests.

## Current project layout

- GitHub source repository: `Craggles2304/climb-ai` (already contains the complete website and Windows Companion source).
- Next.js application root: `climb-ai-v6/`; Next.js 15.5.24, App Router, API route handlers and middleware.
- Windows Electron Companion: `climb-ai-v6/companion/`; distribute/install through GitHub Releases, **not** Cloudflare Workers.
- Supabase: external Auth/database; **do not migrate or delete existing user data**.
- Stripe: existing billing/webhook integration; update its production webhook destination when traffic cuts over.
- Riot integration: server-side routes; preserve credentials and test.
- Postgame processing: Vercel cron at `GET /api/cron/postgame` every minute, guarded by `CRON_SECRET`.

## Step 1: Test Cloudflare compatibility before changing DNS

Recommended target: **Cloudflare Workers Paid** (currently $5 USD/month minimum plus usage); a full server-rendered Next.js application may exceed Free tier's 10ms CPU limit. Do not assume actual costs or compatibility until tested.

This branch includes `wrangler.jsonc`, `open-next.config.ts` and a GitHub Actions smoke-build workflow. The adapter requires a newer Next.js than the existing Vercel lockfile's 15.5.24, so the Cloudflare build installs a compatible Next.js ephemerally alongside the adapter, leaving the existing Vercel install unchanged. The current app has an npm lockfile without the Cloudflare adapter; to avoid breaking `npm ci` on the live deployment, the smoke build and the Cloudflare deployment install the adapter as **CI-only ephemeral dependencies**.

**Pin all three versions exactly, and change them in this document and `.github/workflows/cloudflare-migration-check.yml` together.** `@opennextjs/cloudflare@latest` is not safe here: 1.20.13 (21 October 2026) raised its peer floor to `next >=15.5.28 <16 || >=16.4.1`, so every Workers build still pinning `next@15.5.27` began failing at `npm install` with `ERESOLVE` — no commit required, and production stopped deploying while the live Worker kept serving its last good build. The GitHub smoke test stayed green throughout, because it already pinned 15.5.28. A green `cloudflare-build` check therefore does **not** prove the dashboard build works; the two commands have to match.

At Cloudflare dashboard > Workers & Pages > Create application > Import a repository:

- Connect GitHub repository: `Craggles2304/climb-ai`.
- Worker name: must match the `name` in `wrangler.jsonc`, currently `climb-ai` (changed from `op-climb` in commit `2758ab85` to match the connected service). Confirm which Workers service is connected to this repository before deploying; the GitHub check reports as `Workers Builds: op-climb`, so verify the two names agree and that only one service builds from `main`.
- Framework/build type: **Workers**, not static Cloudflare Pages.
- Root directory: `climb-ai-v6`.
- Production branch: `main` **only after tests/PR are reviewed and merged**.
- Build command: `npm ci && npm install --no-save next@15.5.28 @opennextjs/cloudflare@1.20.13 wrangler@4.152.0 && npx opennextjs-cloudflare build`
- Production deploy command: `npx opennextjs-cloudflare deploy`
- Non-production deploy command: `npx opennextjs-cloudflare upload`
- Next.js output is in `.open-next/`; Wrangler provides the Worker entry point and static assets.
- Do not register `opclimb.com` or switch DNS until the worker preview has passed tests.

This configuration uses the OpenNext adapter to minimise code changes to the established Next.js application. Cloudflare currently recommends vinext for **new** Next.js applications, but migrating this already-built production app through OpenNext first allows targeted verification.

### Environment variables and secrets

Create these **in Cloudflare Workers settings**, with public `NEXT_PUBLIC_` values also available to the **build**. Do **not** put values in GitHub, commits, logs, public environment settings, or this document:

- Existing Vercel production configuration has these names: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
- Application additionally references optional or feature-dependent secrets such as `RIOT_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_LOL_PLUS_PRICE_ID`, `STRIPE_LOL_PRO_PRICE_ID`, `AI_API_KEY` and `AI_BASE_URL`. They were **not listed** in the Vercel production environment inspected on 14 October 2026; check which features are configured and whether secrets live elsewhere.
- If used, `NEXT_PUBLIC_SITE_URL=https://opclimb.com` should be verified for both build and runtime.
- Confirm `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the public/anon key, **not** the service role secret.
- Set server-only variables as **Secrets**, not exposed to the browser.

Cloudflare Workers Builds can require separate **Build variables and secrets** in addition to runtime Worker variables; set both where the compiler needs them.

## Step 2: Pre-cutover functional acceptance

Verify on the temporary Cloudflare Worker hostname:
- Front page, static files/visuals, `/league`, `/tft`, `/champions`, sign-up/sign-in, logout, protected routes.
- Supabase cookie sessions and OAuth callback configuration for the preview and eventual production URL.
- Riot ranked account connection, sync, champion recommendations and player DNA/missions.
- Billing checkout, server-side Stripe webhook signature verification, entitlements and Billing Portal. Use Stripe **test mode** on the preview.
- Companion pairings, telemetry uploads, overlay and post-game evidence against the new origin (some Companion settings may need URL updates).
- Image optimisation, error handling, timeouts, memory and CPU limits under realistic traffic.
- Inspect Cloudflare Worker bundle compressed size: Free tier 3 MiB, Paid tier 10 MiB. If oversized, split functions or rework imports rather than removing needed functionality. Measured on 25 October 2026 with the pinned versions above: `16437.74 KiB / gzip: 3131.42 KiB`, i.e. roughly 3.06 MiB — **already past the Free tier limit**, so this needs Workers Paid. Re-check with `npx wrangler deploy --dry-run` whenever dependencies change.
- Check compatibility of Next.js middleware, cache/ISR and the server's in-process rate limiter with the Workers execution model.

The GitHub smoke build is **only an adapter build check**; passing it is not equivalent to the above runtime acceptance.

## Step 3: Move the cron safely

Cloudflare Workers do not automatically run Vercel's `vercel.json` schedule. We provided an independent scheduled Worker in `cloudflare-cron/`.

**Deploy the cron only when the app is cut over and Vercel's old schedule is disabled**; otherwise both providers will drain the same queue concurrently.

In `climb-ai-v6/cloudflare-cron/` run, after Cloudflare login and configuring the matching `CRON_SECRET` as a **secret**:

```sh
npx wrangler secret put CRON_SECRET --config wrangler.jsonc
npx wrangler deploy --config wrangler.jsonc
```

The separate Worker calls the existing authenticated endpoint every minute, preserving functionality without changing application processing logic. Test on a staging origin before directing production traffic. Observe successful cron events and database queue drain.

## Step 4: Move `opclimb.com` without losing the domain

**Important account-specific discovery:** `opclimb.com` was **purchased and is registered through Vercel**, with authoritative nameservers `ns1.vercel-dns.com` and `ns2.vercel-dns.com`. Its registration is distinct from its hosting.

Do **not** delete the Vercel account/domain or assume moving GitHub files transfers domain ownership. Cloudflare Registrar generally requires a domain to be **at least 60 days old** before transferring a new registration; this domain was purchased in September 2026, so registrar transfer likely cannot occur until November 2026.

However, you can put **Cloudflare DNS in charge before transferring the domain registration**:
1. Add `opclimb.com` zone to Cloudflare. Check existing DNS records (including MX/TXT), DNSSEC and any email-related records.
2. Attach `opclimb.com` and `www.opclimb.com` to the tested Worker (per Cloudflare's Custom Domains setup).
3. From the Vercel **domain registrar settings**, change the domain's nameservers to the **exact two Cloudflare nameservers assigned to your account**. Do not invent values.
4. Confirm both names resolve to the new Worker with valid HTTPS. Test production logins and webhooks.
5. After ICANN's 60-day registration lock expires, transfer domain registration from Vercel Registrar to Cloudflare Registrar using the Vercel transfer-out authorisation code. Preserve renewal/payment details until complete.

DNS propagation may take time. Do not rush deletion before successful HTTPS and browser checks.

## Step 5: Retire Vercel **after cutover**

- Verify Cloudflare traffic, Stripe webhook deliveries, OAuth callback, Riot sync, Companion and queue draining.
- Verify domain registered/managed safely and no other websites depend on Vercel.
- Only then delete Vercel **OP CLIMB** project(s), disable old schedules and change/downgrade Pro billing. The user also has other Vercel projects (plumbing website, academy app, etc.): do not delete those without a project-by-project destination and approval.
- Domain transfer and cancelling hosting are **different** operations; never delete the purchased domain while it is the live registered domain.
- Keep a backup of the source and verify data still lives in Supabase.

## Current blocking issue

There is **no Cloudflare account/Workers API integration** available in this ChatGPT session, so connecting to your Cloudflare account, supplying runtime secrets, accepting potential Workers Paid billing and actually deploying production cannot be completed via the available tools.

The PR intentionally changes only the **GitHub source branch**. No production Vercel changes, registrar transfer, DNS changes or Cloudflare charges are authorised by this branch.

Official guides:
- https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/registrar/get-started/transfer-domain-to-cloudflare/
- https://vercel.com/docs/domains/managing-nameservers
