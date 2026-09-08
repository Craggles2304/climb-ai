# CLIMB//AI — production-style MVP foundation

Core promise: **Play a game. Find the one thing holding you back. Fix it next game.**

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. Demo mode is enabled by default and needs no external credentials.

## What works in demo mode

- Conversion landing page
- Signup/login UX and 7-step onboarding
- Responsive desktop + mobile app shell
- Demo match history
- Shared typed match model
- Deterministic evidence-based match analysis
- FACT / INFERENCE / SUGGESTION separation
- One active mission with 3–5-game repetition model
- Dashboard, missions, progress, champions, matchup assistant, Coach, uploads, pricing, billing, account, settings and admin screens
- Screenshot upload confirmation UX with editable extraction results
- Climb Score calculation that explicitly does **not** claim to predict Riot MMR
- PWA manifest, icon, service worker and installable layout foundation
- Analytics event vocabulary
- Supabase Postgres migration with RLS-oriented user ownership policies
- Riot, AI, billing, storage and auth service boundaries
- Demo-mode protected-admin middleware pattern

## External integrations

### Supabase
Set the public URL/anon key client-side. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Replace `DemoAuthService` and persistence adapters with Supabase Auth/database calls. Apply `supabase/migrations/001_init.sql` after reviewing it for your environment.

### Riot
`lib/services/riotService.ts` is the integration boundary. Enable only after the production server-side Riot implementation is added and policy/production-key requirements are satisfied. Never expose `RIOT_API_KEY` to the browser. Imported and manual matches already share the same internal `Match` type.

### AI
The deterministic engine in `lib/engine.ts` owns statistics, signal classification and mission selection. A language model should only turn structured, database-derived results into natural language. Never let the model invent numeric evidence. Add the provider behind `AIService` and keep the key server-side.

### Stripe
`BillingService` is a placeholder. Production should create server-side Stripe Checkout sessions and Billing Portal sessions; Stripe remains the card-data processor. Founder pricing should be represented by configurable Stripe price IDs/feature-flag configuration, not entitlement logic hard-coded to £5.99.

## MVP architecture

1. Data processing
2. Performance signals
3. Problem classification
4. Mission selection
5. Human-readable coaching

The deterministic analysis engine compares the current match with recent form and selects a single primary issue. Missions are designed to persist rather than change every match.

## Production checklist before launch

- Wire Supabase Auth and persistence
- Replace demo screenshot extraction with server-side multimodal extraction + confirmation
- Add upload storage limits, MIME validation and abuse/rate limiting
- Add server-side Riot API implementation + caching/rate-limit handling
- Add AI provider with strict structured schemas and usage limits
- Add Stripe Checkout, webhook entitlement sync, billing portal and discounts
- Add real admin role claims and remove demo bypass
- Add CSRF/rate-limit/security headers as appropriate to deployment platform
- Add account deletion/export jobs
- Add cookie-consent tooling where legally required
- Replace draft legal pages with counsel-reviewed policies
- Verify current Riot developer product-registration, API-key, monetisation, branding and disclaimer requirements immediately before public launch
- Add production analytics provider and server-side north-star reporting
- Add automated unit/integration/E2E tests and upload security tests
- Replace SVG-only PWA icon with required platform icon sizes if the chosen deployment/audit tooling requires raster sizes

## North-star event

`completed_climb_loop`: analysis → mission → subsequent game → mission progress update.

`first_mission_generated` is the activation event and should occur within the first session.
