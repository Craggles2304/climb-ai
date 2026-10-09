'use strict';
// Presentation-only renderer. Nothing in here reads live game state or recommends
// actions from telemetry. Only the frozen coaching contract reaches the window,
// and every value is written with textContent.
(function(){
 const $=id=>document.getElementById(id);
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const MODES=['MINIMAL','FOCUS','EXPANDED'];
 const ROLES={TOP:'TOP',JUNGLE:'JUNGLE',MID:'MID',MIDDLE:'MID',ADC:'ADC',BOTTOM:'ADC',SUPPORT:'SUPPORT',UTILITY:'SUPPORT'};
 const special={
  'Aurelion Sol':'AurelionSol',"Bel'Veth":'Belveth',"Cho'Gath":'Chogath','Dr. Mundo':'DrMundo',
  'Jarvan IV':'JarvanIV',"Kai'Sa":'Kaisa',"Kha'Zix":'Khazix',"K'Sante":'KSante','LeBlanc':'Leblanc',
  'Lee Sin':'LeeSin','Master Yi':'MasterYi','Miss Fortune':'MissFortune','Nunu & Willump':'Nunu',
  "Rek'Sai":'RekSai','Renata Glasc':'Renata','Tahm Kench':'TahmKench','Twisted Fate':'TwistedFate',
  "Vel'Koz":'Velkoz','Wukong':'MonkeyKing','Xin Zhao':'XinZhao',
 };
 let state=null,drag=null,resize=null,portraitId='';
 let layout={x:0.68,y:0.045,scale:1,opacity:0.96,mode:'FOCUS'};
 const put=(id,value)=>{$(id).textContent=String(value??'')};
 const show=(id,visible)=>{$(id).hidden=!visible};
 const text=value=>String(value??'').trim();

 function championKey(champion){
  const cleaned=text(champion);
  if(!cleaned||/^your champion$|^unknown$|^pending$|^selecting$/i.test(cleaned))return'';
  return special[cleaned]||cleaned.replace(/[^A-Za-z0-9]/g,'').slice(0,42);
 }
 function showChampion(name,fallback){
  const art=$('championArt'),box=$('championFallback'),key=championKey(name);
  put('championFallback',fallback);
  if(!key){portraitId='';art.hidden=true;box.hidden=false;art.removeAttribute?.('src');return}
  if(portraitId===key)return;
  portraitId=key;art.hidden=true;box.hidden=false;
  art.onload=()=>{if(portraitId===key){art.hidden=false;box.hidden=true}};
  art.onerror=()=>{if(portraitId===key){art.hidden=true;box.hidden=false}};
  art.src='https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/'+encodeURIComponent(key)+'_0.jpg';
 }
 function putList(id,values){
  const list=$(id);
  if(typeof list.replaceChildren==='function')list.replaceChildren();
  if(typeof document.createElement!=='function')return;
  for(const value of values){const item=document.createElement('li');item.textContent=value;list.appendChild(item)}
 }

 function modeClass(){
  const mode=MODES.includes(layout.mode)?layout.mode:'FOCUS';
  const card=$('overlay');
  for(const m of MODES)card.classList.toggle('mode-'+m.toLowerCase(),m===mode);
  if(card.dataset)card.dataset.mode=mode;
  put('modeIndicator',mode);
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

 function renderLeague(plan){
  const role=ROLES[text(plan.role).toUpperCase()]||'';
  const champion=text(plan.champion);
  showChampion(champion,'OP');
  put('game','LEAGUE OF LEGENDS');
  put('planState',plan.baseline?'BASELINE CAPTURE':'PLAN LOCKED');
  put('title',champion&&champion.toUpperCase()!=='YOUR CHAMPION'?champion+(role?' · '+role:''):'Your match focus');

  // Mission: the development focus, or an honest baseline note.
  if(plan.baseline){
   put('missionLabel','Baseline game '+Math.min(Number(plan.baseline.games||0)+1,Number(plan.baseline.required||3))+' of '+Number(plan.baseline.required||3));
   put('mission','Play normally. No mission is scored this game.');
  }else{
   put('missionLabel','Your mission');
   put('mission',text(plan.mission)||'No development mission was locked for this game.');
  }
  show('missionBlock',true);

  // Win condition if the plan has one, otherwise the player's job.
  const win=text(plan.winCondition),job=text(plan.job);
  put('winLabel',win?'Win condition':'Your job');
  put('win',win||job);
  show('winBlock',Boolean(win||job));

  const actions=Array.isArray(plan.actions)?plan.actions.map(text).filter(Boolean).slice(0,3):[];
  putList('actions',actions);
  show('actionsBlock',actions.length>0);

  put('avoidLabel','Avoid');
  put('avoid',text(plan.avoid));
  show('avoidBlock',Boolean(text(plan.avoid)));
  put('threat',text(plan.threat));
  show('threatBlock',Boolean(text(plan.threat)));
 }

 function renderTft(focusId){
  const focus=window.OP_TFT_COACH_MODEL?.mission(focusId);
  showChampion(null,'TFT');
  put('game','TEAMFIGHT TACTICS');
  put('planState','STATIC TFT FOCUS');
  put('title',focus?.title||'TFT development focus');
  put('missionLabel','Your TFT focus');put('mission',focus?.rule||'Follow the focus you chose before the game.');
  show('missionBlock',true);
  put('winLabel','Remember');put('win',focus?.cues?.[0]||'');show('winBlock',Boolean(focus?.cues?.[0]));
  put('avoidLabel','Also remember');put('avoid',focus?.cues?.[1]||'');show('avoidBlock',Boolean(focus?.cues?.[1]));
  putList('actions',[]);show('actionsBlock',false);
  put('threat','');show('threatBlock',false);
 }

 function render(next){
  if(!next)return;
  state=next;
  layout={...layout,...next.layout};
  const editing=Boolean(next.editing),preview=next.game==='PREVIEW';
  $('editor').hidden=!editing;
  $('overlay').classList.toggle('editing',editing);
  $('overlay').classList.toggle('preview',preview);
  $('overlay').classList.toggle('is-tft',next.game==='TFT');
  put('status',preview?'LAYOUT PREVIEW':next.game==='TFT'?'TFT RECORDING':'LEAGUE RECORDING');
  put('recordingStatus',preview?'● EDITOR PREVIEW':'● TRACKING ACTIVE');
  if(next.game==='TFT')renderTft(next.focus);
  else if(next.plan)renderLeague(next.plan);
  else{
   // Preview without a match: show what each layout holds, clearly labelled.
   showChampion(null,'OP');
   put('game',preview?'LAYOUT PREVIEW':'LEAGUE OF LEGENDS');
   put('planState',preview?'DISPLAY EXAMPLE':'PLAN NOT LOCKED');
   put('title',preview?'Your champion':'Your match focus');
   put('missionLabel','Your mission');put('mission',preview?'Your development mission appears here.':'No pre-game plan was locked for this game.');
   show('missionBlock',true);
   put('winLabel','Win condition');put('win',preview?'Your win condition appears here.':'');show('winBlock',preview);
   putList('actions',preview?['First action','Second action','Third action']:[]);show('actionsBlock',preview);
   put('avoidLabel','Avoid');put('avoid',preview?'The one risk to avoid appears here.':'');show('avoidBlock',preview);
   put('threat',preview?'Their win condition appears here.':'');show('threatBlock',preview);
  }
  place();
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

 // Move: drag the header while editing.
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

 // Resize: drag the corner grip while editing.
 $('resizer').addEventListener('pointerdown',event=>{
  if(!state?.editing||event.button!==0)return;
  resize={x:event.clientX,scale:layout.scale,width:($('overlay').offsetWidth||364)};
  $('resizer').setPointerCapture?.(event.pointerId);
 });
 $('resizer').addEventListener('pointermove',event=>{
  if(!resize||!state?.editing)return;
  const scaled=resize.width*resize.scale+(event.clientX-resize.x);
  layout.scale=clamp(scaled/resize.width,.75,1.35);
  place();
 });
 for(const event of ['pointerup','pointercancel'])$('resizer').addEventListener(event,()=>{
  if(resize){resize=null;void save()}
 });

 $('scale').addEventListener('input',()=>{layout.scale=clamp(Number($('scale').value)/100,.75,1.35);place()});
 $('opacity').addEventListener('input',()=>{layout.opacity=clamp(Number($('opacity').value)/100,.68,1);place()});
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
