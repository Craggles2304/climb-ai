/**
 * Behaviour adherence — did the player actually do the thing?
 *
 * The plan asks for a behaviour ("check both side waves before defaulting mid")
 * but verifies a metric (post-15 CS/min ≥ 6.0). Those are not the same. A player
 * can clear the bar without doing the behaviour, and do the behaviour perfectly
 * while the metric misses because the game fell apart around them.
 *
 * Recording both turns one ambiguous signal into four distinct ones — and gives
 * the model the variable it needs to tell a cause from a symptom, because a
 * behaviour that was deliberately performed and still did not pay is evidence
 * the behaviour is not the lever.
 */

export type Adherence='YES'|'PARTLY'|'NO';

export type RepOutcome=
  |'CONFIRMED'      // did it, bar cleared
  |'UNREWARDED'     // did it, bar missed
  |'UNEARNED'       // did not do it, bar cleared anyway
  |'NO_REP';        // did not do it, bar missed

export interface RepVerdict{
  outcome:RepOutcome;
  /** Whether this rep should bank a pass toward mastery. */
  banksPass:boolean;
  headline:string;
  detail:string;
}

export function judgeRep(adherence:Adherence,clearedBar:boolean):RepVerdict{
  const did=adherence==='YES'||adherence==='PARTLY';

  if(did&&clearedBar){
    return {
      outcome:'CONFIRMED',banksPass:true,
      headline:'That one counts.',
      detail:adherence==='PARTLY'
        ?'You ran the behaviour and the number followed. Tighten it up and it will hold more often.'
        :'You ran the behaviour and the number followed. That is the rep the plan is asking for.',
    };
  }

  if(did&&!clearedBar){
    return {
      // The most important branch in the product. A player who did the work and
      // missed the number must not be told they failed, or they stop reporting
      // honestly — and the honest reports are the whole dataset.
      outcome:'UNREWARDED',banksPass:false,
      headline:'You did the work. The game did not cooperate.',
      detail:'That is not a failed rep, it is a noisy one. If this keeps happening the behaviour is not your lever, and the plan should change rather than you trying harder.',
    };
  }

  if(!did&&clearedBar){
    return {
      outcome:'UNEARNED',banksPass:false,
      headline:'The number cleared, but you did not run the behaviour.',
      detail:'Banking that as progress would teach you the wrong thing. The bar was cleared by the game, not by the habit.',
    };
  }

  return {
    outcome:'NO_REP',banksPass:false,
    headline:'No rep this game.',
    detail:'Nothing to learn from a game where the behaviour was not attempted. Run it once and the plan gets something to read.',
  };
}

/**
 * Summarises a run of reps. `attempted` is what matters for whether the player
 * is engaging; `confirmed` is what matters for whether it is working.
 */
export function summariseReps(verdicts:RepVerdict[]){
  const count=(o:RepOutcome)=>verdicts.filter(v=>v.outcome===o).length;
  const attempted=count('CONFIRMED')+count('UNREWARDED');
  const confirmed=count('CONFIRMED');
  return {
    total:verdicts.length,
    attempted,
    confirmed,
    unrewarded:count('UNREWARDED'),
    unearned:count('UNEARNED'),
    noRep:count('NO_REP'),
    /** Of the games where the behaviour was run, how often did the bar clear? */
    payoffRate:attempted?confirmed/attempted:null,
  };
}
