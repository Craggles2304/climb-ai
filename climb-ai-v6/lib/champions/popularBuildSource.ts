import 'server-only';
import type {BuildItem} from './build';

export interface PopularBuildResult{
  source:'LOLALYTICS';
  sourceUrl:string;
  patch:string;
  region:string;
  tier:string;
  lane:string;
  items:BuildItem[];
  confidence:'HIGH'|'MEDIUM';
  note:string;
  matches:number;
  winRate:number|null;
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

type ItemSetEntry=[string|number,number?,number?];

const ROLE_TO_LANE:Record<string,string>={
  TOP:'top',
  JUNGLE:'jungle',
  MID:'middle',
  MIDDLE:'middle',
  ADC:'bottom',
  BOTTOM:'bottom',
  BOT:'bottom',
  SUPPORT:'support',
  UTILITY:'support',
};

export async function popularBuild(input:PopularBuildInput):Promise<PopularBuildResult|null>{
  const lane=laneFor(input.role);
  const wantedTier=tierFor(input.rank);
  const wantedRegion=regionFor(input.region);
  const patch=input.patch.split('.').slice(0,2).join('.');
  const slug=championSlug(input.champion);

  const attempts=[
    {tier:wantedTier,region:wantedRegion},
    {tier:wantedTier,region:'all'},
    {tier:'all',region:'all'},
  ].filter((value,index,array)=>
    array.findIndex(other=>other.tier===value.tier&&other.region===value.region)===index
  );

  for(const filters of attempts){
    const data=await fetchBuildSet({slug,lane,patch,...filters});
    if(!data)continue;
    const parsed=parseBuildSet(data,input.catalogue);
    if(!parsed||parsed.items.length<3)continue;

    const exact=filters.tier===wantedTier&&filters.region===wantedRegion;
    const filterText=`${filters.region.toUpperCase()} · ${displayTier(filters.tier)} · ${lane.toUpperCase()}`;
    return{
      source:'LOLALYTICS',
      sourceUrl:`https://lolalytics.com/lol/${slug}/build/?lane=${encodeURIComponent(lane)}&tier=${encodeURIComponent(filters.tier)}`,
      patch,
      region:filters.region.toUpperCase(),
      tier:displayTier(filters.tier),
      lane:lane.toUpperCase(),
      items:parsed.items,
      confidence:exact&&parsed.items.length>=5?'HIGH':'MEDIUM',
      matches:parsed.picks,
      winRate:parsed.picks>0?Math.round(parsed.wins/parsed.picks*1000)/10:null,
      note:`Most-played complete build path from ${parsed.picks.toLocaleString()} Lolalytics games · ${filterText}.`,
    };
  }

  console.warn('[popular-build] Lolalytics build-itemset unavailable',{
    champion:input.champion,patch,lane,wantedTier,wantedRegion,
  });
  return null;
}

async function fetchBuildSet({
  slug,lane,patch,tier,region,
}:{
  slug:string;lane:string;patch:string;tier:string;region:string;
}):Promise<unknown|null>{
  const params=new URLSearchParams({
    ep:'build-itemset',
    v:'1',
    patch,
    c:slug,
    tier,
    queue:'ranked',
    region,
    lane,
  });
  const url=`https://a1.lolalytics.com/mega/?${params.toString()}`;
  try{
    const response=await fetch(url,{
      headers:{
        Accept:'application/json',
        'User-Agent':'Mozilla/5.0 (compatible; OPCLIMB/1.0; +https://opclimb.com)',
      },
      next:{revalidate:60*60*2},
    });
    if(!response.ok){
      console.warn('[popular-build] Lolalytics HTTP failure',{status:response.status,url});
      return null;
    }
    return await response.json();
  }catch(error){
    console.warn('[popular-build] Lolalytics request failed',{url,error:String(error)});
    return null;
  }
}

function parseBuildSet(
  raw:unknown,
  catalogue:BuildItem[],
):{items:BuildItem[];picks:number;wins:number}|null{
  if(!raw||typeof raw!=='object')return null;
  const sets=(raw as {itemSets?:Record<string,unknown>}).itemSets;
  if(!sets||typeof sets!=='object')return null;

  const buildEntry=firstEntry(sets.itemSet5)
    ??firstEntry(sets.itemSet4)
    ??firstEntry(sets.itemSet3);
  if(!buildEntry)return null;

  const path=itemIds(buildEntry);
  if(!path.length)return null;

  const bootCandidates=entries(sets.itemBootSet1)
    .slice(0,8)
    .flatMap(itemIds);
  const bootId=bootCandidates.find(id=>isBoot(catalogue.find(item=>item.id===id)));

  const ordered=bootId&&path.length
    ?[path[0],bootId,...path.slice(1)]
    :path;

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

  const picks=Number(buildEntry[1])||0;
  const wins=Number(buildEntry[2])||0;
  return items.length?{items,picks,wins}:null;
}

function entries(value:unknown):ItemSetEntry[]{
  return Array.isArray(value)?value.filter(Array.isArray) as ItemSetEntry[]:[];
}

function firstEntry(value:unknown):ItemSetEntry|null{
  return entries(value)[0]??null;
}

function itemIds(entry:ItemSetEntry):number[]{
  return String(entry?.[0]??'')
    .split('_')
    .map(value=>Number.parseInt(value,10))
    .filter(Number.isFinite);
}

function isBoot(item:BuildItem|undefined){
  if(!item)return false;
  return /boots|shoes|greaves|caps|crushers|sorcerer|ionian/i.test(item.name);
}

function laneFor(role?:string){
  const key=String(role||'MID').toUpperCase().replace(/[^A-Z]/g,'');
  return ROLE_TO_LANE[key]||'middle';
}

function tierFor(rank?:string){
  const value=String(rank||'').toLowerCase();
  if(value.includes('challenger'))return'challenger';
  if(value.includes('grandmaster'))return'grandmaster';
  if(value.includes('master'))return'master';
  if(value.includes('diamond'))return'diamond';
  if(value.includes('emerald'))return'emerald';
  if(value.includes('platinum'))return'platinum';
  if(value.includes('gold'))return'gold';
  if(value.includes('silver'))return'silver';
  if(value.includes('bronze'))return'bronze';
  if(value.includes('iron'))return'iron';
  return'emerald_plus';
}

function regionFor(region?:string){
  const value=String(region||'all').toLowerCase().replace(/[^a-z0-9]/g,'');
  const map:Record<string,string>={
    euw1:'euw',euw:'euw',
    eun1:'eune',eune:'eune',
    na1:'na',na:'na',
    kr:'kr',
    br1:'br',br:'br',
    jp1:'jp',jp:'jp',
    la1:'lan',lan:'lan',
    la2:'las',las:'las',
    oc1:'oce',oce:'oce',
    tr1:'tr',tr:'tr',
    ru:'ru',
    ph2:'ph',ph:'ph',
    sg2:'sg',sg:'sg',
    th2:'th',th:'th',
    tw2:'tw',tw:'tw',
    vn2:'vn',vn:'vn',
    me1:'me',me:'me',
  };
  return map[value]||'all';
}

function displayTier(tier:string){
  return tier==='all'?'ALL RANKS':tier.replaceAll('_',' ').toUpperCase();
}

function championSlug(name:string){
  return String(name||'').toLowerCase().replace(/['\s.]/g,'').replace(/&/g,'and');
}
