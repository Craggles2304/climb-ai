import 'server-only';
import type {ChampionListEntry} from './ddragon';

export interface CounterRow{
  opponentId:number;
  opponent:string;
  championId:string;
  games:number;
  yourWinRate:number;
  edge:number;
  difficulty:'VERY HARD'|'HARD'|'EVEN'|'FAVOURED'|'VERY FAVOURED';
}

export interface CounterTableResult{
  source:'LOLALYTICS';
  sourceUrl:string;
  patch:string;
  region:string;
  tier:string;
  lane:string;
  confidence:'HIGH'|'MEDIUM';
  analysed:number;
  stats:{winRate:number|null;pickRate:number|null;banRate:number|null};
  rows:CounterRow[];
  note:string;
}

interface CounterInput{
  champion:string;
  role?:string;
  rank?:string;
  region?:string;
  patch:string;
  roster:Record<string,ChampionListEntry>;
}

type RawCounter={cid?:number|string;vsWr?:number;n?:number};

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

const MIN_GAMES=20;

export async function counterTable(input:CounterInput):Promise<CounterTableResult|null>{
  const lane=laneFor(input.role);
  const wantedTier=tierFor(input.rank);
  const wantedRegion=regionFor(input.region);
  const patch=input.patch.split('.').slice(0,2).join('.');
  const slug=championSlug(input.champion);
  const byKey=new Map(Object.values(input.roster).map(champion=>[Number(champion.key),champion]));

  const attempts=[
    {tier:wantedTier,region:wantedRegion},
    {tier:wantedTier,region:'all'},
    {tier:'all',region:'all'},
  ].filter((value,index,array)=>
    array.findIndex(other=>other.tier===value.tier&&other.region===value.region)===index
  );

  for(const filters of attempts){
    const data=await fetchCounterSet({slug,lane,patch,...filters});
    if(!data||typeof data!=='object')continue;
    const raw=Array.isArray((data as {counters?:unknown}).counters)
      ?(data as {counters:RawCounter[]}).counters
      :[];
    const rows=raw
      .map(entry=>{
        const opponentId=Number(entry.cid);
        const opponent=byKey.get(opponentId);
        const games=Number(entry.n)||0;
        const yourWinRate=Number(entry.vsWr);
        if(!opponent||!Number.isFinite(yourWinRate)||games<MIN_GAMES)return null;
        const edge=Math.round((yourWinRate-50)*10)/10;
        return{
          opponentId,
          opponent:opponent.name,
          championId:opponent.id,
          games,
          yourWinRate:Math.round(yourWinRate*10)/10,
          edge,
          difficulty:difficultyFor(yourWinRate),
        } satisfies CounterRow;
      })
      .filter((row):row is CounterRow=>Boolean(row))
      .sort((a,b)=>a.yourWinRate-b.yourWinRate||b.games-a.games);

    if(rows.length<6)continue;

    const exact=filters.tier===wantedTier&&filters.region===wantedRegion;
    const statBlock=(data as {stats?:Record<string,unknown>}).stats??{};
    const pct=(value:unknown)=>{
      const n=Number(value);
      if(!Number.isFinite(n))return null;
      return Math.round((n<=1?n*100:n)*10)/10;
    };
    const analysed=Number(statBlock.analysed)
      ||Number((data as {analysed?:number}).analysed)
      ||rows.reduce((sum,row)=>sum+row.games,0);
    const stats={
      winRate:pct(statBlock.wr),
      pickRate:pct(statBlock.pr),
      banRate:pct(statBlock.br),
    };
    const scope=`${filters.region.toUpperCase()} · ${displayTier(filters.tier)} · ${lane.toUpperCase()}`;
    return{
      source:'LOLALYTICS',
      sourceUrl:`https://lolalytics.com/lol/${slug}/build/?lane=${encodeURIComponent(lane)}&tier=${encodeURIComponent(filters.tier)}`,
      patch,
      region:filters.region.toUpperCase(),
      tier:displayTier(filters.tier),
      lane:lane.toUpperCase(),
      confidence:exact&&rows.filter(row=>row.games>=50).length>=8?'HIGH':'MEDIUM',
      analysed,
      stats,
      rows,
      note:`Counter table uses Lolalytics ranked matchup samples with at least ${MIN_GAMES} games per opponent · ${scope}.`,
    };
  }

  console.warn('[counter-table] Lolalytics counter data unavailable',{
    champion:input.champion,patch,lane,wantedTier,wantedRegion,
  });
  return null;
}

async function fetchCounterSet({
  slug,lane,patch,tier,region,
}:{
  slug:string;lane:string;patch:string;tier:string;region:string;
}):Promise<unknown|null>{
  const params=new URLSearchParams({
    ep:'counter',
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
      console.warn('[counter-table] Lolalytics HTTP failure',{status:response.status,url});
      return null;
    }
    return await response.json();
  }catch(error){
    console.warn('[counter-table] Lolalytics request failed',{url,error:String(error)});
    return null;
  }
}

function difficultyFor(winRate:number):CounterRow['difficulty']{
  if(winRate<46)return'VERY HARD';
  if(winRate<49)return'HARD';
  if(winRate<=51)return'EVEN';
  if(winRate<=54)return'FAVOURED';
  return'VERY FAVOURED';
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
