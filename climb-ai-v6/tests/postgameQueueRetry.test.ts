import {describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({process:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/server/liveTrackerRepository',()=>({processQueuedPostGameSession:mocks.process}));
vi.mock('@/lib/server/supabaseAdmin',()=>({getSupabaseAdmin:()=>({rpc:mocks.rpc})}));
import {drainPostGameQueue} from '@/lib/server/postGameQueue';

describe('DNA save failures retain queued games',()=>{
 it('reports the failed job for retry and does not acknowledge it as complete',async()=>{
   const payload={type:'FINAL',snapshots:[{gameTime:1800}]};
   mocks.rpc.mockImplementation(async(name:string)=>name==='claim_live_postgame_jobs'
     ?{data:[{id:7,session_id:'session',attempts:1,payload}],error:null}:{error:null});
   mocks.process.mockRejectedValueOnce(new Error('Post-game DNA history was not saved; retry required.'));
   const result=await drainPostGameQueue({workerId:'test',limit:1});
   expect(result.failed).toBe(1);expect(result.completed).toBe(0);
   expect(mocks.process).toHaveBeenCalledWith('session',payload);
   expect(mocks.rpc).toHaveBeenCalledWith('finish_live_postgame_job',{
     p_job_id:7,p_ok:false,p_error:'Post-game DNA history was not saved; retry required.',
   });
 });
});
