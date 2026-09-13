import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getServerClient} from '@/lib/supabase/server';
import {saveMatches} from '@/lib/server/matchRepository';
import type {Match,Role} from '@/lib/types';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({
  champion:z.string().trim().min(1).max(40),
  result:z.enum(['WIN','LOSS']),
  kills:z.number().int().min(0).max(100),
  deaths:z.number().int().min(0).max(100),
  assists:z.number().int().min(0).max(150),
  cs:z.number().int().min(0).max(1500),
  durationSeconds:z.number().int().min(300).max(7200),
});

function roleOf(value:unknown):Role{
  const v=String(value||'ADC').toUpperCase();
  return ['TOP','JUNGLE','MID','ADC','SUPPORT'].includes(v)?v as Role:'ADC';
}

export async function POST(req:Request){
  const supabase=await getServerClient();
  if(!supabase)return NextResponse.json({ok:false,error:'Account storage is not configured.'},{status:503});

  const {data:userData,error:userError}=await supabase.auth.getUser();
  const user=userData.user;
  if(userError||!user)return NextResponse.json({ok:false,error:'Sign in again before saving a match.'},{status:401});

  let input:z.infer<typeof schema>;
  try{input=schema.parse(await req.json())}
  catch{return NextResponse.json({ok:false,error:'Check the champion, result, KDA, CS and game duration.'},{status:400})}

  const [{data:account,error:accountError},{data:profile}]=await Promise.all([
    supabase.from('riot_accounts')
      .select('id,role,rank_tier,rank_division,league_points,is_primary')
      .eq('user_id',user.id)
      .order('is_primary',{ascending:false})
      .limit(1)
      .maybeSingle(),
    supabase.from('profiles').select('rank,role').eq('id',user.id).maybeSingle(),
  ]);

  if(accountError)return NextResponse.json({ok:false,error:'We could not load your OP CLIMB player profile.'},{status:500});
  if(!account)return NextResponse.json({ok:false,error:'Finish your Riot profile before adding a match.'},{status:409});

  const externalId=`manual-${crypto.randomUUID()}`;
  const minutes=input.durationSeconds/60;
  const rank=account.rank_tier
    ?`${account.rank_tier}${account.rank_division?` ${account.rank_division}`:''}${typeof account.league_points==='number'?` · ${account.league_points} LP`:''}`
    :String(profile?.rank||'UNRANKED');

  const match:Match={
    id:externalId,
    riotAccountId:account.id,
    champion:input.champion,
    role:roleOf(account.role||profile?.role),
    result:input.result,
    kills:input.kills,
    deaths:input.deaths,
    assists:input.assists,
    durationSeconds:input.durationSeconds,
    rank,
    metrics:{
      cs:input.cs,
      csPerMin:+(input.cs/minutes).toFixed(2),
      deaths:input.deaths,
    },
    source:'manual',
    createdAt:new Date().toISOString(),
  };

  const saved=await saveMatches(user.id,[{
    match,
    unavailable:[
      'timeline','lane_cs_per_min','post15_cs_per_min','gold_diff_at_15','xp_diff_at_15',
      'death_timing','item_timings','objective_participation','fight_decision_events',
    ],
  }]);

  if(!saved.persisted){
    return NextResponse.json({ok:false,error:saved.reason||'The match could not be saved.'},{status:500});
  }

  const {data:row}=await supabase.from('matches')
    .select('id')
    .eq('user_id',user.id)
    .eq('external_match_id',externalId)
    .maybeSingle();

  return NextResponse.json({ok:true,matchId:row?.id||null,source:'manual'});
}
