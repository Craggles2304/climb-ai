'use strict';
(function(){
 const $=id=>document.getElementById(id);
 const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
 let state=null,layout={x:0.68,y:0.045,scale:1,opacity:0.96},drag=null;
 function text(id,value){$(id).textContent=String(value??'')}
 function place(){
   $('overlay').style.left=(layout.x*100)+'vw';
   $('overlay').style.top=(layout.y*100)+'vh';
   $('overlay').style.transform='scale('+layout.scale+')';
   $('overlay').style.opacity=String(layout.opacity);
   $('scale').value=String(Math.round(layout.scale*100));
   $('opacity').value=String(Math.round(layout.opacity*100));
 }
 function render(next){
   if(!next)return;
   state=next;layout={...layout,...next.layout};place();
   $('editor').hidden=!next.editing;
   $('overlay').classList.toggle('editing',Boolean(next.editing));
   text('status',next.status||'RECORDING');
   text('game',next.game==='TFT'?'TEAMFIGHT TACTICS':'LEAGUE OF LEGENDS');
   if(next.game==='TFT'){
     const focus=window.OP_TFT_COACH_MODEL?.mission(next.focus);
     text('title',focus?.title||'YOUR LEARNING FOCUS');
     text('winLabel','PRE-SELECTED FOCUS');text('win',focus?.rule||'Play your learning focus.');
     text('missionLabel','REMEMBER');text('mission',focus?.cues?.[0]||'Reflect after the match.');
     text('avoidLabel','SECOND REMINDER');text('avoid',focus?.cues?.[1]||'Keep the choice yours.');
   }else{
     const plan=next.plan||{};
     text('title',plan.champion?(plan.champion+(plan.role?' · '+plan.role:'')):'YOUR MATCH PLAN');
     text('winLabel','PRE-GAME WIN CONDITION');text('win',plan.winCondition||'Play normally; no frozen plan was available.');
     text('missionLabel','YOUR LEARNING MISSION');text('mission',plan.mission||'Keep your focus from before the game.');
     text('avoidLabel','WHAT TO PROTECT');text('avoid',plan.avoid||'Avoid unnecessary risks.');
   }
 }
 async function save(){await window.opOverlay.saveLayout(layout).catch(()=>{});}
 $('handle').addEventListener('pointerdown',event=>{
   if(!state?.editing||event.button!==0)return;
   drag={startX:event.clientX,startY:event.clientY,x:layout.x,y:layout.y};
   $('handle').setPointerCapture(event.pointerId);
 });
 $('handle').addEventListener('pointermove',event=>{
   if(!drag||!state?.editing)return;
   layout.x=clamp(drag.x+(event.clientX-drag.startX)/innerWidth,0.015,0.82);
   layout.y=clamp(drag.y+(event.clientY-drag.startY)/innerHeight,0.015,0.75);
   place();
 });
 for(const event of ['pointerup','pointercancel'])$('handle').addEventListener(event,()=>{if(drag){drag=null;void save()}});
 $('scale').addEventListener('input',()=>{layout.scale=clamp(Number($('scale').value)/100,0.75,1.35);place()});
 $('opacity').addEventListener('input',()=>{layout.opacity=clamp(Number($('opacity').value)/100,0.68,1);place()});
 for(const id of ['scale','opacity'])$(id).addEventListener('change',()=>void save());
 $('done').addEventListener('click',async()=>{await save();await window.opOverlay.finishEditing()});
 window.opOverlay.onState(render);void window.opOverlay.getState().then(render);
})();
