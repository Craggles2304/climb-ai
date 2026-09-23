import 'server-only';
import {getSupabaseAdmin} from './supabaseAdmin';
import {
  summarizeFoundingBeta,
  type BetaEventRow,
  type FoundingBetaValidation,
} from '@/lib/foundingBetaModel';

export * from '@/lib/foundingBetaModel';

const RELEVANT_EVENTS=[
  'signup_completed',
  'op_grade_viewed',
  'companion_connected',
  'companion_game_completed',
  'climb_session_started',
  'climb_session_completed',
  'career_viewed',
  'dashboard_view',
  'coach_message_sent',
  'analysis_completed',
  'mission_completed',
  'feedback_given',
] as const;

export async function getFoundingBetaValidation(windowDays=45):Promise<FoundingBetaValidation>{
  const db=getSupabaseAdmin();
  if(!db){
    const empty=summarizeFoundingBeta([],Date.now(),windowDays);
    return{...empty,error:'Supabase admin storage is not configured.'};
  }
  const since=new Date(Date.now()-windowDays*86_400_000).toISOString();
  const {data,error}=await db.from('analytics_events')
    .select('user_id,anon_id,event,props,occurred_at')
    .gte('occurred_at',since)
    .in('event',[...RELEVANT_EVENTS])
    .order('occurred_at',{ascending:true})
    .limit(20000);
  if(error){
    const empty=summarizeFoundingBeta([],Date.now(),windowDays);
    return{...empty,error:error.message};
  }
  return summarizeFoundingBeta((data??[]) as BetaEventRow[],Date.now(),windowDays);
}
