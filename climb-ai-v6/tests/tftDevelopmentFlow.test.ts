import {beforeEach,expect,test,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {NextRequest} from 'next/server';
const state=vi.hoisted(()=>({db:null as unknown as SupabaseClient,user:{id:'owner'} as {id:string}|null,device:{id:'device',userId:'owner',riotAccountId:'11111111-1111-4111-8111-111111111111',accountKey:'key',deviceName:'PC'} as any}));
vi.mock('../lib/server/supabaseAdmin',()=>({getSupabaseAdmin:()=>state.db}));
vi.mock('../lib/supabase/server',()=>({getCurrentUser:async()=>state.user}));
vi.mock('../lib/server/liveTrackerRepository',()=>({authenticateTrackerToken:async(token:string)=>token==='paired'?state.device:null}));
vi.mock('../lib/riot/client',()=>({riotEnabled:()=>false}));
import {GET} from '../app/api/tft/current-mission/route';
import {POST as ingest} from '../app/api/live/telemetry/route';
import {POST as review} from '../app/api/tft/review/route';
import {loadTftDevelopment} from '../lib/server/tftDevelopmentRepository';

// Supabase-shaped persistence adapter exercises the actual routes and repositories.
// This is fixture verification, not a claim about a real Windows capture or live DB.
class MemoryDb{
  tables:Record<string,any[]>={riot_accounts:[],tft_matches:[],tft_telemetry_sessions:[],tft_telemetry_points:[]};
  from(table:string){
    const db=this;let operation='select',payload:any,conflict='id',limit=1000,offset=0;const filters:Array<(row:any)=>boolean>=[];let sortKey='',ascending=true;
    const q:any={select(){return q},eq(k:string,v:any){filters.push(r=>r[k]===v);return q},in(k:string,v:any[]){filters.push(r=>v.includes(r[k]));return q},order(k:string,o:any){sortKey=k;ascending=o.ascending;return q},limit(n:number){limit=n;return q},range(from:number,to:number){offset=from;limit=to-from+1;return q},
      upsert(p:any,o:any){operation='upsert';payload=p;conflict=o?.onConflict??'id';return q},insert(p:any){operation='insert';payload=p;return q},update(p:any){operation='update';payload=p;return q},
      maybeSingle:async()=>{const r=run();return{...r,data:r.data[0]??null}},single:async()=>{const r=run();return{...r,data:r.data[0]??null}},then(resolve:any,reject:any){return Promise.resolve(run()).then(resolve,reject)}};
    function run(){
      const rows=db.tables[table]??=[];
      if(operation==='insert'||operation==='upsert')for(const p of Array.isArray(payload)?payload:[payload]){
        const old=operation==='upsert'?rows.find(r=>conflict.split(',').every(k=>r[k]===p[k])):null;
        if(old)Object.assign(old,p);else rows.push({id:crypto.randomUUID(),...structuredClone(p)});
      }
      let result=rows.filter(r=>filters.every(f=>f(r)));
      if(operation==='update')result.forEach(r=>Object.assign(r,structuredClone(payload)));
      if(sortKey)result=[...result].sort((a,b)=>(String(a[sortKey]).localeCompare(String(b[sortKey])))*(ascending?1:-1));
      return{data:structuredClone(result.slice(offset,offset+limit)),error:null};
    }
    return q;
  }
}
let db:MemoryDb;
const account='11111111-1111-4111-8111-111111111111';
const request=(body:unknown)=>new NextRequest('https://opclimb.com/api/live/telemetry',{method:'POST',headers:{authorization:'Bearer paired','content-type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{db=new MemoryDb();db.tables.riot_accounts=[{id:account,user_id:'owner'}];state.db=db as unknown as SupabaseClient;state.user={id:'owner'};});

test('START → checkpoints → END → website/Companion mission → saved review → DNA',async()=>{
  const first=await loadTftDevelopment('owner',account,state.db);expect(first.mission.progress).toBe(0);
  for(let i=0;i<3;i++){
    const pseudoMatchId='native-fixture-'+i;
    expect((await ingest(request({game:'TFT',action:'START',pseudoMatchId}))).status).toBe(200);
    for(const [j,round] of ['3-2','3-3'].entries())expect((await ingest(request({game:'TFT',action:'POINT',pseudoMatchId,point:{clientPointId:`${i}-${j}`,round,at:`2026-10-15T18:0${j}:00Z`,eventKind:'CHECKPOINT',gold:j?20:50,level:7,shopRefreshes:j?8:0}}))).status).toBe(202);
    const end={game:'TFT',action:'END',pseudoMatchId};
    expect((await (await ingest(request(end))).json()).evidenceReady).toBe(true);
    expect((await ingest(request(end))).status).toBe(202);
  }
  const web=await GET(new NextRequest('https://opclimb.com/api/tft/current-mission?accountId='+account));
  const companion=await GET(new NextRequest('https://opclimb.com/api/tft/current-mission',{headers:{authorization:'Bearer paired'}}));
  const a=await web.json(),b=await companion.json();expect(web.headers.get('cache-control')).toBe('private, no-store');expect(a.mission).toEqual(b.mission);expect(a.mission.progress).toBe(3);expect(a.profile.grade).toBeNull();expect(a.mission.verifiedMastery).toBe(false);
  const session=db.tables.tft_telemetry_sessions[0];
  const input={sessionId:session.id,skill:'BOARD_BUILDING',assessment:{round:'3-3',verdict:'HELPED',reason:'The new frontline kept both carries protected.'}};
  expect((await review(new NextRequest('https://opclimb.com/api/tft/review',{method:'POST',body:JSON.stringify(input)}))).status).toBe(200);
  // Repeated END must preserve a completed game's self-review and cannot double count.
  expect((await ingest(request({game:'TFT',action:'END',pseudoMatchId:session.pseudo_match_id}))).status).toBe(202);
  const updated=await loadTftDevelopment('owner',account,state.db);
  expect(updated.profile.skills.find(s=>s.key==='BOARD_BUILDING')?.basis).toBe('SELF_REVIEW');
  expect(updated.profile.skills.find(s=>s.key==='BOARD_BUILDING')?.score).toBe(100);
  expect(updated.profile.ilp.every(t=>t.verifiedProgress===0)).toBe(true);
});
test('empty recordings do not grade or progress and foreign accounts stay inaccessible',async()=>{
  await ingest(request({game:'TFT',action:'START',pseudoMatchId:'empty-fixture'}));
  const result=await (await ingest(request({game:'TFT',action:'END',pseudoMatchId:'empty-fixture'}))).json();expect(result.evidenceReady).toBe(false);
  expect((await loadTftDevelopment('owner',account,state.db)).recordedGames).toBe(0);
  expect((await GET(new NextRequest('https://opclimb.com/api/tft/current-mission?accountId=22222222-2222-4222-8222-222222222222'))).status).toBe(403);
  expect((await GET(new NextRequest('https://opclimb.com/api/tft/current-mission?accountId=22222222-2222-4222-8222-222222222222',{headers:{authorization:'Bearer paired'}}))).status).toBe(403);
  expect((await GET(new NextRequest('https://opclimb.com/api/tft/current-mission',{headers:{authorization:'Bearer revoked'}}))).status).toBe(401);
});
test('a review cannot target another user or invent a round',async()=>{
  db.tables.tft_telemetry_sessions=[{id:account,user_id:'someone-else',status:'COMPLETE',summary:{}}];
  const input={sessionId:account,skill:'ECONOMY',assessment:{round:'4-2',verdict:'HELPED',reason:'A sufficiently detailed self-review explanation.'}};
  expect((await review(new NextRequest('https://opclimb.com/api/tft/review',{method:'POST',body:JSON.stringify(input)}))).status).toBe(400);
  db.tables.tft_telemetry_sessions[0].user_id='owner';
  expect((await review(new NextRequest('https://opclimb.com/api/tft/review',{method:'POST',body:JSON.stringify(input)}))).status).toBe(400);
});

test('multi-game evidence reads page past the database 1000-row response cap',async()=>{
  const mission=(await loadTftDevelopment('owner',account,state.db)).mission;
  db.tables.tft_telemetry_sessions=[0,1].map(i=>({id:'session-'+i,user_id:'owner',riot_account_id:account,status:'COMPLETE',pseudo_match_id:'native-'+i,started_at:`2026-10-15T1${i}:00:00Z`,metadata:{developmentMission:mission},summary:{}}));
  db.tables.tft_telemetry_points=Array.from({length:1200},(_,i)=>({id:i,session_id:'session-'+Math.floor(i/600),client_point_id:String(i),observed_at:new Date(1792050000000+i*1000).toISOString(),round:i%2?'3-3':'3-2',gold:50}));
  const result=await loadTftDevelopment('owner',account,state.db);
  expect(result.recorded.map(r=>r.pointCount)).toEqual([600,600]);expect(result.mission.progress).toBe(2);
});
