import {GameRecord} from './career';
import {HABITS,HABIT_IDS,HabitId} from '../habits/library';

/**
 * The weekly DNA report: the last 7 days against the 10 games before them.
 *
 *   "This week: solo deaths down from 70% to 40%, dying before objectives
 *    unchanged. Focus: dying before objectives."
 *
 * Same rules as the DNA: a habit is only compared when it was measured enough
 * on both sides, and a change under 15 points is called unchanged — ten games
 * cannot tell 50% from 60%.
 */

export const REPORT_DAYS=7;
export const MIN_WEEK_GAMES=3;
export const BASELINE_GAMES=10;
const MIN_BASELINE=5;
const STEP=0.15;
/** Below this in both periods, a habit is not worth a line. */
const NOTABLE=0.3;

export type Change='IMPROVED'|'WORSE'|'UNCHANGED'|'NEW';
export interface ReportLine{id:HabitId;name:string;before:number|null;now:number;change:Change;gamesNow:number}
export interface WeeklyReport{
  status:'NOT_ENOUGH'|'FIRST_WEEK'|'READY';
  from:string;to:string;
  games:number;wins:number;losses:number;
  /** Games still needed this week before there is a report. */
  needed:number;
  lines:ReportLine[];
  focus:ReportLine|null;
  headline:string;
}

const pct=(n:number)=>`${Math.round(n*100)}%`;

function rateOf(id:HabitId,games:GameRecord[]){
  const def=HABITS[id];
  const measured=games.filter(g=>typeof g.habits[id]==='number');
  const hit=measured.filter(g=>(g.habits[id] as number)>=def.occursAt).length;
  return {measured:measured.length,rate:measured.length?hit/measured.length:0};
}

export function weeklyReport(career:GameRecord[],now:Date=new Date()):WeeklyReport{
  const end=now.getTime();
  const start=end-REPORT_DAYS*86_400_000;
  const relevant=career.filter(g=>g.relevant);
  const week=relevant.filter(g=>{const t=Date.parse(g.at);return t>start&&t<=end});
  const baseline=relevant.filter(g=>Date.parse(g.at)<=start).slice(-BASELINE_GAMES);
  const wins=week.filter(g=>g.result==='WIN').length;
  const base={from:new Date(start).toISOString(),to:new Date(end).toISOString(),games:week.length,wins,losses:week.length-wins};

  if(week.length<MIN_WEEK_GAMES){
    const needed=MIN_WEEK_GAMES-week.length;
    return {...base,status:'NOT_ENOUGH',needed,lines:[],focus:null,
      headline:week.length===0
        ?`No ranked games in the last ${REPORT_DAYS} days. Play ${MIN_WEEK_GAMES} and your weekly report appears.`
        :`${needed} more ranked game${needed===1?'':'s'} this week and your report is ready.`};
  }

  const hasBaseline=baseline.length>=MIN_BASELINE;
  const lines:ReportLine[]=[];
  for(const id of HABIT_IDS){
    const n=rateOf(id,week);
    if(n.measured<2)continue;
    const b=rateOf(id,baseline);
    const comparable=hasBaseline&&b.measured>=3;
    if(n.rate<NOTABLE&&(!comparable||b.rate<NOTABLE))continue;
    const change:Change=!comparable?'NEW'
      :n.rate<=b.rate-STEP?'IMPROVED':n.rate>=b.rate+STEP?'WORSE':'UNCHANGED';
    lines.push({id,name:HABITS[id].name,before:comparable?b.rate:null,now:n.rate,change,gamesNow:n.measured});
  }
  const order:Record<Change,number>={WORSE:0,IMPROVED:1,NEW:2,UNCHANGED:3};
  lines.sort((a,b)=>order[a.change]-order[b.change]||b.now-a.now);

  // Focus: the worst habit that is still there. Getting worse beats merely present.
  const candidates=lines.filter(l=>l.change!=='IMPROVED'&&l.now>=NOTABLE);
  const focus=[...candidates].sort((a,b)=>(a.change==='WORSE'?0:1)-(b.change==='WORSE'?0:1)||b.now-a.now)[0]||null;

  const phrase=(l:ReportLine)=>{
    const name=l.name.toLowerCase();
    switch(l.change){
      case 'IMPROVED':return `${name} down from ${pct(l.before!)} to ${pct(l.now)}`;
      case 'WORSE':return `${name} up from ${pct(l.before!)} to ${pct(l.now)}`;
      case 'UNCHANGED':return `${name} unchanged at ${pct(l.now)}`;
      default:return `${name} in ${pct(l.now)} of games`;
    }
  };
  const said=lines.slice(0,3).map(phrase);
  const body=said.length?`This week: ${said.join(', ')}.`:'This week: none of your habits showed up in more than a third of your games.';
  const tail=focus?` Focus: ${focus.name.toLowerCase()}.`:said.length?' No habit is holding you back right now — keep it that way.':'';

  return {...base,status:hasBaseline?'READY':'FIRST_WEEK',needed:0,lines,focus,headline:body+tail};
}
