import {NextRequest,NextResponse} from 'next/server';
import {getServerClient} from '@/lib/supabase/server';

export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  const code=request.nextUrl.searchParams.get('code');
  const next=safeNext(request.nextUrl.searchParams.get('next'));
  const supabase=await getServerClient();

  if(code&&supabase){
    const {error}=await supabase.auth.exchangeCodeForSession(code);
    if(!error){
      return NextResponse.redirect(new URL(next,request.url));
    }
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
