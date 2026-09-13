import {TFT_CARRY_PROFILES,metaStrengthScore,type TftCarryItemBuild,type TftCarryProfile} from './carryBuilder';

export const TFT_COMPONENTS=['B.F. Sword','Recurve Bow','Needlessly Large Rod','Tear of the Goddess','Chain Vest','Negatron Cloak',"Giant's Belt",'Sparring Gloves'] as const;
export type TftComponent=typeof TFT_COMPONENTS[number];

export type ComponentBag=Partial<Record<TftComponent,number>>;

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
  craftable:string[];
  owned:string[];
  partial:string[];
  missing:string[];
  reason:string;
}

const norm=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');

function bagCopy(bag:ComponentBag){
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

export function rankCarryFits(components:ComponentBag,completedItems:string[]=[]):CarryFitResult[]{
  const completedCounts=new Map<string,number>();
  for(const item of completedItems)completedCounts.set(norm(item),(completedCounts.get(norm(item))||0)+1);
  const results:CarryFitResult[]=[];

  for(const profile of TFT_CARRY_PROFILES){
    for(const build of profile.builds){
      const bag=bagCopy(components);
      const usedCompleted=new Map(completedCounts);
      const owned:string[]=[];
      const craftable:string[]=[];
      const partial:string[]=[];
      const missing:string[]=[];
      let score=Math.round(metaStrengthScore(profile)*0.22);
      if(build.kind==='META')score+=15;
      if(build.kind==='ALTERNATIVE')score+=7;
      if(build.kind==='FUN')score-=10;

      for(const item of build.items){
        const key=norm(item);
        const ownedCount=usedCompleted.get(key)||0;
        if(ownedCount>0){
          usedCompleted.set(key,ownedCount-1);
          owned.push(item);
          score+=34;
          continue;
        }
        const recipe=TFT_ITEM_RECIPES[item];
        if(recipe&&canConsume(recipe,bag)){
          consume(recipe,bag);
          craftable.push(item);
          score+=26;
          continue;
        }
        if(recipe){
          const partialCount=partialRecipeScore(recipe,bag);
          if(partialCount>0){partial.push(item);score+=partialCount*6;}
          else missing.push(item);
        }else missing.push(item);
      }

      const matched=owned.length+craftable.length;
      const reason=matched>=3?'Your current bag already completes this entire carry package.':matched===2?'Two of the three target items are already owned or immediately craftable.':matched===1?'One target item is ready now; the rest remain flexible.':partial.length?'Your components lean toward this line, but you should avoid hard-forcing it yet.':'Low natural item fit from the current bag.';
      results.push({profile,build,score,craftable,owned,partial,missing,reason});
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
