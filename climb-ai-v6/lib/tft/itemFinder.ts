import {TFT_CARRY_PROFILES,metaStrengthScore,type TftCarryItemBuild,type TftCarryProfile} from './carryBuilder';

export const TFT_COMPONENTS=['B.F. Sword','Recurve Bow','Needlessly Large Rod','Tear of the Goddess','Chain Vest','Negatron Cloak',"Giant's Belt",'Sparring Gloves'] as const;
export type TftComponent=typeof TFT_COMPONENTS[number];
export type ComponentBag=Partial<Record<TftComponent,number>>;
export type ItemFitState='OWNED'|'CRAFT NOW'|'PARTIAL'|'MISSING';

export const TFT_ITEM_RECIPES:Record<string,[TftComponent,TftComponent]>={
  'Deathblade':['B.F. Sword','B.F. Sword'],
  'Giant Slayer':['B.F. Sword','Recurve Bow'],
  'Hextech Gunblade':['B.F. Sword','Needlessly Large Rod'],
  'Spear of Shojin':['B.F. Sword','Tear of the Goddess'],
  'Edge of Night':['B.F. Sword','Chain Vest'],
  'Bloodthirster':['B.F. Sword','Negatron Cloak'],
  "Sterak's Gage":['B.F. Sword',"Giant's Belt"],
  'Infinity Edge':['B.F. Sword','Sparring Gloves'],
  'Red Buff':['Recurve Bow','Recurve Bow'],
  "Guinsoo's Rageblade":['Recurve Bow','Needlessly Large Rod'],
  'Void Staff':['Recurve Bow','Tear of the Goddess'],
  "Titan's Resolve":['Recurve Bow','Chain Vest'],
  "Kraken's Fury":['Recurve Bow','Negatron Cloak'],
  "Nashor's Tooth":['Recurve Bow',"Giant's Belt"],
  'Last Whisper':['Recurve Bow','Sparring Gloves'],
  "Rabadon's Deathcap":['Needlessly Large Rod','Needlessly Large Rod'],
  "Archangel's Staff":['Needlessly Large Rod','Tear of the Goddess'],
  'Crownguard':['Needlessly Large Rod','Chain Vest'],
  'Ionic Spark':['Needlessly Large Rod','Negatron Cloak'],
  'Morellonomicon':['Needlessly Large Rod',"Giant's Belt"],
  'Jeweled Gauntlet':['Needlessly Large Rod','Sparring Gloves'],
  'Blue Buff':['Tear of the Goddess','Tear of the Goddess'],
  "Protector's Vow":['Tear of the Goddess','Chain Vest'],
  'Adaptive Helm':['Tear of the Goddess','Negatron Cloak'],
  'Redemption':['Tear of the Goddess',"Giant's Belt"],
  'Hand of Justice':['Tear of the Goddess','Sparring Gloves'],
  'Bramble Vest':['Chain Vest','Chain Vest'],
  'Gargoyle Stoneplate':['Chain Vest','Negatron Cloak'],
  'Sunfire Cape':['Chain Vest',"Giant's Belt"],
  'Steadfast Heart':['Chain Vest','Sparring Gloves'],
  "Dragon's Claw":['Negatron Cloak','Negatron Cloak'],
  'Evenshroud':['Negatron Cloak',"Giant's Belt"],
  'Quicksilver':['Negatron Cloak','Sparring Gloves'],
  "Warmog's Armor":["Giant's Belt","Giant's Belt"],
  "Striker's Flail":["Giant's Belt",'Sparring Gloves'],
  "Thief's Gloves":['Sparring Gloves','Sparring Gloves'],
};

export interface CarryFitResult{
  profile:TftCarryProfile;
  build:TftCarryItemBuild;
  score:number;
  itemStates:Array<{item:string;state:ItemFitState}>;
  craftable:string[];
  owned:string[];
  partial:string[];
  missing:string[];
  reason:string;
}

const norm=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');

function bagCopy(bag:ComponentBag|Record<string,number>){
  const next:Record<string,number>={};
  for(const component of TFT_COMPONENTS)next[component]=Math.max(0,Number(bag[component]||0));
  return next;
}

function canConsume(recipe:[TftComponent,TftComponent],bag:Record<string,number>){
  const [a,b]=recipe;
  if(a===b)return (bag[a]||0)>=2;
  return (bag[a]||0)>=1&&(bag[b]||0)>=1;
}

function consume(recipe:[TftComponent,TftComponent],bag:Record<string,number>){
  bag[recipe[0]]=(bag[recipe[0]]||0)-1;
  bag[recipe[1]]=(bag[recipe[1]]||0)-1;
}

function partialRecipeScore(recipe:[TftComponent,TftComponent],bag:Record<string,number>){
  const [a,b]=recipe;
  if(a===b)return Math.min(2,bag[a]||0);
  return Math.min(1,bag[a]||0)+Math.min(1,bag[b]||0);
}

function permutations(values:number[]):number[][]{
  if(values.length<=1)return[values];
  const out:number[][]=[];
  values.forEach((value,index)=>{
    const rest=[...values.slice(0,index),...values.slice(index+1)];
    for(const tail of permutations(rest))out.push([value,...tail]);
  });
  return out;
}

function optimalCraftPlan(items:string[],components:ComponentBag,ownedIndexes:Set<number>){
  const craftIndexes=items.map((_,index)=>index).filter(index=>!ownedIndexes.has(index));
  const orders=permutations(craftIndexes);
  let best={crafted:new Set<number>(),bag:bagCopy(components),partialValue:-1};

  for(const order of orders.length?orders:[[]]){
    const bag=bagCopy(components);
    const crafted=new Set<number>();
    for(const index of order){
      const recipe=TFT_ITEM_RECIPES[items[index]];
      if(recipe&&canConsume(recipe,bag)){consume(recipe,bag);crafted.add(index);}
    }
    let partialValue=0;
    for(const index of craftIndexes){
      if(crafted.has(index))continue;
      const recipe=TFT_ITEM_RECIPES[items[index]];
      if(recipe)partialValue+=partialRecipeScore(recipe,bag);
    }
    if(crafted.size>best.crafted.size||(crafted.size===best.crafted.size&&partialValue>best.partialValue))best={crafted,bag,partialValue};
  }
  return best;
}

export function rankCarryFits(components:ComponentBag,completedItems:string[]=[]):CarryFitResult[]{
  const completedCounts=new Map<string,number>();
  for(const item of completedItems)completedCounts.set(norm(item),(completedCounts.get(norm(item))||0)+1);
  const results:CarryFitResult[]=[];

  for(const profile of TFT_CARRY_PROFILES){
    for(const build of profile.builds){
      const remainingCompleted=new Map(completedCounts);
      const ownedIndexes=new Set<number>();
      build.items.forEach((item,index)=>{
        const key=norm(item);
        const count=remainingCompleted.get(key)||0;
        if(count>0){ownedIndexes.add(index);remainingCompleted.set(key,count-1);}
      });

      const plan=optimalCraftPlan(build.items,components,ownedIndexes);
      const itemStates=build.items.map((item,index):{item:string;state:ItemFitState}=>{
        if(ownedIndexes.has(index))return{item,state:'OWNED'};
        if(plan.crafted.has(index))return{item,state:'CRAFT NOW'};
        const recipe=TFT_ITEM_RECIPES[item];
        if(recipe&&partialRecipeScore(recipe,plan.bag)>0)return{item,state:'PARTIAL'};
        return{item,state:'MISSING'};
      });

      const owned=itemStates.filter(x=>x.state==='OWNED').map(x=>x.item);
      const craftable=itemStates.filter(x=>x.state==='CRAFT NOW').map(x=>x.item);
      const partial=itemStates.filter(x=>x.state==='PARTIAL').map(x=>x.item);
      const missing=itemStates.filter(x=>x.state==='MISSING').map(x=>x.item);
      let score=Math.round(metaStrengthScore(profile)*0.22)+owned.length*34+craftable.length*26;
      for(const state of itemStates){
        if(state.state!=='PARTIAL')continue;
        const recipe=TFT_ITEM_RECIPES[state.item];
        if(recipe)score+=partialRecipeScore(recipe,plan.bag)*6;
      }
      if(build.kind==='META')score+=15;
      if(build.kind==='ALTERNATIVE')score+=7;
      if(build.kind==='FUN')score-=10;

      const matched=owned.length+craftable.length;
      const reason=matched>=3?'Your current bag already completes this entire carry package.':matched===2?'Two of the three target items are already owned or immediately craftable.':matched===1?'One target item is ready now; the rest remain flexible.':partial.length?'Your components lean toward this line, but you should avoid hard-forcing it yet.':'Low natural item fit from the current bag.';
      results.push({profile,build,score,itemStates,craftable,owned,partial,missing,reason});
    }
  }
  return results.sort((a,b)=>b.score-a.score||metaStrengthScore(b.profile)-metaStrengthScore(a.profile));
}

export function topCarryDirections(components:ComponentBag,completedItems:string[]=[]){
  const ranked=rankCarryFits(components,completedItems);
  const seen=new Set<string>();
  const unique:CarryFitResult[]=[];
  for(const result of ranked){
    const key=norm(result.profile.champion);
    if(seen.has(key))continue;
    seen.add(key);
    unique.push(result);
    if(unique.length>=3)break;
  }
  return unique;
}

export function slamCandidates(components:ComponentBag){
  const bag=bagCopy(components);
  const itemUse=new Map<string,{item:string;count:number;profiles:Set<string>;kindWeight:number}>();
  for(const profile of TFT_CARRY_PROFILES){
    for(const build of profile.builds){
      for(const item of build.items){
        const recipe=TFT_ITEM_RECIPES[item];
        if(!recipe||!canConsume(recipe,bag))continue;
        const current=itemUse.get(item)||{item,count:0,profiles:new Set<string>(),kindWeight:0};
        current.count+=1;
        current.profiles.add(profile.champion);
        current.kindWeight+=build.kind==='META'?3:build.kind==='ALTERNATIVE'?2:1;
        itemUse.set(item,current);
      }
    }
  }
  return [...itemUse.values()].sort((a,b)=>(b.profiles.size*20+b.kindWeight)-(a.profiles.size*20+a.kindWeight)).slice(0,6).map(x=>({item:x.item,profiles:[...x.profiles],flexScore:x.profiles.size*20+x.kindWeight}));
}

export function componentCount(bag:ComponentBag){return TFT_COMPONENTS.reduce((sum,c)=>sum+Number(bag[c]||0),0);}
