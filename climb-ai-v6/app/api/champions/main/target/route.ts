import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {latestPatch,resolveChampionId,championDetail} from '@/lib/champions/source';
import {statsAtLevel} from '@/lib/champions/ddragon';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({
  champion:z.string().min(1).max(32),
  level:z.coerce.number().int().min(1).max(18).optional(),
});

export async function GET(req:NextRequest){
  const limit=rateLimit(clientKey(req,'main-champion-target'),30,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Too many target lookups.'},{status:429});

  const parsed=schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if(!parsed.success)return NextResponse.json({ok:false,error:'Choose a target champion.'},{status:400});

  try{
    const patch=await latestPatch();
    const id=await resolveChampionId(parsed.data.champion,patch);
    if(!id)return NextResponse.json({ok:false,error:'Target champion not found.'},{status:404});
    const detail=await championDetail(id,patch);
    const level=parsed.data.level??11;
    const stats=statsAtLevel(detail.stats,level);
    return NextResponse.json({
      ok:true,
      patch,
      target:{
        id:detail.id,
        name:detail.name,
        level,
        hp:stats.hp,
        armor:stats.armor,
        magicResist:stats.magicResist,
      },
    });
  }catch(error){
    console.error('[main-champion-target] failed',error);
    return NextResponse.json({ok:false,error:'Could not load target stats.'},{status:502});
  }
}
