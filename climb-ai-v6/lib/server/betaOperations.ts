import 'server-only';
import {getSupabaseAdmin} from './supabaseAdmin';
import {buildBetaOperationsSnapshot,type BetaOpsEvent,type BetaParticipantProfile,type BetaOperationsSnapshot} from '@/lib/betaOperationsModel';

const EVENTS=[
  'signup_completed','op_grade_viewed','companion_connected','companion_game_completed',
  'climb_session_started','climb_session_completed','career_viewed','dashboard_view',
  'coach_message_sent','analysis_completed','mission_completed','feedback_given',
] as const;

export async function getBetaOperationsSnapshot(windowDays=45):Promise<BetaOperationsSnapshot&{error?:string}>{
  const db=getSupabaseAdmin();
  if(!db)return {...buildBetaOperationsSnapshot([],[]),error:'Supabase admin storage is not configured.'};
  const since=new Date(Date.now()-windowDays*86_400_000).toISOString();
  const [eventsResult,profilesResult]=await Promise.all([
    db.from('analytics_events')
      .select('user_id,anon_id,event,props,occurred_at')
      .gte('occurred_at',since)
      .in('event',[...EVENTS])
      .order('occurred_at',{ascending:true})
      .limit(20000),
    db.from('profiles')
      .select('id,game_name,tagline,region,role,rank,is_founder,created_at')
      .order('created_at',{ascending:true})
      .limit(5000),
  ]);
  const error=eventsResult.error?.message||profilesResult.error?.message;
  const profiles=(profilesResult.data??[]).map((row:any):BetaParticipantProfile=>({
    id:String(row.id),
    gameName:row.game_name??null,
    tagline:row.tagline??null,
    region:row.region??null,
    role:row.role??null,
    rank:row.rank??null,
    isFounder:row.is_founder===true,
    createdAt:String(row.created_at),
  }));
  return{
    ...buildBetaOperationsSnapshot((eventsResult.data??[]) as BetaOpsEvent[],profiles),
    ...(error?{error}:{}),
  };
}
