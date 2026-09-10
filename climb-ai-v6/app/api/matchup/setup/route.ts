import {NextResponse} from 'next/server';
import {latestPatch} from '@/lib/champions/source';
import {matchupSetupCatalogue} from '@/lib/combat/setupSource';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(){
  try{
    const patch=await latestPatch();
    const setup=await matchupSetupCatalogue(patch);
    return NextResponse.json({ok:true,patch,...setup});
  }catch(err){
    return NextResponse.json({
      ok:false,
      error:err instanceof Error?err.message:'Could not load matchup setup data.',
    },{status:502});
  }
}
