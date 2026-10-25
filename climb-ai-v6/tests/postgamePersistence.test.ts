import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({summary:{processing:{status:'COMPLETE'},learningPlanSync:{status:'COMPLETE'}} as any,updates:[] as any[],queue:[] as any[]}));
vi.mock('@/lib/server/supabaseAdmin',()=>({getSupabaseAdmin:()=>({from:(table:string)=>{
  let mode='read';
  const q:any={
    insert:()=>{mode='insert';return q},select:()=>q,eq:()=>q,
    single:async()=>({data:null,error:{code:'23505'}}),
    maybeSingle:async()=>({data:{id:'saved-session',status:'COMPLETE',summary:state.summary},error:null}),
    update:(payload:any)=>{state.updates.push(payload);return q},
    upsert:async(payload:any)=>{state.queue.push({table,payload});return{error:null}},
    then:(resolve:any)=>resolve({error:null}),
  };return q;
}})}));
import {saveCompletedMatchBundle} from '@/lib/server/liveTrackerRepository';

describe('completed match upload retries',()=>{
  beforeEach(()=>{state.updates=[];state.queue=[]});
  it('does not erase saved DNA and analysis when an acknowledged game is uploaded again',async()=>{
    const result=await saveCompletedMatchBundle({id:'device',userId:'owner',riotAccountId:'account',accountKey:'key',deviceName:'PC'},
      {type:'FINAL',clientSessionId:'same-game',snapshots:[{gameTime:1800} as any]});
    expect(result.sessionId).toBe('saved-session');
    expect(state.updates).toEqual([]);
    expect(state.summary.learningPlanSync.status).toBe('COMPLETE');
    expect(state.queue[0].payload.session_id).toBe('saved-session');
  });
});
