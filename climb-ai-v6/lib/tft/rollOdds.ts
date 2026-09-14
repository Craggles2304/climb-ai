export const TFT_ROLL_SET=18;
export const TFT_ROLL_PATCH='18.2';
export const TFT_ROLL_AS_OF='2026-09-14';

export type TftCost=1|2|3|4|5;
export type TftStarGoal=2|3;

export const TFT_SHOP_ODDS:Record<number,Record<TftCost,number>>={
  1:{1:1,2:0,3:0,4:0,5:0},
  2:{1:1,2:0,3:0,4:0,5:0},
  3:{1:.75,2:.25,3:0,4:0,5:0},
  4:{1:.55,2:.30,3:.15,4:0,5:0},
  5:{1:.45,2:.33,3:.20,4:.02,5:0},
  6:{1:.30,2:.40,3:.25,4:.05,5:0},
  7:{1:.16,2:.30,3:.43,4:.10,5:.01},
  8:{1:.15,2:.20,3:.32,4:.30,5:.03},
  9:{1:.10,2:.17,3:.25,4:.33,5:.15},
  10:{1:.05,2:.10,3:.20,4:.40,5:.25},
  11:{1:.01,2:.02,3:.12,4:.50,5:.35},
};

export const TFT_BAG_SIZE:Record<TftCost,number>={1:30,2:25,3:18,4:10,5:9};
export const TFT_UNIQUE_BY_COST:Record<TftCost,number>={1:14,2:13,3:14,4:14,5:10};
export const TFT_XP_TO_NEXT:Partial<Record<number,number>>={1:2,2:2,3:6,4:10,5:20,6:36,7:56,8:64,9:64};

export interface TftRollScenario{
  level:number;
  cost:TftCost;
  goal:TftStarGoal;
  ownCopies:number;
  contestedCopies:number;
  otherSameCostCopiesOut:number;
  goldBudget:number;
}

export interface TftRollEstimate{
  level:number;
  cost:TftCost;
  goal:TftStarGoal;
  goalCopies:number;
  copiesNeeded:number;
  maxPaidRefreshes:number;
  goldBudget:number;
  tierOdds:number;
  targetCopiesRemaining:number;
  sameCostPoolRemaining:number;
  chanceAtLeastOne:number;
  chanceFinish:number;
  expectedHits:number;
  expectedGoldSpent:number;
  probabilityByHits:number[];
}

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:min));
const int=(n:number,min=0,max=999)=>Math.floor(clamp(n,min,max));
export const goalCopies=(goal:TftStarGoal)=>goal===2?3:9;
export const levelXpCost=(xpRemaining:number)=>Math.ceil(Math.max(0,xpRemaining)/4)*4;

function basePool(s:TftRollScenario){
  const perUnit=TFT_BAG_SIZE[s.cost];
  const total=perUnit*TFT_UNIQUE_BY_COST[s.cost];
  const own=int(s.ownCopies,0,perUnit);
  const contested=int(s.contestedCopies,0,Math.max(0,perUnit-own));
  const other=int(s.otherSameCostCopiesOut,0,Math.max(0,total-own-contested));
  return{
    own,
    contested,
    targetRemaining:Math.max(0,perUnit-own-contested),
    totalRemaining:Math.max(1,total-own-contested-other),
  };
}

interface BudgetState{hits:number;gold:number;prob:number;}

function mergeStates(states:BudgetState[]){
  const merged=new Map<string,BudgetState>();
  for(const state of states){
    if(state.prob<=0)continue;
    const key=`${state.hits}:${state.gold}`;
    const existing=merged.get(key);
    if(existing)existing.prob+=state.prob;
    else merged.set(key,{...state});
  }
  return [...merged.values()];
}

function simulateBudget(s:TftRollScenario){
  const pool=basePool(s);
  const tierOdds=TFT_SHOP_ODDS[s.level]?.[s.cost]??0;
  const wanted=goalCopies(s.goal);
  const need=Math.max(0,wanted-pool.own);
  const hitCap=Math.max(1,Math.min(pool.targetRemaining,need||1));
  const budget=Math.max(0,int(s.goldBudget,0,500));
  let active:BudgetState[]=[{hits:0,gold:budget,prob:1}];
  const terminal:BudgetState[]=[];
  const maxRefreshes=Math.floor(budget/2);

  for(let refresh=0;refresh<maxRefreshes;refresh++){
    const shopStates:BudgetState[]=[];
    for(const state of active){
      if(state.hits>=hitCap||state.gold<2){terminal.push(state);continue;}
      shopStates.push({...state,gold:state.gold-2});
    }
    if(shopStates.length===0){active=[];break;}

    let slotStates=shopStates;
    for(let slot=0;slot<5;slot++){
      const next:BudgetState[]=[];
      for(const state of slotStates){
        if(state.hits>=hitCap){next.push(state);continue;}
        const remainingTarget=Math.max(0,pool.targetRemaining-state.hits);
        const remainingTier=Math.max(1,pool.totalRemaining-state.hits);
        const p=clamp(tierOdds*(remainingTarget/remainingTier),0,1);
        if(p<=0){next.push(state);continue;}
        next.push({...state,prob:state.prob*(1-p)});
        if(state.gold>=s.cost){
          next.push({hits:state.hits+1,gold:state.gold-s.cost,prob:state.prob*p});
        }else{
          // A target can appear but cannot be purchased with the remaining budget.
          next.push({...state,prob:state.prob*p});
        }
      }
      slotStates=mergeStates(next);
    }
    active=slotStates;
  }

  terminal.push(...active);
  const final=mergeStates(terminal);
  const dist=new Array(hitCap+1).fill(0) as number[];
  let expectedSpent=0;
  for(const state of final){
    dist[Math.min(hitCap,state.hits)]+=state.prob;
    expectedSpent+=state.prob*(budget-state.gold);
  }
  const totalProb=dist.reduce((a,b)=>a+b,0)||1;
  for(let i=0;i<dist.length;i++)dist[i]/=totalProb;
  expectedSpent/=totalProb;
  return{dist,pool,need,hitCap,budget,tierOdds,maxRefreshes,expectedSpent};
}

export function estimateRoll(input:TftRollScenario):TftRollEstimate{
  const level=int(input.level,1,11);
  const cost=int(input.cost,1,5) as TftCost;
  const goal=input.goal===3?3:2;
  const clean={...input,level,cost,goal,goldBudget:Math.max(0,int(input.goldBudget,0,500))};
  const sim=simulateBudget(clean);
  const wanted=goalCopies(goal);
  const chanceAtLeastOne=sim.need<=0?1:1-(sim.dist[0]||0);
  const chanceFinish=sim.need<=0?1:sim.need>sim.hitCap?0:sim.dist.slice(sim.need).reduce((a,b)=>a+b,0);
  const expectedHits=sim.dist.reduce((sum,p,h)=>sum+p*h,0);
  return{
    level,cost,goal,goalCopies:wanted,copiesNeeded:sim.need,maxPaidRefreshes:sim.maxRefreshes,goldBudget:sim.budget,
    tierOdds:sim.tierOdds,targetCopiesRemaining:sim.pool.targetRemaining,sameCostPoolRemaining:sim.pool.totalRemaining,
    chanceAtLeastOne,chanceFinish,expectedHits,expectedGoldSpent:sim.expectedSpent,probabilityByHits:sim.dist,
  };
}

export function goldForChance(input:Omit<TftRollScenario,'goldBudget'>,targetChance:number,maxGold=160){
  const target=clamp(targetChance,0,1);
  if(goalCopies(input.goal)-Math.max(0,input.ownCopies)<=0)return 0;
  for(let gold=2;gold<=maxGold;gold+=2){
    if(estimateRoll({...input,goldBudget:gold}).chanceFinish>=target)return gold;
  }
  return null;
}

export interface TftStrategyCompareInput extends Omit<TftRollScenario,'goldBudget'>{
  currentGold:number;
  reserveGold:number;
  xpToNext:number;
}

export interface TftStrategyComparison{
  rollNow:TftRollEstimate;
  levelFirst:TftRollEstimate|null;
  levelCost:number|null;
  rollNowBudget:number;
  levelFirstBudget:number|null;
  verdict:'ROLL_NOW_EDGE'|'LEVEL_FIRST_EDGE'|'CLOSE'|'NO_LEVEL_OPTION';
  delta:number;
  note:string;
}

export function compareRollVsLevel(input:TftStrategyCompareInput):TftStrategyComparison{
  const reserve=Math.max(0,int(input.reserveGold));
  const gold=Math.max(0,int(input.currentGold));
  const rollNowBudget=Math.max(0,gold-reserve);
  const base={level:input.level,cost:input.cost,goal:input.goal,ownCopies:input.ownCopies,contestedCopies:input.contestedCopies,otherSameCostCopiesOut:input.otherSameCostCopiesOut};
  const rollNow=estimateRoll({...base,goldBudget:rollNowBudget});
  if(input.level>=10){return{rollNow,levelFirst:null,levelCost:null,rollNowBudget,levelFirstBudget:null,verdict:'NO_LEVEL_OPTION',delta:0,note:'No standard level-up comparison is available from level 10.'};}
  const levelCost=levelXpCost(input.xpToNext);
  const levelFirstBudget=Math.max(0,gold-levelCost-reserve);
  const levelFirst=estimateRoll({...base,level:input.level+1,goldBudget:levelFirstBudget});
  const delta=levelFirst.chanceFinish-rollNow.chanceFinish;
  let verdict:TftStrategyComparison['verdict']='CLOSE';
  if(delta>=.08)verdict='LEVEL_FIRST_EDGE';
  else if(delta<=-.08)verdict='ROLL_NOW_EDGE';
  const note=verdict==='LEVEL_FIRST_EDGE'
    ?`After paying ${levelCost}g for XP, the next level still produces a meaningfully higher finish probability with the remaining total spend budget.`
    :verdict==='ROLL_NOW_EDGE'
      ?'The current level gives a meaningfully higher finish probability once XP and target purchase costs are included.'
      :'The two lines are within 8 percentage points; board strength, HP and tempo matter more than the raw shop edge.';
  return{rollNow,levelFirst,levelCost,rollNowBudget,levelFirstBudget,verdict,delta,note};
}

export function practicalOddsRows(cost:TftCost){
  return [4,5,6,7,8,9,10].map(level=>({level,odds:TFT_SHOP_ODDS[level][cost]}));
}

export function poolPressureLabel(cost:TftCost,own:number,contested:number){
  const size=TFT_BAG_SIZE[cost];
  const removed=Math.max(0,own)+Math.max(0,contested);
  const left=Math.max(0,size-removed);
  const ratio=left/size;
  if(left===0)return'EXHAUSTED';
  if(ratio<=.25)return'EXTREME';
  if(ratio<=.5)return'HEAVY';
  if(ratio<=.75)return'MODERATE';
  return'LIGHT';
}
