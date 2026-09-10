/**
 * Whether real authentication is available.
 *
 * The whole app was built and demonstrated without Supabase, and it has to stay
 * that way: if auth is unconfigured, every route stays open in demo mode rather
 * than locking a developer or a reviewer out of a product that works fine
 * without an account. Configure Supabase and the same code enforces properly.
 *
 * Safe to import from both server and client — it reads only public env vars.
 */

export const authConfigured=()=>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Routes that require a signed-in user once auth is configured.
 *
 * /champions and /matchups are deliberately NOT here. Everything they show is
 * computed from Riot's public static CDN — champion stats, item values, DPS,
 * matchup comparisons — with no server-side user data involved at all. Gating
 * them achieved nothing except locking people out of the one part of the app
 * that works with no account and no database, which is exactly what happened
 * when the database was unreachable. They are also the best possible shop
 * window: someone can get real value before deciding to sign up.
 */
export const PROTECTED_PREFIXES=[
  '/dashboard','/ilp','/analyse','/missions','/progress','/coach',
  '/uploads','/account','/billing','/settings','/live',
] as const;

/** Routes only an admin may see. */
export const ADMIN_PREFIXES=['/admin'] as const;

/** Routes a signed-in user should be bounced away from. */
export const AUTH_PAGES=['/login','/signup'] as const;

const startsWithAny=(path:string,prefixes:readonly string[])=>
  prefixes.some(p=>path===p||path.startsWith(`${p}/`));

export const isProtected=(path:string)=>startsWithAny(path,PROTECTED_PREFIXES);
export const isAdminRoute=(path:string)=>startsWithAny(path,ADMIN_PREFIXES);
export const isAuthPage=(path:string)=>startsWithAny(path,AUTH_PAGES);

export type AuthDecision=
  |{action:'ALLOW'}
  |{action:'REDIRECT';to:string;reason:string};

/**
 * The single place the routing rules live, kept pure so they can be tested
 * without spinning up a request. Middleware is the only caller.
 */
export function decideAccess(opts:{
  path:string;
  configured:boolean;
  signedIn:boolean;
  isAdmin:boolean;
  demoMode:boolean;
  /**
   * Whether Supabase actually answered. Configured-but-unreachable is a real
   * state, not an edge case: free-tier projects pause after a week of
   * inactivity, so this happens on a schedule.
   */
  authReachable?:boolean;
}):AuthDecision{
  const {path,configured,signedIn,isAdmin,demoMode}=opts;
  const authReachable=opts.authReachable??true;

  // Admin is gated even in demo mode when auth exists, because it exposes
  // other people's aggregate data rather than the viewer's own.
  if(isAdminRoute(path)){
    if(!configured&&demoMode)return {action:'ALLOW'};
    // Admin fails CLOSED when auth is unreachable. Everything else below fails
    // open, but admin is the one route where being unable to check identity
    // must mean refusal rather than degradation.
    if(!authReachable)
      return {action:'REDIRECT',to:'/dashboard',reason:'Cannot verify admin while auth is unreachable.'};
    if(!signedIn)return {action:'REDIRECT',to:'/login',reason:'Admin requires sign-in.'};
    if(!isAdmin)return {action:'REDIRECT',to:'/dashboard',reason:'Not an admin.'};
    return {action:'ALLOW'};
  }

  // Without Supabase there is nothing to authenticate against, so the product
  // stays fully usable as a demo instead of redirecting into a dead login page.
  if(!configured)return {action:'ALLOW'};

  /*
   * Configured but unreachable: allow through rather than redirect.
   *
   * Failing open on an auth error is usually wrong, so the reasoning matters.
   * The only thing these routes protect is the viewer's own data, and that data
   * lives in the database that is unreachable — so there is nothing to leak;
   * the pages render demo and local data only. Failing closed instead would
   * redirect to a login page that cannot work, locking everyone out of features
   * like /champions and /matchups that never touch the database at all.
   *
   * Admin is handled above and still fails closed.
   */
  if(!authReachable)return {action:'ALLOW'};

  if(isAuthPage(path)&&signedIn){
    return {action:'REDIRECT',to:'/dashboard',reason:'Already signed in.'};
  }

  if(isProtected(path)&&!signedIn){
    return {action:'REDIRECT',to:'/login',reason:'Sign-in required.'};
  }

  return {action:'ALLOW'};
}

/**
 * Whether a Supabase error means "could not reach the database" rather than
 * "this visitor is not signed in". The two must not be confused: the first is
 * an outage to degrade around, the second is a normal answer.
 *
 * A paused free-tier project is the common case. It surfaces as a fetch
 * failure or a gateway status rather than a clean 401, because there is no
 * database left to say no.
 */
export function isUnreachable(error:unknown):boolean{
  const err=error as {status?:number;message?:string;name?:string}|null;
  if(!err)return false;

  // 401/403 are real answers from a working service: not signed in.
  if(err.status===401||err.status===403)return false;

  // Anything the gateway returns when the project is asleep or overloaded.
  if(typeof err.status==='number'&&err.status>=500)return true;

  const text=`${err.name??''} ${err.message??''}`.toLowerCase();
  return /fetch failed|network|econnrefused|enotfound|etimedout|timeout|socket|dns|unavailable|paused|sleep/.test(text);
}
