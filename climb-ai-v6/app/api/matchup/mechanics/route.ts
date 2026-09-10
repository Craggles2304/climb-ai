import {NextResponse} from 'next/server';
import {latestPatch} from '@/lib/champions/source';
import {supportedChampionMechanics} from '@/lib/combat/championEffects';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/**
 * Machine-readable coverage endpoint for the specialist mechanics library.
 * This is deliberately separate from /simulate so coverage can be audited
 * without pretending an unsupported champion state has a deterministic value.
 */
export async function GET(){
  try{
    const patch=await latestPatch();
    const champions=supportedChampionMechanics();
    const exact=champions.reduce((n,c)=>n+c.exact,0);
    const partial=champions.reduce((n,c)=>n+c.partial,0);
    const mechanicKinds=[...new Set(champions.flatMap(c=>c.mechanics))].sort();

    return NextResponse.json({
      ok:true,
      patch,
      summary:{
        specialistChampions:champions.length,
        exactStates:exact,
        partialStates:partial,
        mechanicKinds:mechanicKinds.length,
      },
      mechanicKinds,
      champions,
      policy:{
        exact:'Changes the deterministic result with a supported calculation.',
        partial:'The state is understood, but at least one material part is intentionally not converted into a guessed number.',
      },
    });
  }catch{
    return NextResponse.json({ok:false,error:'Could not load mechanics coverage.'},{status:502});
  }
}