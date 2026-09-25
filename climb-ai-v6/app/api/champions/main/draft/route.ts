import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {buildAdaptiveItemPlan} from '@/lib/adaptiveBuildPlanner';
import {buildStats,toBuildItems,type BuildItem} from '@/lib/champions/build';
import {championAbilityDataset} from '@/lib/champions/merakiAbilitySource';
import {rawDamageSnapshot} from '@/lib/champions/rawDamageBuild';
import {championDetail,championRoster,itemCatalogue,latestPatch,resolveChampionId} from '@/lib/champions/source';
import {damageType} from '@/lib/champions/ddragon';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({
  champion:z.string().min(1).max(32),
  enemies:z.string().min(1).max(220),
  role:z.string().max(20).optional(),
  level:z.coerce.number().int().min(1).max(18).optional(),
});

export async function GET(req:NextRequest){
  const limit=rateLimit(clientKey(req,'champion-main-draft'),30,60_000);
  if(!limit.ok)return NextResponse.json(
    {ok:false,error:'Too many draft calculations. Wait a moment.'},
    {status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}},
  );

  const parsed=schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if(!parsed.success)return NextResponse.json({ok:false,error:'Choose your champion and at least one enemy.'},{status:400});

  const {champion,role,level=11}=parsed.data;
  const enemyNames=parsed.data.enemies.split(',').map(value=>value.trim()).filter(Boolean).slice(0,5);
  if(!enemyNames.length)return NextResponse.json({ok:false,error:'Choose at least one enemy champion.'},{status:400});

  try{
    const patch=await latestPatch();
    const roster=await championRoster(patch);
    const myId=await resolveChampionId(champion,patch);
    if(!myId)return NextResponse.json({ok:false,error:`No champion called "${champion}".`},{status:404});

    const enemyIds=await Promise.all(enemyNames.map(name=>resolveChampionId(name,patch)));
    if(enemyIds.some(id=>!id)){
      const bad=enemyNames[enemyIds.findIndex(id=>!id)];
      return NextResponse.json({ok:false,error:`No champion called "${bad}".`},{status:404});
    }

    const [you,items,abilityData,...enemyDetails]=await Promise.all([
      championDetail(myId,patch),
      itemCatalogue(patch),
      championAbilityDataset(myId),
      ...enemyIds.map(id=>championDetail(id!,patch)),
    ]);

    const plan=buildAdaptiveItemPlan({
      patch,
      you,
      role,
      allies:[],
      enemies:enemyDetails.map(detail=>({champion:detail.name,detail})),
      items,
    });

    const catalogue=toBuildItems(items,patch);
    const buildById=new Map(catalogue.map(item=>[item.id,item]));
    const reasons=new Map<number,string>();
    for(const item of [...plan.core,...(plan.draftItem?[plan.draftItem]:[]),...(plan.finish?[plan.finish]:[]),...(plan.boots?[plan.boots]:[]),...plan.swaps]){
      reasons.set(item.id,item.why);
    }

    const chosenIds:number[]=[];
    const push=(id:number|undefined|null)=>{
      if(id&&buildById.has(id)&&!chosenIds.includes(id)&&chosenIds.length<6)chosenIds.push(id);
    };
    plan.core.forEach(item=>push(item.id));
    push(plan.draftItem?.id);
    push(plan.finish?.id);
    push(plan.boots?.id);
    plan.swaps.forEach(item=>push(item.id));

    const recommended=chosenIds.map((id,index)=>{
      const item=buildById.get(id)!;
      const label=index<plan.core.length?'CORE'
        :id===plan.draftItem?.id?'DRAFT'
        :id===plan.finish?.id?'FINISH'
        :id===plan.boots?.id?'BOOTS'
        :'FLEX';
      return {...item,label,why:reasons.get(id)||'Best remaining fit for this enemy draft.'};
    });

    const snapshot=rawDamageSnapshot(
      you.stats,
      level,
      buildStats(recommended as BuildItem[]),
      abilityData,
    );

    return NextResponse.json({
      ok:true,
      patch,
      level,
      champion:you.name,
      confidence:plan.confidence,
      read:plan.read,
      enemyProfile:plan.enemyProfile,
      enemies:enemyDetails.map(detail=>({
        id:detail.id,
        name:detail.name,
        tags:detail.tags,
        damageType:damageType(detail.info),
        attackRange:detail.stats.attackrange,
      })),
      recommended,
      swaps:plan.swaps.map(item=>{
        const buildItem=buildById.get(item.id);
        return buildItem?{...buildItem,label:'SWAP',why:item.why}:null;
      }).filter(Boolean),
      damage:snapshot,
      rule:plan.rule,
      boundary:plan.boundary,
    });
  }catch{
    return NextResponse.json({ok:false,error:'Could not calculate the build for that enemy team.'},{status:502});
  }
}
