import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {latestPatch} from '@/lib/champions/source';
import {toBuildItems} from '@/lib/champions/build';
import {matchupItemCatalogue} from '@/lib/combat/itemSource';
import {isCompletedItem,isFinishedBoot} from '@/lib/riot/items';
import {popularBuild} from '@/lib/champions/popularBuildSource';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({
  champion:z.string().min(1).max(32),
  role:z.string().max(20).optional(),
  rank:z.string().max(60).optional(),
  region:z.string().max(16).optional(),
});

export async function GET(req:NextRequest){
  const limit=rateLimit(clientKey(req,'champion-popular-build'),30,60_000);
  if(!limit.ok)return NextResponse.json(
    {ok:false,error:'Too many build lookups. Wait a moment.'},
    {status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}},
  );

  const parsed=schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if(!parsed.success)return NextResponse.json({ok:false,error:'Choose a champion.'},{status:400});

  try{
    const patch=await latestPatch();
    const raw=await matchupItemCatalogue(patch);
    const source=Object.fromEntries(
      Object.entries(raw).filter(([,item])=>isCompletedItem(item)||isFinishedBoot(item))
    );
    const catalogue=toBuildItems(source,patch);
    const result=await popularBuild({...parsed.data,patch,catalogue});
    if(!result)return NextResponse.json({
      ok:false,
      error:'Popularity data is unavailable for those filters right now.',
      patch,
    },{status:404});

    return NextResponse.json({ok:true,...result});
  }catch{
    return NextResponse.json({ok:false,error:'Could not load the current popular build.'},{status:502});
  }
}
