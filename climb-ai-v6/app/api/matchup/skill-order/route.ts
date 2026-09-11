import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {championDetail,latestPatch,resolveChampionId} from '@/lib/champions/source';
import {skillOrder} from '@/lib/champions/skillOrder';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {humanError} from '@/lib/errors';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({
  champions:z.array(z.string().min(1).max(32)).min(1).max(4),
});

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'matchup-skill-order'),30,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Checking skill plans too fast. Wait a moment.'},{status:429});

  let body:unknown;
  try{body=await req.json()}catch{return NextResponse.json({ok:false,error:'Could not read the request.'},{status:400})}
  const parsed=schema.safeParse(body);
  if(!parsed.success)return NextResponse.json({ok:false,error:'That skill-plan request is not valid.'},{status:400});

  try{
    const patch=await latestPatch();
    const plans=await Promise.all(parsed.data.champions.map(async requested=>{
      const id=await resolveChampionId(requested,patch);
      if(!id)return {requested,ok:false,error:`No champion called "${requested}".`};
      const champion=await championDetail(id,patch);
      const standard=isStandardSkillSystem(champion.spells.map(spell=>spell.maxrank));
      if(!standard){
        return {
          requested,ok:true,id:champion.id,champion:champion.name,
          mode:'STANDARD_FALLBACK' as const,sequence:[] as string[],shorthand:'STANDARD FALLBACK',
          basis:'This champion does not expose the normal 5/5/5/3 rank structure in Data Dragon, so CLIMB will not invent a champion-specific level order.',
          unavailable:['Champion-specific standard skill progression is unavailable for this non-standard rank system.'],
        };
      }
      const plan=skillOrder(champion);
      return {
        requested,ok:true,id:champion.id,champion:champion.name,
        mode:'UPTIME_BASELINE' as const,
        sequence:plan.sequence.map(step=>step.slot),
        shorthand:plan.shorthand,
        basis:plan.basis,
        unavailable:plan.unavailable,
      };
    }));
    return NextResponse.json({ok:true,patch,plans});
  }catch(err){
    const {title,body:detail}=humanError(err);
    return NextResponse.json({ok:false,error:`${title} ${detail}`},{status:502});
  }
}

function isStandardSkillSystem(maxRanks:number[]):boolean{
  return maxRanks.length>=4
    &&maxRanks[0]===5&&maxRanks[1]===5&&maxRanks[2]===5
    &&maxRanks[3]===3;
}
