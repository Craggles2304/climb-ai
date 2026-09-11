export type RangeAccessStatus='IN_RANGE'|'OUT_OF_RANGE'|'UNKNOWN';

export interface RangeAccessResult{
  status:RangeAccessStatus;
  label:string;
  distanceUnits:number|null;
  rangeUnits:number|null;
  reason:string;
}

/**
 * Compare an explicitly supplied target distance with a published attack/cast
 * range. No movement, dashes, hitbox padding or skillshot probability is
 * invented here. UNKNOWN is deliberate: callers should preserve the action and
 * lower confidence rather than silently treating missing range data as a miss.
 */
export function resolveStaticRangeAccess(
  distanceUnits:number|undefined|null,
  rangeUnits:number|undefined|null,
  label:string,
):RangeAccessResult{
  const distance=finiteNonNegative(distanceUnits);
  if(distance===null){
    return {
      status:'UNKNOWN',label,distanceUnits:null,rangeUnits:finitePositive(rangeUnits),
      reason:`${label}: no explicit target distance was supplied, so range access is not inferred.`,
    };
  }

  const range=finitePositive(rangeUnits);
  if(range===null){
    return {
      status:'UNKNOWN',label,distanceUnits:distance,rangeUnits:null,
      reason:`${label}: target distance is ${round(distance)} units, but the source does not publish a positive target range for this action.`,
    };
  }

  if(distance<=range+1e-9){
    return {
      status:'IN_RANGE',label,distanceUnits:distance,rangeUnits:range,
      reason:`${label}: ${round(distance)}u target distance is inside the published ${round(range)}u range.`,
    };
  }

  return {
    status:'OUT_OF_RANGE',label,distanceUnits:distance,rangeUnits:range,
    reason:`${label}: ${round(distance)}u target distance is outside the published ${round(range)}u range.`,
  };
}

export const blocksActionForRange=(result:RangeAccessResult)=>result.status==='OUT_OF_RANGE';

function finiteNonNegative(value:number|undefined|null):number|null{
  return Number.isFinite(value)&&Number(value)>=0?Number(value):null;
}
function finitePositive(value:number|undefined|null):number|null{
  return Number.isFinite(value)&&Number(value)>0?Number(value):null;
}
const round=(value:number)=>Math.round(value*10)/10;
