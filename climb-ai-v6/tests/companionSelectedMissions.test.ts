import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureOneMissionPerDnaStrand} from '../lib/dnaStrandMissions';
import {applyDnaFocusSelection} from '../lib/dnaFocusSelection';
import {gameMissionFocusPair,gameDnaFocusSource} from '../lib/gameDnaSnapshot';
import {companionPregameMissions} from '../lib/companionPregameMissions';
import type {ILPTask} from '../lib/types';

const accountId='riot-test';
const baseline=ensureOneMissionPerDnaStrand([],accountId,'ADC').tasks;
const timestamp='2026-10-13T18:00:00Z';

test('Companion pregame returns the same two trees in the same priority order as Missions and Companion Home',()=>{
 const selected=applyDnaFocusSelection(baseline,['VISION_MAP','TEAMFIGHTS'],'ADC',timestamp)!;
 const web=gameMissionFocusPair(selected,'ADC');
 const desktop=companionPregameMissions(selected,accountId,'ADC');
 assert.equal(desktop.source,'PLAYER');
 assert.equal(desktop.missions.length,2);
 assert.deepEqual(desktop.missions.map(item=>item.task.id),web.map(item=>item.task.id));
 assert.ok(desktop.missions.every(item=>item.title&&item.nextGame&&item.success));
});

test('Different-role missions and unrelated generic priorities cannot replace selected two',()=>{
 const adc=applyDnaFocusSelection(baseline,['LANING','OBJECTIVES'],'ADC',timestamp)!;
 const top=ensureOneMissionPerDnaStrand([],accountId,'TOP').tasks.map(item=>({
  ...item,roleScope:'TOP' as const,priority:10000,dnaFocusUnlocked:true,
 }));
 const extra={...adc[0],id:'generic-ad-hoc',title:'UNRELATED PRIORITY',priority:100000,roleScope:'GLOBAL' as const,dnaDomain:undefined,dnaFocusUnlocked:false,source:'COACH' as const};
 const selected=companionPregameMissions([...top,extra as unknown as ILPTask,...adc],accountId,'ADC');
 assert.deepEqual(selected.missions.map(x=>x.task.dnaDomain),gameMissionFocusPair(adc,'ADC').map(x=>x.domain));
 assert.equal(selected.missions.length,2);
 assert.ok(selected.missions.every(x=>x.title!=='UNRELATED PRIORITY'));
});

test('Unconfirmed suggestions stay clearly identified, without falsely awarding completion',()=>{
 const selected=companionPregameMissions(baseline,accountId,'ADC');
 assert.equal(selected.source,gameDnaFocusSource(baseline,'ADC'));
 assert.notEqual(selected.source,'PLAYER');
 assert.ok(selected.missions.length<=2);
 assert.ok(selected.missions.every(x=>!x.task.missionHistory?.length));
});

test('Companion pregame picks up a changed two-tree selection from a fresh cloud read',()=>{
 const before=applyDnaFocusSelection(baseline,['LANING','WAVES_CS'],'ADC',timestamp)!;
 const after=applyDnaFocusSelection(before,['VISION_MAP','CONSISTENCY'],'ADC','2026-10-13T18:10:00Z')!;
 const old=companionPregameMissions(before,accountId,'ADC');
 const next=companionPregameMissions(after,accountId,'ADC');
 assert.notDeepEqual(old.missions.map(x=>x.task.dnaDomain),next.missions.map(x=>x.task.dnaDomain));
 assert.deepEqual(next.missions.map(x=>x.task.id),gameMissionFocusPair(after,'ADC').map(x=>x.task.id));
});
