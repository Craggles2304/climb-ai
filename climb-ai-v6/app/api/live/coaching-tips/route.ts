import {NextRequest,NextResponse} from 'next/server';
import {authenticateTrackerToken} from '@/lib/server/liveTrackerRepository';
import {latestLiveRead} from '@/lib/server/liveReadRepository';
import {getProLearningProfile} from '@/lib/server/proLearningRepository';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {coachingLevelFor} from '@/lib/coachingLevel';
import {buildLiveMissionTips,nextRankTier,type LiveMissionTask} from '@/lib/liveMissionCoach';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  const limit=rateLimit(clientKey(req,'live-coaching-tips'),20,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Live Coach is updating too quickly. Wait a moment.'},{status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}});

  const auth=req.headers.get('authorization')??'';
  const token=/^Bearer\s+(.+)$/i.exec(auth.trim())?.[1]?.trim();
  if(!token)return NextResponse.json({ok:false,error:'Tracker token required.'},{status:401});
  const device=await authenticateTrackerToken(token);
  if(!device)return NextResponse.json({ok:false,error:'Tracker token is invalid or revoked.'},{status:401});

  const db=getSupabaseAdmin();
  if(!db)return NextResponse.json({ok:false,error:'Live Coach storage is unavailable.'},{status:503});

  try{
    const [playerRank,tasks,liveRead,history]=await Promise.all([
      resolvePlayerRank(db,device),
      loadMissionTasks(db,device),
      latestLiveRead(device.userId,device.accountKey).catch(()=>null),
      getProLearningProfile(device.userId,device.riotAccountId).catch(()=>null),
    ]);
    const coach=coachingLevelFor(playerRank);
    const tips=buildLiveMissionTips({tasks,snapshot:liveRead?.latestSnapshot??null,history,currentTier:coach.tier,depth:coach.depth});
    return NextResponse.json({
      ok:true,
      ready:tips.length>0,
      live:Boolean(liveRead?.latestSnapshot),
      tips,
      coachLevel:{rank:playerRank,tier:coach.tier,nextTier:nextRankTier(coach.tier),depth:coach.depth,visiblePoints:coach.visiblePoints,reviewPoints:coach.reviewPoints,summary:coach.summary},
      sessionId:liveRead?.sessionId??null,
      snapshotAt:liveRead?.latestSnapshot?.receivedAt??null,
      snapshotCount:liveRead?.snapshotCount??0,
      gamesAnalyzed:history?.gamesAnalyzed??0,
    });
  }catch(err){
    console.error('[live-coaching-tips] failed',err);
    return NextResponse.json({ok:false,error:'Live Coach could not update right now.'},{status:502});
  }
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
  return(data??[])
    .map((row:any)=>({...((row?.payload&&typeof row.payload==='object')?row.payload:{}),id:String(row?.id??'')}))
    .filter((task:any)=>{
      const status=String(task?.status??'ACTIVE').toUpperCase();
      return status!=='MASTERED'&&status!=='PAUSED'&&String(task?.gameRule??'').trim();
    })
    .sort((a:any,b:any)=>{
      const priority=(Number(b?.priority)||50)-(Number(a?.priority)||50);
      if(priority!==0)return priority;
      return(Number(a?.progress)||0)-(Number(b?.progress)||0);
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
