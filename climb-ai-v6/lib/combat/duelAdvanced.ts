import {
  mitigateAll,noPenetration,
  type DamageBreakdown,type DamageResult,type DamageType,type Penetration,type TargetResistances,
} from './damage';
import {
  applyDamageRules,attackInterval,hasteMultiplier,resolveOnHit,
  type AbilityModel,type AbilitySlot,type AutoAttackModel,type ComboStep,
} from './combos';
import {
  autoProcTriggers,onHitTriggers,
  type DamageRule,type TargetDebuffEffect,
} from './effects';
import {
  abilityCooldownSeconds,abilityDamageMultiplier,applyAbilityStackAfterCast,
  consumeMark,createCombatRuntime,timedAutoSnapshot,
  type CombatRuntimeState,type InitialTargetMark,
} from './state';
import {
  consumeRechargeableAttack,rechargeableAttackEffects,
  reduceRechargeableAttackCooldownOnAbilityHit,
} from './attackInteractions';
import type {DuelResult,DuelSideKey,DuelStopReason,DuelVerdict} from './duel';

export type DuelShieldScope='ALL'|'PHYSICAL'|'MAGIC';
export type DuelControlKind='STUN'|'KNOCKUP'|'TAUNT'|'FEAR'|'CHARM'|'ROOT'|'SILENCE'|'SLOW';
export type DuelHealTiming='CAST_START'|'AFTER_DAMAGE';

export interface AdvancedDuelControlEffect{
  label:string;
  kind:DuelControlKind;
  /** Visible CC duration. */
  durationSeconds:number;
  /** Time during which the target cannot begin another action. Roots/slows can be 0. */
  actionLockSeconds:number;
  /** Optional one-shot key: once consumed, later abilities with the same key do not re-apply it. */
  consumeKey?:string;
}

export interface AdvancedDuelHealEffect{
  label:string;
  amount:number;
  timing?:DuelHealTiming;
}

export interface AdvancedDuelShieldEffect{
  label:string;
  amount:number;
  durationSeconds:number|null;
  scope:DuelShieldScope;
  timing?:'CAST_START'|'AFTER_DAMAGE';
}

export interface AdvancedDuelAbilityOverlay{
  targetControl?:AdvancedDuelControlEffect;
  selfHeal?:AdvancedDuelHealEffect;
  selfShield?:AdvancedDuelShieldEffect;
}

export interface AdvancedDuelOpeningShield{
  label:string;
  amount:number;
  durationSeconds:number|null;
  scope:DuelShieldScope;
}

export interface DuelSustainEffect{
  label:string;
  /** Share of post-mitigation damage actually applied to the target that heals the actor. */
  healFromDamageRatio:number;
  durationSeconds:number;
}

export interface AdvancedDuelSideInput{
  side:DuelSideKey;
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
  autoActionLockSeconds?:number;
}

interface ActiveDebuff{effect:TargetDebuffEffect;expiresAt:number}
interface TimedShield{
  label:string;
  amount:number;
  expiresAt:number;
  scope:DuelShieldScope;
}

interface ActorRuntime{
  input:AdvancedDuelSideInput;
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
  shieldDamageAbsorbed:number;
  incomplete:boolean;
  consumedControlKeys:Set<string>;
}

interface ActionEvent{
  side:DuelSideKey;
  champion:string;
  step:ComboStep;
  label:string;
  status:'CAST'|'NO_RESOURCE'|'NOT_LEARNED';
  rawDamage:number;
  mitigatedDamage:number;
  damageApplied:number;
  resourceSpent:number;
  healApplied:number;
  shieldGranted:number;
  controlAppliedSeconds:number;
  note?:string;
  incomplete:boolean;
  controlKind?:DuelControlKind;
  shieldScope?:DuelShieldScope;
  sustainHealing?:number;
}

interface PreparedAction{
  actor:ActorRuntime;
  target:ActorRuntime;
  event:ActionEvent;
  breakdown?:DamageBreakdown;
  targetDebuff?:TargetDebuffEffect;
  targetControl?:AdvancedDuelControlEffect;
  overlay?:AdvancedDuelAbilityOverlay;
}

const EPS=1e-9;
const MAX_FRAMES=256;
const DEFAULT_MAX_SECONDS=15;

export const ADVANCED_DUEL_MODEL_NOTE=
  'Both champions resolve on one event clock. Hard crowd control delays future actions, '+
  'typed shields absorb only eligible post-mitigation damage, rechargeable attack passives use the same event clock, '+
  'and on-damage sustain heals after the simultaneous damage frame. Actions already begun at a timestamp still resolve '+
  'together. Movement, projectile travel, dodge chance and unvalidated cast interruption are not inferred.';

export function simulateAdvancedDuel(
  you:AdvancedDuelSideInput,
  them:AdvancedDuelSideInput,
  maxDurationSeconds=DEFAULT_MAX_SECONDS,
):DuelResult{
  const a=createActor(you);
  const b=createActor(them);
  const timeline:any[]=[];
  const blocked:{side:DuelSideKey;step:ComboStep;reason:string}[]=[];
  const assumptions=[
    ADVANCED_DUEL_MODEL_NOTE,
    'Same-timestamp damage is resolved before on-damage sustain. This prevents array order deciding a simultaneous frame; sustain can preserve a champion only when its own action also successfully dealt damage in that frame.',
    'When several eligible shields overlap, the one expiring first is consumed first; persistent manual shields are consumed after timed shields.',
  ];

  let clock=0;
  let stopReason:DuelStopReason='NO_ACTIONS';

  for(let frame=0;frame<MAX_FRAMES;frame++){
    if(a.health<=0||b.health<=0){stopReason='LETHAL';break}

    const aAt=nextActionAt(a);
    const bAt=nextActionAt(b);
    const next=Math.min(aAt,bAt);
    if(!Number.isFinite(next)){
      stopReason=(sequenceComplete(a)&&sequenceComplete(b))?'SEQUENCES_COMPLETE':'NO_ACTIONS';
      break;
    }
    if(next>maxDurationSeconds+EPS){clock=maxDurationSeconds;stopReason='TIME_LIMIT';break}

    clock=Math.max(clock,next);
    expireShields(a,clock);expireShields(b,clock);

    const actors:ActorRuntime[]=[];
    if(Math.abs(aAt-clock)<=EPS)actors.push(a);
    if(Math.abs(bAt-clock)<=EPS)actors.push(b);

    // Cast-start state is granted to both actors before either side's damage is prepared.
    const prepped=actors.map(actor=>preflight(actor,actor===a?b:a,clock,blocked));
    const actions=prepped.map(pre=>prepareDamage(pre,clock));

    // Resolve all same-frame incoming damage component-by-component so magic-only
    // and physical-only shields behave correctly on mixed-damage hits.
    for(const action of actions){
      if(action.event.status!=='CAST'||!action.breakdown)continue;
      const applied=applyIncomingBreakdown(action.target,action.breakdown,clock);
      action.event.damageApplied=round(applied.healthDamage+applied.shieldDamage);
      action.actor.damageDealt+=action.event.damageApplied;
      action.target.damageTaken+=action.event.damageApplied;
      action.target.shieldDamageAbsorbed+=applied.shieldDamage;
    }

    // Post-damage healing is calculated for every action, then committed. That
    // gives same-frame sustain deterministic semantics without actor-array bias.
    const pendingHeals=new Map<ActorRuntime,number>();
    for(const action of actions){
      if(action.event.status!=='CAST')continue;
      let heal=0;
      for(const sustain of action.actor.input.sustainEffects??[]){
        if(clock>=Math.max(0,sustain.durationSeconds)-EPS)continue;
        heal+=Math.max(0,action.event.damageApplied)*Math.max(0,sustain.healFromDamageRatio);
      }
      const overlayHeal=action.overlay?.selfHeal;
      if(overlayHeal&&(overlayHeal.timing??'CAST_START')==='AFTER_DAMAGE')
        heal+=positive(overlayHeal.amount);
      if(heal>0){
        pendingHeals.set(action.actor,(pendingHeals.get(action.actor)??0)+heal);
        action.event.sustainHealing=round(heal);
      }
    }
    for(const [actor,amount] of pendingHeals){
      const before=actor.health;
      actor.health=Math.min(actor.input.maxHealth,Math.max(0,actor.health)+amount);
      const healed=Math.max(0,actor.health-before);
      actor.healingDone+=healed;
      const action=actions.find(x=>x.actor===actor&&x.event.status==='CAST');
      if(action)action.event.healApplied=round(action.event.healApplied+healed);
    }

    // After-damage shields, debuffs and CC become available to later timestamps.
    for(const action of actions){
      if(action.event.status!=='CAST')continue;
      const afterShield=action.overlay?.selfShield;
      if(afterShield&&(afterShield.timing??'CAST_START')==='AFTER_DAMAGE'){
        const granted=grantTimedShield(action.actor,afterShield,clock);
        action.event.shieldGranted=round(action.event.shieldGranted+granted);
        action.event.shieldScope=afterShield.scope;
      }
      if(action.targetDebuff)
        upsertDebuff(action.target.incomingDebuffs,action.targetDebuff,clock+action.targetDebuff.durationSeconds);

      const control=action.targetControl;
      if(control&&action.target.health>0&&canApplyControl(action.actor,control)){
        const visible=Math.max(0,finite(control.durationSeconds));
        const lock=Math.max(0,finite(control.actionLockSeconds));
        if(lock>0)action.target.controlledUntil=Math.max(action.target.controlledUntil,clock+lock);
        if(control.consumeKey)action.actor.consumedControlKeys.add(control.consumeKey);
        action.event.controlAppliedSeconds=round(visible);
        action.event.controlKind=control.kind;
        action.event.note=joinNotes(action.event.note,`${control.label}: ${round(visible)}s ${control.kind.toLowerCase()}${lock!==visible?` · ${round(lock)}s action lock`:''}.`);
      }
    }

    timeline.push({
      atSeconds:round(clock),
      actions:actions.map(x=>x.event),
      you:snapshot(a,clock),
      them:snapshot(b,clock),
    });

    if(a.health<=0||b.health<=0){stopReason='LETHAL';break}
    if(sequenceComplete(a)&&sequenceComplete(b)){stopReason='SEQUENCES_COMPLETE';break}
    stopReason='TIME_LIMIT';
  }

  const finalClock=round(clock);
  const {verdict,winner}=verdictFrom(a,b,finalClock);
  return {
    verdict,winner,stopReason,durationSeconds:finalClock,timeline,
    you:snapshot(a,finalClock),them:snapshot(b,finalClock),
    incomplete:a.incomplete||b.incomplete,blocked,assumptions,
    modelNote:ADVANCED_DUEL_MODEL_NOTE,
  } as DuelResult;
}

function preflight(
  actor:ActorRuntime,
  target:ActorRuntime,
  clock:number,
  blocked:{side:DuelSideKey;step:ComboStep;reason:string}[],
):PreparedAction{
  const step=actor.input.sequence[actor.actionIndex];
  const event:ActionEvent={
    side:actor.input.side,champion:actor.input.champion,step,
    label:step==='AA'?'Basic attack':step,status:'CAST',rawDamage:0,
    mitigatedDamage:0,damageApplied:0,resourceSpent:0,healApplied:0,
    shieldGranted:0,controlAppliedSeconds:0,incomplete:false,
  };

  if(step==='AA'){
    const timed=timedAutoSnapshot(actor.input.autoAttack.timedStates,clock);
    const cost=timed.resourceCostOverride??positive(actor.input.autoAttack.resourceCost??0);
    if(cost>actor.mana+EPS){
      const reason=`Basic attack costs ${round(cost)} resource; only ${round(actor.mana)} remains.`;
      blocked.push({side:actor.input.side,step,reason});actor.actionIndex++;
      return {actor,target,event:{...event,status:'NO_RESOURCE',note:reason}};
    }
    actor.mana-=cost;event.resourceSpent=round(cost);
    return {actor,target,event};
  }

  const ability=actor.input.abilities[step];
  if(!ability){
    const reason=`${step} is not learned or not available in this setup.`;
    blocked.push({side:actor.input.side,step,reason});actor.actionIndex++;
    return {actor,target,event:{...event,status:'NOT_LEARNED',note:reason}};
  }

  event.label=ability.name;
  const cost=positive(ability.cost);
  if(cost>actor.mana+EPS){
    const reason=`${ability.name} costs ${round(cost)} resource; only ${round(actor.mana)} remains.`;
    blocked.push({side:actor.input.side,step,reason});actor.actionIndex++;
    return {actor,target,event:{...event,status:'NO_RESOURCE',note:reason}};
  }
  actor.mana-=cost;event.resourceSpent=round(cost);

  const overlay=actor.input.abilityOverlays?.[step];
  const shield=overlay?.selfShield;
  if(shield&&(shield.timing??'CAST_START')==='CAST_START'){
    event.shieldGranted=round(grantTimedShield(actor,shield,clock));
    event.shieldScope=shield.scope;
  }

  const heal=overlay?.selfHeal;
  if(heal&&(heal.timing??'CAST_START')==='CAST_START'){
    const before=actor.health;
    actor.health=Math.min(actor.input.maxHealth,actor.health+positive(heal.amount));
    const applied=Math.max(0,actor.health-before);
    actor.healingDone+=applied;event.healApplied=round(applied);
  }

  return {
    actor,target,event,overlay,
    targetDebuff:ability.targetDebuff,
    targetControl:overlay?.targetControl,
  };
}

function prepareDamage(pre:PreparedAction,clock:number):PreparedAction{
  const {actor,target,event}=pre;
  if(event.status!=='CAST')return pre;

  if(event.step==='AA'){
    const model=actor.input.autoAttack;
    const timed=timedAutoSnapshot(model.timedStates,clock);
    const nextAuto=actor.autoCount+1;
    const replacementEffects=rechargeableAttackEffects(model,actor.combat,clock);
    const components:any[]=replacementEffects?.length
      ?replacementEffects.map(effect=>resolveOnHit(effect,target.health,target.input.maxHealth))
      :[{
        label:'Auto attack',type:'PHYSICAL',raw:positive(model.damage)*timed.basicAttackDamageMultiplier,
      }];
    for(const effect of [...(model.onHits??[]),...timed.onHits])
      if(onHitTriggers(effect,nextAuto))components.push(resolveOnHit(effect,target.health,target.input.maxHealth));
    for(const consumer of model.eventState?.consumesMarks??[])
      if(consumeMark(actor.combat,consumer,clock))components.push(resolveOnHit(consumer.damage,target.health,target.input.maxHealth));
    for(const proc of model.autoProcs??[])
      if(autoProcTriggers(proc,nextAuto))components.push(resolveOnHit(proc.damage,target.health,target.input.maxHealth));
    const attackStack=model.attackStack;
    if(attackStack?.onHitAtMax&&actor.attackStacks>=attackStack.maxStacks)
      components.push(resolveOnHit(attackStack.onHitAtMax,target.health,target.input.maxHealth));

    const adjusted=applyDamageRules(
      components,actor.input.damageRules??[],target.health,target.input.maxHealth,
      actor.autoCount,outgoingMultiplier(actor,clock),
    );
    const result=mitigateAll(adjusted,resistancesAt(target,clock),actor.input.penetration??noPenetration());
    pre.breakdown=result;

    const passiveProc=replacementEffects?.length
      ?consumeRechargeableAttack(model,actor.combat,clock)
      :null;
    if(passiveProc){
      event.label=passiveProc.label;
      event.note=joinNotes(event.note,`${passiveProc.label} consumed; passive ready at ${passiveProc.readyAt}s before later refunds.`);
    }
    actor.autoCount=nextAuto;
    if(attackStack)actor.attackStacks=Math.min(attackStack.maxStacks,actor.attackStacks+1);
    const interval=attackInterval(currentAttackSpeed(model,actor.attackStacks,timed));
    actor.autoReadyAt=clock+interval;
    actor.nextFreeAt=clock+(Number.isFinite(actor.input.autoActionLockSeconds)
      ?Math.max(0,actor.input.autoActionLockSeconds as number):interval);
    actor.actionIndex++;
    finishDamageEvent(actor,event,result);
    return pre;
  }

  const ability=actor.input.abilities[event.step];
  if(!ability)return pre;
  const components:any[]=[
    ...ability.damage,
    ...(ability.dynamicDamage??[]).map(effect=>resolveOnHit(effect,target.health,target.input.maxHealth)),
  ];
  for(const consumer of ability.eventState?.consumesMarks??[])
    if(consumeMark(actor.combat,consumer,clock))components.push(resolveOnHit(consumer.damage,target.health,target.input.maxHealth));

  const stackRule=ability.eventState?.stackRule;
  const multiplier=abilityDamageMultiplier(actor.combat,stackRule,clock);
  const stateAdjusted=multiplier===1?components:components.map(component=>component.raw===null
    ?component:{...component,raw:round(component.raw*multiplier)});
  const adjusted=applyDamageRules(
    stateAdjusted,actor.input.damageRules??[],target.health,target.input.maxHealth,
    actor.autoCount,outgoingMultiplier(actor,clock),
  );
  const result=mitigateAll(adjusted,resistancesAt(target,clock),actor.input.penetration??noPenetration());
  pre.breakdown=result;

  const passiveRefund=reduceRechargeableAttackCooldownOnAbilityHit(
    actor.input.autoAttack,actor.combat,ability,clock,
  );
  if(passiveRefund)
    event.note=joinNotes(event.note,`${passiveRefund.label}: ability hit refunded ${passiveRefund.reduction}s; passive ready at ${passiveRefund.after}s.`);
  const cooldownBase=abilityCooldownSeconds(ability.cooldownSeconds,actor.combat,stackRule,clock);
  applyAbilityStackAfterCast(actor.combat,stackRule,clock);
  actor.abilityReadyAt.set(event.step,clock+cooldownBase*hasteMultiplier(actor.input.abilityHaste??0));
  const castTime=Math.max(0,positive(ability.castTimeSeconds));
  actor.nextFreeAt=clock+castTime;
  if(ability.eventState?.resetsBasicAttackTimer&&Number.isFinite(actor.input.autoActionLockSeconds))
    actor.autoReadyAt=Math.min(actor.autoReadyAt,clock+castTime);
  actor.actionIndex++;
  finishDamageEvent(actor,event,result);
  return pre;
}

function finishDamageEvent(actor:ActorRuntime,event:ActionEvent,result:DamageBreakdown){
  event.rawDamage=result.rawTotal;event.mitigatedDamage=result.mitigatedTotal;
  event.incomplete=!result.complete;actor.incomplete||=!result.complete;
  if(!result.complete)event.note=joinNotes(event.note,'One or more damage components are unresolved; this event is a lower bound.');
}

function createActor(input:AdvancedDuelSideInput):ActorRuntime{
  const maxHealth=Math.max(1,positive(input.maxHealth));
  const current=Math.min(maxHealth,Math.max(0,finiteOr(input.currentHealth,maxHealth)));
  const stackRules=Object.values(input.abilities)
    .map(a=>a?.eventState?.stackRule)
    .filter((x):x is NonNullable<typeof x>=>Boolean(x));
  const timedShields:TimedShield[]=[];
  for(const shield of input.openingShields??[]){
    const amount=positive(shield.amount);if(amount<=0)continue;
    timedShields.push({
      label:shield.label,amount,scope:shield.scope,
      expiresAt:shield.durationSeconds===null?Number.POSITIVE_INFINITY:Math.max(0,shield.durationSeconds),
    });
  }
  return {
    input:{...input,maxHealth},health:current,persistentShield:positive(input.shield??0),
    timedShields,mana:positive(input.mana),autoCount:0,attackStacks:0,
    combat:createCombatRuntime(stackRules,input.initialTargetMarks??[]),
    incomingDebuffs:[],abilityReadyAt:new Map(),autoReadyAt:0,nextFreeAt:0,
    controlledUntil:0,actionIndex:0,damageDealt:0,damageTaken:0,healingDone:0,
    shieldDamageAbsorbed:0,incomplete:false,consumedControlKeys:new Set(),
  };
}

function nextActionAt(actor:ActorRuntime):number{
  if(actor.health<=0||sequenceComplete(actor))return Number.POSITIVE_INFINITY;
  const step=actor.input.sequence[actor.actionIndex];
  let ready=Math.max(actor.nextFreeAt,actor.controlledUntil);
  if(step==='AA')return Math.max(ready,actor.autoReadyAt);
  if(actor.input.abilities[step])ready=Math.max(ready,actor.abilityReadyAt.get(step)??0);
  return ready;
}

const sequenceComplete=(actor:ActorRuntime)=>actor.actionIndex>=actor.input.sequence.length;

function grantTimedShield(actor:ActorRuntime,shield:AdvancedDuelShieldEffect,clock:number):number{
  const amount=positive(shield.amount);if(amount<=0)return 0;
  actor.timedShields.push({
    label:shield.label,amount,scope:shield.scope,
    expiresAt:shield.durationSeconds===null?Number.POSITIVE_INFINITY:clock+Math.max(0,shield.durationSeconds),
  });
  return amount;
}

function expireShields(actor:ActorRuntime,clock:number){
  actor.timedShields=actor.timedShields.filter(s=>s.amount>EPS&&s.expiresAt>clock+EPS);
}

function shieldTotal(actor:ActorRuntime,clock:number):number{
  expireShields(actor,clock);
  return round(actor.persistentShield+actor.timedShields.reduce((n,s)=>n+s.amount,0));
}

function applyIncomingBreakdown(actor:ActorRuntime,result:DamageBreakdown,clock:number){
  expireShields(actor,clock);
  let shieldDamage=0,healthDamage=0;
  for(const component of result.components){
    let remaining=Math.max(0,component.mitigated);
    actor.timedShields.sort((x,y)=>x.expiresAt-y.expiresAt);
    for(const shield of actor.timedShields){
      if(remaining<=EPS)break;
      if(!shieldAccepts(shield.scope,component.type))continue;
      const used=Math.min(shield.amount,remaining);
      shield.amount-=used;remaining-=used;shieldDamage+=used;
    }
    expireShields(actor,clock);
    if(remaining>EPS&&actor.persistentShield>0){
      const used=Math.min(actor.persistentShield,remaining);
      actor.persistentShield-=used;remaining-=used;shieldDamage+=used;
    }
    const hp=Math.min(actor.health,remaining);
    actor.health=Math.max(0,actor.health-hp);healthDamage+=hp;
  }
  return {shieldDamage:round(shieldDamage),healthDamage:round(healthDamage)};
}

function shieldAccepts(scope:DuelShieldScope,type:DamageType){
  return scope==='ALL'||scope===type;
}

function resistancesAt(actor:ActorRuntime,clock:number):TargetResistances{
  actor.incomingDebuffs=actor.incomingDebuffs.filter(d=>d.expiresAt>clock+EPS);
  const armorKeep=actor.incomingDebuffs.reduce((m,d)=>m*(1-clamp01(d.effect.percentArmorReduction??0)),1);
  const mrKeep=actor.incomingDebuffs.reduce((m,d)=>m*(1-clamp01(d.effect.percentMagicResistReduction??0)),1);
  return {armor:round(actor.input.resistances.armor*armorKeep),magicResist:round(actor.input.resistances.magicResist*mrKeep)};
}

function upsertDebuff(active:ActiveDebuff[],effect:TargetDebuffEffect,expiresAt:number){
  const existing=active.find(d=>d.effect.label===effect.label);
  if(existing){existing.effect=effect;existing.expiresAt=expiresAt;return}
  active.push({effect,expiresAt});
}

function currentAttackSpeed(model:AutoAttackModel,stacks:number,timed:ReturnType<typeof timedAutoSnapshot>){
  const extra=model.attackStack?model.attackStack.attackSpeedPerStack*stacks:0;
  const cap=Number.isFinite(model.attackSpeedCap)&&Number(model.attackSpeedCap)>0?Number(model.attackSpeedCap):3;
  return Math.min(cap,Math.max(0,(model.attackSpeed+extra+timed.attackSpeedFlat)*timed.attackSpeedMultiplier));
}

function outgoingMultiplier(actor:ActorRuntime,clock:number):number{
  const duration=Math.max(0,actor.input.outgoingDamageMultiplierDurationSeconds??0);
  if(duration<=0||clock>=duration-EPS)return 1;
  const value=actor.input.outgoingDamageMultiplier??1;
  return Number.isFinite(value)?Math.max(0,value):1;
}

function canApplyControl(actor:ActorRuntime,control:AdvancedDuelControlEffect){
  return !control.consumeKey||!actor.consumedControlKeys.has(control.consumeKey);
}

function snapshot(actor:ActorRuntime,clock:number){
  const max=Math.max(1,actor.input.maxHealth);
  return {
    champion:actor.input.champion,health:round(actor.health),maxHealth:round(max),
    healthPercent:round(actor.health/max*100),shield:shieldTotal(actor,clock),mana:round(actor.mana),
    controlledUntil:round(Math.max(clock,actor.controlledUntil)),actionIndex:actor.actionIndex,
    damageDealt:round(actor.damageDealt),damageTaken:round(actor.damageTaken),
    healingDone:round(actor.healingDone),shieldDamageAbsorbed:round(actor.shieldDamageAbsorbed),
  };
}

function verdictFrom(a:ActorRuntime,b:ActorRuntime,clock:number):{verdict:DuelVerdict;winner:DuelSideKey|null}{
  if(a.health<=0&&b.health<=0)return {verdict:'DOUBLE_KO',winner:null};
  if(b.health<=0)return {verdict:'YOU_KILL',winner:'YOU'};
  if(a.health<=0)return {verdict:'THEM_KILL',winner:'THEM'};
  const aShare=(a.health+shieldTotal(a,clock))/Math.max(1,a.input.maxHealth);
  const bShare=(b.health+shieldTotal(b,clock))/Math.max(1,b.input.maxHealth);
  const delta=(aShare-bShare)*100;
  if(Math.abs(delta)<4)return {verdict:'EVEN',winner:null};
  return delta>0?{verdict:'YOU_AHEAD',winner:'YOU'}:{verdict:'THEM_AHEAD',winner:'THEM'};
}

const joinNotes=(a:string|undefined,b:string)=>a?`${a} ${b}`:b;
const clamp01=(n:number)=>Math.min(1,Math.max(0,Number.isFinite(n)?n:0));
const positive=(n:number)=>Number.isFinite(n)&&n>0?n:0;
const finite=(n:number|undefined)=>Number.isFinite(n)?n as number:0;
const finiteOr=(n:number|undefined,fallback:number)=>Number.isFinite(n)?n as number:fallback;
const round=(n:number)=>Math.round(n*100)/100;