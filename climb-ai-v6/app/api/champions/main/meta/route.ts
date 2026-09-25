import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {latestPatch,resolveChampionId,championDetail} from '@/lib/champions/source';
import {matchupItemCatalogue} from '@/lib/combat/itemSource';
import {isCompletedItem,isFinishedBoot} from '@/lib/riot/items';
import {toBuildItems} from '@/lib/champions/build';
import {championMeta} from '@/lib/champions/metaSource';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({
  champion:z.string().min(1).max(32),
  role:z.string().max(24).optional(),
});

export async function GET(req:NextRequest){
  const limit=rateLimit(clientKey(req,'main-champion-meta'),20,60_000);
  if(!limit.ok)return NextResponse.json(
    {ok:false,error:'Too many meta lookups. Wait a moment.'},
    {status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}},
  );

  const parsed=schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if(!parsed.success)return NextResponse.json({ok:false,error:'Choose a champion first.'},{status:400});

  try{
    const patch=await latestPatch();
    const id=await resolveChampionId(parsed.data.champion,patch);
    if(!id)return NextResponse.json({ok:false,error:'Champion not found.'},{status:404});

    const [detail,rawItems]=await Promise.all([
      championDetail(id,patch),
      matchupItemCatalogue(patch),
    ]);
    const source=Object.fromEntries(
      Object.entries(rawItems).filter(([,item])=>isCompletedItem(item)||isFinishedBoot(item))
    );
    const catalogue=toBuildItems(source,patch);

    const meta=await championMeta({
      champion:detail.name,
      role:parsed.data.role,
      patch,
      catalogue,
    });
    if(!meta)return NextResponse.json({ok:false,error:'Current champion meta data is unavailable.'},{status:503});
    return NextResponse.json({ok:true,...meta});
  }catch(error){
    console.error('[main-champion-meta] failed',error);
    return NextResponse.json({ok:false,error:'Could not load champion meta data.'},{status:502});
  }
}
