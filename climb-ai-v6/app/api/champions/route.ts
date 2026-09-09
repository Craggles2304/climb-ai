import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {championProfile} from '@/lib/champions/profile';
import {matchupRead} from '@/lib/champions/matchup';
import {championDetail,championRoster,latestPatch,resolveChampionId} from '@/lib/champions/source';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {humanError} from '@/lib/errors';

export const runtime='nodejs';
export const revalidate=3600;

/**
 * Champion profiles and matchup reads, both derived from Riot's public static
 * data. No API key is involved, so this route works regardless of whether the
 * Riot integration is enabled.
 *
 * The response always carries the patch it was derived from. A champion read
 * without a patch number is a stale-data problem waiting to happen, and this
 * app has already been bitten once by pretending old numbers were current.
 */

const schema=z.object({
  champion:z.string().min(1).max(32),
  opponent:z.string().min(1).max(32).optional(),
  level:z.coerce.number().int().min(1).max(18).optional(),
});

export async function GET(req:NextRequest){
  const limit=rateLimit(clientKey(req,'champions'),60,60_000);
  if(!limit.ok)
    return NextResponse.json(
      {ok:false,error:'Too many requests. Wait a moment.'},
      {status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}},
    );

  const parsed=schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if(!parsed.success)
    return NextResponse.json({ok:false,error:'Tell us which champion to look up.'},{status:400});

  const {champion,opponent,level}=parsed.data;

  try{
    const patch=await latestPatch();
    const [roster,myId]=await Promise.all([
      championRoster(patch),
      resolveChampionId(champion,patch),
    ]);
    if(!myId)
      return NextResponse.json({ok:false,error:`No champion called "${champion}".`},{status:404});

    const mine=await championDetail(myId,patch);
    const profile=championProfile(mine,roster);

    let matchup=null;
    if(opponent){
      const theirId=await resolveChampionId(opponent,patch);
      if(!theirId)
        return NextResponse.json({ok:false,error:`No champion called "${opponent}".`},{status:404});
      matchup=matchupRead(mine,await championDetail(theirId,patch),{level,roster});
    }

    return NextResponse.json({
      ok:true,patch,
      // atLevel is a function and cannot cross the wire, so the levels the UI
      // actually shows are resolved here rather than silently dropped.
      profile:{...profile,atLevel:undefined,
        statsByLevel:{1:profile.atLevel(1),6:profile.atLevel(6),11:profile.atLevel(11),18:profile.atLevel(18)}},
      matchup,
      names:Object.values(roster).map(c=>c.name).sort(),
    });
  }catch(err){
    // Every other route returns `error` as a string, so this one does too
    // rather than handing the client a differently-shaped payload to special-case.
    const {title,body}=humanError(err);
    return NextResponse.json({ok:false,error:`${title} ${body}`},{status:502});
  }
}
