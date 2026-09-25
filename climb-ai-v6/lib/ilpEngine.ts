import {ILPTask,Match,IssueCategory,Role} from '@/lib/types';
import type {CoachingMetricKey} from '@/lib/subscription';
import {masteryMetricThreshold,missionTargetNumber} from '@/lib/proMissionMastery';

type Eval={progress:number;passed:boolean;note:string;hasEvidence:boolean};
type Candidate=Omit<ILPTask,'id'|'accountId'|'progress'|'status'|'source'|'evidence'> & {roles?:Role[]};
type ProEvidence={key:CoachingMetricKey;label:string;score:number;summary:string;detail?:string;games:number;weakGames:number};
const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));
const active=(t:ILPTask)=>t.status!=='MASTERED'&&t.status!=='PAUSED';
const PRO_META=new Set<CoachingMetricKey>(['op_score','decision_fingerprint','champion_identity','historical_leak_rate']);
export const ACTIVE_PLAN_SIZE=2;
const BASE_GAME_METRICS=new Set([
  'laneCsPerMin','post15CsPerMin','csPerMin','deathsPost20','deaths',
  'secondItemMinute','objectiveParticipation','damageShare','killParticipation','visionScore',
  'deathsPre10','csAt10','csAt15','goldDiffAt15','xpDiffAt15',
]);

export function isGameMeasurableMetric(metric:string){
  return BASE_GAME_METRICS.has(String(metric||''));
}

export function isGameMeasurableTask(task:Pick<ILPTask,'metric'|'id'|'evidence'>,matches:Match[]){
  if(isGameMeasurableMetric(task.metric))return true;
  return matches.some(match=>Boolean(proMetric(task as ILPTask,match)));
}

function proMetric(task:ILPTask,match:Match){const metric=match.proAnalysis?.metrics?.[task.metric as CoachingMetricKey];return metric&&metric.status!=='UNAVAILABLE'&&metric.status!=='BUILDING'&&typeof metric.score==='number'?metric:null}
function evaluatePro(task:ILPTask,matches:Match[]):Eval|null{const measured=matches.slice(0,5).map(match=>proMetric(task,match)).filter((metric):metric is NonNullable<ReturnType<typeof proMetric>>=>Boolean(metric));if(!measured.length)return null;const score=avg(measured.map(metric=>metric.score as number)),target=missionTargetNumber(task.target),latest=measured[0];return{progress:clamp(score),passed:score>=target,note:`PRO ${latest.label}: ${score.toFixed(0)}/100 across ${measured.length} evidence-backed game${measured.length===1?'':'s'}; target ${target}.`,hasEvidence:true}}
function evaluateMetric(task:ILPTask,matches:Match[]):Eval{const recent=matches.slice(0,5),pro=evaluatePro(task,recent);if(pro)return pro;const vals=(key:keyof Match['metrics'])=>recent.map(m=>m.metrics[key]).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));const direct=(key:keyof Match['metrics'])=>vals(key);switch(task.metric){
case'laneCsPerMin':{const xs=direct('laneCsPerMin');if(!xs.length)return{progress:task.progress,passed:false,note:'Lane CS evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp(a/6.5*100),passed:a>=6.5,note:`Recent lane farm: ${a.toFixed(1)} CS/min.`,hasEvidence:true}}
case'post15CsPerMin':{const xs=direct('post15CsPerMin');if(!xs.length)return{progress:task.progress,passed:false,note:'Post-15 farm evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp(a/6*100),passed:a>=6,note:`Recent post-15 farm: ${a.toFixed(1)} CS/min.`,hasEvidence:true}}
case'csPerMin':{const xs=direct('csPerMin');if(!xs.length)return{progress:task.progress,passed:false,note:'Farm evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp(a/6.5*100),passed:a>=6.5,note:`Recent total farm: ${a.toFixed(1)} CS/min.`,hasEvidence:true}}
case'deathsPost20':{const xs=direct('deathsPost20');if(!xs.length)return{progress:task.progress,passed:false,note:'Late-death evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp((1-Math.max(0,a-1)/4)*100),passed:a<=2,note:`Recent post-20 deaths: ${a.toFixed(1)} per game.`,hasEvidence:true}}
case'deaths':{const xs=recent.map(m=>m.deaths);if(!xs.length)return{progress:task.progress,passed:false,note:'Death evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp((1-Math.max(0,a-3)/5)*100),passed:a<=4,note:`Recent deaths: ${a.toFixed(1)} per game.`,hasEvidence:true}}
case'deathsPre10':{const xs=direct('deathsPre10');if(!xs.length)return{progress:task.progress,passed:false,note:'Early-death evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp((1-Math.min(1,a))*100),passed:a===0,note:`Recent deaths before 10:00: ${a.toFixed(1)} per game.`,hasEvidence:true}}
case'csAt10':{const xs=direct('csAt10');if(!xs.length)return{progress:task.progress,passed:false,note:'10-minute CS evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp(a/70*100),passed:a>=65,note:`Recent CS at 10:00: ${a.toFixed(0)}.`,hasEvidence:true}}
case'csAt15':{const xs=direct('csAt15');if(!xs.length)return{progress:task.progress,passed:false,note:'15-minute CS evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp(a/105*100),passed:a>=100,note:`Recent CS at 15:00: ${a.toFixed(0)}.`,hasEvidence:true}}
case'secondItemMinute':{const xs=direct('secondItemMinute');if(!xs.length)return{progress:task.progress,passed:false,note:'Second-item timing is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp((26-a)/4*100),passed:a<=23,note:`Recent second-item timing: ${a.toFixed(1)}m.`,hasEvidence:true}}
case'objectiveParticipation':{const xs=direct('objectiveParticipation');if(!xs.length)return{progress:task.progress,passed:false,note:'Objective involvement is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp(a/.7*100),passed:a>=.7,note:`Objective involvement: ${Math.round(a*100)}%.`,hasEvidence:true}}
case'damageShare':{const xs=direct('damageShare');if(!xs.length)return{progress:task.progress,passed:false,note:'Damage-share evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp(a/.28*100),passed:a>=.25,note:`Recent damage share: ${Math.round(a*100)}%.`,hasEvidence:true}}
case'killParticipation':{const xs=direct('killParticipation');if(!xs.length)return{progress:task.progress,passed:false,note:'Kill-participation evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp(a/.68*100),passed:a>=.65,note:`Recent kill participation: ${Math.round(a*100)}%.`,hasEvidence:true}}
case'visionScore':{const xs=direct('visionScore');if(!xs.length)return{progress:task.progress,passed:false,note:'Vision evidence is not available yet.',hasEvidence:false};const a=avg(xs);return{progress:clamp(a/45*100),passed:a>=40,note:`Recent vision score: ${a.toFixed(0)} per game.`,hasEvidence:true}}
case'clipReview':return{progress:task.progress,passed:task.progress>=100,note:task.progress>=100?'Required clip review completed.':'Needs one reviewed gameplay clip.',hasEvidence:task.progress>0};case'objectivePreparation':return{progress:task.progress,passed:task.progress>=100,note:'Requires reviewed objective-setup decisions or companion telemetry.',hasEvidence:task.progress>0};case'mapCheck':return{progress:task.progress,passed:task.progress>=100,note:'Requires reviewed map-check evidence.',hasEvidence:task.progress>0};default:return{progress:task.progress,passed:false,note:'This task needs manual review or richer telemetry.',hasEvidence:false}}}
function matchPass(task:ILPTask,match:Match):boolean|null{const pro=proMetric(task,match);if(pro)return(pro.score as number)>=missionTargetNumber(task.target);const m=match.metrics;switch(task.metric){case'laneCsPerMin':return typeof m.laneCsPerMin==='number'?m.laneCsPerMin>=6.5:null;case'post15CsPerMin':return typeof m.post15CsPerMin==='number'?m.post15CsPerMin>=6:null;case'csPerMin':return typeof m.csPerMin==='number'?m.csPerMin>=6:null;case'deathsPost20':return typeof m.deathsPost20==='number'?m.deathsPost20<=2:null;case'deaths':return match.deaths<=4;case'secondItemMinute':return typeof m.secondItemMinute==='number'?m.secondItemMinute<=23:null;case'objectiveParticipation':return typeof m.objectiveParticipation==='number'?m.objectiveParticipation>=.7:null;case'damageShare':return typeof m.damageShare==='number'?m.damageShare>=.25:null;case'killParticipation':return typeof m.killParticipation==='number'?m.killParticipation>=.65:null;case'visionScore':return typeof m.visionScore==='number'?m.visionScore>=40:null;case'deathsPre10':return typeof m.deathsPre10==='number'?m.deathsPre10===0:null;case'csAt10':return typeof m.csAt10==='number'?m.csAt10>=65:null;case'csAt15':return typeof m.csAt15==='number'?m.csAt15>=100:null;default:return null}}

function automaticAttempts(task:ILPTask,matches:Match[]){
  const existing=new Map((task.missionHistory??[]).map(attempt=>[attempt.matchId,attempt]));
  const startEvent=(task.history??[]).find(event=>event.type==='PROMOTED'||event.type==='COACH_EDIT');
  const startedAt=startEvent?.at?Date.parse(startEvent.at):Number.NEGATIVE_INFINITY;
  for(const match of matches){
    if(Date.parse(match.createdAt)<startedAt||existing.has(match.id))continue;
    const pass=matchPass(task,match);
    if(pass===null)continue;
    existing.set(match.id,{
      matchId:match.id,
      at:match.createdAt,
      adherence:'TRACKED',
      clearedBar:pass,
      outcome:pass?'CONFIRMED':'NO_REP',
      banksPass:pass,
      source:'TRACKED',
    });
  }
  return [...existing.values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
}

export const candidateTasks:Record<string,Candidate>={
adc_teamfight_entry:{roles:['ADC'],title:'Survive the first threat cycle',category:'TEAMFIGHTING',why:'ADC damage only matters while you remain able to auto attack.',gameRule:'Before entering sustained DPS range, identify the primary engage or assassin threat and wait until it is committed, blocked or covered by peel.',metric:'deathsPost20',target:'≤2 post-20 deaths in 3 of 5 games',priority:92,masteryRequired:3},
adc_lane_economy:{roles:['ADC','MID','TOP'],title:'Leave lane at 6.5+ CS/min',category:'LANING',why:'A stable lane economy creates reliable item timings without needing kills.',gameRule:'Protect high-value waves and do not trade HP for low-value poke when the next wave cannot be safely collected.',metric:'laneCsPerMin',target:'6.5+ lane CS/min across 3 games',priority:78,masteryRequired:3},
post_lane_farm:{roles:['ADC','MID','TOP'],title:'Keep collecting after lane',category:'RESOURCE_COLLECTION',why:'Lost post-lane gold delays the item timings that create reliable fights.',gameRule:'After every recall past 15:00, check objective timer → safest wave → then decide whether to group.',metric:'post15CsPerMin',target:'6.0+ post-15 CS/min across 3 relevant games',priority:84,masteryRequired:3},
item_timing:{roles:['ADC','MID','TOP'],title:'Protect your second-item timing',category:'RECALL_TIMING',why:'Poor recalls and missed waves often show up as a delayed second item.',gameRule:'Before recalling, identify the purchase you are completing and the wave you can safely collect next.',metric:'secondItemMinute',target:'Second item by 23:00 in 3 of 5 relevant games',priority:76,masteryRequired:3},
damage_conversion:{roles:['ADC','MID','TOP'],title:'Convert safety into useful damage',category:'TEAMFIGHTING',why:'Surviving is only valuable if it creates meaningful damage uptime.',gameRule:'After the first threat cycle is spent, step forward with your frontline and hit the closest safe target continuously.',metric:'damageShare',target:'25%+ damage share in 3 of 5 games',priority:72,masteryRequired:3},
jungle_setup:{roles:['JUNGLE'],title:'Arrive set before neutral objectives',category:'OBJECTIVES',why:'Jungle objective control is mostly created before the monster is started.',gameRule:'Recall, spend and move to the correct side before the final setup window.',metric:'objectiveParticipation',target:'70%+ objective involvement across 3 games',priority:94,masteryRequired:3},
jungle_deaths:{roles:['JUNGLE'],title:'Stop donating tempo after 20',category:'DEATHS',why:'A late jungle death removes Smite pressure and often concedes the next neutral objective.',gameRule:'Past 20 minutes, do not face-check or cross an unlit quadrant without a reason tied to the next objective.',metric:'deathsPost20',target:'≤2 post-20 deaths in 3 of 5 games',priority:88,masteryRequired:3},
jungle_farm:{roles:['JUNGLE'],title:'Keep camps converting into levels',category:'FARMING',why:'Falling behind in levels makes invades, dives and objective fights harder.',gameRule:'Between plays, clear toward the next objective instead of crossing the map for low-probability action.',metric:'csPerMin',target:'6.0+ CS/min across 3 relevant games',priority:76,masteryRequired:3},
support_vision:{roles:['SUPPORT'],title:'Own the next objective vision cycle',category:'VISION',why:'Support impact is created before the fight through information and control.',gameRule:'Reset early enough to place vision, then leave before you become the pick.',metric:'visionScore',target:'40+ vision score in 3 of 5 games',priority:92,masteryRequired:3},
support_kp:{roles:['SUPPORT','JUNGLE'],title:'Be present for the plays that matter',category:'MAP_AWARENESS',why:'High-value roaming means being present where kills and objectives actually happen.',gameRule:'Before leaving, name the play you are moving toward and what you give up by moving.',metric:'killParticipation',target:'65%+ kill participation across 3 games',priority:82,masteryRequired:3},
support_survival:{roles:['SUPPORT'],title:'Create vision without becoming the pick',category:'POSITIONING',why:'Dying alone while warding removes the map control the ward was meant to create.',gameRule:'Enter dark space only with a teammate, a known enemy count, or an escape route.',metric:'deaths',target:'4 or fewer deaths in 3 of 5 games',priority:84,masteryRequired:3},
early_survival:{roles:['MID','TOP','ADC','SUPPORT','JUNGLE'],title:'Reach 10 minutes without a death',category:'DEATHS',why:'Early deaths hand away lane control, tempo and reliable gold before your build comes online.',gameRule:'Protect the first ten minutes: take the safe wave or reset instead of forcing a low-value fight.',metric:'deathsPre10',target:'0 deaths before 10:00 in 3 games',priority:74,masteryRequired:3},
general_survival:{roles:['MID','TOP'],title:'Reduce avoidable deaths',category:'DEATHS',why:'Fewer low-value deaths protects XP, waves and side-lane pressure.',gameRule:'Before committing beyond river or side-lane midpoint, identify what information makes the move safe.',metric:'deaths',target:'4 or fewer deaths in 3 of 5 games',priority:82,masteryRequired:3}}
function candidateForRole(role:Role){return Object.entries(candidateTasks).filter(([,c])=>(!c.roles||c.roles.includes(role))&&isGameMeasurableMetric(c.metric))}
function candidateScore(candidate:Candidate,matches:Match[]){const probe:ILPTask={id:'probe',accountId:'probe',...candidate,progress:0,status:'ACTIVE',source:'SYSTEM',evidence:[]};const e=evaluateMetric(probe,matches),priority=candidate.priority||50;return e.hasEvidence?priority+(100-e.progress)*.72:priority*.45}
function instantiateCandidate(accountId:string,key:string,candidate:Candidate,matches:Match[],role:Role):ILPTask{const probe:ILPTask={id:`system-${role.toLowerCase()}-${key}-${Date.now()}`,accountId,...candidate,progress:0,status:'ACTIVE',source:'SYSTEM',evidence:[],roleScope:role,roleEvidence:[role]},e=evaluateMetric(probe,matches);return{...probe,progress:e.hasEvidence?e.progress:0,metricProgress:e.hasEvidence?e.progress:0,status:e.hasEvidence&&e.progress>=55?'EVIDENCE_BUILDING':'ACTIVE',evidence:[e.hasEvidence?`AUTO: ${e.note}`:'SYSTEM: Baseline hypothesis — waiting for enough match evidence to confirm or replace it.'],successfulGames:0,gamesObserved:e.hasEvidence?Math.min(5,matches.length):0,masteryRequired:candidate.masteryRequired||3,lastUpdatedReason:e.hasEvidence?e.note:'Promoted into the active plan while evidence is still building.',history:[{at:new Date().toISOString(),type:'PROMOTED',note:e.hasEvidence?`Promoted from current evidence. ${e.note}`:'Promoted as a role baseline while evidence builds.'}]}}
function categoryForMetric(key:string):IssueCategory{return key.includes('reset')||key.includes('gold')?'RECALL_TIMING':key.includes('objective')?'OBJECTIVES':key.includes('fight')?'TEAMFIGHTING':key.includes('death')||key.includes('survival')?'DEATHS':key.includes('farm')||key==='cs_curve'?'RESOURCE_COLLECTION':key.includes('item')||key.includes('build')?'ITEMISATION':key.includes('threat')||key.includes('adaptation')?'MATCHUPS':key.includes('lead')||key.includes('advantage')?'TEMPO':'CONSISTENCY'}
function recurringProEvidence(matches:Match[],used:Set<string>):ProEvidence[]{const recent=matches.slice(0,5),byMetric=new Map<CoachingMetricKey,{label:string;scores:number[];summary:string;detail?:string}>();for(const match of recent){for(const metric of Object.values(match.proAnalysis?.metrics??{})){if(!metric||typeof metric.score!=='number'||metric.status==='UNAVAILABLE'||metric.status==='BUILDING'||PRO_META.has(metric.key)||used.has(metric.key))continue;const row=byMetric.get(metric.key)??{label:metric.label,scores:[],summary:metric.summary,detail:metric.evidence[0]?.detail};row.scores.push(metric.score);if(!row.detail)row.detail=metric.evidence[0]?.detail;byMetric.set(metric.key,row)}}return[...byMetric.entries()].map(([key,row])=>({key,label:row.label,score:avg(row.scores),summary:row.summary,detail:row.detail,games:row.scores.length,weakGames:row.scores.filter(score=>score<60).length})).filter(e=>e.games>=2&&e.weakGames>=2).sort((a,b)=>a.score-b.score||b.games-a.games)}
function proCandidate(accountId:string,matches:Match[],used:Set<string>,role:Role):ILPTask|null{const evidence=recurringProEvidence(matches,used)[0];if(!evidence)return null;const target=Math.min(100,Math.round(evidence.score+10));return{id:`pro-${role.toLowerCase()}-${evidence.key}-${Date.now()}`,accountId,title:`Improve ${evidence.label}`,category:categoryForMetric(evidence.key),why:evidence.summary,gameRule:evidence.detail||`In the next game, deliberately improve ${evidence.label.toLowerCase()} while protecting the rest of your game.`,metric:evidence.key,target:`${target}+ PRO evidence score across 3 games`,progress:clamp(evidence.score),metricProgress:clamp(evidence.score),status:evidence.score>=55?'EVIDENCE_BUILDING':'ACTIVE',source:'SYSTEM',evidence:[`PRO: recurring issue in ${evidence.weakGames}/${evidence.games} recent evidence-backed games. ${evidence.summary}`],roleScope:role,roleEvidence:[role],priority:95,successfulGames:0,gamesObserved:evidence.games,masteryRequired:3,lastUpdatedReason:`Promoted from recurring PRO evidence: ${evidence.score.toFixed(0)}/100 across ${evidence.games} games.`,history:[{at:new Date().toISOString(),type:'PROMOTED',note:`Recurring PRO evidence promoted ${evidence.label}: ${evidence.weakGames}/${evidence.games} weak games, average ${evidence.score.toFixed(0)}/100.`}]}}
export function ensureFiveActive(tasks:ILPTask[],matches:Match[],accountId:string,role:Role):{tasks:ILPTask[];changes:string[]}{const next=[...tasks],changes:string[]=[];const live=()=>next.filter(active),usedTitles=new Set(next.map(t=>t.title.toLowerCase())),usedMetrics=new Set(live().map(t=>t.metric));while(live().length<ACTIVE_PLAN_SIZE){const task=proCandidate(accountId,matches,usedMetrics,role);if(!task)break;next.push(task);usedMetrics.add(task.metric);usedTitles.add(task.title.toLowerCase());changes.push(`${task.title} promoted from recurring PRO evidence into the active plan.`)}const candidates=candidateForRole(role).filter(([,candidate])=>!usedTitles.has(candidate.title.toLowerCase())&&!usedMetrics.has(candidate.metric)).sort((a,b)=>candidateScore(b[1],matches)-candidateScore(a[1],matches));while(live().length<ACTIVE_PLAN_SIZE&&candidates.length){const[key,candidate]=candidates.shift()!,task=instantiateCandidate(accountId,key,candidate,matches,role);next.push(task);usedTitles.add(task.title.toLowerCase());usedMetrics.add(task.metric);changes.push(`${task.title} promoted into the active plan.`)}return{tasks:next,changes}}
export function adaptILP(tasks:ILPTask[],matches:Match[]):{tasks:ILPTask[];changes:string[]}{
  if(!matches.length)return{tasks,changes:[]};
  const changes:string[]=[];
  const recent=matches.slice(0,5);
  const next=tasks.map(t=>{
    if(t.status==='MASTERED'||t.status==='PAUSED')return t;
    const e=evaluateMetric(t,recent);
    if(!e.hasEvidence)return{...t,lastUpdatedReason:e.note};

    const attempts=automaticAttempts(t,matches);
    const confirmed=attempts.filter(attempt=>attempt.banksPass).length;
    const masteryRequired=t.masteryRequired||3;
    const missionProgress=clamp(confirmed/masteryRequired*100);
    const metricProgress=e.progress;
    const progress=attempts.length?clamp(metricProgress*.7+missionProgress*.3):metricProgress;
    const successfulGames=confirmed;
    const gamesObserved=attempts.length;
    const threshold=masteryMetricThreshold(t,recent);
    const mastered=confirmed>=masteryRequired&&metricProgress>=threshold;
    const status=mastered?'MASTERED' as const:progress>=55?'EVIDENCE_BUILDING' as const:'ACTIVE' as const;

    if(mastered)changes.push(`${t.title} reached its ${threshold}+ mastery target and left the active plan.`);
    const missionNote=` Tracked evidence: ${confirmed}/${masteryRequired} proven reps from ${gamesObserved} game${gamesObserved===1?'':'s'}.`;
    return{
      ...t,
      progress,
      metricProgress,
      missionProgress,
      status,
      successfulGames,
      gamesObserved,
      masteryRequired,
      missionHistory:attempts,
      lastUpdatedReason:`${e.note}${missionNote}`,
      evidence:[...t.evidence.filter(x=>!x.startsWith('AUTO:')),`AUTO: ${e.note}`],
      history:[...(t.history||[]),{at:new Date().toISOString(),type:(mastered?'MASTERED':'PROGRESS') as 'MASTERED'|'PROGRESS',note:`${e.note}${missionNote}`}].slice(-12),
    };
  });
  return{tasks:next,changes};
}
export function adaptAndRefill(tasks:ILPTask[],matches:Match[],accountId:string,role:Role){const adapted=adaptILP(tasks,matches),refilled=ensureFiveActive(adapted.tasks,matches,accountId,role);return{tasks:refilled.tasks,changes:[...adapted.changes,...refilled.changes]}}
export function rankTasks(tasks:ILPTask[]){return[...tasks].sort((a,b)=>(b.priority||50)-(a.priority||50))}
export function createCoachTask(accountId:string,input:{title:string;category:IssueCategory;why:string;gameRule:string;metric:string;target:string;priority?:number}):ILPTask{return{id:`coach-${Date.now()}`,accountId,...input,progress:0,metricProgress:0,status:'ACTIVE',source:'COACH',evidence:['Added from Coach conversation'],priority:input.priority||75,successfulGames:0,gamesObserved:0,masteryRequired:3,lastUpdatedReason:'Coach added this task.',history:[{at:new Date().toISOString(),type:'COACH_EDIT',note:'Added by Coach.'}]}}
export function reviseTaskFromCoach(task:ILPTask,input:{title:string;category:IssueCategory;why:string;gameRule:string;metric:string;target:string;priority?:number}):ILPTask{return{...task,...input,source:'COACH',priority:Math.max(task.priority||50,input.priority||75),lastUpdatedReason:'Coach revised this mission from the current conversation.',evidence:[...task.evidence.filter(x=>!x.startsWith('COACH:')),'COACH: Mission wording and cue updated from the latest coaching conversation.'],history:[...(task.history||[]),{at:new Date().toISOString(),type:'COACH_EDIT',note:`Coach revised mission: ${input.title}`}].slice(-12)}}