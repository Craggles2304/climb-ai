import type {AbilityDamageRow} from './abilityDamage';

export interface TargetStats{
  hp:number;
  armor:number;
  magicResist:number;
}

export interface ComboSnapshot{
  raw:number;
  postMitigation:number;
  percentHp:number;
}

export function mitigate(raw:number,damageType:string,target:TargetStats):number{
  const amount=Math.max(0,Number(raw)||0);
  const type=String(damageType||'').toUpperCase();
  if(type.includes('TRUE'))return round(amount);
  if(type.includes('PHYSICAL'))return round(amount*resistMultiplier(target.armor));
  if(type.includes('MAGIC'))return round(amount*resistMultiplier(target.magicResist));
  return round(amount);
}

export function resistMultiplier(resist:number):number{
  const r=Number(resist)||0;
  if(r>=0)return 100/(100+r);
  return 2-100/(100-r);
}

export function abilityRanksFromSequence(sequence:string[],level:number):Record<string,number>{
  const ranks:Record<string,number>={Q:0,W:0,E:0,R:0};
  for(const slot of sequence.slice(0,Math.max(0,Math.min(18,level)))){
    if(ranks[slot]!==undefined)ranks[slot]+=1;
  }
  return ranks;
}

export function currentAbilityDamage(
  rows:AbilityDamageRow[],
  ranks:Record<string,number>,
):Record<string,{raw:number;damageType:string;exact:boolean}>{
  const result:Record<string,{raw:number;damageType:string;exact:boolean}>={};
  for(const row of rows){
    const rank=ranks[row.slot]??0;
    if(rank<=0)continue;
    const cell=row.ranks[Math.min(rank,row.ranks.length)-1];
    if(!cell||cell.value===null)continue;
    const existing=result[row.slot];
    if(!existing||cell.value>existing.raw){
      result[row.slot]={
        raw:cell.value,
        damageType:row.damageType,
        exact:cell.exact,
      };
    }
  }
  return result;
}

export function comboSnapshot(
  slots:string[],
  abilityDamage:Record<string,{raw:number;damageType:string}>,
  target:TargetStats,
):ComboSnapshot{
  let raw=0;
  let post=0;
  for(const slot of slots){
    const ability=abilityDamage[slot];
    if(!ability)continue;
    raw+=ability.raw;
    post+=mitigate(ability.raw,ability.damageType,target);
  }
  return{
    raw:round(raw),
    postMitigation:round(post),
    percentHp:target.hp>0?round(post/target.hp*100):0,
  };
}

const round=(value:number)=>Math.round(value*10)/10;
