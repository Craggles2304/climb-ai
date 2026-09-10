import {
  type DamageComponent,Penetration,TargetResistances,mitigateAll,noPenetration,
} from './damage';
import {
  AbilityModel,AbilitySlot,AutoAttackModel,attackInterval,hasteMultiplier,
  applyDamageRules,resolveOnHit,
} from './combos';
import type {DamageRule} from './effects';
import {ConfidenceReport,assessConfidence,combineConfidence} from './confidence';

/**
 * Trade scenarios: who wins a one-auto poke, a three-second trade, and a
 * ten-second fight, which are frequently three different answers.
 */
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
  /** Current health lets the Lab's HP slider affect trade outcomes as well. */
  currentHealth?:number;
  /** Temporary shields are consumed before current health. */
  shield?:number;
  resistances:TargetResistances;
  penetration?:Penetration;
  abilityHaste?:number;
  damageRules?:DamageRule[];
  /** Used when the opposing side has active Exhaust. */
  outgoingDamageMultiplier?:number;
  outgoingDamageMultiplierDurationSeconds?:number;
  disabled?:AbilitySlot[];
}

export interface TradeStep{atSeconds:number;label:string;damage:number}
export interface TradeSideResult{
  champion:string;
  damageDealt:number;
  healthSharePercent:number;
  manaUsed:number;
  manaLeft:number;
  steps:TradeStep[];
  incomplete:boolean;
  unmodelled:string[];
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

const MODEL_NOTE=
  'A damage race, not a fight: both sides stand still and commit, every ability '+
  'hits, nothing is interrupted and no crowd control exists. It assumes both '+
  'champions remain in range. Current HP and temporary shields are respected, '+
  'but movement, peel and crowd-control timing are not.';

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

/**
 * A deterministic damage race. Runes/on-hit effects use the target's remaining
 * health at each action, so Cut Down/Coup and current-health on-hits can switch
 * during the same trade rather than being frozen at the opening state.
 */
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

  let clock=0;
  let mana=positive(actor.mana);
  const startingMana=mana;
  let health=startingHealth;
  let shield=startingShield;
  let dealt=0;
  let autoCount=0;
  let attackStacks=0;

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
    const candidate=scenario.autosOnly
      ?null
      :bestAbility(
        actor,target,pen,clock,readyAt,mana,used,disabled,scenario,
        health,targetMaxHealth,autoCount,timedMultiplier,
      );

    if(candidate){
      mana-=positive(candidate.ability.cost);
      const applied=applyToPool(candidate.damage,shield,health);
      shield=applied.shield;health=applied.health;dealt+=applied.applied;
      if(candidate.incomplete)incomplete=true;
      steps.push({
        atSeconds:round(clock),label:`${candidate.slot} ${candidate.ability.name}`,
        damage:round(applied.applied),
      });
      readyAt.set(candidate.slot,clock+candidate.ability.cooldownSeconds*haste);
      used.add(candidate.slot);
      clock+=Math.max(0,positive(candidate.ability.castTimeSeconds));
      continue;
    }

    if(scenario.abilitiesOnce&&!scenario.autosOnly)break;

    const speed=currentAttackSpeed(actor.autoAttack,attackStacks);
    const interval=attackInterval(speed);
    if(interval<=0)break;

    const nextAuto=autoCount+1;
    const components:DamageComponent[]=[
      {label:'Auto attack',type:'PHYSICAL',raw:positive(actor.autoAttack.damage)},
    ];
    for(const effect of actor.autoAttack.onHits??[]){
      if(effect.everyNthAttack&&nextAuto%effect.everyNthAttack!==0)continue;
      components.push(resolveOnHit(effect,health,targetMaxHealth));
    }
    for(const proc of actor.autoAttack.autoProcs??[])
      if(proc.procAtAuto===nextAuto)
        components.push(resolveOnHit(proc.damage,health,targetMaxHealth));
    const stack=actor.autoAttack.attackStack;
    if(stack?.onHitAtMax&&attackStacks>=stack.maxStacks)
      components.push(resolveOnHit(stack.onHitAtMax,health,targetMaxHealth));

    const adjusted=applyDamageRules(
      components,actor.damageRules??[],health,targetMaxHealth,autoCount,timedMultiplier,
    );
    const result=mitigateAll(adjusted,target.resistances,pen);
    const applied=applyToPool(result.mitigatedTotal,shield,health);
    shield=applied.shield;health=applied.health;dealt+=applied.applied;
    autoCount=nextAuto;
    if(stack)attackStacks=Math.min(stack.maxStacks,attackStacks+1);
    steps.push({
      atSeconds:round(clock),
      label:components.length>1?`Auto attack + ${components.length-1} effect${components.length===2?'':'s'}`:'Auto attack',
      damage:round(applied.applied),
    });
    clock+=interval;
  }

  return {
    champion:actor.champion,
    damageDealt:round(dealt),
    healthSharePercent:round(Math.min(100,dealt/startingPool*100)),
    manaUsed:round(startingMana-mana),manaLeft:round(mana),steps,incomplete,
    unmodelled:[...new Set(unmodelled)],
  };
}

interface Candidate{
  slot:AbilitySlot;ability:AbilityModel;damage:number;incomplete:boolean;
}

function bestAbility(
  actor:TradeSide,target:TradeSide,pen:Penetration,
  clock:number,readyAt:Map<AbilitySlot,number>,mana:number,
  used:Set<AbilitySlot>,disabled:Set<AbilitySlot>,scenario:TradeScenario,
  currentHealth:number,targetMaxHealth:number,autoCount:number,timedMultiplier:number,
):Candidate|null{
  let best:Candidate|null=null;
  for(const [slot,ability] of Object.entries(actor.abilities) as [AbilitySlot,AbilityModel][]){
    if(!ability||disabled.has(slot))continue;
    if(scenario.abilitiesOnce&&used.has(slot))continue;
    if(clock<(readyAt.get(slot)??0)-1e-9)continue;
    if(positive(ability.cost)>mana+1e-9)continue;

    const adjusted=applyDamageRules(
      ability.damage,actor.damageRules??[],currentHealth,targetMaxHealth,autoCount,timedMultiplier,
    );
    const result=mitigateAll(adjusted,target.resistances,pen);
    if(result.mitigatedTotal<=0)continue;
    if(!best||result.mitigatedTotal>best.damage)
      best={slot,ability,damage:result.mitigatedTotal,incomplete:!result.complete};
  }
  return best;
}

function currentAttackSpeed(model:AutoAttackModel,stacks:number):number{
  const extra=model.attackStack?model.attackStack.attackSpeedPerStack*stacks:0;
  return Math.min(3,Math.max(0,model.attackSpeed+extra));
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

/* --------------------------------------------------------------- verdict -- */
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
const finiteOr=(n:number|undefined,fallback:number)=>Number.isFinite(n)?n as number:fallback;
const positive=(n:number)=>Number.isFinite(n)&&n>0?n:0;
const round=(n:number)=>Math.round(n*10)/10;
