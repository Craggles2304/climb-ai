'use strict';
// Presentation-only renderer. Nothing in here reads live game state or recommends
// actions from telemetry. Only the frozen coaching contract reaches the window.
(function(){
 const $=id=>document.getElementById(id);
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const MODES=['MINIMAL','FOCUS','EXPANDED'];
 const special={
  'Aurelion Sol':'AurelionSol',"Bel'Veth":'Belveth',"Cho'Gath":'Chogath','Dr. Mundo':'DrMundo',
  'Jarvan IV':'JarvanIV',"Kai'Sa":'Kaisa',"Kha'Zix":'Khazix',"K'Sante":'KSante','LeBlanc':'Leblanc',
  'Lee Sin':'LeeSin','Master Yi':'MasterYi','Miss Fortune':'MissFortune','Nunu & Willump':'Nunu',
  "Rek'Sai":'RekSai','Renata Glasc':'Renata','Tahm Kench':'TahmKench','Twisted Fate':'TwistedFate',
  "Vel'Koz":'Velkoz','Wukong':'MonkeyKing','Xin Zhao':'XinZhao',
 };
 let state=null,drag=null,portraitId='';
 let layout={x:0.68,y:0.045,scale:1,opacity:0.96,mode:'FOCUS'};
 const put=(id,value)=>{$(id).textContent=String(value??'')};
 function championKey(champion){
  const cleaned=String(champion||'').trim();
  if(!cleaned||/^your champion$|^unknown$|^pending$|^selecting$/i.test(cleaned))return'';
  return special[cleaned]||cleaned.replace(/[^A-Za-z0-9]/g,'').slice(0,42);
 }
 function showChampion(name){
  const art=$('championArt'),fallback=$('championFallback'),key=championKey(name);
  if(!key){portraitId='';art.hidden=true;fallback.hidden=false;art.removeAttribute?.('src');return}
  if(portraitId===key)return;
  portraitId=key;art.hidden=true;fallback.hidden=false;
  const expected='https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/'+encodeURIComponent(key)+'_0.jpg';
  art.onload=()=>{if(portraitId===key){art.hidden=false;fallback.hidden=true}};
  art.onerror=()=>{if(portraitId===key){art.hidden=true;fallback.hidden=false}};
  art.src=expected;
 }
 function modeClass(){
   const mode=MODES.includes(layout.mode)?layout.mode:'FOCUS';
   const card=$('overlay');
   for(const m of MODES)card.classList.toggle('mode-'+m.toLowerCase(),m===mode);
   if(card.dataset)card.dataset.mode=mode;
   const all=typeof document.querySelectorAll==='function'?document.querySelectorAll('.preset'):[];
   for(const button of all){
     const selected=button.dataset?.preset===mode;
     button.classList.toggle('selected',selected);
     button.setAttribute?.('aria-pressed',String(selected));
   }
 }
 function place(){
   modeClass();
   const card=$('overlay');
   const width=card.offsetWidth||364,height=card.offsetHeight||350;
   const maxX=Math.max(.015,Math.min(.82,(innerWidth-width*layout.scale-12)/innerWidth));
   const maxY=Math.max(.015,Math.min(.75,(innerHeight-height*layout.scale-12)/innerHeight));
   layout.x=clamp(Number(layout.x)||0,.015,maxX);
   layout.y=clamp(Number(layout.y)||0,.015,maxY);
   card.style.left=(layout.x*100)+'vw';card.style.top=(layout.y*100)+'vh';
   card.style.transform='scale('+layout.scale+')';card.style.opacity=String(layout.opacity);
   $('scale').value=String(Math.round(layout.scale*100));
   $('opacity').value=String(Math.round(layout.opacity*100));
   put('scaleValue',Math.round(layout.scale*100)+'%');put('opacityValue',Math.round(layout.opacity*100)+'%');
 }
 function render(next){
   if(!next)return;
   state=next;
   layout={...layout,...next.layout};
   place();
   const editing=Boolean(next.editing),preview=next.game==='PREVIEW';
   $('editor').hidden=!editing;
   $('overlay').classList.toggle('editing',editing);
   $('overlay').classList.toggle('preview',preview);
   put('status',preview?'LAYOUT PREVIEW':next.game==='TFT'?'TFT RECORDING':'LEAGUE RECORDING');
   put('recordingStatus',preview?'● PREVIEW':'● TRACKING ACTIVE');
   put('game',next.game==='TFT'?'TEAMFIGHT TACTICS':preview?'PREVIEW / LEARNING HUD':'LEAGUE OF LEGENDS');
   put('championFallback',next.game==='TFT'?'TFT':'OC');
   if(next.game==='TFT'){
     showChampion(null);
     const focus=window.OP_TFT_COACH_MODEL?.mission(next.focus);
     put('title',focus?.title||'TFT DEVELOPMENT FOCUS');
     put('missionLabel','PRESELECTED LEARNING MISSION');put('mission',focus?.rule||'Follow your chosen pre-game focus.');
     put('winLabel','REMEMBER');put('win',focus?.cues?.[0]||'Review your decision after the game.');
     put('avoidLabel','SECOND REMINDER');put('avoid',focus?.cues?.[1]||'Keep your choices your own.');
   }else{
     const plan=next.plan||{};
     showChampion(plan.champion);
     put('title',plan.champion&&plan.champion!=='YOUR CHAMPION'
       ?plan.champion+(plan.role?' · '+plan.role:''):'YOUR MATCH FOCUS');
     put('missionLabel','YOUR DEVELOPMENT MISSION');
     put('mission',plan.mission||'Play normally. No frozen pre-game mission was available.');
     put('winLabel','PRE-GAME WIN CONDITION');
     put('win',plan.winCondition||'No pre-game plan is available yet.');
     put('avoidLabel','ONE THING TO PROTECT');put('avoid',plan.avoid||'Avoid unnecessary risks.');
   }
   put('recordingStatus',preview?'● EDITOR PREVIEW':'● TRACKING ACTIVE');
 }
 async function save(){
   const result=await window.opOverlay.saveLayout({...layout}).catch(()=>null);
   if(result?.layout){layout={...layout,...result.layout};place()}
   return result;
 }
 function setMode(mode){
   if(!MODES.includes(mode))return;
   layout.mode=mode;place();void save();
 }
 $('handle').addEventListener('pointerdown',event=>{
   if(!state?.editing||event.button!==0)return;
   drag={x:event.clientX,y:event.clientY,left:layout.x,top:layout.y};
   $('handle').setPointerCapture(event.pointerId);
 });
 $('handle').addEventListener('pointermove',event=>{
   if(!drag||!state?.editing)return;
   layout.x=clamp(drag.left+(event.clientX-drag.x)/innerWidth,.015,.82);
   layout.y=clamp(drag.top+(event.clientY-drag.y)/innerHeight,.015,.75);
   place();
 });
 for(const event of ['pointerup','pointercancel'])$('handle').addEventListener(event,()=>{
   if(drag){drag=null;void save()}
 });
 $('scale').addEventListener('input',()=>{
   layout.scale=clamp(Number($('scale').value)/100,.75,1.35);place();
 });
 $('opacity').addEventListener('input',()=>{
   layout.opacity=clamp(Number($('opacity').value)/100,.68,1);place();
 });
 for(const id of ['scale','opacity'])$(id).addEventListener('change',()=>void save());
 if(typeof document.querySelectorAll==='function'){
   for(const button of document.querySelectorAll('.preset')){
     button.addEventListener('click',()=>setMode(String(button.dataset?.preset||'')));
   }
 }
 $('done').addEventListener('click',async()=>{await save();await window.opOverlay.finishEditing()});
 window.addEventListener('resize',place);
 window.opOverlay.onState(render);
 void window.opOverlay.getState().then(render);
})();
