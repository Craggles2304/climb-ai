import type {DnaDomain,ILPMissionAttempt,ILPTask,Match,Role} from '../types';
import {DNA_DOMAINS,DNA_DOMAIN_GUIDE,DNA_DOMAIN_LABELS} from '../dnaDomain';
import {DNA_BASELINE_GAMES} from '../dnaGrowth';
import {missionStage,missionSummary,type MissionStage} from '../missionLoop';
import {verifiedMissionMastery,verifiedMissionRep} from '../verifiedMissionProof';
import {plainLanguageFocus} from '../plainLanguageCoaching';
import {currentGameDnaMissions,gameDnaStrands} from '../gameDnaSnapshot';
import {habitDomain,habitOfTask} from '../dna/plan';
import type {CareerDNA,HabitReading} from '../dna/dna';
import {championAssetId,championDisplayName} from '../championArt';

/**
 * Arena V2.1 dashboard view-models.
 *
 * Pure functions from the player's real state (matches, learning plan, Career DNA)
 * to what each dashboard section shows. Nothing here invents a value: anything that
 * cannot be derived comes back null, and the UI renders an explicit unknown state.
 */

/* ---------- rank ---------- */

export const RANK_TIERS=['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER'] as const;
export type RankTier=typeof RANK_TIERS[number];
export type RankInfo={tier:RankTier|null;division:string|null;lp:number|null;label:string;ranked:boolean};

const APEX=new Set<RankTier>(['MASTER','GRANDMASTER','CHALLENGER']);
const ROMAN:Record<string,string>={'1':'I','2':'II','3':'III','4':'IV',I:'I',II:'II',III:'III',IV:'IV'};
const title=(value:string)=>value.charAt(0)+value.slice(1).toLowerCase();

/** Reads "GOLD IV · 38 LP", "Gold IV · 38 LP", "MASTER · 120 LP" or "UNRANKED". */
export function parseRank(value:string|null|undefined):RankInfo{
  const upper=String(value??'').trim().toUpperCase();
  const tier=[...RANK_TIERS].sort((a,b)=>b.length-a.length).find(item=>new RegExp('\\b'+item+'\\b').test(upper))??null;
  if(!tier)return{tier:null,division:null,lp:null,label:'Unranked',ranked:false};
  const after=upper.slice(upper.indexOf(tier)+tier.length);
  const division=APEX.has(tier)?null:ROMAN[after.match(/^\s*(IV|III|II|I|[1-4])\b/)?.[1]??'']??null;
  const lpMatch=upper.match(/(-?\d+)\s*LP\b/);
  return{tier,division,lp:lpMatch?Number(lpMatch[1]):null,label:[title(tier),division].filter(Boolean).join(' '),ranked:true};
}

/* ---------- recent performance ---------- */

export type RecentForm={
  games:number;wins:number;losses:number;winRate:number|null;
  kills:number|null;deaths:number|null;assists:number|null;kdaRatio:number|null;
  csPerMin:number|null;results:Array<'WIN'|'LOSS'>;
};

const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const average=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const round1=(value:number|null)=>value===null?null:Math.round(value*10)/10;

/** A stored CS/min of zero means the metric was missing, not that the player farmed nothing. */
export function knownCsPerMin(match:Pick<Match,'metrics'>){
  const value=match.metrics?.csPerMin;
  return finite(value)&&value>0?value:null;
}

export function kdaRatio(kills:number,deaths:number,assists:number){
  return Math.round((kills+assists)/Math.max(1,deaths)*100)/100;
}

/** Recent form across the newest `limit` matches. `matches` must be newest first. */
export function recentForm(matches:Match[],limit=10):RecentForm{
  const recent=matches.slice(0,Math.max(0,limit));
  const wins=recent.filter(match=>match.result==='WIN').length;
  const kills=average(recent.map(match=>match.kills).filter(finite));
  const deaths=average(recent.map(match=>match.deaths).filter(finite));
  const assists=average(recent.map(match=>match.assists).filter(finite));
  const cs=average(recent.map(knownCsPerMin).filter((value):value is number=>value!==null));
  return{
    games:recent.length,
    wins,
    losses:recent.length-wins,
    winRate:recent.length?Math.round(wins/recent.length*100):null,
    kills:round1(kills),deaths:round1(deaths),assists:round1(assists),
    kdaRatio:kills!==null&&deaths!==null&&assists!==null?kdaRatio(kills,deaths,assists):null,
    csPerMin:round1(cs),
    results:recent.map(match=>match.result),
  };
}

/* ---------- main champion ---------- */

export type MainChampion={name:string;games:number;sample:number;source:'TRACKED'|'DECLARED'};

/**
 * The champion the player actually plays most in the sample, when it shows up at
 * least twice. Otherwise the main the player chose or declared, labelled as such.
 */
export function mainChampion(matches:Match[],declared:readonly string[]=[],chosen?:string|null,sample=20):MainChampion|null{
  const recent=matches.slice(0,sample);
  const counts=new Map<string,{name:string;games:number}>();
  for(const match of recent){
    const key=championAssetId(match.champion);
    if(!key)continue;
    const entry=counts.get(key)??{name:championDisplayName(match.champion),games:0};
    entry.games+=1;
    counts.set(key,entry);
  }
  const top=[...counts.values()].sort((a,b)=>b.games-a.games)[0];
  if(top&&top.games>=2)return{name:top.name,games:top.games,sample:recent.length,source:'TRACKED'};
  const declaredMain=String(chosen||declared[0]||'').trim();
  if(declaredMain)return{name:championDisplayName(declaredMain),games:0,sample:recent.length,source:'DECLARED'};
  if(top)return{name:top.name,games:top.games,sample:recent.length,source:'TRACKED'};
  return null;
}

/* ---------- missions ---------- */

export type EvidenceState='BANKED'|'MISSED'|'NOT_OBSERVED';

export function attemptState(task:Pick<ILPTask,'metric'|'target'>,attempt:ILPMissionAttempt|null|undefined):EvidenceState{
  if(verifiedMissionRep(task,attempt))return'BANKED';
  if(attempt?.evidenceV2?.state==='MISSED')return'MISSED';
  return'NOT_OBSERVED';
}

export const STAGE_LABEL:Record<MissionStage,string>={DISCOVER:'RECOGNISE',PRACTISE:'EXECUTE',REPEAT:'REPEAT',MASTERED:'MASTERED'};

export type MissionView={
  id:string;domain:DnaDomain;domainLabel:string;strandNumber:number;
  name:string;meaning:string;nextGame:string;success:string;why:string;
  confirmed:number;required:number;remaining:number;
  stage:MissionStage;stageLabel:string;
  unlocked:boolean;habit:boolean;mastered:boolean;
  latest:{matchId:string;at:string;state:EvidenceState;valueLabel:string|null;reason:string|null}|null;
  history:Array<{matchId:string;state:EvidenceState}>;
};

export function missionView(task:ILPTask):MissionView{
  const plain=plainLanguageFocus(task);
  const summary=missionSummary(task);
  const attempts=[...(task.missionHistory??[])].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  const latest=attempts[attempts.length-1]??null;
  const stage=missionStage(task);
  return{
    id:task.id,
    domain:task.dnaDomain,
    domainLabel:DNA_DOMAIN_LABELS[task.dnaDomain],
    strandNumber:DNA_DOMAINS.indexOf(task.dnaDomain)+1,
    name:plain.name,
    meaning:plain.meaning,
    nextGame:plain.nextGame||task.gameRule,
    success:plain.success,
    why:plain.why,
    confirmed:summary.confirmed,
    required:summary.required,
    remaining:summary.remaining,
    stage,
    stageLabel:STAGE_LABEL[stage],
    unlocked:task.dnaFocusUnlocked===true,
    habit:habitOfTask(task)!==null,
    mastered:verifiedMissionMastery(task),
    latest:latest?{
      matchId:latest.matchId,
      at:latest.at,
      state:attemptState(task,latest),
      valueLabel:latest.evidenceV2?.observedValueLabel||null,
      reason:latest.evidenceV2?.reason||null,
    }:null,
    history:attempts.slice(-5).map(attempt=>({matchId:attempt.matchId,state:attemptState(task,attempt)})),
  };
}

/* ---------- the climb journey ---------- */

export type JourneyKey='CONNECT'|'PLAY'|'REVEAL'|'TRAIN'|'VERIFY'|'EVOLVE';
export type JourneyStatus='DONE'|'CURRENT'|'LOCKED';
export type JourneyStageView={key:JourneyKey;label:string;status:JourneyStatus;detail:string;href:string;cta:string};

/**
 * CONNECT → PLAY → REVEAL DNA → TRAIN → VERIFY → EVOLVE.
 * Every stage is read from evidence the product already stores; none is awarded
 * for opening a page or entering a game.
 */
export function climbJourney(input:{
  deviceLoaded:boolean;linked:boolean;online:boolean;
  baselineGames:number;role:Role;dnaRevealed:boolean;
  missions:MissionView[];masteredCount:number;
}):JourneyStageView[]{
  const games=Math.max(0,input.baselineGames);
  const baselineReady=games>=DNA_BASELINE_GAMES;
  const connectDone=input.linked;
  const playDone=baselineReady;
  const revealDone=baselineReady&&input.dnaRevealed;
  const trainDone=revealDone&&input.missions.some(mission=>mission.latest!==null);
  const best=input.missions.reduce((top,mission)=>Math.max(top,Math.min(mission.confirmed,mission.required)),0);
  const required=input.missions[0]?.required??3;
  const verifyDone=revealDone&&input.missions.some(mission=>mission.confirmed>=mission.required);
  const evolveDone=input.masteredCount>0;
  const next=Math.min(games+1,DNA_BASELINE_GAMES);
  const plural=(n:number,word:string)=>`${n} ${word}${n===1?'':'s'}`;
  return[
    {key:'CONNECT',label:'CONNECT',status:connectDone?'DONE':'CURRENT',
      detail:!input.deviceLoaded?'Checking this PC…':input.online?'Companion live':connectDone?'Paired · offline':'Pair the Companion once',
      href:'/live',cta:connectDone?'Open Match Room':'Pair Companion'},
    {key:'PLAY',label:'PLAY',status:playDone?'DONE':connectDone||games>0?'CURRENT':'LOCKED',
      detail:`${Math.min(games,DNA_BASELINE_GAMES)}/${DNA_BASELINE_GAMES} ${input.role} baseline games`,
      href:'/live',cta:playDone?'Play next game':`Play baseline game ${next}`},
    {key:'REVEAL',label:'REVEAL DNA',status:revealDone?'DONE':baselineReady?'CURRENT':'LOCKED',
      detail:revealDone?'Six strands revealed':baselineReady?'Your DNA is ready':`Unlocks after game ${DNA_BASELINE_GAMES}`,
      href:'/ilp',cta:revealDone?'Open My DNA':'Reveal my DNA'},
    {key:'TRAIN',label:'TRAIN',status:trainDone?'DONE':revealDone&&input.missions.length?'CURRENT':'LOCKED',
      detail:input.missions.length&&revealDone?`${plural(input.missions.length,'DNA tree')} unlocked`:'Two DNA trees, one job each',
      href:'/missions',cta:'Open missions'},
    {key:'VERIFY',label:'VERIFY',status:verifyDone?'DONE':trainDone?'CURRENT':'LOCKED',
      detail:revealDone&&input.missions.length?`${best}/${required} verified games`:'Proof comes from tracked games',
      href:'/live',cta:'Play next game'},
    {key:'EVOLVE',label:'EVOLVE',status:evolveDone?'DONE':verifyDone?'CURRENT':'LOCKED',
      detail:evolveDone?`${plural(input.masteredCount,'mission')} mastered`:'Mastery levels the strand',
      href:'/ilp',cta:'See strand levels'},
  ];
}

/* ---------- Game DNA strands ---------- */

export type StrandMissionState='LOCKED'|'TRAINING'|'PROVEN'|'MASTERED';
export type HabitSignal={id:string;name:string;occurred:number;measured:number;level:HabitReading['level'];trend:'IMPROVING'|'WORSE'|'STEADY'|null};
export type StrandView={
  domain:DnaDomain;number:number;label:string;summary:string;subskills:string[];
  neutral:boolean;
  level:number;xpIntoLevel:number;xpForNextLevel:number;levelProgress:number;totalXp:number;mastered:number;
  mission:{id:string;name:string;confirmed:number;required:number;state:StrandMissionState}|null;
  habit:HabitSignal|null;
  /** A habit was flagged on this strand but the plan only shows the player's biggest one. */
  habitLocked:boolean;
};

function habitSignal(reading:HabitReading):HabitSignal{
  return{id:reading.id,name:reading.def.name,occurred:reading.occurred,measured:reading.measured,level:reading.level,trend:reading.trend?.direction??null};
}

export function strandViews(input:{tasks:ILPTask[];role:Role;baselineReady:boolean;dna:CareerDNA|null;allHabits:boolean}):StrandView[]{
  const strands=gameDnaStrands(input.tasks,input.role,input.baselineReady);
  const missions=new Map(currentGameDnaMissions(input.tasks,input.role).map(row=>[row.domain,row.task]));
  const habits=input.baselineReady?input.dna?.habits??[]:[];
  const visible=new Set(input.allHabits?habits.map(item=>item.id):habits.slice(0,1).map(item=>item.id));
  return strands.map((strand,index)=>{
    const task=input.baselineReady?missions.get(strand.domain)??null:null;
    const summary=task?missionSummary(task):null;
    const onStrand=habits.filter(item=>habitDomain(item.id)===strand.domain);
    const shown=onStrand.find(item=>visible.has(item.id))??null;
    const guide=DNA_DOMAIN_GUIDE[strand.domain];
    return{
      domain:strand.domain,
      number:index+1,
      label:strand.label,
      summary:guide.summary,
      subskills:guide.subskills,
      neutral:!input.baselineReady,
      level:strand.level,
      xpIntoLevel:strand.xpIntoLevel,
      xpForNextLevel:strand.xpForNextLevel,
      levelProgress:strand.levelProgress,
      totalXp:strand.totalXp,
      mastered:input.baselineReady?strand.mastered:0,
      mission:task&&summary?{
        id:task.id,
        name:plainLanguageFocus(task).name,
        confirmed:summary.confirmed,
        required:summary.required,
        state:verifiedMissionMastery(task)?'MASTERED':task.dnaFocusUnlocked!==true?'LOCKED':summary.confirmed>=summary.required?'PROVEN':'TRAINING',
      }:null,
      habit:shown?habitSignal(shown):null,
      habitLocked:!shown&&onStrand.length>0,
    };
  });
}

/* ---------- match history ---------- */

export type MatchRowView={
  id:string;championId:string;championName:string;role:Role;result:'WIN'|'LOSS';
  kills:number;deaths:number;assists:number;kdaRatio:number;
  csPerMin:number|null;killParticipation:number|null;visionScore:number|null;
  durationSeconds:number;durationLabel:string;playedAt:string;ago:string;
  missions:Array<{domain:DnaDomain;name:string;state:EvidenceState}>;
  habitsShown:number|null;
};

export function durationLabel(seconds:number){
  const safe=Math.max(0,Math.round(seconds));
  return `${Math.floor(safe/60)}:${String(safe%60).padStart(2,'0')}`;
}

export function agoLabel(iso:string,now=Date.now()){
  const ms=now-Date.parse(iso);
  if(!Number.isFinite(ms))return'—';
  if(ms<60_000)return'just now';
  const minutes=Math.floor(ms/60_000);
  if(minutes<60)return`${minutes}m ago`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return`${hours}h ago`;
  const days=Math.floor(hours/24);
  return days<30?`${days}d ago`:`${Math.floor(days/30)}mo ago`;
}

/** Kill participation is stored as a fraction from Riot; tolerate a stored percentage. */
export function percentOf(value:number|undefined){
  if(!finite(value)||value<0)return null;
  return Math.round(value>1?value:value*100);
}

function habitsShown(match:Match){
  if(match.habitRelevant===false||!match.habits)return null;
  const counts=Object.values(match.habits).filter(finite);
  if(!counts.length)return null;
  return counts.filter(value=>value>0).length;
}

/** `matches` newest first; `missionTasks` are the player's current DNA missions. */
export function matchRowViews(matches:Match[],missionTasks:ILPTask[],now=Date.now(),limit=8):MatchRowView[]{
  return matches.slice(0,limit).map(match=>({
    id:match.id,
    championId:championAssetId(match.champion),
    championName:championDisplayName(match.champion),
    role:match.role,
    result:match.result,
    kills:match.kills,deaths:match.deaths,assists:match.assists,
    kdaRatio:kdaRatio(match.kills,match.deaths,match.assists),
    csPerMin:knownCsPerMin(match),
    killParticipation:percentOf(match.metrics?.killParticipation),
    visionScore:finite(match.metrics?.visionScore)?Math.round(match.metrics.visionScore as number):null,
    durationSeconds:match.durationSeconds,
    durationLabel:durationLabel(match.durationSeconds),
    playedAt:match.createdAt,
    ago:agoLabel(match.createdAt,now),
    missions:missionTasks.flatMap(task=>{
      const attempt=(task.missionHistory??[]).find(item=>item.matchId===match.id);
      return attempt?[{domain:task.dnaDomain,name:plainLanguageFocus(task).name,state:attemptState(task,attempt)}]:[];
    }),
    habitsShown:habitsShown(match),
  }));
}
