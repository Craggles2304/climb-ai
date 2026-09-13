import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getServerClient} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';

const Review=z.object({
  weakStage:z.enum(['NEVER','STAGE_2','STAGE_3','STAGE_4','STAGE_5_PLUS']).optional(),
  rollTiming:z.enum(['EARLY','ON_TIME','LATE','DID_NOT_ROLL','UNKNOWN']).optional(),
  economyChoice:z.enum(['SPENT_TO_STABILISE','HELD_FOR_ECON','FAST_LEVEL','PANIC_ROLL','UNKNOWN']).optional(),
  pivotQuality:z.enum(['FLEXED_EARLY','FLEXED_LATE','FORCED_CONTESTED','STAYED_UNCONTESTED','UNKNOWN']).optional(),
  itemChoice:z.enum(['SLAMMED_TEMPO','GREEDY_COMPONENTS','BALANCED','UNKNOWN']).optional(),
  positioningResult:z.enum(['WON_FIGHTS','NEUTRAL','LOST_FIGHTS','UNKNOWN']).optional(),
  planFollowed:z.enum(['YES','PARTIAL','NO','UNKNOWN']).optional(),
  contested:z.enum(['NONE','LIGHT','HEAVY','UNKNOWN']).optional(),
}).optional();

const Body=z.object({
  riotAccountId:z.string().uuid(),
  placement:z.number().int().min(1).max(8),
  level:z.number().int().min(1).max(10).optional(),
  lastRound:z.number().int().min(1).max(50).optional(),
  goldLeft:z.number().int().min(0).max(200).optional(),
  playersEliminated:z.number().int().min(0).max(7).optional(),
  totalDamageToPlayers:z.number().int().min(0).max(1000).optional(),
  compSignature:z.string().trim().min(1).max(120),
  augments:z.array(z.string().trim().min(1).max(80)).max(3).default([]),
  units:z.array(z.object({name:z.string().trim().min(1).max(80),tier:z.number().int().min(1).max(4).optional(),itemNames:z.array(z.string().trim().min(1).max(80)).max(3).default([])})).max(12).default([]),
  note:z.string().trim().max(500).optional(),
  review:Review,
  playedAt:z.string().datetime().optional(),
});

export async function POST(req:Request){
  const supabase=await getServerClient();
  if(!supabase)return NextResponse.json({error:'Authentication is not configured.'},{status:503});
  const {data:userData,error:userError}=await supabase.auth.getUser();
  if(userError||!userData.user)return NextResponse.json({error:'Sign in to log a TFT game.'},{status:401});

  let parsed:z.infer<typeof Body>;
  try{parsed=Body.parse(await req.json())}catch(err){return NextResponse.json({error:err instanceof Error?err.message:'Invalid TFT game.'},{status:400})}

  const {data:account,error:accountError}=await supabase.from('riot_accounts').select('id').eq('id',parsed.riotAccountId).eq('user_id',userData.user.id).maybeSingle();
  if(accountError||!account)return NextResponse.json({error:'That Riot account is not linked to this user.'},{status:403});

  const db=getSupabaseAdmin();
  if(!db)return NextResponse.json({error:'Database persistence is unavailable.'},{status:503});
  const externalMatchId=`manual-tft-${crypto.randomUUID()}`;
  const playedAt=parsed.playedAt||new Date().toISOString();
  const {data,error}=await db.from('tft_matches').insert({
    user_id:userData.user.id,
    riot_account_id:parsed.riotAccountId,
    external_match_id:externalMatchId,
    game_datetime:playedAt,
    placement:parsed.placement,
    level:parsed.level??null,
    last_round:parsed.lastRound??null,
    players_eliminated:parsed.playersEliminated??null,
    total_damage_to_players:parsed.totalDamageToPlayers??null,
    gold_left:parsed.goldLeft??null,
    augments:parsed.augments,
    traits:[],
    units:parsed.units.map(u=>({character_id:u.name,name:u.name,tier:u.tier,itemNames:u.itemNames})),
    comp_signature:parsed.compSignature,
    raw:{source:'manual',note:parsed.note||null,decisionReview:parsed.review||null},
  }).select('id,external_match_id').single();
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true,id:data.id,externalMatchId:data.external_match_id});
}
