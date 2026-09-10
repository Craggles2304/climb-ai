import {NextResponse} from 'next/server';
import {latestPatch} from '@/lib/champions/source';
import {matchupItemCatalogue} from '@/lib/combat/itemSource';
import {itemSummary,type MatchupItem} from '@/lib/combat/itemLoadout';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(){
  try{
    const patch=await latestPatch();
    const catalogue=await matchupItemCatalogue(patch) as Record<string,MatchupItem>;
    const items=Object.entries(catalogue)
      .map(([id,item])=>itemSummary(Number(id),item))
      .filter(item=>Number.isFinite(item.id))
      .sort((a,b)=>a.name.localeCompare(b.name));

    return NextResponse.json({ok:true,patch,items});
  }catch{
    return NextResponse.json({ok:false,error:'Could not load the item catalogue.'},{status:502});
  }
}
