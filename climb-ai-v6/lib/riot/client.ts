import 'server-only';

/**
 * Server-only Riot HTTP client.
 *
 * Responsibilities kept here so no caller has to think about them:
 *  - the API key never leaves the server (this module cannot be imported client-side)
 *  - 429 handling that honours Retry-After instead of hammering
 *  - a small TTL cache, because match and timeline payloads are immutable once a
 *    game has ended and re-fetching them wastes a strict rate budget
 */

export class RiotApiError extends Error{
  constructor(message:string,readonly status:number,readonly url:string){
    super(message);
    this.name='RiotApiError';
  }
  /** True when retrying later could plausibly succeed. */
  get retryable(){return this.status===429||this.status>=500}
}

interface CacheEntry{expires:number;value:unknown}
const cache=new Map<string,CacheEntry>();

/** Immutable payloads (a finished match) can be cached hard; live data cannot. */
const TTL={immutable:24*60*60_000,short:60_000} as const;

function readCache<T>(key:string):T|undefined{
  const hit=cache.get(key);
  if(!hit)return undefined;
  if(hit.expires<Date.now()){cache.delete(key);return undefined}
  return hit.value as T;
}

function writeCache(key:string,value:unknown,ttl:number){
  cache.set(key,{expires:Date.now()+ttl,value});
  // Keep the map from growing without bound in a long-lived server process.
  if(cache.size>500){
    const oldest=[...cache.entries()].sort((a,b)=>a[1].expires-b[1].expires).slice(0,100);
    for(const [k] of oldest)cache.delete(k);
  }
}

export function riotApiKey():string{
  const key=process.env.RIOT_API_KEY;
  if(!key)throw new Error('RIOT_API_KEY is not set. Riot sync cannot run without it.');
  return key;
}

export function riotEnabled():boolean{
  return process.env.RIOT_API_ENABLED==='true'&&!!process.env.RIOT_API_KEY;
}

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

export interface RiotFetchOptions{
  /** Cache lifetime. Use 'immutable' for finished-match payloads. */
  ttl?:keyof typeof TTL;
  /** Attempts on 429 / 5xx before giving up. */
  maxRetries?:number;
}

export async function riotFetch<T>(url:string,opts:RiotFetchOptions={}):Promise<T>{
  const ttl=TTL[opts.ttl||'short'];
  const cached=readCache<T>(url);
  if(cached!==undefined)return cached;

  const maxRetries=opts.maxRetries??3;
  let lastError:RiotApiError|null=null;

  for(let attempt=0;attempt<=maxRetries;attempt++){
    const res=await fetch(url,{
      headers:{'X-Riot-Token':riotApiKey()},
      cache:'no-store',
    });

    if(res.ok){
      const value=await res.json() as T;
      writeCache(url,value,ttl);
      return value;
    }

    // Never put the key in an error message or log line.
    const safeUrl=url.replace(/api_key=[^&]+/,'api_key=REDACTED');
    lastError=new RiotApiError(riotMessage(res.status),res.status,safeUrl);

    if(!lastError.retryable||attempt===maxRetries)break;

    const retryAfter=Number(res.headers.get('Retry-After'));
    const waitMs=Number.isFinite(retryAfter)&&retryAfter>0
      ?retryAfter*1000
      :Math.min(8000,2**attempt*500);
    await sleep(waitMs);
  }

  throw lastError;
}

function riotMessage(status:number):string{
  switch(status){
    case 400:return 'Riot rejected the request as malformed.';
    case 401:
    case 403:return 'Riot API key is missing, expired or not authorised for this endpoint.';
    case 404:return 'Riot has no record matching that lookup.';
    case 429:return 'Riot rate limit reached.';
    default:return status>=500?'Riot API is currently unavailable.':`Riot API returned ${status}.`;
  }
}

/** Exposed for tests and for the admin dashboard's cache panel. */
export const __cache={
  size:()=>cache.size,
  clear:()=>cache.clear(),
};
