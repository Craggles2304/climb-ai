import {NextRequest,NextResponse} from 'next/server';
import type {ChampionDetail} from '@/lib/champions/ddragon';
import {authenticateTrackerToken} from '@/lib/server/liveTrackerRepository';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {latestPatch,championRoster,resolveChampionId,championDetail} from '@/lib/champions/source';
import {buildChampionPowerPlan} from '@/lib/champions/championPowerPlan';
import {buildPregameTeamPlan} from '@/lib/champions/teamCompPlan';
import {buildPregameBotLanePlan} from '@/lib/champions/botLanePregame';
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
    const {data,error}=await db.from('live_tracker_devices').select('pregame_context,pregame_updated_at,tracker_status').eq('id',device.id).maybeSingle();
    if(error)throw new Error(error.message);
    let context=(data?.pregame_context??null) as any;
    let recoveredFromEndedPregame=false;
    let recoveredAt:string|null=null;
    const trackerState=String((data?.tracker_status as any)?.state??'').trim().toUpperCase();
    if(!context&&trackerState==='RECORDING'){
      const {data:recent,error:recentError}=await db.from('live_pregame_contexts').select('context,ended_at,last_seen_at').eq('device_id',device.id).not('ended_at','is',null).order('ended_at',{ascending:false}).limit(1).maybeSingle();
      if(recentError)throw new Error(recentError.message);
      const endedAt=recent?.ended_at?new Date(recent.ended_at).getTime():NaN;
      const age=Number.isFinite(endedAt)?Date.now()-endedAt:Number.POSITIVE_INFINITY;
      if(recent?.context&&age>=0&&age<=90*60_000){
        context=recent.context as any;
        recoveredFromEndedPregame=true;
        recoveredAt=recent.ended_at??recent.last_seen_at??null;
      }
    }
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
    const teamBase=buildPregameTeamPlan({localChampion:you.name,localRole:role,allies:allyPicks,enemies:enemyPicks,details,roster});
    const botLane=buildPregameBotLanePlan({localChampion:you.name,localRole:role,allies:allyPicks,enemies:enemyPicks,details,roster})
      ??pendingBotLanePlan({localChampion:you.name,localRole:role,allies:allyPicks,enemies:enemyPicks});
    const teamPlan={...teamBase,botLane};
    return NextResponse.json({ok:true,ready:true,champion:you.name,role:plan.role,plan,teamPlan,pregameUpdatedAt:recoveredAt??data?.pregame_updated_at??null,recoveredFromEndedPregame});
  }catch(err){
    const {title,body}=humanError(err);
    return NextResponse.json({ok:false,error:`${title} ${body}`},{status:502});
  }
}

function pendingBotLanePlan(input:{localChampion:string;localRole?:string|null;allies:{name:string;role?:string|null}[];enemies:{name:string;role?:string|null}[]}){
  const localRole=normalizeRole(input.localRole);
  if(localRole!=='ADC'&&localRole!=='SUPPORT')return null;
  const ally=(role:string)=>input.allies.find(p=>normalizeRole(p.role)===role)?.name||null;
  const enemy=(role:string)=>input.enemies.find(p=>normalizeRole(p.role)===role)?.name||null;
  const yourAdc=localRole==='ADC'?input.localChampion:(ally('ADC')||'PENDING');
  const yourSupport=localRole==='SUPPORT'?input.localChampion:(ally('SUPPORT')||'PENDING');
  const enemyAdc=enemy('ADC')||'PENDING';
  const enemySupport=enemy('SUPPORT')||'PENDING';
  const known=[yourAdc,yourSupport,enemyAdc,enemySupport].filter(name=>name!=='PENDING').length;
  const waiting=[yourAdc==='PENDING'?'your ADC':null,yourSupport==='PENDING'?'your support':null,enemyAdc==='PENDING'?'enemy ADC':null,enemySupport==='PENDING'?'enemy support':null].filter(Boolean).join(' + ');
  const waitingText=waiting||'the remaining bot-lane roles';
  return{
    version:1,
    pending:true,
    confidence:'MEDIUM',
    yourAdc,yourSupport,enemyAdc,enemySupport,
    ourIdentity:'DUO FORMING',theirIdentity:'DUO FORMING',rangeDelta:0,
    laneCall:{label:'BUILDING THE 2V2 READ',summary:`${known}/4 bot-lane roles are resolved. OP CLIMB is waiting for ${waitingText} before giving the full four-champion lane call.`},
    level2:{label:'HOLD THE LEVEL-2 CALL',summary:'Track the first level-up normally, but wait for the full duo read before treating the level-2 edge as confirmed.'},
    trade:{label:'USE YOUR CHAMPION PLAN',summary:'Use the individual matchup and your support spacing until all four bot-lane champions are identified.'},
    wave:{label:'KEEP THE WAVE PLAYABLE',summary:'Avoid committing the wave to an aggressive 2v2 plan until the enemy support/ADC pairing is resolved.'},
    allIn:{label:'DO NOT FORCE THE UNKNOWN',summary:'Create HP, cooldown or wave advantage first. The full all-in trigger appears as soon as all four bot-lane roles resolve.'},
    danger:{label:'2V2 INTELLIGENCE FORMING',summary:'The enemy duo win condition will populate automatically when OP CLIMB resolves both bot-lane opponents.'},
    supportRoam:'Support-roam guidance will appear with the completed bot-lane read.',
    focus:'Focus guidance will appear with the completed four-champion read.',
    note:`Bot-lane desk is live now; ${known}/4 roles resolved. It will upgrade automatically as champ select reveals enough information.`,
  };
}
function normalizeRole(value?:string|null){const role=String(value??'').trim().toUpperCase();if(role==='BOTTOM')return'ADC';if(role==='UTILITY')return'SUPPORT';if(role==='MIDDLE')return'MID';return role}
function key(value:string){return value.trim().toLowerCase().replace(/[^a-z0-9]/g,'')}
