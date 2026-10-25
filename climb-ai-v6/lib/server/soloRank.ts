import 'server-only';
/** Rank belongs to the selected account; secondary accounts cannot inherit the
 * primary profile's rank when Riot has not returned their own Solo/Duo rank. */
export async function resolveSoloRank(db:any,userId:string,accountId:string|null):Promise<string>{
  if(!accountId)return'UNRANKED';
  const account=await db.from('riot_accounts').select('rank_tier,rank_division,is_primary').eq('id',accountId).eq('user_id',userId).maybeSingle();
  if(account.error)throw new Error(account.error.message);
  if(!account.data)return'UNRANKED';
  const tier=String(account.data.rank_tier??'').trim(),division=String(account.data.rank_division??'').trim();
  if(tier)return[tier,division].filter(Boolean).join(' ');
  if(!account.data.is_primary)return'UNRANKED';
  const profile=await db.from('profiles').select('rank').eq('id',userId).maybeSingle();
  if(profile.error)throw new Error(profile.error.message);
  return String(profile.data?.rank||'UNRANKED');
}
