import {ILPTask,Match,IssueCategory} from '@/lib/types';

type Eval={progress:number;passed:boolean;note:string};
const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));

function evaluateMetric(task:ILPTask,matches:Match[]):Eval{
  const recent=matches.slice(0,5);
  const vals=(key:keyof Match['metrics'])=>recent.map(m=>m.metrics[key]).filter((v):v is number=>typeof v==='number');
  switch(task.metric){
    case 'post15CsPerMin':{const a=avg(vals('post15CsPerMin'));const p=clamp((a/6)*100);return{progress:p,passed:a>=6,note:`Recent post-15 farm: ${a.toFixed(1)} CS/min.`}}
    case 'deathsPost20':{const a=avg(vals('deathsPost20'));const p=clamp((1-Math.max(0,a-1)/4)*100);return{progress:p,passed:a<=2,note:`Recent post-20 deaths: ${a.toFixed(1)} per game.`}}
    case 'secondItemMinute':{const a=avg(vals('secondItemMinute'));const p=a?clamp((26-a)/4*100):0;return{progress:p,passed:!!a&&a<=23,note:a?`Recent second-item timing: ${a.toFixed(1)}m.`:'Second-item timing unavailable.'}}
    case 'objectiveParticipation':{const a=avg(vals('objectiveParticipation'));const p=clamp((a/0.7)*100);return{progress:p,passed:a>=0.7,note:`Objective involvement: ${Math.round(a*100)}%.`}}
    case 'damageShare':{const a=avg(vals('damageShare'));const p=clamp((a/0.28)*100);return{progress:p,passed:a>=0.25,note:`Recent damage share: ${Math.round(a*100)}%.`}}
    case 'clipReview':return{progress:task.progress,passed:task.progress>=100,note:task.progress>=100?'Required clip review completed.':'Needs one reviewed gameplay clip.'};
    case 'objectivePreparation':return{progress:task.progress,passed:task.progress>=100,note:'Requires reviewed objective-setup decisions or companion telemetry.'};
    default:return{progress:task.progress,passed:false,note:'This task needs manual review or richer telemetry.'};
  }
}

export const candidateTasks:Record<string,Omit<ILPTask,'id'|'accountId'|'progress'|'status'|'source'|'evidence'>>={
  adc_teamfight_entry:{title:'Survive the first threat cycle',category:'TEAMFIGHTING',why:'ADC damage is only useful while you remain able to auto attack. Late fights often hinge on whether you enter before engage tools are committed.',gameRule:'Before entering sustained DPS range, identify the primary engage/assassin threat and wait until it is committed, blocked or covered by peel.',metric:'deathsPost20',target:'≤2 post-20 deaths in 3 of 5 games',priority:88,masteryRequired:3},
  adc_lane_economy:{title:'Leave lane at 6.5+ CS/min',category:'LANING',why:'A stable lane economy gives you more reliable item timings without requiring kills.',gameRule:'Protect high-value waves and do not trade HP for low-value poke when the next wave cannot be safely collected.',metric:'laneCsPerMin',target:'6.5+ lane CS/min across 3 games',priority:72,masteryRequired:3},
  adc_objective_wave:{title:'Decide your final wave before objective setup',category:'TEMPO',why:'The real skill is not “farm more”; it is deciding early enough that the wave and objective do not become a last-second conflict.',gameRule:'At 90 seconds before Dragon/Baron, choose your final wave and route. Do not make the decision at 20 seconds.',metric:'objectivePreparation',target:'3 correct reviewed setup decisions',priority:82,masteryRequired:3},
  jungle_setup:{title:'Arrive set before neutral objectives',category:'OBJECTIVES',why:'Jungle objective control is mostly created before the monster is started.',gameRule:'Recall, spend and move to the correct side of the map before the final setup window.',metric:'objectiveParticipation',target:'70%+ objective involvement with no late setup pattern',priority:90,masteryRequired:3}
};

export function adaptILP(tasks:ILPTask[],matches:Match[]):{tasks:ILPTask[];changes:string[]}{
  if(!matches.length)return{tasks,changes:[]};
  const changes:string[]=[];
  const next=tasks.map(t=>{
    if(t.status==='MASTERED'||t.status==='PAUSED')return t;
    const e=evaluateMetric(t,matches);
    const gamesObserved=Math.min(5,matches.length);
    const priorPass=t.successfulGames||0;
    const successfulGames=e.passed?Math.min((t.masteryRequired||3),priorPass+1):Math.max(0,priorPass-1);
    const masteryRequired=t.masteryRequired||3;
    const mastered=successfulGames>=masteryRequired && e.progress>=85;
    const status=mastered?'MASTERED' as const:e.progress>=55?'EVIDENCE_BUILDING' as const:'ACTIVE' as const;
    if(mastered)changes.push(`${t.title} reached mastery evidence.`);
    return {...t,progress:e.progress,status,successfulGames,gamesObserved,masteryRequired,lastUpdatedReason:e.note,evidence:[...t.evidence.filter(x=>!x.startsWith('AUTO:')),
      `AUTO: ${e.note}`],history:[...(t.history||[]),{at:new Date().toISOString(),type:(mastered?'MASTERED':'PROGRESS') as 'MASTERED'|'PROGRESS',note:e.note}].slice(-8)};
  });
  return{tasks:next,changes};
}

export function rankTasks(tasks:ILPTask[]){return [...tasks].sort((a,b)=>(b.priority||50)-(a.priority||50));}

export function createCoachTask(accountId:string,input:{title:string;category:IssueCategory;why:string;gameRule:string;metric:string;target:string;priority?:number}):ILPTask{
  return{id:`coach-${Date.now()}`,accountId,...input,progress:0,status:'ACTIVE',source:'COACH',evidence:['Added from Coach conversation'],priority:input.priority||75,successfulGames:0,gamesObserved:0,masteryRequired:3,lastUpdatedReason:'Coach added this task.',history:[{at:new Date().toISOString(),type:'COACH_EDIT',note:'Added by Coach.'}]};
}
