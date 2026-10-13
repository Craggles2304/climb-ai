import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {overlayView} from '../companion/electron/overlay-model.cjs';

const src=(file:string)=>readFileSync(file,'utf8');

test('TFT static guide is entirely pre-game and patch-labelled, not inferred from live state',()=>{
 const api=src('app/api/tft/pregame-builds/route.ts');
 assert.match(api,/patch:'18\.4b'/);
 for(const name of ['riftbeast-reroll','inferno-draven','rapidfire-aphelios'])assert.ok(api.includes(name));
 assert.doesNotMatch(api,/opponentBoard|liveGold|screenCapture|tftRecorder|onLiveData/);
 assert.match(api,/sourceUrl/);
});

test('TFT build guide stays frozen even when recorder feeds new gold, board or stage',()=>{
 const builds={patch:'18.4b',asOf:'2026-10-13',selectedId:'riftbeast-reroll',builds:[
  {id:'riftbeast-reroll',title:'RIFTBEAST REROLL',tier:'S',tempo:'REROLL',primary:'Pebbles',
   items:['Blue Buff','Jeweled Gauntlet',"Rabadon's Deathcap"],rationale:'Pregame only',source:'Snapshot'},
 ]};
 const record={paired:true,phase:'WAITING',tftRecorder:{state:'RECORDING',gold:20,round:'4-3',board:[1],shop:[2]}};
 const before=overlayView(record,{enabled:true,buildsOpen:true,tftBuilds:builds});
 record.tftRecorder={state:'RECORDING',gold:99,round:'6-1',board:[5],shop:[6]};
 const after=overlayView(record,{enabled:true,buildsOpen:true,tftBuilds:builds});
 assert.equal(before.game,'TFT');assert.equal(before.buildsOpen,true);
 assert.deepEqual(before.buildGuide,after.buildGuide);
 for(const secret of ['4-3','6-1','board','shop','gold'])assert.ok(!JSON.stringify(after.buildGuide).includes(secret));
 assert.equal(after.buildGuide.builds[0].items[0],'Blue Buff');
});

test('League build guide contains pregame champion items, rune names and skill order only',()=>{
 const league={champion:'Jinx',role:'ADC',patch:'16.20',source:'CURRENT PATCH',items:['Infinity Edge','Runaan'],runes:['Lethal Tempo'],skillOrder:['Q','W','E']};
 const payload=overlayView({paired:true,phase:'RECORDING',liveHud:{hiddenTarget:'bad'}},{enabled:true,leagueBuild:league});
 assert.equal(payload.buildGuide.game,'LOL');
 assert.deepEqual(payload.buildGuide.items,['Infinity Edge','Runaan']);
 assert.ok(!JSON.stringify(payload.buildGuide).includes('hiddenTarget'));
});

test('Companion pregame guide selection is locked when recording and accessible on hotkey',()=>{
 const main=src('companion/electron/main.cjs');
 const preload=src('companion/electron/preload.cjs');
 const guide=src('companion/electron/learning-overlay.js');
 const html=src('companion/electron/learning-overlay.html');
 assert.match(main,/globalShortcut.register\('CommandOrControl\+Shift\+B'/);
 assert.match(main,/state\.tftRecorder\?\.state==='RECORDING'\)return\{ok:false,error:'Build preference is frozen/);
 assert.match(main,/overlayFrozenTftBuilds=/);
 assert.match(main,/overlayFrozenLeagueBuild=/);
 assert.match(preload,/setTftBuild/);
 assert.match(html,/id="buildGuidePanel"/);
 assert.match(html,/id="buildQuick"/);
 assert.match(guide,/renderBuildGuide\(next\)/);
 assert.doesNotMatch(guide,/innerHTML=/);
});
