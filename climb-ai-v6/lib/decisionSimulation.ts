import type {
  DecisionBehaviourKey,
  DecisionSituationTag,
  DecisionTwinConfidence,
  DecisionTwinProfile,
  DraftSituationContext,
} from './decisionTwin';
import type {DecisionPremortem,DecisionPremortemRisk} from './decisionPremortem';

export type DecisionSimulationStatus='READY'|'BUILDING';
export type DecisionSimulationSource='PERSONAL_RISK'|'DRAFT_REHEARSAL';
export type DecisionSimulationOutcome='BEAT_TWIN'|'TWIN_REPEATED'|'MIXED'|'PLAN_EXECUTED'|'PLAN_MISSED'|'NOT_OBSERVED';

export interface DecisionSimulationScenario{
  id:string;
  rank:1|2|3|4|5;
  source:DecisionSimulationSource;
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  situationTag:DecisionSituationTag|null;
  confidence:DecisionTwinConfidence;
  priorityScore:number;
  title:string;
  trigger:string;
  exactDraftRead:string;
  twinLikelyMove:string;
  targetMove:string;
  whyThisTestsYou:string;
  branchRules:{AHEAD:string;EVEN:string;BEHIND:string};
  relevantEnemies:string[];
  evidence:string;
  predictionBoundary:string;
}

export interface DecisionSimulation{
  version:1;
  status:DecisionSimulationStatus;
  headline:string;
  summary:string;
  personalForecastCount:number;
  draftRehearsalCount:number;
  scenarios:DecisionSimulationScenario[];
  boundary:string;
}

export interface SimulationObservedDecision{
  behaviourKey:DecisionBehaviourKey;
  verdict:'GOOD'|'IMPROVE'|'NEUTRAL';
  confidence:'HIGH'|'MEDIUM'|'LOW';
  situationTags:DecisionSituationTag[];
}

export interface DecisionSimulationReviewScenario{
  scenarioId:string;
  rank:number;
  source:DecisionSimulationSource;
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  situationTag:DecisionSituationTag|null;
  outcome:DecisionSimulationOutcome;
  observedMoments:number;
  goodMoments:number;
  improveMoments:number;
  note:string;
}

export interface DecisionSimulationReview{
  version:1;
  active:boolean;
  scenarioCount:number;
  observedScenarios:number;
  personalForecasts:number;
  personalObserved:number;
  twinRepeated:number;
  twinBeaten:number;
  draftRehearsals:number;
  draftObserved:number;
  draftExecuted:number;
  draftMissed:number;
  mixed:number;
  unobserved:number;
  results:DecisionSimulationReviewScenario[];
  note:string;
  boundary:string;
}

type CoachLike={
  headline?:string|null;
  theirPlan?:string|null;
  threatAnswer?:string|null;
  fightTrigger?:string|null;
  objectiveSetup?:string|null;
  never?:string|null;
  ifBehind?:string|null;
};

const BUILD_BOUNDARY='Decision Simulation rehearses evidence-backed personal risks plus exact-draft control tests. Draft rehearsals are not personal predictions, and priority is not probability.';
const REVIEW_BOUNDARY='Simulation review only grades verified comparable decisions that actually occurred. Unobserved scenarios are not counted as success or failure.';

const LABELS:Record<DecisionBehaviourKey,string>={
  FIGHT_SELECTION:'Fight Selection',
  DEATH_RECOVERY:'Recovery After Death',
  LEAD_PROTECTION:'Lead Protection',
  RESET_DISCIPLINE:'Reset Discipline',
  OBJECTIVE_READINESS:'Objective Arrival',
  FARM_VS_SETUP:'Farm vs Setup',
  THREAT_ADAPTATION:'Threat Adaptation',
  CARRY_PRESERVATION:'Carry Preservation',
  POWER_SPIKE_CONVERSION:'Power-Spike Conversion',
  SURVIVAL_VALUE:'Survival Value',
};

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function roleName(value:unknown){return clean(value).toUpperCase()}
function unique(values:string[]){return [...new Set(values.map(clean).filter(Boolean))]}
function cap(value:number,min=0,max=100){return Math.max(min,Math.min(max,Math.round(value)))}
function confidenceRank(value:DecisionTwinConfidence){return value==='HIGH'?3:value==='MEDIUM'?2:1}

function enemiesFor(tag:DecisionSituationTag|null,context:DraftSituationContext){
  if(tag==='MULTI_ACCESS')return unique(context.enemyAccess).slice(0,3);
  if(tag==='PICK_PRESSURE')return unique(context.enemyPicks).slice(0,3);
  if(tag==='ZONE_OBJECTIVE')return unique(context.enemyZones).slice(0,3);
  return[];
}

function likelyMistake(key:DecisionBehaviourKey,enemies:string[]){
  const named=enemies.join(' + ');
  if(key==='CARRY_PRESERVATION'||key==='SURVIVAL_VALUE')return named?'STEP FORWARD AFTER '+named+' CREATE FIRST CONTACT, BEFORE ALL ACCESS IS ACCOUNTED FOR.':'STEP FORWARD AFTER FIRST CONTACT BEFORE THE SAFE DAMAGE LINE IS REALLY OPEN.';
  if(key==='FIGHT_SELECTION')return named?'INHERIT '+named+'\'S FIRST CONTACT AND COMMIT BEFORE YOUR OWN TRIGGER IS TRUE.':'LET FIRST CONTACT MAKE THE FIGHT DECISION FOR YOU.';
  if(key==='THREAT_ADAPTATION')return named?'RE-ENTER THE SAME SPACE AFTER '+named+' HAVE ALREADY SHOWN THE ACCESS PATTERN.':'REPEAT THE SAME ENTRY AFTER THE THREAT HAS ALREADY SHOWN HOW IT PUNISHES YOU.';
  if(key==='OBJECTIVE_READINESS')return'FINISH ONE MORE LOW-VALUE RESOURCE AND ARRIVE AFTER THE IMPORTANT SPACE IS ALREADY OWNED.';
  if(key==='FARM_VS_SETUP')return'TAKE THE EXTRA WAVE / CAMP EVEN THOUGH IT MAKES YOU SECOND TO THE CONNECTED TEAM ACTION.';
  if(key==='RESET_DISCIPLINE')return'JOIN THE NEXT VOLUNTARY FIGHT WITH SHOP VALUE STILL SITTING IN YOUR INVENTORY AS GOLD.';
  if(key==='LEAD_PROTECTION')return'TREAT A LEAD AS PERMISSION TO CHASE A HARDER FIGHT INSTEAD OF CONVERTING CONTROL.';
  if(key==='DEATH_RECOVERY')return'RE-ENTER ANOTHER CONTEST BEFORE RESOURCES, INFORMATION AND POSITION HAVE RESET.';
  if(key==='POWER_SPIKE_CONVERSION')return'COMPLETE THE SPIKE, THEN DRIFT INTO ANOTHER FARM CYCLE WHILE THE PRESSURE WINDOW EXPIRES.';
  return'REPEAT THE OLD BRANCH BEFORE CHECKING THE FROZEN PLAN.';
}

function targetFor(key:DecisionBehaviourKey,coach:CoachLike){
  if(key==='FIGHT_SELECTION')return clean(coach.fightTrigger)||'WAIT FOR YOUR OWN NUMBERS / POSITION / SPELL TRIGGER BEFORE COMMITTING.';
  if(key==='OBJECTIVE_READINESS'||key==='FARM_VS_SETUP')return clean(coach.objectiveSetup)||'ARRIVE TO IMPORTANT SPACE BEFORE THE EXTRA LOW-VALUE RESOURCE.';
  if(key==='CARRY_PRESERVATION'||key==='SURVIVAL_VALUE'||key==='THREAT_ADAPTATION')return clean(coach.threatAnswer)||clean(coach.never)||'ACCOUNT FOR THE ACCESS LAYER FIRST; PRESERVE THE SAFE DAMAGE LINE.';
  if(key==='DEATH_RECOVERY')return clean(coach.ifBehind)||'REBUILD A PLAYABLE STATE BEFORE THE NEXT CONTEST.';
  if(key==='LEAD_PROTECTION')return clean(coach.objectiveSetup)||clean(coach.headline)||'CONVERT THE STRONGER STATE INSTEAD OF BUYING A HARDER FIGHT.';
  if(key==='RESET_DISCIPLINE')return'IF A REAL PURCHASE IS AVAILABLE, SPEND BEFORE THE NEXT VOLUNTARY FIGHT.';
  if(key==='POWER_SPIKE_CONVERSION')return clean(coach.headline)||'USE THE COMPLETED POWER WINDOW ON THE NEXT CONNECTED TEAM ACTION.';
  return clean(coach.headline)||'USE THE FROZEN GAME PLAN.';
}

function exactDraftRead(tag:DecisionSituationTag|null,context:DraftSituationContext,coach:CoachLike,enemies:string[]){
  const names=enemies.join(' + ');
  if(tag==='MULTI_ACCESS')return names?names+' give this draft multiple ways to reach you. The first engage is not the whole threat package.':'This draft contains multiple access layers that can collapse the safe damage line.';
  if(tag==='PICK_PRESSURE')return names?names+' can create a fight before your team has chosen one. The test is whether you inherit their contact.':'This draft can create picks before your team is fully formed.';
  if(tag==='ZONE_OBJECTIVE')return names?names+' become stronger after they own the entrance first. Arrival timing changes the geometry of the fight.':'This draft punishes arriving second to objective space.';
  if(tag==='SCALING_WINDOW')return'Your champion has a meaningful scaling window. The test is whether you survive to it and then actually convert it.';
  if(clean(coach.theirPlan))return clean(coach.theirPlan);
  return clean(coach.headline)||'The exact draft creates a repeatable decision test around first contact, setup and conversion.';
}

function defaultBranches(target:string,key:DecisionBehaviourKey){
  return{
    AHEAD:key==='LEAD_PROTECTION'?'AHEAD: MAKE THEM ENTER YOUR CONTROL. DO NOT UPGRADE THE DIFFICULTY OF THE FIGHT.':'AHEAD: KEEP THE SAME DECISION STANDARD. '+target,
    EVEN:'EVEN: THIS IS THE CLEANEST TEST. '+target,
    BEHIND:key==='DEATH_RECOVERY'?'BEHIND: REDUCE VARIANCE FIRST. REBUILD RESOURCES AND INFORMATION BEFORE RE-ENTERING.':'BEHIND: REDUCE VARIANCE AND FORCE THE SAFEST VERSION OF THE BRANCH. '+target,
  };
}

function fromRisk(risk:DecisionPremortemRisk,context:DraftSituationContext,coach:CoachLike):Omit<DecisionSimulationScenario,'rank'>{
  const enemies=risk.relevantEnemies?.length?unique(risk.relevantEnemies):enemiesFor(risk.situationTag,context);
  const target=clean(risk.preventionRule)||targetFor(risk.behaviourKey,coach);
  return{
    id:'sim:'+risk.id,
    source:'PERSONAL_RISK',
    behaviourKey:risk.behaviourKey,
    behaviourLabel:risk.behaviourLabel,
    situationTag:risk.situationTag,
    confidence:risk.confidence,
    priorityScore:cap(risk.priorityScore+8),
    title:risk.title,
    trigger:risk.trigger,
    exactDraftRead:exactDraftRead(risk.situationTag,context,coach,enemies),
    twinLikelyMove:likelyMistake(risk.behaviourKey,enemies),
    targetMove:target,
    whyThisTestsYou:'This exact draft matches a repeated '+risk.behaviourLabel.toLowerCase()+' pattern in your history.',
    branchRules:risk.branchRules,
    relevantEnemies:enemies,
    evidence:risk.evidence,
    predictionBoundary:'PERSONAL FORECAST FROM REPEATED EVIDENCE · PRIORITY IS NOT PROBABILITY.',
  };
}

function draftRehearsal(
  key:DecisionBehaviourKey,
  tag:DecisionSituationTag|null,
  context:DraftSituationContext,
  coach:CoachLike,
  priority:number,
  title:string,
):Omit<DecisionSimulationScenario,'rank'>{
  const enemies=enemiesFor(tag,context);
  const target=targetFor(key,coach);
  return{
    id:['sim','draft',key,tag||'general'].join(':').toLowerCase(),
    source:'DRAFT_REHEARSAL',
    behaviourKey:key,
    behaviourLabel:LABELS[key],
    situationTag:tag,
    confidence:'MEDIUM',
    priorityScore:priority,
    title,
    trigger:tag==='MULTI_ACCESS'
      ?'WHEN THE FIRST ACCESS CHAMPION COMMITS AND THE SECOND LAYER IS STILL AVAILABLE.'
      :tag==='PICK_PRESSURE'
        ?'WHEN THEIR FIRST PICK TOOL LANDS / THREATENS AND YOUR TEAM IS NOT YET FULLY FORMED.'
        :tag==='ZONE_OBJECTIVE'
          ?'WHEN THE NEXT MAJOR OBJECTIVE IS 60–90 SECONDS AWAY AND THE ENTRANCE IS STILL CONTESTABLE.'
          :tag==='SCALING_WINDOW'
            ?'WHEN YOUR NEXT REAL ITEM / LEVEL SPIKE COMPLETES.'
            :'WHEN THE GAME OFFERS A VOLUNTARY FIGHT OR RESET WINDOW.',
    exactDraftRead:exactDraftRead(tag,context,coach,enemies),
    twinLikelyMove:'NO PERSONAL PREDICTION — THIS IS AN EXACT-DRAFT REHEARSAL, NOT A CLAIM ABOUT YOUR HISTORY.',
    targetMove:target,
    whyThisTestsYou:'This situation is structurally important in the current draft even if OP CLIMB does not have enough personal evidence to call it one of your recurring traps.',
    branchRules:defaultBranches(target,key),
    relevantEnemies:enemies,
    evidence:'EXACT DRAFT + FROZEN GAME PLAN. NO PERSONAL WEAKNESS CLAIM.',
    predictionBoundary:'DRAFT REHEARSAL ONLY · NOT SCORED AS A PERSONAL FORECAST.',
  };
}

function supplementalScenarios(context:DraftSituationContext,coach:CoachLike,role:string):Array<Omit<DecisionSimulationScenario,'rank'>>{
  const candidates:Array<Omit<DecisionSimulationScenario,'rank'>>=[];
  if(context.tags.includes('MULTI_ACCESS')){
    candidates.push(draftRehearsal(role==='ADC'?'CARRY_PRESERVATION':'FIGHT_SELECTION','MULTI_ACCESS',context,coach,78,'SURVIVE THE SECOND ACCESS LAYER'));
    candidates.push(draftRehearsal('THREAT_ADAPTATION','MULTI_ACCESS',context,coach,70,'CHANGE THE SECOND REP'));
  }
  if(context.tags.includes('PICK_PRESSURE'))candidates.push(draftRehearsal('FIGHT_SELECTION','PICK_PRESSURE',context,coach,74,'DO NOT INHERIT THEIR PICK FIGHT'));
  if(context.tags.includes('ZONE_OBJECTIVE'))candidates.push(draftRehearsal('OBJECTIVE_READINESS','ZONE_OBJECTIVE',context,coach,72,'BE FIRST TO THE IMPORTANT SPACE'));
  if(context.tags.includes('SCALING_WINDOW'))candidates.push(draftRehearsal('POWER_SPIKE_CONVERSION','SCALING_WINDOW',context,coach,66,'USE THE SPIKE BEFORE IT EXPIRES'));
  candidates.push(draftRehearsal('RESET_DISCIPLINE',null,context,coach,54,'SPEND BEFORE YOU VOLUNTEER'));
  candidates.push(draftRehearsal('DEATH_RECOVERY',null,context,coach,48,'BREAK THE SECOND-DEATH CYCLE'));
  return candidates;
}

export function buildDecisionSimulation(input:{
  twin:DecisionTwinProfile|null|undefined;
  premortem:DecisionPremortem|null|undefined;
  situationContext:DraftSituationContext;
  champion:string;
  role:string|null|undefined;
  coach:CoachLike;
}):DecisionSimulation{
  const personal=(input.premortem?.status==='READY'?input.premortem.risks:[]).map(risk=>fromRisk(risk,input.situationContext,input.coach));
  const supplements=supplementalScenarios(input.situationContext,input.coach,roleName(input.role));
  const combined:Array<Omit<DecisionSimulationScenario,'rank'>>=[];
  const seen=new Set<string>();
  for(const item of [...personal,...supplements].sort((a,b)=>b.priorityScore-a.priorityScore||confidenceRank(b.confidence)-confidenceRank(a.confidence))){
    const key=item.behaviourKey+'|'+(item.situationTag||'GENERAL');
    if(seen.has(key))continue;
    seen.add(key);
    combined.push(item);
    if(combined.length>=5)break;
  }
  while(combined.length<3){
    const item=supplements.find(candidate=>!seen.has(candidate.behaviourKey+'|'+(candidate.situationTag||'GENERAL')));
    if(!item)break;
    seen.add(item.behaviourKey+'|'+(item.situationTag||'GENERAL'));
    combined.push(item);
  }
  const scenarios=combined.slice(0,5).map((item,index)=>({...item,rank:(index+1) as 1|2|3|4|5}));
  const personalForecastCount=scenarios.filter(item=>item.source==='PERSONAL_RISK').length;
  const draftRehearsalCount=scenarios.length-personalForecastCount;
  const enoughPersonal=Boolean(input.twin&&input.twin.gamesAnalyzed>=3&&personalForecastCount>0);
  return{
    version:1,
    status:scenarios.length>=3?'READY':'BUILDING',
    headline:scenarios.length>=3?'DECISION SIMULATION · REHEARSE THIS DRAFT':'DECISION SIMULATION IS BUILDING',
    summary:enoughPersonal
      ?personalForecastCount+' personal forecast'+(personalForecastCount===1?'':'s')+' + '+draftRehearsalCount+' exact-draft rehearsal'+(draftRehearsalCount===1?'':'s')+'. Read the trigger, predict your instinct, then lock the better branch before loading in.'
      :'OP CLIMB does not yet have enough personal evidence to manufacture predictions. These are exact-draft rehearsals until your Twin earns stronger claims.',
    personalForecastCount,
    draftRehearsalCount,
    scenarios,
    boundary:BUILD_BOUNDARY,
  };
}

export function reviewDecisionSimulation(
  simulation:DecisionSimulation|null|undefined,
  nodes:SimulationObservedDecision[],
):DecisionSimulationReview{
  const scenarios=simulation?.status==='READY'?(simulation.scenarios??[]):[];
  const results=scenarios.map(scenario=>{
    const matched=nodes.filter(node=>
      node.confidence!=='LOW'
      && node.behaviourKey===scenario.behaviourKey
      && (!scenario.situationTag||scenario.situationTag==='GENERAL'||node.situationTags.includes(scenario.situationTag)),
    );
    const good=matched.filter(node=>node.verdict==='GOOD').length;
    const improve=matched.filter(node=>node.verdict==='IMPROVE').length;
    const observed=good+improve;
    let outcome:DecisionSimulationOutcome='NOT_OBSERVED';
    if(observed){
      if(good&&improve)outcome='MIXED';
      else if(scenario.source==='PERSONAL_RISK')outcome=improve?'TWIN_REPEATED':'BEAT_TWIN';
      else outcome=improve?'PLAN_MISSED':'PLAN_EXECUTED';
    }
    return{
      scenarioId:scenario.id,
      rank:scenario.rank,
      source:scenario.source,
      behaviourKey:scenario.behaviourKey,
      behaviourLabel:scenario.behaviourLabel,
      situationTag:scenario.situationTag,
      outcome,
      observedMoments:observed,
      goodMoments:good,
      improveMoments:improve,
      note:outcome==='NOT_OBSERVED'
        ?'No verified comparable decision appeared, so this simulation is not scored.'
        :outcome==='BEAT_TWIN'
          ?'The personal forecast appeared, but every verified comparable decision was clean ('+good+'/'+observed+').'
          :outcome==='TWIN_REPEATED'
            ?'The personal forecast reproduced in every verified comparable decision ('+improve+'/'+observed+').'
            :outcome==='PLAN_EXECUTED'
              ?'The exact-draft rehearsal appeared and the verified decision matched the trained branch ('+good+'/'+observed+').'
              :outcome==='PLAN_MISSED'
                ?'The exact-draft rehearsal appeared and the verified decision missed the trained branch ('+improve+'/'+observed+').'
                :'The simulation was mixed: '+good+' clean and '+improve+' for improvement.',
    } satisfies DecisionSimulationReviewScenario;
  });
  const observed=results.filter(item=>item.outcome!=='NOT_OBSERVED');
  const personal=results.filter(item=>item.source==='PERSONAL_RISK');
  const draft=results.filter(item=>item.source==='DRAFT_REHEARSAL');
  const personalObserved=personal.filter(item=>item.outcome!=='NOT_OBSERVED').length;
  const draftObserved=draft.filter(item=>item.outcome!=='NOT_OBSERVED').length;
  const twinRepeated=results.filter(item=>item.outcome==='TWIN_REPEATED').length;
  const twinBeaten=results.filter(item=>item.outcome==='BEAT_TWIN').length;
  const draftExecuted=results.filter(item=>item.outcome==='PLAN_EXECUTED').length;
  const draftMissed=results.filter(item=>item.outcome==='PLAN_MISSED').length;
  const mixed=results.filter(item=>item.outcome==='MIXED').length;
  const unobserved=results.filter(item=>item.outcome==='NOT_OBSERVED').length;
  return{
    version:1,
    active:scenarios.length>0,
    scenarioCount:scenarios.length,
    observedScenarios:observed.length,
    personalForecasts:personal.length,
    personalObserved,
    twinRepeated,
    twinBeaten,
    draftRehearsals:draft.length,
    draftObserved,
    draftExecuted,
    draftMissed,
    mixed,
    unobserved,
    results,
    note:!scenarios.length
      ?'No frozen Decision Simulation was available before this game.'
      :!observed.length
        ?'None of the frozen simulation scenarios produced a verified comparable decision, so OP CLIMB will not score them.'
        :twinRepeated>0
          ?String(twinRepeated)+' personal forecast'+(twinRepeated===1?'':'s')+' reproduced in verified evidence; '+String(twinBeaten)+' '+(twinBeaten===1?'was':'were')+' beaten.'
          :personalObserved>0
            ?'Every observed personal forecast was beaten in the verified evidence.'
            :'Only exact-draft rehearsal scenarios were observed this game.',
    boundary:REVIEW_BOUNDARY,
  };
}
