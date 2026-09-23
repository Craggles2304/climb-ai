import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getServerClient} from '@/lib/supabase/server';
import {getFoundingBetaValidation} from '@/lib/server/foundingBetaValidation';
import {getBetaOperationsSnapshot} from '@/lib/server/betaOperations';
import {
  betaMetricValue,
  finishBetaExperiment,
  getBetaExperiments,
  startBetaExperiment,
} from '@/lib/server/betaExperimentRepository';

export const runtime='nodejs';
export const dynamic='force-dynamic';

async function founder(){
  const supabase=await getServerClient();
  if(!supabase)return null;
  const {data:userData}=await supabase.auth.getUser();
  const user=userData.user;
  if(!user)return null;
  const {data:profile}=await supabase.from('profiles').select('is_founder').eq('id',user.id).maybeSingle();
  return profile?.is_founder?user:null;
}

export async function GET(){
  const user=await founder();
  if(!user)return NextResponse.json({ok:false,error:'Not found.'},{status:404});
  const [experiments,ops,report]=await Promise.all([
    getBetaExperiments(),
    getBetaOperationsSnapshot(),
    getFoundingBetaValidation(45),
  ]);
  const activeCurrent=experiments.active?betaMetricValue(report,experiments.active.metricKey):null;
  return NextResponse.json({ok:true,...experiments,recommendation:ops.recommendedExperiment,activeCurrent});
}

const startSchema=z.object({action:z.literal('START_RECOMMENDED')});

export async function POST(req:NextRequest){
  const user=await founder();
  if(!user)return NextResponse.json({ok:false,error:'Not found.'},{status:404});
  try{startSchema.parse(await req.json())}catch{return NextResponse.json({ok:false,error:'Malformed experiment request.'},{status:400})}
  const [existing,ops,report]=await Promise.all([
    getBetaExperiments(),
    getBetaOperationsSnapshot(),
    getFoundingBetaValidation(45),
  ]);
  if(existing.active)return NextResponse.json({ok:false,error:'Finish or cancel the active beta experiment first.'},{status:409});
  const recommendation=ops.recommendedExperiment;
  if(!recommendation)return NextResponse.json({ok:false,error:'There is no measurable rescue blocker to test yet.'},{status:409});
  try{
    const experiment=await startBetaExperiment({
      recommendation,
      baselineValue:betaMetricValue(report,recommendation.metricKey),
      createdBy:user.id,
    });
    return NextResponse.json({ok:true,experiment});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not start beta experiment.'},{status:500});
  }
}

const finishSchema=z.object({
  id:z.string().uuid(),
  action:z.enum(['COMPLETE','CANCELLED']),
});

export async function PATCH(req:NextRequest){
  const user=await founder();
  if(!user)return NextResponse.json({ok:false,error:'Not found.'},{status:404});
  let input:z.infer<typeof finishSchema>;
  try{input=finishSchema.parse(await req.json())}catch{return NextResponse.json({ok:false,error:'Malformed experiment update.'},{status:400})}
  const experiments=await getBetaExperiments();
  const active=experiments.active;
  if(!active||active.id!==input.id)return NextResponse.json({ok:false,error:'Active experiment not found.'},{status:404});
  const report=await getFoundingBetaValidation(45);
  try{
    const experiment=await finishBetaExperiment({
      id:input.id,
      currentValue:betaMetricValue(report,active.metricKey),
      actorId:user.id,
      action:input.action,
    });
    return NextResponse.json({ok:true,experiment});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not close beta experiment.'},{status:500});
  }
}
