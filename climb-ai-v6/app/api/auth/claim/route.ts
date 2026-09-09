import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/**
 * Claims anonymous history for the user who just signed in.
 *
 * Everything recorded before sign-in — analytics events, feedback, behaviour
 * checks — carries only an `anon_id`. This attaches them to the account, so a
 * founder tester's first session is not orphaned from their user id forever.
 *
 * The anon id is supplied by the browser and is therefore untrusted: someone
 * could claim another browser's rows. That is acceptable for pseudonymous
 * telemetry with no personal data in it, and it is deliberately limited to rows
 * that have not already been claimed by a different user.
 */

const schema=z.object({anonId:z.string().min(8).max(64)});

const CLAIMABLE=['analytics_events','feedback','behaviour_checks'] as const;

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'claim'),10,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Too many requests.'},{status:429});

  // The session is the authority for *who* — never a value from the body.
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({ok:false,error:'Not signed in.'},{status:401});

  let anonId:string;
  try{
    anonId=schema.parse(await req.json()).anonId;
  }catch{
    return NextResponse.json({ok:false,error:'Malformed request.'},{status:400});
  }

  const db=getSupabaseAdmin();
  if(!db){
    return NextResponse.json({ok:true,persisted:false,reason:'Supabase is not configured.'});
  }

  const claimed:Record<string,number>={};
  for(const table of CLAIMABLE){
    const {data,error}=await db.from(table)
      .update({user_id:user.id})
      .eq('anon_id',anonId)
      .is('user_id',null)     // never steal rows already owned by someone else
      .select('id');
    if(error){
      console.error(`[claim] ${table}:`,error.message);
      continue;               // one failing table must not abort the rest
    }
    claimed[table]=data?.length??0;
  }

  return NextResponse.json({ok:true,persisted:true,claimed});
}
