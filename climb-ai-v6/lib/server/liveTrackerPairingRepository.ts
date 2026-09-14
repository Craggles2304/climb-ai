import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import {getSupabaseAdmin} from './supabaseAdmin';
import type {RiotProfileInput} from './liveTrackerRepository';

const PAIR_CODE_TTL_MS=10*60*1000;

export async function createDesktopPairCode(userId:string,accountKey:string,deviceName:string,riotProfile:RiotProfileInput){
  const db=getSupabaseAdmin();
  if(!db)throw new Error('Supabase is required for secure tracker pairing.');
  const now=new Date().toISOString();
  const tagline=riotProfile.tagline.replace(/^#/,'').trim().toUpperCase();
  const region=riotProfile.region.trim().toUpperCase();
  const gameName=riotProfile.gameName.trim();

  const {error:profileError}=await db.from('profiles').upsert({
    id:userId,game_name:gameName,tagline,region,
    role:riotProfile.role?.toUpperCase()||null,rank:riotProfile.rank||null,
    champions:riotProfile.champions??[],frustration:riotProfile.frustration||null,updated_at:now,
  },{onConflict:'id'});
  if(profileError)throw new Error(profileError.message);

  const {error:clearError}=await db.from('riot_accounts').update({is_primary:false,updated_at:now}).eq('user_id',userId).eq('is_primary',true);
  if(clearError)throw new Error(clearError.message);
  const {data:riotAccount,error:riotError}=await db.from('riot_accounts').upsert({
    user_id:userId,game_name:gameName,tagline,region,label:'PRIMARY',is_primary:true,sync_status:'pairing',updated_at:now,
  },{onConflict:'user_id,game_name,tagline,region'}).select('id,game_name,tagline,region').single();
  if(riotError||!riotAccount)throw new Error(riotError?.message||'Riot account could not be saved.');

  await db.from('live_tracker_pair_codes').delete().eq('user_id',userId).eq('account_key',accountKey).is('claimed_at',null);
  const code=makeCode();
  const expiresAt=new Date(Date.now()+PAIR_CODE_TTL_MS).toISOString();
  const {error}=await db.from('live_tracker_pair_codes').insert({
    user_id:userId,account_key:accountKey,riot_account_id:riotAccount.id,device_name:deviceName,
    code_hash:hash(code),expires_at:expiresAt,
  });
  if(error)throw new Error(error.message);
  return{code,expiresAt,riotAccount};
}

export async function claimDesktopPairCode(rawCode:string){
  const db=getSupabaseAdmin();
  if(!db)throw new Error('Supabase is required for secure tracker pairing.');
  const code=normalizeCode(rawCode);
  const now=new Date().toISOString();
  const {data:pair,error:readError}=await db.from('live_tracker_pair_codes')
    .select('id,user_id,account_key,riot_account_id,device_name,expires_at,claimed_at')
    .eq('code_hash',hash(code)).maybeSingle();
  if(readError)throw new Error(readError.message);
  if(!pair||pair.claimed_at||new Date(pair.expires_at).getTime()<=Date.now())return null;

  const {data:claimed,error:claimError}=await db.from('live_tracker_pair_codes')
    .update({claimed_at:now}).eq('id',pair.id).is('claimed_at',null).select('id').maybeSingle();
  if(claimError)throw new Error(claimError.message);
  if(!claimed)return null;

  const token=`climb_live_${randomBytes(32).toString('base64url')}`;
  const {data:device,error:deviceError}=await db.from('live_tracker_devices').insert({
    user_id:pair.user_id,account_key:pair.account_key,riot_account_id:pair.riot_account_id,
    device_name:pair.device_name,token_hash:hash(token),
  }).select('id,account_key,riot_account_id,device_name,created_at,last_seen_at').single();
  if(deviceError)throw new Error(deviceError.message);
  await db.from('riot_accounts').update({sync_status:'paired',updated_at:now}).eq('id',pair.riot_account_id);
  return{token,device};
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
