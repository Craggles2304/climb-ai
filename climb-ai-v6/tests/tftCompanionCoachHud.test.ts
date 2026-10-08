import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const modelSource=readFileSync('companion/electron/tft-coach-model.js','utf8');
const rendererSource=readFileSync('companion/electron/renderer.js','utf8');
const html=readFileSync('companion/electron/index.html','utf8');
const css=readFileSync('companion/electron/tft-coach-hud.css','utf8');
const sandbox:any={};
vm.runInNewContext(modelSource,sandbox);
const coach=sandbox.OP_TFT_COACH_MODEL;

test('TFT mission content is selected before the match, concise and static',()=>{
  assert.equal(coach.MISSIONS.length,4);
  assert.equal(new Set(coach.MISSIONS.map((mission:any)=>mission.id)).size,4);
  for(const mission of coach.MISSIONS){
    assert.equal(mission.cues.length,2);
    assert.ok(mission.cues.every((cue:string)=>cue.trim().split(/\s+/).length<=7));
    assert.ok(mission.rule.length<=58);
    assert.equal(coach.mission(mission.id).title,mission.title);
  }
  assert.equal(coach.normalize('SPOOFED'),'ECONOMY');
  assert.equal(coach.normalize('FLEX'),'FLEX');
});

test('optional learning guides provide fixed-reference choices only',()=>{
  assert.deepEqual(Array.from(coach.GUIDES.map((g:any)=>g.id)),['ECONOMY','ITEMS','COMPS']);
  assert.ok(coach.GUIDES.every((guide:any)=>guide.notes.length===3));
  assert.doesNotMatch(modelSource,/live.*(roll now|buy now|switch comp)/i);
});

test('renderer locks mission on match start and does not change it using live stage',()=>{
  assert.match(rendererSource,/if\(status==='RECORDING'&&!tftLastRecording\)/);
  assert.match(rendererSource,/tftFrozenFocus=tftChosenFocus/);
  assert.match(rendererSource,/tftCoach\.mission\(tftFrozenFocus\|\|tftChosenFocus\)/);
  assert.match(rendererSource,/renderTftPrep\(paired&&phase==='WAITING'/);
  assert.match(rendererSource,/tft\.round&&tft\.round!=='0-0'/);
  assert.match(html,/<script src="tft-coach-model\.js"><\/script>[\s\S]*<script src="renderer\.js"><\/script>/);
  assert.match(html, /tft-coach-hud\.css/);
  assert.match(css,/\.tft-coach-guides/);
});
