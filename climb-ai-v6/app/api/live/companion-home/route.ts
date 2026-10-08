import {NextRequest,NextResponse} from 'next/server';
import {authenticateTrackerToken} from '@/lib/server/liveTrackerRepository';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {companionDnaRoleBaselines,COMPANION_DNA_BASELINE_REQUIRED} from '@/lib/server/companionDnaBaseline';
import {normalizeTier,type SubscriptionTier} from '@/lib/subscription';
import {canonicalGameDnaTasks,gameDnaStrands,gameMissionFocusPair,missionRepView} from '@/lib/gameDnaSnapshot';
import type {ILPTask,Role} from '@/lib/types';
import {ensureOneMissionPerDnaStrand} from '@/lib/dnaStrandMissions';
import {LEAGUE_ROLES} from '@/lib/roleAwareLearning';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';

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
  const primaryRole=normalizeRole(account?.role);
  const requestedRole=normalizeRole(req.nextUrl.searchParams.get('role'));
  const role=requestedRole||primaryRole;
  const rank=[String(account?.rank_tier??'').trim(),String(account?.rank_division??'').trim()].filter(Boolean).join(' ')||'UNRANKED';
  const roleBaselines=await companionDnaRoleBaselines({userId:device.userId,riotAccountId:device.riotAccountId});
  const baseline=role&&roleBaselines[role as Role]
    ?roleBaselines[role as Role]
    :{games:0,required:COMPANION_DNA_BASELINE_REQUIRED,ready:false,role:null};
  const storedTasks=((tasksResult as any).data??[])
    .map((row:any)=>({...((row?.payload&&typeof row.payload==='object')?row.payload:{}),id:String(row?.id??''),updatedAt:row?.updated_at??null}))
    .filter((task:any)=>task?.id) as Array<ILPTask&{updatedAt?:string|null}>;
  const roleKey=(role||null) as Role|null;
  const strandReady=roleKey&&account?.id
    ?ensureOneMissionPerDnaStrand(storedTasks,String(account.id),roleKey).tasks
    :storedTasks;
  const allTasks=canonicalGameDnaTasks(strandReady,roleKey);
  const focusPair=gameMissionFocusPair(allTasks,roleKey);

  const missionLimit=2;
  const missions=baseline.ready?focusPair.map(({task},index)=>missionView(task,index)):[];
  const priorityMission=missions[0]??null;
  const dna=gameDnaStrands(allTasks,roleKey,baseline.ready);
  const masteredCount=allTasks.filter(task=>String(task.status??'').toUpperCase()==='MASTERED').length;

  return NextResponse.json({
    ok:true,
    player:{
      gameName:String(account?.game_name??'PLAYER'),
      tagline:String(account?.tagline??'').replace(/^#/,''),
      role:role||'—',
      primaryRole:primaryRole||'—',
      rank,
      leaguePoints:Number(account?.league_points)||0,
    },
    tier,
    selectedRole:role||primaryRole||'ADC',
    primaryRole:primaryRole||role||'ADC',
    roleProfiles:LEAGUE_ROLES.map(item=>({...roleBaselines[item]})),
    tierView:tier==='FREE'
      ?{label:'CURRENT SNAPSHOT',detail:'2 player-unlocked DNA trees · 7-day progress view',missionLimit:2,persistentMemory:false}
      :tier==='PLUS'
        ?{label:'DEEPER DEVELOPMENT',detail:'2 player-unlocked DNA trees · 90-day progress view',missionLimit:2,persistentMemory:false}
        :{label:'PLAYER MEMORY',detail:'2 player-unlocked DNA trees · long-term learning memory',missionLimit:2,persistentMemory:true},
    baseline:{...baseline,required:COMPANION_DNA_BASELINE_REQUIRED},
    journey:baseline.ready
      ?priorityMission
        ?{phase:'MISSION',status:'DNA ACTIVE · TWO TREES UNLOCKED',title:priorityMission.title,body:'Mission 1: '+priorityMission.nextGame+(missions[1]?(' · Mission 2: '+missions[1].title):''),progress:'2 UNLOCKED TREES',cta:'PLAY NEXT GAME'}
        :{phase:'DNA_REVEAL',status:'DNA READY',title:'Your Game DNA is ready.',body:'Open My DNA to reveal your six strands and first priority mission.',progress:'3/3',cta:'REVEAL MY DNA'}
      :{phase:'BASELINE',status:'BASELINE '+Math.min(baseline.games,COMPANION_DNA_BASELINE_REQUIRED)+'/'+COMPANION_DNA_BASELINE_REQUIRED,title:baseline.games?'Play baseline game '+Math.min(baseline.games+1,COMPANION_DNA_BASELINE_REQUIRED)+'.':'Play your first baseline game.',body:'Play normally. Coaching is provisional until the three-game role baseline is complete.',progress:Math.min(baseline.games,COMPANION_DNA_BASELINE_REQUIRED)+'/'+COMPANION_DNA_BASELINE_REQUIRED,cta:'PLAY BASELINE GAME '+Math.min(baseline.games+1,COMPANION_DNA_BASELINE_REQUIRED)},
    dna,
    missions,
    priorityMission,
    masteredCount:tier==='PRO'?masteredCount:null,
    upgrade:tier==='FREE'
      ?{tier:'PLUS',copy:'Keep two DNA trees unlocked and add the 90-day development view.'}
      :tier==='PLUS'
        ?{tier:'PRO',copy:'Keep two DNA trees unlocked and add long-term player memory and mastered-habit history.'}
        :null,
  });
}

function missionView(task:ILPTask,focusIndex=0){
  const reps=missionRepView(task);
  const plain=plainLanguageFocus(task);
  return{
    id:String(task.id??''),
    title:String(plain.name||task.title||'Current mission'),
    domain:String(task.dnaDomain??'CONSISTENCY'),
    metric:String(task.metric??''),
    progress:reps.progress,
    confirmed:reps.confirmed,
    required:reps.required,
    gameRule:String(task.gameRule??'').trim(),
    nextGame:String(plain.nextGame||task.gameRule||'').trim(),
    meaning:String(plain.meaning||'').trim(),
    success:String(plain.success||task.target||'').trim(),
    target:String(task.target??'').trim(),
    status:String(task.status??'ACTIVE').toUpperCase(),
    priority:focusIndex===0,
    focusOrder:focusIndex+1,
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
