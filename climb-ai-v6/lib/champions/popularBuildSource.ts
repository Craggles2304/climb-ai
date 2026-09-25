import 'server-only';
import type {BuildItem} from './build';

export interface PopularBuildResult{
  source:'U.GG';
  sourceUrl:string;
  patch:string;
  region:string;
  tier:string;
  lane:string;
  items:BuildItem[];
  confidence:'HIGH'|'MEDIUM';
  note:string;
  matches:number;
}

interface PopularBuildInput{
  champion:string;
  championKey:string;
  role?:string;
  rank?:string;
  region?:string;
  patch:string;
  catalogue:BuildItem[];
}

type JsonObject=Record<string,unknown>;

const REGION_IDS:Record<string,{id:string;label:string}>={
  NA:{id:'1',label:'NA'},NA1:{id:'1',label:'NA'},
  EUW:{id:'2',label:'EUW'},EUW1:{id:'2',label:'EUW'},
  KR:{id:'3',label:'KR'},
  EUNE:{id:'4',label:'EUNE'},EUN1:{id:'4',label:'EUNE'},
  BR:{id:'5',label:'BR'},BR1:{id:'5',label:'BR'},
  LAN:{id:'6',label:'LAN'},LA1:{id:'6',label:'LAN'},
  LAS:{id:'7',label:'LAS'},LA2:{id:'7',label:'LAS'},
  OCE:{id:'8',label:'OCE'},OC1:{id:'8',label:'OCE'},
  RU:{id:'9',label:'RU'},
  TR:{id:'10',label:'TR'},TR1:{id:'10',label:'TR'},
  JP:{id:'11',label:'JP'},JP1:{id:'11',label:'JP'},
  WORLD:{id:'12',label:'WORLD'},
  PH:{id:'13',label:'PH'},PH2:{id:'13',label:'PH'},
  SG:{id:'14',label:'SG'},SG2:{id:'14',label:'SG'},
  TH:{id:'15',label:'TH'},TH2:{id:'15',label:'TH'},
  TW:{id:'16',label:'TW'},TW2:{id:'16',label:'TW'},
  VN:{id:'17',label:'VN'},VN2:{id:'17',label:'VN'},
  ME:{id:'18',label:'ME'},ME1:{id:'18',label:'ME'},
};

const ROLE_IDS:Record<string,{id:string;label:string}>={
  JUNGLE:{id:'1',label:'JUNGLE'},
  SUPPORT:{id:'2',label:'SUPPORT'},
  ADC:{id:'3',label:'ADC'},
  BOTTOM:{id:'3',label:'ADC'},
  BOT:{id:'3',label:'ADC'},
  TOP:{id:'4',label:'TOP'},
  MID:{id:'5',label:'MID'},
  MIDDLE:{id:'5',label:'MID'},
};

const RANK_IDS:Array<[RegExp,string,string]>= [
  [/CHALLENGER/i,'1','CHALLENGER'],
  [/GRANDMASTER/i,'13','GRANDMASTER'],
  [/(^|\s)MASTER/i,'2','MASTER'],
  [/DIAMOND/i,'3','DIAMOND'],
  [/EMERALD/i,'16','EMERALD'],
  [/PLATINUM/i,'4','PLATINUM'],
  [/GOLD/i,'5','GOLD'],
  [/SILVER/i,'6','SILVER'],
  [/BRONZE/i,'7','BRONZE'],
  [/IRON/i,'12','IRON'],
];

const OVERALL_RANK={id:'8',label:'ALL RANKS'};
const WORLD_REGION={id:'12',label:'WORLD'};
const AUTO_ROLE={id:'7',label:'AUTO'};

export async function popularBuild(input:PopularBuildInput):Promise<PopularBuildResult|null>{
  const patchKey=input.patch.split('.').slice(0,2).join('_');
  const apiVersion=await overviewVersion(patchKey);
  const url=`https://stats2.u.gg/lol/1.5/overview/${patchKey}/ranked_solo_5x5/${encodeURIComponent(input.championKey)}/${encodeURIComponent(apiVersion)}.json`;
  const raw=await fetchJson(url);
  if(!raw||typeof raw!=='object'){
    console.warn('[popular-build] UGG overview unavailable',{url,patchKey,apiVersion,championKey:input.championKey});
    return null;
  }

  const region=regionFor(input.region);
  const rank=rankFor(input.rank);
  const role=roleFor(input.role);
  const selected=selectOverview(raw as JsonObject,region,rank,role);
  if(!selected){
    console.warn('[popular-build] no matching UGG filter node',{topKeys:Object.keys(raw as JsonObject).slice(0,20),region,rank,role});
    return null;
  }

  const parsed=parseOverview(selected.node,input.catalogue);
  if(!parsed||parsed.items.length<3){
    console.warn('[popular-build] UGG overview shape/item mapping failed',{
      region:selected.region,rank:selected.rank,role:selected.role,
      nodePreview:Array.isArray(selected.node)?selected.node.slice(0,2):typeof selected.node,
    });
    return null;
  }

  const exact=selected.region.id===region.id&&selected.rank.id===rank.id&&
    (selected.role.id===role.id||role.id===AUTO_ROLE.id);
  const sourceUrl=`https://u.gg/lol/champions/${championSlug(input.champion)}/build`;

  return{
    source:'U.GG',
    sourceUrl,
    patch:input.patch.split('.').slice(0,2).join('.'),
    region:selected.region.label,
    tier:selected.rank.label,
    lane:selected.role.label,
    items:parsed.items,
    confidence:exact&&parsed.items.length>=5?'HIGH':'MEDIUM',
    matches:parsed.matches,
    note:`Most-played core path plus the most-played later items from ${parsed.matches.toLocaleString()} U.GG games for the closest available filters.`,
  };
}

async function overviewVersion(patchKey:string):Promise<string>{
  try{
    const response=await fetch(
      'https://static.bigbrain.gg/assets/lol/riot_patch_update/prod/ugg/ugg-api-versions.json',
      {next:{revalidate:60*60*6}},
    );
    if(!response.ok)return'1.5.0';
    const data=await response.json() as Record<string,Record<string,string>>;
    return data?.[patchKey]?.overview||'1.5.0';
  }catch{
    return'1.5.0';
  }
}

async function fetchJson(url:string):Promise<unknown|null>{
  try{
    const response=await fetch(url,{
      headers:{'Accept':'application/json'},
      next:{revalidate:60*60*2},
    });
    if(!response.ok){
      console.warn('[popular-build] UGG HTTP failure',{status:response.status,url});
      return null;
    }
    return await response.json();
  }catch{
    return null;
  }
}

function selectOverview(
  raw:JsonObject,
  wantedRegion:{id:string;label:string},
  wantedRank:{id:string;label:string},
  wantedRole:{id:string;label:string},
):{node:unknown;region:{id:string;label:string};rank:{id:string;label:string};role:{id:string;label:string}}|null{
  const regions=[wantedRegion,WORLD_REGION].filter((value,index,array)=>array.findIndex(x=>x.id===value.id)===index);
  const ranks=[wantedRank,OVERALL_RANK,{id:'17',label:'EMERALD+'},{id:'10',label:'PLATINUM+'}]
    .filter((value,index,array)=>array.findIndex(x=>x.id===value.id)===index);
  const roles=[wantedRole,AUTO_ROLE].filter((value,index,array)=>array.findIndex(x=>x.id===value.id)===index);

  for(const region of regions){
    const regionData=asObject(raw[region.id]);
    if(!regionData)continue;
    for(const rank of ranks){
      const rankData=asObject(regionData[rank.id]);
      if(!rankData)continue;
      for(const role of roles){
        if(rankData[role.id]!==undefined)return{node:rankData[role.id],region,rank,role};
      }
      const fallbackRole=bestRole(rankData);
      if(fallbackRole)return{node:fallbackRole.node,region,rank,role:fallbackRole.role};
    }
  }
  return null;
}

function bestRole(rankData:JsonObject):{node:unknown;role:{id:string;label:string}}|null{
  let best:{node:unknown;role:{id:string;label:string};matches:number}|null=null;
  for(const [id,node] of Object.entries(rankData)){
    const overview=unwrapOverview(node);
    const matchInfo=Array.isArray(overview?.[6])?overview?.[6] as unknown[]:[];
    const matches=numberAt(matchInfo,1);
    if(!best||matches>best.matches){
      best={node,role:roleLabel(id),matches};
    }
  }
  return best?{node:best.node,role:best.role}:null;
}

function parseOverview(node:unknown,catalogue:BuildItem[]):{items:BuildItem[];matches:number}|null{
  const overview=unwrapOverview(node);
  if(!overview)return null;

  const core=Array.isArray(overview[3])?overview[3] as unknown[]:[];
  const coreIds=Array.isArray(core[2])?(core[2] as unknown[]).map(Number).filter(Number.isFinite):[];
  const late=Array.isArray(overview[5])?overview[5] as unknown[]:[];
  const lateIds=late.slice(0,3).map(group=>popularLateItem(group)).filter((id):id is number=>id!==null);
  const matchInfo=Array.isArray(overview[6])?overview[6] as unknown[]:[];
  const matches=numberAt(matchInfo,1)||numberAt(core,0);

  const byId=new Map(catalogue.map(item=>[item.id,item]));
  const ids=[...coreIds,...lateIds];
  const items:BuildItem[]=[];
  const seen=new Set<number>();
  for(const id of ids){
    const item=byId.get(id);
    if(!item||seen.has(id))continue;
    seen.add(id);
    items.push(item);
    if(items.length===6)break;
  }
  return items.length?{items,matches}:null;
}

function unwrapOverview(node:unknown):unknown[]|null{
  if(!Array.isArray(node))return null;
  // U.GG wraps each role entry in a sequence; element 0 is the overview payload.
  if(Array.isArray(node[0])&&looksLikeOverview(node[0] as unknown[]))return node[0] as unknown[];
  if(looksLikeOverview(node))return node;
  return null;
}

function looksLikeOverview(value:unknown[]){
  return value.length>=7&&Array.isArray(value[2])&&Array.isArray(value[3])&&Array.isArray(value[5]);
}

function popularLateItem(group:unknown):number|null{
  if(!Array.isArray(group)||!group.length)return null;
  let winner:{id:number;matches:number}|null=null;
  for(const row of group){
    if(!Array.isArray(row))continue;
    const id=Number(row[0]);
    const matches=Number(row[2]);
    if(!Number.isFinite(id)||!Number.isFinite(matches))continue;
    if(!winner||matches>winner.matches)winner={id,matches};
  }
  return winner?.id??null;
}

function regionFor(value?:string){
  const key=String(value||'WORLD').toUpperCase().replace(/[^A-Z0-9]/g,'');
  return REGION_IDS[key]||WORLD_REGION;
}

function rankFor(value?:string){
  const text=String(value||'');
  for(const [pattern,id,label] of RANK_IDS)if(pattern.test(text))return{id,label};
  return OVERALL_RANK;
}

function roleFor(value?:string){
  const key=String(value||'').toUpperCase().replace(/[^A-Z]/g,'');
  return ROLE_IDS[key]||AUTO_ROLE;
}

function roleLabel(id:string){
  const found=Object.values(ROLE_IDS).find(value=>value.id===id);
  return found??(id===AUTO_ROLE.id?AUTO_ROLE:{id,label:'AUTO'});
}

function numberAt(values:unknown[],index:number){
  const value=Number(values[index]);
  return Number.isFinite(value)?value:0;
}

function asObject(value:unknown):JsonObject|null{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as JsonObject:null;
}

function championSlug(name:string){
  return name.toLowerCase().replaceAll('&','and').replace(/['’.]/g,'').replace(/[^a-z0-9]+/g,'');
}
