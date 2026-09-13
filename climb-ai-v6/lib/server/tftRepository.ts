import 'server-only';
import {getSupabaseAdmin} from './supabaseAdmin';
import type {TftMatch} from '@/lib/tft/types';

export interface TftSaveResult{persisted:boolean;inserted:number;skipped:number;reason?:string}
export interface TftProfileUpdate{puuid:string;rank?:{tier:string;division:string;leaguePoints:number}|null}

export async function saveTftMatches(userId:string,riotAccountId:string,matches:TftMatch[],profile:TftProfileUpdate):Promise<TftSaveResult>{
  const db=getSupabaseAdmin();
  if(!db)return{persisted:false,inserted:0,skipped:matches.length,reason:'Supabase is not configured.'};

  const {data:existing,error:existingError}=matches.length
    ?await db.from('tft_matches').select('external_match_id').eq('user_id',userId).in('external_match_id',matches.map(m=>m.id))
    :{data:[],error:null};
  if(existingError)return{persisted:false,inserted:0,skipped:matches.length,reason:existingError.message};
  const seen=new Set((existing||[]).map((r:any)=>String(r.external_match_id)));
  const fresh=matches.filter(m=>!seen.has(m.id));

  if(fresh.length){
    const {error}=await db.from('tft_matches').insert(fresh.map(m=>({
      user_id:userId,
      riot_account_id:riotAccountId,
      external_match_id:m.id,
      queue_id:m.queueId??null,
      game_datetime:m.playedAt,
      game_length_seconds:m.gameLengthSeconds,
      game_version:m.gameVersion,
      set_number:m.setNumber??null,
      set_core_name:m.setCoreName??null,
      placement:m.placement,
      level:m.level??null,
      last_round:m.lastRound??null,
      players_eliminated:m.playersEliminated??null,
      total_damage_to_players:m.totalDamageToPlayers??null,
      gold_left:m.goldLeft??null,
      augments:m.augments,
      traits:m.traits,
      units:m.units,
      companion:m.companion??null,
      comp_signature:m.compSignature,
      raw:{source:'riot-tft-v1'},
    })));
    if(error)return{persisted:false,inserted:0,skipped:matches.length,reason:error.message};
  }

  const {error:profileError}=await db.from('tft_profiles').upsert({
    user_id:userId,
    riot_account_id:riotAccountId,
    puuid:profile.puuid,
    rank_tier:profile.rank?.tier??null,
    rank_division:profile.rank?.division??null,
    league_points:profile.rank?.leaguePoints??null,
    sync_status:'ready',
    last_synced_at:new Date().toISOString(),
    updated_at:new Date().toISOString(),
  },{onConflict:'user_id,riot_account_id'});
  if(profileError)return{persisted:false,inserted:fresh.length,skipped:matches.length-fresh.length,reason:`Matches saved but TFT profile update failed: ${profileError.message}`};

  return{persisted:true,inserted:fresh.length,skipped:matches.length-fresh.length};
}
