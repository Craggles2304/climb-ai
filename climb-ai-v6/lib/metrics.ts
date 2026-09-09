import {MatchMetrics} from './types';

/**
 * The thresholds that define "did this game clear the bar".
 *
 * These mirror the pass conditions in `evaluateMetric()` in lib/ilpEngine.ts.
 * They live here so the cost-of-leak engine and the ILP engine cannot drift
 * apart — a game the plan calls a pass must be the same game the price tag
 * counts as cleared, or the two features will contradict each other on screen.
 * tests/costOfLeak.test.ts asserts they still agree.
 */

export type Direction='atLeast'|'atMost';

export interface MetricSpec{
  key:keyof MatchMetrics;
  /** Short label for the metric itself, e.g. "post-15 CS/min". */
  label:string;
  /** Human name for the behaviour, used in headlines. */
  behaviour:string;
  threshold:number;
  direction:Direction;
  /** Renders a raw value the way a player reads it. */
  format:(n:number)=>string;
}

export const METRIC_SPECS:Record<string,MetricSpec>={
  post15CsPerMin:{
    key:'post15CsPerMin',label:'post-15 CS/min',behaviour:'post-lane economy',
    threshold:6,direction:'atLeast',format:n=>n.toFixed(1),
  },
  laneCsPerMin:{
    key:'laneCsPerMin',label:'lane CS/min',behaviour:'lane economy',
    threshold:6.5,direction:'atLeast',format:n=>n.toFixed(1),
  },
  deathsPost20:{
    key:'deathsPost20',label:'post-20 deaths',behaviour:'late-game positioning',
    threshold:2,direction:'atMost',format:n=>n.toFixed(0),
  },
  secondItemMinute:{
    key:'secondItemMinute',label:'second-item timing',behaviour:'item breakpoints',
    threshold:23,direction:'atMost',format:n=>`${n.toFixed(0)}:00`,
  },
  objectiveParticipation:{
    key:'objectiveParticipation',label:'objective involvement',behaviour:'objective tempo',
    threshold:0.7,direction:'atLeast',format:n=>`${Math.round(n*100)}%`,
  },
  damageShare:{
    key:'damageShare',label:'damage share',behaviour:'fight contribution',
    threshold:0.25,direction:'atLeast',format:n=>`${Math.round(n*100)}%`,
  },
};

export const clears=(spec:MetricSpec,value:number)=>
  spec.direction==='atLeast'?value>=spec.threshold:value<=spec.threshold;

/** How the bar reads in a sentence, e.g. "6.0+ post-15 CS/min". */
export function thresholdLabel(spec:MetricSpec):string{
  const v=spec.format(spec.threshold);
  return spec.direction==='atLeast'?`${v}+ ${spec.label}`:`${v} or fewer ${spec.label}`;
}
