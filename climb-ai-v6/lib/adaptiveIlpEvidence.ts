import {candidateTasks} from './ilpEngine';
import type {ILPTask,IssueCategory,Role} from './types';
import type {HistoryAnalysisRow,ProHistoryFix,ProLearningProfile} from './riot/proHistory';

export type AdaptiveIlpAction='WATCH'|'PROMOTED'|'STRENGTHENED'|'REVISED'|'MASTERED'|'REOPENED'|'REFILLED';

export interface AdaptiveIlpMeta{
  version:1;
  managedBy:'POST_GAME_EVIDENCE';
  patternKey:string;
  confidence:number;
  recentSupportGames:number;
  recentWindow:number;
  recentOccurrences:number;
  totalSupportGames:number;
  cleanStreak:number;
  activatedAfter:string|null;
  lastEvidenceAt:string|null;
  lastAction:AdaptiveIlpAction;
}

type AdaptiveTask=ILPTask&{adaptive?:AdaptiveIlpMeta};
export interface AdaptiveIlpInput{
  tasks:ILPTask[];
  profile:ProLearningProfile;
  history:HistoryAnalysisRow[];
  accountId:string;
  role?:string|null;
  now?:string;
}
export interface AdaptiveIlpResult{tasks:ILPTask[];changes:string[]}

type PatternEvidence={
  recentSupportGames:number;
  recentWindow:number;
  recentOccurrences:number;
  totalSupportGames:number;
  totalOccurrences:number;
  lastEvidenceAt:string|null;
};

const ACTIVE_LIMIT=5;
const MASTERY_CLEAN_GAMES=3;
const RECENT_WINDOW=5;
const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));
const isLive=(task:ILPTask)=>task.status!=='MASTERED'&&task.status!=='PAUSED';
const norm=(value:unknown)=>String(value??'').toLowerCase().replace(/^op priority:\s*/,'').replace(/[^a-z0-9]+/g,' ').trim();
const at=(value:string)=>Number.isFinite(Date.parse(value))?Date.parse(value):0;

export function adaptActiveFiveFromPostGameEvidence(input:AdaptiveIlpInput):AdaptiveIlpResult{
  const now=input.now??new Date().toISOString();
  const history=[...input.history].sort((a,b)=>at(a.createdAt)-at(b.createdAt));
  const fixes=new Map(input.profile.fixLadder.map(fix=>[fix.key,fix]));
  const changes:string[]=[];
  let tasks=(input.tasks as AdaptiveTask[]).map(task=>({...task}));

  // Upgrade the legacy single-slot PRO task in-place. This avoids duplicate missions
  // for players who already had `op-pro-priority` before the stabilised loop shipped.
  tasks=tasks.map(task=>{
    if(task.adaptive?.managedBy==='POST_GAME_EVIDENCE')return task;
    const fix=legacyFix(task,input.profile.fixLadder);
    if(!fix)return task;
    const evidence=patternEvidence(fix.key,history);
    changes.push(`${task.title} moved onto the repeated-evidence mission loop.`);
    return attachAdaptive(task,fix,evidence,input.profile.latestAnalysisAt,now,'REVISED');
  });

  // Update every evidence-managed mission before considering a new promotion.
  tasks=tasks.map(task=>{
    const meta=task.adaptive;
    if(!meta||meta.managedBy!=='POST_GAME_EVIDENCE')return task;
    const evidence=patternEvidence(meta.patternKey,history);
    const fix=fixes.get(meta.patternKey)??fixFromTask(task,meta.patternKey,evidence);
    const confidence=patternConfidence(fix,evidence);

    if(task.status==='MASTERED'){
      if(promotionReady(fix,evidence)&&evidence.recentSupportGames>=2){
        changes.push(`${fix.title} reopened after the same leak repeated again.`);
        return reviseManagedTask(task,fix,evidence,confidence,now,'REOPENED',0,'ACTIVE',input.profile.latestAnalysisAt);
      }
      return withMeta(task,{...meta,confidence,...evidenceForMeta(evidence),lastAction:'WATCH'});
    }

    const sinceActivation=rowsAfter(history,meta.activatedAfter);
    const cleanStreak=consecutiveClean(meta.patternKey,sinceActivation);
    if(sinceActivation.length>=MASTERY_CLEAN_GAMES&&cleanStreak>=MASTERY_CLEAN_GAMES){
      changes.push(`${fix.title} mastered after ${MASTERY_CLEAN_GAMES} consecutive clean games.`);
      return reviseManagedTask(task,fix,evidence,confidence,now,'MASTERED',100,'MASTERED',meta.activatedAfter,cleanStreak,sinceActivation.length);
    }

    const progress=clamp(cleanStreak/MASTERY_CLEAN_GAMES*100);
    const stronger=evidence.recentSupportGames>=2;
    const action:AdaptiveIlpAction=stronger?'STRENGTHENED':'WATCH';
    if(stronger&&confidence>Number(meta.confidence||0)+4)changes.push(`${fix.title} strengthened by repeated post-game evidence.`);
    return reviseManagedTask(task,fix,evidence,confidence,now,action,progress,stronger?'ACTIVE':'EVIDENCE_BUILDING',meta.activatedAfter,cleanStreak,sinceActivation.length);
  });

  // If repeated evidence maps to an existing Coach/User task, revise that mission
  // instead of creating a competing duplicate. The current game establishes the
  // baseline; mastery still requires three future clean games.
  for(const fix of rankedFixes(input.profile.fixLadder,history)){
    const evidence=patternEvidence(fix.key,history);
    if(!promotionReady(fix,evidence)||represented(tasks,fix.key))continue;
    const same=tasks.find(task=>isLive(task)&&sameBehaviour(task,fix));
    if(same){
      tasks=tasks.map(task=>task.id===same.id?attachAdaptive(task,fix,evidence,input.profile.latestAnalysisAt,now,'REVISED'):task);
      changes.push(`${same.title} revised with repeated match evidence instead of adding a duplicate mission.`);
    }
  }

  // Promote repeated leaks only. A one-game spike can raise confidence on an
  // existing mission, but it cannot displace another member of the Active Five.
  for(const fix of rankedFixes(input.profile.fixLadder,history)){
    const evidence=patternEvidence(fix.key,history);
    if(!promotionReady(fix,evidence)||represented(tasks,fix.key))continue;
    const candidate=createAdaptiveTask(input.accountId,fix,evidence,input.profile.latestAnalysisAt,now,normaliseRole(input.role));
    const live=tasks.filter(isLive);
    if(live.length<ACTIVE_LIMIT){
      tasks.push(candidate);changes.push(`${fix.title} promoted after repeating across multiple games.`);continue;
    }
    const replaceable=lowestReplaceable(live,candidate);
    if(!replaceable)continue;
    tasks=tasks.map(task=>task.id===replaceable.id?pauseForReplacement(task,candidate.title,now):task);
    tasks.push(candidate);
    changes.push(`${candidate.title} replaced lower-confidence system focus ${replaceable.title}.`);
  }

  tasks=capActiveFive(tasks,now,changes);
  tasks=refillActiveFive(tasks,input.accountId,normaliseRole(input.role),now,changes);
  tasks=capActiveFive(tasks,now,changes);
  return{tasks,changes};
}

function rankedFixes(fixes:ProHistoryFix[],history:HistoryAnalysisRow[]){
  return [...fixes].sort((a,b)=>{
    const ea=patternEvidence(a.key,history),eb=patternEvidence(b.key,history);
    return patternConfidence(b,eb)-patternConfidence(a,ea)||eb.recentSupportGames-ea.recentSupportGames||b.gamesSeen-a.gamesSeen;
  });
}

function patternEvidence(key:string,history:HistoryAnalysisRow[]):PatternEvidence{
  const counts=history.map(row=>({at:row.createdAt,count:leakCount(row,key)}));
  const recent=counts.slice(-RECENT_WINDOW);
  return{
    recentSupportGames:recent.filter(row=>row.count>0).length,
    recentWindow:recent.length,
    recentOccurrences:recent.reduce((sum,row)=>sum+row.count,0),
    totalSupportGames:counts.filter(row=>row.count>0).length,
    totalOccurrences:counts.reduce((sum,row)=>sum+row.count,0),
    lastEvidenceAt:[...counts].reverse().find(row=>row.count>0)?.at??null,
  };
}
function leakCount(row:HistoryAnalysisRow,key:string){return (row.analysis?.leakSignals??[]).filter(leak=>leak.key===key).reduce((sum,leak)=>sum+Math.max(0,Number(leak.count)||0),0)}
function patternConfidence(fix:ProHistoryFix,evidence:PatternEvidence){
  const rate=evidence.recentWindow?evidence.recentSupportGames/evidence.recentWindow:0;
  const severity={CRITICAL:20,MAJOR:15,ACTIVE:10,POLISH:5}[fix.severity]??5;
  return clamp(rate*45+Math.min(30,evidence.totalSupportGames*10)+severity);
}
function promotionReady(fix:ProHistoryFix,evidence:PatternEvidence){
  if(evidence.recentSupportGames>=2&&evidence.recentOccurrences>=2)return true;
  return fix.gamesSeen>=3&&evidence.recentSupportGames>=1&&evidence.recentWindow>=3;
}
function rowsAfter(history:HistoryAnalysisRow[],cutoff:string|null){if(!cutoff)return[];const stamp=at(cutoff);return history.filter(row=>at(row.createdAt)>stamp)}
function consecutiveClean(key:string,rows:HistoryAnalysisRow[]){let count=0;for(let i=rows.length-1;i>=0;i--){if(leakCount(rows[i],key)>0)break;count++}return count}
function evidenceForMeta(evidence:PatternEvidence){return{recentSupportGames:evidence.recentSupportGames,recentWindow:evidence.recentWindow,recentOccurrences:evidence.recentOccurrences,totalSupportGames:evidence.totalSupportGames,lastEvidenceAt:evidence.lastEvidenceAt}}

function attachAdaptive(task:AdaptiveTask,fix:ProHistoryFix,evidence:PatternEvidence,activatedAfter:string|null,now:string,action:AdaptiveIlpAction):AdaptiveTask{
  const confidence=patternConfidence(fix,evidence);
  return{
    ...task,
    title:task.source==='SYSTEM'?fix.title:task.title,
    category:categoryForFix(fix),why:fix.why,gameRule:fix.rule,target:fix.mastery,
    priority:Math.max(Number(task.priority||0),adaptivePriority(fix,confidence)),
    status:task.status==='MASTERED'?'MASTERED':'EVIDENCE_BUILDING',
    evidence:evidenceLines(fix,evidence,confidence),
    gamesObserved:0,successfulGames:0,masteryRequired:MASTERY_CLEAN_GAMES,
    lastUpdatedReason:`Repeated evidence confirmed ${fix.title}; mastery now requires ${MASTERY_CLEAN_GAMES} clean games after activation.`,
    adaptive:{version:1,managedBy:'POST_GAME_EVIDENCE',patternKey:fix.key,confidence,...evidenceForMeta(evidence),cleanStreak:0,activatedAfter:activatedAfter??null,lastAction:action},
    history:[...(task.history??[]),{at:now,type:'EVIDENCE_REVISED',note:`Linked to repeated ${fix.key} evidence at ${confidence}% confidence. Future clean games, not the triggering game, count toward mastery.`}].slice(-12),
  };
}

function reviseManagedTask(task:AdaptiveTask,fix:ProHistoryFix,evidence:PatternEvidence,confidence:number,now:string,action:AdaptiveIlpAction,progress:number,status:ILPTask['status'],activatedAfter:string|null,cleanStreak=0,gamesObserved=0):AdaptiveTask{
  const prior=task.adaptive!;
  const changedCopy=norm(task.title)!==norm(fix.title)||norm(task.gameRule)!==norm(fix.rule);
  const event=action==='MASTERED'?'MASTERED':action==='REOPENED'?'REOPENED':changedCopy?'EVIDENCE_REVISED':'PROGRESS';
  const reason=action==='MASTERED'
    ?`${MASTERY_CLEAN_GAMES} consecutive clean games after activation removed the repeated ${fix.key} signal.`
    :action==='REOPENED'
      ?`${fix.key} repeated again in ${evidence.recentSupportGames} of the last ${evidence.recentWindow} evidence-backed games.`
      :`${fix.title}: ${evidence.recentSupportGames}/${evidence.recentWindow||0} recent games showed the pattern; clean streak ${cleanStreak}/${MASTERY_CLEAN_GAMES}.`;
  return{
    ...task,title:task.source==='SYSTEM'?fix.title:task.title,category:categoryForFix(fix),why:fix.why,gameRule:fix.rule,target:fix.mastery,
    progress,metricProgress:progress,missionProgress:progress,status,
    priority:adaptivePriority(fix,confidence),successfulGames:cleanStreak,gamesObserved,masteryRequired:MASTERY_CLEAN_GAMES,
    evidence:evidenceLines(fix,evidence,confidence),lastUpdatedReason:reason,
    adaptive:{...prior,confidence,...evidenceForMeta(evidence),cleanStreak,activatedAfter:action==='REOPENED'?(activatedAfter??prior.activatedAfter):prior.activatedAfter,lastAction:action},
    history:[...(task.history??[]),{at:now,type:event,note:reason}].slice(-12),
  };
}

function createAdaptiveTask(accountId:string,fix:ProHistoryFix,evidence:PatternEvidence,activatedAfter:string|null,now:string,role:Role|null):AdaptiveTask{
  const confidence=patternConfidence(fix,evidence);
  return{
    id:`op-pro-${(role??'global').toLowerCase()}-${fix.key.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,accountId,title:fix.title,category:categoryForFix(fix),why:fix.why,gameRule:fix.rule,
    metric:'OP PRO Fix Ladder',target:fix.mastery,progress:0,status:'EVIDENCE_BUILDING',source:'SYSTEM',evidence:evidenceLines(fix,evidence,confidence),
    priority:adaptivePriority(fix,confidence),successfulGames:0,gamesObserved:0,masteryRequired:MASTERY_CLEAN_GAMES,roleScope:role??'GLOBAL',roleEvidence:role?[role]:[],
    lastUpdatedReason:`Promoted only after repeated post-game evidence. ${MASTERY_CLEAN_GAMES} future clean games are required for mastery.`,
    adaptive:{version:1,managedBy:'POST_GAME_EVIDENCE',patternKey:fix.key,confidence,...evidenceForMeta(evidence),cleanStreak:0,activatedAfter:activatedAfter??null,lastAction:'PROMOTED'},
    history:[{at:now,type:'PROMOTED',note:`Promoted after ${evidence.recentSupportGames}/${evidence.recentWindow} recent games showed ${fix.key}; confidence ${confidence}%.`}],
  };
}

function evidenceLines(fix:ProHistoryFix,evidence:PatternEvidence,confidence:number){return[
  `AUTO: ${fix.title} appeared in ${evidence.recentSupportGames} of the last ${evidence.recentWindow} evidence-backed games (${evidence.recentOccurrences} occurrence${evidence.recentOccurrences===1?'':'s'}).`,
  `AUTO: ${evidence.totalSupportGames} tracked games contain this pattern; confidence ${confidence}%.`,
  `AUTO: One unusual match cannot promote, replace or reopen this mission on its own.`,
]}
function adaptivePriority(fix:ProHistoryFix,confidence:number){const base={CRITICAL:94,MAJOR:88,ACTIVE:80,POLISH:72}[fix.severity]??72;return Math.min(100,base+Math.round(confidence/20))}
function represented(tasks:AdaptiveTask[],key:string){return tasks.some(task=>task.adaptive?.patternKey===key&&task.status!=='PAUSED')}
function sameBehaviour(task:ILPTask,fix:ProHistoryFix){return norm(task.title)===norm(fix.title)||norm(task.gameRule)===norm(fix.rule)}
function legacyFix(task:AdaptiveTask,fixes:ProHistoryFix[]){if(task.id!=='op-pro-priority')return null;return fixes.find(fix=>sameBehaviour(task,fix))??fixes[0]??null}
function fixFromTask(task:AdaptiveTask,key:string,evidence:PatternEvidence):ProHistoryFix{return{key,stage:'MASTERY',severity:evidence.recentSupportGames>=3?'MAJOR':'ACTIVE',title:task.title,why:task.why,rule:task.gameRule,mastery:task.target,gamesSeen:evidence.totalSupportGames,occurrences:evidence.totalOccurrences}}
function categoryForFix(fix:ProHistoryFix):IssueCategory{const map:Record<string,IssueCategory>={BANKING_LEAK:'TEMPO',RED_STATE:'TRADING',CHAIN_DEATH:'DEATHS',LEAD_THROW:'CONSISTENCY',CARRY_DEATH:'POSITIONING'};return map[fix.key]??'CONSISTENCY'}
function withMeta(task:AdaptiveTask,adaptive:AdaptiveIlpMeta):AdaptiveTask{return{...task,adaptive}}

function lowestReplaceable(live:AdaptiveTask[],candidate:AdaptiveTask){
  const system=live.filter(task=>task.source==='SYSTEM');
  const ranked=[...system].sort((a,b)=>Number(a.priority??50)-Number(b.priority??50));
  for(const current of ranked){
    const adaptive=current.adaptive?.managedBy==='POST_GAME_EVIDENCE';
    const margin=adaptive?20:8;
    const supportNeeded=adaptive?3:2;
    if((candidate.adaptive?.recentSupportGames??0)<supportNeeded)continue;
    if(Number(candidate.priority??0)>=Number(current.priority??50)+margin)return current;
  }
  return null;
}
function pauseForReplacement(task:AdaptiveTask,title:string,now:string):AdaptiveTask{return{...task,status:'PAUSED',lastUpdatedReason:`Paused automatically after repeated evidence promoted a stronger system focus: ${title}`,history:[...(task.history??[]),{at:now,type:'PAUSED',note:`Replaced only after repeated evidence promoted ${title}.`}].slice(-12)}}

function capActiveFive(tasks:AdaptiveTask[],now:string,changes:string[]){
  let next=[...tasks];let live=next.filter(isLive);if(live.length<=ACTIVE_LIMIT)return next;
  const ordered=[...live].sort((a,b)=>{
    const aProtected=a.source==='SYSTEM'?0:1,bProtected=b.source==='SYSTEM'?0:1;
    return aProtected-bProtected||Number(a.priority??50)-Number(b.priority??50);
  });
  const pause=new Set(ordered.slice(0,live.length-ACTIVE_LIMIT).map(task=>task.id));
  next=next.map(task=>pause.has(task.id)?{...task,status:'PAUSED' as const,lastUpdatedReason:'Paused automatically to keep the development plan at exactly five active missions.',history:[...(task.history??[]),{at:now,type:'PAUSED',note:'Active Five cap applied after evidence adaptation.'}].slice(-12)}:task);
  if(pause.size)changes.push(`Active Five cap paused ${pause.size} lower-priority mission${pause.size===1?'':'s'}.`);
  return next;
}

function refillActiveFive(tasks:AdaptiveTask[],accountId:string,role:Role|null,now:string,changes:string[]){
  let next=[...tasks];
  let needed=ACTIVE_LIMIT-next.filter(isLive).length;if(needed<=0)return next;
  const resumable=next.filter(task=>task.status==='PAUSED'&&!pausedByPlayer(task)).sort((a,b)=>Number(b.priority??50)-Number(a.priority??50));
  for(const task of resumable){if(needed<=0)break;next=next.map(row=>row.id===task.id?{...row,status:'ACTIVE' as const,lastUpdatedReason:'Returned automatically to keep five active development missions.',history:[...(row.history??[]),{at:now,type:'PROMOTED',note:'Returned to fill an Active Five vacancy.'}].slice(-12)}:row);needed--;changes.push(`${task.title} returned to fill an Active Five vacancy.`)}
  if(needed<=0||!role)return next;
  const representedKeys=new Set(next.map(task=>`${norm(task.title)}|${norm(task.metric)}`));
  for(const [key,candidate] of Object.entries(candidateTasks as Record<string,any>)){
    if(needed<=0)break;
    if(Array.isArray(candidate.roles)&&!candidate.roles.includes(role))continue;
    const signature=`${norm(candidate.title)}|${norm(candidate.metric)}`;if(representedKeys.has(signature))continue;
    const id=`system-${role.toLowerCase()}-${key}-adaptive-fill`;if(next.some(task=>task.id===id))continue;
    const task:AdaptiveTask={id,accountId,title:String(candidate.title),category:candidate.category,why:String(candidate.why),gameRule:String(candidate.gameRule),metric:String(candidate.metric),target:String(candidate.target),progress:0,status:'ACTIVE',source:'SYSTEM',evidence:['SYSTEM: Active Five vacancy refill. Evidence will confirm, revise or replace this baseline over future games.'],priority:Number(candidate.priority??50),successfulGames:0,gamesObserved:0,masteryRequired:Number(candidate.masteryRequired??3),roleScope:role,roleEvidence:[role],lastUpdatedReason:'Added as a role-safe baseline because an Active Five vacancy remained after post-game adaptation.',history:[{at:now,type:'PROMOTED',note:'Role-safe baseline filled an Active Five vacancy.'}]};
    next.push(task);representedKeys.add(signature);needed--;changes.push(`${task.title} added to keep five active missions.`)
  }
  return next;
}
function pausedByPlayer(task:ILPTask){if(/paused by player/i.test(task.lastUpdatedReason??''))return true;const last=[...(task.history??[])].reverse().find(entry=>String(entry.type).toUpperCase()==='PAUSED');return Boolean(last&&/by player/i.test(last.note))}
function normaliseRole(value:string|null|undefined):Role|null{const role=String(value??'').toUpperCase();return(['TOP','JUNGLE','MID','ADC','SUPPORT'] as Role[]).includes(role as Role)?role as Role:null}
