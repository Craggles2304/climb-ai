import 'server-only';

/**
 * Minimal fixed-window limiter. In-process only, so it protects a single server
 * instance from abuse and accidental loops; a multi-instance deployment should
 * move this to Redis or Supabase before public launch.
 */

interface Window{count:number;resetAt:number}
const windows=new Map<string,Window>();

export interface RateLimitResult{ok:boolean;remaining:number;retryAfterSeconds:number}

export function rateLimit(key:string,limit:number,windowMs:number):RateLimitResult{
  const now=Date.now();
  const existing=windows.get(key);

  if(!existing||existing.resetAt<=now){
    windows.set(key,{count:1,resetAt:now+windowMs});
    return {ok:true,remaining:limit-1,retryAfterSeconds:0};
  }

  existing.count++;
  const remaining=Math.max(0,limit-existing.count);
  const ok=existing.count<=limit;
  return {ok,remaining,retryAfterSeconds:ok?0:Math.ceil((existing.resetAt-now)/1000)};
}

/** Best-effort client identity for anonymous routes. */
export function clientKey(req:Request,scope:string):string{
  const fwd=req.headers.get('x-forwarded-for')||'';
  const ip=fwd.split(',')[0].trim()||req.headers.get('x-real-ip')||'unknown';
  return `${scope}:${ip}`;
}

/** Exposed so tests and the admin panel can reason about limiter state. */
export const __windows={size:()=>windows.size,clear:()=>windows.clear()};
