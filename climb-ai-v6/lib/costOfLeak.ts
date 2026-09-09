import {Match} from './types';
import {METRIC_SPECS,MetricSpec,clears,thresholdLabel} from './metrics';

/**
 * Cost of leak — what a behaviour is actually costing this player.
 *
 * Splits the player's own games by whether they cleared a metric's bar and
 * compares how often they won on each side. This is the product's edge: a stats
 * site reports the number, this reports what the number is worth.
 *
 * Three rules it will not break:
 *
 *  1. FACT vs INFERENCE vs SUGGESTION are separate fields, never blended into
 *     one sentence. "You won 8 of 11" is observed. "That is a 46-point gap" is
 *     derived. "You would gain 4 wins" is a counterfactual and is only offered
 *     at high confidence, phrased as an estimate.
 *  2. Sample gates are hard. Below them the result is INSUFFICIENT_SAMPLE with
 *     the number of games still needed — never a number dressed up as insight.
 *  3. No causal language. Winning more in games where you farmed well does not
 *     prove that farming well caused the wins, and the copy must not say it did.
 *
 * Pure: no fetching, no clock, no environment. Testable against fixtures.
 */

/** Total games needed before any split is reported at all. */
export const MIN_TOTAL=15;
/** Games needed on each side of the bar, so neither side is a rounding error. */
export const MIN_PER_SIDE=5;

export type LeakStatus='READY'|'INSUFFICIENT_SAMPLE'|'METRIC_UNAVAILABLE';
export type Confidence='LOW'|'MEDIUM'|'HIGH';

export interface Side{games:number;wins:number;winRate:number}

export interface LeakPrice{
  metric:string;
  spec:MetricSpec;
  status:LeakStatus;
  /** Games that had a usable value for this metric. */
  sample:number;
  cleared:Side;
  missed:Side;
  /** Percentage points between the two win rates. Null unless READY. */
  gapPoints:number|null;
  /**
   * Counterfactual: extra wins if the below-bar games had gone at the above-bar
   * rate. An estimate, not an entitlement — only populated at HIGH confidence.
   */
  estimatedWinsLost:number|null;
  confidence:Confidence|null;
  /** Games still needed to reach the reporting gate. */
  gamesNeeded:number;
  fact:string;
  inference:string|null;
  suggestion:string|null;
}

const rate=(wins:number,games:number)=>games?wins/games:0;

function confidenceFor(total:number,a:number,b:number):Confidence{
  const side=Math.min(a,b);
  if(total>=30&&side>=10)return 'HIGH';
  if(total>=20&&side>=7)return 'MEDIUM';
  return 'LOW';
}

export function priceLeak(matches:Match[],metric:string):LeakPrice{
  const spec=METRIC_SPECS[metric];
  if(!spec){
    return unavailable(metric,null,'This behaviour is not scored against a match metric yet.');
  }

  const usable=matches.filter(m=>typeof m.metrics[spec.key]==='number');
  const cleared:Match[]=[];
  const missed:Match[]=[];
  for(const m of usable){
    (clears(spec,m.metrics[spec.key] as number)?cleared:missed).push(m);
  }

  const wins=(xs:Match[])=>xs.filter(m=>m.result==='WIN').length;
  const clearedSide:Side={games:cleared.length,wins:wins(cleared),winRate:rate(wins(cleared),cleared.length)};
  const missedSide:Side={games:missed.length,wins:wins(missed),winRate:rate(wins(missed),missed.length)};

  if(!usable.length){
    return unavailable(metric,spec,`No games on this account record ${spec.label}.`,clearedSide,missedSide);
  }

  // Hard gate. Below it there is no honest headline, only a reason to play more.
  const shortOfTotal=Math.max(0,MIN_TOTAL-usable.length);
  const shortOfSide=Math.max(0,MIN_PER_SIDE-Math.min(clearedSide.games,missedSide.games));
  if(shortOfTotal>0||shortOfSide>0){
    const needed=Math.max(shortOfTotal,shortOfSide);
    return {
      metric,spec,status:'INSUFFICIENT_SAMPLE',sample:usable.length,
      cleared:clearedSide,missed:missedSide,
      gapPoints:null,estimatedWinsLost:null,confidence:null,gamesNeeded:needed,
      fact:`${usable.length} of the ${MIN_TOTAL} games needed to price this leak.`,
      inference:null,
      suggestion:`Play ${needed} more ranked ${needed===1?'game':'games'} and this becomes a number.`,
    };
  }

  const gapPoints=Math.round((clearedSide.winRate-missedSide.winRate)*100);
  const confidence=confidenceFor(usable.length,clearedSide.games,missedSide.games);
  const estimatedWinsLost=confidence==='HIGH'
    ?Math.round(missedSide.games*(clearedSide.winRate-missedSide.winRate))
    :null;

  const bar=thresholdLabel(spec);
  const fact=`In your last ${usable.length} games, you won ${clearedSide.wins} of ${clearedSide.games} when you held ${bar}, and ${missedSide.wins} of ${missedSide.games} when you did not.`;

  // Only claim a gap when one points the right way; a negative or flat split is
  // reported plainly rather than spun.
  const inference=gapPoints>0
    ?`That is a ${gapPoints}-point win-rate gap on the same account, over the same period.`
    :gapPoints===0
      ?'Your win rate is the same on both sides of that bar, so this behaviour is not currently separating your games.'
      :`You are currently winning ${Math.abs(gapPoints)} points more often when you miss that bar, so this is not the behaviour to chase right now.`;

  const suggestion=gapPoints>0
    ?(estimatedWinsLost&&estimatedWinsLost>0
      ?`Roughly ${estimatedWinsLost} of those losses sit on the wrong side of ${bar}. Clearing it is the highest-value change available to you.`
      :`Clearing ${bar} is where your wins are concentrated. Keep the sample growing before reading too much into the size of the gap.`)
    :null;

  return {
    metric,spec,status:'READY',sample:usable.length,
    cleared:clearedSide,missed:missedSide,
    gapPoints,estimatedWinsLost,confidence,gamesNeeded:0,
    fact,inference,suggestion,
  };
}

/** Prices every metric the plan tracks and returns them worst-gap first. */
export function rankLeaks(matches:Match[],metrics:string[]):LeakPrice[]{
  return metrics
    .map(m=>priceLeak(matches,m))
    .sort((a,b)=>(b.gapPoints??-999)-(a.gapPoints??-999));
}

function unavailable(metric:string,spec:MetricSpec|null,why:string,cleared?:Side,missed?:Side):LeakPrice{
  const empty:Side={games:0,wins:0,winRate:0};
  return {
    metric,spec:spec||METRIC_SPECS.post15CsPerMin,status:'METRIC_UNAVAILABLE',sample:0,
    cleared:cleared||empty,missed:missed||empty,
    gapPoints:null,estimatedWinsLost:null,confidence:null,gamesNeeded:MIN_TOTAL,
    fact:why,inference:null,suggestion:null,
  };
}
