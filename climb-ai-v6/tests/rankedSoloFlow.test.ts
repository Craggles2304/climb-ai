import fs from 'node:fs';
import {beforeEach,expect,test,vi} from 'vitest';
import {isRankedSolo,recordedQueueId,rankedEligibility,scopeMissionsToRanked,RANKED_SOLO_SCOPE} from '../lib/rankedSolo';
import type {ILPTask} from '../lib/types';
const state=vi.hoisted(()=>({db:null as any,user:{id:'owner'} as {id:string}|null}));
vi.mock('server-only',()=>({}));
vi.mock('../lib/server/supabaseAdmin',()=>({getSupabaseAdmin:()=>state.db}));
vi.mock('../lib/supabase/server',()=>({getCurrentUser:async()=>state.user}));
vi.mock('../lib/riot/client',()=>({riotEnabled:()=>false}));
import {companionDnaBaseline} from '../lib/server/companionDnaBaseline';
import {persistProMatchAnalysis} from '../lib/server/proLearningRepository';
import {processQueuedPostGameSession,saveCompletedMatchBundle} from '../lib/server/liveTrackerRepository';
import {syncAndLoadProgression} from '../lib/server/playerProgressionRepository';
import {resolveSoloRank} from '../lib/server/soloRank';
import {POST as manualMatch} from '../app/api/matches/manual/route';

class MemoryDb{
  tables:Record<string,any[]>={};
  from(table:string){
    const db=this;let op='read',payload:any,conflict='id',limit=1000;const filters:Array<(r:any)=>boolean>=[];
    const field=(r:any,k:string)=>k.includes('->>')?String(r[k.split('->>')[0]]?.[k.split('->>')[1]]):r[k];
    const q:any={select(){return q},eq(k:string,v:any){filters.push(r=>field(r,k)===v);return q},in(k:string,v:any[]){filters.push(r=>v.includes(r[k]));return q},order(){return q},like(k:string,v:string){filters.push(r=>String(r[k]??'').startsWith(v.replace('%','')));return q},is(k:string,v:any){filters.push(r=>(r[k]??null)===v);return q},
      // PostgREST .or() with the two shapes the app uses: "col.eq.v" and
      // "and(col.is.null,col.lt.v)". Enough to exercise baseline eligibility.
      or(expr:string){
        const clauses:Array<(r:any)=>boolean>=[];
        for(const part of String(expr).split(/,(?![^(]*\))/)){
          const and=part.match(/^and\((.+)\)$/);
          const terms=(and?and[1].split(','):[part]).map(term=>{
            const [col,op,...rest]=term.split('.');
            const raw=rest.join('.');
            if(op==='is')return (r:any)=>(r[col]??null)===(raw==='null'?null:raw);
            if(op==='eq')return (r:any)=>String(r[col]??'')===raw;
            if(op==='lt')return (r:any)=>String(r[col]??'')<raw;
            return ()=>false;
          });
          clauses.push(r=>terms.every(fn=>fn(r)));
        }
        filters.push(r=>clauses.some(fn=>fn(r)));
        return q;
      },limit(n:number){limit=n;return q},
      insert(p:any){op='insert';payload=p;return q},upsert(p:any,o:any){op='upsert';payload=p;conflict=o?.onConflict??'id';return q},update(p:any){op='update';payload=p;return q},
      maybeSingle:async()=>{const r=run();return{...r,data:r.data[0]??null}},single:async()=>{const r=run();return{...r,data:r.data[0]??null}},then(resolve:any,reject:any){return Promise.resolve(run()).then(resolve,reject)}};
    function run(){
      const rows=db.tables[table]??=[];
      if(op==='insert'||op==='upsert')for(const p of Array.isArray(payload)?payload:[payload]){
        const old=op==='upsert'?rows.find(r=>conflict.split(',').every(k=>r[k]===p[k])):null;
        if(old)Object.assign(old,p);else rows.push({id:crypto.randomUUID(),created_at:'2026-10-25T10:00:00Z',...structuredClone(p)});
      }
      const result=rows.filter(r=>filters.every(f=>f(r)));
      if(op==='update')result.forEach(r=>Object.assign(r,structuredClone(payload)));
      return{data:structuredClone(result.slice(0,limit)),error:null};
    }
    return q;
  }
}
const soloId='11111111-1111-4111-8111-111111111111',flexId='22222222-2222-4222-8222-222222222222';
const account='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const receipt={version:2,state:'BANKED',measurementSource:'LIVE_MEASURABLE',metric:'csPerMin',metricLabel:'CS/min',observedValue:8,observedValueLabel:'8',targetLabel:'6+',confidence:'HIGH',opportunities:1,successes:1,misses:0,events:[{atSeconds:900,label:'Farm',detail:'8 CS/min recorded'}],reconstruction:{kind:'MATCH_METRIC',fields:['csPerMin'],formula:'8 >= 6'},reason:'Recorded'};
function task(id:string,matchId:string):ILPTask{return{id,accountId:account,title:'Farm',dnaDomain:'WAVES_CS',category:'FARMING',metric:'csPerMin',target:'6+',progress:33,status:'ACTIVE',masteryRequired:3,queueScope:RANKED_SOLO_SCOPE,missionHistory:[{matchId,at:'2026-10-25T10:00:00Z',adherence:'TRACKED',clearedBar:true,banksPass:true,outcome:'CONFIRMED',source:'TRACKED',evidenceV2:receipt}]} as ILPTask}
beforeEach(()=>{state.db=new MemoryDb();state.user={id:'owner'}});

test('only explicit queue 420 qualifies; CLASSIC and unknown modes never imply ranked',()=>{
  for(const queue of [440,400,450,700,1100,0,null,undefined,'420'])expect(isRankedSolo(queue)).toBe(false);
  expect(isRankedSolo(420)).toBe(true);
  expect(recordedQueueId([{queueId:420},{}])).toBe(420);
  expect(recordedQueueId([{queueId:420},{queueId:440}])).toBeNull();
  expect(recordedQueueId([{}])).toBeNull();
  expect(rankedEligibility(null).eligible).toBe(false);
});
test('baseline counts owned Solo/Duo plus legacy games, and nothing else',async()=>{
  // Games recorded before queue identity existed cannot be proved ranked, but
  // they were watched, so they count towards the baseline only. A NULL written
  // after the cutover is a bug, not history, and must not be let in.
  state.db.tables.matches=[
    {id:soloId,user_id:'owner',riot_account_id:account,queue_id:420,role:'ADC',result:'WIN',duration_seconds:1800,created_at:'2026-10-26T10:00:00Z'},
    {id:flexId,user_id:'owner',riot_account_id:account,queue_id:440,role:'ADC',result:'WIN',duration_seconds:1800,created_at:'2026-10-20T10:00:00Z'},
    {id:'legacy',user_id:'owner',riot_account_id:account,queue_id:null,role:'ADC',result:'WIN',duration_seconds:1800,created_at:'2026-10-20T10:00:00Z'},
    {id:'null-after-cutover',user_id:'owner',riot_account_id:account,queue_id:null,role:'ADC',result:'WIN',duration_seconds:1800,created_at:'2026-10-27T10:00:00Z'},
    {id:'foreign',user_id:'other',riot_account_id:account,queue_id:420,role:'ADC',result:'WIN',duration_seconds:1800,created_at:'2026-10-26T10:00:00Z'},
  ];
  expect(await companionDnaBaseline({userId:'owner',riotAccountId:account,role:'ADC'})).toMatchObject({games:2,ready:false});
});

test('a legacy game never becomes mission proof',async()=>{
  // Baseline eligibility is deliberately wider than proof. The proof path still
  // demands queue 420, so an unverifiable game can start you off but can never
  // claim ranked progress.
  const repo=fs.readFileSync('lib/server/proLearningRepository.ts','utf8');
  expect(repo).toContain("if(!isRankedSolo(input.analysis.queueId))return null;");
  const baseline=fs.readFileSync('lib/server/companionDnaBaseline.ts','utf8');
  expect(baseline).toContain('BASELINE_ELIGIBLE');
  expect(baseline).not.toContain("eq('queue_id',420)");
});
test('real analysis persistence excludes other queues and saves the ranked queue',async()=>{
  const input:any={userId:'owner',riotAccountId:account,matchId:soloId,sessionId:null,champion:'Jinx',role:'ADC',analysis:{version:1,queueId:440,evidenceSources:[]}};
  expect(await persistProMatchAnalysis(input)).toBeNull();
  await persistProMatchAnalysis({...input,analysis:{...input.analysis,queueId:420}});
  expect(state.db.tables.op_match_analysis).toHaveLength(1);
  expect(state.db.tables.op_match_analysis[0].queue_id).toBe(420);
});
test.each([440,400,450,null])('queue %s finalizes as excluded without generating a match or XP',async(queueId:number|null)=>{
  state.db.tables.live_telemetry_sessions=[{id:'capture',user_id:'owner',riot_account_id:account,patch:'16.21',game_version:'16.21.1',summary:{}}];
  await processQueuedPostGameSession('capture',{type:'FINAL',clientSessionId:'capture-client',snapshots:[{queueId,gameTime:1800} as any]});
  expect(state.db.tables.live_telemetry_sessions[0].summary.rankedEligibility.eligible).toBe(false);
  expect(state.db.tables.live_telemetry_sessions[0].summary.processing.status).toBe('COMPLETE');
  expect(state.db.tables.matches??[]).toHaveLength(0);
  expect(state.db.tables.player_xp_ledger??[]).toHaveLength(0);
});
test('ranked capture saves queue identity and queues the original recording',async()=>{
  const device:any={id:'pc',userId:'owner',riotAccountId:account,accountKey:account,deviceName:'PC'};
  await saveCompletedMatchBundle(device,{type:'FINAL',clientSessionId:'ranked-client',snapshots:[{queueId:420,gameTime:1800} as any]});
  expect(state.db.tables.live_telemetry_sessions[0].queue_id).toBe(420);
  expect(state.db.tables.live_postgame_jobs[0].payload.snapshots[0].queueId).toBe(420);
});
test('mission reconciliation removes unverified credit while preserving its original evidence',()=>{
  const old={...task('mission',flexId),queueScope:undefined,status:'MASTERED' as const,progress:100};
  const scoped=scopeMissionsToRanked([old],new Set([soloId]))[0];
  expect(scoped.status).toBe('ACTIVE');expect(scoped.progress).toBe(0);
  expect(scoped.missionHistory).toEqual([]);
  expect(scoped.queueScopeArchive?.missionHistory[0].matchId).toBe(flexId);
  expect(old.missionHistory).toHaveLength(1);
});
test('XP independently checks the stored ranked match, even with a valid-looking receipt',async()=>{
  state.db.tables.matches=[{id:soloId,user_id:'owner',riot_account_id:account,queue_id:420,deaths:1},{id:flexId,user_id:'owner',riot_account_id:account,queue_id:440,deaths:1}];
  state.db.tables.match_metrics=[{match_id:soloId,user_id:'owner',cs_per_min:8},{match_id:flexId,user_id:'owner',cs_per_min:8}];
  state.db.tables.ilp_tasks=[{id:'solo',user_id:'owner',riot_account_id:account,payload:task('solo',soloId)},{id:'flex',user_id:'owner',riot_account_id:account,payload:task('flex',flexId)}];
  const result=await syncAndLoadProgression(state.db,'owner');
  expect(result.recent).toHaveLength(1);expect(result.recent[0].matchId).toBe(soloId);
});
test('secondary accounts do not inherit the primary profile rank',async()=>{
  state.db.tables.riot_accounts=[{id:account,user_id:'owner',is_primary:false,rank_tier:null}];
  state.db.tables.profiles=[{id:'owner',rank:'Diamond I'}];
  expect(await resolveSoloRank(state.db,'owner',account)).toBe('UNRANKED');
  state.db.tables.riot_accounts[0].rank_tier='GOLD';state.db.tables.riot_accounts[0].rank_division='IV';
  expect(await resolveSoloRank(state.db,'owner',account)).toBe('GOLD IV');
});
test('manual scoreboards cannot enter ranked progression',async()=>{
  expect((await manualMatch()).status).toBe(409);
  state.user=null;expect((await manualMatch()).status).toBe(401);
});

test('a Solo/Duo FINAL bundle produces a linked match, review, rank and mission profile',async()=>{
  state.db.tables.riot_accounts=[{id:account,user_id:'owner',is_primary:true,role:'ADC',rank_tier:'GOLD',rank_division:'IV'}];
  const player=(i:number)=>({summonerName:'Player'+i,riotId:'Player'+i+'#EUW',championName:i===0?'Jinx':'Ashe',team:i<5?'ORDER':'CHAOS',level:12,position:i===0?'ADC':null,isDead:false,respawnTimer:0,itemGold:2000,items:[],scores:{kills:5,deaths:2,assists:4,creepScore:180,wardScore:15}});
  const players=Array.from({length:10},(_,i)=>player(i));
  const frame=(time:number):any=>({version:1,queueId:420,gameTime:time,gameMode:'CLASSIC',mapName:'Map11',receivedAt:'2026-10-25T10:00:00Z',active:{...players[0],currentGold:200,stats:{currentHealth:1000,maxHealth:1000,currentMana:500,maxMana:500,attackDamage:100,attackSpeed:1,abilityPower:0,armor:50,magicResist:40,moveSpeed:330}},players,events:time===1800?[{id:1,name:'GameEnd',time,actor:null,target:null,raw:{Result:'Win'}}]:[]});
  const snapshots=[frame(600),frame(1800)];
  const device:any={id:'pc',userId:'owner',riotAccountId:account,accountKey:account,deviceName:'PC'};
  const envelope:any={type:'FINAL',clientSessionId:'ranked-complete',snapshots};
  const saved=await saveCompletedMatchBundle(device,envelope);
  const session=state.db.tables.live_telemetry_sessions[0];session.patch='16.21';session.game_version='16.21.1';
  await processQueuedPostGameSession(saved.sessionId!,envelope);
  expect(state.db.tables.matches).toHaveLength(1);
  expect(state.db.tables.matches[0]).toMatchObject({queue_id:420,rank:'GOLD IV',riot_account_id:account,live_session_id:saved.sessionId});
  expect(state.db.tables.op_match_analysis[0]).toMatchObject({queue_id:420,match_id:state.db.tables.matches[0].id});
  expect(state.db.tables.op_player_learning_profiles[0]).toMatchObject({learning_model_version:3,riot_account_id:account});
  expect(state.db.tables.ilp_tasks.length).toBeGreaterThanOrEqual(6);
  expect(state.db.tables.ilp_tasks.every((r:any)=>r.payload.queueScope===RANKED_SOLO_SCOPE)).toBe(true);
  expect(session.summary.processing.status).toBe('COMPLETE');
});

test('a normal-queue FINAL bundle is skipped and completed, never reported as a failed save',async()=>{
  state.db.tables.riot_accounts=[{id:account,user_id:'owner',is_primary:true,role:'ADC',rank_tier:'GOLD',rank_division:'IV'}];
  const player=(i:number)=>({summonerName:'Player'+i,riotId:'Player'+i+'#EUW',championName:i===0?'Jinx':'Ashe',team:i<5?'ORDER':'CHAOS',level:12,position:i===0?'ADC':null,isDead:false,respawnTimer:0,itemGold:2000,items:[],scores:{kills:5,deaths:2,assists:4,creepScore:180,wardScore:15}});
  const players=Array.from({length:10},(_,i)=>player(i));
  const frame=(time:number):any=>({version:1,queueId:400,gameTime:time,gameMode:'CLASSIC',mapName:'Map11',receivedAt:'2026-10-25T10:00:00Z',active:{...players[0],currentGold:200,stats:{currentHealth:1000,maxHealth:1000,currentMana:500,maxMana:500,attackDamage:100,attackSpeed:1,abilityPower:0,armor:50,magicResist:40,moveSpeed:330}},players,events:time===1800?[{id:1,name:'GameEnd',time,actor:null,target:null,raw:{Result:'Win'}}]:[]});
  const device:any={id:'pc',userId:'owner',riotAccountId:account,accountKey:account,deviceName:'PC'};
  const envelope:any={type:'FINAL',clientSessionId:'normal-complete',snapshots:[frame(600),frame(1800)]};
  const saved=await saveCompletedMatchBundle(device,envelope);
  const session=state.db.tables.live_telemetry_sessions[0];session.patch='16.21';session.game_version='16.21.1';
  // A skipped queue must resolve, not ask the Companion to send the game again:
  // the durable-write guards further down finalizeSession throw "retry required"
  // when a match or analysis row is missing, which a skipped game never writes.
  await expect(processQueuedPostGameSession(saved.sessionId!,envelope)).resolves.not.toThrow();
  expect(state.db.tables.matches??[]).toHaveLength(0);
  expect(state.db.tables.op_match_analysis??[]).toHaveLength(0);
  expect(session.summary.processing.status).toBe('COMPLETE');
  expect(session.summary.learningPlanSync).toMatchObject({status:'SKIPPED',reason:'RANKED_SOLO_ONLY'});
});

const frames=(riotId:string)=>{
  const player=(i:number)=>({summonerName:'Player'+i,riotId:i===0?riotId:'Player'+i+'#EUW',championName:i===0?'Jinx':'Ashe',team:i<5?'ORDER':'CHAOS',level:12,position:i===0?'ADC':null,isDead:false,respawnTimer:0,itemGold:2000,items:[],scores:{kills:5,deaths:2,assists:4,creepScore:180,wardScore:15}});
  const players=Array.from({length:10},(_,i)=>player(i));
  const frame=(time:number):any=>({version:1,queueId:420,gameTime:time,gameMode:'CLASSIC',mapName:'Map11',receivedAt:'2026-10-26T10:00:00Z',active:{...players[0],currentGold:200,stats:{currentHealth:1000,maxHealth:1000,currentMana:500,maxMana:500,attackDamage:100,attackSpeed:1,abilityPower:0,armor:50,magicResist:40,moveSpeed:330}},players,events:time===1800?[{id:1,name:'GameEnd',time,actor:null,target:null,raw:{Result:'Win'}}]:[]});
  return[frame(600),frame(1800)];
};

test('a game played on a second linked account is filed against that account',async()=>{
  const second='22222222-2222-4222-8222-222222222222';
  state.db.tables.riot_accounts=[
    {id:account,user_id:'owner',is_primary:true,role:'ADC',game_name:'Main',tagline:'EUW',rank_tier:'GOLD',rank_division:'IV'},
    {id:second,user_id:'owner',is_primary:false,role:'ADC',game_name:'Smurf',tagline:'EUW'},
  ];
  const device:any={id:'pc',userId:'owner',riotAccountId:account,accountKey:account,deviceName:'PC'};
  const envelope:any={type:'FINAL',clientSessionId:'smurf-game',snapshots:frames('Smurf#EUW')};
  const saved=await saveCompletedMatchBundle(device,envelope);
  await processQueuedPostGameSession(saved.sessionId!,envelope);
  // The paired account did not play this game and must not carry it.
  expect(state.db.tables.matches[0].riot_account_id).toBe(second);
  expect(state.db.tables.live_telemetry_sessions[0].riot_account_id).toBe(second);
});

test('a game played on an unlinked Riot ID is refused, not filed under the paired account',async()=>{
  state.db.tables.riot_accounts=[{id:account,user_id:'owner',is_primary:true,role:'ADC',game_name:'Main',tagline:'EUW',rank_tier:'GOLD',rank_division:'IV'}];
  const device:any={id:'pc',userId:'owner',riotAccountId:account,accountKey:account,deviceName:'PC'};
  const envelope:any={type:'FINAL',clientSessionId:'stranger-game',snapshots:frames('Someone#ELSE')};
  const saved=await saveCompletedMatchBundle(device,envelope);
  await processQueuedPostGameSession(saved.sessionId!,envelope);
  expect((state.db.tables.matches??[]).length).toBe(0);
  const session=state.db.tables.live_telemetry_sessions[0];
  expect(session.riot_account_id).toBe(account);
  expect(session.summary.learningPlanSync.reason).toBe('UNLINKED_RIOT_ACCOUNT');
  expect(session.summary.attribution.observed).toBe('Someone#ELSE');
});

test('an account with no stored Riot ID still records: an unknown identity proves nothing',async()=>{
  state.db.tables.riot_accounts=[{id:account,user_id:'owner',is_primary:true,role:'ADC',rank_tier:'GOLD',rank_division:'IV'}];
  const device:any={id:'pc',userId:'owner',riotAccountId:account,accountKey:account,deviceName:'PC'};
  const envelope:any={type:'FINAL',clientSessionId:'unverified-game',snapshots:frames('Whoever#EUW')};
  const saved=await saveCompletedMatchBundle(device,envelope);
  await processQueuedPostGameSession(saved.sessionId!,envelope);
  expect(state.db.tables.matches.length).toBe(1);
  expect(state.db.tables.matches[0].riot_account_id).toBe(account);
});
