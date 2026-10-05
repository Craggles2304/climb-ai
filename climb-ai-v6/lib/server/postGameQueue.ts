import 'server-only';
import {randomUUID} from 'node:crypto';
import {getSupabaseAdmin} from './supabaseAdmin';
import {processQueuedPostGameSession} from './liveTrackerRepository';

interface QueueJob{
  id:number;
  session_id:string;
  attempts:number;
  payload:unknown;
}

export async function drainPostGameQueue(input:{limit?:number;concurrency?:number;workerId?:string}={}){
  const db=getSupabaseAdmin();
  if(!db)throw new Error('Supabase is not configured.');
  const limit=Math.max(1,Math.min(30,Math.floor(input.limit??12)));
  const concurrency=Math.max(1,Math.min(6,Math.floor(input.concurrency??3)));
  const workerId=input.workerId??('vercel-'+randomUUID());

  const {data,error}=await db.rpc('claim_live_postgame_jobs',{
    p_worker_id:workerId,
    p_limit:limit,
  });
  if(error)throw new Error(error.message);
  const jobs=((data??[]) as QueueJob[]).filter(job=>job?.id&&job?.session_id);
  let cursor=0,completed=0,failed=0;

  async function runWorker(){
    while(true){
      const job=jobs[cursor++];
      if(!job)return;
      try{
        await processQueuedPostGameSession(job.session_id,(job.payload&&typeof job.payload==='object')?job.payload as any:undefined);
        const {error:finishError}=await db.rpc('finish_live_postgame_job',{
          p_job_id:job.id,
          p_ok:true,
          p_error:null,
        });
        if(finishError)throw new Error(finishError.message);
        completed++;
      }catch(error){
        failed++;
        const message=error instanceof Error?error.message:String(error);
        console.error('[postgame-queue] job failed',job.id,job.session_id,message);
        await db.rpc('finish_live_postgame_job',{
          p_job_id:job.id,
          p_ok:false,
          p_error:message,
        }).catch(()=>null);
      }
    }
  }

  await Promise.all(Array.from({length:Math.min(concurrency,jobs.length)},()=>runWorker()));
  return{workerId,claimed:jobs.length,completed,failed};
}
