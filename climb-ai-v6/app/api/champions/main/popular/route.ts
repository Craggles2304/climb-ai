import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {latestPatch,resolveChampionId,championDetail} from '@/lib/champions/source';
import {toBuildItems} from '@/lib/champions/build';
import {matchupItemCatalogue} from '@/lib/combat/itemSource';
import {isCompletedItem,isFinishedBoot} from '@/lib/riot/items';
import {popularBuild} from '@/lib/champions/popularBuildSource';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({
  champion:z.string().min(1).max(32),
  role:z.string().max(20).optional(),
  rank:z.string().max(60).optional(),
  region:z.string().max(16).optional(),
});

export async function GET(req:NextRequest){
  const limit=rateLimit(clientKey(req,'champion-popular-build'),30,60_000);
  if(!limit.ok)return NextResponse.json(
    {ok:false,error:'Too many build lookups. Wait a moment.'},
    {status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}},
  );

  const parsed=schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if(!parsed.success)return NextResponse.json({ok:false,error:'Choose a champion.'},{status:400});

  try{
    const patch=await latestPatch();
    const raw=await matchupItemCatalogue(patch);
    const source=Object.fromEntries(
      Object.entries(raw).filter(([,item])=>isCompletedItem(item)||isFinishedBoot(item))
    );
    const catalogue=toBuildItems(source,patch);
    const result=await popularBuild({...parsed.data,patch,catalogue});
    if(result)return NextResponse.json({ok:true,...result});

    const id=await resolveChampionId(parsed.data.champion,patch);
    if(!id)return NextResponse.json({ok:false,error:'Champion not found.',patch},{status:404});
    const detail=await championDetail(id,patch);
    const riot=riotRecommended(detail as unknown as RiotChampionRecommended,catalogue,patch);
    if(riot)return NextResponse.json({ok:true,...riot});

    return NextResponse.json({
      ok:false,
      error:'Popularity data is unavailable for those filters right now.',
      patch,
    },{status:404});
  }catch{
    return NextResponse.json({ok:false,error:'Could not load the current popular build.'},{status:502});
  }
}


type RiotChampionRecommended={
  recommended?:Array<{
    map?:string;
    mode?:string;
    title?:string;
    blocks?:Array<{type?:string;items?:Array<{id?:string;count?:number}>}>;
  }>;
};

function riotRecommended(
  detail:RiotChampionRecommended,
  catalogue:ReturnType<typeof toBuildItems>,
  patch:string,
){
  const sets=detail.recommended??[];
  const preferred=sets.find(set=>
    (String(set.map||'').toUpperCase()==='SR'||String(set.map||'')==='11'||String(set.map||'').toLowerCase()==='any')&&
    (!set.mode||String(set.mode).toUpperCase()==='CLASSIC')
  )??sets.find(set=>String(set.mode||'').toUpperCase()==='CLASSIC')??sets[0];
  if(!preferred)return null;

  const byId=new Map(catalogue.map(item=>[item.id,item]));
  const items=[] as typeof catalogue;
  const seen=new Set<number>();

  for(const block of preferred.blocks??[]){
    const type=String(block.type||'').toLowerCase();
    if(/start|consum|ward|component/.test(type))continue;
    for(const entry of block.items??[]){
      const id=Number(entry.id);
      const item=byId.get(id);
      if(!item||seen.has(id))continue;
      seen.add(id);
      items.push(item);
      if(items.length===6)break;
    }
    if(items.length===6)break;
  }

  if(items.length<3){
    for(const block of preferred.blocks??[]){
      for(const entry of block.items??[]){
        const id=Number(entry.id);
        const item=byId.get(id);
        if(!item||seen.has(id))continue;
        seen.add(id);
        items.push(item);
        if(items.length===6)break;
      }
      if(items.length===6)break;
    }
  }

  if(items.length<3)return null;
  return{
    source:'RIOT' as const,
    sourceUrl:'https://developer.riotgames.com/docs/lol',
    patch:patch.split('.').slice(0,2).join('.'),
    region:'GLOBAL',
    tier:'CURRENT PATCH',
    lane:'RECOMMENDED',
    items,
    confidence:'MEDIUM' as const,
    note:'Riot current-patch recommended item set. Used as the stable popular/meta baseline when live stat-site popularity data is unavailable.',
  };
}
