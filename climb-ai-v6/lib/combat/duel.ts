import {
  mitigateAll,noPenetration,
  type DamageComponent,type Penetration,type TargetResistances,
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
  type CombatRuntimeState,type InitialTargetMark,type ShieldGrant,
} from './state';

export type DuelSideKey='YOU'|'THEM';
export type DuelVerdict='YOU_KILL'|'THEM_KILL'|'DOUBLE_KO'|'YOU_AHEAD'|'THEM_AHEAD'|'EVEN';
export type DuelStopReason='LETHAL'|'SEQUENCES_COMPLETE'|'TIME_LIMIT'|'NO_ACTIONS';

export interface DuelControlEffect{
  label:string;
  durationSeconds:number;
}

export interface DuelHealEffect{
  label:string;
  amount:number;
}

export interface DuelAbilityOverlay{
  /** Generic hook for champion-specific CC once a duration has been validated. */
  targetControl?:DuelControlEffect;
  /** Generic hook for deterministic self-heals created by a successful cast. */
  selfHeal?:DuelHealEffect;
}

export interface DuelOpeningShield{
  label:string;
  amount:number;
  /** null means it persists for this simulation. */
  durationSeconds:number|null;
}

export interface DuelSideInput{
  side:DuelSideKey;
  champion:string;
  sequence:ComboStep[];
  abilities:Partial<Record<AbilitySlot,AbilityModel>>;
  autoAttack:AutoAttackModel;
  mana:number;
  maxHealth:number;
  currentHealth?:number;
  /** Manual/persistent opening shield. */
  shield?:number;
  /** Barrier or other known-duration opening shields. */
  openingShields?:DuelOpeningShield[];
  resistances:TargetResistances;
  penetration?:Penetration;
  abilityHaste?:number;
  damageRules?:DamageRule[];
  initialTargetMarks?:InitialTargetMark[];
  outgoingDamageMultiplier?:number;
  outgoingDamageMultiplierDurationSeconds?:number;
  abilityOverlays?:Partial<Record<AbilitySlot,DuelAbilityOverlay>>;
  /**
   * Optional measured wind-up/action lock. Without one the conservative full
   * attack interval is used, so attack resets are never given invented speed.
   */
  autoActionLockSeconds?:number;
}

export interface DuelSideSnapshot{
  champion:string;
  health:number;
  maxHealth:number;
  healthPercent:number;
  shield:number;
  mana:number;
  controlledUntil:number;
  actionIndex:number;
  damageDealt:number;
  damageTaken:number;
  healingDone:number;
  shieldDamageAbsorbed:number;
}

export interface DuelActionEvent{
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
}

export interface DuelFrame{
  atSeconds:number;
  actions:DuelActionEvent[];
  you:DuelSideSnapshot;
  them:DuelSideSnapshot;
}

export interface DuelResult{
  verdict:DuelVerdict;
  winner:DuelSideKey|null;
  stopReason:DuelStopReason;
  durationSeconds:number;
  timeline:DuelFrame[];
  you:DuelSideSnapshot;
  them:DuelSideSnapshot;
  incomplete:boolean;
  blocked:{side:DuelSideKey;step:ComboStep;reason:string}[];
  assumptions:string[];
  modelNote:string;
}

interface ActiveDebuff{effect:TargetDebuffEffect;expiresAt:number}
interface TimedShield{label:string;amount:number;expiresAt:number}

interface ActorRuntime{
  input:DuelSideInput;
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
}

interface PreparedAction{
  actor:ActorRuntime;
  target:ActorRuntime;
  event:DuelActionEvent;
  targetDebuff?:TargetDebuffEffect;
  targetControl?:DuelControlEffect;
}

const EPS=1e-9;
const MAX_FRAMES=256;
const DEFAULT_MAX_SECONDS=15;

export const DUEL_MODEL_NOTE=
  'Both champions share one event clock. Actions that begin at the same timestamp resolve together, '+
  'so a champion killed in that frame still completes an action that already began. Cast-generated '+
  'self-shields are available before same-frame incoming damage. Movement, projectile travel, dodge '+
  'chance, interruption during cast time and shield-type priority are not inferred unless explicitly modelled.';

export function simulateDuel(
  you:DuelSideInput,
  them:DuelSideInput,
  maxDurationSeconds=DEFAULT_MAX_SECONDS,
):DuelResult{
  const a=createActor(you);
  const b=createActor(them);
  const timeline:DuelFrame[]=[];
  const blocked:{side:DuelSideKey;step:ComboStep;reason:string}[]=[];
  const assumptions=[
    DUEL_MODEL_NOTE,
    'When timed and persistent shields overlap, timed shields are consumed first. This keeps expiry visible but is still a shield-ordering assumption.',
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
    if(next>maxDurationSeconds+EPS){
      clock=maxDurationSeconds;
      stopReason='TIME_LIMIT';
      break;
    }

    clock=Math.max(clock,next);
    expireShields(a,clock);expireShields(b,clock);

    const actors:ActorRuntime[]=[];
    if(Math.abs(aAt-clock)<=EPS)actors.push(a);
    if(Math.abs(bAt-clock)<=EPS)actors.push(b);

    // Phase 1: validate actions and grant cast-start defensive effects to every
    // actor that acts at this timestamp. This prevents array order deciding who
    // survives a simultaneous frame.
    const prepped=actors.map(actor=>preflight(actor,actor===a?b:a,clock,blocked));

    // Phase 2: calculate outgoing damage from the same pre-damage health state.
    const actions=prepped.map(pre=>prepareDamage(pre,clock));

    // Phase 3: incoming damage lands. Every action prepared for this timestamp
    // still lands even if the actor is also reduced to zero in the frame.
    for(const action of actions){
      if(action.event.status!=='CAST')continue;
      const applied=applyIncoming(action.target,action.event.mitigatedDamage,clock);
      action.event.damageApplied=applied.healthDamage+applied.shieldDamage;
      action.actor.damageDealt+=action.event.damageApplied;
      action.target.damageTaken+=action.event.damageApplied;
      action.target.shieldDamageAbsorbed+=applied.shieldDamage;
    }

    // Phase 4: successful-hit state becomes available to later timestamps.
    for(const action of actions){
      if(action.event.status!=='CAST')continue;
      if(action.targetDebuff)
        upsertDebuff(action.target.incomingDebuffs,action.targetDebuff,clock+action.targetDebuff.durationSeconds);
      if(action.targetControl&&action.target.health>0){
        const duration=Math.max(0,finite(action.targetControl.durationSeconds));
        action.target.controlledUntil=Math.max(action.target.controlledUntil,clock+duration);
      }
    }

    timeline.push({
      atSeconds:round(clock),
      actions:actions.map(x=>x.event),
      you:snapshot(a,clock),
      them:snapshot(b,clock),
    });

    if(a.health<=0||b.health<=0){stopReason='LETHAL';break}
    if(sequenceComplete(a)&&sequenceComplete(b)){
      stopReason='SEQUENCES_COMPLETE';
      break;
    }
    stopReason='TIME_LIMIT';
  }

  const finalClock=round(clock);
  const yourFinal=snapshot(a,finalClock);
  const theirFinal=snapshot(b,finalClock);
  const {verdict,winner}=verdictFrom(a,b,finalClock);

  return {
    verdict,winner,stopReason,durationSeconds:finalClock,timeline,
    you:yourFinal,them:theirFinal,
    incomplete:a.incomplete||b.incomplete,
    blocked,assumptions,modelNote:DUEL_MODEL_NOTE,
  };
}

/**
 * Preflight mutates only the acting champion's own cast-start state. No outgoing
 * damage is calculated here, so both sides receive their simultaneous shields/
 * heals before either side's damage is resolved.
 */
function preflight(
  actor:ActorRuntime,
  target:ActorRuntime,
  clock:number,
  blocked:{side:DuelSideKey;step:ComboStep;reason:string}[],
):PreparedAction{
  const step=actor.input.sequence[actor.actionIndex];
  const baseEvent:DuelActionEvent={
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
      blocked.push({side:actor.input.side,step,reason});
      actor.actionIndex++;
      return {actor,target,event:{...baseEvent,status:'NO_RESOURCE',label:'Basic attack',note:reason}};
    }
    actor.mana-=cost;
    baseEvent.resourceSpent=round(cost);
    return {actor,target,event:baseEvent};
  }

  const ability=actor.input.abilities[step];
  if(!ability){
    const reason=`${step} is not learned or not available in this setup.`;
    blocked.push({side:actor.input.side,step,reason});
    actor.actionIndex++;
    return {actor,target,event:{...baseEvent,status:'NOT_LEARNED',note:reason}};
  }

  baseEvent.label=ability.name;
  const cost=positive(ability.cost);
  if(cost>actor.mana+EPS){
    const reason=`${ability.name} costs ${round(cost)} resource; only ${round(actor.mana)} remains.`;
    blocked.push({side:actor.input.side,step,reason});
    actor.actionIndex++;
    return {actor,target,event:{...baseEvent,status:'NO_RESOURCE',note:reason}};
  }
  actor.mana-=cost;
  baseEvent.resourceSpent=round(cost);

  const shield=ability.eventState?.grantsSelfShield;
  if(shield){
    const granted=grantTimedShield(actor,shield,clock);
    baseEvent.shieldGranted=round(granted);
  }

  const overlay=actor.input.abilityOverlays?.[step];
  if(overlay?.selfHeal){
    const before=actor.health;
    actor.health=Math.min(actor.input.maxHealth,actor.health+positive(overlay.selfHeal.amount));
    const healed=Math.max(0,actor.health-before);
    actor.healingDone+=healed;
    baseEvent.healApplied=round(healed);
  }

  return {
    actor,target,event:baseEvent,
    targetDebuff:ability.targetDebuff,
    targetControl:overlay?.targetControl,
  };
}

function prepareDamage(pre:PreparedAction,clock:number):PreparedAction{
  const {actor,target,event}=pre;
  if(event.status!=='CAST')return pre;

  const step=event.step;
  if(step==='AA'){
    const model=actor.input.autoAttack;
    const timed=timedAutoSnapshot(model.timedStates,clock);
    const nextAuto=actor.autoCount+1;
    const components:DamageComponent[]=[{
      label:'Auto attack',type:'PHYSICAL',
      raw:positive(model.damage)*timed.basicAttackDamageMultiplier,
    }];

    for(const effect of [...(model.onHits??[]),...timed.onHits]){
      if(!onHitTriggers(effect,nextAuto))continue;
      components.push(resolveOnHit(effect,target.health,target.input.maxHealth));
    }
    for(const consumer of model.eventState?.consumesMarks??[])
      if(consumeMark(actor.combat,consumer,clock))
        components.push(resolveOnHit(consumer.damage,target.health,target.input.maxHealth));
    for(const proc of model.autoProcs??[])
      if(autoProcTriggers(proc,nextAuto))
        components.push(resolveOnHit(proc.damage,target.health,target.input.maxHealth));

    const attackStack=model.attackStack;
    if(attackStack?.onHitAtMax&&actor.attackStacks>=attackStack.maxStacks)
      components.push(resolveOnHit(attackStack.onHitAtMax,target.health,target.input.maxHealth));

    const adjusted=applyDamageRules(
      components,actor.input.damageRules??[],target.health,target.input.maxHealth,
      actor.autoCount,outgoingMultiplier(actor,clock),
    );
    const result=mitigateAll(
      adjusted,resistancesAt(target,clock),actor.input.penetration??noPenetration(),
    );

    actor.autoCount=nextAuto;
    if(attackStack)
      actor.attackStacks=Math.min(attackStack.maxStacks,actor.attackStacks+1);

    const speed=currentAttackSpeed(model,actor.attackStacks,timed);
    const interval=attackInterval(speed);
    actor.autoReadyAt=clock+interval;
    const lock=Number.isFinite(actor.input.autoActionLockSeconds)
      ?Math.max(0,actor.input.autoActionLockSeconds as number)
      :interval;
    actor.nextFreeAt=clock+lock;
    actor.actionIndex++;

    event.rawDamage=result.rawTotal;
    event.mitigatedDamage=result.mitigatedTotal;
    event.incomplete=!result.complete;
    actor.incomplete||=!result.complete;
    if(!result.complete)
      event.note='One or more damage components are unresolved; this event is a lower bound.';
    return pre;
  }

  const ability=actor.input.abilities[step];
  if(!ability)return pre;

  const components:DamageComponent[]=[
    ...ability.damage,
    ...(ability.dynamicDamage??[]).map(effect=>resolveOnHit(effect,target.health,target.input.maxHealth)),
  ];
  for(const consumer of ability.eventState?.consumesMarks??[])
    if(consumeMark(actor.combat,consumer,clock))
      components.push(resolveOnHit(consumer.damage,target.health,target.input.maxHealth));

  const stackRule=ability.eventState?.stackRule;
  const multiplier=abilityDamageMultiplier(actor.combat,stackRule,clock);
  const stateAdjusted=multiplier===1
    ?components
    :components.map(component=>component.raw===null
      ?component
      :{...component,raw:round(component.raw*multiplier)});
  const adjusted=applyDamageRules(
    stateAdjusted,actor.input.damageRules??[],target.health,target.input.maxHealth,
    actor.autoCount,outgoingMultiplier(actor,clock),
  );
  const result=mitigateAll(
    adjusted,resistancesAt(target,clock),actor.input.penetration??noPenetration(),
  );

  // Cooldown uses the pre-cast stack state; the successful cast then advances
  // the stack state for the next use.
  const cooldownBase=abilityCooldownSeconds(ability.cooldownSeconds,actor.combat,stackRule,clock);
  applyAbilityStackAfterCast(actor.combat,stackRule,clock);
  actor.abilityReadyAt.set(step,clock+cooldownBase*hasteMultiplier(actor.input.abilityHaste??0));

  const castTime=Math.max(0,positive(ability.castTimeSeconds));
  actor.nextFreeAt=clock+castTime;
  if(ability.eventState?.resetsBasicAttackTimer)
    actor.autoReadyAt=Math.min(actor.autoReadyAt,clock+castTime);
  actor.actionIndex++;

  event.rawDamage=result.rawTotal;
  event.mitigatedDamage=result.mitigatedTotal;
  event.controlAppliedSeconds=round(pre.targetControl?.durationSeconds??0);
  event.incomplete=!result.complete;
  actor.incomplete||=!result.complete;

  const notes:string[]=[];
  if(ability.eventState?.resetsBasicAttackTimer){
    if(Number.isFinite(actor.input.autoActionLockSeconds))
      notes.push('Basic-attack timer reset applied to the shared scheduler.');
    else
      notes.push('Attack reset recorded, but no validated wind-up/action-lock value was supplied, so no invented reset speed was added.');
  }
  if(!result.complete)notes.push('One or more damage components are unresolved; this event is a lower bound.');
  if(pre.targetControl)notes.push(`${pre.targetControl.label}: target action lock ${round(pre.targetControl.durationSeconds)}s.`);
  if(notes.length)event.note=notes.join(' ');

  return pre;
}

function createActor(input:DuelSideInput):ActorRuntime{
  const maxHealth=Math.max(1,positive(input.maxHealth));
  const current=Math.min(maxHealth,Math.max(0,finiteOr(input.currentHealth,maxHealth)));
  const stackRules=Object.values(input.abilities)
    .map(a=>a?.eventState?.stackRule)
    .filter((x):x is NonNullable<typeof x>=>Boolean(x));
  const timedShields:TimedShield[]=[];
  for(const shield of input.openingShields??[]){
    const amount=positive(shield.amount);
    if(amount<=0)continue;
    const expiresAt=shield.durationSeconds===null
      ?Number.POSITIVE_INFINITY
      :Math.max(0,shield.durationSeconds);
    timedShields.push({label:shield.label,amount,expiresAt});
  }
  return {
    input:{...input,maxHealth},health:current,
    persistentShield:positive(input.shield??0),timedShields,
    mana:positive(input.mana),autoCount:0,attackStacks:0,
    combat:createCombatRuntime(stackRules,input.initialTargetMarks??[]),
    incomingDebuffs:[],abilityReadyAt:new Map(),autoReadyAt:0,nextFreeAt:0,
    controlledUntil:0,actionIndex:0,damageDealt:0,damageTaken:0,healingDone:0,
    shieldDamageAbsorbed:0,incomplete:false,
  };
}

function nextActionAt(actor:ActorRuntime):number{
  if(actor.health<=0||sequenceComplete(actor))return Number.POSITIVE_INFINITY;
  const step=actor.input.sequence[actor.actionIndex];
  let ready=Math.max(actor.nextFreeAt,actor.controlledUntil);
  if(step==='AA')return Math.max(ready,actor.autoReadyAt);
  const ability=actor.input.abilities[step];
  if(!ability)return ready;
  ready=Math.max(ready,actor.abilityReadyAt.get(step)??0);
  return ready;
}

function sequenceComplete(actor:ActorRuntime){
  return actor.actionIndex>=actor.input.sequence.length;
}

function grantTimedShield(actor:ActorRuntime,shield:ShieldGrant,clock:number):number{
  const amount=positive(shield.amount);
  if(amount<=0)return 0;
  actor.timedShields.push({
    label:shield.label,amount,
    expiresAt:clock+Math.max(0,positive(shield.durationSeconds)),
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

function applyIncoming(actor:ActorRuntime,damage:number,clock:number){
  expireShields(actor,clock);
  let remaining=Math.max(0,finite(damage));
  let shieldDamage=0;

  actor.timedShields.sort((x,y)=>x.expiresAt-y.expiresAt);
  for(const shield of actor.timedShields){
    if(remaining<=EPS)break;
    const used=Math.min(shield.amount,remaining);
    shield.amount-=used;remaining-=used;shieldDamage+=used;
  }
  expireShields(actor,clock);

  if(remaining>EPS&&actor.persistentShield>0){
    const used=Math.min(actor.persistentShield,remaining);
    actor.persistentShield-=used;remaining-=used;shieldDamage+=used;
  }

  const healthDamage=Math.min(actor.health,remaining);
  actor.health=Math.max(0,actor.health-healthDamage);
  return {shieldDamage:round(shieldDamage),healthDamage:round(healthDamage)};
}

function resistancesAt(actor:ActorRuntime,clock:number):TargetResistances{
  actor.incomingDebuffs=actor.incomingDebuffs.filter(d=>d.expiresAt>clock+EPS);
  const armorKeep=actor.incomingDebuffs.reduce(
    (m,d)=>m*(1-clamp01(d.effect.percentArmorReduction??0)),1,
  );
  const mrKeep=actor.incomingDebuffs.reduce(
    (m,d)=>m*(1-clamp01(d.effect.percentMagicResistReduction??0)),1,
  );
  return {
    armor:round(actor.input.resistances.armor*armorKeep),
    magicResist:round(actor.input.resistances.magicResist*mrKeep),
  };
}

function upsertDebuff(active:ActiveDebuff[],effect:TargetDebuffEffect,expiresAt:number){
  const existing=active.find(d=>d.effect.label===effect.label);
  if(existing){existing.effect=effect;existing.expiresAt=expiresAt;return}
  active.push({effect,expiresAt});
}

function currentAttackSpeed(
  model:AutoAttackModel,
  stacks:number,
  timed:ReturnType<typeof timedAutoSnapshot>,
){
  const extra=model.attackStack?model.attackStack.attackSpeedPerStack*stacks:0;
  const cap=Number.isFinite(model.attackSpeedCap)&&Number(model.attackSpeedCap)>0
    ?Number(model.attackSpeedCap):3;
  return Math.min(
    cap,
    Math.max(0,(model.attackSpeed+extra+timed.attackSpeedFlat)*timed.attackSpeedMultiplier),
  );
}

function outgoingMultiplier(actor:ActorRuntime,clock:number):number{
  const duration=Math.max(0,actor.input.outgoingDamageMultiplierDurationSeconds??0);
  if(duration<=0||clock>=duration-EPS)return 1;
  const value=actor.input.outgoingDamageMultiplier??1;
  return Number.isFinite(value)?Math.max(0,value):1;
}

function snapshot(actor:ActorRuntime,clock:number):DuelSideSnapshot{
  const max=Math.max(1,actor.input.maxHealth);
  return {
    champion:actor.input.champion,
    health:round(actor.health),maxHealth:round(max),
    healthPercent:round(actor.health/max*100),
    shield:shieldTotal(actor,clock),mana:round(actor.mana),
    controlledUntil:round(Math.max(clock,actor.controlledUntil)),
    actionIndex:actor.actionIndex,
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
  return delta>0
    ?{verdict:'YOU_AHEAD',winner:'YOU'}
    :{verdict:'THEM_AHEAD',winner:'THEM'};
}

const clamp01=(n:number)=>Math.min(1,Math.max(0,Number.isFinite(n)?n:0));
const positive=(n:number)=>Number.isFinite(n)&&n>0?n:0;
const finite=(n:number|undefined)=>Number.isFinite(n)?n as number:0;
const finiteOr=(n:number|undefined,fallback:number)=>Number.isFinite(n)?n as number:fallback;
const round=(n:number)=>Math.round(n*100)/100;