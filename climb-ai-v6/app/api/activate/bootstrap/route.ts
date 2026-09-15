import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {bootstrapActivation} from '@/lib/server/activationBootstrap';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({
  gameName:z.string().trim().min(1).max(32),
  tagline:z.string().trim().min(1).max(8),
  region:z.string().trim().min(2).max(8),
  fallbackRole:z.enum(['TOP','JUNGLE','MID','ADC','SUPPORT']).default('ADC'),
  frustration:z.string().trim().max(160).default('I do not know why I am losing'),
});

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'activation-bootstrap'),4,60_000);
  if(!limit.ok){
    return NextResponse.json({ok:false,error:'Too many activation attempts. Wait a moment and try again.'},{status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}});
  }
  try{
    const input=schema.parse(await req.json());
    const result=await bootstrapActivation(input);
    return NextResponse.json(result.body,{status:result.status});
  }catch(error){
    if(error instanceof z.ZodError)return NextResponse.json({ok:false,error:'Enter your Riot game name, tagline and region.'},{status:400});
    console.error('[activation-bootstrap] failed',error);
    return NextResponse.json({ok:false,error:'OP CLIMB could not build the first grade right now. Try again or use the manual match fallback.'},{status:500});
  }
}
