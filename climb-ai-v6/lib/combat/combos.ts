import {
  DamageComponent,Penetration,TargetResistances,
  mitigateAll,noPenetration,
} from './damage';
import {
  autoProcTriggers,onHitTriggers,
  type AttackStackEffect,type AutoProcEffect,type DamageRule,
  type OnHitEffect,type TargetDebuffEffect,
} from './effects';
import {
  abilityCooldownSeconds,abilityDamageMultiplier,activeMarks,
  applyAbilityStackAfterCast,consumeMark,createCombatRuntime,currentSelfShield,
  grantSelfShield,recordAttackTimerReset,timedAutoSnapshot,
  type AbilityEventState,type AutoEventState,type InitialTargetMark,type TimedAutoState,
} from './state';
import {
  consumeRechargeableAttack,rechargeableAttackEffects,rechargeableAttackSpeedMultiplier,
  reduceRechargeableAttackCooldownOnAbilityHit,
} from './attackInteractions';
import {resolveRangeAccess} from './rangeAccess';

/** Combo simulator: sequence damage, resources, cooldowns and combat effects. */
export type AbilitySlot='Q'|'W'|'E'|'R';
export type ComboStep=AbilitySlot|'AA';

export const ATTACK_SPEED_CAP=3;

export const hasteMultiplier=(abilityHaste:number)=>
  100/(100+Math.max(0,Number.isFinite(abilityHaste)?abilityHaste:0));

export interface AbilityModel{
  slot:AbilitySlot;
  name:string;
  rank:number;
  cooldownSeconds:number;
  cost:number;
  castTimeSeconds:number;
  /** Riot/Data Dragon cast range when it is a positive comparable distance. */
  rangeUnits?:number|null;
  damage:DamageComponent[];
  /** Target-health dependent damage resolved at the exact cast event. */
  dynamicDamage?:OnHitEffect[];
  /** Debuff applied after this ability lands, affecting later events. */
  targetDebuff?:TargetDebuffEffect;
  /** Stateful mechanics such as stacks, marks, shields and attack resets. */
  eventState?:AbilityEventState;
}

export interface AutoAttackModel{
  /** Raw physical damage of the ordinary attack; crit may already be averaged. */
  damage:number;
  /** Attacks per second before temporary rune/champion states. */
  attackSpeed:number;
  /** Current basic-attack range after explicit champion range modifiers. */
  rangeUnits?:number|null;
  /** Some champion weapons spend resource on each attack, e.g. Jinx Fishbones. */
  resourceCost?:number;
  /** Champion states such as Get Excited may override the normal 3.0 cap. */
  attackSpeedCap?:number;
  onHits?:OnHitEffect[];
  attackStack?:AttackStackEffect;
  autoProcs?:AutoProcEffect[];
  /** Buffs active at t=0 that expire during the fight. */
  timedStates?:TimedAutoState[];
  eventState?:AutoEventState;
}

export interface ComboInput{
  sequence:ComboStep[];
  abilities:Partial<Record<AbilitySlot,AbilityModel>>;
  autoAttack:AutoAttackModel;
  caster:{mana:number};
  target:TargetResistances&{health:number;maxHealth?:number;shield?:number};
  /** Static target separation. Omit to preserve UNKNOWN/legacy access rather than guessing geometry. */
  targetDistanceUnits?:number|null;
  penetration?:Penetration;
  abilityHaste?:number;
  damageRules?:DamageRule[];
  /** Marks already on the target when t=0 begins. */
  initialTargetMarks?:InitialTargetMark[];
  /** Used for Exhaust: multiplier while the actor is exhausted. */
  outgoingDamageMultiplier?:number;
  outgoingDamageMultiplierDurationSeconds?:number;
}

export type EventStatus='CAST'|'NO_RESOURCE'|'ON_COOLDOWN'|'NOT_LEARNED'|'OUT_OF_RANGE';

export interface ComboEventState{
  timedAuto:string[];
  targetMarks:string[];
  selfShield:number;
  stackChange?:string;
  attackTimerReset?:boolean;
}

export interface ComboEvent{
  index:number;
  atSeconds:number;
  step:ComboStep;
  label:string;
  status:EventStatus;
  rawDamage:number;
  mitigatedDamage:number;
  manaSpent:number;
  manaRemaining:number;
  targetHealthRemaining:number;
  skipped:{label:string;reasons:string[]}[];
  note?:string;
  state?:ComboEventState;
}

export interface ComboResult{
  events:ComboEvent[];
  totalRawDamage:number;
  totalMitigatedDamage:number;
  minimumDurationSeconds:number;
  manaUsed:number;
  manaRemaining:number;
  targetHealthRemaining:number;
  kills:boolean;
  completable:boolean;
  blocked:{step:ComboStep;reason:string}[];
  damageComplete:boolean;
  timingNote:string;
  resourceNote:string;
  stateNote:string;
}

interface ActiveDebuff{effect:TargetDebuffEffect;expiresAt:number}

const TIMING_NOTE=
  'Duration is a floor: each cast takes its cast time and each auto one attack '+
  'interval, with no animation cancelling, travel time or movement. A real '+
  'combo is not faster than this, and is usually slower.';
const STATE_NOTE=
  'Temporary champion states, target marks, ability stacks and rechargeable attack passives advance on the combat timeline. '+
  'Rechargeable passives can also alter the attack speed of the attack that consumes them. '+
  'When static target distance is supplied, known action ranges can block casts without inventing movement. '+
  'Self-shields and attack-reset events are recorded, but a one-sided combo does not yet let those defensive/reset events alter an opponent timeline.';

export function simulateCombo(input:ComboInput):ComboResult{
  const haste=hasteMultiplier(input.abilityHaste??0);
  const pen=input.penetration??noPenetration();
  const shield=Math.max(0,positive(input.target.shield??0));
  const targetMaxHealth=Math.max(1,positive(input.target.maxHealth??input.target.health));
  const stackRules=Object.values(input.abilities)
    .map(a=>a?.eventState?.stackRule)
    .filter((x):x is NonNullable<typeof x>=>Boolean(x));
  const runtime=createCombatRuntime(stackRules,input.initialTargetMarks??[]);

  let clock=0;
  let mana=positive(input.caster.mana);
  const startingMana=mana;
  let remainingShield=shield;
  let health=Math.max(0,positive(input.target.health));
  let autoCount=0;
  let attackStacks=0;
  const activeDebuffs:ActiveDebuff[]=[];

  const readyAt=new Map<AbilitySlot,number>();
  const events:ComboEvent[]=[];
  const blocked:{step:ComboStep;reason:string}[]=[];
  let damageComplete=true;
  let totalRaw=0,totalMitigated=0;

  input.sequence.forEach((step,index)=>{
    const base={
      index,atSeconds:round(clock),step,
      manaSpent:0,manaRemaining:round(mana),
      rawDamage:0,mitigatedDamage:0,targetHealthRemaining:round(health),
      skipped:[] as {label:string;reasons:string[]}[],
    };
    const targetNow=targetResistancesWithDebuffs(input.target,activeDebuffs,clock);

    if(step==='AA'){
      const timed=timedAutoSnapshot(input.autoAttack.timedStates,clock);
      const access=resolveRangeAccess(input.targetDistanceUnits,input.autoAttack.rangeUnits,'Basic attack');
      if(access.status==='OUT_OF_RANGE'){
        blocked.push({step,reason:access.note});
        events.push({...base,label:'Basic attack',status:'OUT_OF_RANGE',note:access.note,state:stateSnapshot(runtime,clock,timed.labels)});
        return;
      }
      const resourceCost=timed.resourceCostOverride??positive(input.autoAttack.resourceCost??0);
      if(resourceCost>mana+1e-9){
        const reason=`This basic attack costs ${round(resourceCost)} resource and only ${round(mana)} is left.`;
        blocked.push({step,reason});
        events.push({...base,label:'Basic attack',status:'NO_RESOURCE',note:reason,state:stateSnapshot(runtime,clock,timed.labels)});
        return;
      }
      mana-=resourceCost;

      const nextAuto=autoCount+1;
      const replacementEffects=rechargeableAttackEffects(input.autoAttack,runtime,clock);
      const readyAttackSpeedMultiplier=rechargeableAttackSpeedMultiplier(input.autoAttack,runtime,clock);
      const components:DamageComponent[]=replacementEffects?.length
        ?replacementEffects.map(effect=>resolveOnHit(effect,health,targetMaxHealth))
        :[{
          label:'Auto attack',type:'PHYSICAL',
          raw:positive(input.autoAttack.damage)*timed.basicAttackDamageMultiplier,
        }];
      for(const effect of [...(input.autoAttack.onHits??[]),...timed.onHits]){
        if(!onHitTriggers(effect,nextAuto))continue;
        components.push(resolveOnHit(effect,health,targetMaxHealth));
      }
      for(const consumer of input.autoAttack.eventState?.consumesMarks??[])
        if(consumeMark(runtime,consumer,clock))
          components.push(resolveOnHit(consumer.damage,health,targetMaxHealth));
      for(const proc of input.autoAttack.autoProcs??[])
        if(autoProcTriggers(proc,nextAuto))
          components.push(resolveOnHit(proc.damage,health,targetMaxHealth));

      const stack=input.autoAttack.attackStack;
      if(stack?.onHitAtMax&&attackStacks>=stack.maxStacks)
        components.push(resolveOnHit(stack.onHitAtMax,health,targetMaxHealth));

      const adjusted=applyDamageRules(
        components,input.damageRules??[],health,targetMaxHealth,autoCount,
        timedOutgoingMultiplier(input,clock),
      );
      const result=mitigateAll(adjusted,targetNow,pen);
      const applied=applyDamage(result.mitigatedTotal,remainingShield,health);
      remainingShield=applied.shield;health=applied.health;
      totalRaw+=result.rawTotal;totalMitigated+=result.mitigatedTotal;

      const passiveProc=replacementEffects?.length
        ?consumeRechargeableAttack(input.autoAttack,runtime,clock)
        :null;
      const attackSpeed=currentAttackSpeed(
        input.autoAttack,attackStacks,timed,readyAttackSpeedMultiplier,
      );
      clock+=attackInterval(attackSpeed);
      autoCount=nextAuto;
      if(stack)attackStacks=Math.min(stack.maxStacks,attackStacks+1);

      const passiveNotes=[
        passiveProc?`${passiveProc.label} consumed; passive ready again at ${passiveProc.readyAt}s before later refunds.`:'',
        passiveProc&&readyAttackSpeedMultiplier!==1
          ?`${round((readyAttackSpeedMultiplier-1)*100)}% ready-state attack speed applied to this attack interval.`:'',
      ].filter(Boolean);
      events.push({
        ...base,
        label:passiveProc
          ?`${passiveProc.label}${components.length>1?` + ${components.length-1} effect${components.length===2?'':'s'}`:''}`
          :components.length>1?`Auto attack + ${components.length-1} effect${components.length===2?'':'s'}`:'Auto attack',
        status:'CAST',rawDamage:result.rawTotal,mitigatedDamage:result.mitigatedTotal,
        manaSpent:resourceCost,manaRemaining:round(mana),targetHealthRemaining:round(health),
        note:passiveNotes.length?passiveNotes.join(' '):undefined,
        state:stateSnapshot(runtime,clock,timed.labels),
      });
      return;
    }

    const ability=input.abilities[step];
    if(!ability){
      blocked.push({step,reason:`${step} is not available at this level or rank.`});
      events.push({...base,label:step,status:'NOT_LEARNED',note:`${step} has no rank, so it cannot be cast.`,state:stateSnapshot(runtime,clock,[])});
      return;
    }

    const ready=readyAt.get(step)??0;
    if(clock<ready-1e-9){
      const wait=round(ready-clock);
      blocked.push({step,reason:`${ability.name} is still on cooldown for ${wait}s at this point.`});
      events.push({...base,label:ability.name,status:'ON_COOLDOWN',note:`${ability.name} comes back ${wait}s after this point in the sequence.`,state:stateSnapshot(runtime,clock,[])});
      return;
    }

    const access=resolveRangeAccess(input.targetDistanceUnits,ability.rangeUnits,ability.name);
    if(access.status==='OUT_OF_RANGE'){
      blocked.push({step,reason:access.note});
      events.push({...base,label:ability.name,status:'OUT_OF_RANGE',note:access.note,state:stateSnapshot(runtime,clock,[])});
      return;
    }

    const cost=positive(ability.cost);
    if(cost>mana+1e-9){
      blocked.push({step,reason:`${ability.name} costs ${cost} and only ${round(mana)} is left.`});
      events.push({...base,label:ability.name,status:'NO_RESOURCE',note:`${ability.name} costs ${cost}; ${round(mana)} remaining. The combo stops being payable here.`,state:stateSnapshot(runtime,clock,[])});
      return;
    }

    mana-=cost;
    const abilityComponents=[
      ...ability.damage,
      ...(ability.dynamicDamage??[]).map(effect=>resolveOnHit(effect,health,targetMaxHealth)),
    ];
    for(const consumer of ability.eventState?.consumesMarks??[])
      if(consumeMark(runtime,consumer,clock))
        abilityComponents.push(resolveOnHit(consumer.damage,health,targetMaxHealth));

    const stackRule=ability.eventState?.stackRule;
    const stackMultiplier=abilityDamageMultiplier(runtime,stackRule,clock);
    const stateAdjusted=stackMultiplier===1
      ?abilityComponents
      :abilityComponents.map(component=>component.raw===null
        ?component
        :{...component,raw:round(component.raw*stackMultiplier)});
    const adjusted=applyDamageRules(
      stateAdjusted,input.damageRules??[],health,targetMaxHealth,autoCount,
      timedOutgoingMultiplier(input,clock),
    );
    // The ability that creates a shred hits before its own shred applies.
    const result=mitigateAll(adjusted,targetNow,pen);
    if(!result.complete)damageComplete=false;

    const applied=applyDamage(result.mitigatedTotal,remainingShield,health);
    remainingShield=applied.shield;health=applied.health;
    totalRaw+=result.rawTotal;totalMitigated+=result.mitigatedTotal;

    if(ability.targetDebuff)
      upsertDebuff(activeDebuffs,ability.targetDebuff,clock+ability.targetDebuff.durationSeconds);

    const passiveRefund=reduceRechargeableAttackCooldownOnAbilityHit(
      input.autoAttack,runtime,ability,clock,
    );
    const stacksAfter=applyAbilityStackAfterCast(runtime,stackRule,clock);
    const cooldownBase=abilityCooldownSeconds(ability.cooldownSeconds,runtime,stackRule,clock);
    readyAt.set(step,clock+cooldownBase*haste);
    const selfShield=grantSelfShield(runtime,ability.eventState?.grantsSelfShield,clock);
    const attackReset=recordAttackTimerReset(runtime,ability.eventState?.resetsBasicAttackTimer);
    const stackChange=stackRule?`${stackRule.label}: ${stacksAfter}/${stackRule.maxStacks}`:undefined;
    clock+=Math.max(0,positive(ability.castTimeSeconds));

    const notes=[
      ability.targetDebuff?`${ability.targetDebuff.label} applied for ${ability.targetDebuff.durationSeconds}s after this hit.`:'',
      passiveRefund?`${passiveRefund.label}: ability hit refunded ${passiveRefund.reduction}s; passive ready at ${passiveRefund.after}s.`:'',
      selfShield>0&&ability.eventState?.grantsSelfShield?`${ability.eventState.grantsSelfShield.label}: ${round(selfShield)} self-shield active.`:'',
      attackReset?'Basic-attack timer reset event recorded.':'',
      !result.complete?`Part of ${ability.name} could not be calculated, so this figure is a floor.`:'',
    ].filter(Boolean);

    events.push({
      ...base,label:ability.name,status:'CAST',rawDamage:result.rawTotal,
      mitigatedDamage:result.mitigatedTotal,manaSpent:cost,manaRemaining:round(mana),
      targetHealthRemaining:round(health),skipped:result.skipped,
      note:notes.length?notes.join(' '):undefined,
      state:{...stateSnapshot(runtime,clock,[]),stackChange,attackTimerReset:attackReset||undefined},
    });
  });

  return {
    events,totalRawDamage:round(totalRaw),totalMitigatedDamage:round(totalMitigated),
    minimumDurationSeconds:round(clock),manaUsed:round(startingMana-mana),
    manaRemaining:round(mana),targetHealthRemaining:round(health),kills:health<=0,
    completable:blocked.length===0,blocked,damageComplete,timingNote:TIMING_NOTE,
    resourceNote:resourceNote(startingMana,startingMana-mana,mana,blocked),
    stateNote:STATE_NOTE,
  };
}

/** Resolve a flat/health-scaling effect against target health at this exact event. */
export function resolveOnHit(effect:OnHitEffect,currentHealth:number,maxHealth:number):DamageComponent{
  const safeMax=Math.max(0,maxHealth);
  const safeCurrent=Math.max(0,Math.min(currentHealth,safeMax));
  const missing=Math.max(0,safeMax-safeCurrent);
  const calculated=(effect.flatDamage??0)
    +(effect.targetMaxHealthRatio??0)*safeMax
    +(effect.targetCurrentHealthRatio??0)*safeCurrent
    +(effect.targetMissingHealthRatio??0)*missing;
  const raw=Math.max(effect.minimumDamage??0,calculated);
  return {label:effect.label,type:effect.type,raw:round(raw)};
}

/** Apply rune/Exhaust modifiers before resistance mitigation. */
export function applyDamageRules(
  components:DamageComponent[],rules:DamageRule[],currentHealth:number,maxHealth:number,
  autosCompleted:number,timedMultiplier=1,
):DamageComponent[]{
  const hpRatio=Math.max(0,currentHealth)/Math.max(1,maxHealth);
  return components.map(component=>{
    if(component.raw===null)return component;
    let multiplier=1;
    for(const rule of rules){
      if(rule.excludeTrue&&component.type==='TRUE')continue;
      if(rule.activateAfterAutos!==undefined&&autosCompleted<rule.activateAfterAutos)continue;
      if(rule.targetAboveHealthRatio!==undefined&&hpRatio<=rule.targetAboveHealthRatio)continue;
      if(rule.targetBelowHealthRatio!==undefined&&hpRatio>=rule.targetBelowHealthRatio)continue;
      multiplier*=rule.multiplier;
    }
    // Exhaust does not reduce true damage.
    if(component.type!=='TRUE')multiplier*=timedMultiplier;
    return {...component,raw:round(Math.max(0,component.raw)*multiplier)};
  });
}

/** Percentage resistance reductions from separate sources stack multiplicatively. */
export function targetResistancesWithDebuffs(
  base:TargetResistances,
  active:ActiveDebuff[],
  clock:number,
):TargetResistances{
  const live=active.filter(d=>d.expiresAt>clock+1e-9);
  const armorKeep=live.reduce((m,d)=>m*(1-clamp01(d.effect.percentArmorReduction??0)),1);
  const mrKeep=live.reduce((m,d)=>m*(1-clamp01(d.effect.percentMagicResistReduction??0)),1);
  return {
    armor:round(base.armor*armorKeep),
    magicResist:round(base.magicResist*mrKeep),
  };
}

function upsertDebuff(active:ActiveDebuff[],effect:TargetDebuffEffect,expiresAt:number){
  const current=active.find(d=>d.effect.label===effect.label);
  if(current){current.effect=effect;current.expiresAt=expiresAt;return}
  active.push({effect,expiresAt});
}

function currentAttackSpeed(
  model:AutoAttackModel,
  stacks:number,
  timed:ReturnType<typeof timedAutoSnapshot>,
  readyStateMultiplier=1,
):number{
  const extra=model.attackStack?model.attackStack.attackSpeedPerStack*stacks:0;
  const cap=Number.isFinite(model.attackSpeedCap)&&Number(model.attackSpeedCap)>0
    ?Number(model.attackSpeedCap)
    :ATTACK_SPEED_CAP;
  return Math.min(
    cap,
    Math.max(0,(model.attackSpeed+extra+timed.attackSpeedFlat)*timed.attackSpeedMultiplier*Math.max(0,readyStateMultiplier)),
  );
}

function timedOutgoingMultiplier(input:ComboInput,clock:number):number{
  const duration=Math.max(0,input.outgoingDamageMultiplierDurationSeconds??0);
  if(duration<=0||clock>=duration)return 1;
  const value=input.outgoingDamageMultiplier??1;
  return Number.isFinite(value)?Math.max(0,value):1;
}

function resourceNote(starting:number,used:number,remaining:number,blocked:{reason:string}[]):string{
  if(starting<=0)return 'This champion has no resource bar, so the combo costs only cooldowns.';
  if(blocked.some(b=>/costs/.test(b.reason)))return `The combo is not payable from ${round(starting)}: it runs out partway through.`;
  const share=remaining/starting;
  if(share<=0.1)return `Costs ${round(used)} of ${round(starting)} and leaves ${round(remaining)} — effectively empty, with nothing held back for a follow-up or a disengage.`;
  if(share<=0.35)return `Costs ${round(used)} of ${round(starting)}, leaving ${round(remaining)}. Enough for the combo, not enough to repeat it.`;
  return `Costs ${round(used)} of ${round(starting)}, leaving ${round(remaining)} — comfortable, with room for a follow-up.`;
}

function stateSnapshot(
  runtime:ReturnType<typeof createCombatRuntime>,clock:number,timedAuto:string[],
):ComboEventState{
  return {
    timedAuto,
    targetMarks:activeMarks(runtime,clock),
    selfShield:currentSelfShield(runtime,clock),
  };
}

function applyDamage(damage:number,shield:number,health:number){
  const absorbed=Math.min(shield,damage);
  return {shield:round(shield-absorbed),health:Math.max(0,round(health-(damage-absorbed)))};
}

export const attackInterval=(attackSpeed:number)=>{
  const speed=positive(attackSpeed);
  return speed>0?round(1/speed):0;
};

const clamp01=(n:number)=>Math.min(1,Math.max(0,Number.isFinite(n)?n:0));
const positive=(n:number)=>Number.isFinite(n)&&n>0?n:0;
const round=(n:number)=>Math.round(n*100)/100;