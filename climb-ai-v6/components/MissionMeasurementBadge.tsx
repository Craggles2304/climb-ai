'use client';

import {missionMeasurementLabel,missionMeasurementSource,type MissionMeasurementSource} from '@/lib/missionGrading';

export function MissionMeasurementBadge({metric,compact=false}:{metric:string;compact?:boolean}){
  const source=missionMeasurementSource(metric);
  return <span
    className={'mission-source-badge '+tone(source)+(compact?' is-compact':'')}
    title={description(source)}
  >
    <i/>
    {missionMeasurementLabel(source)}
  </span>;
}

function description(source:MissionMeasurementSource){
  if(source==='LIVE_MEASURABLE')return'Measured from Companion/live game telemetry and the completed tracked match.';
  if(source==='RIOT_POST_GAME')return'Requires Riot completed-match data before OP CLIMB can score the mission.';
  return'Proved by OP CLIMB decision analysis built from tracked game evidence.';
}

function tone(source:MissionMeasurementSource){
  if(source==='LIVE_MEASURABLE')return'is-live';
  if(source==='RIOT_POST_GAME')return'is-riot';
  return'is-decision';
}
