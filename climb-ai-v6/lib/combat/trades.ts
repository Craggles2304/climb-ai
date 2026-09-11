import {
  type DamageComponent,Penetration,TargetResistances,mitigateAll,noPenetration,
} from './damage';
import {
  AbilityModel,AbilitySlot,AutoAttackModel,attackInterval,hasteMultiplier,
  applyDamageRules,resolveOnHit,
} from './combos';
import {
  autoProcTriggers,onHitTriggers,
  type DamageRule,type TargetDebuffEffect,
} from './effects';
import {
  abilityCooldownSeconds,abilityDamageMultiplier,applyAbilityStackAfterCast,
  consumeMark,createCombatRuntime,currentSelfShield,grantSelfShield,
  recordAttackTimerReset,timedAutoSnapshot,
  type InitialTargetMark,
} from './state';
import {
  consumeRechargeableAttack,rechargeableAttackEffects,rechargeableAttackSpeedMultiplier,
  reduceRechargeableAttackCooldownOnAbilityHit,
} from './attackInteractions';
import {ConfidenceReport,assessConfidence,combineConfidence} from './confidence';

export interface TradeScenario{
  key:string;
  label:string;
  budgetSeconds:number|null;
  abilitiesOnce?:boolean;
  autosOnly?:boolean;
  maxActions?:number;
}

export const TRADE_SCENARIOS:TradeScenario[]=[
  {key:'ONE_AUTO',label:'One auto',budgetSeconds:null,autosOnly:true,maxActions:1},
  {key:'SHORT_3S',label:'Short trade (3s)',budgetSeconds:3},
  {key:'MEDIUM_5S',label:'Trade (5s)',budgetSeconds:5},
  {key:'EXTENDED_10S',label:'Extended fight (10s)',budgetSeconds:10},
  {key:'FULL_COMBO',label:'Full combo',budgetSeconds:null,abilitiesOnce:true},
];

export const EVEN_TRADE_POINTS=4;

export interface TradeSide{
  champion:string;
  abilities:Partial<Record<AbilitySlot,AbilityModel>>;
  autoAttack:AutoAttackModel;
  mana:number;
  maxHealth:number;
  currentHealth?:number;
  shield?:number;
  resistances:TargetResistances;
  penetration?:Penetration;
  abilityHaste?:number;
  damageRules?:DamageRule[];
  outgoingDamageMultiplier?:number;
  outgoingDamageMultiplierDurationSeconds?:number;
  disabled?:AbilitySlot[];
  initialTargetMarks?:InitialTargetMark[];
}

export interface TradeStep{
  atSeconds:number;
  label:string;
  damage:number;
  state?:string;
}
export interface TradeSideResult{
  champion:string;
  damageDealt:number;
  healthSharePercent:number;
  manaUsed:number;
  manaLeft:number;
  steps:TradeStep[];
  incomplete:boolean;
  unmodelled:string[];
  selfShieldGenerated:number;
  attackTimerResets:number;
}
export type TradeVerdict='YOU'|'THEM'|'EVEN';
export interface TradeOutcome{
  scenario:TradeScenario;you:TradeSideResult;them:TradeSideResult;
  verdict:TradeVerdict;marginPoints:number;explanation:string;
}
export interface TradeReport{
  outcomes:TradeOutcome[];
  flip:string|null;
  modelNote:string;
  confidence:ConfidenceReport;
}

interface ActiveDebuff{effect:TargetDebuffEffect;expiresAt:number}

const MODEL_NOTE=
  'A damage race, not a full simultaneous duel: both sides commit, every selected damage ability hits, '+
  'and temporary offensive states/stacks/marks/rechargeable attack passives advance on each side’s own timeline. '+
  'A rechargeable passive can also alter the attack speed of the attack that consumes it. Cast-generated '+
  'self-shields and attack resets are recorded but do not yet intercept the opponent timeline.';

export function compareTrades(
  you:TradeSide,them:TradeSide,scenarios=TRADE_SCENARIOS,
):TradeReport{
  const outcomes=scenarios.map(scenario=>{
    const yours=runTrade(you,them,scenario);
    const theirs=runTrade(them,you,scenario);
    return buildOutcome(scenario,yours,theirs);
  });
  return {
    outcomes,flip:findFlip(outcomes),modelNote:MODEL_NOTE,
    confidence:combineConfidence(outcomes.map(o=>assessConfidence({
      approximations:[MODEL_NOTE],
      unmodelled:[...o.you.unmodelled,...o.them.unmodelled],
    }))),
  };
}

export function runTrade(
  actor:TradeSide,target:TradeSide,scenario:TradeScenario,
):TradeSideResult{
  const haste=hasteMultiplier(actor.abilityHaste??0);
  const pen=actor.penetration??noPenetration();
  const budget=scenario.budgetSeconds??Infinity;
  const disabled=new Set(actor.disabled??[]);
  const targetMaxHealth=Math.max(1,positive(target.maxHealth));
  const startingHealth=Math.min(
    targetMaxHealth,
    Math.max(0,finiteOr(target.currentHealth,targetMaxHealth)),
  );
  const startingShield=Math.max(0,finiteOr(target.shield,0));
  const startingPool=Math.max(1,startingHealth+startingShield);
  const stackRules=Object.values(actor.abilities)
    .map(a=>a?.eventState?.stackRule)
    .filter((x):x is NonNullable<typeof x>=>Boolean(x));
  const runtime=createCombatRuntime(stackRules,actor.initialTargetMarks??[]);

  let clock=0;
  let mana=positive(actor.mana);
  const startingMana=mana;
  let health=startingHealth;
  let shield=startingShield;
  let dealt=0;
  let autoCount=0;
  let attackStacks=0;
  const activeDebuffs:ActiveDebuff[]=[];

  const unmodelled:string[]=[];
  for(const [slot,ability] of Object.entries(actor.abilities) as [AbilitySlot,AbilityModel][]){
    if(!ability||disabled.has(slot))continue;
    for(const component of ability.damage)
      if(component.raw===null||!Number.isFinite(component.raw))
        unmodelled.push(...(component.unmodelled?.length
          ?component.unmodelled
          :[`No damage figure was available for ${ability.name}.`]));
  }
  let incomplete=unmodelled.length>0;
  const steps:TradeStep[]=[];
  const readyAt=new Map<AbilitySlot,number>();
  const used=new Set<AbilitySlot>();
  const maxActions=scenario.maxActions??200;

  while(clock<budget&&steps.length<maxActions&&health>0){
    const timedMultiplier=outgoingMultiplier(actor,clock);
    const targetNow=withDebuffs(target.resistances,activeDebuffs,clock);
    const candidate=scenario.autosOnly
      ?null
      :bestAbility(
        actor,targetNow,pen,clock,readyAt,mana,used,disabled,scenario,
        health,targetMaxHealth,autoCount,timedMultiplier,runtime,
      );

    if(candidate){
      mana-=positive(candidate.ability.cost);
      const applied=applyToPool(candidate.damage,shield,health);
      shield=applied.shield;health=applied.health;dealt+=applied.applied;
      if(candidate.incomplete)incomplete=true;

      const passiveRefund=reduceRechargeableAttackCooldownOnAbilityHit(
        actor.autoAttack,runtime,candidate.ability,clock,
      );
      const stackRule=candidate.ability.eventState?.stackRule;
      const stacksAfter=applyAbilityStackAfterCast(runtime,stackRule,clock);
      const cooldownBase=abilityCooldownSeconds(candidate.ability.cooldownSeconds,runtime,stackRule,clock);
      const selfShield=grantSelfShield(runtime,candidate.ability.eventState?.grantsSelfShield,clock);
      const reset=recordAttackTimerReset(runtime,candidate.ability.eventState?.resetsBasicAttackTimer);

      steps.push({
        atSeconds:round(clock),label:`${candidate.slot} ${candidate.ability.name}`,
        damage:round(applied.applied),
        state:[
          stackRule?`${stackRule.label} ${stacksAfter}/${stackRule.maxStacks}`:'',
          passiveRefund?`${passiveRefund.label} refund ${passiveRefund.reduction}s → ready ${passiveRefund.after}s`:'',
          selfShield>0&&candidate.ability.eventState?.grantsSelfShield?`self shield ${round(selfShield)}`:'',
          reset?'attack reset':''
        ].filter(Boolean).join(' · ')||undefined,
      });
      if(candidate.ability.targetDebuff)
        upsertDebuff(
          activeDebuffs,candidate.ability.targetDebuff,
          clock+candidate.ability.targetDebuff.durationSeconds,
        );
      readyAt.set(candidate.slot,clock+cooldownBase*haste);
      used.add(candidate.slot);
      clock+=Math.max(0,positive(candidate.ability.castTimeSeconds));
      continue;
    }

    if(scenario.abilitiesOnce&&!scenario.autosOnly)break;

    const timed=timedAutoSnapshot(actor.autoAttack.timedStates,clock);
    const resourceCost=timed.resourceCostOverride??positive(actor.autoAttack.resourceCost??0);
    if(resourceCost>mana+1e-9){
      unmodelled.push(`Basic attacks in this champion state cost ${round(resourceCost)} resource; only ${round(mana)} remained, so the damage race stopped rather than silently firing an unaffordable attack.`);
      incomplete=true;
      break;
    }

    const readyAttackSpeedMultiplier=rechargeableAttackSpeedMultiplier(actor.autoAttack,runtime,clock);
    const speed=currentAttackSpeed(
      actor.autoAttack,attackStacks,timed,readyAttackSpeedMultiplier,
    );
    const interval=attackInterval(speed);
    if(interval<=0)break;

    mana-=resourceCost;
    const nextAuto=autoCount+1;
    const replacementEffects=rechargeableAttackEffects(actor.autoAttack,runtime,clock);
    const components:DamageComponent[]=replacementEffects?.length
      ?replacementEffects.map(effect=>resolveOnHit(effect,health,targetMaxHealth))
      :[{
        label:'Auto attack',type:'PHYSICAL',
        raw:positive(actor.autoAttack.damage)*timed.basicAttackDamageMultiplier,
      }];
    for(const effect of [...(actor.autoAttack.onHits??[]),...timed.onHits]){
      if(!onHitTriggers(effect,nextAuto))continue;
      components.push(resolveOnHit(effect,health,targetMaxHealth));
    }
    for(const consumer of actor.autoAttack.eventState?.consumesMarks??[])
      if(consumeMark(runtime,consumer,clock))
        components.push(resolveOnHit(consumer.damage,health,targetMaxHealth));
    for(const proc of actor.autoAttack.autoProcs??[])
      if(autoProcTriggers(proc,nextAuto))
        components.push(resolveOnHit(proc.damage,health,targetMaxHealth));
    const stack=actor.autoAttack.attackStack;
    if(stack?.onHitAtMax&&attackStacks>=stack.maxStacks)
      components.push(resolveOnHit(stack.onHitAtMax,health,targetMaxHealth));

    const adjusted=applyDamageRules(
      components,actor.damageRules??[],health,targetMaxHealth,autoCount,timedMultiplier,
    );
    const result=mitigateAll(adjusted,targetNow,pen);
    const applied=applyToPool(result.mitigatedTotal,shield,health);
    shield=applied.shield;health=applied.health;dealt+=applied.applied;
    const passiveProc=replacementEffects?.length
      ?consumeRechargeableAttack(actor.autoAttack,runtime,clock)
      :null;
    autoCount=nextAuto;
    if(stack)attackStacks=Math.min(stack.maxStacks,attackStacks+1);
    steps.push({
      atSeconds:round(clock),
      label:passiveProc
        ?`${passiveProc.label}${components.length>1?` + ${components.length-1} effect${components.length===2?'':'s'}`:''}`
        :components.length>1?`Auto attack + ${components.length-1} effect${components.length===2?'':'s'}`:'Auto attack',
      damage:round(applied.applied),
      state:[
        ...timed.labels,
        passiveProc?`recharges until ${passiveProc.readyAt}s before refunds`:'',
        passiveProc&&readyAttackSpeedMultiplier!==1
          ?`${round((readyAttackSpeedMultiplier-1)*100)}% ready-state attack speed`:''
      ].filter(Boolean).join(' · ')||undefined,
    });
    clock+=interval;
  }

  return {
    champion:actor.champion,
    damageDealt:round(dealt),
    healthSharePercent:round(Math.min(100,dealt/startingPool*100)),
    manaUsed:round(startingMana-mana),manaLeft:round(mana),steps,incomplete,
    unmodelled:[...new Set(unmodelled)],
    selfShieldGenerated:currentSelfShield(runtime,clock),
    attackTimerResets:runtime.attackTimerResets,
  };
}

interface Candidate{
  slot:AbilitySlot;ability:AbilityModel;damage:number;incomplete:boolean;
}

function bestAbility(
  actor:TradeSide,targetResistances:TargetResistances,pen:Penetration,
  clock:number,readyAt:Map<AbilitySlot,number>,mana:number,
  used:Set<AbilitySlot>,disabled:Set<AbilitySlot>,scenario:TradeScenario,
  currentHealth:number,targetMaxHealth:number,autoCount:number,timedMultiplier:number,
  runtime:ReturnType<typeof createCombatRuntime>,
):Candidate|null{
  let best:Candidate|null=null;
  for(const [slot,ability] of Object.entries(actor.abilities) as [AbilitySlot,AbilityModel][]){
    if(!ability||disabled.has(slot))continue;
    if(scenario.abilitiesOnce&&used.has(slot))continue;
    if(clock<(readyAt.get(slot)??0)-1e-9)continue;
    if(positive(ability.cost)>mana+1e-9)continue;

    const abilityComponents=[
      ...ability.damage,
      ...(ability.dynamicDamage??[]).map(effect=>resolveOnHit(effect,currentHealth,targetMaxHealth)),
    ];
    // Candidate selection must not mutate marks. Include mark damage only when the
    // mark exists; consumption happens after the candidate is chosen.
    for(const consumer of ability.eventState?.consumesMarks??[]){
      const preview=createMarkPreview(runtime,consumer.markId,clock);
      if(preview)abilityComponents.push(resolveOnHit(consumer.damage,currentHealth,targetMaxHealth));
    }
    const stackMultiplier=abilityDamageMultiplier(runtime,ability.eventState?.stackRule,clock);
    const stateAdjusted=stackMultiplier===1
      ?abilityComponents
      :abilityComponents.map(component=>component.raw===null
        ?component
        :{...component,raw:round(component.raw*stackMultiplier)});
    const adjusted=applyDamageRules(
      stateAdjusted,actor.damageRules??[],currentHealth,targetMaxHealth,autoCount,timedMultiplier,
    );
    const result=mitigateAll(adjusted,targetResistances,pen);
    if(result.mitigatedTotal<=0)continue;
    if(!best||result.mitigatedTotal>best.damage)
      best={slot,ability,damage:result.mitigatedTotal,incomplete:!result.complete};
  }

  if(best){
    for(const consumer of best.ability.eventState?.consumesMarks??[])
      consumeMark(runtime,consumer,clock);
  }
  return best;
}

function createMarkPreview(
  runtime:ReturnType<typeof createCombatRuntime>,markId:string,clock:number,
):boolean{
  const state=runtime.marks.get(markId);
  return Boolean(state&&state.expiresAt>clock+1e-9&&state.stacks>0);
}

function withDebuffs(base:TargetResistances,active:ActiveDebuff[],clock:number):TargetResistances{
  const live=active.filter(d=>d.expiresAt>clock+1e-9);
  const armorKeep=live.reduce((m,d)=>m*(1-clamp01(d.effect.percentArmorReduction??0)),1);
  const mrKeep=live.reduce((m,d)=>m*(1-clamp01(d.effect.percentMagicResistReduction??0)),1);
  return {armor:round(base.armor*armorKeep),magicResist:round(base.magicResist*mrKeep)};
}

function upsertDebuff(active:ActiveDebuff[],effect:TargetDebuffEffect,expiresAt:number){
  const current=active.find(d=>d.effect.label===effect.label);
  if(current){current.effect=effect;current.expiresAt=expiresAt;return}
  active.push({effect,expiresAt});
}

function currentAttackSpeed(
  model:AutoAttackModel,stacks:number,timed:ReturnType<typeof timedAutoSnapshot>,
  readyStateMultiplier=1,
):number{
  const extra=model.attackStack?model.attackStack.attackSpeedPerStack*stacks:0;
  const cap=Number.isFinite(model.attackSpeedCap)&&Number(model.attackSpeedCap)>0
    ?Number(model.attackSpeedCap)
    :3;
  return Math.min(
    cap,
    Math.max(0,(model.attackSpeed+extra+timed.attackSpeedFlat)*timed.attackSpeedMultiplier*Math.max(0,readyStateMultiplier)),
  );
}

function outgoingMultiplier(actor:TradeSide,clock:number):number{
  const duration=Math.max(0,actor.outgoingDamageMultiplierDurationSeconds??0);
  if(duration<=0||clock>=duration)return 1;
  const value=actor.outgoingDamageMultiplier??1;
  return Number.isFinite(value)?Math.max(0,value):1;
}

function applyToPool(damage:number,shield:number,health:number){
  const incoming=Math.max(0,finiteOr(damage,0));
  const absorbed=Math.min(shield,incoming);
  const afterShield=incoming-absorbed;
  const hpDamage=Math.min(health,afterShield);
  return {
    shield:round(Math.max(0,shield-absorbed)),
    health:round(Math.max(0,health-hpDamage)),
    applied:round(absorbed+hpDamage),
  };
}

function buildOutcome(
  scenario:TradeScenario,you:TradeSideResult,them:TradeSideResult,
):TradeOutcome{
  const margin=round(you.healthSharePercent-them.healthSharePercent);
  const verdict:TradeVerdict=Math.abs(margin)<EVEN_TRADE_POINTS?'EVEN':margin>0?'YOU':'THEM';
  return {scenario,you,them,verdict,marginPoints:margin,
    explanation:explain(scenario,you,them,verdict,margin)};
}

function explain(
  scenario:TradeScenario,you:TradeSideResult,them:TradeSideResult,
  verdict:TradeVerdict,margin:number,
):string{
  const head=`${you.champion} removes ${you.healthSharePercent}% of their current effective pool, `+
    `${them.champion} removes ${them.healthSharePercent}% of yours`;
  const floor=you.incomplete||them.incomplete
    ?' Both figures are floors — a damage component could not be calculated.':'';
  if(verdict==='EVEN')return `${head} — within ${EVEN_TRADE_POINTS} points, so this trade comes down to who starts it.${floor}`;
  const winner=verdict==='YOU'?you.champion:them.champion;
  const lead=Math.abs(margin);
  if(scenario.key==='ONE_AUTO')return `${head}. ${winner} wins a single auto exchange by ${lead} points.${floor}`;
  return `${head}. ${winner} comes out ${lead} points ahead over ${scenario.budgetSeconds??'the full combo'}${scenario.budgetSeconds?'s':''}.${floor}`;
}

export const TREND_POINTS=12;
function findFlip(outcomes:TradeOutcome[]):string|null{
  const timed=outcomes.filter(o=>o.scenario.budgetSeconds!==null);
  for(let i=1;i<timed.length;i++){
    const before=timed[i-1],after=timed[i];
    if(before.verdict==='EVEN'||after.verdict==='EVEN'||before.verdict===after.verdict)continue;
    return before.verdict==='YOU'
      ?`You win the ${before.scenario.budgetSeconds}s trade and lose the ${after.scenario.budgetSeconds}s one. Commit hard and leave early — the longer you stand there the worse it gets.`
      :`You lose the ${before.scenario.budgetSeconds}s trade and win the ${after.scenario.budgetSeconds}s one. Survive the opening and the fight turns; do not disengage out of a trade you were about to win.`;
  }
  if(timed.length>=2){
    const first=timed[0],last=timed[timed.length-1];
    const drift=last.marginPoints-first.marginPoints;
    if(Math.abs(drift)>=TREND_POINTS)
      return drift<0
        ?`Your edge shrinks from ${signed(first.marginPoints)} to ${signed(last.marginPoints)} points as the fight runs on. The trade is front-loaded — take it and leave rather than settling in.`
        :`Your edge grows from ${signed(first.marginPoints)} to ${signed(last.marginPoints)} points as the fight runs on. Time is on your side, so the longer you can hold them there the better it gets.`;
  }
  return null;
}

const signed=(n:number)=>`${n>0?'+':''}${n}`;
const clamp01=(n:number)=>Math.min(1,Math.max(0,Number.isFinite(n)?n:0));
const finiteOr=(n:number|undefined,fallback:number)=>Number.isFinite(n)?n as number:fallback;
const positive=(n:number)=>Number.isFinite(n)&&n>0?n:0;
const round=(n:number)=>Math.round(n*10)/10;