'use client';

import {missionMeasurementLabel,missionMeasurementSource,type MissionMeasurementSource} from '@/lib/missionGrading';

export function MissionMeasurementBadge({metric,compact=false}:{metric:string;compact?:boolean}){
  const source=missionMeasurementSource(metric);
  return <span className={'mission-source-badge '+tone(source)+(compact?' is-compact':'')}>
    <i/>
    {missionMeasurementLabel(source)}
  </span>;
}

function tone(source:MissionMeasurementSource){
  if(source==='LIVE_MEASURABLE')return'is-live';
  if(source==='RIOT_POST_GAME')return'is-riot';
  return'is-decision';
}
