# OVERPOWERED / CLIMB Live Tracker

The companion runs on the same Windows PC as League of Legends. While a match is running it reads Riot's local Live Client Data endpoint and sends compact, permitted snapshots to the CLIMB web app. CLIMB uses those snapshots after the match to build a deterministic strength timeline.

It is intentionally **not** an automated shotcaller. It does not expose hidden enemy cooldowns, infer unseen information, or tell the player when to fight during a live match.

## What it records

Every 5 seconds while League's Live Client Data endpoint is available:

- game clock and mode
- the active player's exposed combat stats
- all players' exposed champion, level, visible items and score state
- exposed death / respawn state
- recent events supplied by the local API

The companion normalises the data before upload. The website does not need a language-model call to create the basic power timeline.

## Development setup

Requirements:

- Windows PC running League of Legends
- Node.js 22 or newer
- the `climb-ai-v6/companion` folder from this repository
- a signed-in CLIMB account
- Supabase configured with migrations through `007_live_tracker_pairing.sql`

### 1. Pair the PC

Open `/live` in CLIMB, switch to your own Riot account, and choose **PAIR THIS PC**.

The page returns a one-time tracker token. The server stores only its SHA-256 hash. Do not share the token.

### 2. Start the companion

From PowerShell in this folder you can use the guided launcher:

```powershell
.\start-windows.ps1
```

Enter the CLIMB website address and the one-time token when prompted.

Or set the environment variables manually:

```powershell
$env:OP_WEB_URL="https://your-climb-domain.example"
$env:OP_TRACKER_TOKEN="climb_live_your_token_here"
npm start
```

The old `CLIMB_WEB_URL` and `CLIMB_TRACKER_TOKEN` environment-variable names are also accepted.

### 3. Play League

Leave the companion window open. Before a match it says it is waiting. When Riot's local endpoint becomes available it creates a session and records silently. When the endpoint disappears for several polls it closes the session and asks CLIMB to build the post-game review.

### 4. Review the match

Return to `/live`. The completed session shows the major strength swings with timestamps and reasons based on visible state such as level, visible item value and death/respawn windows.

## Local Riot connection

The companion reads only:

`https://127.0.0.1:2999/liveclientdata/allgamedata`

Riot's local certificate is self-signed, so certificate verification is disabled **only for this localhost request**. Normal TLS verification remains enabled for uploads to the CLIMB website.

## Production packaging

The current companion is a developer build. Before public release it should be wrapped as a signed Windows installer/executable so ordinary users do not need Node.js or the repository. The pairing/token protocol and server APIs in this folder are designed so that packaged client can use the same backend later.
