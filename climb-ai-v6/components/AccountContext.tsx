'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {demoAccounts,matchesFor as demoMatchesFor,missionFor} from '@/data/demo';
import {RiotAccount,Match,Role} from '@/lib/types';
import {loadProfile,PlayerProfile,PROFILE_ACCOUNT_ID,PROFILE_EVENT} from '@/lib/profile';
import {getBrowserClient} from '@/lib/supabase/client';
import {deriveStoredLiveMetrics} from '@/lib/liveMatchMetricFallback';

type LinkAccountInput={gameName:string;tagline:string;region:string;role:Role;champions?:string[]};
type Ctx={
  accounts:RiotAccount[];
  active:RiotAccount;
  setActive:(id:string)=>void;
  profile:PlayerProfile|null;
  isOwnAccount:boolean;
  isEmpty:boolean;
  authenticated:boolean;
  hydrated:boolean;
  refresh:()=>Promise<void>;
  linkAccount:(input:LinkAccountInput)=>Promise<void>;
};

const AccountContext=createContext<Ctx|null>(null);
const ACTIVE_KEY='climb_active_account';
let cloudRuntime=false;
const runtimeMatches=new Map<string,Match[]>();

export function matchesFor(accountId:string):Match[]{
  if(runtimeMatches.has(accountId))return runtimeMatches.get(accountId)!;
  if(cloudRuntime)return [];
  if(accountId===PROFILE_ACCOUNT_ID)return [];
  return demoMatchesFor(accountId);
}

function localAccountFromProfile(p:PlayerProfile):RiotAccount{
  return {id:p.id,label:'YOU',gameName:p.gameName||'Your account',tagline:p.tagline||'',region:p.region||'EUW',role:p.role,rank:p.rank,champions:p.champions,isPrimary:true,syncStatus:'PENDING'};
}

function roleOf(value:unknown):Role{
  const v=String(value||'ADC').toUpperCase();
  return ['TOP','JUNGLE','MID','ADC','SUPPORT'].includes(v)?v as Role:'ADC';
}

function accountRank(row:any,profile:any){
  if(row.rank_tier){
    const division=row.rank_division?` ${row.rank_division}`:'';
    const lp=typeof row.league_points==='number'?` · ${row.league_points} LP`:'';
    return `${row.rank_tier}${division}${lp}`;
  }
  return profile?.rank||'UNRANKED';
}

function firstNumber(...values:unknown[]){
  for(const value of values){
    if(value===null||value===undefined||value==='')continue;
    const number=Number(value);
    if(Number.isFinite(number))return number;
  }
  return undefined;
}

function stringArray(value:unknown){return Array.isArray(value)?value.map(v=>String(v||'').trim()).filter(Boolean):undefined}

function mapMatch(row:any,metric:any):Match{
  const raw=metric?.raw&&typeof metric.raw==='object'?metric.raw:{};
  const rawMetrics=raw.metrics&&typeof raw.metrics==='object'?raw.metrics:{};
  const n=(v:unknown,fallback=0)=>{const x=Number(v);return Number.isFinite(x)?x:fallback};
  const result=row.result as Match['result'];
  const source=String(row.source||'manual').toLowerCase() as Match['source'];
  const durationSeconds=n(row.duration_seconds,1);
  const cs=n(metric?.cs??rawMetrics.cs);
  const live=deriveStoredLiveMetrics(raw,durationSeconds,cs);
  const rawItems=stringArray(raw.items);
  return {
    id:row.id,riotAccountId:row.riot_account_id||PROFILE_ACCOUNT_ID,
    champion:row.champion||'Unknown',opponent:String(raw.opponent||live.opponent||'').trim()||undefined,
    role:roleOf(row.role),result,
    kills:n(row.kills),deaths:n(row.deaths),assists:n(row.assists),durationSeconds,
    rank:row.rank||'',source,createdAt:row.occurred_at||row.created_at||new Date().toISOString(),
    items:rawItems?.length?rawItems:live.items,
    metrics:{
      cs,
      csPerMin:firstNumber(metric?.cs_per_min,rawMetrics.csPerMin)??0,
      deaths:n(row.deaths),
      goldPerMin:firstNumber(metric?.gold_per_min,rawMetrics.goldPerMin),
      damagePerMin:firstNumber(metric?.damage_per_min,rawMetrics.damagePerMin),
      damageShare:firstNumber(metric?.damage_share,rawMetrics.damageShare),
      killParticipation:firstNumber(metric?.kill_participation,rawMetrics.killParticipation),
      visionScore:firstNumber(metric?.vision_score,rawMetrics.visionScore),
      objectiveParticipation:firstNumber(metric?.objective_participation,rawMetrics.objectiveParticipation),
      csAt10:firstNumber(metric?.cs_at_10,rawMetrics.csAt10,live.csAt10),
      csAt15:firstNumber(metric?.cs_at_15,rawMetrics.csAt15,live.csAt15),
      laneCsPerMin:firstNumber(metric?.lane_cs_per_min,rawMetrics.laneCsPerMin,live.laneCsPerMin),
      post15CsPerMin:firstNumber(metric?.post15_cs_per_min,metric?.farm_after_15,rawMetrics.post15CsPerMin,live.post15CsPerMin),
      goldDiffAt15:firstNumber(metric?.gold_diff_at_15,rawMetrics.goldDiffAt15),
      xpDiffAt15:firstNumber(metric?.xp_diff_at_15,rawMetrics.xpDiffAt15),
      levelAt15:firstNumber(rawMetrics.levelAt15,live.levelAt15),
      deathsPre10:firstNumber(metric?.deaths_pre_10,rawMetrics.deathsPre10,live.deathsPre10),
      deaths10to20:firstNumber(metric?.deaths_10_to_20,rawMetrics.deaths10to20,live.deaths10to20),
      deathsPost20:firstNumber(metric?.deaths_post_20,rawMetrics.deathsPost20,live.deathsPost20),
      soloDeaths:firstNumber(metric?.solo_deaths,rawMetrics.soloDeaths,live.soloDeaths),
      teamfightDeaths:firstNumber(metric?.teamfight_deaths,rawMetrics.teamfightDeaths,live.teamfightDeaths),
      firstItemMinute:firstNumber(metric?.first_item_minute,rawMetrics.firstItemMinute,live.firstItemMinute),
      secondItemMinute:firstNumber(metric?.second_item_minute,rawMetrics.secondItemMinute,live.secondItemMinute),
      thirdItemMinute:firstNumber(metric?.third_item_minute,rawMetrics.thirdItemMinute,live.thirdItemMinute),
      wardsPlaced:firstNumber(rawMetrics.wardsPlaced),
      controlWards:firstNumber(rawMetrics.controlWards),
    },
  };
}

function placeholderAccount():RiotAccount{
  return {id:PROFILE_ACCOUNT_ID,label:'YOU',gameName:'Complete onboarding',tagline:'',region:'EUW',role:'ADC',rank:'UNRANKED',champions:[],isPrimary:true,syncStatus:'PENDING'};
}

export function AccountProvider({children}:{children:React.ReactNode}){
  const [accounts,setAccounts]=useState<RiotAccount[]>(demoAccounts);
  const [profile,setProfile]=useState<PlayerProfile|null>(null);
  const [activeId,setActiveId]=useState<string>('acct-main');
  const [authenticated,setAuthenticated]=useState(false);
  const [hydrated,setHydrated]=useState(false);

  const hydrate=useCallback(async()=>{
    setHydrated(false);
    const client=await getBrowserClient();
    const {data:userData}=client?await client.auth.getUser():{data:{user:null}} as any;
    const user=userData.user;

    if(!client||!user){
      cloudRuntime=false;
      runtimeMatches.clear();
      const local=loadProfile();
      setProfile(local);
      const next=local?[localAccountFromProfile(local),...demoAccounts]:demoAccounts;
      setAccounts(next);
      const saved=typeof window!=='undefined'?localStorage.getItem(ACTIVE_KEY):null;
      setActiveId(saved&&next.some(a=>a.id===saved)?saved:(local?PROFILE_ACCOUNT_ID:'acct-main'));
      setAuthenticated(false);
      setHydrated(true);
      return;
    }

    cloudRuntime=true;
    setAuthenticated(true);
    const local=loadProfile();
    let {data:profileRow,error:profileError}=await client.from('profiles').select('id,game_name,tagline,region,role,rank,champions,frustration,created_at').eq('id',user.id).maybeSingle();
    if(profileError)console.error('[account] profile load failed',profileError);

    if(!profileRow&&local){
      const now=new Date().toISOString();
      const tagline=local.tagline.replace(/^#/,'').toUpperCase();
      await client.from('profiles').upsert({id:user.id,game_name:local.gameName,tagline,region:local.region,role:local.role,rank:local.rank,champions:local.champions,frustration:local.frustration,updated_at:now},{onConflict:'id'});
      await client.from('riot_accounts').upsert({user_id:user.id,game_name:local.gameName,tagline,region:local.region,label:'PRIMARY',is_primary:true,sync_status:'pending',role:local.role,champions:local.champions,frustration:local.frustration,updated_at:now},{onConflict:'user_id,game_name,tagline,region'});
      const retry=await client.from('profiles').select('id,game_name,tagline,region,role,rank,champions,frustration,created_at').eq('id',user.id).maybeSingle();
      profileRow=retry.data;
    }

    let {data:accountRows,error:accountsError}=await client.from('riot_accounts').select('id,game_name,tagline,region,label,is_primary,sync_status,rank_tier,rank_division,league_points,role,champions,frustration,puuid').eq('user_id',user.id).order('is_primary',{ascending:false}).order('created_at',{ascending:true});
    if(accountsError)console.error('[account] Riot accounts load failed',accountsError);

    if(profileRow&&(!accountRows||accountRows.length===0)){
      const now=new Date().toISOString();
      await client.from('riot_accounts').insert({user_id:user.id,game_name:profileRow.game_name||'Player',tagline:String(profileRow.tagline||'EUW').replace(/^#/,''),region:profileRow.region||'EUW',label:'PRIMARY',is_primary:true,sync_status:'pending',role:profileRow.role,champions:profileRow.champions||[],frustration:profileRow.frustration,updated_at:now});
      const retry=await client.from('riot_accounts').select('id,game_name,tagline,region,label,is_primary,sync_status,rank_tier,rank_division,league_points,role,champions,frustration,puuid').eq('user_id',user.id).order('is_primary',{ascending:false}).order('created_at',{ascending:true});
      accountRows=retry.data;
    }

    const realAccounts:RiotAccount[]=(accountRows||[]).map((row:any)=>({
      id:row.id,label:row.is_primary?'YOU':String(row.label||'ACCOUNT').toUpperCase(),gameName:row.game_name,
      tagline:`#${String(row.tagline||'').replace(/^#/,'')}`,region:String(row.region||'EUW').toUpperCase(),
      role:roleOf(row.role||profileRow?.role),rank:accountRank(row,profileRow),
      champions:Array.isArray(row.champions)&&row.champions.length?row.champions:(Array.isArray(profileRow?.champions)?profileRow.champions:[]),
      isPrimary:Boolean(row.is_primary),puuid:row.puuid||undefined,syncStatus:String(row.sync_status||'pending').toUpperCase(),
    }));

    const primary=realAccounts.find(a=>a.isPrimary)||realAccounts[0];
    const cloudProfile:PlayerProfile|null=profileRow&&primary?{
      id:primary.id,gameName:profileRow.game_name||primary.gameName,tagline:`#${String(profileRow.tagline||primary.tagline).replace(/^#/,'')}`,
      region:profileRow.region||primary.region,role:roleOf(profileRow.role||primary.role),rank:profileRow.rank||primary.rank,
      champions:Array.isArray(profileRow.champions)?profileRow.champions:primary.champions,frustration:profileRow.frustration||'',createdAt:profileRow.created_at||new Date().toISOString(),
    }:null;

    const {data:matchRows,error:matchError}=await client.from('matches').select('id,riot_account_id,champion,role,result,kills,deaths,assists,duration_seconds,rank,source,occurred_at,created_at').eq('user_id',user.id).order('occurred_at',{ascending:false});
    if(matchError)console.error('[account] matches load failed',matchError);
    const decidedRows=(matchRows||[]).filter((m:any)=>m.result==='WIN'||m.result==='LOSS');
    const ids=decidedRows.map((m:any)=>m.id);
    let metricRows:any[]=[];
    if(ids.length){
      const metricResult=await client.from('match_metrics').select('match_id,cs,cs_per_min,gold_per_min,damage_per_min,damage_share,kill_participation,vision_score,farm_after_15,objective_participation,lane_cs_per_min,post15_cs_per_min,cs_at_10,cs_at_15,gold_diff_at_15,xp_diff_at_15,deaths_pre_10,deaths_10_to_20,deaths_post_20,solo_deaths,teamfight_deaths,first_item_minute,second_item_minute,third_item_minute,raw').eq('user_id',user.id).in('match_id',ids);
      if(metricResult.error)console.error('[account] metrics load failed',metricResult.error);
      else metricRows=metricResult.data||[];
    }
    const metricMap=new Map(metricRows.map((m:any)=>[m.match_id,m]));
    runtimeMatches.clear();
    for(const row of decidedRows){
      const match=mapMatch(row,metricMap.get(row.id));
      const list=runtimeMatches.get(match.riotAccountId)||[];
      list.push(match);runtimeMatches.set(match.riotAccountId,list);
    }

    const nextAccounts=realAccounts.length?realAccounts:[placeholderAccount()];
    setAccounts(nextAccounts);setProfile(cloudProfile);
    const saved=typeof window!=='undefined'?localStorage.getItem(ACTIVE_KEY):null;
    setActiveId(saved&&nextAccounts.some(a=>a.id===saved)?saved:(primary?.id||nextAccounts[0].id));
    setHydrated(true);
  },[]);

  useEffect(()=>{
    void hydrate();
    const onProfile=()=>void hydrate();
    window.addEventListener(PROFILE_EVENT,onProfile);
    let unsubscribe:(()=>void)|undefined;
    void getBrowserClient().then(client=>{
      if(!client)return;
      const {data}=client.auth.onAuthStateChange(()=>void hydrate());
      unsubscribe=()=>data.subscription.unsubscribe();
    });
    return ()=>{window.removeEventListener(PROFILE_EVENT,onProfile);unsubscribe?.()};
  },[hydrate]);

  const active=useMemo(()=>accounts.find(a=>a.id===activeId)||accounts[0]||placeholderAccount(),[accounts,activeId]);
  const setActive=(id:string)=>{setActiveId(id);try{localStorage.setItem(ACTIVE_KEY,id)}catch{/* private mode */}};
  const isOwnAccount=authenticated||active.id===PROFILE_ACCOUNT_ID;
  const isEmpty=hydrated&&matchesFor(active.id).length===0;

  const linkAccount=async(input:LinkAccountInput)=>{
    const client=await getBrowserClient();if(!client)throw new Error('Sign in before linking a Riot account.');
    const {data}=await client.auth.getUser();if(!data.user)throw new Error('Sign in before linking a Riot account.');
    const tagline=input.tagline.replace(/^#/,'').trim().toUpperCase();
    const {error}=await client.from('riot_accounts').upsert({user_id:data.user.id,game_name:input.gameName.trim(),tagline,region:input.region.toUpperCase(),label:'ACCOUNT',is_primary:false,sync_status:'pending',role:input.role,champions:input.champions||[],updated_at:new Date().toISOString()},{onConflict:'user_id,game_name,tagline,region'});
    if(error)throw new Error(error.message);
    await hydrate();
  };

  return <AccountContext.Provider value={{accounts,active,setActive,profile,isOwnAccount,isEmpty,authenticated,hydrated,refresh:hydrate,linkAccount}}>{children}</AccountContext.Provider>;
}

export function useAccount(){const ctx=useContext(AccountContext);if(!ctx)throw new Error('useAccount must be used inside AccountProvider');return ctx}
export {missionFor};
