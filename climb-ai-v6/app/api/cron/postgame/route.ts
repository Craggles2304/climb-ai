import {NextRequest,NextResponse} from 'next/server';
import {drainPostGameQueue} from '@/lib/server/postGameQueue';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;

export async function GET(req:NextRequest){
  const secret=process.env.CRON_SECRET;
  if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`){
    return NextResponse.json({ok:false,error:'Unauthorized.'},{status:401});
  }
  try{
    const result=await drainPostGameQueue({limit:18,concurrency:3});
    return NextResponse.json({ok:true,...result});
  }catch(error){
    console.error('[postgame-cron] drain failed',error);
    return NextResponse.json({ok:false,error:'Post-game queue could not be drained.'},{status:500});
  }
}
