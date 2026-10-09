import {Match} from '../types';
import {HABITS,HabitId} from './library';

/**
 * Several habits often land on the same death, so moments at the same second
 * are grouped into one replay stop listing every habit involved.
 */
export interface MomentGroup{t:number;items:{h:HabitId;d:string}[]}

export function groupMoments(moments:NonNullable<Match['habitMoments']>,only?:HabitId):MomentGroup[]{
  const groups=new Map<number,MomentGroup>();
  for(const m of moments){
    if(!(m.h in HABITS))continue;
    if(only&&m.h!==only)continue;
    const key=Math.floor(m.t/1000);
    const g=groups.get(key)||{t:m.t,items:[]};
    g.items.push({h:m.h as HabitId,d:m.d});
    groups.set(key,g);
  }
  return [...groups.values()].sort((a,b)=>a.t-b.t);
}
