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
import {coachingLevelFor} from '@/lib/coachingLevel';
import {buildLiveMissionTips,nextRankTier,type LiveMissionTask} from '@/lib/liveMissionCoach';
import {hasTier,normalizeTier,type SubscriptionTier} from '@/lib/subscription';

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

    const [patch,playerRank,missionTasks,strategyAccess]=await Promise.all([
      latestPatch(),
      resolvePlayerRank(db,device),
      loadMissionTasks(db,device),
      resolveStrategyAccess(db,device.userId),
    ]);
    const coach=coachingLevelFor(playerRank);
    // Mission guidance is intentionally frozen to pre-game player context. The
    // endpoint can recover the briefing after match start, but it must not turn
    // current telemetry into new tactical calls while the game is being played.
    const missionTips=buildLiveMissionTips({
      tasks:missionTasks,
      snapshot:null,
      history:null,
      currentTier:coach.tier,
      depth:coach.depth,
    });
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

    const rawPlan=buildChampionPowerPlan({you,roster,patch,role});
    const plan=adaptPlanForRank(rawPlan,coach.depth,coach.visiblePoints);
    const fullTeamBase=buildPregameTeamPlan({localChampion:you.name,localRole:role,allies:allyPicks,enemies:enemyPicks,details,roster});
    // Win/loss conditions and the five-part role read are paid match-reading
    // features. Keep this gate on the server so FREE clients never receive the
    // hidden strategic payload merely by inspecting Companion state.
    const teamBase=strategyAccess.paidStrategy
      ?fullTeamBase
      :{...fullTeamBase,ourWinCondition:null,roleWinCondition:null,theirWinCondition:null,biggestThrow:null};
    const botLane=buildPregameBotLanePlan({localChampion:you.name,localRole:role,allies:allyPicks,enemies:enemyPicks,details,roster})
      ??pendingBotLanePlan({localChampion:you.name,localRole:role,allies:allyPicks,enemies:enemyPicks});
    const coachLevel={rank:playerRank,tier:coach.tier,nextTier:nextRankTier(coach.tier),depth:coach.depth,visiblePoints:coach.visiblePoints,reviewPoints:coach.reviewPoints,summary:coach.summary};
    const teamPlan={...teamBase,botLane:adaptBotLaneForRank(botLane,coach.depth),coachLevel,missionTips,strategyAccess};
    return NextResponse.json({ok:true,ready:true,champion:you.name,role:plan.role,plan,teamPlan,coachLevel,missionTips,strategyAccess,live:trackerState==='RECORDING',liveSnapshotAt:null,pregameUpdatedAt:recoveredAt??data?.pregame_updated_at??null,recoveredFromEndedPregame});
  }catch(err){
    const {title,body}=humanError(err);
    return NextResponse.json({ok:false,error:`${title} ${body}`},{status:502});
  }
}

async function resolveStrategyAccess(db:any,userId:string):Promise<{tier:SubscriptionTier;paidStrategy:boolean;trialing:boolean;trialAvailable:boolean}>{
  const [profileResult,entitlementResult,userResult]=await Promise.all([
    db.from('profiles').select('is_founder').eq('id',userId).maybeSingle(),
    db.from('product_entitlements').select('tier,status,current_period_end').eq('user_id',userId).eq('product','LOL').maybeSingle(),
    db.auth.admin.getUserById(userId),
  ]);
  if(profileResult?.data?.is_founder===true)return{tier:'PRO',paidStrategy:true,trialing:false,trialAvailable:false};

  const entitlement=entitlementResult?.data as any;
  const status=String(entitlement?.status??'').toLowerCase();
  const periodEnd=entitlement?.current_period_end?new Date(entitlement.current_period_end).getTime():Number.POSITIVE_INFINITY;
  const entitlementLive=['active','trialing'].includes(status)&&(!Number.isFinite(periodEnd)||periodEnd>Date.now());
  const legacyTier=normalizeTier(userResult?.data?.user?.app_metadata?.subscription_tier);
  const tier=entitlementLive?normalizeTier(entitlement?.tier):legacyTier;
  const paidStrategy=hasTier(tier,'PLUS');
  return{
    tier,
    paidStrategy,
    trialing:paidStrategy&&status==='trialing',
    trialAvailable:!paidStrategy&&!entitlement,
  };
}

async function loadMissionTasks(db:any,device:{userId:string;riotAccountId:string|null}):Promise<LiveMissionTask[]>{
  if(!device.riotAccountId)return[];
  const {data,error}=await db.from('ilp_tasks')
    .select('id,payload,updated_at')
    .eq('user_id',device.userId)
    .eq('riot_account_id',device.riotAccountId)
    .order('updated_at',{ascending:false})
    .limit(20);
  if(error)throw new Error(error.message);
  return (data??[])
    .map((row:any)=>({...((row?.payload&&typeof row.payload==='object')?row.payload:{}),id:String(row?.id??'')}))
    .filter((task:any)=>{
      const status=String(task?.status??'ACTIVE').toUpperCase();
      return status!=='MASTERED'&&status!=='PAUSED'&&String(task?.gameRule??'').trim();
    })
    .sort((a:any,b:any)=>{
      const priority=(Number(b?.priority)||50)-(Number(a?.priority)||50);
      if(priority!==0)return priority;
      return (Number(a?.progress)||0)-(Number(b?.progress)||0;
    })
    .slice(0,3);
}

async function resolvePlayerRank(db:any,device:{userId:string;riotAccountId:string|null}){
  const profilePromise=db.from('profiles').select('rank').eq('id',device.userId).maybeSingle();
  const riotPromise=device.riotAccountId
    ?db.from('riot_accounts').select('rank_tier,rank_division').eq('id',device.riotAccountId).maybeSingle()
    :Promise.resolve({data:null,error:null});
  const [profileResult,riotResult]=await Promise.all([profilePromise,riotPromise]);
  const tier=String(riotResult?.data?.rank_tier??'').trim();
  const division=String(riotResult?.data?.rank_division??'').trim();
  if(tier)return`${tier}${division?` ${division}`:''}`;
  return String(profileResult?.data?.rank||'Silver');
}

function adaptPlanForRank(plan:any,depth:number,visiblePoints:number){
  const list=(value:any,minimum=1)=>Array.isArray(value)?value.slice(0,Math.max(minimum,visiblePoints)):value;
  const trim=(value:any)=>shortForDepth(value,depth);
  const spikes=Array.isArray(plan?.powerSpikes)?(depth<=2?plan.powerSpikes.filter((s:any)=>[2,6].includes(Number(s?.level))).slice(0,2):depth<=4?plan.powerSpikes.slice(0,3):plan.powerSpikes):plan?.powerSpikes;
  return{
    ...plan,
    laneEdge:plan?.laneEdge?{...plan.laneEdge,summary:trim(plan.laneEdge.summary)}:plan?.laneEdge,
    rules:list(plan?.rules),
    winCondition:list(plan?.winCondition),
    powerSpikes:spikes,
    leadPlan:plan?.leadPlan?{...plan.leadPlan,create:list(plan.leadPlan.create),convert:list(plan.leadPlan.convert),protect:list(plan.leadPlan.protect)}:plan?.leadPlan,
    trades:plan?.trades?{...plan.trades,safe:list(plan.trades.safe),pressure:list(plan.trades.pressure),avoid:list(plan.trades.avoid)}:plan?.trades,
    itemPlan:plan?.itemPlan?{...plan.itemPlan,ahead:list(plan.itemPlan.ahead),even:list(plan.itemPlan.even),behind:list(plan.itemPlan.behind)}:plan?.itemPlan,
    states:plan?.states?{...plan.states,ahead:list(plan.states.ahead),even:list(plan.states.even),behind:list(plan.states.behind)}:plan?.states,
  };
}

function adaptBotLaneForRank(bot:any,depth:number){
  if(!bot)return bot;
  const trim=(value:any)=>shortForDepth(value,depth);
  return{
    ...bot,
    laneCall:bot.laneCall?{...bot.laneCall,summary:trim(bot.laneCall.summary)}:bot.laneCall,
    level2:bot.level2?{...bot.level2,summary:trim(bot.level2.summary)}:bot.level2,
    trade:bot.trade?{...bot.trade,summary:trim(bot.trade.summary)}:bot.trade,
    wave:bot.wave?{...bot.wave,summary:trim(bot.wave.summary)}:bot.wave,
    allIn:bot.allIn?{...bot.allIn,summary:trim(bot.allIn.summary)}:bot.allIn,
    danger:bot.danger?{...bot.danger,summary:trim(bot.danger.summary)}:bot.danger,
    focus:trim(bot.focus),supportRoam:trim(bot.supportRoam),note:trim(bot.note),
  };
}

function shortForDepth(value:any,depth:number){
  const text=String(value??'').replace(/\s+/g,' ').trim();
  if(!text)return text;
  const limits=[0,95,125,165,210,260,320,390,470,560,680];
  const max=limits[Math.max(1,Math.min(10,depth))]||320;
  if(text.length<=max)return text;
  return`${text.slice(0,max-1).replace(/\s+\S*$/,'')}…`;
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
