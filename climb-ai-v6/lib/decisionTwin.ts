import type {CoachingMetricKey} from './subscription';
import type {HistoryAnalysisRow,ProTrend} from './riot/proHistory';

export type DecisionTwinConfidence='LOW'|'MEDIUM'|'HIGH';
export type DecisionTwinState='BUILDING'|'LIMITER'|'AT_RISK'|'STRONG'|'MASTERED';
export type DecisionBehaviourKey=
  |'FIGHT_SELECTION'
  |'DEATH_RECOVERY'
  |'LEAD_PROTECTION'
  |'RESET_DISCIPLINE'
  |'OBJECTIVE_READINESS'
  |'FARM_VS_SETUP'
  |'THREAT_ADAPTATION'
  |'CARRY_PRESERVATION'
  |'POWER_SPIKE_CONVERSION'
  |'SURVIVAL_VALUE';

export interface DecisionTwinContext{
  champion:string;
  role:string|null;
  applicableGames:number;
  averageScore:number;
}

export interface DecisionTwinBehaviour{
  key:DecisionBehaviourKey;
  label:string;
  metric:CoachingMetricKey;
  description:string;
  applicableGames:number;
  evidenceCount:number;
  averageScore:number|null;
  recentScore:number|null;
  trend:ProTrend;
  confidence:DecisionTwinConfidence;
  state:DecisionTwinState;
  contexts:DecisionTwinContext[];
  lastSeenAt:string|null;
}

export interface DecisionTwinProfile{
  version:1;
  gamesAnalyzed:number;
  behaviours:DecisionTwinBehaviour[];
  strongest:DecisionTwinBehaviour|null;
  currentLimiter:DecisionTwinBehaviour|null;
  mastered:DecisionTwinBehaviour[];
  generatedAt:string;
}

export interface DraftPlayerLike{champion:string;role?:string|null}

export interface PersonalTrap{
  version:1;
  status:'READY'|'BUILDING'|'NONE';
  title:string;
  behaviourKey:DecisionBehaviourKey|null;
  behaviourLabel:string|null;
  confidence:DecisionTwinConfidence|null;
  state:DecisionTwinState|null;
  applicableGames:number;
  evidenceCount:number;
  recentScore:number|null;
  historicalSummary:string;
  draftReason:string;
  cue:string;
  proof:string;
  relevantEnemies:string[];
}

type BehaviourDefinition={
  key:DecisionBehaviourKey;
  label:string;
  metric:CoachingMetricKey;
  description:string;
  leakKeys:string[];
};

const DEFINITIONS:BehaviourDefinition[]=[
  {key:'FIGHT_SELECTION',label:'Fight Selection',metric:'fight_selection',description:'Choosing fights that match the visible state instead of entering already-lost positions.',leakKeys:['RED_STATE']},
  {key:'DEATH_RECOVERY',label:'Recovery After Death',metric:'chain_deaths',description:'Breaking the second-death cycle and rebuilding resources before re-entering.',leakKeys:['CHAIN_DEATH']},
  {key:'LEAD_PROTECTION',label:'Lead Protection',metric:'lead_protection',description:'Converting a stronger state without donating the advantage through an uncontrolled fight.',leakKeys:['LEAD_THROW']},
  {key:'RESET_DISCIPLINE',label:'Reset Discipline',metric:'reset_quality',description:'Turning earned gold into combat power before voluntary fights and objective windows.',leakKeys:['BANKING_LEAK']},
  {key:'OBJECTIVE_READINESS',label:'Objective Arrival',metric:'objective_readiness',description:'Arriving early enough to establish useful objective geometry instead of entering second.',leakKeys:[]},
  {key:'FARM_VS_SETUP',label:'Farm vs Setup',metric:'farm_fight_tradeoff',description:'Knowing when another wave is worth less than arriving for the next meaningful team action.',leakKeys:[]},
  {key:'THREAT_ADAPTATION',label:'Threat Adaptation',metric:'opponent_adaptation',description:'Changing positioning and fight choices after the same enemy threat has already punished you.',leakKeys:[]},
  {key:'CARRY_PRESERVATION',label:'Carry Preservation',metric:'carry_preservation',description:'Keeping high-value damage uptime without crossing the threat line for a lower-value target.',leakKeys:['CARRY_DEATH']},
  {key:'POWER_SPIKE_CONVERSION',label:'Power-Spike Conversion',metric:'power_spike_conversion',description:'Using completed power windows before the opponent can neutralise them.',leakKeys:[]},
  {key:'SURVIVAL_VALUE',label:'Survival Value',metric:'survival_value',description:'Preserving life when your continued presence has disproportionate fight or objective value.',leakKeys:['CARRY_DEATH']},
];

const ACCESS=new Set(['Akali','Alistar','Amumu','Camille','Diana','Ekko','Evelynn','Fiddlesticks','Fizz','Galio','Hecarim','Irelia','Jarvan IV','Jax','Katarina',"Kha'Zix",'Kled','Leona','Malphite','Maokai','Nautilus','Nocturne','Olaf','Pantheon','Qiyana','Rakan','Rell','Renekton','Rengar','Sejuani','Sett','Shaco','Skarner','Talon','Vi','Volibear','Wukong','Xin Zhao','Yone','Zac','Zed']);
const PICK=new Set(['Ahri','Ashe','Blitzcrank','Elise','Jhin','Leona','Lux','Morgana','Nautilus','Neeko','Pyke','Rakan','Thresh','Twisted Fate','Vi']);
const ZONE=new Set(['Anivia','Azir','Brand','Fiddlesticks','Gangplank','Heimerdinger','Hwei','Kennen','Orianna','Rumble','Taliyah','Veigar','Viktor','Ziggs','Zyra']);
const SCALERS=new Set(['Aphelios','Aurelion Sol','Azir',"Bel'Veth",'Cassiopeia','Gangplank','Jax','Jinx','Kassadin','Kayle','Kindred',"Kog'Maw",'Master Yi','Nasus','Senna','Smolder','Sona','Tristana','Twitch','Vayne','Veigar','Viktor','Vladimir']);

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function avg(values:number[]){return values.length?values.reduce((a,b)=>a+b,0)/values.length:0}
function round(value:number){return Math.round(value)}
function metricScore(row:HistoryAnalysisRow,key:CoachingMetricKey){
  const metric=row.analysis.metrics?.[key];
  return metric&&typeof metric.score==='number'&&!['UNAVAILABLE','BUILDING'].includes(String(metric.status))?metric.score:null;
}
function trend(scores:number[]):ProTrend{
  if(scores.length<3)return'BUILDING';
  const split=Math.max(1,Math.floor(scores.length/2));
  const old=avg(scores.slice(0,split)),recent=avg(scores.slice(split));
  if(recent-old>=7)return'IMPROVING';
  if(old-recent>=7)return'WORSENING';
  return'STABLE';
}
function confidence(applicable:number):DecisionTwinConfidence{return applicable>=6?'HIGH':applicable>=3?'MEDIUM':'LOW'}
function state(applicable:number,recent:number|null):DecisionTwinState{
  if(applicable<3||recent===null)return'BUILDING';
  if(applicable>=5&&recent>=86)return'MASTERED';
  if(recent>=75)return'STRONG';
  if(recent>=60)return'AT_RISK';
  return'LIMITER';
}
function evidenceFor(row:HistoryAnalysisRow,definition:BehaviourDefinition){
  const metric=row.analysis.metrics?.[definition.metric];
  const metricEvidence=Array.isArray(metric?.evidence)?metric!.evidence.length:0;
  const leakEvidence=(row.analysis.leakSignals??[])
    .filter(leak=>definition.leakKeys.includes(String(leak.key)))
    .reduce((sum,leak)=>sum+Math.max(1,Number(leak.count)||0),0);
  return metricEvidence+leakEvidence;
}
function contextKey(row:HistoryAnalysisRow){return clean(row.champion).toLowerCase()+'|'+clean(row.role).toUpperCase()}

export function buildDecisionTwin(rows:HistoryAnalysisRow[],now=new Date().toISOString()):DecisionTwinProfile{
  const ordered=[...rows].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
  const behaviours=DEFINITIONS.map(definition=>{
    const measured=ordered.map(row=>({row,score:metricScore(row,definition.metric)})).filter((item):item is {row:HistoryAnalysisRow;score:number}=>typeof item.score==='number');
    const scores=measured.map(item=>item.score);
    const recentScores=scores.slice(-Math.min(5,scores.length));
    const recent=recentScores.length?round(avg(recentScores)):null;
    const contextGroups=new Map<string,{champion:string;role:string|null;scores:number[]}>();
    for(const item of measured){
      const key=contextKey(item.row),current=contextGroups.get(key)??{champion:clean(item.row.champion),role:clean(item.row.role)||null,scores:[]};
      current.scores.push(item.score);contextGroups.set(key,current);
    }
    const contexts=[...contextGroups.values()]
      .map(group=>({champion:group.champion,role:group.role,applicableGames:group.scores.length,averageScore:round(avg(group.scores))}))
      .sort((a,b)=>b.applicableGames-a.applicableGames||a.averageScore-b.averageScore)
      .slice(0,5);
    return{
      key:definition.key,
      label:definition.label,
      metric:definition.metric,
      description:definition.description,
      applicableGames:scores.length,
      evidenceCount:measured.reduce((sum,item)=>sum+evidenceFor(item.row,definition),0),
      averageScore:scores.length?round(avg(scores)):null,
      recentScore:recent,
      trend:trend(scores),
      confidence:confidence(scores.length),
      state:state(scores.length,recent),
      contexts,
      lastSeenAt:measured[measured.length-1]?.row.createdAt??null,
    } satisfies DecisionTwinBehaviour;
  });

  const established=behaviours.filter(item=>item.applicableGames>=3&&item.recentScore!==null);
  const limiter=established
    .filter(item=>item.state==='LIMITER'||item.state==='AT_RISK')
    .sort((a,b)=>(a.recentScore??100)-(b.recentScore??100)||b.applicableGames-a.applicableGames)[0]??null;
  const strongest=established
    .filter(item=>item.state==='STRONG'||item.state==='MASTERED')
    .sort((a,b)=>(b.recentScore??0)-(a.recentScore??0)||b.applicableGames-a.applicableGames)[0]??null;
  const mastered=behaviours.filter(item=>item.state==='MASTERED').sort((a,b)=>(b.recentScore??0)-(a.recentScore??0));

  return{version:1,gamesAnalyzed:ordered.length,behaviours,strongest,currentLimiter:limiter,mastered,generatedAt:now};
}

function countNames(players:DraftPlayerLike[],set:Set<string>){return players.map(p=>clean(p.champion)).filter(name=>set.has(name))}
function roleName(value:unknown){return clean(value).toUpperCase()}
function weakEnough(item:DecisionTwinBehaviour){return item.applicableGames>=3&&(item.state==='LIMITER'||item.state==='AT_RISK')}
function scoreBehaviour(item:DecisionTwinBehaviour,input:{champion:string;role:string;ours:DraftPlayerLike[];enemies:DraftPlayerLike[]}){
  if(!weakEnough(item))return-1;
  const access=countNames(input.enemies,ACCESS);
  const picks=countNames(input.enemies,PICK);
  const zones=countNames(input.enemies,ZONE);
  const role=roleName(input.role);
  let score=(100-(item.recentScore??70))*1.6+(item.confidence==='HIGH'?18:10)+Math.min(12,item.applicableGames*2);
  if(item.key==='CARRY_PRESERVATION'||item.key==='SURVIVAL_VALUE')score+=role==='ADC'?28:role==='MID'?12:0;
  if((item.key==='CARRY_PRESERVATION'||item.key==='FIGHT_SELECTION'||item.key==='THREAT_ADAPTATION')&&access.length>=2)score+=35;
  if(item.key==='FIGHT_SELECTION'&&picks.length>=2)score+=24;
  if(item.key==='OBJECTIVE_READINESS'&&zones.length>=1)score+=28;
  if(item.key==='OBJECTIVE_READINESS'&&['JUNGLE','SUPPORT'].includes(role))score+=22;
  if(item.key==='FARM_VS_SETUP'&&['TOP','MID','ADC'].includes(role))score+=18;
  if(item.key==='LEAD_PROTECTION')score+=10;
  if(item.key==='RESET_DISCIPLINE')score+=8;
  if(item.key==='POWER_SPIKE_CONVERSION'&&SCALERS.has(clean(input.champion)))score+=22;
  return score;
}

function trapCopy(item:DecisionTwinBehaviour,input:{champion:string;role:string;ours:DraftPlayerLike[];enemies:DraftPlayerLike[]}){
  const access=countNames(input.enemies,ACCESS).slice(0,3);
  const picks=countNames(input.enemies,PICK).slice(0,2);
  const zones=countNames(input.enemies,ZONE).slice(0,2);
  const role=roleName(input.role);
  const enemyAccess=access.join(' + ');
  const score=item.recentScore===null?'building':item.recentScore+'/100';
  const history=`${item.label} is ${item.state.toLowerCase().replace('_',' ')} across ${item.applicableGames} measurable game${item.applicableGames===1?'':'s'} (recent ${score}, ${item.trend.toLowerCase()}).`;

  if((item.key==='CARRY_PRESERVATION'||item.key==='SURVIVAL_VALUE')&&access.length>=2)return{
    draftReason:`${enemyAccess} give this draft multiple ways to reach ${input.champion}; the first engage is not necessarily the last access layer.`,
    cue:`FIRST ENGAGE ≠ WALK FORWARD. ACCOUNT FOR ${enemyAccess} BEFORE CROSSING YOUR FRONT EDGE; HIT THE CLOSEST SAFE TARGET.`,
    relevantEnemies:access,
  };
  if(item.key==='THREAT_ADAPTATION'&&access.length)return{
    draftReason:`${enemyAccess} can repeat the same access pattern if your positioning does not change after first contact.`,
    cue:`AFTER ${access[0]} SHOWS THE FIRST ENTRY, RE-CHECK THE NEXT ACCESS THREAT BEFORE RE-ENTERING THE SAME SPACE.`,
    relevantEnemies:access,
  };
  if(item.key==='FIGHT_SELECTION'&&picks.length>=2)return{
    draftReason:`${picks.join(' + ')} can create fights before your formation is ready, which directly tests your historical fight-selection pattern.`,
    cue:`DO NOT TURN THEIR PICK ATTEMPT INTO YOUR COMMIT. ENTER ONLY AFTER YOUR TEAM HAS NUMBERS / FIRST CONTACT.`,
    relevantEnemies:picks,
  };
  if(item.key==='FIGHT_SELECTION'&&access.length>=2)return{
    draftReason:`${enemyAccess} can make a bad fight look playable after the first cooldown is used.`,
    cue:`DO NOT COMMIT JUST BECAUSE ONE ACCESS TOOL IS DOWN. CHECK WHETHER THE SECOND ENTRY CAN STILL REACH YOU.`,
    relevantEnemies:access,
  };
  if(item.key==='OBJECTIVE_READINESS'&&zones.length)return{
    draftReason:`${zones.join(' + ')} become much stronger once river or choke setup is already established.`,
    cue:`YOUR PERSONAL PRIORITY IS EARLY SETUP: LEAVE THE LAST LOW-VALUE WAVE BEFORE ${zones.join(' + ')} OWN THE ENTRANCE.`,
    relevantEnemies:zones,
  };
  if(item.key==='OBJECTIVE_READINESS')return{
    draftReason:`Your role as ${role||'this role'} makes first arrival valuable in this draft, and objective arrival is already a measured weakness.`,
    cue:'ARRIVE BEFORE THE FIGHT IS FORCED. TRADE ONE LOW-VALUE WAVE FOR FIRST SETUP WHEN THE MAJOR OBJECTIVE WINDOW IS LIVE.',
    relevantEnemies:[],
  };
  if(item.key==='FARM_VS_SETUP')return{
    draftReason:'This composition needs you present for connected setup more than it needs one extra isolated wave when the team action is forming.',
    cue:'IF THE NEXT WAVE MAKES YOU SECOND TO THE TEAM ACTION, LEAVE IT. CONNECT FIRST; FARM AFTER THE WINDOW.',
    relevantEnemies:[],
  };
  if(item.key==='RESET_DISCIPLINE')return{
    draftReason:'This draft has clear teamfight windows, so carrying unspent gold into a voluntary fight reduces the value of the plan.',
    cue:'BEFORE A VOLUNTARY OBJECTIVE FIGHT, ASK: CAN THIS RESET COMPLETE A REAL ITEM COMPONENT OR SPIKE? IF YES, SPEND FIRST.',
    relevantEnemies:[],
  };
  if(item.key==='POWER_SPIKE_CONVERSION')return{
    draftReason:`${input.champion} has meaningful item/power windows; your history shows those windows are not always converted cleanly.`,
    cue:'WHEN YOUR NEXT REAL SPIKE IS COMPLETE, MOVE WITH THE TEAM ON THAT WINDOW INSTEAD OF DRIFTING INTO ANOTHER FARM CYCLE.',
    relevantEnemies:[],
  };
  if(item.key==='LEAD_PROTECTION')return{
    draftReason:'Your history shows stronger states can become uncontrolled fights; this draft still wins by making the enemy enter your setup.',
    cue:'WHEN AHEAD, DO NOT BUY A HARDER FIGHT. MAKE THEM WALK INTO YOUR RANGE / VISION AND CONVERT THE CLEANEST OBJECTIVE.',
    relevantEnemies:[],
  };
  return{
    draftReason:`This draft is a relevant test of your recurring ${item.label.toLowerCase()} pattern.`,
    cue:`PLAY THIS GAME WITH ONE EXTRA CHECK ON ${item.label.toUpperCase()} BEFORE EACH MAJOR COMMIT.`,
    relevantEnemies:[],
  };
}

export function selectPersonalTrap(twin:DecisionTwinProfile|null|undefined,input:{champion:string;role:string|null|undefined;ours:DraftPlayerLike[];enemies:DraftPlayerLike[]}):PersonalTrap{
  if(!twin||twin.gamesAnalyzed<3){
    return{version:1,status:'BUILDING',title:'BUILDING YOUR DECISION TWIN',behaviourKey:null,behaviourLabel:null,confidence:null,state:null,applicableGames:0,evidenceCount:0,recentScore:null,historicalSummary:'Complete more tracked games before OP CLIMB labels a recurring personal trap.',draftReason:'The draft can still be coached normally, but there is not enough personal evidence to make a reliable behavioural claim.',cue:'FOLLOW THE DRAFT PLAN; DO NOT INVENT A PERSONAL WEAKNESS FROM TOO LITTLE DATA.',proof:'Requires at least 3 measurable games for the same behaviour.',relevantEnemies:[]};
  }
  const candidates=twin.behaviours.map(item=>({item,score:scoreBehaviour(item,{champion:input.champion,role:clean(input.role),ours:input.ours,enemies:input.enemies})})).filter(row=>row.score>=0).sort((a,b)=>b.score-a.score);
  const selected=candidates[0]?.item??null;
  if(!selected){
    return{version:1,status:'NONE',title:'NO VERIFIED PERSONAL TRAP',behaviourKey:null,behaviourLabel:null,confidence:null,state:null,applicableGames:0,evidenceCount:0,recentScore:null,historicalSummary:'No established weak behaviour is relevant enough to this draft to justify a personal warning.',draftReason:'OP CLIMB will keep the advice draft-specific instead of manufacturing personalisation.',cue:'EXECUTE THE NORMAL DRAFT PLAN.',proof:'No medium/high-evidence limiter matched this draft strongly enough.',relevantEnemies:[]};
  }
  const copy=trapCopy(selected,{champion:input.champion,role:clean(input.role),ours:input.ours,enemies:input.enemies});
  return{
    version:1,
    status:'READY',
    title:'YOUR PERSONAL TRAP',
    behaviourKey:selected.key,
    behaviourLabel:selected.label,
    confidence:selected.confidence,
    state:selected.state,
    applicableGames:selected.applicableGames,
    evidenceCount:selected.evidenceCount,
    recentScore:selected.recentScore,
    historicalSummary:`${selected.label} is ${selected.state.toLowerCase()} across ${selected.applicableGames} measurable games (recent ${selected.recentScore??'—'}/100, ${selected.trend.toLowerCase()}).`,
    draftReason:copy.draftReason,
    cue:copy.cue,
    proof:`${selected.confidence} confidence · ${selected.applicableGames} applicable games · ${selected.evidenceCount} evidence points.`,
    relevantEnemies:copy.relevantEnemies,
  };
}
