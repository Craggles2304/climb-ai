'use client';
import {useEffect,useRef} from 'react';
import {track,AnalyticsEvent} from '@/lib/analytics';

/**
 * Fires one analytics event on mount. A ref guards against React strict-mode's
 * double-invoke in development, which would otherwise double every view count.
 */
export function TrackView({event,props}:{event:AnalyticsEvent;props?:Record<string,unknown>}){
  const fired=useRef(false);
  useEffect(()=>{
    if(fired.current)return;
    fired.current=true;
    track(event,props);
  },[event,props]);
  return null;
}
