import type {BuildItem} from './build';

export type ItemSetEntry=[string|number,number?,number?];

export function parsePopularBuildSet(
  raw:unknown,
  catalogue:BuildItem[],
):{items:BuildItem[];picks:number;wins:number}|null{
  if(!raw||typeof raw!=='object')return null;
  const sets=(raw as {itemSets?:Record<string,unknown>}).itemSets;
  if(!sets||typeof sets!=='object')return null;

  const coreEntry=mostPlayedEntry(sets.itemSet3)
    ??mostPlayedEntry(sets.itemSet4)
    ??mostPlayedEntry(sets.itemSet5);
  if(!coreEntry)return null;

  let legendaryPath=itemIds(coreEntry).slice(0,3);
  if(!legendaryPath.length)return null;

  const fourth=popularExtension(sets.itemSet4,legendaryPath);
  if(fourth)legendaryPath=[...legendaryPath,fourth.id];

  const fifth=popularExtension(sets.itemSet5,legendaryPath);
  if(fifth)legendaryPath=[...legendaryPath,fifth.id];

  const bootRows=[
    ...entries(sets.itemBootSet1),
    ...entries(sets.itemBootSet2),
    ...entries(sets.itemBootSet3),
  ].sort((a,b)=>(Number(b[1])||0)-(Number(a[1])||0));
  let bootId:number|undefined;
  for(const row of bootRows){
    const candidate=itemIds(row).find(id=>isStandardBoot(catalogue.find(item=>item.id===id)));
    if(candidate!==undefined){bootId=candidate;break}
  }

  const ordered=bootId&&legendaryPath.length
    ?[legendaryPath[0],bootId,...legendaryPath.slice(1)]
    :legendaryPath;

  const byId=new Map(catalogue.map(item=>[item.id,item]));
  const items:BuildItem[]=[];
  const seen=new Set<number>();
  for(const id of ordered){
    const item=byId.get(id);
    if(!item||seen.has(id))continue;
    seen.add(id);
    items.push(item);
    if(items.length===6)break;
  }

  const picks=Number(coreEntry[1])||0;
  const wins=Number(coreEntry[2])||0;
  return items.length?{items,picks,wins}:null;
}

function entries(value:unknown):ItemSetEntry[]{
  return Array.isArray(value)?value.filter(Array.isArray) as ItemSetEntry[]:[];
}

function mostPlayedEntry(value:unknown):ItemSetEntry|null{
  return [...entries(value)].sort((a,b)=>(Number(b[1])||0)-(Number(a[1])||0))[0]??null;
}

function popularExtension(value:unknown,current:number[]):{id:number;picks:number}|null{
  const rows=[...entries(value)].sort((a,b)=>(Number(b[1])||0)-(Number(a[1])||0));
  let fallback:{id:number;picks:number}|null=null;
  let exactBest:{id:number;picks:number}|null=null;
  for(const row of rows){
    const ids=itemIds(row);
    const picks=Number(row[1])||0;
    const exact=current.every((id,index)=>ids[index]===id);
    const candidate=ids.find(id=>!current.includes(id));
    if(candidate!==undefined&&(!fallback||picks>fallback.picks))fallback={id:candidate,picks};
    if(exact&&ids.length>current.length){
      const id=ids[current.length];
      if(Number.isFinite(id)&&(!exactBest||picks>exactBest.picks))exactBest={id,picks};
    }
  }
  return exactBest??fallback;
}

function itemIds(entry:ItemSetEntry):number[]{
  return String(entry?.[0]??'')
    .split('_')
    .map(value=>Number.parseInt(value,10))
    .filter(Number.isFinite);
}

function isStandardBoot(item:BuildItem|undefined){
  if(!item)return false;
  const name=String(item.name||'');
  if(/Armored Advance|Chainlaced Crushers|Gunmetal Greaves|Spellslinger's Shoes|Crimson Lucidity|Forever Forward/i.test(name))return false;
  return /Plated Steelcaps|Mercury's Treads|Berserker's Greaves|Boots of Swiftness|Sorcerer's Shoes|Ionian Boots/i.test(name);
}
