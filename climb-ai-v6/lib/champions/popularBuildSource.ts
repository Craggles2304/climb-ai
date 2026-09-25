import 'server-only';
import type {BuildItem} from './build';

export interface PopularBuildResult{
  source:'U.GG'|'LOLALYTICS';
  sourceUrl:string;
  patch:string;
  region:string;
  tier:string;
  lane:string;
  items:BuildItem[];
  confidence:'HIGH'|'MEDIUM';
  note:string;
}

interface PopularBuildInput{
  champion:string;
  role?:string;
  rank?:string;
  region?:string;
  patch:string;
  catalogue:BuildItem[];
}

const ROLE_TO_LANE:Record<string,string>={
  TOP:'top',
  JUNGLE:'jungle',
  MID:'middle',
  MIDDLE:'middle',
  ADC:'bottom',
  BOTTOM:'bottom',
  SUPPORT:'support',
};

const RANK_TO_TIER:Record<string,string>={
  IRON:'iron',
  BRONZE:'bronze',
  SILVER:'silver',
  GOLD:'gold',
  PLATINUM:'platinum',
  EMERALD:'emerald',
  DIAMOND:'diamond',
  MASTER:'master',
  GRANDMASTER:'grandmaster',
  CHALLENGER:'challenger',
};

export async function popularBuild(input:PopularBuildInput):Promise<PopularBuildResult|null>{
  const lane=ROLE_TO_LANE[String(input.role||'').toUpperCase()]||'middle';
  const tier=rankTier(input.rank);
  const region=normaliseRegion(input.region);
  const slug=championSlug(input.champion);

  const ugg=await fromUgg({slug,lane,tier,region,...input});
  if(ugg)return ugg;

  return fromLolalytics({slug,lane,tier,region,...input});
}

async function fromUgg(
  input:PopularBuildInput&{slug:string;lane:string;tier:string;region:string},
):Promise<PopularBuildResult|null>{
  const lanePath=input.lane==='middle'?'':`/${input.lane==='bottom'?'adc':input.lane}`;
  const sourceUrl=`https://u.gg/lol/champions/${input.slug}/items${lanePath}`;
  const html=await fetchHtml(sourceUrl);
  if(!html)return null;

  const decoded=decode(html);
  const patch=firstMatch(decoded,/Patch\s+(?:26\.)?([0-9]+\.[0-9]+)/i)||input.patch.split('.').slice(0,2).join('.');
  const names=input.catalogue.map(item=>item.name);
  const boots=input.catalogue.filter(item=>/boots|shoes|greaves|crushers|caps|sorcerer/i.test(item.name)).map(item=>item.name);

  const first=firstItemAfter(decoded,['Item 1','First Item'],names);
  const boot=firstItemAfter(decoded,['Boots'],boots.length?boots:names);
  const second=firstItemAfter(decoded,['Item 2','Second Item'],names);
  const third=firstItemAfter(decoded,['Item 3','Third Item'],names);
  const fourth=firstItemAfter(decoded,['Item 4','Fourth Item'],names);
  const fifth=firstItemAfter(decoded,['Item 5','Fifth Item'],names);

  const ordered=[first,boot,second,third,fourth,fifth].filter((name):name is string=>Boolean(name));
  const items=canonicalItems(ordered,input.catalogue);
  if(items.length<4)return null;

  return{
    source:'U.GG',
    sourceUrl,
    patch,
    region:input.region.toUpperCase(),
    tier:input.tier.toUpperCase().replaceAll('_',' '),
    lane:input.lane.toUpperCase(),
    items,
    confidence:items.length>=6?'HIGH':'MEDIUM',
    note:'Most-picked item in each visible build slot from the current U.GG items table for these filters.',
  };
}

async function fromLolalytics(
  input:PopularBuildInput&{slug:string;lane:string;tier:string;region:string},
):Promise<PopularBuildResult|null>{
  const params=new URLSearchParams();
  if(input.lane)params.set('lane',input.lane);
  if(input.tier)params.set('tier',input.tier);
  if(input.region)params.set('region',input.region);
  const sourceUrl=`https://lolalytics.com/lol/${input.slug}/build/?${params.toString()}`;
  const html=await fetchHtml(sourceUrl);
  if(!html)return null;

  const decoded=decode(html);
  const patch=firstMatch(decoded,/Patch\s+(?:26\.)?([0-9]+\.[0-9]+)/i)||input.patch.split('.').slice(0,2).join('.');
  const names=input.catalogue.map(item=>item.name);

  const commonIndex=findAny(decoded,['Most Common Build','Core Build']);
  if(commonIndex<0)return null;
  const coreIndex=decoded.indexOf('Core Build',commonIndex);
  const start=coreIndex>=0?coreIndex:commonIndex;

  const item4=findAfter(decoded,'Item 4',start);
  const item5=findAfter(decoded,'Item 5',item4>0?item4:start);
  const item6=findAfter(decoded,'Item 6',item5>0?item5:start);
  const end=findAfter(decoded,'Counters',item6>0?item6:start);

  const coreEnd=item4>start?item4:Math.min(decoded.length,start+45000);
  const coreNames=itemsInSegment(decoded.slice(start,coreEnd),names).slice(0,3);
  const slot4=item4>0?itemsInSegment(decoded.slice(item4,item5>item4?item5:item4+16000),names)[0]:undefined;
  const slot5=item5>0?itemsInSegment(decoded.slice(item5,item6>item5?item6:item5+16000),names)[0]:undefined;
  const slot6=item6>0?itemsInSegment(decoded.slice(item6,end>item6?end:item6+16000),names)[0]:undefined;

  const items=canonicalItems([...coreNames,slot4,slot5,slot6].filter((name):name is string=>Boolean(name)),input.catalogue);
  if(items.length<3)return null;

  return{
    source:'LOLALYTICS',
    sourceUrl,
    patch,
    region:input.region.toUpperCase(),
    tier:input.tier.toUpperCase().replaceAll('_',' '),
    lane:input.lane.toUpperCase(),
    items,
    confidence:items.length>=5?'MEDIUM':'MEDIUM',
    note:'Current filtered core/common build snapshot. Popularity pages can expose fewer late-game slots when sample sizes are small.',
  };
}

async function fetchHtml(url:string):Promise<string|null>{
  try{
    const response=await fetch(url,{
      headers:{
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36',
        'Accept':'text/html,application/xhtml+xml',
        'Accept-Language':'en-GB,en;q=0.9',
      },
      next:{revalidate:60*60*6},
    });
    if(!response.ok)return null;
    const text=await response.text();
    return text.length>5000?text:null;
  }catch{
    return null;
  }
}

function firstItemAfter(html:string,markers:string[],names:string[]):string|undefined{
  const markerIndex=findAny(html,markers);
  if(markerIndex<0)return undefined;
  const segment=html.slice(markerIndex,markerIndex+24000);
  return itemsInSegment(segment,names)[0];
}

function itemsInSegment(segment:string,names:string[]):string[]{
  const lower=segment.toLowerCase();
  const hits:Array<{name:string;index:number}>=[];
  for(const name of names){
    const variants=nameVariants(name);
    let index=-1;
    for(const variant of variants){
      const next=lower.indexOf(variant.toLowerCase());
      if(next>=0&&(index<0||next<index))index=next;
    }
    if(index>=0)hits.push({name,index});
  }
  hits.sort((a,b)=>a.index-b.index);
  const seen=new Set<string>();
  return hits.filter(hit=>{
    const key=hit.name.toLowerCase();
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  }).map(hit=>hit.name);
}

function canonicalItems(names:string[],catalogue:BuildItem[]):BuildItem[]{
  const byName=new Map(catalogue.map(item=>[item.name.toLowerCase(),item]));
  const result:BuildItem[]=[];
  const seen=new Set<number>();
  for(const name of names){
    const item=byName.get(name.toLowerCase());
    if(!item||seen.has(item.id))continue;
    seen.add(item.id);
    result.push(item);
    if(result.length===6)break;
  }
  return result;
}

function nameVariants(name:string):string[]{
  return [
    name,
    name.replaceAll("'","&#x27;"),
    name.replaceAll("'","&apos;"),
    name.replaceAll("'","\\u0027"),
    name.replaceAll('&','&amp;'),
  ];
}

function rankTier(rank?:string):string{
  const upper=String(rank||'').toUpperCase();
  for(const [name,tier] of Object.entries(RANK_TO_TIER)){
    if(upper.includes(name))return tier;
  }
  return 'emerald_plus';
}

function normaliseRegion(region?:string):string{
  const value=String(region||'euw').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(value==='euw1')return'euw';
  if(value==='na1')return'na';
  if(value==='kr')return'kr';
  if(value==='eun1')return'eune';
  return value||'euw';
}

function championSlug(name:string){
  return name.toLowerCase()
    .replaceAll('&','and')
    .replace(/['’.]/g,'')
    .replace(/[^a-z0-9]+/g,'');
}

function decode(value:string){
  return value
    .replaceAll('&quot;','"')
    .replaceAll('&#x27;',"'")
    .replaceAll('&apos;',"'")
    .replaceAll('&amp;','&')
    .replaceAll('\\u0027',"'");
}

function findAny(value:string,needles:string[]):number{
  let best=-1;
  const lower=value.toLowerCase();
  for(const needle of needles){
    const index=lower.indexOf(needle.toLowerCase());
    if(index>=0&&(best<0||index<best))best=index;
  }
  return best;
}
function findAfter(value:string,needle:string,start:number){
  return value.toLowerCase().indexOf(needle.toLowerCase(),Math.max(0,start));
}
function firstMatch(value:string,re:RegExp){
  return value.match(re)?.[1]||'';
}
