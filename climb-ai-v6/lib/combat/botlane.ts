import {mitigateAll,noPenetration,type DamageBreakdown,type DamageComponent,type DamageType,type Penetration,type TargetResistances} from './damage';
import {applyDamageRules,attackInterval,hasteMultiplier,resolveOnHit,type AbilityModel,type AbilitySlot,type AutoAttackModel,type ComboStep} from './combos';
import {autoProcTriggers,onHitTriggers,type DamageRule,type OnHitEffect,type TargetDebuffEffect} from './effects';
import {abilityCooldownSeconds,abilityDamageMultiplier,applyAbilityStackAfterCast,consumeMark,createCombatRuntime,timedAutoSnapshot,type CombatRuntimeState,type InitialTargetMark} from './state';
import {consumeRechargeableAttack,rechargeableAttackEffects,rechargeableAttackWindupBonusAttackSpeedFlat,reduceRechargeableAttackCooldownOnAbilityHit} from './attackInteractions';
import {basicAttackHitTiming} from './attackTiming';
import type {AdvancedDuelAbilityOverlay,AdvancedDuelOpeningShield,DuelShieldScope,DuelSustainEffect} from './duelAdvanced';

export type BotLaneKey='YOU_ADC'|'YOU_SUPPORT'|'THEM_ADC'|'THEM_SUPPORT';
export type BotLaneTeam='YOU'|'THEM';
export type BotLaneRole='ADC'|'SUPPORT';
export type BotLaneVerdict='YOU_WIN'|'THEM_WIN'|'YOU_AHEAD'|'THEM_AHEAD'|'EVEN'|'DOUBLE_KO';

export interface AllyUtilityOverlay{
  shield?:{label:string;amount:number;durationSeconds:number|null;scope:DuelShieldScope};
  heal?:{label:string;amount:number};
}

export interface BotLaneParticipantInput{
  key:BotLaneKey;
  team:BotLaneTeam;
  role:BotLaneRole;
  champion:string;
  sequence:ComboStep[];
  abilities:Partial<Record<AbilitySlot,AbilityModel>>;
  autoAttack:AutoAttackModel;
  mana:number;
  maxHealth:number;
  currentHealth?:number;
  shield?:number;
  openingShields?:AdvancedDuelOpeningShield[];
  resistances:TargetResistances;
  penetration?:Penetration;
  abilityHaste?:number;
  damageRules?:DamageRule[];
  initialTargetMarks?:InitialTargetMark[];
  outgoingDamageMultiplier?:number;
  outgoingDamageMultiplierDurationSeconds?:number;
  abilityOverlays?:Partial<Record<AbilitySlot,AdvancedDuelAbilityOverlay>>;
  sustainEffects?:DuelSustainEffect[];
  /** Enemy focus preference. Automatically retargets if that champion dies before a new action starts. */
  focusTarget:BotLaneKey;
  /** Ally who receives ally-targeted utility; supports normally protect their ADC. */
  protectTarget?:BotLaneKey;
  allyUtility?:Partial<Record<AbilitySlot,AllyUtilityOverlay>>;
}

export interface BotLaneSnapshot{
  key:BotLaneKey;
  champion:string;
  team:BotLaneTeam;
  role:BotLaneRole;
  health:number;
  maxHealth:number;
  shield:number;
  mana:number;
  alive:boolean;
  damageDealt:number;
  damageTaken:number;
  healingDone:number;
  shieldingDone:number;
  controlledUntil:number;
}

export interface BotLaneActionEvent{
  actor:BotLaneKey;
  champion:string;
  step:ComboStep;
  target:BotLaneKey|null;
  targetChampion:string|null;
  status:'CAST'|'NO_RESOURCE'|'NOT_LEARNED'|'NO_TARGET';
  rawDamage:number;
  mitigatedDamage:number;
  damageApplied:number;
  healApplied:number;
  shieldGranted:number;
  controlSeconds:number;
  note?:string;
  incomplete:boolean;
}

export interface BotLaneFrame{
  atSeconds:number;
  actions:BotLaneActionEvent[];
  participants:Record<BotLaneKey,BotLaneSnapshot>;
}

export interface BotLaneKill{
  atSeconds:number;
  victim:BotLaneKey;
  champion:string;
  team:BotLaneTeam;
  by:BotLaneKey[];
}

export interface BotLaneResult{
  verdict:BotLaneVerdict;
  winner:BotLaneTeam|null;
  durationSeconds:number;
  timeline:BotLaneFrame[];
  kills:BotLaneKill[];
  participants:Record<BotLaneKey,BotLaneSnapshot>;
  teamDamage:{YOU:number;THEM:number};
  damageContribution:Record<BotLaneKey,number>;
  firstKill:BotLaneKill|null;
  incomplete:boolean;
  assumptions:string[];
  modelNote:string;
}

export interface BotLaneFocusComparison{
  recommendedTarget:BotLaneKey;
  recommendedRole:'ADC'|'SUPPORT';
  reason:string;
  adcFocus:BotLaneResult;
  supportFocus:BotLaneResult;
}

interface ActiveDebuff{effect:TargetDebuffEffect;expiresAt:number}
interface TimedShield{label:string;amount:number;expiresAt:number;scope:DuelShieldScope}
interface ActorRuntime{
  input:BotLaneParticipantInput;
  health:number;
  persistentShield:number;
  timedShields:TimedShield[];
  mana:number;
  autoCount:number;
  attackStacks:number;
  combat:CombatRuntimeState;
  incomingDebuffs:ActiveDebuff[];
  abilityReadyAt:Map<AbilitySlot,number>;
  autoReadyAt:number;
  nextFreeAt:number;
  controlledUntil:number;
  actionIndex:number;
  damageDealt:number;
  damageTaken:number;
  healingDone:number;
  shieldingDone:number;
  incomplete:boolean;
  consumedControlKeys:Set<string>;
}
interface PreparedAction{
  actor:ActorRuntime;
  target:ActorRuntime|null;
  protect:ActorRuntime|null;
  event:BotLaneActionEvent;
  breakdown?:DamageBreakdown;
  targetDebuff?:TargetDebuffEffect;
  targetControl?:NonNullable<AdvancedDuelAbilityOverlay['targetControl']>;
  overlay?:AdvancedDuelAbilityOverlay;
  allyUtility?:AllyUtilityOverlay;
}
interface PendingAutoHit{
  actor:ActorRuntime;
  /** Locked when the attack starts; never retargeted during the windup. */
  target:ActorRuntime;
  protect:ActorRuntime|null;
  event:BotLaneActionEvent;
  hitsAt:number;
  attackNumber:number;
  attackStacksBefore:number;
  replacementEffects:OnHitEffect[]|null;
}

const ORDER:BotLaneKey[]=['YOU_ADC','YOU_SUPPORT','THEM_ADC','THEM_SUPPORT'];
const EPS=1e-9;
const MAX_FRAMES=512;
export const BOT_LANE_MODEL_NOTE='Four champions share one deterministic event clock. Both bot laners on each team can damage, shield, heal and crowd-control while focus targets automatically swap after a death for future actions. Validated basic attacks are pending hits during their windup and keep the target selected when the attack began; they cannot jump to the other bot-laner mid-swing. Rechargeable attack passives use the same clock and begin cooldown on impact. Same-timestamp actions resolve together. Movement, projectile travel, body-blocking, skillshot miss chance, minions and positional range access are not inferred yet.';

export function simulateBotLane(
  inputs:Record<BotLaneKey,BotLaneParticipantInput>,
  maxDurationSeconds=10,
):BotLaneResult{
  const actors=Object.fromEntries(ORDER.map(k=>[k,createActor(inputs[k])])) as Record<BotLaneKey,ActorRuntime>;
  const timeline:BotLaneFrame[]=[];
  const kills:BotLaneKill[]=[];
  const pendingAutos:PendingAutoHit[]=[];
  const assumptions=[BOT_LANE_MODEL_NOTE,'When multiple eligible shields overlap, the earliest-expiring timed shield is consumed first, then persistent shield.','If a configured focus target dies, future actions automatically retarget the surviving enemy; a basic attack already winding up remains locked to its original target.'];
  let clock=0;

  for(let frame=0;frame<MAX_FRAMES;frame++){
    if(teamDead(actors,'YOU')||teamDead(actors,'THEM'))break;
    const schedule=ORDER.map(key=>({key,at:nextActionAt(actors[key])}));
    const pendingAt=pendingAutos.length?Math.min(...pendingAutos.map(hit=>hit.hitsAt)):Infinity;
    const next=Math.min(pendingAt,...schedule.map(x=>x.at));
    if(!Number.isFinite(next)||next>maxDurationSeconds+EPS){clock=Math.min(maxDurationSeconds,Number.isFinite(next)?next:maxDurationSeconds);break}
    clock=Math.max(clock,next);
    for(const key of ORDER)expireShields(actors[key],clock);

    const acting=schedule.filter(x=>Math.abs(x.at-clock)<=EPS).map(x=>actors[x.key]);
    const beforeAlive=new Map(ORDER.map(k=>[k,actors[k].health>0]));
    const prepped=acting.map(actor=>preflight(actor,actors,clock));
    const actions:PreparedAction[]=[];
    for(const pre of prepped){
      if(pre.event.status==='CAST'&&pre.event.step==='AA'&&pre.target){
        const immediate=scheduleAuto(pre,clock,pendingAutos);
        if(immediate)actions.push(immediate);
      }else actions.push(prepareDamage(pre,clock));
    }

    const due=pendingAutos.filter(hit=>Math.abs(hit.hitsAt-clock)<=EPS);
    for(const hit of due)actions.push(preparePendingAutoHit(hit,clock));
    if(due.length){
      const dueSet=new Set(due);
      for(let i=pendingAutos.length-1;i>=0;i--)if(dueSet.has(pendingAutos[i]))pendingAutos.splice(i,1);
    }

    // Cast-start ally utility exists before same-frame incoming damage.
    for(const pre of actions){
      if(pre.event.status!=='CAST'||!pre.protect||!pre.allyUtility)continue;
      const utility=pre.allyUtility;
      if(utility.shield){
        const granted=grantTimedShield(pre.protect,utility.shield,clock);
        pre.actor.shieldingDone+=granted;
        pre.event.shieldGranted=round(granted);
      }
      if(utility.heal){
        const before=pre.protect.health;
        pre.protect.health=Math.min(pre.protect.input.maxHealth,pre.protect.health+positive(utility.heal.amount));
        const healed=Math.max(0,pre.protect.health-before);
        pre.actor.healingDone+=healed;
        pre.event.healApplied=round(healed);
      }
    }

    // Damage from the whole frame is prepared from the same pre-damage state,
    // then applied. The fixed actor order only resolves ambiguous shield ordering.
    for(const pre of actions){
      if(pre.event.status!=='CAST'||!pre.target||!pre.breakdown)continue;
      const applied=applyIncomingBreakdown(pre.target,pre.breakdown,clock);
      pre.event.damageApplied=round(applied.healthDamage+applied.shieldDamage);
      pre.actor.damageDealt+=pre.event.damageApplied;
      pre.target.damageTaken+=pre.event.damageApplied;
    }

    // Sustain after same-frame damage.
    for(const pre of actions){
      if(pre.event.status!=='CAST')continue;
      let heal=0;
      for(const sustain of pre.actor.input.sustainEffects??[]){
        if(clock>=Math.max(0,sustain.durationSeconds)-EPS)continue;
        heal+=pre.event.damageApplied*Math.max(0,sustain.healFromDamageRatio);
      }
      if(heal>0){
        const before=pre.actor.health;
        pre.actor.health=Math.min(pre.actor.input.maxHealth,Math.max(0,pre.actor.health)+heal);
        const applied=Math.max(0,pre.actor.health-before);
        pre.actor.healingDone+=applied;
        pre.event.healApplied=round(pre.event.healApplied+applied);
      }
    }

    // Successful hit state and CC apply to later timestamps.
    for(const pre of actions){
      if(pre.event.status!=='CAST'||!pre.target||!pre.breakdown)continue;
      if(pre.targetDebuff)
        upsertDebuff(pre.target.incomingDebuffs,pre.targetDebuff,clock+pre.targetDebuff.durationSeconds);
      const control=pre.targetControl;
      if(control&&pre.target.health>0&&canApplyControl(pre.actor,control)){
        const lock=Math.max(0,finite(control.actionLockSeconds));
        if(lock>0)pre.target.controlledUntil=Math.max(pre.target.controlledUntil,clock+lock);
        if(control.consumeKey)pre.actor.consumedControlKeys.add(control.consumeKey);
        pre.event.controlSeconds=round(Math.max(0,finite(control.durationSeconds)));
      }
    }

    for(const victim of ORDER){
      if(!beforeAlive.get(victim)||actors[victim].health>0)continue;
      const attackers=actions.filter(a=>a.target?.input.key===victim&&a.event.damageApplied>0).map(a=>a.actor.input.key);
      kills.push({atSeconds:round(clock),victim,champion:actors[victim].input.champion,team:actors[victim].input.team,by:[...new Set(attackers)]});
    }

    if(actions.length)timeline.push({atSeconds:round(clock),actions:actions.map(a=>a.event),participants:snapshots(actors,clock)});
  }

  const final=snapshots(actors,clock);
  const winner=winnerFrom(final);
  const verdict=verdictFrom(final,winner,kills);
  const teamDamage={
    YOU:round(final.YOU_ADC.damageDealt+final.YOU_SUPPORT.damageDealt),
    THEM:round(final.THEM_ADC.damageDealt+final.THEM_SUPPORT.damageDealt),
  };
  const damageContribution=Object.fromEntries(ORDER.map(key=>[key,final[key].damageDealt])) as Record<BotLaneKey,number>;
  return {
    verdict,winner,durationSeconds:round(clock),timeline,kills,participants:final,
    teamDamage,damageContribution,firstKill:kills[0]??null,
    incomplete:ORDER.some(key=>actors[key].incomplete),assumptions,modelNote:BOT_LANE_MODEL_NOTE,
  };
}

export function compareYourFocusTargets(
  inputs:Record<BotLaneKey,BotLaneParticipantInput>,
  maxDurationSeconds=10,
):BotLaneFocusComparison{
  const adcInputs=cloneInputs(inputs);
  adcInputs.YOU_ADC.focusTarget='THEM_ADC';adcInputs.YOU_SUPPORT.focusTarget='THEM_ADC';
  const supportInputs=cloneInputs(inputs);
  supportInputs.YOU_ADC.focusTarget='THEM_SUPPORT';supportInputs.YOU_SUPPORT.focusTarget='THEM_SUPPORT';
  const adcFocus=simulateBotLane(adcInputs,maxDurationSeconds);
  const supportFocus=simulateBotLane(supportInputs,maxDurationSeconds);
  const adcScore=focusScore(adcFocus,'YOU');
  const supportScore=focusScore(supportFocus,'YOU');
  const recommendAdc=adcScore>=supportScore;
  const chosen=recommendAdc?adcFocus:supportFocus;
  const target=recommendAdc?'THEM_ADC':'THEM_SUPPORT';
  const targetName=chosen.participants[target].champion;
  const delta=Math.abs(adcScore-supportScore);
  return {
    recommendedTarget:target,recommendedRole:recommendAdc?'ADC':'SUPPORT',
    reason:delta<5
      ?`Both focus plans are close. ${targetName} is the slight deterministic edge, but access/skillshot reliability can override it.`
      :`Focusing ${targetName} produces the stronger team-health/kill outcome in this exact setup (${round(Math.max(adcScore,supportScore))} vs ${round(Math.min(adcScore,supportScore))} focus score).`,
    adcFocus,supportFocus,
  };
}

function preflight(actor:ActorRuntime,actors:Record<BotLaneKey,ActorRuntime>,clock:number):PreparedAction{
  const step=actor.input.sequence[actor.actionIndex];
  const target=chooseEnemyTarget(actor,actors);
  const protect=chooseProtectTarget(actor,actors);
  const event:BotLaneActionEvent={actor:actor.input.key,champion:actor.input.champion,step,target:target?.input.key??null,targetChampion:target?.input.champion??null,status:'CAST',rawDamage:0,mitigatedDamage:0,damageApplied:0,healApplied:0,shieldGranted:0,controlSeconds:0,incomplete:false};
  if(!target){actor.actionIndex++;return {actor,target:null,protect,event:{...event,status:'NO_TARGET',note:'No living enemy target.'}}}

  if(step==='AA'){
    const timed=timedAutoSnapshot(actor.input.autoAttack.timedStates,clock);
    const cost=timed.resourceCostOverride??positive(actor.input.autoAttack.resourceCost??0);
    if(cost>actor.mana+EPS){actor.actionIndex++;return {actor,target,protect,event:{...event,status:'NO_RESOURCE',note:`Basic attack costs ${round(cost)} resource; only ${round(actor.mana)} remains.`}}}
    actor.mana-=cost;
    return {actor,target,protect,event};
  }

  const ability=actor.input.abilities[step];
  if(!ability){actor.actionIndex++;return {actor,target,protect,event:{...event,status:'NOT_LEARNED',note:`${step} is not learned or available.`}}}
  event.target=target.input.key;event.targetChampion=target.input.champion;
  const cost=positive(ability.cost);
  if(cost>actor.mana+EPS){actor.actionIndex++;return {actor,target,protect,event:{...event,status:'NO_RESOURCE',note:`${ability.name} costs ${round(cost)} resource; only ${round(actor.mana)} remains.`}}}
  actor.mana-=cost;
  const overlay=actor.input.abilityOverlays?.[step];
  const selfShield=overlay?.selfShield;
  if(selfShield&&(selfShield.timing??'CAST_START')==='CAST_START'){
    const granted=grantTimedShield(actor,selfShield,clock);actor.shieldingDone+=granted;event.shieldGranted=round(granted);
  }
  const selfHeal=overlay?.selfHeal;
  if(selfHeal&&(selfHeal.timing??'CAST_START')==='CAST_START'){
    const before=actor.health;actor.health=Math.min(actor.input.maxHealth,actor.health+positive(selfHeal.amount));
    const healed=Math.max(0,actor.health-before);actor.healingDone+=healed;event.healApplied=round(healed);
  }
  return {actor,target,protect,event,targetDebuff:ability.targetDebuff,targetControl:overlay?.targetControl,overlay,allyUtility:actor.input.allyUtility?.[step]};
}

function scheduleAuto(pre:PreparedAction,clock:number,pending:PendingAutoHit[]):PreparedAction|null{
  const {actor,target,event,protect}=pre;if(!target)return pre;
  const model=actor.input.autoAttack;
  const timedAtStart=timedAutoSnapshot(model.timedStates,clock);
  const speed=currentAttackSpeed(model,actor.attackStacks,timedAtStart);
  const replacementEffects=rechargeableAttackEffects(model,actor.combat,clock);
  const windupBonus=replacementEffects?.length?rechargeableAttackWindupBonusAttackSpeedFlat(model,actor.combat,clock):0;
  const hitTiming=basicAttackHitTiming(model,clock,speed,windupBonus);
  const interval=attackInterval(speed);
  actor.autoReadyAt=clock+interval;actor.nextFreeAt=actor.autoReadyAt;actor.actionIndex++;
  const hit:PendingAutoHit={actor,target,protect,event,hitsAt:hitTiming.hitsAt,attackNumber:actor.autoCount+1,attackStacksBefore:actor.attackStacks,replacementEffects};
  if(hitTiming.hitsAt<=clock+EPS)return preparePendingAutoHit(hit,clock);
  pending.push(hit);return null;
}

function preparePendingAutoHit(hit:PendingAutoHit,clock:number):PreparedAction{
  const {actor,target,event,protect}=hit;
  if(actor.health<=0){event.note='Basic attack cancelled because the attacker died during its windup.';return {actor,target,protect,event}}
  if(target.health<=0){event.note='Original basic-attack target died during the windup; the pending attack does not retarget.';return {actor,target,protect,event}}
  const model=actor.input.autoAttack;const timed=timedAutoSnapshot(model.timedStates,clock);
  const components:DamageComponent[]=hit.replacementEffects?.length
    ?hit.replacementEffects.map(effect=>resolveOnHit(effect,target.health,target.input.maxHealth))
    :[{label:'Auto attack',type:'PHYSICAL',raw:positive(model.damage)*timed.basicAttackDamageMultiplier}];
  for(const effect of [...(model.onHits??[]),...timed.onHits])if(onHitTriggers(effect,hit.attackNumber))components.push(resolveOnHit(effect,target.health,target.input.maxHealth));
  for(const consumer of model.eventState?.consumesMarks??[])if(consumeMark(actor.combat,consumer,clock))components.push(resolveOnHit(consumer.damage,target.health,target.input.maxHealth));
  for(const proc of model.autoProcs??[])if(autoProcTriggers(proc,hit.attackNumber))components.push(resolveOnHit(proc.damage,target.health,target.input.maxHealth));
  const stack=model.attackStack;if(stack?.onHitAtMax&&hit.attackStacksBefore>=stack.maxStacks)components.push(resolveOnHit(stack.onHitAtMax,target.health,target.input.maxHealth));
  const adjusted=applyDamageRules(components,actor.input.damageRules??[],target.health,target.input.maxHealth,Math.max(0,hit.attackNumber-1),outgoingMultiplier(actor,clock));
  const result=mitigateAll(adjusted,resistancesAt(target,clock),actor.input.penetration??noPenetration());
  const pre:PreparedAction={actor,target,protect,event,breakdown:result};event.rawDamage=result.rawTotal;event.mitigatedDamage=result.mitigatedTotal;event.incomplete=!result.complete;actor.incomplete||=!result.complete;
  const passiveProc=hit.replacementEffects?.length?consumeRechargeableAttack(model,actor.combat,clock):null;
  if(passiveProc)event.note=`${passiveProc.label} landed at ${round(clock)}s; passive ready at ${passiveProc.readyAt}s before later refunds.`;
  actor.autoCount=Math.max(actor.autoCount,hit.attackNumber);if(stack)actor.attackStacks=Math.min(stack.maxStacks,actor.attackStacks+1);
  return pre;
}

function prepareDamage(pre:PreparedAction,clock:number):PreparedAction{
  const {actor,target,event}=pre;
  if(event.status!=='CAST'||!target)return pre;
  if(event.step==='AA')return pre;

  const ability=actor.input.abilities[event.step];if(!ability)return pre;
  const components:DamageComponent[]=[...ability.damage,...(ability.dynamicDamage??[]).map(effect=>resolveOnHit(effect,target.health,target.input.maxHealth))];
  for(const consumer of ability.eventState?.consumesMarks??[])if(consumeMark(actor.combat,consumer,clock))components.push(resolveOnHit(consumer.damage,target.health,target.input.maxHealth));
  const stackRule=ability.eventState?.stackRule;const multiplier=abilityDamageMultiplier(actor.combat,stackRule,clock);
  const stateAdjusted=multiplier===1?components:components.map(c=>c.raw===null?c:{...c,raw:round(c.raw*multiplier)});
  const adjusted=applyDamageRules(stateAdjusted,actor.input.damageRules??[],target.health,target.input.maxHealth,actor.autoCount,outgoingMultiplier(actor,clock));
  const result=mitigateAll(adjusted,resistancesAt(target,clock),actor.input.penetration??noPenetration());
  pre.breakdown=result;event.rawDamage=result.rawTotal;event.mitigatedDamage=result.mitigatedTotal;event.incomplete=!result.complete;actor.incomplete||=!result.complete;
  const passiveRefund=reduceRechargeableAttackCooldownOnAbilityHit(actor.input.autoAttack,actor.combat,ability,clock);
  if(passiveRefund)event.note=`${passiveRefund.label}: ability hit refunded ${passiveRefund.reduction}s; passive ready at ${passiveRefund.after}s.`;
  const cooldownBase=abilityCooldownSeconds(ability.cooldownSeconds,actor.combat,stackRule,clock);applyAbilityStackAfterCast(actor.combat,stackRule,clock);
  actor.abilityReadyAt.set(event.step,clock+cooldownBase*hasteMultiplier(actor.input.abilityHaste??0));
  const castTime=Math.max(0,positive(ability.castTimeSeconds));actor.nextFreeAt=clock+castTime;
  if(ability.eventState?.resetsBasicAttackTimer)actor.autoReadyAt=Math.min(actor.autoReadyAt,clock+castTime);
  actor.actionIndex++;
  return pre;
}

function createActor(input:BotLaneParticipantInput):ActorRuntime{
  const maxHealth=Math.max(1,positive(input.maxHealth));const current=Math.min(maxHealth,Math.max(0,finiteOr(input.currentHealth,maxHealth)));
  const stackRules=Object.values(input.abilities).map(a=>a?.eventState?.stackRule).filter((x):x is NonNullable<typeof x>=>Boolean(x));
  const timedShields=(input.openingShields??[]).filter(s=>positive(s.amount)>0).map(s=>({label:s.label,amount:positive(s.amount),expiresAt:s.durationSeconds===null?Infinity:Math.max(0,s.durationSeconds),scope:s.scope}));
  return {input:{...input,maxHealth},health:current,persistentShield:positive(input.shield??0),timedShields,mana:positive(input.mana),autoCount:0,attackStacks:0,combat:createCombatRuntime(stackRules,input.initialTargetMarks??[]),incomingDebuffs:[],abilityReadyAt:new Map(),autoReadyAt:0,nextFreeAt:0,controlledUntil:0,actionIndex:0,damageDealt:0,damageTaken:0,healingDone:0,shieldingDone:0,incomplete:false,consumedControlKeys:new Set()};
}

function nextActionAt(actor:ActorRuntime){
  if(actor.health<=0||actor.actionIndex>=actor.input.sequence.length)return Infinity;
  const step=actor.input.sequence[actor.actionIndex];let ready=Math.max(actor.nextFreeAt,actor.controlledUntil);
  if(step==='AA')return Math.max(ready,actor.autoReadyAt);
  return Math.max(ready,actor.abilityReadyAt.get(step)??0);
}
function chooseEnemyTarget(actor:ActorRuntime,actors:Record<BotLaneKey,ActorRuntime>){
  const preferred=actors[actor.input.focusTarget];if(preferred&&preferred.health>0&&preferred.input.team!==actor.input.team)return preferred;
  return ORDER.map(k=>actors[k]).find(a=>a.input.team!==actor.input.team&&a.health>0)??null;
}
function chooseProtectTarget(actor:ActorRuntime,actors:Record<BotLaneKey,ActorRuntime>){
  const key=actor.input.protectTarget;if(key&&actors[key]?.health>0&&actors[key].input.team===actor.input.team)return actors[key];
  return ORDER.map(k=>actors[k]).find(a=>a.input.team===actor.input.team&&a.input.role==='ADC'&&a.health>0)??actor;
}
function canApplyControl(actor:ActorRuntime,control:NonNullable<AdvancedDuelAbilityOverlay['targetControl']>){return !control.consumeKey||!actor.consumedControlKeys.has(control.consumeKey)}
function grantTimedShield(actor:ActorRuntime,shield:{label:string;amount:number;durationSeconds:number|null;scope:DuelShieldScope},clock:number){
  const amount=positive(shield.amount);if(amount<=0)return 0;actor.timedShields.push({label:shield.label,amount,expiresAt:shield.durationSeconds===null?Infinity:clock+Math.max(0,shield.durationSeconds),scope:shield.scope});return amount;
}
function expireShields(actor:ActorRuntime,clock:number){actor.timedShields=actor.timedShields.filter(s=>s.amount>EPS&&s.expiresAt>clock+EPS)}
function applyIncomingBreakdown(actor:ActorRuntime,breakdown:DamageBreakdown,clock:number){
  expireShields(actor,clock);let healthDamage=0,shieldDamage=0;
  const components=[...breakdown.components];
  for(const component of components){let remaining=Math.max(0,component.mitigated);actor.timedShields.sort((a,b)=>a.expiresAt-b.expiresAt);
    for(const shield of actor.timedShields){if(remaining<=EPS)break;if(!shieldEligible(shield.scope,component.type))continue;const used=Math.min(shield.amount,remaining);shield.amount-=used;remaining-=used;shieldDamage+=used}
    expireShields(actor,clock);if(remaining>EPS&&actor.persistentShield>0){const used=Math.min(actor.persistentShield,remaining);actor.persistentShield-=used;remaining-=used;shieldDamage+=used}
    const hp=Math.min(actor.health,remaining);actor.health=Math.max(0,actor.health-hp);healthDamage+=hp;
  }
  return {healthDamage:round(healthDamage),shieldDamage:round(shieldDamage)};
}
function shieldEligible(scope:DuelShieldScope,type:DamageType){return scope==='ALL'||(scope==='PHYSICAL'&&type==='PHYSICAL')||(scope==='MAGIC'&&type==='MAGIC')}
function resistancesAt(actor:ActorRuntime,clock:number){
  actor.incomingDebuffs=actor.incomingDebuffs.filter(d=>d.expiresAt>clock+EPS);const armorKeep=actor.incomingDebuffs.reduce((m,d)=>m*(1-clamp01(d.effect.percentArmorReduction??0)),1);const mrKeep=actor.incomingDebuffs.reduce((m,d)=>m*(1-clamp01(d.effect.percentMagicResistReduction??0)),1);return {armor:round(actor.input.resistances.armor*armorKeep),magicResist:round(actor.input.resistances.magicResist*mrKeep)};
}
function upsertDebuff(active:ActiveDebuff[],effect:TargetDebuffEffect,expiresAt:number){const found=active.find(d=>d.effect.label===effect.label);if(found){found.effect=effect;found.expiresAt=expiresAt}else active.push({effect,expiresAt})}
function currentAttackSpeed(model:AutoAttackModel,stacks:number,timed:ReturnType<typeof timedAutoSnapshot>){const extra=model.attackStack?model.attackStack.attackSpeedPerStack*stacks:0;const cap=Number.isFinite(model.attackSpeedCap)&&Number(model.attackSpeedCap)>0?Number(model.attackSpeedCap):3;return Math.min(cap,Math.max(0,(model.attackSpeed+extra+timed.attackSpeedFlat)*timed.attackSpeedMultiplier))}
function outgoingMultiplier(actor:ActorRuntime,clock:number){const duration=Math.max(0,actor.input.outgoingDamageMultiplierDurationSeconds??0);if(duration<=0||clock>=duration-EPS)return 1;return Number.isFinite(actor.input.outgoingDamageMultiplier)?Math.max(0,actor.input.outgoingDamageMultiplier as number):1}
function teamDead(actors:Record<BotLaneKey,ActorRuntime>,team:BotLaneTeam){return ORDER.filter(k=>actors[k].input.team===team).every(k=>actors[k].health<=0)}
function snapshots(actors:Record<BotLaneKey,ActorRuntime>,clock:number){return Object.fromEntries(ORDER.map(k=>[k,snapshot(actors[k],clock)])) as Record<BotLaneKey,BotLaneSnapshot>}
function snapshot(actor:ActorRuntime,clock:number):BotLaneSnapshot{expireShields(actor,clock);return {key:actor.input.key,champion:actor.input.champion,team:actor.input.team,role:actor.input.role,health:round(actor.health),maxHealth:round(actor.input.maxHealth),shield:round(actor.persistentShield+actor.timedShields.reduce((n,s)=>n+s.amount,0)),mana:round(actor.mana),alive:actor.health>0,damageDealt:round(actor.damageDealt),damageTaken:round(actor.damageTaken),healingDone:round(actor.healingDone),shieldingDone:round(actor.shieldingDone),controlledUntil:round(Math.max(clock,actor.controlledUntil))}}
function winnerFrom(p:Record<BotLaneKey,BotLaneSnapshot>):BotLaneTeam|null{const youAlive=p.YOU_ADC.alive||p.YOU_SUPPORT.alive;const themAlive=p.THEM_ADC.alive||p.THEM_SUPPORT.alive;if(youAlive&&!themAlive)return'YOU';if(themAlive&&!youAlive)return'THEM';return null}
function verdictFrom(p:Record<BotLaneKey,BotLaneSnapshot>,winner:BotLaneTeam|null,kills:BotLaneKill[]):BotLaneVerdict{if(winner==='YOU')return'YOU_WIN';if(winner==='THEM')return'THEM_WIN';if(!p.YOU_ADC.alive&&!p.YOU_SUPPORT.alive&&!p.THEM_ADC.alive&&!p.THEM_SUPPORT.alive)return'DOUBLE_KO';const you=teamHealthShare(p,'YOU'),them=teamHealthShare(p,'THEM');if(Math.abs(you-them)<.05)return'EVEN';return you>them?'YOU_AHEAD':'THEM_AHEAD'}
function teamHealthShare(p:Record<BotLaneKey,BotLaneSnapshot>,team:BotLaneTeam){const list=ORDER.map(k=>p[k]).filter(x=>x.team===team);return list.reduce((n,x)=>n+x.health+x.shield,0)/Math.max(1,list.reduce((n,x)=>n+x.maxHealth,0))}
function focusScore(r:BotLaneResult,team:BotLaneTeam){const enemy=team==='YOU'?'THEM':'YOU';const ownDeaths=r.kills.filter(k=>k.team===team).length;const enemyDeaths=r.kills.filter(k=>k.team===enemy).length;const ownShare=teamHealthShare(r.participants,team);const enemyShare=teamHealthShare(r.participants,enemy);return (enemyDeaths-ownDeaths)*100+(ownShare-enemyShare)*50}
function cloneInputs(inputs:Record<BotLaneKey,BotLaneParticipantInput>){return Object.fromEntries(ORDER.map(k=>[k,{...inputs[k],sequence:[...inputs[k].sequence],openingShields:[...(inputs[k].openingShields??[])],abilityOverlays:{...(inputs[k].abilityOverlays??{})},allyUtility:{...(inputs[k].allyUtility??{})}}])) as Record<BotLaneKey,BotLaneParticipantInput>}
const clamp01=(n:number)=>Math.min(1,Math.max(0,Number.isFinite(n)?n:0));const positive=(n:number)=>Number.isFinite(n)&&n>0?n:0;const finite=(n:number|undefined)=>Number.isFinite(n)?n as number:0;const finiteOr=(n:number|undefined,fallback:number)=>Number.isFinite(n)?n as number:fallback;const round=(n:number)=>Math.round(n*100)/100;