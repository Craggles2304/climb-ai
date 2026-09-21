import type {
  DecisionBehaviourKey,
  DecisionSituationPattern,
  DecisionSituationTag,
  DecisionTwinConfidence,
  DecisionTwinProfile,
  DraftPlayerLike,
} from './decisionTwin';
import {buildDraftSituationContext} from './decisionTwin';

export type DecisionPremortemStatus='READY'|'BUILDING'|'NONE';
export type DecisionPremortemSource='SITUATION_PATTERN'|'BEHAVIOUR';
export type DecisionPremortemOutcome='BEAT_PATTERN'|'PATTERN_HIT'|'MIXED'|'NOT_OBSERVED';

export interface DecisionPremortemRisk{
  id:string;
  rank:1|2|3;
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  situationTag:DecisionSituationTag|null;
  source:DecisionPremortemSource;
  confidence:DecisionTwinConfidence;
  priorityScore:number;
  title:string;
  trigger:string;
  preventionRule:string;
  branchRules:{
    AHEAD:string;
    EVEN:string;
    BEHIND:string;
  };
  evidence:string;
  relevantEnemies:string[];
}

export interface DecisionPremortem{
  version:1;
  status:DecisionPremortemStatus;
  headline:string;
  summary:string;
  risks:DecisionPremortemRisk[];
  boundary:string;
}

export interface PremortemObservedDecision{
  behaviourKey:DecisionBehaviourKey;
  verdict:'GOOD'|'IMPROVE'|'NEUTRAL';
  confidence:'HIGH'|'MEDIUM'|'LOW';
  situationTags:DecisionSituationTag[];
}

export interface DecisionPremortemReviewRisk{
  riskId:string;
  rank:number;
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  situationTag:DecisionSituationTag|null;
  outcome:DecisionPremortemOutcome;
  observedMoments:number;
  goodMoments:number;
  improveMoments:number;
  note:string;
}

export interface DecisionPremortemReview{
  version:1;
  active:boolean;
  forecastCount:number;
  observedRisks:number;
  beatenRisks:number;
  hitRisks:number;
  mixedRisks:number;
  unobservedRisks:number;
  results:DecisionPremortemReviewRisk[];
  note:string;
  boundary:string;
}

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

const BOUNDARY='Decision Pre-Mortem ranks personal risk windows from repeated OP CLIMB evidence plus the static pre-game draft. Priority is not a probability, and OP CLIMB does not claim a listed situation will happen.';
const REVIEW_BOUNDARY='Pre-Mortem review only grades Riot-visible comparable decisions that occurred after the plan was frozen. A risk that was not observed is not counted as success or failure.';

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function roleName(value:unknown){return clean(value).toUpperCase()}
function clamp(value:number,min=0,max=100){return Math.max(min,Math.min(max,Math.round(value)))}
function confidenceWeight(value:DecisionTwinConfidence){return value==='HIGH'?18:value==='MEDIUM'?10:0}
function stateWeight(value:string){
  if(value==='REGRESSING')return 38;
  if(value==='ACTIVE')return 32;
  if(value==='IMPROVING')return 20;
  if(value==='LIMITER')return 30;
  if(value==='AT_RISK')return 20;
  return 0;
}
function enemyNamesFor(tag:DecisionSituationTag|null,context:ReturnType<typeof buildDraftSituationContext>){
  if(tag==='MULTI_ACCESS')return context.enemyAccess.slice(0,3);
  if(tag==='PICK_PRESSURE')return context.enemyPicks.slice(0,3);
  if(tag==='ZONE_OBJECTIVE')return context.enemyZones.slice(0,3);
  return[];
}
function patternScore(pattern:DecisionSituationPattern){
  const recent=pattern.recentFailureRate??pattern.failureRate;
  return clamp(
    stateWeight(pattern.state)
    + confidenceWeight(pattern.confidence)
    + Math.min(26,recent*.26)
    + Math.min(12,pattern.decisions)
    + Math.min(6,pattern.applicableGames),
  );
}
function behaviourDraftRelevance(key:DecisionBehaviourKey,tags:DecisionSituationTag[],role:string){
  let value=0;
  if(tags.includes('MULTI_ACCESS')&&['CARRY_PRESERVATION','SURVIVAL_VALUE','THREAT_ADAPTATION','FIGHT_SELECTION'].includes(key))value+=24;
  if(tags.includes('PICK_PRESSURE')&&['FIGHT_SELECTION','THREAT_ADAPTATION','CARRY_PRESERVATION'].includes(key))value+=18;
  if(tags.includes('ZONE_OBJECTIVE')&&['OBJECTIVE_READINESS','FARM_VS_SETUP'].includes(key))value+=20;
  if(tags.includes('SCALING_WINDOW')&&key==='POWER_SPIKE_CONVERSION')value+=18;
  if(role==='ADC'&&['CARRY_PRESERVATION','SURVIVAL_VALUE'].includes(key))value+=12;
  if(['JUNGLE','SUPPORT'].includes(role)&&key==='OBJECTIVE_READINESS')value+=10;
  return value;
}
function behaviourScore(item:DecisionTwinProfile['behaviours'][number],tags:DecisionSituationTag[],role:string){
  const recent=item.recentScore??70;
  return clamp(
    stateWeight(item.state)
    + confidenceWeight(item.confidence)
    + Math.min(30,Math.max(0,75-recent))
    + Math.min(10,item.applicableGames)
    + behaviourDraftRelevance(item.key,tags,role),
  );
}

function triggerFor(key:DecisionBehaviourKey,tag:DecisionSituationTag|null,enemies:string[]){
  const names=enemies.join(' + ');
  if(key==='CARRY_PRESERVATION'||key==='SURVIVAL_VALUE'){
    if(tag==='MULTI_ACCESS'&&names)return`WHEN ${names} START THE FIRST ACCESS LAYER AND THE FIGHT LOOKS OPEN AFTERWARD.`;
    if(tag==='PICK_PRESSURE'&&names)return`WHEN ${names} CREATE FIRST CONTACT AND YOU ARE TEMPTED TO STEP THROUGH THE THREAT LINE.`;
    return'WHEN FIRST CONTACT HAPPENS AND YOU HAVE TO CHOOSE BETWEEN SAFE UPTIME AND FORCING A HIGHER-PRIORITY TARGET.';
  }
  if(key==='FIGHT_SELECTION'){
    if(names)return`WHEN ${names} CREATE A FIGHT BEFORE YOUR TEAM HAS CLEAN FORMATION / NUMBERS.`;
    return'WHEN A FIGHT STARTS BEFORE YOUR planned trigger, numbers or formation are ready.';
  }
  if(key==='THREAT_ADAPTATION'){
    if(names)return`AFTER ${names} HAVE ALREADY SHOWN THE ACCESS / PICK PATTERN ONCE.`;
    return'AFTER THE SAME ENEMY ACCESS pattern has already punished or displaced you once.';
  }
  if(key==='OBJECTIVE_READINESS')return'WHEN THE NEXT MAJOR OBJECTIVE SETUP WINDOW IS FORMING AND ONE MORE WAVE / CAMP WOULD MAKE YOU SECOND.';
  if(key==='FARM_VS_SETUP')return'WHEN AN EXTRA WAVE / CAMP COMPETES WITH ARRIVING FOR THE NEXT CONNECTED TEAM ACTION.';
  if(key==='RESET_DISCIPLINE')return'BEFORE A VOLUNTARY FIGHT WHEN YOUR BANK CAN BECOME A MEANINGFUL PURCHASE.';
  if(key==='LEAD_PROTECTION')return'WHEN YOUR SIDE HAS CONTROL OR A LEAD AND AN EXTRA KILL / CHASE OFFERS MORE RISK THAN OBJECTIVE CONVERSION.';
  if(key==='DEATH_RECOVERY')return'AFTER A DEATH OR LOST EXCHANGE, BEFORE YOU RE-ENTER ANOTHER CONTESTED ACTION.';
  if(key==='POWER_SPIKE_CONVERSION')return'AFTER YOUR PLANNED ITEM / LEVEL POWER WINDOW COMPLETES AND THE NEXT TEAM PRESSURE WINDOW OPENS.';
  return'BEFORE THE NEXT MAJOR COMMIT.';
}

function preventionFor(key:DecisionBehaviourKey,tag:DecisionSituationTag|null,enemies:string[]){
  const names=enemies.join(' + ');
  if(key==='CARRY_PRESERVATION'||key==='SURVIVAL_VALUE'){
    return names
      ?`FIRST ENGAGE ≠ WALK FORWARD. ACCOUNT FOR ${names} BEFORE CROSSING YOUR FRONT EDGE; HIT THE CLOSEST SAFE TARGET.`
      :'FIRST ENGAGE ≠ WALK FORWARD. PRESERVE THE SAFE DAMAGE LINE AND HIT THE CLOSEST SAFE TARGET.';
  }
  if(key==='FIGHT_SELECTION'){
    return names
      ?`DO NOT TURN ${names}' FIRST CONTACT INTO YOUR COMMIT. ENTER ONLY WHEN YOUR PLANNED TRIGGER / NUMBERS ARE TRUE.`
      :'DO NOT LET FIRST CONTACT MAKE THE DECISION FOR YOU. ENTER ONLY WHEN YOUR PLANNED TRIGGER / NUMBERS ARE TRUE.';
  }
  if(key==='THREAT_ADAPTATION'){
    return names
      ?`AFTER ${names} SHOW THE PATTERN, CHANGE YOUR POSITION / ENTRY BEFORE RE-ENTERING THE SAME SPACE.`
      :'AFTER THE THREAT SHOWS THE PATTERN, CHANGE YOUR POSITION / ENTRY BEFORE RE-ENTERING THE SAME SPACE.';
  }
  if(key==='OBJECTIVE_READINESS')return'LEAVE THE LAST LOW-VALUE RESOURCE WHEN TAKING IT WOULD MAKE YOU SECOND TO SETUP. FIRST ARRIVAL BUYS THE SAFER FIGHT.';
  if(key==='FARM_VS_SETUP')return'IF THE EXTRA RESOURCE MAKES YOU SECOND TO THE TEAM ACTION, LEAVE IT. CONNECT FIRST; FARM AFTER THE WINDOW.';
  if(key==='RESET_DISCIPLINE')return'IF THE BANK COMPLETES REAL COMBAT POWER, SPEND BEFORE THE VOLUNTARY FIGHT. DO NOT CARRY SHOP VALUE INTO THE COMMIT.';
  if(key==='LEAD_PROTECTION')return'WHEN AHEAD, DO NOT BUY A HARDER FIGHT. MAKE THEM ENTER YOUR SETUP AND CONVERT THE CLEAN OBJECTIVE.';
  if(key==='DEATH_RECOVERY')return'BREAK THE SECOND-DEATH CYCLE: TAKE THE SAFEST RESOURCE / RESET BEFORE ANOTHER CONTESTED ACTION.';
  if(key==='POWER_SPIKE_CONVERSION')return'WHEN THE REAL SPIKE COMPLETES, CONNECT TO THE NEXT TEAM PRESSURE WINDOW INSTEAD OF DRIFTING INTO ANOTHER FARM CYCLE.';
  return'USE THE FROZEN DRAFT PLAN BEFORE COMMITTING.';
}

function branchRules(rule:string,key:DecisionBehaviourKey){
  return{
    AHEAD:key==='LEAD_PROTECTION'
      ?'AHEAD: THIS RISK MATTERS MORE. CONVERT CONTROL; DO NOT TURN THE LEAD INTO A CHASE.'
      :`AHEAD: DO NOT LET THE LEAD HIDE THE PATTERN. ${rule}`,
    EVEN:`EVEN: THIS IS THE CLEANEST TEST OF THE PATTERN. ${rule}`,
    BEHIND:key==='DEATH_RECOVERY'
      ?'BEHIND: REDUCE VARIANCE FIRST. BREAK THE SECOND-DEATH CYCLE BEFORE CONTESTING AGAIN.'
      :`BEHIND: REDUCE VARIANCE AND FORCE THE CLEANER VERSION OF THE DECISION. ${rule}`,
  };
}

function titleFor(key:DecisionBehaviourKey,tag:DecisionSituationTag|null){
  if((key==='CARRY_PRESERVATION'||key==='SURVIVAL_VALUE')&&tag==='MULTI_ACCESS')return'SURVIVE THE SECOND ACCESS LAYER';
  if(key==='FIGHT_SELECTION'&&tag==='PICK_PRESSURE')return'DO NOT INHERIT THEIR PICK FIGHT';
  if(key==='THREAT_ADAPTATION')return'CHANGE THE SECOND REP';
  if(key==='OBJECTIVE_READINESS')return'BE FIRST TO THE IMPORTANT SPACE';
  if(key==='FARM_VS_SETUP')return'ONE WAVE VS THE REAL WINDOW';
  if(key==='RESET_DISCIPLINE')return'SPEND BEFORE YOU VOLUNTEER';
  if(key==='LEAD_PROTECTION')return'LEAD ≠ PERMISSION TO COIN-FLIP';
  if(key==='DEATH_RECOVERY')return'BREAK THE SECOND-DEATH CYCLE';
  if(key==='POWER_SPIKE_CONVERSION')return'USE THE SPIKE BEFORE IT EXPIRES';
  if(key==='CARRY_PRESERVATION'||key==='SURVIVAL_VALUE')return'KEEP DAMAGE UPTIME ALIVE';
  if(key==='FIGHT_SELECTION')return'CHOOSE THE FIGHT, DO NOT INHERIT IT';
  return'DECISION WINDOW';
}

function evidenceForPattern(pattern:DecisionSituationPattern){
  const recent=pattern.recentFailureRate===null?'recent window building':`${pattern.recentFailures}/${pattern.recentDecisions} recent misses (${pattern.recentFailureRate}%)`;
  return`${pattern.confidence} confidence · ${pattern.failures}/${pattern.decisions} comparable misses · ${recent} · ${pattern.applicableGames} games.`;
}

export function buildDecisionPremortem(
  twin:DecisionTwinProfile|null|undefined,
  input:{champion:string;role:string|null|undefined;ours:DraftPlayerLike[];enemies:DraftPlayerLike[]},
):DecisionPremortem{
  if(!twin||twin.gamesAnalyzed<3){
    return{
      version:1,
      status:'BUILDING',
      headline:'DECISION PRE-MORTEM IS BUILDING',
      summary:'OP CLIMB needs more repeated personal evidence before ranking draft-specific decision risks.',
      risks:[],
      boundary:BOUNDARY,
    };
  }

  const context=buildDraftSituationContext({champion:input.champion,role:input.role,enemies:input.enemies});
  const role=roleName(input.role);
  const candidates:Array<Omit<DecisionPremortemRisk,'rank'>>=[];

  const contextual=(twin.situationPatterns??[])
    .filter(pattern=>pattern.tag!=='GENERAL'&&context.tags.includes(pattern.tag))
    .filter(pattern=>!pattern.role||!role||pattern.role===role)
    .filter(pattern=>['ACTIVE','REGRESSING','IMPROVING'].includes(pattern.state))
    .filter(pattern=>pattern.decisions>=4&&pattern.applicableGames>=3&&pattern.failures>=2&&pattern.confidence!=='LOW');

  for(const pattern of contextual){
    const enemies=enemyNamesFor(pattern.tag,context);
    const rule=preventionFor(pattern.behaviourKey,pattern.tag,enemies);
    candidates.push({
      id:['premortem',pattern.tag,pattern.behaviourKey,role||'ANY'].join(':').toLowerCase(),
      behaviourKey:pattern.behaviourKey,
      behaviourLabel:pattern.behaviourLabel||LABELS[pattern.behaviourKey],
      situationTag:pattern.tag,
      source:'SITUATION_PATTERN',
      confidence:pattern.confidence,
      priorityScore:patternScore(pattern),
      title:titleFor(pattern.behaviourKey,pattern.tag),
      trigger:triggerFor(pattern.behaviourKey,pattern.tag,enemies),
      preventionRule:rule,
      branchRules:branchRules(rule,pattern.behaviourKey),
      evidence:evidenceForPattern(pattern),
      relevantEnemies:enemies,
    });
  }

  const seenBehaviours=new Set(candidates.map(item=>item.behaviourKey));
  const behaviours=(twin.behaviours??[])
    .filter(item=>item.applicableGames>=3&&item.confidence!=='LOW')
    .filter(item=>item.state==='LIMITER'||item.state==='AT_RISK')
    .filter(item=>!seenBehaviours.has(item.key));

  for(const item of behaviours){
    const preferredTag:DecisionSituationTag|null=
      context.tags.includes('MULTI_ACCESS')&&['CARRY_PRESERVATION','SURVIVAL_VALUE','THREAT_ADAPTATION','FIGHT_SELECTION'].includes(item.key)?'MULTI_ACCESS':
      context.tags.includes('PICK_PRESSURE')&&['FIGHT_SELECTION','THREAT_ADAPTATION','CARRY_PRESERVATION'].includes(item.key)?'PICK_PRESSURE':
      context.tags.includes('ZONE_OBJECTIVE')&&['OBJECTIVE_READINESS','FARM_VS_SETUP'].includes(item.key)?'ZONE_OBJECTIVE':
      context.tags.includes('SCALING_WINDOW')&&item.key==='POWER_SPIKE_CONVERSION'?'SCALING_WINDOW':
      null;
    const enemies=enemyNamesFor(preferredTag,context);
    const rule=preventionFor(item.key,preferredTag,enemies);
    candidates.push({
      id:['premortem','behaviour',item.key,role||'ANY'].join(':').toLowerCase(),
      behaviourKey:item.key,
      behaviourLabel:item.label||LABELS[item.key],
      situationTag:preferredTag,
      source:'BEHAVIOUR',
      confidence:item.confidence,
      priorityScore:behaviourScore(item,context.tags,role),
      title:titleFor(item.key,preferredTag),
      trigger:triggerFor(item.key,preferredTag,enemies),
      preventionRule:rule,
      branchRules:branchRules(rule,item.key),
      evidence:`${item.confidence} confidence · ${item.applicableGames} measurable games · recent ${item.recentScore??'—'}/100 · ${item.evidenceCount} evidence points.`,
      relevantEnemies:enemies,
    });
  }

  const unique=new Map<string,Omit<DecisionPremortemRisk,'rank'>>();
  for(const item of candidates.sort((a,b)=>b.priorityScore-a.priorityScore)){
    const key=item.behaviourKey+'|'+(item.situationTag||'GENERAL');
    if(!unique.has(key))unique.set(key,item);
  }
  const risks=[...unique.values()].slice(0,3).map((item,index)=>({...item,rank:(index+1) as 1|2|3}));

  if(!risks.length){
    return{
      version:1,
      status:'NONE',
      headline:'NO VERIFIED PERSONAL RISK WINDOW',
      summary:'This draft does not strongly match an established weakness or recurring situation, so OP CLIMB will not manufacture a personal prediction.',
      risks:[],
      boundary:BOUNDARY,
    };
  }

  return{
    version:1,
    status:'READY',
    headline:`YOUR ${risks.length} HIGHEST-RISK DECISION WINDOW${risks.length===1?'':'S'}`,
    summary:'Repeated personal evidence + this static draft. Learn the trigger before loading in, then use the frozen branch that fits the game state.',
    risks,
    boundary:BOUNDARY,
  };
}

export function reviewDecisionPremortem(
  premortem:DecisionPremortem|null|undefined,
  nodes:PremortemObservedDecision[],
):DecisionPremortemReview{
  const risks=premortem?.status==='READY'?(premortem.risks??[]):[];
  const results=risks.map(risk=>{
    const matched=nodes.filter(node=>
      node.confidence!=='LOW'
      && node.behaviourKey===risk.behaviourKey
      && (!risk.situationTag||risk.situationTag==='GENERAL'||node.situationTags.includes(risk.situationTag)),
    );
    const good=matched.filter(node=>node.verdict==='GOOD').length;
    const improve=matched.filter(node=>node.verdict==='IMPROVE').length;
    const observed=good+improve;
    const outcome:DecisionPremortemOutcome=!observed?'NOT_OBSERVED':good&&improve?'MIXED':good?'BEAT_PATTERN':'PATTERN_HIT';
    return{
      riskId:risk.id,
      rank:risk.rank,
      behaviourKey:risk.behaviourKey,
      behaviourLabel:risk.behaviourLabel,
      situationTag:risk.situationTag,
      outcome,
      observedMoments:observed,
      goodMoments:good,
      improveMoments:improve,
      note:outcome==='NOT_OBSERVED'
        ?'No verified comparable decision appeared this game.'
        :outcome==='BEAT_PATTERN'
          ?`Verified comparable moments were clean (${good}/${observed}).`
          :outcome==='PATTERN_HIT'
            ?`Every verified comparable moment reproduced the risk (${improve}/${observed}).`
            :`The risk was beaten in ${good} moment${good===1?'':'s'} and reproduced in ${improve}.`,
    } satisfies DecisionPremortemReviewRisk;
  });

  const observed=results.filter(item=>item.outcome!=='NOT_OBSERVED');
  const beaten=results.filter(item=>item.outcome==='BEAT_PATTERN').length;
  const hit=results.filter(item=>item.outcome==='PATTERN_HIT').length;
  const mixed=results.filter(item=>item.outcome==='MIXED').length;
  const unobserved=results.filter(item=>item.outcome==='NOT_OBSERVED').length;
  return{
    version:1,
    active:risks.length>0,
    forecastCount:risks.length,
    observedRisks:observed.length,
    beatenRisks:beaten,
    hitRisks:hit,
    mixedRisks:mixed,
    unobservedRisks:unobserved,
    results,
    note:!risks.length
      ?'No verified Decision Pre-Mortem was frozen before this game.'
      :!observed.length
        ?'None of the pre-game risk windows produced a verified comparable decision, so OP CLIMB will not score them.'
        :hit===0&&mixed===0
          ?'Every pre-game risk that appeared was beaten in the verified evidence.'
          :beaten===0&&mixed===0
            ?'Every pre-game risk that appeared was reproduced in the verified evidence.'
            :'The pre-game risk map was mixed: some patterns were beaten and some still appeared.',
    boundary:REVIEW_BOUNDARY,
  };
}
