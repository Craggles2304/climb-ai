import test from 'node:test';
import assert from 'node:assert/strict';
import {applyDnaFocusSelection} from '../lib/dnaFocusSelection';
import {mergeIlpCloudSnapshot,type CloudIlpRow} from '../lib/ilpCloudMerge';
import type {DnaDomain,ILPTask,Role} from '../lib/types';

const t1='2026-10-09T10:00:00.000Z';
const t2='2026-10-09T10:05:00.000Z';
const t3='2026-10-09T10:10:00.000Z';
const domains:DnaDomain[]=['LANING','WAVES_CS','VISION_MAP','OBJECTIVES','TEAMFIGHTS','CONSISTENCY'];

function mission(domain:DnaDomain,unlocked:boolean,role:Role='ADC'):ILPTask {
  return{
    id:`dna-strand-${role.toLowerCase()}-${domain.toLowerCase()}-1`,
    accountId:'riot-1',title:'Train '+domain,dnaDomain:domain,category:'CONSISTENCY',
    why:'test',gameRule:'Focus before a fight',metric:'fight_selection',target:'3 verified games',
    progress:0,status:'ACTIVE',source:'SYSTEM',evidence:[],roleScope:role,roleEvidence:[role],
    dnaFocusUnlocked:unlocked,history:[{at:t1,type:'PROMOTED',note:'Strand started'}],
    missionHistory:[],masteryRequired:3,successfulGames:0,
  };
}
function pair(tasks:ILPTask[],role:Role='ADC'){
 return tasks.filter(task=>task.roleScope===role&&task.dnaFocusUnlocked&&task.status==='ACTIVE').map(task=>task.dnaDomain);
}

test('player changing active DNA trees records explicit new action on changed strands',()=>{
 const original=domains.map((domain,index)=>mission(domain,index<2));
 const selected=applyDnaFocusSelection(original,['VISION_MAP','TEAMFIGHTS'],'ADC',t3);
 assert.ok(selected);
 assert.deepEqual(pair(selected!),['VISION_MAP','TEAMFIGHTS']);
 for(const task of selected!){
   const changed=task.dnaDomain==='LANING'||task.dnaDomain==='WAVES_CS'||task.dnaDomain==='VISION_MAP'||task.dnaDomain==='TEAMFIGHTS';
   assert.equal(task.history?.at(-1)?.type,changed?'COACH_EDIT':'PROMOTED');
   assert.equal(task.history?.at(-1)?.at,changed?t3:t1);
   assert.equal(task.missionProgress,undefined);
   assert.equal(task.successfulGames,0);
 }
});

test('remote saved unlocked pair no longer erases the player selection after reload',()=>{
 const original=domains.map((domain,index)=>mission(domain,index<2));
 const changed=applyDnaFocusSelection(original,['VISION_MAP','TEAMFIGHTS'],'ADC',t3)!;
 const remote:CloudIlpRow[]=original.map(item=>({id:item.id,payload:item,updated_at:t2}));
 const saved=mergeIlpCloudSnapshot(changed,remote,'riot-1');
 assert.deepEqual(pair(saved.tasks),['VISION_MAP','TEAMFIGHTS']);
 assert.equal(saved.writes.length,4);
});

test('player focus action survives a server-managed record without replacing server evidence',()=>{
 const original=domains.map((domain,index)=>{
   const item=mission(domain,index<2);
   return domain==='LANING'?{...item,adaptive:{managedBy:'POST_GAME_EVIDENCE',confidence:90}} as ILPTask:item;
 });
 const changed=applyDnaFocusSelection(original,['VISION_MAP','WAVES_CS'],'ADC',t3)!;
 const saved=mergeIlpCloudSnapshot(changed,original.map(item=>({id:item.id,payload:item,updated_at:t2})),'riot-1');
 assert.deepEqual(pair(saved.tasks),['WAVES_CS','VISION_MAP']);
 assert.equal((saved.tasks.find(t=>t.dnaDomain==='LANING') as any)?.adaptive?.confidence,90);
});

test('invalid tree count or off-role tree never modifies the plan',()=>{
 const original=[...domains.map((domain,index)=>mission(domain,index<2)),mission('LANING',true,'TOP')];
 assert.equal(applyDnaFocusSelection(original,['LANING'],'ADC',t3),null);
 assert.equal(applyDnaFocusSelection(original,['LANING','LANING'],'ADC',t3),null);
 const next=applyDnaFocusSelection(original,['VISION_MAP','TEAMFIGHTS'],'ADC',t3)!;
 assert.equal(next.find(t=>t.roleScope==='TOP')?.dnaFocusUnlocked,true);
});

test('selecting the same pair does not falsely add new mission proof',()=>{
 const original=domains.map((domain,index)=>mission(domain,index<2));
 const next=applyDnaFocusSelection(original,['LANING','WAVES_CS'],'ADC',t3)!;
 assert.ok(next.every((task,index)=>task===original[index]));
});
