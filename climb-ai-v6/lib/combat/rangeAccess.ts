export type RangeAccessStatus='IN_RANGE'|'OUT_OF_RANGE'|'UNKNOWN';

export interface RangeAccessResult{
  status:RangeAccessStatus;
  distanceUnits:number|null;
  rangeUnits:number|null;
  marginUnits:number|null;
  note:string;
}

/**
 * Resolve static range access without inventing movement, pathing or hit chance.
 *
 * We only hard-block an action when BOTH the target distance and a positive
 * action range are explicit. Riot sometimes publishes 0 for self-centred,
 * special-target or otherwise non-comparable spell ranges, so 0 is UNKNOWN
 * rather than being interpreted as a zero-range damaging spell.
 */
export function resolveRangeAccess(
  distanceUnits:number|null|undefined,
  rangeUnits:number|null|undefined,
  actionLabel='Action',
):RangeAccessResult{
  const distance=nonNegativeFinite(distanceUnits);
  const range=positiveFinite(rangeUnits);

  if(distance===null){
    return {
      status:'UNKNOWN',distanceUnits:null,rangeUnits:range,marginUnits:null,
      note:`${actionLabel}: no explicit target distance was supplied, so range does not block the action.`,
    };
  }
  if(range===null){
    return {
      status:'UNKNOWN',distanceUnits:distance,rangeUnits:null,marginUnits:null,
      note:`${actionLabel}: no positive comparable action range is available, so the engine will not guess whether ${round(distance)} units is reachable.`,
    };
  }

  const margin=round(range-distance);
  if(distance<=range+1e-9){
    return {
      status:'IN_RANGE',distanceUnits:distance,rangeUnits:range,marginUnits:margin,
      note:`${actionLabel}: ${round(distance)}u distance is inside ${round(range)}u range by ${round(Math.max(0,margin))}u.`,
    };
  }
  return {
    status:'OUT_OF_RANGE',distanceUnits:distance,rangeUnits:range,marginUnits:margin,
    note:`${actionLabel}: ${round(distance)}u distance exceeds ${round(range)}u range by ${round(distance-range)}u. No movement is invented, so this action is blocked.`,
  };
}

export function isRangeBlocked(
  distanceUnits:number|null|undefined,
  rangeUnits:number|null|undefined,
):boolean{
  return resolveRangeAccess(distanceUnits,rangeUnits).status==='OUT_OF_RANGE';
}

function nonNegativeFinite(value:number|null|undefined):number|null{
  return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
}
function positiveFinite(value:number|null|undefined):number|null{
  return typeof value==='number'&&Number.isFinite(value)&&value>0?value:null;
}
const round=(value:number)=>Math.round(value*100)/100;
