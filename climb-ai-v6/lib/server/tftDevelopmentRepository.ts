import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {getSupabaseAdmin} from './supabaseAdmin';
import {buildTftDevelopment,type TftRecordedReview} from '@/lib/tft/development';
import type {TftMatch} from '@/lib/tft/types';
import type {TftTelemetryPoint} from '@/lib/tft/timeline';
import type {z} from 'zod';
import {tftSessionReviewSchema} from '@/lib/tft/reviewSchema';

export async function loadTftDevelopment(userId:string,accountId:string,client?:SupabaseClient){
  const db=client??getSupabaseAdmin();
  if(!db)throw new Error('TFT development storage unavailable.');
  const account=await db.from('riot_accounts').select('id').eq('user_id',userId).eq('id',accountId).maybeSingle();
  if(account.error)throw new Error('Could not verify TFT account.');
  if(!account.data)throw new Error('TFT_ACCOUNT_NOT_OWNED');
  const [history,sessions]=await Promise.all([
    db.from('tft_matches').select('*').eq('user_id',userId).eq('riot_account_id',accountId).order('game_datetime',{ascending:false}).limit(20),
    db.from('tft_telemetry_sessions').select('id,pseudo_match_id,started_at,metadata,summary').eq('user_id',userId).eq('riot_account_id',accountId).eq('status','COMPLETE').order('started_at',{ascending:false}).limit(20),
  ]);
  if(history.error||sessions.error)throw new Error('Could not load TFT development evidence.');
  const matches:TftMatch[]=(history.data??[]).map(row=>({
    id:row.external_match_id,riotAccountId:row.riot_account_id,playedAt:row.game_datetime,
    gameLengthSeconds:row.game_length_seconds??0,gameVersion:row.game_version??'',placement:row.placement,
    level:row.level??undefined,goldLeft:row.gold_left??undefined,lastRound:row.last_round??undefined,
    augments:row.augments??[],traits:row.traits??[],units:row.units??[],compSignature:row.comp_signature??'',
    decisionReview:row.raw?.decisionReview??undefined,planSnapshot:row.raw?.planSnapshot??undefined,
  }));
  const sessionRows=sessions.data??[];
  const bySession=new Map<string,TftTelemetryPoint[]>();
  // PostgREST caps responses at 1,000 rows. Page explicitly rather than silently
  // dropping recent sessions from a multi-game evidence read.
  if(sessionRows.length)for(let offset=0;offset<20000;offset+=1000){
    const page=await db.from('tft_telemetry_points')
      .select('session_id,observed_at,round,gold,level,xp,hp,placement,shop_refreshes,purchases,board_power,board_units,completed_items')
      .in('session_id',sessionRows.map(s=>s.id)).order('observed_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+999);
    if(page.error)throw new Error('Could not load recorded TFT decisions.');
    for(const p of page.data??[]){
      const point:TftTelemetryPoint={at:p.observed_at,round:p.round,gold:p.gold??undefined,level:p.level??undefined,
        xp:p.xp??undefined,hp:p.hp??undefined,placement:p.placement??undefined,shopRefreshes:p.shop_refreshes??undefined,
        purchases:p.purchases??undefined,boardPower:p.board_power??undefined,boardUnits:p.board_units??undefined,completedItems:p.completed_items??undefined};
      bySession.set(p.session_id,[...(bySession.get(p.session_id)??[]),point]);
    }
    if((page.data?.length??0)<1000)break;
    if(offset===19000)throw new Error('TFT evidence window is too large to grade completely.');
  }
  const recordings:TftRecordedReview[]=sessionRows.map(session=>({id:session.id,matchId:session.pseudo_match_id,startedAt:session.started_at,
    mission:session.metadata?.developmentMission??null,assessments:session.summary?.assessments??undefined,
    points:bySession.get(session.id)??[],
  }));
  return{accountId,matches,...buildTftDevelopment(matches,recordings)};
}

export async function saveTftSessionReview(userId:string,input:z.infer<typeof tftSessionReviewSchema>,client?:SupabaseClient){
  const db=client??getSupabaseAdmin();if(!db)throw new Error('TFT storage unavailable.');
  const {data:session,error}=await db.from('tft_telemetry_sessions').select('id,summary,updated_at')
    .eq('id',input.sessionId).eq('user_id',userId).eq('status','COMPLETE').maybeSingle();
  if(error)throw new Error('Could not load TFT review.');
  if(!session)throw new Error('TFT_REVIEW_UNAVAILABLE');
  const point=await db.from('tft_telemetry_points').select('client_point_id').eq('session_id',session.id).eq('round',input.assessment.round).limit(1);
  if(point.error)throw new Error('Could not verify recorded round.');
  if(!point.data?.length)throw new Error('TFT_ROUND_NOT_RECORDED');
  const {error:updateError}=await db.from('tft_telemetry_sessions').update({
    summary:{...session.summary,assessments:{...session.summary?.assessments,[input.skill]:input.assessment}},updated_at:new Date().toISOString(),
  }).eq('id',session.id).eq('user_id',userId).eq('updated_at',session.updated_at).select('id').single();
  if(updateError)throw new Error('Could not save TFT review.');
}
