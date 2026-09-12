import {NextRequest,NextResponse} from 'next/server';
import {createServerClient} from '@supabase/ssr';
import {authConfigured} from '@/lib/auth/config';

export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  const code=request.nextUrl.searchParams.get('code');
  const flowId=request.nextUrl.searchParams.get('sb_flow_id');
  const providerError=request.nextUrl.searchParams.get('error');
  const providerErrorCode=request.nextUrl.searchParams.get('error_code');
  const providerErrorDescription=request.nextUrl.searchParams.get('error_description');
  const next=safeNext(request.nextUrl.searchParams.get('next'));
  const canonical=process.env.NEXT_PUBLIC_SITE_URL||request.nextUrl.origin;

  if(providerError){
    console.error('[auth-callback] Provider returned an OAuth error',{
      error:providerError,
      errorCode:providerErrorCode??undefined,
      description:providerErrorDescription??undefined,
    });
  }

  if(code&&authConfigured()){
    let cookieResponse=NextResponse.next({request});

    const supabase=createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies:{
          getAll:()=>request.cookies.getAll(),
          setAll:(list)=>{
            for(const {name,value} of list)request.cookies.set(name,value);
            cookieResponse=NextResponse.next({request});
            for(const {name,value,options} of list){
              cookieResponse.cookies.set(name,value,options);
            }
          },
        },
      },
    );

    const {data,error}=await supabase.auth.exchangeCodeForSession(
      code,
      flowId?{flowId}:undefined,
    );

    if(!error&&data.session){
      const redirect=NextResponse.redirect(new URL(next,canonical));
      for(const cookie of cookieResponse.cookies.getAll())redirect.cookies.set(cookie);
      console.info('[auth-callback] OAuth exchange succeeded',{
        flowIdPresent:Boolean(flowId),
        sessionPresent:true,
        cookieCount:cookieResponse.cookies.getAll().length,
      });
      return redirect;
    }

    console.error('[auth-callback] OAuth code exchange failed',{
      flowIdPresent:Boolean(flowId),
      error:error?.message??'No session returned',
    });
  }else if(!code&&!providerError){
    console.error('[auth-callback] Callback arrived without an OAuth code');
  }

  const target=new URL('/login',canonical);
  target.searchParams.set('error','google_auth_failed');
  return NextResponse.redirect(target);
}

function safeNext(value:string|null){
  if(!value||!value.startsWith('/')||value.startsWith('//'))return '/dashboard';
  return value;
}
