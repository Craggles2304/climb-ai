import {NextRequest,NextResponse} from 'next/server';
import {createServerClient} from '@supabase/ssr';
import {authConfigured} from '@/lib/auth/config';

export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  const code=request.nextUrl.searchParams.get('code');
  const next=safeNext(request.nextUrl.searchParams.get('next'));

  if(code&&authConfigured()){
    const redirect=NextResponse.redirect(new URL(next,request.url));
    const supabase=createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies:{
          getAll:()=>request.cookies.getAll(),
          setAll:(list)=>{
            for(const {name,value,options} of list){
              redirect.cookies.set(name,value,options);
            }
          },
        },
      },
    );

    const {error}=await supabase.auth.exchangeCodeForSession(code);
    if(!error)return redirect;
    console.error('[auth-callback] Google code exchange failed',error);
  }

  const target=new URL('/login',request.url);
  target.searchParams.set('error','google_auth_failed');
  return NextResponse.redirect(target);
}

function safeNext(value:string|null){
  if(!value||!value.startsWith('/')||value.startsWith('//'))return '/dashboard';
  return value;
}
