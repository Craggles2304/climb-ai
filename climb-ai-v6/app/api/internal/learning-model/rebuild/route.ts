import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {rebuildAllLearningProfiles} from '@/lib/server/proLearningRepository';
import {CURRENT_LEARNING_MODEL_VERSION} from '@/lib/learningModelVersion';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const JOB=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req:NextRequest){
  const jobId=String(req.nextUrl.searchParams.get('job')||'');
  if(!JOB.test(jobId))return NextResponse.json({ok:false,error:'Not found.'},{status:404,headers:{'cache-control':'no-store'}});
  const db=getSupabaseAdmin();
  if(!db)return NextResponse.json({ok:false,error:'Not found.'},{status:404,headers:{'cache-control':'no-store'}});

  const now=new Date().toISOString();
  const {data:job,error:claimError}=await db.from('op_learning_rebuild_jobs')
    .update({status:'RUNNING',started_at:now})
    .eq('id',jobId)
    .eq('status','PENDING')
    .gt('expires_at',now)
    .select('id,scope,requested_model_version')
    .maybeSingle();

  if(claimError)return NextResponse.json({ok:false,error:'Rebuild job could not be claimed.'},{status:409,headers:{'cache-control':'no-store'}});
  if(!job)return NextResponse.json({ok:false,error:'Not found or already used.'},{status:404,headers:{'cache-control':'no-store'}});

  if(Number(job.requested_model_version)!==CURRENT_LEARNING_MODEL_VERSION){
    await db.from('op_learning_rebuild_jobs').update({status:'FAILED',completed_at:new Date().toISOString(),error:'Learning model version mismatch.'}).eq('id',jobId);
    return NextResponse.json({ok:false,error:'Learning model version mismatch.'},{status:409,headers:{'cache-control':'no-store'}});
  }

  try{
    const result=await rebuildAllLearningProfiles();
    const complete=result.failed===0&&result.complete===result.total;
    await db.from('op_learning_rebuild_jobs').update({
      status:complete?'COMPLETE':'FAILED',
      completed_at:new Date().toISOString(),
      result,
      error:complete?null:'One or more learning profiles failed the completeness check.',
    }).eq('id',jobId);
    return NextResponse.json({ok:complete,result},{status:complete?200:409,headers:{'cache-control':'no-store'}});
  }catch(error){
    const message=error instanceof Error?error.message:'Learning profile rebuild failed.';
    await db.from('op_learning_rebuild_jobs').update({status:'FAILED',completed_at:new Date().toISOString(),error:message}).eq('id',jobId);
    return NextResponse.json({ok:false,error:message},{status:500,headers:{'cache-control':'no-store'}});
  }
}
