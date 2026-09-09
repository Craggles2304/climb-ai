'use client';
import type {SupabaseClient} from '@supabase/supabase-js';
import {authConfigured} from '@/lib/auth/config';

/**
 * Browser Supabase client.
 *
 * The SDK is ~70 kB and is imported dynamically, so a deployment running in demo
 * mode never ships it. Statically importing it put Supabase into the first load
 * of every page including the landing page, for code that could not run.
 *
 * Returns null when auth is not configured, forcing every caller to handle the
 * demo case rather than crashing on a missing env var.
 */
let client:SupabaseClient|null=null;
let pending:Promise<SupabaseClient|null>|null=null;

export async function getBrowserClient():Promise<SupabaseClient|null>{
  if(!authConfigured())return null;
  if(client)return client;
  if(!pending){
    pending=import('@supabase/ssr').then(({createBrowserClient})=>{
      client=createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      return client;
    });
  }
  return pending;
}
