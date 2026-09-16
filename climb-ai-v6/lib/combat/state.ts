import type {AbilitySlot} from './combos';
import type {OnHitEffect} from './effects';
import {roundCombat} from './decimal';

export interface TimedAutoState{
  id:string;
  label:string;
  /** Active from t=0 until this duration elapses. */
  durationSeconds:number;
  /** Multiplier applied to the already-computed starting attack speed. */
  attackSpeedMultiplier?:number;
  /** Optional absolute attacks/second added while active. */
  attackSpeedFlat?:number;
  /** Multiplier applied to the ordinary AD auto component. */
  basicAttackDamageMultiplier?:number;
  /** Replaces the base per-auto resource cost while active. */
  resourceCostOverride?:number;
  onHits?:OnHitEffect[];
}

export interface AbilityStackRule{
  id:string;
  label:string;
  slot:AbilitySlot;
  startingStacks:number;
  maxStacks:number;
  durationSeconds:number;
  /** Stacks added after a successful cast. */
  gainOnCast:number;
  /** Linear multiplier applied before mitigation, based on stacks BEFORE the cast. */
  damageMultiplierPerStack?:number;
  /** Flat seconds removed from base cooldown per pre-cast stack. */
  cooldownFlatReductionPerStack?:number;
}

export interface InitialTargetMark{
  id:string;
  label:string;
  stacks:number;
  durationSeconds:number;
}

export interface MarkConsumer{
  markId:string;
  label:string;
  consumeStacks:number;
  damage:OnHitEffect;
}

export interface ShieldGrant{
  label:string;
  amount:number;
  durationSeconds:number;
}

/**
 * An ability such as Viego R can explicitly apply the actor's eligible on-hit
 * package without becoming a basic attack. It does not advance PTA/Lethal Tempo
 * or the ordinary attack counter unless a future mechanic explicitly says so.
 */
export interface AbilityOnHitApplication{
  label:string;
  /** 1 = 100% effectiveness. Stored as a multiplier rather than a percentage. */
  effectiveness:number;
}

/**
 * A true modified/replacement basic attack. This replaces the ordinary physical
 * AD component rather than adding another component on top of it, preventing
 * double-counting on attacks such as Galio passive once champion wiring lands.
 */
export interface BasicAttackReplacement{
  id:string;
  label:string;
  /** Replacement damage can itself be mixed or health-scaled. */
  damage:OnHitEffect[];
  /** Usually one for a "next attack" passive. Omit for every attack. */
  firstNAttacks?:number;
}

/** Patch-validated ordinary basic-attack windup data. */
export interface BasicAttackTimingState{
  championId:string;
  patch:string;
  windupPercent:number;
}

export interface AbilityEventState{
  stackRule?:AbilityStackRule;
  consumesMarks?:MarkConsumer[];
  grantsSelfShield?:ShieldGrant;
  /** Apply only on-hits explicitly tagged appliesFromAbility=true. */
  appliesOnHitEffects?:AbilityOnHitApplication;
  /** Records that a cast resets the basic attack timer. The current sequential
   * combo clock can surface this state even before a full wind-up scheduler uses it. */
  resetsBasicAttackTimer?:boolean;
}

export interface AutoEventState{
  consumesMarks?:MarkConsumer[];
  /** Replace the normal basic-attack damage component for matching attacks. */
  replacement?:BasicAttackReplacement;
  /** Fail-closed timing metadata: absent means preserve the legacy immediate-hit fallback. */
  attackTiming?:BasicAttackTimingState;
}

interface StackRuntime{stacks:number;expiresAt:number}
interface MarkRuntime{stacks:number;expiresAt:number;label:string}
interface ShieldRuntime{amount:number;expiresAt:number;label:string}

export interface CombatRuntimeState{
  stacks:Map<string,StackRuntime>;
  marks:Map<string,MarkRuntime>;
  selfShields:ShieldRuntime[];
  attackTimerResets:number;
}

export function createCombatRuntime(
  stackRules:AbilityStackRule[]=[],
  marks:InitialTargetMark[]=[],
):CombatRuntimeState{
  const stacks=new Map<string,StackRuntime>();
  for(const rule of stackRules){
    const count=clampInt(rule.startingStacks,0,rule.maxStacks);
    if(count>0)
      stacks.set(rule.id,{stacks:count,expiresAt:Math.max(0,rule.durationSeconds)});
  }
  const targetMarks=new Map<string,MarkRuntime>();
  for(const mark of marks){
    const count=Math.max(0,Math.round(mark.stacks));
    if(count<=0)continue;
    targetMarks.set(mark.id,{
      stacks:count,
      expiresAt:Math.max(0,mark.durationSeconds),
      label:mark.label,
    });
  }
  return {stacks,marks:targetMarks,selfShields:[],attackTimerResets:0};
}

export function activeTimedAutoStates(states:TimedAutoState[]|undefined,clock:number):TimedAutoState[]{
  return (states??[]).filter(state=>Math.max(0,state.durationSeconds)>clock+1e-9);
}

export function currentAbilityStacks(
  runtime:CombatRuntimeState,
  rule:AbilityStackRule|undefined,
  clock:number,
):number{
  if(!rule)return 0;
  const state=runtime.stacks.get(rule.id);
  if(!state)return 0;
  if(state.expiresAt<=clock+1e-9){
    runtime.stacks.delete(rule.id);
    return 0;
  }
  return clampInt(state.stacks,0,rule.maxStacks);
}

export function abilityDamageMultiplier(
  runtime:CombatRuntimeState,
  rule:AbilityStackRule|undefined,
  clock:number,
):number{
  if(!rule)return 1;
  const stacks=currentAbilityStacks(runtime,rule,clock);
  const per=finite(rule.damageMultiplierPerStack,0);
  return roundCombat(Math.max(0,1+per*stacks),12);
}

export function abilityCooldownSeconds(
  baseCooldown:number,
  runtime:CombatRuntimeState,
  rule:AbilityStackRule|undefined,
  clock:number,
):number{
  const base=Math.max(0,finite(baseCooldown,0));
  if(!rule)return base;
  const stacks=currentAbilityStacks(runtime,rule,clock);
  const reduction=Math.max(0,finite(rule.cooldownFlatReductionPerStack,0))*stacks;
  return roundCombat(Math.max(0,base-reduction),12);
}

export function applyAbilityStackAfterCast(
  runtime:CombatRuntimeState,
  rule:AbilityStackRule|undefined,
  clock:number,
):number{
  if(!rule)return 0;
  const current=currentAbilityStacks(runtime,rule,clock);
  const next=clampInt(current+rule.gainOnCast,0,rule.maxStacks);
  if(next<=0){runtime.stacks.delete(rule.id);return 0}
  runtime.stacks.set(rule.id,{stacks:next,expiresAt:clock+Math.max(0,rule.durationSeconds)});
  return next;
}

export function activeMarks(runtime:CombatRuntimeState,clock:number):string[]{
  const out:string[]=[];
  for(const [id,mark] of runtime.marks){
    if(mark.expiresAt<=clock+1e-9){runtime.marks.delete(id);continue}
    out.push(`${mark.label} x${mark.stacks}`);
  }
  return out;
}

export function consumeMark(runtime:CombatRuntimeState,consumer:MarkConsumer,clock:number):boolean{
  const mark=runtime.marks.get(consumer.markId);
  if(!mark)return false;
  if(mark.expiresAt<=clock+1e-9){runtime.marks.delete(consumer.markId);return false}
  if(mark.stacks<consumer.consumeStacks)return false;
  mark.stacks-=consumer.consumeStacks;
  if(mark.stacks<=0)runtime.marks.delete(consumer.markId);
  else runtime.marks.set(consumer.markId,mark);
  return true;
}

export function grantSelfShield(runtime:CombatRuntimeState,grant:ShieldGrant|undefined,clock:number):number{
  if(!grant)return currentSelfShield(runtime,clock);
  const amount=Math.max(0,finite(grant.amount,0));
  if(amount>0)runtime.selfShields.push({amount,expiresAt:clock+Math.max(0,grant.durationSeconds),label:grant.label});
  return currentSelfShield(runtime,clock);
}

export function currentSelfShield(runtime:CombatRuntimeState,clock:number):number{
  runtime.selfShields=runtime.selfShields.filter(shield=>shield.expiresAt>clock+1e-9);
  return runtime.selfShields.reduce((sum,shield)=>sum+shield.amount,0);
}

export function recordAttackTimerReset(runtime:CombatRuntimeState,enabled:boolean|undefined):boolean{
  if(!enabled)return false;
  runtime.attackTimerResets+=1;
  return true;
}

export function timedAutoSnapshot(states:TimedAutoState[]|undefined,clock:number){
  const active=activeTimedAutoStates(states,clock);
  return {
    labels:active.map(state=>state.label),
    attackSpeedMultiplier:active.reduce((mult,state)=>mult*Math.max(0,finite(state.attackSpeedMultiplier,1)),1),
    attackSpeedFlat:active.reduce((sum,state)=>sum+finite(state.attackSpeedFlat,0),0),
    basicAttackDamageMultiplier:active.reduce((mult,state)=>mult*Math.max(0,finite(state.basicAttackDamageMultiplier,1)),1),
    resourceCostOverride:active.find(state=>state.resourceCostOverride!==undefined)?.resourceCostOverride,
    onHits:active.flatMap(state=>state.onHits??[]),
  };
}

function clampInt(value:number,min:number,max:number){return Math.max(min,Math.min(max,Math.round(finite(value,min))))}
function finite(value:number|undefined,fallback:number){return Number.isFinite(value)?Number(value):fallback}
