import {GameRecord} from './career';
import {HABITS,HABIT_IDS,HabitDef,HabitId} from '../habits/library';

/**
 * Career DNA.
 *
 * Read in stages, because what three games can tell you is not what ten can:
 *
 *   0–2 games   SCANNING     nothing is said yet
 *   3 games     FIRST_READ   early signals — only what showed up in 2 of 3
 *   5 games     PATTERNS     patterns — what shows up in 3 of 5
 *   10 games    ESTABLISHED  habits — the player's DNA, read from their last 10
 *   every game after 10      the DNA updates, and is compared with the player's
 *                            BIRTH DNA (their first 10 games) to show change
 *
 * Pure: the same career always produces the same DNA, so every snapshot in the
 * history can be recomputed rather than stored.
 */

export type Stage='SCANNING'|'FIRST_READ'|'PATTERNS'|'ESTABLISHED';
export const MILESTONES=[3,5,10] as const;
export const DNA_WINDOW=10;

/** How strongly a habit reads at the current stage. */
export type Level='HABIT'|'PATTERN'|'SIGNAL'|'WATCH'|'CLEAN';

export interface Trend{
  /** Rate in the player's first 10 games. */
  birthRate:number;
  /** Rate in their last 10. */
  currentRate:number;
  direction:'IMPROVING'|'WORSE'|'STEADY';
}

export interface HabitReading{
  id:HabitId;
  def:HabitDef;
  /** Games in the read where this habit could be measured. */
  measured:number;
  /** Of those, games where it happened. */
  occurred:number;
  /** occurred / measured. */
  rate:number;
  /** Average count per measured game, e.g. 1.4 deaths. */
  perGame:number;
  level:Level;
  trend?:Trend;
  /** Win rate in games with vs without it, when there are enough of each. */
  cost?:{withIt:number;withoutIt:number;gamesWith:number;gamesWithout:number};
  /** Count in the latest game, if measured there. */
  latest?:number;
}

export interface CareerDNA{
  stage:Stage;
  /** Relevant games in the whole career. */
  careerGames:number;
  /** Games this read is based on. */
  windowGames:number;
  /** The next milestone and how far away it is; null once established. */
  next:{at:number;remaining:number}|null;
  /** Habits worth acting on at this stage, worst first. */
  habits:HabitReading[];
  /** Things the player reliably does NOT do. */
  strengths:HabitReading[];
  /** Habits that were in the birth DNA and have since gone. */
  broken:HabitReading[];
  /** Every habit reading, for detail views. */
  all:HabitReading[];
  /** The latest game against the current habits. */
  latestGame?:{id:string;champion:string;result:'WIN'|'LOSS';showed:HabitId[];avoided:HabitId[]};
  record:{wins:number;losses:number};
}

export function stageFor(games:number):Stage{
  if(games>=10)return 'ESTABLISHED';
  if(games>=5)return 'PATTERNS';
  if(games>=3)return 'FIRST_READ';
  return 'SCANNING';
}

/* Thresholds per stage. A habit must clear both the rate and the minimum
   number of games it was measured in — one game can never make a habit. */
const RULES:Record<Exclude<Stage,'SCANNING'>,{level:Level;rate:number;minMeasured:number}>={
  FIRST_READ:{level:'SIGNAL',rate:2/3,minMeasured:2},
  PATTERNS:{level:'PATTERN',rate:0.6,minMeasured:3},
  ESTABLISHED:{level:'HABIT',rate:0.5,minMeasured:5},
};
const WATCH_RATE=0.3;
const STRENGTH_RATE=0.1;
const STRENGTH_MIN=5;
/** A rate change smaller than this is noise over ten games. */
const TREND_STEP=0.15;
/** A birth habit counts as broken once it is at or below this. */
const BROKEN_RATE=0.2;

function read(id:HabitId,games:GameRecord[]){
  const def=HABITS[id];
  const measuredGames=games.filter(g=>typeof g.habits[id]==='number');
  const occurredGames=measuredGames.filter(g=>(g.habits[id] as number)>=def.occursAt);
  const measured=measuredGames.length;
  const occurred=occurredGames.length;
  const total=measuredGames.reduce((n,g)=>n+(g.habits[id] as number),0);
  return {def,measuredGames,occurredGames,measured,occurred,
    rate:measured?occurred/measured:0,perGame:measured?total/measured:0};
}

const winRate=(gs:GameRecord[])=>gs.length?gs.filter(g=>g.result==='WIN').length/gs.length:0;
const r2=(n:number)=>Math.round(n*100)/100;

export function buildDNA(career:GameRecord[]):CareerDNA{
  const games=career.filter(g=>g.relevant);
  const stage=stageFor(games.length);
  const window=stage==='ESTABLISHED'?games.slice(-DNA_WINDOW):games;
  const birth=games.slice(0,DNA_WINDOW);
  const hasHistory=stage==='ESTABLISHED'&&games.length>DNA_WINDOW;
  const latest=games[games.length-1];

  const all:HabitReading[]=HABIT_IDS.map(id=>{
    const r=read(id,window);
    let level:Level='CLEAN';
    if(stage!=='SCANNING'){
      const rule=RULES[stage];
      if(r.measured>=rule.minMeasured&&r.rate>=rule.rate)level=rule.level;
      else if(stage==='ESTABLISHED'&&r.measured>=rule.minMeasured&&r.rate>=WATCH_RATE)level='WATCH';
    }

    const reading:HabitReading={id,def:r.def,measured:r.measured,occurred:r.occurred,
      rate:r2(r.rate),perGame:r2(r.perGame),level};

    if(latest&&typeof latest.habits[id]==='number')reading.latest=latest.habits[id];

    const without=r.measuredGames.filter(g=>!r.occurredGames.includes(g));
    if(r.occurredGames.length>=2&&without.length>=2){
      reading.cost={withIt:r2(winRate(r.occurredGames)),withoutIt:r2(winRate(without)),
        gamesWith:r.occurredGames.length,gamesWithout:without.length};
    }

    if(hasHistory){
      const b=read(id,birth);
      if(b.measured>=RULES.ESTABLISHED.minMeasured&&r.measured>=RULES.ESTABLISHED.minMeasured){
        const diff=r.rate-b.rate;
        reading.trend={birthRate:r2(b.rate),currentRate:r2(r.rate),
          direction:diff<=-TREND_STEP?'IMPROVING':diff>=TREND_STEP?'WORSE':'STEADY'};
      }
    }
    return reading;
  });

  const severity=(h:HabitReading)=>h.rate*(1+Math.min(h.perGame,3)/3);
  const flagged=all.filter(h=>h.level!=='CLEAN'&&h.level!=='WATCH').sort((a,b)=>severity(b)-severity(a));
  const watch=all.filter(h=>h.level==='WATCH').sort((a,b)=>severity(b)-severity(a));

  // Strengths: things the player reliably does not do, once there is enough to say so.
  const strengths=stage==='SCANNING'||stage==='FIRST_READ'?[]:
    all.filter(h=>h.measured>=STRENGTH_MIN&&h.rate<=STRENGTH_RATE);

  const broken=all.filter(h=>h.trend&&h.trend.birthRate>=RULES.ESTABLISHED.rate&&h.rate<=BROKEN_RATE);
  const brokenIds=new Set(broken.map(h=>h.id));

  const current=[...flagged,...watch];
  const latestGame=latest&&stage!=='SCANNING'?{
    id:latest.id,champion:latest.champion,result:latest.result,
    showed:current.filter(h=>typeof latest.habits[h.id]==='number'&&(latest.habits[h.id] as number)>=h.def.occursAt).map(h=>h.id),
    avoided:current.filter(h=>typeof latest.habits[h.id]==='number'&&(latest.habits[h.id] as number)<h.def.occursAt).map(h=>h.id),
  }:undefined;

  const next=stage==='ESTABLISHED'?null:(()=>{
    const at=MILESTONES.find(m=>m>games.length)!;
    return {at,remaining:at-games.length};
  })();

  return {
    stage,careerGames:games.length,windowGames:window.length,next,
    habits:current,
    strengths:strengths.filter(h=>!brokenIds.has(h.id)),
    broken,all,latestGame,
    record:{wins:window.filter(g=>g.result==='WIN').length,losses:window.filter(g=>g.result==='LOSS').length},
  };
}

/** One point in the DNA's history — how it read after a given game. */
export interface DNASnapshot{
  games:number;
  stage:Stage;
  milestone:boolean;
  habits:{id:HabitId;level:Level;rate:number}[];
}

/**
 * How the DNA formed and changed: the read at 3, 5 and 10 games, then after
 * every game. Recomputed from the career, so it can never drift from it.
 */
export function dnaHistory(career:GameRecord[],limit=40):DNASnapshot[]{
  const games=career.filter(g=>g.relevant);
  const points:number[]=[];
  for(const m of MILESTONES)if(games.length>=m)points.push(m);
  for(let n=DNA_WINDOW+1;n<=games.length;n++)points.push(n);
  return points.slice(-limit).map(n=>{
    const d=buildDNA(games.slice(0,n));
    return {
      games:n,stage:d.stage,milestone:(MILESTONES as readonly number[]).includes(n),
      habits:d.habits.map(h=>({id:h.id,level:h.level,rate:h.rate})),
    };
  });
}

/** The line a player reads first. */
export function dnaHeadline(d:CareerDNA):string{
  if(d.stage==='SCANNING'){
    return d.careerGames===0
      ?'Sync your ranked games and we start reading your DNA after 3.'
      :`${d.next!.remaining} more game${d.next!.remaining===1?'':'s'} until your first read.`;
  }
  const top=d.habits[0];
  if(!top){
    return d.stage==='ESTABLISHED'
      ?'No bad habit shows up in half your games. Your DNA is clean — keep it that way.'
      :'Nothing repeats yet. That is a good sign, and more games will confirm it.';
  }
  const pct=Math.round(top.rate*100);
  switch(d.stage){
    case 'FIRST_READ':return `Early signal: ${top.def.name.toLowerCase()} showed up in ${top.occurred} of your first ${top.measured} games.`;
    case 'PATTERNS':return `A pattern is forming: ${top.def.name.toLowerCase()} in ${top.occurred} of ${top.measured} games.`;
    default:return `Your biggest habit: ${top.def.name.toLowerCase()} — ${pct}% of your last ${d.windowGames} games.`;
  }
}
