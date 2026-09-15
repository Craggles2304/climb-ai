import {ILPTask,Match,IssueCategory,Role} from '@/lib/types';

type Eval={progress:number;passed:boolean;note:string;hasEvidence:boolean};
type Candidate=Omit<ILPTask,'id'|'accountId'|'progress'|'status'|'source'|'evidence'> & {roles?:Role[]};
const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));
const active=(t:ILPTask)=>t.status!=='MASTERED'&&t.status!=='PAUSED';

function evaluateMetric(task:ILPTask,matches:Match[]):Eval{
  const recent=matches.slice(0,5);
  const vals=(key:keyof Match['metrics'])=>recent.map(m=>m.metrics[key]).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));
  const direct=(key:keyof Match['metrics'])=>vals(key);
  switch(task.metric){
    case 'laneCsPerMin':{const xs=direct('laneCsPerMin');if(!xs.length)return{progress:task.progress,passed:false,note:'Lane CS evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp((a/6.5)*100),passed:a>=6.5,note:`Recent lane farm: ${a.toFixed(1)} CS/min.`,hasEvidence:true}}
    case 'post15CsPerMin':{const xs=direct('post15CsPerMin');if(!xs.length)return{progress:task.progress,passed:false,note:'Post-15 farm evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp((a/6)*100),passed:a>=6,note:`Recent post-15 farm: ${a.toFixed(1)} CS/min.`,hasEvidence:true}}
    case 'csPerMin':{const xs=direct('csPerMin');if(!xs.length)return{progress:task.progress,passed:false,note:'Farm evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp((a/6.5)*100),passed:a>=6.5,note:`Recent total farm: ${a.toFixed(1)} CS/min.`,hasEvidence:true}}
    case 'deathsPost20':{const xs=direct('deathsPost20');if(!xs.length)return{progress:task.progress,passed:false,note:'Late-death evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp((1-Math.max(0,a-1)/4)*100),passed:a<=2,note:`Recent post-20 deaths: ${a.toFixed(1)} per game.`,hasEvidence:true}}
    case 'deaths':{const xs=recent.map(m=>m.deaths);if(!xs.length)return{progress:task.progress,passed:false,note:'Death evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp((1-Math.max(0,a-3)/5)*100),passed:a<=4,note:`Recent deaths: ${a.toFixed(1)} per game.`,hasEvidence:true}}
    case 'secondItemMinute':{const xs=direct('secondItemMinute');if(!xs.length)return{progress:task.progress,passed:false,note:'Second-item timing is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp((26-a)/4*100),passed:a<=23,note:`Recent second-item timing: ${a.toFixed(1)}m.`,hasEvidence:true}}
    case 'objectiveParticipation':{const xs=direct('objectiveParticipation');if(!xs.length)return{progress:task.progress,passed:false,note:'Objective involvement is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp((a/0.7)*100),passed:a>=0.7,note:`Objective involvement: ${Math.round(a*100)}%.`,hasEvidence:true}}
    case 'damageShare':{const xs=direct('damageShare');if(!xs.length)return{progress:task.progress,passed:false,note:'Damage-share evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp((a/0.28)*100),passed:a>=0.25,note:`Recent damage share: ${Math.round(a*100)}%.`,hasEvidence:true}}
    case 'killParticipation':{const xs=direct('killParticipation');if(!xs.length)return{progress:task.progress,passed:false,note:'Kill-participation evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp((a/0.68)*100),passed:a>=0.65,note:`Recent kill participation: ${Math.round(a*100)}%.`,hasEvidence:true}}
    case 'visionScore':{const xs=direct('visionScore');if(!xs.length)return{progress:task.progress,passed:false,note:'Vision evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp((a/45)*100),passed:a>=40,note:`Recent vision score: ${a.toFixed(0)} per game.`,hasEvidence:true}}
    case 'clipReview':return{progress:task.progress,passed:task.progress>=100,note:task.progress>=100?'Required clip review completed.':'Needs one reviewed gameplay clip.',hasEvidence:task.progress>0};
    case 'objectivePreparation':return{progress:task.progress,passed:task.progress>=100,note:'Requires reviewed objective-setup decisions or companion telemetry.',hasEvidence:task.progress>0};
    case 'mapCheck':return{progress:task.progress,passed:task.progress>=100,note:'Requires reviewed map-check evidence.',hasEvidence:task.progress>0};
    default:return{progress:task.progress,passed:false,note:'This task needs manual review or richer telemetry.',hasEvidence:false};
  }
}

function matchPass(task:ILPTask,match:Match):boolean|null{
  const m=match.metrics;
  switch(task.metric){
    case 'laneCsPerMin':return typeof m.laneCsPerMin==='number'?m.laneCsPerMin>=6.5:null;
    case 'post15CsPerMin':return typeof m.post15CsPerMin==='number'?m.post15CsPerMin>=6:null;
    case 'csPerMin':return typeof m.csPerMin==='number'?m.csPerMin>=6:null;
    case 'deathsPost20':return typeof m.deathsPost20==='number'?m.deathsPost20<=2:null;
    case 'deaths':return match.deaths<=4;
    case 'secondItemMinute':return typeof m.secondItemMinute==='number'?m.secondItemMinute<=23:null;
    case 'objectiveParticipation':return typeof m.objectiveParticipation==='number'?m.objectiveParticipation>=.7:null;
    case 'damageShare':return typeof m.damageShare==='number'?m.damageShare>=.25:null;
    case 'killParticipation':return typeof m.killParticipation==='number'?m.killParticipation>=.65:null;
    case 'visionScore':return typeof m.visionScore==='number'?m.visionScore>=40:null;
    default:return null;
  }
}

export const candidateTasks:Record<string,Candidate>={
  adc_teamfight_entry:{roles:['ADC'],title:'Survive the first threat cycle',category:'TEAMFIGHTING',why:'ADC damage only matters while you remain able to auto attack. Late fights often hinge on whether you enter before engage tools are committed.',gameRule:'Before entering sustained DPS range, identify the primary engage/assassin threat and wait until it is committed, blocked or covered by peel.',metric:'deathsPost20',target:'≤2 post-20 deaths in 3 of 5 games',priority:92,masteryRequired:3},
  adc_lane_economy:{roles:['ADC','MID','TOP'],title:'Leave lane at 6.5+ CS/min',category:'LANING',why:'A stable lane economy creates reliable item timings without needing kills.',gameRule:'Protect high-value waves and do not trade HP for low-value poke when the next wave cannot be safely collected.',metric:'laneCsPerMin',target:'6.5+ lane CS/min across 3 games',priority:78,masteryRequired:3},
  post_lane_farm:{roles:['ADC','MID','TOP'],title:'Keep collecting after lane',category:'RESOURCE_COLLECTION',why:'A large share of lost gold comes after towers fall, when players default to grouping instead of deliberately collecting safe waves.',gameRule:'After every recall past 15:00, check objective timer → safest wave → then decide whether to group.',metric:'post15CsPerMin',target:'6.0+ post-15 CS/min across 3 relevant games',priority:84,masteryRequired:3},
  objective_wave:{roles:['ADC','MID','TOP'],title:'Decide the final wave before objective setup',category:'TEMPO',why:'The skill is not simply farming more; it is deciding early enough that the wave and objective do not become a last-second conflict.',gameRule:'At 90 seconds before Dragon/Baron, choose your final wave and route. Do not make the decision at 20 seconds.',metric:'objectivePreparation',target:'3 correct reviewed setup decisions',priority:86,masteryRequired:3},
  item_timing:{roles:['ADC','MID','TOP'],title:'Protect your second-item timing',category:'RECALL_TIMING',why:'Deaths, poor recalls and missed waves often show up as a delayed second item before they show up in the final scoreboard.',gameRule:'Before recalling, identify the purchase you are completing and the wave you can safely collect next.',metric:'secondItemMinute',target:'Second item by 23:00 in 3 of 5 relevant games',priority:76,masteryRequired:3},
  damage_conversion:{roles:['ADC','MID','TOP'],title:'Convert safety into useful damage',category:'TEAMFIGHTING',why:'Surviving is only valuable if it creates more meaningful damage uptime.',gameRule:'After the first threat cycle is spent, step forward with your frontline and hit the closest safe target continuously.',metric:'damageShare',target:'25%+ damage share in 3 of 5 games',priority:72,masteryRequired:3},
  jungle_setup:{roles:['JUNGLE'],title:'Arrive set before neutral objectives',category:'OBJECTIVES',why:'Jungle objective control is mostly created before the monster is started.',gameRule:'Recall, spend and move to the correct side of the map before the final setup window.',metric:'objectiveParticipation',target:'70%+ objective involvement across 3 games',priority:94,masteryRequired:3},
  jungle_deaths:{roles:['JUNGLE'],title:'Stop donating tempo after 20',category:'DEATHS',why:'A late jungle death removes Smite pressure and often concedes the next neutral objective.',gameRule:'Past 20 minutes, do not face-check or cross an unlit quadrant without a reason tied to the next objective.',metric:'deathsPost20',target:'≤2 post-20 deaths in 3 of 5 games',priority:88,masteryRequired:3},
  jungle_farm:{roles:['JUNGLE'],title:'Keep camps converting into levels',category:'FARMING',why:'Falling behind in levels makes invades, dives and objective fights harder even when your mechanics are fine.',gameRule:'Between plays, clear toward the next objective instead of crossing the map for low-probability action.',metric:'csPerMin',target:'6.0+ CS/min across 3 relevant games',priority:76,masteryRequired:3},
  support_vision:{roles:['SUPPORT'],title:'Own the next objective vision cycle',category:'VISION',why:'Support impact is created before the fight when the enemy has to walk through your information and control.',gameRule:'Reset early enough to place vision, then leave before you become the pick that starts the objective for them.',metric:'visionScore',target:'40+ vision score in 3 of 5 games',priority:92,masteryRequired:3},
  support_kp:{roles:['SUPPORT','JUNGLE'],title:'Be present for the plays that matter',category:'MAP_AWARENESS',why:'High-value roaming is measured by being present where kills and objectives actually happen, not by moving more.',gameRule:'Before leaving your current area, name the play you are moving toward and what you give up by moving.',metric:'killParticipation',target:'65%+ kill participation across 3 games',priority:82,masteryRequired:3},
  support_survival:{roles:['SUPPORT'],title:'Create vision without becoming the pick',category:'POSITIONING',why:'Dying alone while warding removes the exact map control the ward was meant to create.',gameRule:'Enter dark space only with a teammate, a known enemy count, or an escape route.',metric:'deaths',target:'4 or fewer deaths in 3 of 5 games',priority:84,masteryRequired:3},
  map_check:{roles:['MID','TOP','ADC','SUPPORT','JUNGLE'],title:'Make the map check automatic',category:'MAP_AWARENESS',why:'Many avoidable deaths and missed rotations begin before the visible mistake, when no map check happened before the commitment.',gameRule:'Before every trade, wave push or river entry, check the minimap once and name the nearest missing threat.',metric:'mapCheck',target:'3 reviewed games with consistent pre-commit map checks',priority:70,masteryRequired:3},
  general_survival:{roles:['MID','TOP'],title:'Reduce avoidable deaths',category:'DEATHS',why:'Giving away fewer low-value deaths protects XP, waves and side-lane pressure.',gameRule:'Before committing beyond the river or side-lane midpoint, identify what information makes the move safe.',metric:'deaths',target:'4 or fewer deaths in 3 of 5 games',priority:82,masteryRequired:3},
};

function candidateForRole(role:Role){return Object.entries(candidateTasks).filter(([,c])=>!c.roles||c.roles.includes(role));}
function candidateScore(candidate:Candidate,matches:Match[]){const probe:ILPTask={id:'probe',accountId:'probe',...candidate,progress:0,status:'ACTIVE',source:'SYSTEM',evidence:[]};const e=evaluateMetric(probe,matches);const priority=candidate.priority||50;return e.hasEvidence?priority+(100-e.progress)*.72:priority*.45;}
function instantiateCandidate(accountId:string,key:string,candidate:Candidate,matches:Match[]):ILPTask{const probe:ILPTask={id:`system-${key}-${Date.now()}`,accountId,...candidate,progress:0,status:'ACTIVE',source:'SYSTEM',evidence:[]};const e=evaluateMetric(probe,matches);return{...probe,progress:e.hasEvidence?e.progress:0,metricProgress:e.hasEvidence?e.progress:0,status:e.hasEvidence&&e.progress>=55?'EVIDENCE_BUILDING':'ACTIVE',evidence:[e.hasEvidence?`AUTO: ${e.note}`:'SYSTEM: Baseline hypothesis — waiting for enough match evidence to confirm or replace it.'],successfulGames:0,gamesObserved:e.hasEvidence?Math.min(5,matches.length):0,masteryRequired:candidate.masteryRequired||3,lastUpdatedReason:e.hasEvidence?e.note:'Promoted into the active five while evidence is still building.',history:[{at:new Date().toISOString(),type:'PROMOTED' as const,note:e.hasEvidence?`Promoted from current evidence. ${e.note}`:'Promoted as a role baseline while evidence builds.'}]};}

export function ensureFiveActive(tasks:ILPTask[],matches:Match[],accountId:string,role:Role):{tasks:ILPTask[];changes:string[]}{
  const next=[...tasks];const changes:string[]=[];const live=()=>next.filter(active);const usedTitles=new Set(next.map(t=>t.title.toLowerCase()));const usedMetrics=new Set(live().map(t=>`${t.metric}:${t.category}`));
  const candidates=candidateForRole(role).filter(([,candidate])=>!usedTitles.has(candidate.title.toLowerCase())&&!usedMetrics.has(`${candidate.metric}:${candidate.category}`)).sort((a,b)=>candidateScore(b[1],matches)-candidateScore(a[1],matches));
  while(live().length<5&&candidates.length){const [key,candidate]=candidates.shift()!;const task=instantiateCandidate(accountId,key,candidate,matches);next.push(task);usedTitles.add(task.title.toLowerCase());usedMetrics.add(`${task.metric}:${task.category}`);changes.push(`${task.title} promoted into the active five.`)}
  return{tasks:next,changes};
}

export function adaptILP(tasks:ILPTask[],matches:Match[]):{tasks:ILPTask[];changes:string[]}{
  if(!matches.length)return{tasks,changes:[]};
  const changes:string[]=[];const recent=matches.slice(0,5);
  const next=tasks.map(t=>{
    if(t.status==='MASTERED'||t.status==='PAUSED')return t;
    const e=evaluateMetric(t,recent);if(!e.hasEvidence)return{...t,lastUpdatedReason:e.note};
    const passResults=recent.map(m=>matchPass(t,m)).filter((v):v is boolean=>v!==null);
    const rawSuccessful=passResults.filter(Boolean).length;
    const attempts=t.missionHistory??[];
    const hasMissionEvidence=attempts.length>0;
    const confirmed=attempts.filter(attempt=>attempt.banksPass).length;
    const masteryRequired=t.masteryRequired||3;
    const missionProgress=hasMissionEvidence?clamp(confirmed/masteryRequired*100):undefined;
    const metricProgress=e.progress;
    const progress=hasMissionEvidence&&typeof missionProgress==='number'?clamp(metricProgress*.7+missionProgress*.3):metricProgress;
    const successfulGames=hasMissionEvidence?confirmed:rawSuccessful;
    const gamesObserved=hasMissionEvidence?attempts.length:passResults.length;
    const mastered=hasMissionEvidence
      ?confirmed>=masteryRequired&&metricProgress>=85
      :gamesObserved>=masteryRequired&&successfulGames>=masteryRequired&&metricProgress>=85;
    const status=mastered?'MASTERED' as const:progress>=55?'EVIDENCE_BUILDING' as const:'ACTIVE' as const;
    if(mastered)changes.push(`${t.title} reached mastery evidence and left the active five.`);
    const missionNote=hasMissionEvidence?` Mission evidence: ${confirmed}/${masteryRequired} confirmed reps.`:'';
    return{...t,progress,metricProgress,missionProgress,status,successfulGames,gamesObserved,masteryRequired,lastUpdatedReason:`${e.note}${missionNote}`,evidence:[...t.evidence.filter(x=>!x.startsWith('AUTO:')),`AUTO: ${e.note}`],history:[...(t.history||[]),{at:new Date().toISOString(),type:(mastered?'MASTERED':'PROGRESS') as 'MASTERED'|'PROGRESS',note:`${e.note}${missionNote}`}].slice(-12)};
  });
  return{tasks:next,changes};
}

export function adaptAndRefill(tasks:ILPTask[],matches:Match[],accountId:string,role:Role){const adapted=adaptILP(tasks,matches);const refilled=ensureFiveActive(adapted.tasks,matches,accountId,role);return{tasks:refilled.tasks,changes:[...adapted.changes,...refilled.changes]};}
export function rankTasks(tasks:ILPTask[]){return [...tasks].sort((a,b)=>(b.priority||50)-(a.priority||50));}
export function createCoachTask(accountId:string,input:{title:string;category:IssueCategory;why:string;gameRule:string;metric:string;target:string;priority?:number}):ILPTask{return{id:`coach-${Date.now()}`,accountId,...input,progress:0,metricProgress:0,status:'ACTIVE',source:'COACH',evidence:['Added from Coach conversation'],priority:input.priority||75,successfulGames:0,gamesObserved:0,masteryRequired:3,lastUpdatedReason:'Coach added this task.',history:[{at:new Date().toISOString(),type:'COACH_EDIT' as const,note:'Added by Coach.'}]};}
export function reviseTaskFromCoach(task:ILPTask,input:{title:string;category:IssueCategory;why:string;gameRule:string;metric:string;target:string;priority?:number}):ILPTask{return{...task,...input,source:'COACH',priority:Math.max(task.priority||50,input.priority||75),lastUpdatedReason:'Coach revised this mission from the current conversation.',evidence:[...task.evidence.filter(x=>!x.startsWith('COACH:')),'COACH: Mission wording and cue updated from the latest coaching conversation.'],history:[...(task.history||[]),{at:new Date().toISOString(),type:'COACH_EDIT' as const,note:`Coach revised mission: ${input.title}`}].slice(-12)}}
