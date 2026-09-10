import {
  DamageComponent,Penetration,TargetResistances,
  mitigateAll,noPenetration,
} from './damage';
import type {
  AttackStackEffect,AutoProcEffect,DamageRule,OnHitEffect,TargetDebuffEffect,
} from './effects';

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
  damage:DamageComponent[];
  /** Debuff applied after this ability lands, affecting later events. */
  targetDebuff?:TargetDebuffEffect;
}

export interface AutoAttackModel{
  /** Raw physical damage of the ordinary attack; crit may already be averaged. */
  damage:number;
  /** Attacks per second before temporary rune stacks. */
  attackSpeed:number;
  onHits?:OnHitEffect[];
  attackStack?:AttackStackEffect;
  autoProcs?:AutoProcEffect[];
}

export interface ComboInput{
  sequence:ComboStep[];
  abilities:Partial<Record<AbilitySlot,AbilityModel>>;
  autoAttack:AutoAttackModel;
  caster:{mana:number};
  target:TargetResistances&{health:number;maxHealth?:number;shield?:number};
  penetration?:Penetration;
  abilityHaste?:number;
  damageRules?:DamageRule[];
  /** Used for Exhaust: multiplier while the actor is exhausted. */
  outgoingDamageMultiplier?:number;
  outgoingDamageMultiplierDurationSeconds?:number;
}

export type EventStatus='CAST'|'NO_RESOURCE'|'ON_COOLDOWN'|'NOT_LEARNED';

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
}

interface ActiveDebuff{effect:TargetDebuffEffect;expiresAt:number}

const TIMING_NOTE=
  'Duration is a floor: each cast takes its cast time and each auto one attack '+
  'interval, with no animation cancelling, travel time or movement. A real '+
  'combo is not faster than this, and is usually slower.';

export function simulateCombo(input:ComboInput):ComboResult{
  const haste=hasteMultiplier(input.abilityHaste??0);
  const pen=input.penetration??noPenetration();
  const shield=Math.max(0,positive(input.target.shield??0));
  const targetMaxHealth=Math.max(1,positive(input.target.maxHealth??input.target.health));

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
      const nextAuto=autoCount+1;
      const components:DamageComponent[]=[
        {label:'Auto attack',type:'PHYSICAL',raw:positive(input.autoAttack.damage)},
      ];
      for(const effect of input.autoAttack.onHits??[]){
        if(effect.everyNthAttack&&nextAuto%effect.everyNthAttack!==0)continue;
        components.push(resolveOnHit(effect,health,targetMaxHealth));
      }
      for(const proc of input.autoAttack.autoProcs??[])
        if(proc.procAtAuto===nextAuto)
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

      const attackSpeed=currentAttackSpeed(input.autoAttack,attackStacks);
      clock+=attackInterval(attackSpeed);
      autoCount=nextAuto;
      if(stack)attackStacks=Math.min(stack.maxStacks,attackStacks+1);

      events.push({
        ...base,label:components.length>1?`Auto attack + ${components.length-1} effect${components.length===2?'':'s'}`:'Auto attack',
        status:'CAST',rawDamage:result.rawTotal,mitigatedDamage:result.mitigatedTotal,
        targetHealthRemaining:round(health),
      });
      return;
    }

    const ability=input.abilities[step];
    if(!ability){
      blocked.push({step,reason:`${step} is not available at this level or rank.`});
      events.push({...base,label:step,status:'NOT_LEARNED',note:`${step} has no rank, so it cannot be cast.`});
      return;
    }

    const ready=readyAt.get(step)??0;
    if(clock<ready-1e-9){
      const wait=round(ready-clock);
      blocked.push({step,reason:`${ability.name} is still on cooldown for ${wait}s at this point.`});
      events.push({...base,label:ability.name,status:'ON_COOLDOWN',note:`${ability.name} comes back ${wait}s after this point in the sequence.`});
      return;
    }

    const cost=positive(ability.cost);
    if(cost>mana+1e-9){
      blocked.push({step,reason:`${ability.name} costs ${cost} and only ${round(mana)} is left.`});
      events.push({...base,label:ability.name,status:'NO_RESOURCE',note:`${ability.name} costs ${cost}; ${round(mana)} remaining. The combo stops being payable here.`});
      return;
    }

    mana-=cost;
    const adjusted=applyDamageRules(
      ability.damage,input.damageRules??[],health,targetMaxHealth,autoCount,
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

    readyAt.set(step,clock+ability.cooldownSeconds*haste);
    clock+=Math.max(0,positive(ability.castTimeSeconds));

    events.push({
      ...base,label:ability.name,status:'CAST',rawDamage:result.rawTotal,
      mitigatedDamage:result.mitigatedTotal,manaSpent:cost,manaRemaining:round(mana),
      targetHealthRemaining:round(health),skipped:result.skipped,
      note:ability.targetDebuff
        ?`${ability.targetDebuff.label} applied for ${ability.targetDebuff.durationSeconds}s after this hit.`
        :result.complete?undefined:`Part of ${ability.name} could not be calculated, so this figure is a floor.`,
    });
  });

  return {
    events,totalRawDamage:round(totalRaw),totalMitigatedDamage:round(totalMitigated),
    minimumDurationSeconds:round(clock),manaUsed:round(startingMana-mana),
    manaRemaining:round(mana),targetHealthRemaining:round(health),kills:health<=0,
    completable:blocked.length===0,blocked,damageComplete,timingNote:TIMING_NOTE,
    resourceNote:resourceNote(startingMana,startingMana-mana,mana,blocked),
  };
}

/** Resolve a flat/health-scaling on-hit against the health at this exact attack. */
export function resolveOnHit(effect:OnHitEffect,currentHealth:number,maxHealth:number):DamageComponent{
  const raw=(effect.flatDamage??0)
    +(effect.targetMaxHealthRatio??0)*Math.max(0,maxHealth)
    +(effect.targetCurrentHealthRatio??0)*Math.max(0,currentHealth);
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

function currentAttackSpeed(model:AutoAttackModel,stacks:number):number{
  const extra=model.attackStack?model.attackStack.attackSpeedPerStack*stacks:0;
  return Math.min(ATTACK_SPEED_CAP,Math.max(0,model.attackSpeed+extra));
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
