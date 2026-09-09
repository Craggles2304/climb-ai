'use client';
import {useEffect} from 'react';
import {ErrorState} from '@/components/ErrorState';
import {errorKind} from '@/lib/errors';
import {track,flush} from '@/lib/analytics';

/**
 * Route-level error boundary. Catches anything a page throws during render.
 * Reports the kind of failure — never the raw message — and flushes immediately,
 * because a page that just crashed may be about to be closed.
 */
export default function RouteError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  useEffect(()=>{
    track('app_error',{where:'route',kind:errorKind(error),digest:error.digest??null});
    void flush(true);
  },[error]);

  return <main className="container section">
    <div className="glass errstate-card" style={{maxWidth:640,margin:'80px auto'}}>
      <ErrorState error={error} reset={reset}/>
    </div>
  </main>;
}
