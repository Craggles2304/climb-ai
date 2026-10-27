import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import {getSupabaseAdmin} from './supabaseAdmin';
import {retireSupersededDevices} from './liveTrackerRepository';
import type {RiotProfileInput} from './liveTrackerRepository';

const PAIR_CODE_TTL_MS=10*60*1000;

export async function createDesktopPairCode(userId:string,accountKey:string,deviceName:string,riotProfile:RiotProfileInput){
  const db=getSupabaseAdmin();
  if(!db)throw new Error('Supabase is required for secure tracker pairing.');
  const now=new Date().toISOString();
  const {data:selected,error:selectedError}=await db.from('riot_accounts')
    .select('id,game_name,tagline,region,role,rank_tier,rank_division,league_points,champions,frustration')
    .eq('user_id',userId).eq('id',accountKey).maybeSingle();
  if(selectedError)throw new Error(selectedError.message);
  if(!selected?.id)throw new Error('The selected Riot account is not available for this user.');

  const tagline=String(selected.tagline||riotProfile.tagline).replace(/^#/,'').trim().toUpperCase();
  const region=String(selected.region||riotProfile.region).trim().toUpperCase();
  const gameName=String(selected.game_name||riotProfile.gameName).trim();
  const storedRank=selected.rank_tier
    ?`${selected.rank_tier}${selected.rank_division?` ${selected.rank_division}`:''}${typeof selected.league_points==='number'?` · ${selected.league_points} LP`:''}`
    :null;

  const {error:profileError}=await db.from('profiles').upsert({
    id:userId,game_name:gameName,tagline,region,
    role:String(selected.role||riotProfile.role||'').toUpperCase()||null,
    rank:storedRank||riotProfile.rank||null,
    champions:Array.isArray(selected.champions)?selected.champions:(riotProfile.champions??[]),
    frustration:selected.frustration||riotProfile.frustration||null,updated_at:now,
  },{onConflict:'id'});
  if(profileError)throw new Error(profileError.message);

  const {error:clearError}=await db.from('riot_accounts').update({is_primary:false,updated_at:now}).eq('user_id',userId).eq('is_primary',true);
  if(clearError)throw new Error(clearError.message);
  const {data:riotAccount,error:riotError}=await db.from('riot_accounts').update({
    label:'PRIMARY',is_primary:true,sync_status:'pairing',updated_at:now,
  }).eq('user_id',userId).eq('id',selected.id).select('id,game_name,tagline,region').single();
  if(riotError||!riotAccount)throw new Error(riotError?.message||'Riot account could not be selected for pairing.');

  const code=makeCode();
  const expiresAt=new Date(Date.now()+PAIR_CODE_TTL_MS).toISOString();
  const pairRow={
    user_id:userId,
    account_key:accountKey,
    riot_account_id:riotAccount.id,
    device_name:deviceName,
    token_hash:hash(normalizeCode(code)),
    revoked_at:now,
    tracker_status:{state:'PAIRING',pairing:true,expiresAt},
    tracker_status_updated_at:now,
  };

  // Asking for a second code for the same PC replaces the unclaimed one rather
  // than leaving it behind. Codes are requested far more often than they are
  // claimed, so inserting per request was what filled the table.
  const pending=await reuseUnclaimedPairRow(db,userId,deviceName,pairRow)
    ??await insertPairRow(db,pairRow);
  return{code,expiresAt,pendingDeviceId:pending.id,riotAccount};
}

export async function claimDesktopPairCode(rawCode:string){
  const db=getSupabaseAdmin();
  if(!db)throw new Error('Supabase is required for secure tracker pairing.');
  const code=normalizeCode(rawCode);
  if(code.length!==12)return null;
  const {data:pair,error:readError}=await db.from('live_tracker_devices')
    .select('id,user_id,account_key,riot_account_id,device_name,tracker_status,revoked_at')
    .eq('token_hash',hash(code)).maybeSingle();
  if(readError)throw new Error(readError.message);
  const status=(pair?.tracker_status&&typeof pair.tracker_status==='object'?pair.tracker_status:{}) as Record<string,unknown>;
  const expiresAt=typeof status.expiresAt==='string'?status.expiresAt:'';
  if(!pair||status.pairing!==true||!expiresAt||new Date(expiresAt).getTime()<=Date.now())return null;

  const token=`climb_live_${randomBytes(32).toString('base64url')}`;
  const now=new Date().toISOString();
  const {data:device,error:updateError}=await db.from('live_tracker_devices').update({
    token_hash:hash(token),
    revoked_at:null,
    last_seen_at:null,
    tracker_status:{state:'WAITING',pairing:false,pairedAt:now},
    tracker_status_updated_at:now,
  }).eq('id',pair.id).eq('token_hash',hash(code)).not('revoked_at','is',null)
    .select('id,account_key,riot_account_id,device_name,created_at,last_seen_at').maybeSingle();
  if(updateError)throw new Error(updateError.message);
  if(!device)return null;
  await retireSupersededDevices(db,{userId:pair.user_id,deviceName:pair.device_name,keepId:pair.id,at:now});
  if(pair.riot_account_id)await db.from('riot_accounts').update({sync_status:'paired',updated_at:now}).eq('id',pair.riot_account_id);
  return{token,device};
}

/**
 * The newest unclaimed code for this PC, re-cut with a fresh code and expiry.
 * Returns null when there is none to reuse, so the caller inserts instead.
 */
async function reuseUnclaimedPairRow(
  db:NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  userId:string,deviceName:string,pairRow:Record<string,unknown>,
){
  const {data:candidates,error:readError}=await db.from('live_tracker_devices')
    .select('id,tracker_status')
    .eq('user_id',userId).eq('device_name',deviceName).not('revoked_at','is',null)
    .order('created_at',{ascending:false}).limit(10);
  if(readError||!candidates?.length)return null;
  const unclaimed=candidates.find(row=>{
    const status=(row.tracker_status&&typeof row.tracker_status==='object'?row.tracker_status:{}) as Record<string,unknown>;
    return status.pairing===true;
  });
  if(!unclaimed)return null;
  const {data,error}=await db.from('live_tracker_devices')
    .update(pairRow).eq('id',unclaimed.id).select('id').maybeSingle();
  // Losing the race to reuse a row is not a reason to refuse the player a code.
  if(error||!data)return null;
  return data as {id:string};
}

async function insertPairRow(
  db:NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  pairRow:Record<string,unknown>,
){
  const {data,error}=await db.from('live_tracker_devices').insert(pairRow).select('id').single();
  if(error||!data)throw new Error(error?.message||'Pairing code could not be created.');
  return data as {id:string};
}

function makeCode(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes=randomBytes(12);
  let text='';
  for(let i=0;i<12;i++)text+=alphabet[bytes[i]%alphabet.length];
  return `${text.slice(0,4)}-${text.slice(4,8)}-${text.slice(8,12)}`;
}
function normalizeCode(value:string){return value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'')}
function hash(value:string){return createHash('sha256').update(value).digest('hex')}
