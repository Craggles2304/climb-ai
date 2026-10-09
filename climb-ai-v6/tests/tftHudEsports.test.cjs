const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(__dirname,'../companion/electron');
const read=file=>fs.readFileSync(path.join(dir,file),'utf8');

test('TFT esports HUD is distinct and retains all three low-distraction presets',()=>{
 const html=read('learning-overlay.html');
 const css=read('learning-overlay-tft.css');
 const js=read('learning-overlay.js');
 assert.match(html,/learning-overlay-tft\.css/);
 assert.match(html,/id="tftSigil"/);
 for(const focus of ['economy','tempo','flex','position'])assert.match(css,new RegExp('tft-focus-'+focus));
 for(const mode of ['minimal','focus','expanded'])assert.match(css,new RegExp('is-tft\\.mode-'+mode));
 assert.match(js,/TACTICIAN HUD/);
 assert.match(js,/STATIC TFT FOCUS/);
 assert.doesNotMatch(js,/enemyCooldown|winProbability|liveHud/);
});
test('The TFT learning coach exposes four PRESELECTED focuses, not live values',()=>{
 const src=read('tft-coach-model.js');
 for(const focus of ['ECONOMY','TEMPO','FLEX','POSITION'])assert.ok(src.includes("id:'"+focus+"'"));
 assert.doesNotMatch(src,/opponentBoard|liveGold|winProbability/);
});
