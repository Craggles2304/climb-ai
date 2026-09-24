export type TrustedBuildSourceName='U.GG'|'LOLALYTICS'|'OP.GG';

export interface TrustedBuildSourceEvidence{
  source:TrustedBuildSourceName;
  url:string;
  items:string[];
  patchReported:string|null;
  sample:number|null;
  fetchedAt:string;
  usable:boolean;
  note:string;
}

export interface TrustedBuildConsensusItem{
  name:string;
  score:number;
  sources:TrustedBuildSourceName[];
}

export interface TrustedBuildConsensus{
  patch:string;
  champion:string;
  role:string;
  sources:TrustedBuildSourceEvidence[];
  items:TrustedBuildConsensusItem[];
  usableSources:number;
  confidence:'HIGH'|'MEDIUM'|'LOW';
  generatedAt:string;
}

const norm=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');

export function buildTrustedConsensus(input:{
  patch:string;
  champion:string;
  role:string;
  sources:TrustedBuildSourceEvidence[];
}):TrustedBuildConsensus{
  const usable=input.sources.filter(source=>source.usable&&source.items.length>=2);
  const scores=new Map<string,{name:string;score:number;sources:Set<TrustedBuildSourceName>}>();
  const positionWeight=[1,.84,.68,.54,.42,.32];
  for(const source of usable){
    source.items.slice(0,6).forEach((name,index)=>{
      const key=norm(name);
      const row=scores.get(key)??{name,score:0,sources:new Set<TrustedBuildSourceName>()};
      row.score+=positionWeight[index]??.25;
      row.sources.add(source.source);
      scores.set(key,row);
    });
  }
  const items=[...scores.values()]
    .map(row=>({name:row.name,score:Math.round(row.score*100)/100,sources:[...row.sources]}))
    .filter(row=>row.sources.length>=2||usable.length===1)
    .sort((a,b)=>b.sources.length-a.sources.length||b.score-a.score);
  return{
    patch:input.patch,champion:input.champion,role:input.role,sources:input.sources,items,
    usableSources:usable.length,
    confidence:usable.length>=3?'HIGH':usable.length===2?'MEDIUM':'LOW',
    generatedAt:new Date().toISOString(),
  };
}

export function consensusScoreForItem(consensus:TrustedBuildConsensus|undefined|null,itemName:string){
  if(!consensus||consensus.usableSources<2)return 0;
  const found=consensus.items.find(item=>norm(item.name)===norm(itemName));
  if(!found)return 0;
  return found.score*(found.sources.length>=3?1.18:1);
}
