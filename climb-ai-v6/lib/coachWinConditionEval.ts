import {coachingTierFor,type CoachingTier} from './coachingLevel';

export interface CoachEvalPlayer{champion:string;role?:string|null}
export interface CoachEvalKit{
  champion:string;
  passive?:string|null;
  spells?:Array<{name?:string|null}>|null;
}
export interface CoachEvalPlan{
  headline?:string|null;
  why?:string|null;
  theirPlan?:string|null;
  threatLabel?:string|null;
  threats?:string[]|null;
  threatAnswer?:string|null;
  laneOpponent?:string|null;
  lanePlan?:{wave?:string|null;trade?:string|null;respect?:string|null}|null;
  fightTrigger?:string|null;
  objectiveSetup?:string|null;
  never?:string|null;
  ifBehind?:string|null;
  steps?:Array<{label?:string|null;value?:string|null}>|null;
}
export interface CoachRankRubric{
  tier:CoachingTier;
  passScore:number;
  minChampionMentions:number;
  minAbilityMentions:number;
  minConditionalRules:number;
  maxConditionalRules:number|null;
  theirPlanEnemyMentions:number;
  maxGenericHits:number;
}
export interface CoachEvalResult{
  tier:CoachingTier;
  score:number;
  pass:boolean;
  rubric:CoachRankRubric;
  issues:string[];
  metrics:{
    championMentions:string[];
    abilityMentions:string[];
    conditionalRules:number;
    genericHits:string[];
    laneSpecific:boolean;
    threatCounterSpecific:boolean;
    theirPlanSpecific:boolean;
    fightTriggerSpecific:boolean;
    objectiveSetupSpecific:boolean;
    causalSteps:boolean;
    adcTargetRule:boolean;
  };
}

const RUBRICS:Record<CoachingTier,Omit<CoachRankRubric,'tier'>>={
  IRON:{passScore:58,minChampionMentions:2,minAbilityMentions:0,minConditionalRules:1,maxConditionalRules:4,theirPlanEnemyMentions:1,maxGenericHits:3},
  BRONZE:{passScore:62,minChampionMentions:2,minAbilityMentions:0,minConditionalRules:1,maxConditionalRules:5,theirPlanEnemyMentions:1,maxGenericHits:3},
  SILVER:{passScore:66,minChampionMentions:3,minAbilityMentions:0,minConditionalRules:2,maxConditionalRules:7,theirPlanEnemyMentions:1,maxGenericHits:2},
  GOLD:{passScore:70,minChampionMentions:3,minAbilityMentions:1,minConditionalRules:2,maxConditionalRules:8,theirPlanEnemyMentions:1,maxGenericHits:2},
  PLATINUM:{passScore:74,minChampionMentions:4,minAbilityMentions:1,minConditionalRules:3,maxConditionalRules:10,theirPlanEnemyMentions:1,maxGenericHits:2},
  EMERALD:{passScore:78,minChampionMentions:4,minAbilityMentions:2,minConditionalRules:4,maxConditionalRules:12,theirPlanEnemyMentions:2,maxGenericHits:1},
  DIAMOND:{passScore:82,minChampionMentions:5,minAbilityMentions:2,minConditionalRules:5,maxConditionalRules:null,theirPlanEnemyMentions:2,maxGenericHits:1},
  MASTER:{passScore:86,minChampionMentions:5,minAbilityMentions:3,minConditionalRules:6,maxConditionalRules:null,theirPlanEnemyMentions:2,maxGenericHits:1},
  GRANDMASTER:{passScore:90,minChampionMentions:6,minAbilityMentions:4,minConditionalRules:7,maxConditionalRules:null,theirPlanEnemyMentions:3,maxGenericHits:0},
  CHALLENGER:{passScore:93,minChampionMentions:7,minAbilityMentions:4,minConditionalRules:8,maxConditionalRules:null,theirPlanEnemyMentions:3,maxGenericHits:0},
};

const GENERIC_PHRASES=[
  'play clean','stay connected','farm clean','play safe','fight with setup',
  'play the fight','take a good fight','group with your team','wait for team',
  'scale up','do not die','focus objectives',
];
const CONDITIONAL=/\b(if|when|after|before|until|once|only when|as soon as|hold|bait|track|wait|unless|while)\b/g;
const ADC_TARGET_RULES=[
  'closest safe target','nearest safe target','safe target','front-to-back',
  'what is reachable','what you can safely hit','hit what is in front',
  'highest safe target','do not walk through','don\'t walk through',
];

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function lower(value:unknown){return clean(value).toLowerCase()}
function allText(plan:CoachEvalPlan){
  const lane=plan.lanePlan??{};
  return lower([
    plan.headline,plan.why,plan.theirPlan,plan.threatLabel,plan.threatAnswer,
    lane.wave,lane.trade,lane.respect,plan.fightTrigger,plan.objectiveSetup,
    plan.never,plan.ifBehind,
    ...(plan.steps??[]).flatMap(step=>[step.label,step.value]),
  ].join(' '));
}
function exactMentions(text:string,names:string[]){
  return [...new Set(names.map(clean).filter(Boolean).filter(name=>text.includes(name.toLowerCase())))];
}
function countMentions(text:string,names:string[]){return exactMentions(text,names).length}
function ratioScore(actual:number,required:number,weight:number){
  if(required<=0)return weight;
  return Math.round(weight*Math.min(1,actual/required));
}
function fieldIsSpecific(value:unknown,names:string[],abilities:string[],needsConditional=false){
  const text=lower(value);
  if(!text)return false;
  const named=names.some(name=>text.includes(name.toLowerCase()))||abilities.some(name=>name.length>=4&&text.includes(name.toLowerCase()));
  const hasConditional=(text.match(CONDITIONAL)||[]).length>0;
  return named&&(!needsConditional||hasConditional);
}

export function coachRankRubric(rank?:string|null):CoachRankRubric{
  const tier=coachingTierFor(rank);
  return{tier,...RUBRICS[tier]};
}

export function evaluateWinConditionPlan(input:{
  plan:CoachEvalPlan;
  ours:CoachEvalPlayer[];
  enemies:CoachEvalPlayer[];
  kits?:CoachEvalKit[];
  rank?:string|null;
  role?:string|null;
}):CoachEvalResult{
  const {plan,ours,enemies}=input;
  const kits=input.kits??[];
  const role=clean(input.role).toUpperCase();
  const rubric=coachRankRubric(input.rank);
  const text=allText(plan);
  const championNames=[...ours,...enemies].map(player=>clean(player.champion)).filter(Boolean);
  const enemyNames=enemies.map(player=>clean(player.champion)).filter(Boolean);
  const allyNames=ours.map(player=>clean(player.champion)).filter(Boolean);
  const abilityNames=[...new Set(kits.flatMap(kit=>[
    clean(kit.passive).split(':')[0],
    ...(kit.spells??[]).map(spell=>clean(spell?.name)),
  ]).filter(name=>name.length>=4))];

  const championMentions=exactMentions(text,championNames);
  const abilityMentions=exactMentions(text,abilityNames);
  const conditionalRules=(text.match(CONDITIONAL)||[]).length;
  const genericHits=GENERIC_PHRASES.filter(phrase=>text.includes(phrase));
  const laneOpponent=clean(plan.laneOpponent);
  const laneKit=kits.find(kit=>lower(kit.champion)===laneOpponent.toLowerCase());
  const laneAbilityNames=[
    clean(laneKit?.passive).split(':')[0],
    ...(laneKit?.spells??[]).map(spell=>clean(spell?.name)),
  ].filter(name=>name.length>=4);
  const laneText=lower([plan.lanePlan?.wave,plan.lanePlan?.trade,plan.lanePlan?.respect].join(' '));
  const laneSpecific=Boolean(laneOpponent)&&(
    laneText.includes(laneOpponent.toLowerCase())||
    laneAbilityNames.some(name=>laneText.includes(name.toLowerCase()))
  );
  const threatNames=(plan.threats??[]).map(clean).filter(Boolean);
  const threatCounterSpecific=threatNames.some(name=>lower(plan.threatAnswer).includes(name.toLowerCase()))&&
    ((lower(plan.threatAnswer).match(CONDITIONAL)||[]).length>0||rubric.tier==='IRON'||rubric.tier==='BRONZE');
  const theirPlanEnemyMentions=countMentions(lower(plan.theirPlan),enemyNames);
  const theirPlanSpecific=theirPlanEnemyMentions>=rubric.theirPlanEnemyMentions;
  const fightTriggerSpecific=fieldIsSpecific(plan.fightTrigger,[...enemyNames,...allyNames],abilityNames,true);
  const objectiveSetupSpecific=fieldIsSpecific(plan.objectiveSetup,[...enemyNames,...allyNames],abilityNames,false)&&
    /arrive|vision|face-?check|choke|entry|zone|flank|setup|river|objective|dragon|baron/.test(lower(plan.objectiveSetup));
  const stepValues=(plan.steps??[]).map(step=>lower(step.value)).filter(Boolean);
  const causalSteps=stepValues.length===5&&new Set(stepValues).size===5&&(
    conditionalRules>=rubric.minConditionalRules||
    stepValues.some(value=>/→|then|after|before|if|when/.test(value))
  );
  const adcTargetRule=role!=='ADC'||ADC_TARGET_RULES.some(rule=>text.includes(rule));

  let score=0;
  score+=ratioScore(championMentions.length,rubric.minChampionMentions,14);
  const abilityGate=rubric.minAbilityMentions>0&&kits.length>=6;
  score+=abilityGate?ratioScore(abilityMentions.length,rubric.minAbilityMentions,10):10;
  score+=ratioScore(conditionalRules,rubric.minConditionalRules,10);
  score+=laneSpecific?10:0;
  score+=threatCounterSpecific?10:0;
  score+=theirPlanSpecific?10:0;
  score+=fightTriggerSpecific?10:0;
  score+=objectiveSetupSpecific?10:0;
  score+=causalSteps?8:0;
  score+=adcTargetRule?8:0;

  const issues:string[]=[];
  if(championMentions.length<rubric.minChampionMentions)issues.push(`needs at least ${rubric.minChampionMentions} named champion interactions`);
  if(abilityGate&&abilityMentions.length<rubric.minAbilityMentions)issues.push(`needs at least ${rubric.minAbilityMentions} grounded ability/passive references`);
  if(conditionalRules<rubric.minConditionalRules)issues.push(`needs at least ${rubric.minConditionalRules} IF/WHEN/AFTER decision rules`);
  if(rubric.maxConditionalRules!==null&&conditionalRules>rubric.maxConditionalRules){
    score-=6;
    issues.push(`too many branches for ${rubric.tier}; simplify the presentation`);
  }
  if(!laneSpecific)issues.push('lane plan is not tied to the actual opponent or their kit');
  if(!threatCounterSpecific)issues.push('counter-plan does not name and answer the actual access threat');
  if(!theirPlanSpecific)issues.push('their win condition is not explained through named enemy interactions');
  if(!fightTriggerSpecific)issues.push('fight trigger is not a named conditional decision');
  if(!objectiveSetupSpecific)issues.push('objective setup does not explain the map geometry created by the draft');
  if(!causalSteps)issues.push('five-step path is not a causal sequence');
  if(!adcTargetRule)issues.push('ADC plan lacks a target-accessibility rule');

  if(genericHits.length>rubric.maxGenericHits){
    score-=Math.min(12,(genericHits.length-rubric.maxGenericHits)*3);
    issues.push('too much generic coaching language');
  }
  score=Math.max(0,Math.min(100,score));

  return{
    tier:rubric.tier,
    score,
    pass:score>=rubric.passScore&&issues.length===0,
    rubric,
    issues,
    metrics:{
      championMentions,abilityMentions,conditionalRules,genericHits,laneSpecific,
      threatCounterSpecific,theirPlanSpecific,fightTriggerSpecific,objectiveSetupSpecific,
      causalSteps,adcTargetRule,
    },
  };
}
