import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {championProfile} from '@/lib/champions/profile';
import {rankMatchups} from '@/lib/champions/ranking';
import {rankItems,byDamagePerGold,dpsCurve,combatProfile} from '@/lib/champions/dps';
import {championDetail,championRoster,itemCatalogue,latestPatch,resolveChampionId} from '@/lib/champions/source';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {humanError} from '@/lib/errors';

export const runtime='nodejs';
export const revalidate=3600;

/**
 * Everything for one champion you main: damage curve, what each item is
 * actually worth on them, and every matchup ranked with its reasoning.
 *
 * All of it is arithmetic over Riot's public static data. Nothing here is a
 * win rate — see lib/champions/ranking.ts for why that is a deliberate limit
 * rather than an omission, and `blindSpots` in the response for the version
 * the player reads.
 */

const schema=z.object({
  champion:z.string().min(1).max(32),
  level:z.coerce.number().int().min(1).max(18).optional(),
  /** Comma-separated Riot tags, to narrow opponents to a plausible lane. */
  tags:z.string().max(120).optional(),
});

export async function GET(req:NextRequest){
  const limit=rateLimit(clientKey(req,'champion-main'),30,60_000);
  if(!limit.ok)
    return NextResponse.json(
      {ok:false,error:'Too many requests. Wait a moment.'},
      {status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}},
    );

  const parsed=schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if(!parsed.success)
    return NextResponse.json({ok:false,error:'Tell us which champion you main.'},{status:400});

  const {champion,level=11,tags}=parsed.data;

  try{
    const patch=await latestPatch();
    const [roster,id]=await Promise.all([
      championRoster(patch),
      resolveChampionId(champion,patch),
    ]);
    if(!id)
      return NextResponse.json({ok:false,error:`No champion called "${champion}".`},{status:404});

    const [detail,items]=await Promise.all([
      championDetail(id,patch),
      itemCatalogue(patch),
    ]);

    const values=rankItems(detail.stats,level,items);
    const damageItems=byDamagePerGold(values);
    const ranking=rankMatchups(roster,id,{
      level,
      topN:10,
      tags:tags?tags.split(',').map(t=>t.trim()).filter(Boolean):undefined,
    });

    // Riot's own attack rating is the only signal for whether auto-attacks are
    // this champion's main damage. Below this, the DPS numbers describe a
    // minority of what they do, and the page has to say so.
    const autoAttackReliant=detail.info.attack>=detail.info.magic;

    return NextResponse.json({
      ok:true,patch,level,
      champion:{
        id:detail.id,name:detail.name,title:detail.title,
        tags:detail.tags,attackRange:detail.stats.attackrange,
        info:detail.info,autoAttackReliant,
        // Sent so the page can redraw the curve for any item the player picks
        // without a round trip for each one.
        stats:detail.stats,
      },
      profile:{...championProfile(detail,roster),atLevel:undefined},
      dps:{
        curve:dpsCurve(detail.stats),
        atLevel:combatProfile(detail.stats,level),
      },
      items:{
        // Best and worst by damage per gold, plus everything for the full table.
        best:damageItems.slice(0,10),
        worst:damageItems.slice(-10).reverse(),
        all:values.sort((a,b)=>b.dpsGain-a.dpsGain||b.ehpGain-a.ehpGain),
        damageItemCount:damageItems.length,
        totalCount:values.length,
      },
      ranking,
      names:Object.values(roster).map(c=>c.name).sort(),
    });
  }catch(err){
    const {title,body}=humanError(err);
    return NextResponse.json({ok:false,error:`${title} ${body}`},{status:502});
  }
}
