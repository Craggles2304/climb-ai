import type {DnaDomain,ILPTask,Role} from './types';

export type CoachMemoryDbStatus='ACTIVE'|'IMPROVING'|'MASTERED';
export type CoachMemoryType='MISSION_HISTORY'|'MASTERY'|'PATTERN';

export interface CoachMemoryCandidate{
  key:string;
  type:CoachMemoryType;
  topic:string;
  summary:string;
  status:CoachMemoryDbStatus;
  role:Role|'GLOBAL';
  dnaDomain?:DnaDomain|null;
  metric?:string|null;
  memoryState:string;
  confidence?:string|null;
  occurredAt:string;
  occurrences:number;
  snapshot:Record<string,unknown>;
}

const ROLE_SET=new Set<Role>(['TOP','JUNGLE','MID','ADC','SUPPORT']);
const clean=(value:unknown)=>String(value??'').replace(/\s+/g,' ').trim();
const clamp=(value:string,max=1500)=>value.length>max?value.slice(0,max-1)+'…':value;
const roleOf=(value:unknown):Role|'GLOBAL'=>ROLE_SET.has(String(value||'').toUpperCase() as Role)?String(value).toUpperCase() as Role:'GLOBAL';
const allowedStatus=(state:string):CoachMemoryDbStatus=>{
  const s=state.toUpperCase();
  if(['MASTERED','RETAINED','PRINCIPLE_OWNED'].includes(s))return'MASTERED';
  if(['STABILISING','IMPROVING','RECOVERED','TRANSFERRING','GENERALISING'].includes(s))return'IMPROVING';
  return'ACTIVE';
};
function latestAt(task:any,fallback:string){
  const values=[...(task?.missionHistory??[]).map((x:any)=>x?.at),...(task?.history??[]).map((x:any)=>x?.at)].map(String).filter(Boolean).map(Date.parse).filter(Number.isFinite);
  if(!values.length)return fallback;
  return new Date(Math.max(...values)).toISOString();
}
function missionState(task:any,confirmed:number,required:number){
  if(String(task?.status).toUpperCase()==='MASTERED')return'MASTERED';
  if(confirmed>=Math.max(1,required-1))return'PROVING';
  if(confirmed>0)return'LEARNING';
  return'BUILDING';
}

export function mergeCoachMemoryEvidence(existing:unknown[],snapshot:Record<string,unknown>){
  const prior=Array.isArray(existing)?existing:[];
  const last=prior.at(-1) as Record<string,unknown>|undefined;
  const changed=!last||String(last.fingerprint||'')!==String(snapshot.fingerprint||'');
  return{changed,evidence:changed?[...prior,snapshot].slice(-24):prior};
}

export function buildCoachMemoryCandidates(input:{tasks:ILPTask[];roleProfiles:Record<string,any>;globalRecentChange?:any;now?:string}){
  const now=input.now??new Date().toISOString();
  const out:CoachMemoryCandidate[]=[];

  for(const task of input.tasks){
    if(!String(task.id||'').startsWith('dna-strand-'))continue;
    const role=roleOf(task.roleScope);
    const history=Array.isArray(task.missionHistory)?task.missionHistory:[];
    const confirmed=history.filter(item=>item?.banksPass).length;
    const required=Math.max(1,Number(task.masteryRequired)||3);
    const state=missionState(task,confirmed,required);
    const at=latestAt(task,now);
    const fingerprint=['mission',task.id,state,confirmed,required,String(task.status||''),history.length].join('|');
    const summary=clamp(`${role} ${task.dnaDomain}: ${task.title}. ${confirmed}/${required} proven reps. ${state==='MASTERED'?'Previously mastered and retained in history.':state==='PROVING'?'Close to mastery; keep testing the same behaviour.':state==='LEARNING'?'Learning is in progress from tracked evidence.':'Still building the first proven rep.'}`);
    out.push({
      key:`derived:mission:${role}:${task.id}`,
      type:state==='MASTERED'?'MASTERY':'MISSION_HISTORY',
      topic:`${role}:${task.dnaDomain}:${task.metric}`,
      summary,status:allowedStatus(state),role,dnaDomain:task.dnaDomain,metric:task.metric,memoryState:state,occurredAt:at,occurrences:Math.max(1,history.length),
      snapshot:{fingerprint,at,source:'DNA_MISSION',role,dnaDomain:task.dnaDomain,missionId:task.id,title:task.title,metric:task.metric,memoryState:state,confirmed,required,status:task.status,recentAttempts:history.slice(-6).map(item=>({matchId:item.matchId,at:item.at,outcome:item.outcome,banksPass:item.banksPass}))},
    });
  }

  const profiles:{role:Role|'GLOBAL';profile:any}[]=[];
  for(const role of ['TOP','JUNGLE','MID','ADC','SUPPORT'] as Role[]){if(input.roleProfiles?.[role])profiles.push({role,profile:input.roleProfiles[role]});}
  if(input.globalRecentChange)profiles.push({role:'GLOBAL',profile:{recentChange:input.globalRecentChange}});

  for(const {role,profile} of profiles){
    const recent=profile?.recentChange??profile?.recent_change??{};
    const generatedAt=clean(recent?.generatedAt)||now;
    const scenarios=Array.isArray(recent?.scenarioMemory?.cards)?recent.scenarioMemory.cards.slice(0,24):[];
    for(const card of scenarios){
      const state=clean(card?.state||'BUILDING').toUpperCase();
      const id=clean(card?.id||`${card?.behaviourKey||'behaviour'}:${card?.situationTag||'general'}`);
      const fingerprint=['scenario',role,id,state,card?.comparableGames,card?.cleanGames,card?.recentCleanRate,card?.memoryStrength].join('|');
      out.push({
        key:`derived:scenario:${role}:${id}`,type:'PATTERN',topic:`${role}:${clean(card?.behaviourKey)}:${clean(card?.situationTag)}`,
        summary:clamp(clean(card?.summary)||`${clean(card?.behaviourLabel)||'Behaviour'} memory is ${state.toLowerCase()}.`),
        status:allowedStatus(state),role,memoryState:state,confidence:clean(card?.confidence)||null,occurredAt:clean(card?.lastSeenAt)||generatedAt,occurrences:Math.max(1,Number(card?.comparableGames)||1),
        snapshot:{fingerprint,at:clean(card?.lastSeenAt)||generatedAt,source:'SCENARIO_MEMORY',role,memoryState:state,behaviourKey:card?.behaviourKey,behaviourLabel:card?.behaviourLabel,situationTag:card?.situationTag,confidence:card?.confidence,comparableGames:card?.comparableGames,cleanGames:card?.cleanGames,cleanRate:card?.cleanRate,recentCleanRate:card?.recentCleanRate,memoryStrength:card?.memoryStrength,lastVerdict:card?.lastVerdict,trigger:card?.trigger,targetBranch:card?.targetBranch,evidence:card?.evidence},
      });
    }

    const transfers=Array.isArray(recent?.decisionTransfer?.cards)?recent.decisionTransfer.cards.slice(0,18):[];
    for(const card of transfers){
      const state=clean(card?.state||'LOCAL_ONLY').toUpperCase();
      const id=clean(card?.id||`${card?.behaviourKey||'behaviour'}:${card?.sourceTag||'general'}`);
      const fingerprint=['transfer',role,id,state,card?.transferGames,card?.cleanTransferGames,card?.transferStrength,card?.breadthScore].join('|');
      out.push({
        key:`derived:transfer:${role}:${id}`,type:'PATTERN',topic:`${role}:TRANSFER:${clean(card?.behaviourKey)}`,
        summary:clamp(clean(card?.summary)||`${clean(card?.behaviourLabel)||'Behaviour'} transfer is ${state.toLowerCase()}.`),
        status:allowedStatus(state),role,memoryState:state,confidence:clean(card?.confidence)||null,occurredAt:clean(card?.lastTransferAt)||generatedAt,occurrences:Math.max(1,Number(card?.transferGames)||1),
        snapshot:{fingerprint,at:clean(card?.lastTransferAt)||generatedAt,source:'DECISION_TRANSFER',role,memoryState:state,behaviourKey:card?.behaviourKey,behaviourLabel:card?.behaviourLabel,confidence:card?.confidence,sourceChampion:card?.sourceChampion,sourceTag:card?.sourceTag,dimension:card?.dimension,transferGames:card?.transferGames,cleanTransferGames:card?.cleanTransferGames,transferCleanRate:card?.transferCleanRate,recentCleanRate:card?.recentCleanRate,transferStrength:card?.transferStrength,novelChampions:card?.novelChampions,novelContexts:card?.novelContexts,principle:card?.principle,evidence:card?.evidence},
      });
    }

    const identity=recent?.playerCoachingIdentity??null;
    const causal=recent?.causalProfile??null;
    const velocity=recent?.learningVelocity??null;
    const principles=recent?.decisionPrincipleEngine??null;
    const summaries=[identity?.summary,causal?.summary,velocity?.summary,principles?.summary].map(clean).filter(Boolean);
    if(summaries.length){
      const state=clean(identity?.status||causal?.status||'BUILDING').toUpperCase();
      const fingerprint=['league-mind',role,state,...summaries].join('|').slice(0,4000);
      out.push({
        key:`derived:league-mind:${role}`,type:'PATTERN',topic:`${role}:LEAGUE_MIND`,summary:clamp(summaries.join(' '),1800),
        status:allowedStatus(state),role,memoryState:state,confidence:clean(identity?.confidence||causal?.confidence)||null,occurredAt:generatedAt,occurrences:Math.max(1,Number(profile?.gamesAnalyzed)||1),
        snapshot:{fingerprint,at:generatedAt,source:'LEAGUE_MIND',role,memoryState:state,playerCoachingIdentitySummary:clean(identity?.summary),causalSummary:clean(causal?.summary),learningVelocitySummary:clean(velocity?.summary),principleSummary:clean(principles?.summary),currentFocus:profile?.currentFocus??null},
      });
    }
  }

  return out;
}