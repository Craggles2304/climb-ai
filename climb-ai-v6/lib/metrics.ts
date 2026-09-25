import {MatchMetrics} from './types';

/**
 * Metric display metadata only.
 *
 * IMPORTANT:
 * Pass/fail thresholds do NOT live in this file anymore.
 * Mission grading is rank-aware and comes from rankMissionBenchmarks.ts
 * through gradeMissionGame().
 */
export interface MetricSpec{
  key:keyof MatchMetrics;
  label:string;
  behaviour:string;
  format:(n:number)=>string;
}

export const METRIC_SPECS:Record<string,MetricSpec>={
  post15CsPerMin:{key:'post15CsPerMin',label:'post-15 CS/min',behaviour:'post-lane economy',format:n=>n.toFixed(1)},
  laneCsPerMin:{key:'laneCsPerMin',label:'lane CS/min',behaviour:'lane economy',format:n=>n.toFixed(1)},
  csPerMin:{key:'csPerMin',label:'CS/min',behaviour:'resource collection',format:n=>n.toFixed(1)},
  deathsPost20:{key:'deathsPost20',label:'post-20 deaths',behaviour:'late-game positioning',format:n=>n.toFixed(0)},
  deaths:{key:'deaths',label:'deaths',behaviour:'survival discipline',format:n=>n.toFixed(0)},
  secondItemMinute:{key:'secondItemMinute',label:'second-item timing',behaviour:'item breakpoints',format:minuteLabel},
  objectiveParticipation:{key:'objectiveParticipation',label:'objective involvement',behaviour:'objective presence',format:n=>`${Math.round(n*100)}%`},
  damageShare:{key:'damageShare',label:'damage share',behaviour:'fight contribution',format:n=>`${Math.round(n*100)}%`},
  killParticipation:{key:'killParticipation',label:'kill participation',behaviour:'high-value presence',format:n=>`${Math.round(n*100)}%`},
  visionScore:{key:'visionScore',label:'vision score',behaviour:'vision control',format:n=>n.toFixed(0)},
  deathsPre10:{key:'deathsPre10',label:'deaths before 10',behaviour:'early survival',format:n=>n.toFixed(0)},
  csAt10:{key:'csAt10',label:'CS at 10',behaviour:'early lane economy',format:n=>n.toFixed(0)},
  csAt15:{key:'csAt15',label:'CS at 15',behaviour:'lane economy',format:n=>n.toFixed(0)},
};

function minuteLabel(n:number){
  const minutes=Math.floor(n);
  const seconds=Math.round((n-minutes)*60);
  return minutes+':'+String(seconds).padStart(2,'0');
}
