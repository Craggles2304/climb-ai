import {
  Penetration,TargetResistances,mitigateAll,noPenetration,
} from './damage';
import {AbilityModel,AbilitySlot,attackInterval,hasteMultiplier} from './combos';
import {ConfidenceReport,assessConfidence,combineConfidence} from './confidence';

/**
 * Trade scenarios: who wins a one-auto poke, a three-second trade, and a
 * ten-second fight, which are frequently three different answers.
 *
 * This is the question that changes how a lane is played. A champion with
 * front-loaded ability damage wins short trades and loses long ones; a champion
 * living off auto-attacks is the reverse. "Who wins the fight" collapses both
 * into one number and loses the part worth knowing.
 *
 * THE MODEL, STATED PLAINLY
 * Each side is given a time budget and spends it greedily: cast the hardest
 * available ability whose cost it can pay, otherwise attack. Both sides are
 * computed against the other's resistances and the totals are compared as a
 * share of the opponent's health, because 400 damage means something different
 * to a 1,200-health target than to a 2,400-health one.
 *
 * WHAT IT LEAVES OUT, AND THEREFORE WHAT IT IS FOR
 * Nobody moves, everything hits, nothing is interrupted, and no crowd control
 * exists. So this is a damage race rather than a fight. It answers "if we both
 * stand here and commit for N seconds, who comes out ahead" — which is a real
 * and useful question, and is not the same as "who wins the lane".
 *
 * An action is allowed to start if the clock is still inside the budget, so an
 * ability cast at 2.9 seconds counts in a three-second trade. It lands.
 */

export interface TradeScenario{
  key:string;
  label:string;
  /** Seconds of commitment. Null means "every ability once, however long". */
  budgetSeconds:number|null;
  /** Each damaging ability at most once. */
  abilitiesOnce?:boolean;
  /** No abilities at all. */
  autosOnly?:boolean;
  /** Hard cap on actions, for the single-auto case. */
  maxActions?:number;
}

export const TRADE_SCENARIOS:TradeScenario[]=[
  {key:'ONE_AUTO',label:'One auto',budgetSeconds:null,autosOnly:true,maxActions:1},
  {key:'SHORT_3S',label:'Short trade (3s)',budgetSeconds:3},
  {key:'MEDIUM_5S',label:'Trade (5s)',budgetSeconds:5},
  {key:'EXTENDED_10S',label:'Extended fight (10s)',budgetSeconds:10},
  {key:'FULL_COMBO',label:'Full combo',budgetSeconds:null,abilitiesOnce:true},
];

/** Below this difference in health share, the trade is called even. */
export const EVEN_TRADE_POINTS=4;

export interface TradeSide{
  champion:string;
  abilities:Partial<Record<AbilitySlot,AbilityModel>>;
  autoAttack:{damage:number;attackSpeed:number};
  mana:number;
  maxHealth:number;
  resistances:TargetResistances;
  penetration?:Penetration;
  abilityHaste?:number;
  /** Slots treated as unavailable — a missed ability, or one on cooldown. */
  disabled?:AbilitySlot[];
}

export interface TradeStep{
  atSeconds:number;
  label:string;
  damage:number;
}

export interface TradeSideResult{
  champion:string;
  damageDealt:number;
  /** Damage as a share of the opponent's maximum health, 0-100. */
  healthSharePercent:number;
  manaUsed:number;
  manaLeft:number;
  steps:TradeStep[];
  /** True when a damage figure was missing, so the total is a floor. */
  incomplete:boolean;
  /** Why, when it is. */
  unmodelled:string[];
}

export type TradeVerdict='YOU'|'THEM'|'EVEN';

export interface TradeOutcome{
  scenario:TradeScenario;
  you:TradeSideResult;
  them:TradeSideResult;
  verdict:TradeVerdict;
  /** Percentage points of health share separating the two. */
  marginPoints:number;
  explanation:string;
}

export interface TradeReport{
  outcomes:TradeOutcome[];
  /** The sentence worth reading: where the answer changes with duration. */
  flip:string|null;
  modelNote:string;
  confidence:ConfidenceReport;
}

const MODEL_NOTE=
  'A damage race, not a fight: both sides stand still and commit, every ability '+
  'hits, nothing is interrupted and no crowd control exists. It also assumes '+
  'both champions are in range of each other the whole time, which is a large '+
  'assumption across a big range gap — a melee champion losing this race may '+
  'simply never get to start it. It answers "if we both commit for this long, '+
  'who comes out ahead", which is not the same question as who wins the lane.';

export function compareTrades(
  you:TradeSide,them:TradeSide,scenarios=TRADE_SCENARIOS,
):TradeReport{
  const outcomes=scenarios.map(scenario=>{
    const yours=runTrade(you,them,scenario);
    const theirs=runTrade(them,you,scenario);
    return buildOutcome(scenario,yours,theirs);
  });

  return {
    outcomes,
    flip:findFlip(outcomes),
    modelNote:MODEL_NOTE,
    confidence:combineConfidence(outcomes.map(o=>assessConfidence({
      approximations:[MODEL_NOTE],
      unmodelled:[...o.you.unmodelled,...o.them.unmodelled],
    }))),
  };
}

/**
 * One side's output over a budget.
 *
 * Greedy by damage rather than by any rotation a player would actually use.
 * That is deliberate: it asks what the champion is capable of in the window
 * rather than guessing at a combo, and it is the same rule for both sides so
 * the comparison stays fair.
 */
export function runTrade(
  actor:TradeSide,target:TradeSide,scenario:TradeScenario,
):TradeSideResult{
  const haste=hasteMultiplier(actor.abilityHaste??0);
  const pen=actor.penetration??noPenetration();
  const interval=attackInterval(actor.autoAttack.attackSpeed);
  const budget=scenario.budgetSeconds??Infinity;
  const disabled=new Set(actor.disabled??[]);

  let clock=0;
  let mana=positive(actor.mana);
  const startingMana=mana;
  let dealt=0;
  // bestAbility skips anything dealing zero, which includes an ability whose
  // damage could not be calculated. Left to the loop, that omission would be
  // invisible: the ability is simply never cast and nothing reports why.
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

  const autoDamage=()=>{
    const result=mitigateAll(
      [{label:'Auto attack',type:'PHYSICAL',raw:positive(actor.autoAttack.damage)}],
      target.resistances,pen);
    return result.mitigatedTotal;
  };

  while(clock<budget&&steps.length<maxActions){
    const candidate=scenario.autosOnly
      ?null
      :bestAbility(actor,target,pen,clock,readyAt,mana,used,disabled,scenario);

    if(candidate){
      mana-=positive(candidate.ability.cost);
      dealt+=candidate.damage;
      if(candidate.incomplete)incomplete=true;
      steps.push({
        atSeconds:round(clock),
        label:`${candidate.slot} ${candidate.ability.name}`,
        damage:round(candidate.damage),
      });
      readyAt.set(candidate.slot,clock+candidate.ability.cooldownSeconds*haste);
      used.add(candidate.slot);
      clock+=Math.max(0,positive(candidate.ability.castTimeSeconds));
      continue;
    }

    // Nothing left to cast: in a full-combo scenario that ends the sequence,
    // otherwise fall back to attacking.
    if(scenario.abilitiesOnce&&!scenario.autosOnly)break;
    if(interval<=0)break;

    const damage=autoDamage();
    dealt+=damage;
    steps.push({atSeconds:round(clock),label:'Auto attack',damage:round(damage)});
    clock+=interval;
  }

  const maxHealth=Math.max(1,positive(target.maxHealth));
  return {
    champion:actor.champion,
    damageDealt:round(dealt),
    healthSharePercent:round(Math.min(100,dealt/maxHealth*100)),
    manaUsed:round(startingMana-mana),
    manaLeft:round(mana),
    steps,
    incomplete,
    unmodelled:[...new Set(unmodelled)],
  };
}

interface Candidate{
  slot:AbilitySlot;
  ability:AbilityModel;
  damage:number;
  incomplete:boolean;
}

function bestAbility(
  actor:TradeSide,target:TradeSide,pen:Penetration,
  clock:number,readyAt:Map<AbilitySlot,number>,mana:number,
  used:Set<AbilitySlot>,disabled:Set<AbilitySlot>,scenario:TradeScenario,
):Candidate|null{
  let best:Candidate|null=null;

  for(const [slot,ability] of Object.entries(actor.abilities) as [AbilitySlot,AbilityModel][]){
    if(!ability||disabled.has(slot))continue;
    if(scenario.abilitiesOnce&&used.has(slot))continue;
    if(clock<(readyAt.get(slot)??0)-1e-9)continue;
    if(positive(ability.cost)>mana+1e-9)continue;

    const result=mitigateAll(ability.damage,target.resistances,pen);
    if(result.mitigatedTotal<=0)continue;

    if(!best||result.mitigatedTotal>best.damage)
      best={slot,ability,damage:result.mitigatedTotal,incomplete:!result.complete};
  }

  return best;
}

/* --------------------------------------------------------------- verdict -- */

function buildOutcome(
  scenario:TradeScenario,you:TradeSideResult,them:TradeSideResult,
):TradeOutcome{
  const margin=round(you.healthSharePercent-them.healthSharePercent);
  const verdict:TradeVerdict=
    Math.abs(margin)<EVEN_TRADE_POINTS?'EVEN':margin>0?'YOU':'THEM';

  return {scenario,you,them,verdict,marginPoints:margin,
    explanation:explain(scenario,you,them,verdict,margin)};
}

function explain(
  scenario:TradeScenario,you:TradeSideResult,them:TradeSideResult,
  verdict:TradeVerdict,margin:number,
):string{
  const head=`${you.champion} takes ${you.healthSharePercent}% of their health, `+
    `${them.champion} takes ${them.healthSharePercent}% of yours`;

  const floor=you.incomplete||them.incomplete
    ?' Both figures are floors — a damage component could not be calculated.'
    :'';

  if(verdict==='EVEN')
    return `${head} — within ${EVEN_TRADE_POINTS} points, so this trade comes down to who starts it.${floor}`;

  const winner=verdict==='YOU'?you.champion:them.champion;
  const lead=Math.abs(margin);

  if(scenario.key==='ONE_AUTO')
    return `${head}. ${winner} wins a single auto exchange by ${lead} points.${floor}`;

  return `${head}. ${winner} comes out ${lead} points ahead over ${scenario.budgetSeconds??'the full combo'}${scenario.budgetSeconds?'s':''}.${floor}`;
}

/** A margin moving by at least this much counts as a real trend. */
export const TREND_POINTS=12;

/**
 * The actionable sentence. A champion who wins short and loses long has a
 * completely different lane plan from one that does the reverse, and that is
 * invisible in any single scenario.
 *
 * A sign change is the clearest case but not the only one worth saying. An
 * advantage that decays from +38 to +4 without ever crossing zero is the same
 * lesson — commit early, leave early — and reporting nothing there missed the
 * most useful thing on the page.
 */
function findFlip(outcomes:TradeOutcome[]):string|null{
  const timed=outcomes.filter(o=>o.scenario.budgetSeconds!==null);
  for(let i=1;i<timed.length;i++){
    const before=timed[i-1];
    const after=timed[i];
    if(before.verdict==='EVEN'||after.verdict==='EVEN')continue;
    if(before.verdict===after.verdict)continue;

    const youFirst=before.verdict==='YOU';
    return youFirst
      ?`You win the ${before.scenario.budgetSeconds}s trade and lose the ${after.scenario.budgetSeconds}s one. Commit hard and leave early — the longer you stand there the worse it gets.`
      :`You lose the ${before.scenario.budgetSeconds}s trade and win the ${after.scenario.budgetSeconds}s one. Survive the opening and the fight turns; do not disengage out of a trade you were about to win.`;
  }

  // No sign change, but a margin that moves a long way says the same thing.
  if(timed.length>=2){
    const first=timed[0];
    const last=timed[timed.length-1];
    const drift=last.marginPoints-first.marginPoints;
    if(Math.abs(drift)>=TREND_POINTS){
      return drift<0
        ?`Your edge shrinks from ${signed(first.marginPoints)} to ${signed(last.marginPoints)} points as the fight runs on. The trade is front-loaded — take it and leave rather than settling in.`
        :`Your edge grows from ${signed(first.marginPoints)} to ${signed(last.marginPoints)} points as the fight runs on. Time is on your side, so the longer you can hold them there the better it gets.`;
    }
  }
  return null;
}

const signed=(n:number)=>`${n>0?'+':''}${n}`;

const positive=(n:number)=>Number.isFinite(n)&&n>0?n:0;
const round=(n:number)=>Math.round(n*10)/10;
