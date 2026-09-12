'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {demoAccounts,matchesFor as demoMatchesFor,missionFor} from '@/data/demo';
import {RiotAccount,Match,Role} from '@/lib/types';
import {loadProfile,PlayerProfile,PROFILE_ACCOUNT_ID,PROFILE_EVENT} from '@/lib/profile';
import {getBrowserClient} from '@/lib/supabase/client';

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

function mapMatch(row:any,metric:any):Match{
  const raw=metric?.raw&&typeof metric.raw==='object'?metric.raw:{};
  const n=(v:unknown,fallback=0)=>{const x=Number(v);return Number.isFinite(x)?x:fallback};
  const result=row.result==='WIN'||row.result==='LOSS'?row.result:'UNKNOWN';
  const source=String(row.source||'manual').toLowerCase() as Match['source'];
  return {
    id:row.id,riotAccountId:row.riot_account_id||PROFILE_ACCOUNT_ID,
    champion:row.champion||'Unknown',role:roleOf(row.role),result,
    kills:n(row.kills),deaths:n(row.deaths),assists:n(row.assists),durationSeconds:n(row.duration_seconds,1),
    rank:row.rank||'',source,createdAt:row.occurred_at||row.created_at||new Date().toISOString(),
    metrics:{
      cs:n(metric?.cs),csPerMin:n(metric?.cs_per_min),deaths:n(row.deaths),
      goldPerMin:metric?.gold_per_min==null?undefined:n(metric.gold_per_min),
      damagePerMin:metric?.damage_per_min==null?undefined:n(metric.damage_per_min),
      killParticipation:metric?.kill_participation==null?undefined:n(metric.kill_participation),
      visionScore:metric?.vision_score==null?undefined:n(metric.vision_score),
      post15CsPerMin:metric?.farm_after_15==null?undefined:n(metric.farm_after_15),
      objectiveParticipation:metric?.objective_participation==null?undefined:n(metric.objective_participation),
      ...(raw.metrics&&typeof raw.metrics==='object'?raw.metrics:{}),
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
    const ids=(matchRows||[]).map((m:any)=>m.id);
    let metricRows:any[]=[];
    if(ids.length){
      const metricResult=await client.from('match_metrics').select('match_id,cs,cs_per_min,gold_per_min,damage_per_min,kill_participation,vision_score,farm_after_15,objective_participation,raw').eq('user_id',user.id).in('match_id',ids);
      if(metricResult.error)console.error('[account] metrics load failed',metricResult.error);
      else metricRows=metricResult.data||[];
    }
    const metricMap=new Map(metricRows.map((m:any)=>[m.match_id,m]));
    runtimeMatches.clear();
    for(const row of matchRows||[]){
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
