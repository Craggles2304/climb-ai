const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const {overlayView}=require('../companion/electron/overlay-model.cjs');

test('AI Coach overlay opens only in paired active game, not before queue',()=>{
 const playing={paired:true,phase:'WAITING',tftRecorder:{state:'RECORDING',round:'4-2',gold:52,opponentBoard:['secret']}};
 const hidden=overlayView(playing,{enabled:true,assistantOpen:false});
 const visible=overlayView(playing,{enabled:true,assistantOpen:true});
 assert.equal(hidden.assistantOpen,false);
 assert.equal(visible.assistantOpen,true);
 assert.equal(visible.game,'TFT');
 assert.equal(overlayView({...playing,paired:false},{enabled:true,assistantOpen:true}).assistantOpen,false);
 assert.equal(overlayView({...playing,tftRecorder:{state:'ARMED'}},{enabled:true,assistantOpen:true}).assistantOpen,false);
 assert.ok(!JSON.stringify(visible).includes('opponentBoard'));
 assert.ok(!JSON.stringify(visible).includes('4-2'));
 assert.ok(!JSON.stringify(visible).includes('52'));
});

test('AI Coach is an isolated interactive overlay without game memory or renderer secrets',()=>{
 const main=read('companion/electron/main.cjs');
 const preload=read('companion/electron/overlay-preload.cjs');
 const html=read('companion/electron/learning-overlay.html');
 const renderer=read('companion/electron/learning-overlay.js');
 assert.match(main,/globalShortcut.register\('CommandOrControl\+Shift\+K'/);
 assert.match(main,/setIgnoreMouseEvents\(!\(overlayEditing\|\|overlayAssistantOpen\),\{forward:true\}\)/);
 assert.match(main,/overlay:ask-coach/);
 assert.match(main,/event.sender===overlayWindow\?\.webContents/);
 assert.match(preload,/askCoach:/);
 assert.doesNotMatch(preload,/\btoken\b|webUrl/);
 assert.match(html,/id="coachForm"/);
 assert.match(html,/id="coachPanel"/);
 assert.match(html,/learning-overlay-coach.css/);
 assert.match(html,/connect-src 'none'/);
 assert.match(renderer,/\.textContent=/);
 assert.doesNotMatch(renderer,/\.innerHTML=/);
});

test('AI Coach endpoint is authenticated, rate-limited, and bars reactive gameplay advice',()=>{
 const route=read('app/api/live/overlay-coach/route.ts');
 assert.match(route,/authenticateTrackerToken/);
 assert.match(route,/rateLimit\('overlay-coach:'/);
 assert.match(route,/game-integrity/);
 assert.match(route,/realtime\.test\(message\)/);
 assert.match(route,/readTftMission/);
 assert.match(route,/OPENAI_API_KEY/);
 assert.doesNotMatch(route,/screenCapture|opponentBoard|liveGold|socket\.io/);
});
