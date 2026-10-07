import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {authorityForTier,loadCoachAuthority} from '@/lib/server/coachAuthority';
import {resolveLeagueEntitlement} from '@/lib/server/subscriptionAccess';
import {canonicalLeagueRole} from '@/lib/roleAwareLearning';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  const user=await getCurrentUser();
  const db=getSupabaseAdmin();
  if(!user||!db)return NextResponse.json({ok:false,error:'Authentication required.'},{status:401});
  const tier=(await resolveLeagueEntitlement(user.id)).tier;
  if(tier!=='PRO')return NextResponse.json({ok:false,error:'Coach Memory requires PRO.'},{status:403});
  const accountId=req.nextUrl.searchParams.get('accountId')||undefined;
  const role=canonicalLeagueRole(req.nextUrl.searchParams.get('role'));
  const authority=authorityForTier(await loadCoachAuthority(db,user.id,accountId,undefined,role??undefined),tier);
  const memories=authority.memories.map(memory=>({
    id:memory.id,kind:memory.kind,topic:memory.topic,summary:memory.summary,metric:memory.metric,role:memory.role,dnaDomain:memory.dnaDomain,memoryState:memory.memoryState,confidence:memory.confidence,status:memory.status,firstSeenAt:memory.firstSeenAt,lastSeenAt:memory.lastSeenAt,occurrences:memory.occurrences,
    evidence:memory.evidence.slice(-3),
  }));
  const states=memories.reduce<Record<string,number>>((acc,item)=>{const key=String(item.memoryState||item.status||'UNKNOWN').toUpperCase();acc[key]=(acc[key]??0)+1;return acc},{}) ;
  return NextResponse.json({
    ok:true,role:role??authority.role??null,count:memories.length,states,memories,
    leagueMind:memories.find(item=>item.kind==='PATTERN'&&String(item.topic).includes('LEAGUE_MIND'))??null,
    regression:memories.filter(item=>['REGRESSED','DUE'].includes(String(item.memoryState||'').toUpperCase())),
    mastered:memories.filter(item=>['MASTERED','RETAINED','PRINCIPLE_OWNED'].includes(String(item.memoryState||'').toUpperCase())),
    transfer:memories.filter(item=>String(item.topic).includes(':TRANSFER:')),
    dna:memories.filter(item=>String(item.topic).includes(':DNA:')),
  });
}