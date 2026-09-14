import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {latestPatch,championRoster,resolveChampionId,championDetail} from '@/lib/champions/source';
import {buildLiveMatchupPlan} from '@/lib/champions/liveMatchupPlan';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {humanError} from '@/lib/errors';

export const runtime='nodejs';
export const revalidate=3600;

const schema=z.object({
  champion:z.string().trim().min(1).max(32),
  opponent:z.string().trim().min(1).max(32),
  role:z.string().trim().max(24).optional(),
});

export async function GET(req:NextRequest){
  const limit=rateLimit(clientKey(req,'live-matchup-plan'),40,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Too many matchup requests. Wait a moment.'},{status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}});

  const parsed=schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if(!parsed.success)return NextResponse.json({ok:false,error:'Champion and lane opponent are required.'},{status:400});

  try{
    const {champion,opponent,role}=parsed.data;
    const patch=await latestPatch();
    const [roster,myId,theirId]=await Promise.all([
      championRoster(patch),
      resolveChampionId(champion,patch),
      resolveChampionId(opponent,patch),
    ]);
    if(!myId)return NextResponse.json({ok:false,error:`No champion called "${champion}".`},{status:404});
    if(!theirId)return NextResponse.json({ok:false,error:`No champion called "${opponent}".`},{status:404});
    const [you,them]=await Promise.all([championDetail(myId,patch),championDetail(theirId,patch)]);
    const plan=buildLiveMatchupPlan({you,them,roster,patch,role});
    return NextResponse.json({ok:true,plan});
  }catch(err){
    const {title,body}=humanError(err);
    return NextResponse.json({ok:false,error:`${title} ${body}`},{status:502});
  }
}
