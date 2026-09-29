const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {draftFromLocalContext,freshestDraft}=require('../companion/electron/live-draft.cjs');

test('local Riot draft carries hover, role, teams and bans to the desktop',()=>{
  const context={capturedAt:'2026-09-29T20:00:01.000Z',localPlayerCellId:2,localChampionName:'Jinx',localRole:'ADC',localLockedIn:false,localSelectionState:'HOVER',allies:[{cellId:2,championName:'Jinx'}],enemies:[{cellId:5,championName:'Caitlyn'}],bans:{allies:[{championName:'Draven'}],enemies:[]}};
  const draft=draftFromLocalContext(context);
  assert.equal(draft.localChampionName,'Jinx');
  assert.equal(draft.localRole,'ADC');
  assert.equal(draft.localPlayerCellId,2);
  assert.equal(draft.localSelectionState,'HOVER');
  assert.equal(draft.enemies[0].championName,'Caitlyn');
  assert.equal(draft.bans.allies[0].championName,'Draven');
});

test('an older server response cannot erase a newer local draft',()=>{
  const local={capturedAt:'2026-09-29T20:00:02.000Z',localChampionName:'Jinx'};
  const server={capturedAt:'2026-09-29T20:00:01.000Z',localChampionName:null};
  assert.equal(freshestDraft(local,server),local);
  assert.equal(freshestDraft(local,{localChampionName:null}),local);
  assert.equal(freshestDraft(server,local),local);
});

test('local tracker emits the draft before waiting for a network upload',()=>{
  const tracker=fs.readFileSync('companion/src/main.mjs','utf8');
  const desktop=fs.readFileSync('companion/electron/main.cjs','utf8');
  const emit=tracker.indexOf('console.log(`${DRAFT_CONTEXT_PREFIX}${JSON.stringify(context)}`)');
  const upload=tracker.indexOf("postJson('/api/live/pregame'",emit);
  assert.ok(emit>0&&upload>emit);
  assert.ok(desktop.includes("line.startsWith(DRAFT_CONTEXT_PREFIX)"));
  assert.ok(desktop.includes("response.status===429"));
});
