import {
  DamageComponent,Penetration,TargetResistances,
  mitigateAll,noPenetration,
} from './damage';

/**
 * Combo simulator: a sequence of casts and autos, costed and timed.
 *
 * Answers the questions a player actually asks. Not "how much damage does Q do"
 * but "does Q into auto into E into R kill this, can I pay for it, and where am
 * I left if it does not".
 *
 * WHAT IT MODELS HONESTLY
 * Damage per event against the target's resistances, resource spent and left,
 * cooldown state across the sequence, and the target's remaining health after
 * each step. Mana is enforced: a step that cannot be paid for does not happen
 * and does not deal damage, which is the whole point of asking.
 *
 * WHAT ITS TIMING IS NOT
 * A cast occupies its cast time and an auto occupies one attack interval. Real
 * combos cancel animations into each other, abilities have travel time, and a
 * player moves between casts. So the duration here is a floor — the sequence
 * cannot be faster than this — and it is labelled that way rather than
 * presented as a stopwatch reading.
 *
 * COOLDOWNS ARE CHECKED, NOT ASSUMED
 * Using an ability twice in one sequence is only allowed if its cooldown has
 * actually elapsed. A combo listing Q twice inside five seconds is reported as
 * impossible rather than quietly dealing the damage twice.
 */

export type AbilitySlot='Q'|'W'|'E'|'R';
export type ComboStep=AbilitySlot|'AA';

/** Cooldown reduction from ability haste, the standard League curve. */
export const hasteMultiplier=(abilityHaste:number)=>
  100/(100+Math.max(0,Number.isFinite(abilityHaste)?abilityHaste:0));

export interface AbilityModel{
  slot:AbilitySlot;
  name:string;
  rank:number;
  /** Base cooldown at this rank, before ability haste. */
  cooldownSeconds:number;
  /** Resource cost at this rank. */
  cost:number;
  castTimeSeconds:number;
  /** Raw damage components, already evaluated. */
  damage:DamageComponent[];
}

export interface AutoAttackModel{
  /** Raw damage of one auto, crit already averaged in if wanted. */
  damage:number;
  /** Attacks per second. */
  attackSpeed:number;
}

export interface ComboInput{
  sequence:ComboStep[];
  abilities:Partial<Record<AbilitySlot,AbilityModel>>;
  autoAttack:AutoAttackModel;
  caster:{mana:number};
  target:TargetResistances&{health:number;shield?:number};
  penetration?:Penetration;
  abilityHaste?:number;
}

export type EventStatus='CAST'|'NO_RESOURCE'|'ON_COOLDOWN'|'NOT_LEARNED';

export interface ComboEvent{
  index:number;
  /** Seconds from the start of the combo. */
  atSeconds:number;
  step:ComboStep;
  label:string;
  status:EventStatus;
  rawDamage:number;
  mitigatedDamage:number;
  manaSpent:number;
  manaRemaining:number;
  targetHealthRemaining:number;
  /** Components that had no number, so this event's damage is a floor. */
  skipped:{label:string;reasons:string[]}[];
  note?:string;
}

export interface ComboResult{
  events:ComboEvent[];
  totalRawDamage:number;
  totalMitigatedDamage:number;
  /** Floor on how long the sequence takes. See the note on timing. */
  minimumDurationSeconds:number;
  manaUsed:number;
  manaRemaining:number;
  targetHealthRemaining:number;
  kills:boolean;
  /** False when any step could not be performed. */
  completable:boolean;
  blocked:{step:ComboStep;reason:string}[];
  /** False when any damage component could not be calculated. */
  damageComplete:boolean;
  timingNote:string;
  resourceNote:string;
}

const TIMING_NOTE=
  'Duration is a floor: each cast takes its cast time and each auto one attack '+
  'interval, with no animation cancelling, travel time or movement. A real '+
  'combo is not faster than this, and is usually slower.';

export function simulateCombo(input:ComboInput):ComboResult{
  const haste=hasteMultiplier(input.abilityHaste??0);
  const pen=input.penetration??noPenetration();
  const shield=Math.max(0,positive(input.target.shield??0));

  let clock=0;
  let mana=positive(input.caster.mana);
  const startingMana=mana;
  let remainingShield=shield;
  let health=Math.max(0,positive(input.target.health));

  /** When each ability next becomes available, in combo seconds. */
  const readyAt=new Map<AbilitySlot,number>();
  const events:ComboEvent[]=[];
  const blocked:{step:ComboStep;reason:string}[]=[];
  let damageComplete=true;
  let totalRaw=0,totalMitigated=0;

  input.sequence.forEach((step,index)=>{
    const base={
      index,atSeconds:round(clock),step,
      manaSpent:0,manaRemaining:round(mana),
      rawDamage:0,mitigatedDamage:0,
      targetHealthRemaining:round(health),
      skipped:[] as {label:string;reasons:string[]}[],
    };

    if(step==='AA'){
      const interval=attackInterval(input.autoAttack.attackSpeed);
      const result=mitigateAll(
        [{label:'Auto attack',type:'PHYSICAL',raw:positive(input.autoAttack.damage)}],
        input.target,pen);
      const applied=applyDamage(result.mitigatedTotal,remainingShield,health);
      remainingShield=applied.shield;
      health=applied.health;
      totalRaw+=result.rawTotal;
      totalMitigated+=result.mitigatedTotal;
      clock+=interval;

      events.push({
        ...base,label:'Auto attack',status:'CAST',
        rawDamage:result.rawTotal,mitigatedDamage:result.mitigatedTotal,
        targetHealthRemaining:round(health),
      });
      return;
    }

    const ability=input.abilities[step];
    if(!ability){
      blocked.push({step,reason:`${step} is not available at this level or rank.`});
      events.push({...base,label:step,status:'NOT_LEARNED',
        note:`${step} has no rank, so it cannot be cast.`});
      return;
    }

    const ready=readyAt.get(step)??0;
    if(clock<ready-1e-9){
      const wait=round(ready-clock);
      blocked.push({step,reason:`${ability.name} is still on cooldown for ${wait}s at this point.`});
      events.push({...base,label:ability.name,status:'ON_COOLDOWN',
        note:`${ability.name} comes back ${wait}s after this point in the sequence.`});
      return;
    }

    const cost=positive(ability.cost);
    if(cost>mana+1e-9){
      blocked.push({step,reason:`${ability.name} costs ${cost} and only ${round(mana)} is left.`});
      events.push({...base,label:ability.name,status:'NO_RESOURCE',
        note:`${ability.name} costs ${cost}; ${round(mana)} remaining. The combo stops being payable here.`});
      return;
    }

    mana-=cost;
    const result=mitigateAll(ability.damage,input.target,pen);
    if(!result.complete)damageComplete=false;

    const applied=applyDamage(result.mitigatedTotal,remainingShield,health);
    remainingShield=applied.shield;
    health=applied.health;
    totalRaw+=result.rawTotal;
    totalMitigated+=result.mitigatedTotal;

    // Cooldown starts on cast, so it runs during the cast time itself.
    readyAt.set(step,clock+ability.cooldownSeconds*haste);
    clock+=Math.max(0,positive(ability.castTimeSeconds));

    events.push({
      ...base,
      label:ability.name,status:'CAST',
      rawDamage:result.rawTotal,
      mitigatedDamage:result.mitigatedTotal,
      manaSpent:cost,
      manaRemaining:round(mana),
      targetHealthRemaining:round(health),
      skipped:result.skipped,
      note:result.complete
        ?undefined
        :`Part of ${ability.name} could not be calculated, so this figure is a floor.`,
    });
  });

  return {
    events,
    totalRawDamage:round(totalRaw),
    totalMitigatedDamage:round(totalMitigated),
    minimumDurationSeconds:round(clock),
    manaUsed:round(startingMana-mana),
    manaRemaining:round(mana),
    targetHealthRemaining:round(health),
    kills:health<=0,
    completable:blocked.length===0,
    blocked,
    damageComplete,
    timingNote:TIMING_NOTE,
    resourceNote:resourceNote(startingMana,startingMana-mana,mana,blocked),
  };
}

/**
 * The resource line a player needs is not "you spent 200 mana". It is whether
 * they can still do anything afterwards — a combo that lands but leaves nothing
 * for an escape is a different decision from one that leaves half a bar.
 */
function resourceNote(
  starting:number,used:number,remaining:number,blocked:{reason:string}[],
):string{
  if(starting<=0)return 'This champion has no resource bar, so the combo costs only cooldowns.';
  if(blocked.some(b=>/costs/.test(b.reason)))
    return `The combo is not payable from ${round(starting)}: it runs out partway through.`;
  const share=remaining/starting;
  if(share<=0.1)
    return `Costs ${round(used)} of ${round(starting)} and leaves ${round(remaining)} — effectively empty, with nothing held back for a follow-up or a disengage.`;
  if(share<=0.35)
    return `Costs ${round(used)} of ${round(starting)}, leaving ${round(remaining)}. Enough for the combo, not enough to repeat it.`;
  return `Costs ${round(used)} of ${round(starting)}, leaving ${round(remaining)} — comfortable, with room for a follow-up.`;
}

/** Shields eat damage before health does. */
function applyDamage(damage:number,shield:number,health:number){
  const absorbed=Math.min(shield,damage);
  return {
    shield:round(shield-absorbed),
    health:Math.max(0,round(health-(damage-absorbed))),
  };
}

/**
 * One auto occupies one attack interval. Attack speed is floored rather than
 * allowed to be zero, which would make the interval infinite and the duration
 * meaningless.
 */
export const attackInterval=(attackSpeed:number)=>{
  const speed=positive(attackSpeed);
  return speed>0?round(1/speed):0;
};

const positive=(n:number)=>Number.isFinite(n)&&n>0?n:0;
const round=(n:number)=>Math.round(n*100)/100;
