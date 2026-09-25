import 'server-only';
import {riotService} from '@/lib/services/riotService';
import {riotEnabled,RiotApiError} from '@/lib/riot/client';
import {isSupportedRegion,SUPPORTED_REGIONS} from '@/lib/riot/regions';
import {saveMatches} from '@/lib/server/matchRepository';
import {getCurrentUser} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import type {Role} from '@/lib/types';

type Input={gameName:string;tagline:string;region:string;fallbackRole:Role;frustration:string};
type Result={status:number;body:Record<string,unknown>};

const validRole=(value:unknown,fallback:Role):Role=>{
  const role=String(value||'').toUpperCase();
  return ['TOP','JUNGLE','MID','ADC','SUPPORT'].includes(role)?role as Role:fallback;
};

function rankFromStored(account:any,matchRank:unknown){
  const direct=String(matchRank||'').trim();
  if(direct)return direct;
  if(account?.rank_tier){
    const division=account.rank_division?` ${account.rank_division}`:'';
    const lp=typeof account.league_points==='number'?` · ${account.league_points} LP`:'';
    return`${account.rank_tier}${division}${lp}`;
  }
  return'UNRANKED';
}

export async function bootstrapActivation(input:Input):Promise<Result>{
  if(!isSupportedRegion(input.region)){
    return{status:400,body:{ok:false,error:`Region not supported. Choose one of: ${SUPPORTED_REGIONS.join(', ')}.`}};
  }

  const user=await getCurrentUser();
  if(!user)return{status:401,body:{ok:false,error:'Your sign-in session expired. Sign in again and OP CLIMB will return you to activation.'}};
  const db=getSupabaseAdmin();
  if(!db)return{status:503,body:{ok:false,error:'Player setup is temporarily unavailable.'}};

  const region=input.region.toUpperCase();
  const requestedName=input.gameName.trim();
  const requestedTag=input.tagline.replace(/^#/,'').trim().toUpperCase();

  const existingResult=await db.from('riot_accounts')
    .select('id,game_name,tagline,region,is_primary,role,champions,rank_tier,rank_division,league_points,puuid')
    .eq('user_id',user.id);
  if(existingResult.error){
    console.error('[activation-bootstrap] existing account lookup failed',existingResult.error);
    return{status:502,body:{ok:false,code:'ACCOUNT_LOOKUP_FAILED',error:'OP CLIMB could not check your existing linked account.'}};
  }

  const existing=existingResult.data||[];
  const linkedExisting=(existing as any[]).find(row=>
    String(row.game_name||'').toLowerCase()===requestedName.toLowerCase()&&
    String(row.tagline||'').replace(/^#/,'').toUpperCase()===requestedTag&&
    String(row.region||'').toUpperCase()===region
  )||null;

  if(linkedExisting){
    const stored=await db.from('matches')
      .select('id,champion,role,rank,occurred_at,created_at')
      .eq('user_id',user.id)
      .eq('riot_account_id',linkedExisting.id)
      .in('result',['WIN','LOSS'])
      .order('occurred_at',{ascending:false})
      .limit(1)
      .maybeSingle();

    if(stored.error){
      console.error('[activation-bootstrap] existing match lookup failed',stored.error);
      return{status:502,body:{ok:false,code:'MATCH_LOOKUP_FAILED',error:'OP CLIMB could not check your existing match history.'}};
    }

    if(stored.data){
      const detectedRole=validRole(stored.data.role||linkedExisting.role,input.fallbackRole);
      const champion=String(stored.data.champion||'').trim();
      const previousChampions=Array.isArray(linkedExisting.champions)?linkedExisting.champions.map(String):[];
      const champions=champion?[champion,...previousChampions.filter(value=>value!==champion)]:previousChampions;
      const rankLabel=rankFromStored(linkedExisting,stored.data.rank);
      const now=new Date().toISOString();

      const accountUpdate=await db.from('riot_accounts').update({
        role:detectedRole,
        champions,
        frustration:input.frustration,
        updated_at:now,
      }).eq('id',linkedExisting.id).eq('user_id',user.id);
      if(accountUpdate.error)console.warn('[activation-bootstrap] existing account refresh failed',accountUpdate.error.message);

      if(linkedExisting.is_primary){
        const profile=await db.from('profiles').upsert({
          id:user.id,
          game_name:linkedExisting.game_name,
          tagline:linkedExisting.tagline,
          region,
          role:detectedRole,
          rank:rankLabel,
          champions,
          frustration:input.frustration,
          updated_at:now,
        },{onConflict:'id'});
        if(profile.error)console.warn('[activation-bootstrap] existing profile refresh failed',profile.error.message);
      }

      return{status:200,body:{
        ok:true,
        account:{id:linkedExisting.id,gameName:linkedExisting.game_name,tagline:linkedExisting.tagline,region},
        profile:{role:detectedRole,rank:rankLabel,champions},
        matchImported:false,
        reusedExisting:true,
        matchId:stored.data.id,
        syncStatus:'existing',
      }};
    }
  }

  if(!riotEnabled()){
    return{status:503,body:{
      ok:false,
      code:'RIOT_DISABLED',
      error:linkedExisting
        ?'No finished game is stored for this linked account yet. Play one with the Companion or add one completed game to start.'
        :'Automatic Riot import is unavailable right now. Connect the Companion or add one completed game to start.',
    }};
  }

  try{
    const riotAccount=await riotService.getAccountByRiotId(requestedName,requestedTag,region);
    const rank=await riotService.getSummonerRank(riotAccount.puuid,region).catch(()=>null);
    const canonicalName=String(riotAccount.gameName||requestedName).trim();
    const canonicalTag=String(riotAccount.tagLine||requestedTag).replace(/^#/,'').trim().toUpperCase();
    const now=new Date().toISOString();

    let linked=(existing as any[]).find(row=>
      String(row.game_name||'').toLowerCase()===canonicalName.toLowerCase()&&
      String(row.tagline||'').replace(/^#/,'').toUpperCase()===canonicalTag&&
      String(row.region||'').toUpperCase()===region
    )||null;

    if(!linked){
      const inserted=await db.from('riot_accounts').insert({
        user_id:user.id,
        puuid:riotAccount.puuid,
        game_name:canonicalName,
        tagline:canonicalTag,
        region,
        label:existing.length?'ACCOUNT':'PRIMARY',
        is_primary:existing.length===0,
        sync_status:'syncing',
        verification_status:'verified',
        observed_riot_id:`${canonicalName}#${canonicalTag}`,
        verified_at:now,
        role:input.fallbackRole,
        champions:[],
        frustration:input.frustration,
        rank_tier:rank?.tier??null,
        rank_division:rank?.division??null,
        league_points:rank?.leaguePoints??null,
        updated_at:now,
      }).select('id,game_name,tagline,region,is_primary,role,champions').single();
      if(inserted.error||!inserted.data)throw new Error(inserted.error?.message||'Could not create Riot account.');
      linked=inserted.data;
    }

    const ids=await riotService.getRecentMatches(riotAccount.puuid,region,{count:1,queue:420});
    let synced:any=null;
    if(ids[0]){
      synced=await riotService.getMatchDetails(ids[0],region,{riotAccountId:linked.id,puuid:riotAccount.puuid,rank:rank?.label});
      const saved=await saveMatches(user.id,[synced]);
      if(!saved.persisted)throw new Error(saved.reason||'The first Riot match could not be saved.');
    }

    const detectedRole=validRole(synced?.match?.role,input.fallbackRole);
    const champion=String(synced?.match?.champion||'').trim();
    const champions=champion?[champion]:(Array.isArray(linked.champions)?linked.champions:[]);
    const rankLabel=rank?.label||'UNRANKED';
    const syncStatus=synced?'ready':'no_matches';

    const accountUpdate=await db.from('riot_accounts').update({
      puuid:riotAccount.puuid,
      sync_status:syncStatus,
      last_synced_at:now,
      rank_tier:rank?.tier??null,
      rank_division:rank?.division??null,
      league_points:rank?.leaguePoints??null,
      role:detectedRole,
      champions,
      frustration:input.frustration,
      verification_status:'verified',
      observed_riot_id:`${canonicalName}#${canonicalTag}`,
      verified_at:now,
      updated_at:now,
    }).eq('id',linked.id).eq('user_id',user.id);
    if(accountUpdate.error)throw new Error(accountUpdate.error.message);

    if(linked.is_primary||existing.length===0){
      const profile=await db.from('profiles').upsert({
        id:user.id,
        game_name:canonicalName,
        tagline:canonicalTag,
        region,
        role:detectedRole,
        rank:rankLabel,
        champions,
        frustration:input.frustration,
        updated_at:now,
      },{onConflict:'id'});
      if(profile.error)throw new Error(profile.error.message);
    }

    return{status:200,body:{
      ok:true,
      account:{id:linked.id,gameName:canonicalName,tagline:canonicalTag,region},
      profile:{role:detectedRole,rank:rankLabel,champions},
      matchImported:Boolean(synced),
      reusedExisting:false,
      matchId:synced?.match?.id??null,
      syncStatus,
    }};
  }catch(error){
    if(error instanceof RiotApiError){
      const status=error.status===404?404:error.status===429?429:502;
      return{status,body:{ok:false,code:error.status===404?'RIOT_NOT_FOUND':'RIOT_ERROR',error:error.status===404?'We could not find that Riot ID in this region. Check the game name, tagline and region.':error.message}};
    }
    console.error('[activation-bootstrap] Riot/profile bootstrap failed',error);
    return{status:502,body:{ok:false,code:'BOOTSTRAP_FAILED',error:error instanceof Error?error.message:'Riot activation could not complete.'}};
  }
}
