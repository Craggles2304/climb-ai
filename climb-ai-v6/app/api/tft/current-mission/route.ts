import {NextRequest,NextResponse} from 'next/server';
import {getServerClient} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {authenticateTrackerToken} from '@/lib/server/liveTrackerRepository';
import {buildTacticianProfile,type TftSkillKey} from '@/lib/tft/advancedCoach';
import type {TftDecisionReview,TftMatch} from '@/lib/tft/types';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const cues:Record<TftSkillKey,[string,string]>={
  ECONOMY:['Plan each spend before committing gold.','Review whether your economy supported your stabilisation.'],
  TEMPO:['Identify when your board needs to stabilise.','Compare the planned roll/level window with the result.'],
  FLEXIBILITY:['Keep a second viable line open.','Review whether contested units changed the plan.'],
  POSITIONING:['Identify what your frontline protects.','Review your final meaningful fights after the game.'],
  CONVERSION:['Recognise the upgrade that raises your final cap.','Review what separated a top-four from a top-two finish.'],
};
const baseline={
  id:'tft-baseline',
  status:'BASELINE' as const,
  domain:'BASELINE',
  title:'BUILD YOUR TFT DNA',
  why:'Your account needs more observable decisions before a reliable priority can be assigned.',
  nextGame:'Play normally with the Companion connected. Review your decisions after the game.',
  success:'Collect enough decision evidence to unlock your first personalised mission.',
  cues:['Play your normal game.','Review decisions after the match, not during it.'],
  progress:0,
  goal:3,
  evidenceCount:0,
  evidenceLabel:'NOT ENOUGH EVIDENCE',
};
function match(row:any):TftMatch{
  const raw=row.raw&&typeof row.raw==='object'?row.raw:{};
  return {
    id:String(row.external_match_id||''),
    riotAccountId:String(row.riot_account_id||''),
    playedAt:String(row.game_datetime||row.created_at||''),
    gameLengthSeconds:Number(row.game_length_seconds||0),
    gameVersion:String(row.game_version||''),
    placement:Number(row.placement||8),
    level:row.level??undefined,
    lastRound:row.last_round??undefined,
    goldLeft:row.gold_left??undefined,
    playersEliminated:row.players_eliminated??undefined,
    totalDamageToPlayers:row.total_damage_to_players??undefined,
    augments:Array.isArray(row.augments)?row.augments:[],
    traits:Array.isArray(row.traits)?row.traits:[],
    units:Array.isArray(row.units)?row.units:[],
    compSignature:String(row.comp_signature||'UNRESOLVED COMP'),
    decisionReview:raw.decisionReview as TftDecisionReview|undefined,
  };
}

export async function GET(req:NextRequest){
  const authorization=req.headers.get('authorization')||'';
  const token=/^Bearer\s+(.+)$/i.exec(authorization.trim())?.[1]?.trim();
  let userId:string;
  let accountId:string|null=null;
  if(token){
    // Paired device tokens may only inspect the Riot account they are bound to.
    const device=await authenticateTrackerToken(token);
    if(!device)return NextResponse.json({ok:false,error:'Invalid or revoked Companion pairing.'},{status:401});
    userId=device.userId;
    accountId=device.riotAccountId;
  }else{
    const client=await getServerClient();
    if(!client)return NextResponse.json({ok:false,error:'Authentication unavailable.'},{status:503});
    const {data,error}=await client.auth.getUser();
    if(error||!data.user)return NextResponse.json({ok:false,error:'Sign in to view your TFT mission.'},{status:401});
    userId=data.user.id;
    accountId=req.nextUrl.searchParams.get('riotAccountId');
  }
  if(!accountId||!/^[-\da-f]{36}$/i.test(accountId))return NextResponse.json({ok:false,error:'Select a linked Riot account.'},{status:400});
  const db=getSupabaseAdmin();
  if(!db)return NextResponse.json({ok:false,error:'Mission storage unavailable.'},{status:503});
  const {data:account,error:accountError}=await db.from('riot_accounts').select('id').eq('user_id',userId).eq('id',accountId).maybeSingle();
  if(accountError)return NextResponse.json({ok:false,error:'Could not verify account ownership.'},{status:503});
  if(!account)return NextResponse.json({ok:false,error:'Riot account does not belong to this player.'},{status:403});
  const {data:rows,error:matchError}=await db.from('tft_matches')
    .select('external_match_id,riot_account_id,game_datetime,created_at,game_length_seconds,game_version,placement,level,last_round,gold_left,players_eliminated,total_damage_to_players,augments,traits,units,comp_signature,raw')
    .eq('user_id',userId).eq('riot_account_id',accountId)
    .order('game_datetime',{ascending:false}).limit(20);
  if(matchError)return NextResponse.json({ok:false,error:'Could not load TFT decision evidence.'},{status:503});
  const profile=buildTacticianProfile((rows||[]).map(match));
  const eligible=profile.ilp.filter(item=>(profile.skills.find(skill=>skill.key===item.skill)?.confidence||0)>=35);
  // Advance after evidence completes the current task, rather than reselecting a completed task.
  const task=eligible.find(item=>item.progress<item.goal)||eligible[0]||null;
  const leak=task?profile.skills.find(skill=>skill.key===task.skill):null;
  // Progress comes from existing match/review evidence, never invented from stage telemetry.
  const mission=task&&leak?{
    id:task.id,
    status:task.progress>=task.goal?'MASTERED' as const:'ACTIVE' as const,
    domain:task.skill,
    title:task.title,
    why:task.why,
    nextGame:task.target,
    success:task.target,
    cues:cues[task.skill],
    progress:task.progress,
    goal:task.goal,
    evidenceCount:leak.evidenceCount,
    evidenceLabel:'MODEL-DERIVED INDICATORS',
  }: {...baseline,progress:Math.min((rows||[]).length,3)};
  return NextResponse.json({ok:true,riotAccountId:accountId,mission,updatedAt:new Date().toISOString()},{
    headers:{'Cache-Control':'private, no-store'},
  });
}
