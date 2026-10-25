# Ranked Solo/Duo 5v5

OP CLIMB now measures the League Solo/Duo climb (Riot queue 420). Flex, normals,
ARAM, Clash, TFT and unknown queues cannot supply League match reviews, DNA
baselines, mission proof or XP. Rank-aware targets use the selected Riot account.
Companion 0.12.0 reads queue identity from the local League client's gameflow
session. CLASSIC mode and the map name are not accepted as ranked proof.

The main navigation, activation flow and recording page lead to ranked play.
The new Companion disables automatic TFT capture and preparation panels; existing
TFT data and direct pages are retained separately. Manual/demo extraction is
removed from the ranked onboarding path and cannot write ranked evidence.

The additive migration adds nullable queue identity columns and ranked history
indexes. It leaves all existing rows and RLS policies intact. Older recordings
were saved without queue identity: their queue remains unknown until verified.
Existing mission proof is reconciled against owned queue-420 matches; the original
proof is retained in queueScopeArchive. Older XP ledger entries remain stored but
are excluded from displayed XP if their match does not qualify. Learning model
version 3 rebuilds derived profiles from ranked evidence on demand.

Validation includes a completed FINAL bundle through linked match, review, rank,
learning profile and six missions in a database fixture; exclusion tests for other
queues; independent persisted-match checks for XP; baseline ownership; selected
account rank isolation; and the full existing regression/build gates. The schema
was verified on the live database without deleting historical records. A real
Solo/Duo recording with Companion 0.12.0 remains the live capture validation.

The release also upgrades to Next.js 16.4.3 with the existing Webpack build and
Edge middleware. OpenNext now rejects the previous Next.js 15 branch as outside
its support window. Production, preview base settings and CI use the same pinned
Cloudflare adapter/CLI versions; new previews no longer inherit the obsolete
Next.js 15.5.27 override.
