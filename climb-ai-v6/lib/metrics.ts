import {MatchMetrics} from './types';

/**
 * Shared thresholds for ILP evidence, mission grading and cost-of-leak.
 * A game must clear the same bar everywhere in the product.
 */
export type Direction='atLeast'|'atMost';

export interface MetricSpec{
  key:keyof MatchMetrics;
  label:string;
  behaviour:string;
  threshold:number;
  direction:Direction;
  format:(n:number)=>string;
}

export const METRIC_SPECS:Record<string,MetricSpec>={
  post15CsPerMin:{key:'post15CsPerMin',label:'post-15 CS/min',behaviour:'post-lane economy',threshold:6,direction:'atLeast',format:n=>n.toFixed(1)},
  laneCsPerMin:{key:'laneCsPerMin',label:'lane CS/min',behaviour:'lane economy',threshold:6.5,direction:'atLeast',format:n=>n.toFixed(1)},
  csPerMin:{key:'csPerMin',label:'CS/min',behaviour:'resource collection',threshold:6,direction:'atLeast',format:n=>n.toFixed(1)},
  deathsPost20:{key:'deathsPost20',label:'post-20 deaths',behaviour:'late-game positioning',threshold:2,direction:'atMost',format:n=>n.toFixed(0)},
  deaths:{key:'deaths',label:'deaths',behaviour:'survival discipline',threshold:4,direction:'atMost',format:n=>n.toFixed(0)},
  secondItemMinute:{key:'secondItemMinute',label:'second-item timing',behaviour:'item breakpoints',threshold:23,direction:'atMost',format:n=>`${n.toFixed(0)}:00`},
  objectiveParticipation:{key:'objectiveParticipation',label:'objective involvement',behaviour:'objective tempo',threshold:.7,direction:'atLeast',format:n=>`${Math.round(n*100)}%`},
  damageShare:{key:'damageShare',label:'damage share',behaviour:'fight contribution',threshold:.25,direction:'atLeast',format:n=>`${Math.round(n*100)}%`},
  killParticipation:{key:'killParticipation',label:'kill participation',behaviour:'high-value presence',threshold:.65,direction:'atLeast',format:n=>`${Math.round(n*100)}%`},
  visionScore:{key:'visionScore',label:'vision score',behaviour:'vision control',threshold:40,direction:'atLeast',format:n=>n.toFixed(0)},
};

export const clears=(spec:MetricSpec,value:number)=>spec.direction==='atLeast'?value>=spec.threshold:value<=spec.threshold;

export function thresholdLabel(spec:MetricSpec):string{
  const v=spec.format(spec.threshold);
  return spec.direction==='atLeast'?`${v}+ ${spec.label}`:`${v} or fewer ${spec.label}`;
}
