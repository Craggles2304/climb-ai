import {describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({latest:vi.fn()}));
vi.mock('@/lib/server/liveTrackerRepository',()=>({authenticateTrackerToken:async()=>({userId:'owner',accountKey:'account',riotAccountId:'riot'})}));
vi.mock('@/lib/server/liveReadRepository',()=>({latestLiveRead:mocks.latest}));
import {GET} from '@/app/api/live/companion-review/route';

describe('post-game review waits for persisted DNA',()=>{
  it.each(['QUEUED','PROCESSING'])('keeps polling while the accepted upload is %s',async (status:string)=>{
    mocks.latest.mockResolvedValue({status:'COMPLETE',summary:{processing:{status}}});
    const response=await GET(new NextRequest('https://opclimb.com/api/live/companion-review',{headers:{authorization:'Bearer test'}}));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ok:true,ready:false,processing:true});
  });
});
