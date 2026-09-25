import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {championRoster,latestPatch,resolveChampionId} from '@/lib/champions/source';
import {counterTable} from '@/lib/champions/counterSource';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({
  champion:z.string().min(1).max(32),
  role:z.string().max(24).optional(),
  rank:z.string().max(32).optional(),
  region:z.string().max(16).optional(),
});

export async function GET(req:NextRequest){
  const limit=rateLimit(clientKey(req,'main-champion-counters'),20,60_000);
  if(!limit.ok){
    return NextResponse.json(
      {ok:false,error:'Too many counter-table requests. Wait a moment.'},
      {status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}},
    );
  }

  const parsed=schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if(!parsed.success)return NextResponse.json({ok:false,error:'Choose a champion first.'},{status:400});

  try{
    const patch=await latestPatch();
    const roster=await championRoster(patch);
    const id=await resolveChampionId(parsed.data.champion,patch);
    if(!id)return NextResponse.json({ok:false,error:'That champion could not be found.'},{status:404});

    const champion=roster[id];
    const result=await counterTable({
      champion:champion?.name||parsed.data.champion,
      role:parsed.data.role,
      rank:parsed.data.rank,
      region:parsed.data.region,
      patch,
      roster,
    });

    if(!result){
      return NextResponse.json(
        {ok:false,error:'Current matchup samples are unavailable for this champion and role.'},
        {status:503},
      );
    }

    return NextResponse.json({ok:true,...result});
  }catch(error){
    console.error('[main-champion-counters] failed',error);
    return NextResponse.json({ok:false,error:'Could not load the current counter table.'},{status:502});
  }
}
