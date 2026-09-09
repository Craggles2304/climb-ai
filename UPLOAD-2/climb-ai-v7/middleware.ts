import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {createServerClient} from '@supabase/ssr';
import {authConfigured,decideAccess} from '@/lib/auth/config';

/**
 * Session refresh + route protection.
 *
 * Two jobs, in this order:
 *  1. Refresh the Supabase session on every request, so a server component never
 *     sees an expired token. This must write cookies onto the response that is
 *     actually returned, which is why the response object is threaded through
 *     rather than recreated.
 *  2. Apply the routing rules from lib/auth/config.ts, which are pure and tested
 *     separately from this plumbing.
 *
 * With Supabase unconfigured this does nothing but pass the request through —
 * the product stays fully usable as a demo.
 */

export async function middleware(req:NextRequest){
  const path=req.nextUrl.pathname;
  const demoMode=process.env.NEXT_PUBLIC_DEMO_MODE==='true';
  const configured=authConfigured();

  let response=NextResponse.next({request:req});
  let signedIn=false;
  let isAdmin=false;

  if(configured){
    const supabase=createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies:{
          getAll:()=>req.cookies.getAll(),
          setAll:(list)=>{
            for(const {name,value} of list)req.cookies.set(name,value);
            response=NextResponse.next({request:req});
            for(const {name,value,options} of list)response.cookies.set(name,value,options);
          },
        },
      },
    );

    // getUser() revalidates against Supabase. getSession() only reads the cookie
    // and is spoofable, so it must not be used for an access decision.
    const {data}=await supabase.auth.getUser();
    signedIn=Boolean(data.user);
    isAdmin=data.user?.app_metadata?.role==='admin';
  }else{
    // Legacy demo admin gate, preserved so the admin page stays reachable in
    // demo mode exactly as it was before auth existed.
    isAdmin=req.cookies.get('climb_admin')?.value==='1';
  }

  const decision=decideAccess({path,configured,signedIn,isAdmin,demoMode});
  if(decision.action==='REDIRECT'){
    const url=req.nextUrl.clone();
    url.pathname=decision.to;
    // Send the player back where they were heading once they have signed in.
    if(decision.to==='/login')url.searchParams.set('next',path);
    const redirect=NextResponse.redirect(url);
    // Carry any refreshed auth cookies onto the redirect.
    for(const cookie of response.cookies.getAll())redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config={
  matcher:[
    // Everything except static assets, images and the favicon.
    '/((?!_next/static|_next/image|favicon.ico|brand|icon.svg|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|webp)$).*)',
  ],
};
