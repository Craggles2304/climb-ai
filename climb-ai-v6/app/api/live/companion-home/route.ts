import {NextRequest,NextResponse} from 'next/server';
import {authenticateTrackerToken} from '@/lib/server/liveTrackerRepository';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {companionDnaBaseline,COMPANION_DNA_BASELINE_REQUIRED} from '@/lib/server/companionDnaBaseline';
import {DNA_DOMAINS,DNA_DOMAIN_COLORS,DNA_DOMAIN_LABELS} from '@/lib/dnaDomain';
import {normalizeTier,type SubscriptionTier} from '@/lib/subscription';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  const token=bearerToken(req);
  if(!token)return NextResponse.json({ok:false,error:'Tracker token required.'},{status:401});

  const device=await authenticateTrackerToken(token);
  if(!device)return NextResponse.json({ok:false,error:'Tracker token is invalid or revoked.'},{status:401});

  const db=getSupabaseAdmin();
  if(!db)return NextResponse.json({ok:false,error:'Player overview storage unavailable.'},{status:503});

  const [accountResult,tasksResult,tier]=await Promise.all([
    device.riotAccountId
      ?db.from('riot_accounts').select('id,game_name,tagline,role,rank_tier,rank_division,league_points').eq('user_id',device.userId).eq('id',device.riotAccountId).maybeSingle()
      :Promise.resolve({data:null,error:null}),
    device.riotAccountId
      ?db.from('ilp_tasks').select('id,payload,updated_at').eq('user_id',device.userId).eq('riot_account_id',device.riotAccountId).order('updated_at',{ascending:false}).limit(80)
      :Promise.resolve({data:[],error:null}),
    resolveTier(db,device.userId),
  ]);

  if((accountResult as any).error)return NextResponse.json({ok:false,error:'Could not load Riot account.'},{status:503});
  if((tasksResult as any).error)return NextResponse.json({ok:false,error:'Could not load current missions.'},{status:503});

  const account=(accountResult as any).data??null;
  const role=normalizeRole(account?.role);
  const rank=[String(account?.rank_tier??'').trim(),String(account?.rank_division??'').trim()].filter(Boolean).join(' ')||'UNRANKED';
  const baseline=await companionDnaBaseline({userId:device.userId,riotAccountId:device.riotAccountId,role});
  const allTasks=((tasksResult as any).data??[])
    .map((row:any)=>({...((row?.payload&&typeof row.payload==='object')?row.payload:{}),id:String(row?.id??''),updatedAt:row?.updated_at??null}))
    .filter((task:any)=>task?.id);

  const live=allTasks
    .filter((task:any)=>!['MASTERED','PAUSED'].includes(String(task?.status??'ACTIVE').toUpperCase()))
    .sort((a:any,b:any)=>(Number(b?.priority)||50)-(Number(a?.priority)||50)||(Number(a?.progress)||0)-(Number(b?.progress)||0));

  const missionLimit=tier==='FREE'?1:3;
  const missions=baseline.ready?live.slice(0,missionLimit).map((task:any)=>missionView(task)):[];

  const dna=DNA_DOMAINS.map(domain=>{
    const related=allTasks.filter((task:any)=>String(task?.dnaDomain||'')===domain);
    const progress=!baseline.ready||!related.length?0:Math.round(related.reduce((sum:number,task:any)=>{
      const status=String(task?.status??'ACTIVE').toUpperCase();
      return sum+(status==='MASTERED'?100:Math.max(0,Math.min(100,Number(task?.progress)||0)));
    },0)/related.length);
    const activeCount=live.filter((task:any)=>String(task?.dnaDomain||'')===domain).length;
    const mastered=allTasks.filter((task:any)=>String(task?.dnaDomain||'')===domain&&String(task?.status??'').toUpperCase()==='MASTERED').length;
    return{domain,label:DNA_DOMAIN_LABELS[domain],color:DNA_DOMAIN_COLORS[domain],progress,activeCount,mastered};
  });

  const masteredCount=allTasks.filter((task:any)=>String(task?.status??'').toUpperCase()==='MASTERED').length;

  return NextResponse.json({
    ok:true,
    player:{
      gameName:String(account?.game_name??'PLAYER'),
      tagline:String(account?.tagline??'').replace(/^#/,''),
      role:role||'—',
      rank,
      leaguePoints:Number(account?.league_points)||0,
    },
    tier,
    tierView:tier==='FREE'
      ?{label:'CURRENT SNAPSHOT',detail:'1 active mission · 7-day progress view',missionLimit:1,persistentMemory:false}
      :tier==='PLUS'
        ?{label:'DEEPER DEVELOPMENT',detail:'Up to 3 active missions · 90-day progress view',missionLimit:3,persistentMemory:false}
        :{label:'PLAYER MEMORY',detail:'Up to 3 active missions · long-term learning memory',missionLimit:3,persistentMemory:true},
    baseline:{...baseline,required:COMPANION_DNA_BASELINE_REQUIRED},
    dna,
    missions,
    masteredCount:tier==='PRO'?masteredCount:null,
    upgrade:tier==='FREE'
      ?{tier:'PLUS',copy:'Unlock up to 3 active missions and a 90-day development view.'}
      :tier==='PLUS'
        ?{tier:'PRO',copy:'Unlock long-term player memory, mastered habits and deeper learning history.'}
        :null,
  });
}

function missionView(task:any){
  const history=Array.isArray(task?.missionHistory)?task.missionHistory:[];
  const confirmed=history.filter((item:any)=>Boolean(item?.banksPass)).length;
  const required=Math.max(1,Number(task?.masteryRequired)||3);
  return{
    id:String(task?.id??''),
    title:String(task?.title??'Current mission'),
    domain:String(task?.dnaDomain??'CONSISTENCY'),
    progress:Math.max(0,Math.min(100,Math.round(Number(task?.progress)||0))),
    confirmed,
    required,
    gameRule:String(task?.gameRule??'').trim(),
    target:String(task?.target??'').trim(),
    status:String(task?.status??'ACTIVE').toUpperCase(),
  };
}

async function resolveTier(db:any,userId:string):Promise<SubscriptionTier>{
  const [profileResult,entitlementResult,userResult]=await Promise.all([
    db.from('profiles').select('is_founder').eq('id',userId).maybeSingle(),
    db.from('product_entitlements').select('tier,status,current_period_end').eq('user_id',userId).eq('product','LOL').maybeSingle(),
    db.auth.admin.getUserById(userId),
  ]);
  if(profileResult?.data?.is_founder===true)return'PRO';
  const entitlement=entitlementResult?.data as any;
  const status=String(entitlement?.status??'').toLowerCase();
  const periodEnd=entitlement?.current_period_end?new Date(entitlement.current_period_end).getTime():Number.POSITIVE_INFINITY;
  const live=['active','trialing'].includes(status)&&(!Number.isFinite(periodEnd)||periodEnd>Date.now());
  if(live)return normalizeTier(entitlement?.tier);
  return normalizeTier(userResult?.data?.user?.app_metadata?.subscription_tier);
}

function normalizeRole(value:unknown){
  const role=String(value??'').trim().toUpperCase();
  if(role==='BOTTOM')return'ADC';
  if(role==='UTILITY')return'SUPPORT';
  if(role==='MIDDLE')return'MID';
  return ['TOP','JUNGLE','MID','ADC','SUPPORT'].includes(role)?role:'';
}

function bearerToken(req:NextRequest){
  const value=req.headers.get('authorization')??'';
  return /^Bearer\s+(.+)$/i.exec(value.trim())?.[1]?.trim()||null;
}
