# CLIMB Companion prototype

This is a Phase 2 local telemetry skeleton. It polls Riot's local Live Client Data endpoint while a game is running and posts a small permitted snapshot to the CLIMB web app.

It is intentionally **not** an automated shotcaller. The product should use live telemetry to improve post-game evidence and ILP adaptation, not to issue hidden-information or tactical commands that play the game for the user.

Set `CLIMB_WEB_URL` and `CLIMB_ACCOUNT_ID`, then run `npm start` from this folder on the same Windows PC as League. Production requires authentication, secure device pairing, persistence, rate limiting, Riot-policy review and a signed desktop build.
