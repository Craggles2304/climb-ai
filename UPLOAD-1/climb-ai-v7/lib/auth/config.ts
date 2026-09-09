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

/** Routes that require a signed-in user once auth is configured. */
export const PROTECTED_PREFIXES=[
  '/dashboard','/ilp','/analyse','/missions','/progress','/coach',
  '/uploads','/account','/billing','/settings','/champions','/matchups','/live',
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
}):AuthDecision{
  const {path,configured,signedIn,isAdmin,demoMode}=opts;

  // Admin is gated even in demo mode when auth exists, because it exposes
  // other people's aggregate data rather than the viewer's own.
  if(isAdminRoute(path)){
    if(!configured&&demoMode)return {action:'ALLOW'};
    if(!signedIn)return {action:'REDIRECT',to:'/login',reason:'Admin requires sign-in.'};
    if(!isAdmin)return {action:'REDIRECT',to:'/dashboard',reason:'Not an admin.'};
    return {action:'ALLOW'};
  }

  // Without Supabase there is nothing to authenticate against, so the product
  // stays fully usable as a demo instead of redirecting into a dead login page.
  if(!configured)return {action:'ALLOW'};

  if(isAuthPage(path)&&signedIn){
    return {action:'REDIRECT',to:'/dashboard',reason:'Already signed in.'};
  }

  if(isProtected(path)&&!signedIn){
    return {action:'REDIRECT',to:'/login',reason:'Sign-in required.'};
  }

  return {action:'ALLOW'};
}
