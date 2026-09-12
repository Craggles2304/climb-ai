import {NextRequest,NextResponse} from 'next/server';
import {createServerClient} from '@supabase/ssr';
import {authConfigured} from '@/lib/auth/config';

export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  const code=request.nextUrl.searchParams.get('code');
  const next=safeNext(request.nextUrl.searchParams.get('next'));

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

    const {data,error}=await supabase.auth.exchangeCodeForSession(code);
    if(!error&&data.session){
      const canonical=process.env.NEXT_PUBLIC_SITE_URL||request.nextUrl.origin;
      const redirect=NextResponse.redirect(new URL(next,canonical));
      for(const cookie of cookieResponse.cookies.getAll())redirect.cookies.set(cookie);
      console.info('[auth-callback] OAuth exchange succeeded; forwarding session cookies');
      return redirect;
    }

    console.error('[auth-callback] Google code exchange failed',error?.message??'No session returned');
  }

  const canonical=process.env.NEXT_PUBLIC_SITE_URL||request.nextUrl.origin;
  const target=new URL('/login',canonical);
  target.searchParams.set('error','google_auth_failed');
  return NextResponse.redirect(target);
}

function safeNext(value:string|null){
  if(!value||!value.startsWith('/')||value.startsWith('//'))return '/dashboard';
  return value;
}
