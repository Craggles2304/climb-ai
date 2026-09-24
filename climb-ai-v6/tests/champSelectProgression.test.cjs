const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const tracker=fs.readFileSync('companion/src/main.mjs','utf8');
const desktop=fs.readFileSync('companion/electron/main.cjs','utf8');
const renderer=fs.readFileSync('companion/electron/renderer.js','utf8');
const route=fs.readFileSync('app/api/live/champion-plan/route-core.ts','utf8');
const webDraft=fs.readFileSync('components/LivePregameMount.tsx','utf8');

test('champ select reads the local hover from Riot pick actions before lock',()=>{
  assert.ok(tracker.includes("const actionChampionIds=pickActions.map(action=>int(action?.championId,0))"));
  assert.ok(tracker.includes("const latestPickAction=cellId=>[...pickActions].reverse().find"));
  assert.ok(tracker.includes("const localChampionId=localRaw?selectedChampionId(localRaw,true):0"));
  assert.ok(tracker.includes("localSelectionState:localLockedIn?'LOCKED':localChampionId>0?'HOVER':'WAITING'"));
});

test('enemy hidden hover is not exposed by the progressive draft mapper',()=>{
  assert.ok(tracker.includes("allies:myTeam.map(raw=>mapPick(raw,true)).slice(0,5)"));
  assert.ok(tracker.includes("enemies:theirTeam.map(raw=>mapPick(raw,false)).slice(0,5)"));
  assert.ok(tracker.includes("if(Boolean(action?.completed)||allowHover)return int(action?.championId,0)"));
});

test('champion plan is previewable before lock and only adaptive build waits for lock',()=>{
  assert.ok(route.includes("stage:'WAITING_SELECTION'"));
  assert.ok(route.includes("provisional:true"));
  assert.ok(route.includes("if(locked&&enemyPicks.length>=3)"));
  assert.ok(route.includes("provisional:!locked"));
  assert.ok(!route.includes("if(!Boolean(context?.localLockedIn)||!champion)"));
});

test('desktop keeps live draft state and distinguishes hover from locked plan',()=>{
  assert.ok(desktop.includes("draft:null"));
  assert.ok(desktop.includes("locked?'CHAMPION_LOCK':'CHAMPION_HOVER'"));
  assert.ok(desktop.includes("preview ready. Change your hover freely"));
  assert.ok(!desktop.includes("Lock your champion to build your briefing."));
});

test('desktop renderer shows a live draft board instead of a repeated lock prompt',()=>{
  for(const text of ['CHAMP SELECT · LIVE DRAFT','YOUR ROLE','YOUR PICK','DRAFT READ','YOUR TEAM','THEIR TEAM','OUR BANS','THEIR BANS']){
    assert.ok(renderer.includes(text),text);
  }
  assert.ok(renderer.includes("champion?'HOVERING':'CHOOSING'"));
  assert.ok(renderer.includes("Preview only — change your hover freely."));
});

test('web champ select follows draft changes quickly and labels hover state',()=>{
  assert.ok(webDraft.includes('window.setInterval(tick,2_500)'));
  assert.ok(webDraft.includes("c.localChampionName?'HOVERING':'CHOOSING'"));
  assert.ok(webDraft.includes('Champion preview is live now.'));
});
