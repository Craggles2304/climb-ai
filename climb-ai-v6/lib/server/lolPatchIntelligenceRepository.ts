import 'server-only';
import {createHash} from 'node:crypto';
import {getSupabaseAdmin} from './supabaseAdmin';
import {canonicalLeaguePatch,dataDragonBuild,type LearningPatchChange} from '@/lib/patchIntelligence';

const BASE='https://ddragon.leagueoflegends.com';
const READY_TTL_MS=12*60*60_000;
let readyCache:{version:string;expires:number}|null=null;

type EntityType='CHAMPION'|'ITEM'|'RUNE'|'SUMMONER';
type Entity={entity_type:EntityType;entity_id:string;entity_name:string|null;payload:any;fingerprint:string};

async function getJson<T>(url:string):Promise<T>{
  const res=await fetch(url,{cache:'no-store'});
  if(!res.ok)throw new Error('Data Dragon request failed ('+res.status+') for '+url);
  return res.json() as Promise<T>;
}
function stable(value:any):any{
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
}
function hash(value:any){return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')}
function changedFields(before:any,after:any){
  const keys=new Set([...Object.keys(before||{}),...Object.keys(after||{})]);
  return [...keys].filter(key=>JSON.stringify(stable(before?.[key]))!==JSON.stringify(stable(after?.[key]))).sort();
}
function entity(type:EntityType,id:unknown,name:unknown,payload:any):Entity{
  return{entity_type:type,entity_id:String(id),entity_name:name?String(name):null,payload,fingerprint:hash(payload)};
}
function flattenRunes(raw:any[]):Entity[]{
  const out:Entity[]=[];
  for(const tree of raw||[]){
    const treePayload={...tree};
    delete treePayload.slots;
    out.push(entity('RUNE','tree:'+tree.id,tree.name,treePayload));
    for(const [slotIndex,slot] of (tree.slots||[]).entries()){
      for(const rune of slot.runes||[])out.push(entity('RUNE','rune:'+rune.id,rune.name,{...rune,pathId:tree.id,pathName:tree.name,slotIndex}));
    }
  }
  return out;
}
async function runChunks<T>(values:T[],run:(chunk:T[])=>Promise<void>,size=150){
  for(let i=0;i<values.length;i+=size)await run(values.slice(i,i+size));
}

export async function currentDataDragonVersion():Promise<string>{
  const versions=await getJson<string[]>(BASE+'/api/versions.json');
  if(!versions.length)throw new Error('Data Dragon returned no versions.');
  return versions[0];
}

export async function ensureCurrentPatchIntelligence(){
  return ensurePatchIntelligence(await currentDataDragonVersion());
}

export async function ensurePatchIntelligence(dataDragonVersion:string){
  const db=getSupabaseAdmin();
  const patch=canonicalLeaguePatch(dataDragonVersion);
  if(!db||!patch)return null;

  if(readyCache?.version===dataDragonVersion&&readyCache.expires>Date.now())return getPatchIntelligenceStatus(patch);

  const {data:existing,error:existingError}=await db.from('lol_patches')
    .select('patch,data_dragon_version,ingested_at,champion_count,item_count,rune_count,summoner_count,is_current,previous_patch')
    .eq('patch',patch).maybeSingle();
  if(existingError)throw new Error(existingError.message);

  if(existing?.ingested_at&&Number(existing.champion_count)>0&&Number(existing.item_count)>0){
    await db.from('lol_patches').update({is_current:false}).neq('patch',patch).eq('is_current',true);
    await db.from('lol_patches').update({is_current:true,last_seen_at:new Date().toISOString()}).eq('patch',patch);
    readyCache={version:dataDragonVersion,expires:Date.now()+READY_TTL_MS};
    return getPatchIntelligenceStatus(patch);
  }

  const base=BASE+'/cdn/'+encodeURIComponent(dataDragonVersion)+'/data/en_US';
  const [championFull,itemFile,runeFile,summonerFile]=await Promise.all([
    getJson<{data:Record<string,any>}>(base+'/championFull.json'),
    getJson<{data:Record<string,any>}>(base+'/item.json'),
    getJson<any[]>(base+'/runesReforged.json'),
    getJson<{data:Record<string,any>}>(base+'/summoner.json'),
  ]);

  const entities:Entity[]=[
    ...Object.entries(championFull.data||{}).map(([id,payload])=>entity('CHAMPION',id,payload?.name,payload)),
    ...Object.entries(itemFile.data||{}).map(([id,payload])=>entity('ITEM',id,payload?.name,payload)),
    ...flattenRunes(runeFile),
    ...Object.entries(summonerFile.data||{}).map(([id,payload])=>entity('SUMMONER',id,payload?.name,payload)),
  ];

  const {data:previousCurrent,error:previousError}=await db.from('lol_patches')
    .select('patch').eq('is_current',true).neq('patch',patch).limit(1).maybeSingle();
  if(previousError)throw new Error(previousError.message);
  const previousPatch=previousCurrent?.patch?String(previousCurrent.patch):null;

  let previousEntities:any[]=[];
  if(previousPatch){
    const previous=await db.from('lol_patch_entities')
      .select('entity_type,entity_id,entity_name,fingerprint,payload').eq('patch',previousPatch).limit(1000);
    if(previous.error)throw new Error(previous.error.message);
    previousEntities=previous.data??[];
  }

  const previousMap=new Map(previousEntities.map(row=>[row.entity_type+'|'+row.entity_id,row]));
  const currentKeys=new Set(entities.map(row=>row.entity_type+'|'+row.entity_id));
  const now=new Date().toISOString();
  const entityRows=entities.map(row=>{
    const before=previousMap.get(row.entity_type+'|'+row.entity_id);
    const changed=!before||before.fingerprint!==row.fingerprint;
    return{
      patch,...row,changed_from_previous:changed,
      change_summary:changed?{type:before?'MODIFIED':'ADDED',fields:before?changedFields(before.payload,row.payload):Object.keys(row.payload||{}).sort()}: {},
      updated_at:now,
    };
  });

  const changes:any[]=[];
  for(const row of entityRows){
    if(!row.changed_from_previous)continue;
    const before=previousMap.get(row.entity_type+'|'+row.entity_id);
    changes.push({
      patch,previous_patch:previousPatch,entity_type:row.entity_type,entity_id:row.entity_id,entity_name:row.entity_name,
      change_type:before?'MODIFIED':'ADDED',before_fingerprint:before?.fingerprint??null,after_fingerprint:row.fingerprint,
      changed_fields:row.change_summary.fields??[],
    });
  }
  for(const before of previousEntities){
    const key=before.entity_type+'|'+before.entity_id;
    if(currentKeys.has(key))continue;
    changes.push({
      patch,previous_patch:previousPatch,entity_type:before.entity_type,entity_id:before.entity_id,entity_name:before.entity_name,
      change_type:'REMOVED',before_fingerprint:before.fingerprint,after_fingerprint:null,changed_fields:[],
    });
  }

  await db.from('lol_patches').update({is_current:false}).eq('is_current',true).neq('patch',patch);
  const counts={
    champion_count:entities.filter(x=>x.entity_type==='CHAMPION').length,
    item_count:entities.filter(x=>x.entity_type==='ITEM').length,
    rune_count:entities.filter(x=>x.entity_type==='RUNE').length,
    summoner_count:entities.filter(x=>x.entity_type==='SUMMONER').length,
  };
  const parsed=patch.split('.').map(Number);
  const patchSave=await db.from('lol_patches').upsert({
    patch,data_dragon_version:dataDragonVersion,major:parsed[0],minor:parsed[1],build:dataDragonBuild(dataDragonVersion),
    source:'RIOT_DATA_DRAGON',is_current:true,last_seen_at:now,ingested_at:now,previous_patch:previousPatch,
    ...counts,metadata:{status:'READY',entityCount:entities.length,changeCount:changes.length},
  },{onConflict:'patch'});
  if(patchSave.error)throw new Error(patchSave.error.message);

  await runChunks(entityRows,async chunk=>{
    const result=await db.from('lol_patch_entities').upsert(chunk,{onConflict:'patch,entity_type,entity_id'});
    if(result.error)throw new Error(result.error.message);
  });

  await db.from('lol_patch_changes').delete().eq('patch',patch);
  await runChunks(changes,async chunk=>{
    if(!chunk.length)return;
    const result=await db.from('lol_patch_changes').upsert(chunk,{onConflict:'patch,entity_type,entity_id'});
    if(result.error)throw new Error(result.error.message);
  });

  readyCache={version:dataDragonVersion,expires:Date.now()+READY_TTL_MS};
  return getPatchIntelligenceStatus(patch);
}

export async function getPatchIntelligenceStatus(patch?:string|null){
  const db=getSupabaseAdmin();
  if(!db)return null;
  let query=db.from('lol_patches').select('patch,data_dragon_version,is_current,ingested_at,champion_count,item_count,rune_count,summoner_count,previous_patch,metadata');
  query=patch?query.eq('patch',patch):query.eq('is_current',true);
  const {data,error}=await query.limit(1).maybeSingle();
  if(error)throw new Error(error.message);
  if(!data)return null;

  const {count,error:countError}=await db.from('lol_patch_changes').select('id',{count:'exact',head:true}).eq('patch',data.patch);
  if(countError)throw new Error(countError.message);
  return{...data,change_count:count??0};
}

export async function patchChangesForHistory(rows:Array<{patch?:string|null;champion:string}>):Promise<LearningPatchChange[]>{
  const db=getSupabaseAdmin();
  if(!db)return[];
  const patches=[...new Set(rows.map(row=>canonicalLeaguePatch(row.patch)).filter((x):x is string=>Boolean(x)))];
  if(!patches.length)return[];

  const {data,error}=await db.from('lol_patch_changes')
    .select('patch,entity_type,entity_id,entity_name,change_type,changed_fields')
    .in('patch',patches).eq('entity_type','CHAMPION').limit(1000);
  if(error)throw new Error(error.message);

  return(data??[]).map((row:any)=>({
    patch:String(row.patch),entityType:'CHAMPION',entityId:String(row.entity_id),entityName:row.entity_name?String(row.entity_name):null,
    changeType:row.change_type,changedFields:Array.isArray(row.changed_fields)?row.changed_fields.map(String):[],
  }));
}
