import {NextRequest,NextResponse} from 'next/server';
import type {ChampionDetail} from '@/lib/champions/ddragon';
import {authenticateTrackerToken} from '@/lib/server/liveTrackerRepository';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {latestPatch,championRoster,resolveChampionId,championDetail} from '@/lib/champions/source';
import {buildChampionPowerPlan} from '@/lib/champions/championPowerPlan';
import {buildPregameTeamPlan} from '@/lib/champions/teamCompPlan';
import {humanError} from '@/lib/errors';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  const limit=rateLimit(clientKey(req,'live-champion-plan'),60,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Too many champion-plan requests. Wait a moment.'},{status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}});

  const auth=req.headers.get('authorization')??'';
  const token=/^Bearer\s+(.+)$/i.exec(auth.trim())?.[1]?.trim();
  if(!token)return NextResponse.json({ok:false,error:'Tracker token required.'},{status:401});
  const device=await authenticateTrackerToken(token);
  if(!device)return NextResponse.json({ok:false,error:'Tracker token is invalid or revoked.'},{status:401});

  try{
    const db=getSupabaseAdmin();
    if(!db)return NextResponse.json({ok:false,error:'Champion-plan service is unavailable.'},{status:503});
    const {data,error}=await db.from('live_tracker_devices').select('pregame_context,pregame_updated_at').eq('id',device.id).maybeSingle();
    if(error)throw new Error(error.message);
    const context=(data?.pregame_context??null) as any;
    const champion=String(context?.localChampionName??'').trim();
    const role=String(context?.localRole??'').trim();
    if(!Boolean(context?.localLockedIn)||!champion)return NextResponse.json({ok:true,ready:false},{status:202});

    const patch=await latestPatch();
    const roster=await championRoster(patch);
    const allyPicks=(Array.isArray(context?.allies)?context.allies:[])
      .filter((pick:any)=>String(pick?.championName??'').trim())
      .map((pick:any)=>({name:String(pick.championName),role:pick.role??null,lockedIn:Boolean(pick.lockedIn)}));
    const enemyPicks=(Array.isArray(context?.enemies)?context.enemies:[])
      .filter((pick:any)=>String(pick?.championName??'').trim())
      .map((pick:any)=>({name:String(pick.championName),role:pick.role??null,lockedIn:Boolean(pick.lockedIn)}));
    const names=[...new Set([champion,...allyPicks.map((p:any)=>p.name),...enemyPicks.map((p:any)=>p.name)])];
    const idPairs=await Promise.all(names.map(async name=>({name,id:await resolveChampionId(name,patch)})));
    const detailPairs=await Promise.all(idPairs.filter((item):item is {name:string;id:string}=>Boolean(item.id)).map(async item=>({name:item.name,detail:await championDetail(item.id,patch)})));
    const details=new Map<string,ChampionDetail>(detailPairs.map(item=>[key(item.name),item.detail]));
    const you=details.get(key(champion));
    if(!you)return NextResponse.json({ok:false,error:`No champion called "${champion}".`},{status:404});

    const plan=buildChampionPowerPlan({you,roster,patch,role});
    const teamPlan=buildPregameTeamPlan({localChampion:you.name,localRole:role,allies:allyPicks,enemies:enemyPicks,details,roster});
    return NextResponse.json({ok:true,ready:true,champion:you.name,role:plan.role,plan,teamPlan,pregameUpdatedAt:data?.pregame_updated_at??null});
  }catch(err){
    const {title,body}=humanError(err);
    return NextResponse.json({ok:false,error:`${title} ${body}`},{status:502});
  }
}

function key(value:string){return value.trim().toLowerCase().replace(/[^a-z0-9]/g,'')}
