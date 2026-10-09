import {Match,Role} from '../types';
import {RiotMatchDto,RiotParticipant,RiotTimelineDto,RiotTimelineEvent} from '../riot/riotTypes';
import {HabitId,HABITS,habitAppliesTo} from './library';

/**
 * Per-game habit detection. Pure functions: same game in, same counts out.
 *
 * Output is a count per habit. A habit that could not be measured in this game
 * is ABSENT from the result — never zero — so "you never do this" is only ever
 * said about games where we could actually look.
 */

export type HabitCounts=Partial<Record<HabitId,number>>;

/**
 * One timestamped occurrence of a habit — something a player can jump to in
 * League's replay viewer. Kept compact because it is stored on every match.
 */
export interface HabitMoment{
  /** Habit id. */
  h:HabitId;
  /** Game time in milliseconds. */
  t:number;
  /** What happened, in a sentence. */
  d:string;
}
export const MAX_MOMENTS_PER_GAME=25;

export function clock(ms:number){
  const s=Math.max(0,Math.floor(ms/1000));
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}
const OBJECTIVE_NAMES:Record<string,string>={
  DRAGON:'Dragon',BARON_NASHOR:'Baron',RIFTHERALD:'Rift Herald',HORDE:'Voidgrubs',ATAKHAN:'Atakhan',
};
/** "FIRE_DRAGON" → "Fire Dragon"; "BARON_NASHOR" → "Baron". */
function objectiveName(e:RiotTimelineEvent):string{
  if(e.monsterType==='DRAGON'&&e.monsterSubType){
    const kind=e.monsterSubType.replace(/_DRAGON$/,'').toLowerCase();
    return `${kind.charAt(0).toUpperCase()}${kind.slice(1)} Dragon`;
  }
  return OBJECTIVE_NAMES[e.monsterType||'']||'an objective';
}

/* ---- thresholds, named so the tests and the library copy cannot drift ---- */
export const GOLD_AT_DEATH=1200;
export const HOARD_GOLD=1500;
export const HOARD_MINUTES=2;
export const OBJECTIVE_WINDOW_MS=90_000;
export const BACK_TO_BACK_MS=150_000;
export const DEEP_DEATH_BEFORE_MS=25*60_000;
/** Summoner's Rift: the river runs along x + y ≈ 14,900. Margin keeps river deaths out. */
export const RIVER_SUM=14_900;
export const DEEP_MARGIN=2_000;
export const LATE_FARM_RATIO=0.8;
/** Remakes and games this short are kept, but never read for habits. */
export const MIN_RELEVANT_SECONDS=10*60;

export function isHabitRelevant(durationSeconds:number,remake=false){
  return !remake&&durationSeconds>=MIN_RELEVANT_SECONDS;
}

/** Everything the timeline detectors need, pulled out so they stay testable. */
export interface HabitInput{
  role:Role;
  teamId:number;
  participantId:number;
  durationSeconds:number;
  controlWardsBought?:number;
  laneCsPerMin?:number;
  post15CsPerMin?:number;
  /** Absent when Riot had no timeline for the game. */
  timeline?:{
    events:RiotTimelineEvent[];
    /** currentGold at each frame, in frame order, with the frame's timestamp. */
    gold:{t:number;gold:number}[];
    /** team of each participant, for working out who took an objective. */
    teamOf:Record<number,number>;
    /** champion of each participant, so a moment can say who killed you. */
    championOf?:Record<number,string>;
  };
}

export function inputFromRiot(dto:RiotMatchDto,timeline:RiotTimelineDto|null,me:RiotParticipant,
  role:Role,durationSeconds:number,metrics:{laneCsPerMin?:number;post15CsPerMin?:number}):HabitInput{
  const pid=String(me.participantId);
  return {
    role,teamId:me.teamId,participantId:me.participantId,durationSeconds,
    controlWardsBought:me.visionWardsBoughtInGame,
    laneCsPerMin:metrics.laneCsPerMin,post15CsPerMin:metrics.post15CsPerMin,
    timeline:timeline?{
      events:timeline.info.frames.flatMap(f=>f.events||[]),
      gold:timeline.info.frames
        .map(f=>({t:f.timestamp,gold:f.participantFrames[pid]?.currentGold}))
        .filter((g):g is {t:number;gold:number}=>typeof g.gold==='number'),
      teamOf:Object.fromEntries(dto.info.participants.map(p=>[p.participantId,p.teamId])),
      championOf:Object.fromEntries(dto.info.participants.map(p=>[p.participantId,p.championName])),
    }:undefined,
  };
}

export function detectHabits(input:HabitInput):HabitCounts{
  return analyseHabits(input).counts;
}

/** Counts plus the timestamped moments behind them. */
export function analyseHabits(input:HabitInput):{counts:HabitCounts;moments:HabitMoment[]}{
  const out:HabitCounts={};
  const moments:HabitMoment[]=[];
  const applies=(id:HabitId)=>habitAppliesTo(HABITS[id],input.role);
  const put=(id:HabitId,n:number|undefined)=>{
    if(n===undefined)return;
    if(!applies(id))return;
    out[id]=n;
  };
  const mark=(h:HabitId,t:number,d:string)=>{if(applies(h))moments.push({h,t,d})};
  const done=()=>({counts:out,moments:moments.sort((a,b)=>a.t-b.t).slice(0,MAX_MOMENTS_PER_GAME)});
  const minutes=input.durationSeconds/60;

  // --- from the match summary alone ---
  if(minutes>=20&&typeof input.controlWardsBought==='number'){
    put('noControlWard',input.controlWardsBought===0?1:0);
  }
  if(minutes>=22&&typeof input.laneCsPerMin==='number'&&typeof input.post15CsPerMin==='number'&&input.laneCsPerMin>=3){
    put('lateFarmDrop',input.post15CsPerMin<input.laneCsPerMin*LATE_FARM_RATIO?1:0);
  }

  const tl=input.timeline;
  if(!tl)return done();
  const killer=(d:RiotTimelineEvent)=>typeof d.killerId==='number'?tl.championOf?.[d.killerId]:undefined;
  /** "Killed by Zed …" when we know the killer, "Died …" when we do not. */
  const fell=(d:RiotTimelineEvent,rest:string)=>killer(d)?`Killed by ${killer(d)}${rest}`:`Died${rest}`;

  const myDeaths=tl.events
    .filter(e=>e.type==='CHAMPION_KILL'&&e.victimId===input.participantId)
    .sort((a,b)=>a.timestamp-b.timestamp);

  const solo=myDeaths.filter(e=>(e.assistingParticipantIds?.length||0)===0);
  put('soloDeath',solo.length);
  for(const d of solo)mark('soloDeath',d.timestamp,killer(d)?`Killed 1v1 by ${killer(d)}.`:'Killed 1v1.');

  const early=myDeaths.filter(e=>e.timestamp<600_000);
  put('earlyDeaths',early.length);
  // Only a habit from the second early death on, so only then is it a moment.
  if(early.length>=HABITS.earlyDeaths.occursAt)for(const d of early)mark('earlyDeaths',d.timestamp,fell(d,' before 10 minutes.'));

  // Back-to-back: a death soon after the previous one.
  let b2b=0;
  for(let i=1;i<myDeaths.length;i++){
    const gap=myDeaths[i].timestamp-myDeaths[i-1].timestamp;
    if(gap<=BACK_TO_BACK_MS){
      b2b++;
      mark('backToBackDeaths',myDeaths[i].timestamp,`Died again ${clock(gap)} after your death at ${clock(myDeaths[i-1].timestamp)}.`);
    }
  }
  put('backToBackDeaths',b2b);

  // Deaths in the window before the ENEMY took an objective.
  const enemyObjectives=tl.events.filter(e=>{
    if(e.type!=='ELITE_MONSTER_KILL')return false;
    const team=e.killerTeamId??(typeof e.killerId==='number'?tl.teamOf[e.killerId]:undefined);
    return typeof team==='number'&&team!==input.teamId;
  });
  let beforeObj=0;
  for(const d of myDeaths){
    const o=enemyObjectives.find(o=>o.timestamp>d.timestamp&&o.timestamp-d.timestamp<=OBJECTIVE_WINDOW_MS);
    if(!o)continue;
    beforeObj++;
    mark('deathBeforeObjective',d.timestamp,fell(d,` ${Math.round((o.timestamp-d.timestamp)/1000)}s before the enemy took ${objectiveName(o)}.`));
  }
  put('deathBeforeObjective',beforeObj);

  // Deep deaths: only counted when Riot supplied a position.
  const positioned=myDeaths.filter(d=>d.position&&d.timestamp<DEEP_DEATH_BEFORE_MS);
  if(myDeaths.every(d=>d.timestamp>=DEEP_DEATH_BEFORE_MS||d.position)){
    const deep=positioned.filter(d=>{
      const sum=d.position!.x+d.position!.y;
      return input.teamId===100?sum>RIVER_SUM+DEEP_MARGIN:sum<RIVER_SUM-DEEP_MARGIN;
    });
    put('deepDeath',deep.length);
    for(const d of deep)mark('deepDeath',d.timestamp,fell(d,' deep in the enemy half.'));
  }

  // Gold: needs minute-by-minute currentGold.
  if(tl.gold.length>=3){
    const goldBefore=(t:number)=>{
      let g:number|undefined;
      for(const f of tl.gold){if(f.t<=t)g=f.gold;else break}
      return g;
    };
    const withGold=myDeaths.filter(d=>d.timestamp>=180_000&&(goldBefore(d.timestamp)??0)>=GOLD_AT_DEATH);
    put('deathWithGold',withGold.length);
    for(const d of withGold){
      const g=goldBefore(d.timestamp)!;
      mark('deathWithGold',d.timestamp,fell(d,` holding ${(Math.floor(g/50)*50).toLocaleString('en-GB')}+ gold.`));
    }

    let episodes=0,run=0,start=0;
    const close=(end:number)=>{
      if(run>=HOARD_MINUTES)mark('hoardingGold',start,`Held 1,500+ gold from ${clock(start)} to ${clock(end)} without spending it.`);
    };
    for(const f of tl.gold){
      if(f.t<180_000)continue;
      if(f.gold>=HOARD_GOLD){
        if(run===0)start=f.t;
        run++;
        if(run===HOARD_MINUTES)episodes++;
      }else{
        close(f.t);
        run=0;
      }
    }
    if(run>0)close(tl.gold[tl.gold.length-1].t);
    put('hoardingGold',episodes);
  }
  return done();
}

/**
 * Habits recoverable from stored metrics alone — for demo games and for games
 * synced before habit detection existed. Only habits the metrics genuinely
 * support; the rest stay absent.
 */
export function habitsFromMetrics(m:Pick<Match,'role'|'durationSeconds'|'metrics'>):HabitCounts{
  const input:HabitInput={
    role:m.role,teamId:0,participantId:0,durationSeconds:m.durationSeconds,
    controlWardsBought:m.metrics.controlWards,
    laneCsPerMin:m.metrics.laneCsPerMin,post15CsPerMin:m.metrics.post15CsPerMin,
  };
  const out=detectHabits(input);
  const put=(id:HabitId,n?:number)=>{if(typeof n==='number'&&habitAppliesTo(HABITS[id],m.role))out[id]=n};
  put('soloDeath',m.metrics.soloDeaths);
  put('earlyDeaths',m.metrics.deathsPre10);
  return out;
}

/** The counts to use for a stored match: detected at sync, else recovered from metrics. */
export function habitsOf(m:Pick<Match,'role'|'durationSeconds'|'metrics'|'habits'>):HabitCounts{
  if(m.habits&&Object.keys(m.habits).length)return m.habits as HabitCounts;
  return habitsFromMetrics(m);
}
