/**
 * Abort slow upstream requests so a degraded Supabase service cannot hold a
 * Vercel request open until the platform timeout. The caller decides how to
 * degrade after the fetch rejects.
 */
export function timedFetch(timeoutMs:number):typeof fetch{
  return async(input,init)=>{
    const controller=new AbortController();
    const upstream=init?.signal;
    const abort=()=>controller.abort();

    if(upstream?.aborted)controller.abort();
    else upstream?.addEventListener('abort',abort,{once:true});

    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      return await fetch(input,{...init,signal:controller.signal});
    }finally{
      clearTimeout(timer);
      upstream?.removeEventListener('abort',abort);
    }
  };
}
