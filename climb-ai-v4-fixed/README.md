# CLIMB//AI v4 — Multi-account League coaching MVP

This version adds the two missing product foundations identified during live testing:

1. Multiple Riot accounts under one CLIMB//AI user. The active account is switched globally and demo Dashboard/Analyse/Missions/Progress/Coach views follow that account.
2. League-specific evidence. ADC reviews now separate lane vs post-15 economy and expose CS@10/15, gold/XP @15, item timings, death phase, KP, damage share and objective involvement when present. The Coach explicitly distinguishes scoreboard/timeline evidence from claims that require clip/VOD evidence.

## Demo linked accounts
- ExampleADC#EUW — Gold IV ADC
- Kraggles#2304 — Platinum IV ADC
- ClimbTest#EUW — Silver I Jungle

## Production data architecture
`supabase/migrations/002_multi_accounts.sql` adds `riot_account_id` partitioning to match/coaching tables. A real account linker should resolve Riot ID to PUUID server-side and never expose Riot API credentials in the browser.

## Run
```bash
npm install
npm run build
npm run dev
```

No production Riot/AI/Stripe keys are included.
