import 'server-only';
import {createClient,SupabaseClient} from '@supabase/supabase-js';

/**
 * Service-role Supabase client. Bypasses RLS, so it must never be imported from
 * a client component — `server-only` enforces that at build time.
 *
 * Returns null when Supabase is not configured, which lets every caller degrade
 * to in-memory behaviour instead of crashing. That is what keeps Riot sync
 * usable with only a Riot key configured.
 */

let client:SupabaseClient|null=null;

export function getSupabaseAdmin():SupabaseClient|null{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return null;
  if(!client)client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  return client;
}

export const supabaseConfigured=()=>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL&&!!process.env.SUPABASE_SERVICE_ROLE_KEY;
