import type {CoachEnginePlan} from './draftCoachEngine';
import type {DraftRole} from './draftRoleResolver';
import type {DraftCarryMap} from './carryRoleMap';

export type FrozenContingencyKey='PLAN_A'|'PLAN_B'|'RECOVERY';

export interface FrozenContingency{
  key:FrozenContingencyKey;
  label:string;
  available:boolean;
  when:string;
  resourceOwner:string;
  playAround:string;
  job:string;
  fightWhen:string;
  objective:string;
  never:string;
}

export interface FrozenContingencyMap{
  version:'CONTINGENCY_V1';
  frozenFromPregame:true;
  usesLiveTelemetry:false;
  playerSelects:true;
  primaryCarry:string;
  secondaryCarry:string|null;
  contingencies:Record<FrozenContingencyKey,FrozenContingency>;
  boundary:string;
}

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function compact(value:string,max=150){
  const text=clean(value);
  return text.length<=max?text:text.slice(0,max-1).replace(/\s+\S*$/,'')+'…';
}

function recoveryStyle(plan:CoachEnginePlan){
  const text=[
    plan.headline,
    plan.why,
    plan.fightTrigger,
    plan.objectiveSetup,
    ...(Array.isArray(plan.steps)?plan.steps.map(step=>step.value):[]),
  ].map(clean).join(' ').toUpperCase();
  if(/PICK|CATCH|FOG|VISION/.test(text))return'PICK / FOG';
  if(/SIDE|SPLIT|TRADE SIDE|CROSS.?MAP/.test(text))return'SIDE TRADE';
  if(/SCALE|FARM|STALL|WAVE|BUY TIME/.test(text))return'STALL / SAFE WAVES';
  if(/ABSORB|KITE|FRONT.?TO.?BACK|COUNTER.?ENGAGE|DIVE/.test(text))return'COUNTER-ENGAGE';
  return'TRADE SPACE / SET UP EARLY';
}

function recoveryJob(role:DraftRole|null,style:string){
  if(style==='PICK / FOG')return'CLEAR THE SAFE WAVE → MOVE WITH VISION / PICK TOOLS → TAKE THE FIRST CLEAN NUMBERS EDGE';
  if(style==='SIDE TRADE')return'TRADE THE LOST SIDE → KEEP WAVES MOVING → ONLY GROUP WHEN THE MAP GIVES A CLEAN ENTRY';
  if(style==='STALL / SAFE WAVES')return role==='SUPPORT'
    ?'PROTECT SAFE WAVES / VISION → DO NOT FACE-CHECK LOST SPACE → BUY TIME FOR THE NEXT SPIKE'
    :'TAKE SAFE WAVES / XP → GIVE SPACE YOU CANNOT HOLD → BUY TIME FOR THE NEXT SPIKE';
  if(style==='COUNTER-ENGAGE')return'GIVE FIRST SPACE → KEEP FORMATION → FIGHT ONLY AFTER THEIR FIRST ACCESS / ENGAGE IS SPENT';
  return'TRADE SPACE → RESET EARLY → MAKE THEM ENTER YOUR SETUP INSTEAD OF FORCING INTO THEIRS';
}

export function buildFrozenContingencyMap(input:{
  champion:string;
  role:DraftRole|null;
  carryMap:DraftCarryMap;
  plan:CoachEnginePlan;
}):FrozenContingencyMap{
  const primary=clean(input.carryMap.primary?.champion)||clean(input.carryMap.resourceOwner)||'PRIMARY CARRY';
  const secondaryCandidate=input.carryMap.secondary;
  const secondary=secondaryCandidate&&secondaryCandidate.score>=34?clean(secondaryCandidate.champion):'';
  const threat=clean(input.plan.threats?.[0])||clean(input.carryMap.enemyPrimary?.champion)||'THEIR MAIN THREAT';
  const player=clean(input.champion);
  const baseFight=clean(input.plan.fightTrigger)||clean(input.plan.threatAnswer)||'USE THE ORIGINAL FIGHT TRIGGER';
  const baseObjective=clean(input.plan.objectiveSetup)||'RESET EARLY AND SET UP THE NEXT OBJECTIVE';
  const baseNever=clean(input.plan.never)||'DO NOT FORCE A LOW-VALUE FIGHT';
  const style=recoveryStyle(input.plan);

  const planA:FrozenContingency={
    key:'PLAN_A',
    label:'PLAN A · ORIGINAL CARRY',
    available:true,
    when:compact(primary+' CAN STILL REACH SAFE RESOURCES AND ENTER THE FIGHT ON THE ORIGINAL TERMS.'),
    resourceOwner:primary,
    playAround:clean(input.carryMap.playAround)||primary,
    job:compact(input.carryMap.playerJob||input.plan.headline,120),
    fightWhen:compact(baseFight,120),
    objective:compact(baseObjective,130),
    never:compact(baseNever,120),
  };

  const planBJob=!secondary
    ?'NO VERIFIED SECONDARY CARRY IS STRONG ENOUGH IN THIS DRAFT — USE RECOVERY INSTEAD.'
    :player===secondary
      ?'BECOME THE MAIN DAMAGE CONDITION → TAKE SAFE HIGH-VALUE RESOURCES → CONNECT ONLY ON YOUR SPIKE / SAFE ACCESS'
      :player===primary
        ?'STOP DEMANDING FIRST RESOURCES → PRESERVE SAFE FARM → CREATE SPACE / TEMPO FOR '+secondary
        :input.carryMap.playerRole==='THREAT_DENIAL'
          ?'KEEP '+secondary+' PLAYABLE → HOLD CONTROL FOR '+threat+' → DO NOT CHASE AWAY FROM THE NEW CARRY'
          :'CREATE FIRST MOVE / SPACE FOR '+secondary+' → TAKE ONLY RESOURCES THAT DO NOT BREAK THEIR WINDOW';

  const planB:FrozenContingency={
    key:'PLAN_B',
    label:'PLAN B · SECONDARY CARRY',
    available:Boolean(secondary),
    when:secondary
      ?compact(primary+' CANNOT SAFELY FUNCTION, BUT '+secondary+' CAN STILL REACH RESOURCES / ENTER THE NEXT FIGHT CLEANLY.')
      :'NO STRONG SECONDARY CARRY WAS IDENTIFIED FROM CHAMPION SELECT.',
    resourceOwner:secondary||'NO PLAN B CARRY',
    playAround:secondary||(style==='PICK / FOG'?'PICK / VISION TOOLS':'RECOVERY PLAN'),
    job:compact(planBJob,120),
    fightWhen:secondary?compact('CONNECT TO '+secondary+' ONLY WHEN '+baseFight,120):'USE RECOVERY INSTEAD.',
    objective:secondary?compact('SET UP EARLY ENOUGH FOR '+secondary+' TO ENTER CLEANLY. '+baseObjective,130):'USE RECOVERY INSTEAD.',
    never:secondary?compact('DO NOT KEEP FUNNELLING THE ORIGINAL PLAN AFTER '+primary+' HAS NO CLEAN ACCESS. '+baseNever,120):'DO NOT INVENT A SECONDARY CARRY.',
  };

  const recovery:FrozenContingency={
    key:'RECOVERY',
    label:'RECOVERY · NO CLEAN CARRY WINDOW',
    available:true,
    when:compact('NEITHER '+primary+(secondary?' NOR '+secondary:'')+' CAN TAKE THE NEXT FIGHT / RESOURCE WINDOW CLEANLY.'),
    resourceOwner:'SAFE WAVES / NEXT USABLE SPIKE',
    playAround:style,
    job:compact(recoveryJob(input.role,style),120),
    fightWhen:compact('ONLY AFTER THE ENEMY SPENDS ACCESS / OVEREXTENDS INTO YOUR SETUP. '+clean(input.plan.threatAnswer),120),
    objective:compact('TRADE OR CONCEDE SETUP YOU CANNOT HOLD → RESET FIRST → RE-ENTER ONLY ON THE FROZEN OBJECTIVE RULE. '+baseObjective,130),
    never:compact('DO NOT FORCE A LOSING FRONT-TO-BACK JUST BECAUSE THE ORIGINAL PLAN FAILED. '+baseNever,120),
  };

  return{
    version:'CONTINGENCY_V1',
    frozenFromPregame:true,
    usesLiveTelemetry:false,
    playerSelects:true,
    primaryCarry:primary,
    secondaryCarry:secondary||null,
    contingencies:{PLAN_A:planA,PLAN_B:planB,RECOVERY:recovery},
    boundary:'OP CLIMB DOES NOT DETECT THAT THE WIN CONDITION CHANGED. THE PLAYER SELECTS PLAN A / PLAN B / RECOVERY FROM THE LIVE GAME THEY CAN SEE; EVERY RESPONSE WAS WRITTEN BEFORE THE GAME.',
  };
}
