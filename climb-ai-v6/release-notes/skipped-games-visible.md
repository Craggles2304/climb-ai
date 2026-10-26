# Games that were not recorded are now listed

Companion 0.12.1 says which games it skipped instead of dropping them in
silence. Only Ranked Solo/Duo (queue 420) progresses DNA, so a normal, flex or
ARAM game is never recorded — and until now nothing told the player that, which
made a working Companion look broken after an evening of games.

Each skipped game is reported once with its queue identity and one of two
reasons. **Not Ranked Solo/Duo** means the queue was read from the League client
and does not count. **Queue could not be read** means the client never supplied a
queue identity, so the game was skipped without being judged — this one is not
the player's doing and is worth investigating when it appears.

Home lists the three most recent under "Not recorded". Nothing is shown when
there is nothing to report, and what gets recorded is unchanged.
