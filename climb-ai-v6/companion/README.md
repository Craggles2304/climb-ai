# OVERPOWERED Companion prototype

This is a Phase 2 local telemetry skeleton. It polls Riot's local Live Client Data endpoint while a game is running and posts a small permitted snapshot to the OVERPOWERED web app.

It is intentionally **not** an automated shotcaller. The product should use live telemetry to improve post-game evidence and ILP adaptation, not to issue hidden-information or tactical commands that play the game for the user.

Set `OP_WEB_URL` and `OP_ACCOUNT_ID` (the old `CLIMB_*` names still work), then run `npm start` from this folder on the same Windows PC as League. Production requires authentication, secure device pairing, persistence, rate limiting, Riot-policy review and a signed desktop build.
