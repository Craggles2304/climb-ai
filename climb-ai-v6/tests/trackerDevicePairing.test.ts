import {describe,expect,it,vi,beforeEach} from 'vitest';

const mocks=vi.hoisted(()=>({db:null as any}));
vi.mock('@/lib/server/supabaseAdmin',()=>({getSupabaseAdmin:()=>mocks.db}));

import {retireSupersededDevices} from '@/lib/server/liveTrackerRepository';
import {claimDesktopPairCode,createDesktopPairCode} from '@/lib/server/liveTrackerPairingRepository';

type Row=Record<string,any>;

/**
 * A Supabase query builder that records what it was asked to do. The point of
 * these tests is which rows the pairing writes touch, so the filters matter as
 * much as the values and both are asserted.
 */
function fakeDb(tables:Record<string,Row[]>){
  const writes:Array<{table:string;op:string;filters:Row[];values:Row|null;rows:Row[]}>=[];
  function builder(table:string){
    let op='select',values:Row|null=null;
    const filters:Row[]=[];
    let limit=Infinity;
    const run=()=>{
      let rows=(tables[table]??[]).filter(row=>filters.every(f=>{
        if(f.kind==='eq')return row[f.column]===f.value;
        if(f.kind==='neq')return row[f.column]!==f.value;
        if(f.kind==='is')return (row[f.column]??null)===f.value;
        if(f.kind==='notIs')return (row[f.column]??null)!==f.value;
        return true;
      }));
      if(op==='insert'){const created={id:`generated-${(tables[table]??[]).length+1}`,...values};(tables[table]??=[]).push(created);rows=[created]}
      if(op==='update')rows.forEach(row=>Object.assign(row,values));
      if(rows.length>limit)rows=rows.slice(0,limit);
      if(op!=='select')writes.push({table,op,filters:[...filters],values,rows:rows.map(row=>({...row}))});
      return rows;
    };
    const api:any={
      select(){return api},
      insert(next:Row){op='insert';values=next;return api},
      update(next:Row){op='update';values=next;return api},
      eq(column:string,value:unknown){filters.push({kind:'eq',column,value});return api},
      neq(column:string,value:unknown){filters.push({kind:'neq',column,value});return api},
      is(column:string,value:unknown){filters.push({kind:'is',column,value});return api},
      not(column:string,_operator:string,value:unknown){filters.push({kind:'notIs',column,value});return api},
      order(){return api},
      limit(count:number){limit=count;return api},
      upsert(next:Row){op='upsert';values=next;return api},
      maybeSingle(){const rows=run();return Promise.resolve({data:rows[0]??null,error:null})},
      single(){const rows=run();return Promise.resolve({data:rows[0]??null,error:rows[0]?null:{message:'no row'}})},
      then(resolve:(value:{data:Row[];error:null})=>unknown){const rows=run();return Promise.resolve(resolve({data:rows,error:null}))},
    };
    return api;
  }
  return{client:{from:(table:string)=>builder(table)},tables,writes};
}

const USER='user-1';
const DEVICE='My Windows PC';

beforeEach(()=>{mocks.db=null});

describe('one live device row per PC',()=>{
  it('retires the other live rows for the same PC and leaves the kept one alone',async()=>{
    const fake=fakeDb({live_tracker_devices:[
      {id:'old-a',user_id:USER,device_name:DEVICE,revoked_at:null},
      {id:'old-b',user_id:USER,device_name:DEVICE,revoked_at:null},
      {id:'keep',user_id:USER,device_name:DEVICE,revoked_at:null},
    ]});
    const retired=await retireSupersededDevices(fake.client as any,{userId:USER,deviceName:DEVICE,keepId:'keep'});

    expect(retired.sort()).toEqual(['old-a','old-b']);
    const rows=fake.tables.live_tracker_devices;
    expect(rows.find(row=>row.id==='keep')!.revoked_at).toBeNull();
    expect(rows.filter(row=>row.revoked_at!==null).map(row=>row.id).sort()).toEqual(['old-a','old-b']);
  });

  it('does not reach across users or across PCs',async()=>{
    const fake=fakeDb({live_tracker_devices:[
      {id:'other-user',user_id:'user-2',device_name:DEVICE,revoked_at:null},
      {id:'other-pc',user_id:USER,device_name:'Laptop',revoked_at:null},
      {id:'keep',user_id:USER,device_name:DEVICE,revoked_at:null},
    ]});
    const retired=await retireSupersededDevices(fake.client as any,{userId:USER,deviceName:DEVICE,keepId:'keep'});

    expect(retired).toEqual([]);
    expect(fake.tables.live_tracker_devices.every(row=>row.revoked_at===null)).toBe(true);
  });

  it('leaves an already revoked row as it was',async()=>{
    const fake=fakeDb({live_tracker_devices:[
      {id:'revoked',user_id:USER,device_name:DEVICE,revoked_at:'2026-10-01T00:00:00.000Z'},
      {id:'keep',user_id:USER,device_name:DEVICE,revoked_at:null},
    ]});
    await retireSupersededDevices(fake.client as any,{userId:USER,deviceName:DEVICE,keepId:'keep'});

    expect(fake.tables.live_tracker_devices.find(row=>row.id==='revoked')!.revoked_at).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('requesting a pair code',()=>{
  const riotProfile={gameName:'Craggles',tagline:'EUW',region:'EUW'};

  function pairingDb(devices:Row[]){
    const fake=fakeDb({
      riot_accounts:[{id:'account-1',user_id:USER,game_name:'Craggles',tagline:'EUW',region:'EUW',is_primary:true}],
      profiles:[],
      live_tracker_devices:devices,
    });
    mocks.db=fake.client;
    return fake;
  }

  it('reuses the unclaimed code row instead of inserting another',async()=>{
    const fake=pairingDb([{
      id:'pending',user_id:USER,device_name:DEVICE,account_key:'account-1',
      revoked_at:'2026-10-27T11:00:00.000Z',token_hash:'old-code-hash',
      tracker_status:{state:'PAIRING',pairing:true,expiresAt:'2026-10-27T11:10:00.000Z'},
    }]);
    const result=await createDesktopPairCode(USER,'account-1',DEVICE,riotProfile as any);

    expect(result.pendingDeviceId).toBe('pending');
    expect(fake.tables.live_tracker_devices).toHaveLength(1);
    expect(fake.writes.some(write=>write.table==='live_tracker_devices'&&write.op==='insert')).toBe(false);
    expect(fake.tables.live_tracker_devices[0].token_hash).not.toBe('old-code-hash');
  });

  it('inserts when the PC has no unclaimed code waiting',async()=>{
    const fake=pairingDb([]);
    const result=await createDesktopPairCode(USER,'account-1',DEVICE,riotProfile as any);

    expect(fake.tables.live_tracker_devices).toHaveLength(1);
    expect(result.pendingDeviceId).toBe(fake.tables.live_tracker_devices[0].id);
  });

  it('does not reuse a live device row as if it were a pending code',async()=>{
    const fake=pairingDb([{
      id:'live',user_id:USER,device_name:DEVICE,account_key:'account-1',
      revoked_at:null,token_hash:'live-token-hash',tracker_status:{state:'WAITING',pairing:false},
    }]);
    await createDesktopPairCode(USER,'account-1',DEVICE,riotProfile as any);

    expect(fake.tables.live_tracker_devices).toHaveLength(2);
    expect(fake.tables.live_tracker_devices.find(row=>row.id==='live')!.token_hash).toBe('live-token-hash');
  });
});

describe('claiming a pair code', ()=>{
  it('retires the previous live row so only the new pairing authenticates',async()=>{
    const expiresAt=new Date(Date.now()+5*60*1000).toISOString();
    // The code the Companion is about to type in. createDesktopPairCode stores
    // its sha256, so the test drives the claim through the real hash.
    const code='ABCD-EFGH-JKLM';
    const {createHash}=await import('node:crypto');
    const codeHash=createHash('sha256').update('ABCDEFGHJKLM').digest('hex');

    const fake=fakeDb({
      riot_accounts:[{id:'account-1',user_id:USER}],
      live_tracker_devices:[
        {id:'stale',user_id:USER,device_name:DEVICE,account_key:'old-account',riot_account_id:'account-old',revoked_at:null,token_hash:'stale-token'},
        {id:'pending',user_id:USER,device_name:DEVICE,account_key:'account-1',riot_account_id:'account-1',
         revoked_at:'2026-10-27T11:00:00.000Z',token_hash:codeHash,
         tracker_status:{state:'PAIRING',pairing:true,expiresAt}},
      ],
    });
    mocks.db=fake.client;

    const claimed=await claimDesktopPairCode(code);

    expect(claimed).not.toBeNull();
    const rows=fake.tables.live_tracker_devices;
    expect(rows.find(row=>row.id==='pending')!.revoked_at).toBeNull();
    expect(rows.find(row=>row.id==='stale')!.revoked_at).not.toBeNull();
    expect(rows.filter(row=>row.revoked_at===null)).toHaveLength(1);
  });
});
