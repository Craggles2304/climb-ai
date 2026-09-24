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

  const paid=Boolean(data?.strategyAccess?.paidStrategy??data?.teamPlan?.strategyAccess?.paidStrategy);
  // Core route already redacts paid win/loss fields for FREE. Build the memory HUD
  // from that already-redacted payload so every player gets the in-game screen
  // without leaking PLUS/PRO strategy.
  const rememberBase=buildRememberPlan({
    champion:String(data?.champion??data?.plan?.you?.name??'YOU'),
    role:data?.role??data?.plan?.role??null,
    rank:data?.coachLevel?.rank??data?.teamPlan?.coachLevel?.rank??null,
    teamPlan:data.teamPlan,
    roster,
  });

  // Freeze the visible draft into the same memory object. The desktop companion
  // may stop receiving champ-select context after the game starts, so the live
  // coaching board must not lose THEIR TEAM, the named draft threats or damage
  // targets when it switches from champ select to RECORDING.
  const remember={
    ...rememberBase,
    draftTeams:{
      ours:Array.isArray(data?.teamPlan?.ourTeam)?data.teamPlan.ourTeam:[],
      theirs:Array.isArray(data?.teamPlan?.theirTeam)?data.teamPlan.theirTeam:[],
    },
    draftThreats:paid&&Array.isArray(data?.teamPlan?.compositionRead?.enemyThreats)
      ?data.teamPlan.compositionRead.enemyThreats
      :[],
    draftDamageCore:paid&&Array.isArray(data?.teamPlan?.compositionRead?.enemyDamageCore)
      ?data.teamPlan.compositionRead.enemyDamageCore
      :[],
    draftTheirWinCondition:paid?data?.teamPlan?.theirWinCondition??null:null,
    draftBiggestThrow:paid?data?.teamPlan?.biggestThrow??null:null,
    adaptiveBuild:data?.teamPlan?.adaptiveBuild??data?.adaptiveBuild??null,
  };

  const teamPlan={
    ...data.teamPlan,
    resourceTarget:remember.resourceTarget,
    rememberPlan:remember,
    rememberPlanAccess:paid?'FULL':'SIMPLE',
  };

  return NextResponse.json({...data,teamPlan},{status:response.status});
}
