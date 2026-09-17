import {NextRequest,NextResponse} from 'next/server';
import {GET as coreGET} from './route-core';
import {buildRememberPlan} from '@/lib/champions/rememberPlan';
import {championRoster,latestPatch} from '@/lib/champions/source';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  const response=await coreGET(req);
  if(!response.ok)return response;

  const data=await response.clone().json().catch(()=>null) as any;
  if(!data?.ok||!data?.ready||!data?.teamPlan)return response;

  let roster:any=null;
  try{
    const patch=String(data?.plan?.patch??'').trim()||await latestPatch();
    roster=await championRoster(patch);
  }catch{
    // The remember screen can still be built without the optional damage mix.
  }

  const remember=buildRememberPlan({
    champion:String(data?.champion??data?.plan?.you?.name??'YOU'),
    role:data?.role??data?.plan?.role??null,
    rank:data?.coachLevel?.rank??data?.teamPlan?.coachLevel?.rank??null,
    teamPlan:data.teamPlan,
    roster,
  });
  const paid=Boolean(data?.strategyAccess?.paidStrategy??data?.teamPlan?.strategyAccess?.paidStrategy);
  const teamPlan={
    ...data.teamPlan,
    resourceTarget:remember.resourceTarget,
    rememberPlan:paid?remember:null,
  };

  return NextResponse.json({...data,teamPlan},{status:response.status});
}
