import 'server-only';
import type {
  AbilitySlot,
  ChampionAbility,
  ChampionAbilityDataset,
} from './abilityDamage';

const CACHE_MS=12*60*60_000;
const cache=new Map<string,{expires:number;value:ChampionAbilityDataset|null}>();

const slots:AbilitySlot[]=['P','Q','W','E','R'];

export async function championAbilityDataset(championId:string):Promise<ChampionAbilityDataset|null>{
  const key=championId.trim();
  if(!key)return null;
  const hit=cache.get(key);
  if(hit&&hit.expires>Date.now())return hit.value;

  const url=`https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions/${encodeURIComponent(key)}.json`;
  try{
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok){
      cache.set(key,{expires:Date.now()+60*60_000,value:null});
      return null;
    }
    const raw=await response.json() as any;
    const abilities:Partial<Record<AbilitySlot,ChampionAbility[]>>={};
    for(const slot of slots){
      const values=Array.isArray(raw?.abilities?.[slot])?raw.abilities[slot]:[];
      abilities[slot]=values.map(cleanAbility).filter(Boolean) as ChampionAbility[];
    }
    const value:ChampionAbilityDataset={
      source:'MERAKI',
      patchLastChanged:typeof raw?.patchLastChanged==='string'?raw.patchLastChanged:null,
      abilities,
    };
    cache.set(key,{expires:Date.now()+CACHE_MS,value});
    return value;
  }catch{
    cache.set(key,{expires:Date.now()+60*60_000,value:null});
    return null;
  }
}

function cleanAbility(value:any):ChampionAbility|null{
  if(!value||typeof value!=='object'||typeof value.name!=='string')return null;
  return {
    name:value.name,
    icon:typeof value.icon==='string'?value.icon:'',
    effects:Array.isArray(value.effects)?value.effects.map((effect:any)=>({
      description:typeof effect?.description==='string'?effect.description:'',
      leveling:Array.isArray(effect?.leveling)?effect.leveling.map((level:any)=>({
        attribute:typeof level?.attribute==='string'?level.attribute:'',
        modifiers:Array.isArray(level?.modifiers)?level.modifiers.map((modifier:any)=>({
          values:Array.isArray(modifier?.values)?modifier.values.map(Number).filter(Number.isFinite):[],
          units:Array.isArray(modifier?.units)?modifier.units.map((unit:any)=>String(unit??'')):[],
        })) : [],
      })).filter((level:any)=>level.attribute):[],
    })) : [],
    cooldown:value.cooldown&&Array.isArray(value.cooldown.modifiers)?{
      affectedByCdr:Boolean(value.cooldown.affectedByCdr),
      modifiers:value.cooldown.modifiers.map((modifier:any)=>({
        values:Array.isArray(modifier?.values)?modifier.values.map(Number).filter(Number.isFinite):[],
        units:Array.isArray(modifier?.units)?modifier.units.map((unit:any)=>String(unit??'')):[],
      })),
    }:null,
    cost:value.cost&&Array.isArray(value.cost.modifiers)?{
      modifiers:value.cost.modifiers.map((modifier:any)=>({
        values:Array.isArray(modifier?.values)?modifier.values.map(Number).filter(Number.isFinite):[],
        units:Array.isArray(modifier?.units)?modifier.units.map((unit:any)=>String(unit??'')):[],
      })),
    }:null,
    targeting:typeof value.targeting==='string'?value.targeting:null,
    damageType:typeof value.damageType==='string'?value.damageType:null,
    blurb:typeof value.blurb==='string'?value.blurb:null,
    notes:typeof value.notes==='string'?value.notes:null,
  };
}
