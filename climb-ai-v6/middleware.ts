import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {createServerClient} from '@supabase/ssr';
import {authConfigured,decideAccess,isUnreachable} from '@/lib/auth/config';

/** Session refresh + route protection. */
export async function middleware(req:NextRequest){
  const path=req.nextUrl.pathname;
  const demoMode=process.env.NEXT_PUBLIC_DEMO_MODE==='true';
  const configured=authConfigured();

  let response=NextResponse.next({request:req});
  let signedIn=false;
  let isAdmin=false;
  let authReachable=true;

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

    try{
      const {data,error}=await supabase.auth.getUser();
      if(error&&isUnreachable(error)){
        authReachable=false;
      }else{
        signedIn=Boolean(data.user);
        isAdmin=data.user?.app_metadata?.role==='admin';
      }
    }catch{
      authReachable=false;
    }
  }else{
    isAdmin=req.cookies.get('climb_admin')?.value==='1';
  }

  // /live is also a product-discovery URL. A visitor with no session gets a
  // real public product preview instead of an unexplained login bounce.
  if(path==='/live'&&configured&&authReachable&&!signedIn){
    const url=req.nextUrl.clone();
    url.pathname='/demo';
    url.search='';
    url.searchParams.set('focus','live');
    const redirect=NextResponse.redirect(url);
    for(const cookie of response.cookies.getAll())redirect.cookies.set(cookie);
    return redirect;
  }

  const decision=decideAccess({path,configured,signedIn,isAdmin,demoMode,authReachable});
  if(decision.action==='REDIRECT'){
    const url=req.nextUrl.clone();
    url.pathname=decision.to;
    if(decision.to==='/login')url.searchParams.set('next',path);
    const redirect=NextResponse.redirect(url);
    for(const cookie of response.cookies.getAll())redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config={
  matcher:[
    '/((?!_next/static|_next/image|favicon.ico|brand|client|icon.svg|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|webp)$).*)',
  ],
};
