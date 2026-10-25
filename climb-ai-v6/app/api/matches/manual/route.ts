import {NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/supabase/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(){
  if(!await getCurrentUser())return NextResponse.json({ok:false,error:'Sign in before saving match evidence.'},{status:401});
  return NextResponse.json({ok:false,error:'Ranked Solo/Duo progression requires a Companion recording or Riot-verified match. Manual scoreboards do not count.'},{status:409});
}
