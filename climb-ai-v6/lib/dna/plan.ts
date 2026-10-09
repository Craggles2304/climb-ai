import type {DnaDomain,ILPTask,Match,MissionEvidenceReceipt,Role} from '../types';
import {HABITS,HabitId} from '../habits/library';
import {clock,habitsOf} from '../habits/detect';
import {DNA_DOMAIN_LABELS,dnaDomainForCategory} from '../dnaDomain';

/**
 * Career DNA habits as Game DNA strand missions.
 *
 * Every habit belongs to one of the six DNA strands (through its category), and
 * a player can make a habit that strand's mission. The mission's metric is
 * `habit:<id>`. Each tracked game is CLEAN (the habit did not happen — a proven
 * rep), DIRTY (it did — a miss, with the moments as proof), or does not count
 * (remake, or the habit could not be measured in that game). Three clean games
 * master it, exactly like every other strand mission.
 */

export const HABIT_PREFIX='habit:';
export const HABIT_MISSION_TARGET='Clean game · 3 proven games';
const CLEAN_LABEL='Clean game';

/** The slice of a game habit grading needs: a full Match, or what the server loads for one. */
export type HabitGame=Pick<Match,'champion'|'role'|'durationSeconds'|'metrics'|'habits'|'habitRelevant'|'habitMoments'>;

export const habitOfTask=(t:Pick<ILPTask,'metric'>):HabitId|null=>
  String(t.metric||'').startsWith(HABIT_PREFIX)&&(t.metric.slice(HABIT_PREFIX.length) in HABITS)
    ?t.metric.slice(HABIT_PREFIX.length) as HabitId:null;

/** The Game DNA strand a habit lives in. */
export const habitDomain=(id:HabitId):DnaDomain=>dnaDomainForCategory(HABITS[id].category);

/** Habits grouped by strand, in strand order, for chips and labels. */
export function habitsByDomain(ids:readonly HabitId[]):{domain:DnaDomain;habits:HabitId[]}[]{
  const groups=new Map<DnaDomain,HabitId[]>();
  for(const id of ids){
    const domain=habitDomain(id);
    groups.set(domain,[...(groups.get(domain)??[]),id]);
  }
  return [...groups.entries()].map(([domain,habits])=>({domain,habits}));
}

/** The strand mission a habit becomes when the player makes it their mission. */
export function createHabitStrandMission(input:{
  accountId:string;role:Role;habit:HabitId;
  reading?:{occurred:number;measured:number;rate:number};
  dnaFocusUnlocked?:boolean;now?:Date;
}):ILPTask{
  const def=HABITS[input.habit];
  const domain=habitDomain(input.habit);
  const now=(input.now??new Date()).toISOString();
  const r=input.reading;
  return{
    // The trailing number keeps the strand's paused-mission restore order working.
    id:`dna-strand-${input.role.toLowerCase()}-${domain.toLowerCase()}-habit-${input.habit.toLowerCase()}-${Date.parse(now)}`,
    accountId:input.accountId,
    title:`Break it: ${def.name.toLowerCase()}`,
    dnaDomain:domain,
    category:def.category,
    why:r?`${def.why} It happened in ${r.occurred} of your last ${r.measured} games.`:def.why,
    gameRule:def.rule,
    metric:`${HABIT_PREFIX}${input.habit}`,
    target:HABIT_MISSION_TARGET,
    progress:0,
    metricProgress:0,
    missionProgress:0,
    status:'ACTIVE',
    source:'USER',
    evidence:[`DNA STRAND: ${DNA_DOMAIN_LABELS[domain]} · habit mission chosen from your Career DNA`],
    roleScope:input.role,
    roleEvidence:[input.role],
    priority:r?Math.round(50+r.rate*50):75,
    successfulGames:0,
    gamesObserved:0,
    masteryRequired:3,
    missionHistory:[],
    dnaFocusUnlocked:input.dnaFocusUnlocked,
    lastUpdatedReason:`New habit mission. Play 3 tracked ${input.role} games without ${def.name.toLowerCase()} to master it.`,
    history:[{at:now,type:'PROMOTED',note:`${DNA_DOMAIN_LABELS[domain]} strand mission set from Career DNA: ${def.name}.`}],
  };
}

/** Scoring one game against a habit task. `skip` = the game does not count. */
export function scoreHabitGame(task:Pick<ILPTask,'metric'>,game:HabitGame):{skip:boolean;clean:boolean;count?:number;note:string}{
  const id=habitOfTask(task)!;
  const def=HABITS[id];
  if(game.habitRelevant===false)return {skip:true,clean:false,note:'Remake — not counted.'};
  const n=habitsOf(game)[id];
  if(typeof n!=='number')return {skip:true,clean:false,note:`${def.name} could not be measured in that game, so it does not count either way.`};
  const clean=n<def.occursAt;
  return {skip:false,clean,count:n,note:clean
    ?`Clean game on ${game.champion}: no ${def.name.toLowerCase()}.`
    :`${def.name} happened ${n===1?'once':`${n} times`} on ${game.champion}.`};
}

/** Progress for a habit task over recent games (newest first): the clean share of measured games. */
export function evaluateHabit(task:Pick<ILPTask,'metric'|'progress'>,recent:HabitGame[]):{progress:number;passed:boolean;note:string;hasEvidence:boolean}{
  const id=habitOfTask(task)!;
  const scored=recent.map(m=>scoreHabitGame(task,m)).filter(s=>!s.skip);
  if(!scored.length)return {progress:task.progress,passed:false,note:`${HABITS[id].name} could not be measured in your recent games yet.`,hasEvidence:false};
  const clean=scored.filter(s=>s.clean).length;
  return {
    progress:Math.round(clean/scored.length*100),
    passed:scored[0].clean,
    note:`${scored[0].note} Clean in ${clean} of your last ${scored.length} measured games.`,
    hasEvidence:true,
  };
}

/**
 * One game graded against a habit mission, as a V2 evidence receipt so it goes
 * through the same verified-proof rules as every other strand mission. A clean
 * game banks with the end of the game as its timestamp; a dirty one is a miss
 * whose events are the moments the habit happened.
 */
export function gradeHabitGame(task:Pick<ILPTask,'metric'>,game:HabitGame|undefined):{
  available:boolean;passed:boolean;value:number|null;valueLabel:string;targetLabel:string;reason:string;evidenceV2:MissionEvidenceReceipt;
}{
  const id=habitOfTask(task)!;
  const def=HABITS[id];
  const notObserved=(valueLabel:string,reason:string)=>({
    available:false,passed:false,value:null,valueLabel,targetLabel:CLEAN_LABEL,reason,
    evidenceV2:{
      version:2 as const,state:'NOT_OBSERVED' as const,measurementSource:'RIOT_POST_GAME' as const,
      metric:task.metric,metricLabel:def.name,observedValue:null,observedValueLabel:'NOT OBSERVED',targetLabel:CLEAN_LABEL,
      confidence:'LOW' as const,opportunities:0,successes:0,misses:0,events:[],
      reconstruction:{kind:'MATCH_METRIC' as const,fields:[],formula:'No measurable game was available, so no result was banked.'},
      reason,
    },
  });
  if(!game)return notObserved('WAITING FOR A GAME','Complete a tracked game to create the next mission result.');
  const score=scoreHabitGame(task,game);
  if(score.skip)return notObserved(game.habitRelevant===false?'REMAKE':'EVIDENCE UNAVAILABLE',score.note);

  const n=score.count!;
  // Counts detected from the Riot timeline at sync are exact; ones recovered from stored metrics are a step weaker.
  const fromTimeline=Boolean(game.habits&&Object.keys(game.habits).length);
  const end=Math.max(0,Math.round(game.durationSeconds));
  const valueLabel=score.clean?'CLEAN':`${n} ${n===1?def.unit:def.unit+'s'}`;
  const moments=(game.habitMoments??[]).filter(m=>m.h===id);
  const events=score.clean
    ?[{atSeconds:end,label:CLEAN_LABEL,detail:`No ${def.name.toLowerCase()} across the full ${clock(end*1000)} game.`}]
    :moments.length
      ?moments.slice(0,8).map(m=>({atSeconds:Math.max(0,Math.round(m.t/1000)),label:def.name,detail:m.d}))
      :[{atSeconds:end,label:def.name,detail:`${def.name} happened ${n===1?'once':`${n} times`} in this game.`}];
  return{
    available:true,passed:score.clean,value:n,valueLabel,targetLabel:CLEAN_LABEL,reason:score.note,
    evidenceV2:{
      version:2,state:score.clean?'BANKED':'MISSED',measurementSource:'RIOT_POST_GAME',
      metric:task.metric,metricLabel:def.name,observedValue:n,observedValueLabel:valueLabel,targetLabel:CLEAN_LABEL,
      confidence:fromTimeline?'HIGH':'MEDIUM',
      opportunities:1,successes:score.clean?1:0,misses:score.clean?0:1,events,
      reconstruction:{
        kind:'MATCH_METRIC',
        fields:[fromTimeline?`match.habits.${id}`:'match.metrics'],
        formula:`${n} ${def.unit}${n===1?'':'s'} · clean below ${def.occursAt}`,
      },
      reason:score.note,
    },
  };
}
