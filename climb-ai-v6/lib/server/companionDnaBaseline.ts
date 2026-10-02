import type {Role} from '@/lib/types';
import {LEAGUE_ROLES,canonicalLeagueRole} from '@/lib/roleAwareLearning';
import {getSupabaseAdmin} from './supabaseAdmin';

export const COMPANION_DNA_BASELINE_REQUIRED=3;

function normalizeRole(value:unknown){return canonicalLeagueRole(value)??'';}

export async function companionDnaBaseline(input:{
  userId:string;
  riotAccountId:string|null;
  role?:string|null;
}){
  const db=getSupabaseAdmin();
  const role=normalizeRole(input.role);
  if(!db||!input.riotAccountId){
    return{games:0,required:COMPANION_DNA_BASELINE_REQUIRED,ready:false,role:role||null};
  }

  const {data,error}=await db.from('matches')
    .select('id,role,duration_seconds,result,occurred_at')
    .eq('user_id',input.userId)
    .eq('riot_account_id',input.riotAccountId)
    .in('result',['WIN','LOSS'])
    .order('occurred_at',{ascending:false})
    .limit(30);

  if(error){
    console.warn('[companion-baseline] match lookup failed',error.message);
    return{games:0,required:COMPANION_DNA_BASELINE_REQUIRED,ready:false,role:role||null};
  }

  const ids=new Set<string>();
  for(const row of data??[]){
    if(Number(row.duration_seconds||0)<300)continue;
    if(role&&normalizeRole(row.role)!==role)continue;
    ids.add(String(row.id));
  }

  const games=Math.min(ids.size,COMPANION_DNA_BASELINE_REQUIRED);
  return{
    games,
    required:COMPANION_DNA_BASELINE_REQUIRED,
    ready:ids.size>=COMPANION_DNA_BASELINE_REQUIRED,
    role:role||null,
  };
}

export async function companionDnaRoleBaselines(input:{
  userId:string;
  riotAccountId:string|null;
}):Promise<Record<Role,{games:number;required:number;ready:boolean;role:Role}>>{
  const empty=Object.fromEntries(LEAGUE_ROLES.map(role=>[role,{games:0,required:COMPANION_DNA_BASELINE_REQUIRED,ready:false,role}])) as Record<Role,{games:number;required:number;ready:boolean;role:Role}>;
  const db=getSupabaseAdmin();
  if(!db||!input.riotAccountId)return empty;

  const {data,error}=await db.from('matches')
    .select('id,role,duration_seconds,result,occurred_at')
    .eq('user_id',input.userId)
    .eq('riot_account_id',input.riotAccountId)
    .in('result',['WIN','LOSS'])
    .order('occurred_at',{ascending:false})
    .limit(80);

  if(error){
    console.warn('[companion-baseline] role profile lookup failed',error.message);
    return empty;
  }

  const ids=Object.fromEntries(LEAGUE_ROLES.map(role=>[role,new Set<string>()])) as Record<Role,Set<string>>;
  for(const row of data??[]){
    if(Number(row.duration_seconds||0)<300)continue;
    const role=canonicalLeagueRole(row.role);
    if(!role)continue;
    ids[role].add(String(row.id));
  }

  return Object.fromEntries(LEAGUE_ROLES.map(role=>{
    const count=ids[role].size;
    return[role,{
      games:count,
      required:COMPANION_DNA_BASELINE_REQUIRED,
      ready:count>=COMPANION_DNA_BASELINE_REQUIRED,
      role,
    }];
  })) as Record<Role,{games:number;required:number;ready:boolean;role:Role}>;
}
