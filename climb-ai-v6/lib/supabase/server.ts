import 'server-only';
import {createServerClient} from '@supabase/ssr';
import type {SupabaseClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {authConfigured} from '@/lib/auth/config';

/**
 * Server Supabase client bound to the request's cookies, so a session set in the
 * browser is visible to server components and route handlers.
 *
 * Returns null when auth is unconfigured — the demo path.
 */
export async function getServerClient():Promise<SupabaseClient|null>{
  if(!authConfigured())return null;
  const store=await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies:{
        getAll:()=>store.getAll(),
        setAll:(list)=>{
          try{
            for(const {name,value,options} of list)store.set(name,value,options);
          }catch{
            // Called from a server component, where cookies are read-only.
            // Middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/** The signed-in user, or null. Never throws on a missing session. */
export async function getCurrentUser(){
  const supabase=await getServerClient();
  if(!supabase)return null;
  const {data,error}=await supabase.auth.getUser();
  return error?null:data.user;
}
