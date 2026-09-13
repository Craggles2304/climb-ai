export const TFT_ROLL_SET=18;
export const TFT_ROLL_PATCH='18.2';
export const TFT_ROLL_AS_OF='2026-09-13';

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
  goldToRoll:number;
}

export interface TftRollEstimate{
  level:number;
  cost:TftCost;
  goal:TftStarGoal;
  goalCopies:number;
  copiesNeeded:number;
  shops:number;
  slots:number;
  goldToRoll:number;
  tierOdds:number;
  targetCopiesRemaining:number;
  sameCostPoolRemaining:number;
  chanceAtLeastOne:number;
  chanceFinish:number;
  expectedHits:number;
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

function hitDistribution(s:TftRollScenario,slots:number,maxTrack:number){
  const pool=basePool(s);
  const tierOdds=TFT_SHOP_ODDS[s.level]?.[s.cost]??0;
  const cap=Math.max(0,Math.min(maxTrack,pool.targetRemaining));
  let dist=new Array(cap+1).fill(0) as number[];
  dist[0]=1;

  for(let slot=0;slot<slots;slot++){
    const next=new Array(cap+1).fill(0) as number[];
    for(let hits=0;hits<=cap;hits++){
      const stateProb=dist[hits]||0;
      if(!stateProb)continue;
      const remainingTarget=Math.max(0,pool.targetRemaining-hits);
      const remainingTier=Math.max(1,pool.totalRemaining-hits);
      const p=clamp(tierOdds*(remainingTarget/remainingTier),0,1);
      if(hits===cap){next[hits]+=stateProb;continue;}
      next[hits]+=stateProb*(1-p);
      next[hits+1]+=stateProb*p;
    }
    dist=next;
  }
  return dist;
}

export function estimateRoll(input:TftRollScenario):TftRollEstimate{
  const level=int(input.level,1,11);
  const cost=int(input.cost,1,5) as TftCost;
  const goal=input.goal===3?3:2;
  const gold=Math.max(0,int(input.goldToRoll));
  const shops=Math.floor(gold/2);
  const slots=shops*5;
  const clean={...input,level,cost,goal,goldToRoll:gold};
  const pool=basePool(clean);
  const wanted=goalCopies(goal);
  const need=Math.max(0,wanted-pool.own);
  const maxTrack=Math.max(1,Math.min(pool.targetRemaining,Math.max(need,9)));
  const dist=hitDistribution(clean,slots,maxTrack);
  const chanceAtLeastOne=slots<=0?0:1-(dist[0]||0);
  const chanceFinish=need<=0?1:need>maxTrack?0:dist.slice(need).reduce((a,b)=>a+b,0);
  const expectedHits=dist.reduce((sum,p,h)=>sum+p*h,0);
  return{
    level,cost,goal,goalCopies:wanted,copiesNeeded:need,shops,slots,goldToRoll:gold,
    tierOdds:TFT_SHOP_ODDS[level]?.[cost]??0,
    targetCopiesRemaining:pool.targetRemaining,sameCostPoolRemaining:pool.totalRemaining,
    chanceAtLeastOne,chanceFinish,expectedHits,probabilityByHits:dist,
  };
}

export function goldForChance(input:Omit<TftRollScenario,'goldToRoll'>,targetChance:number,maxGold=120){
  const target=clamp(targetChance,0,1);
  if(goalCopies(input.goal)-Math.max(0,input.ownCopies)<=0)return 0;
  for(let gold=2;gold<=maxGold;gold+=2){
    if(estimateRoll({...input,goldToRoll:gold}).chanceFinish>=target)return gold;
  }
  return null;
}

export interface TftStrategyCompareInput extends Omit<TftRollScenario,'goldToRoll'>{
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
  const rollNow=estimateRoll({...base,goldToRoll:rollNowBudget});
  if(input.level>=10){return{rollNow,levelFirst:null,levelCost:null,rollNowBudget,levelFirstBudget:null,verdict:'NO_LEVEL_OPTION',delta:0,note:'No standard level-up comparison is available from level 10.'};}
  const levelCost=levelXpCost(input.xpToNext);
  const levelFirstBudget=Math.max(0,gold-levelCost-reserve);
  const levelFirst=estimateRoll({...base,level:input.level+1,goldToRoll:levelFirstBudget});
  const delta=levelFirst.chanceFinish-rollNow.chanceFinish;
  let verdict:TftStrategyComparison['verdict']='CLOSE';
  if(delta>=.08)verdict='LEVEL_FIRST_EDGE';
  else if(delta<=-.08)verdict='ROLL_NOW_EDGE';
  const note=verdict==='LEVEL_FIRST_EDGE'
    ?`After paying ${levelCost}g for XP, the next level still produces a meaningfully higher finish probability with the remaining roll budget.`
    :verdict==='ROLL_NOW_EDGE'
      ?'The current level gives a meaningfully higher finish probability once the XP cost is included.'
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
