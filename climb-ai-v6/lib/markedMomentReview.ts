export interface ReviewedMarkedMoment {
  atSeconds:number;
  status:'MATCHED'|'NO_EVIDENCE';
  detail:string;
}

interface TimedEvidence {atSeconds?:unknown;headline?:unknown;comparisonReason?:unknown;}

export function reviewMarkedMoments(
  marks:unknown,
  fights:unknown,
  points:unknown,
  durationSeconds:number,
):ReviewedMarkedMoment[]{
  if(!Array.isArray(marks))return[];
  const duration=Number.isFinite(durationSeconds)?Math.max(0,durationSeconds):0;
  const evidence=[
    ...(Array.isArray(fights)?fights:[]).map((item:TimedEvidence)=>({item,window:45,detail:String(item?.headline||'Nearby recorded fight.')})),
    ...(Array.isArray(points)?points:[]).map((item:TimedEvidence)=>({item,window:30,detail:String(item?.comparisonReason||'Nearby recorded decision.')})),
  ].filter(row=>Number.isFinite(Number(row.item?.atSeconds)));
  return marks.slice(0,12).flatMap(mark=>{
    const second=Number(mark?.gameSeconds);
    if(!Number.isFinite(second)||second<0||second>duration)return[];
    const nearest=evidence.map(row=>({...row,distance:Math.abs(Number(row.item.atSeconds)-second)}))
      .filter(row=>row.distance<=row.window)
      .sort((a,b)=>a.distance-b.distance)[0];
    return[{atSeconds:Math.round(second),status:(nearest?'MATCHED':'NO_EVIDENCE') as ReviewedMarkedMoment['status'],detail:nearest?.detail||'No nearby review evidence was captured for this moment.'}];
  }).sort((a,b)=>a.atSeconds-b.atSeconds);
}
