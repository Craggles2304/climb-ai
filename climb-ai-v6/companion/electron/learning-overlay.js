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
 let coachGame='',coachHistory=[],coachPending=false,coachWasOpen=false;
 let layout={x:0.68,y:0.045,scale:1,opacity:0.96,mode:'FOCUS'};
 const put=(id,value)=>{$(id).textContent=String(value??'')};
 const show=(id,visible)=>{$(id).hidden=!visible};
 const text=value=>String(value??'').trim();
 // The in-game default is a glanceable reminder, not the full coach briefing.
 // Expanded mode preserves the exact long-form pregame wording.
 const cue=(value,max=82)=>{
  const raw=text(value).replace(/\\s+/g,' ');
  if(!raw)return'';
  const first=raw.split(/(?:\\.\\s+|;\\s*|\\s+→\\s+|\\s+[—–]\\s+)/)[0]?.trim()||raw;
  if(first.length<=max)return first.replace(/[.;,:]$/,'');
  const clipped=first.slice(0,max-1).replace(/\\s+\\S*$/,'').trim();
  return (clipped||first.slice(0,max-1))+'…';
 };

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
  show('tftSigil',false);
  put('identityTag','PLAYER / MATCH ID');
  put('hudBrandMode','PERFORMANCE HUD');
  put('freezeNote','FROZEN BEFORE PLAY');
  put('ruleNote','PRE-GAME PLAN · REVIEW AFTER');
  put('game','LEAGUE OF LEGENDS');
  put('planState',plan.baseline?'BASELINE CAPTURE':'PLAN LOCKED');
  put('title',champion&&champion.toUpperCase()!=='YOUR CHAMPION'?champion+(role?' · '+role:''):'Your match focus');

  // Keep just one clear instruction on Focus/Minimal. Deep explanations are
  // still available when the player deliberately selects Expanded.
  const compact=layout.mode!=='EXPANDED';
  const brief=(type,value)=>window.OPCoachBrief?.cue?.(type,value,role)||cue(value,82)||'Play for a safer fight.';
  if(plan.baseline){
   put('missionLabel','Baseline game '+Math.min(Number(plan.baseline.games||0)+1,Number(plan.baseline.required||3))+' of '+Number(plan.baseline.required||3));
   put('mission','Play normally. Collect your baseline.');
  }else{
   put('missionLabel',compact?'DO THIS':'Your mission');
   put('mission',plan.mission?brief('MISSION',plan.mission):'Follow your pre-game focus.');
  }
  show('missionBlock',true);

  const win=text(plan.winCondition),job=text(plan.job);
  put('winLabel',compact?'TEAM PLAN':win?'Win condition':'Your job');
  put('win',job?brief('MOVE',job):win?brief('WIN',win):'');
  show('winBlock',Boolean(win||job));

  const actions=Array.isArray(plan.actions)?plan.actions.map(text).filter(Boolean).slice(0,3).map(x=>brief('STEP',x)):[];
  putList('actions',actions);
  show('actionsBlock',actions.length>0);

  put('avoidLabel','Avoid');
  put('avoid',plan.avoid?brief('AVOID',plan.avoid):'');
  show('avoidBlock',Boolean(text(plan.avoid)));
  put('threat',plan.threat?brief('AVOID',plan.threat):'');
  show('threatBlock',Boolean(text(plan.threat)));
 }

 function renderTft(focusId,mission){
  const domain=String(mission?.domain||'');
  for(const id of ['ECONOMY','TEMPO','FLEX','POSITION'])$('overlay').classList.toggle('tft-focus-'+id.toLowerCase(),(domain==='FLEXIBILITY'?'FLEX':domain==='CONVERSION'?'TEMPO':domain||'ECONOMY')===id);
  showChampion(null,'TFT');
  put('identityTag','TACTICIAN / LEARNING FOCUS');
  put('hudBrandMode','TACTICIAN HUD');
  put('game','TEAMFIGHT TACTICS');
  put('freezeNote','PRESELECTED BEFORE PLAY');
  put('ruleNote','SELECTED BEFORE PLAY · REVIEW AFTER');
  put('planState',mission?.status==='BASELINE'?'DNA BASELINE':'ACCOUNT MISSION LOCKED');
  put('title',mission?.title||'BUILD YOUR TFT DNA');
  put('missionLabel',mission?.status==='BASELINE'?'Baseline mission':'Your TFT DNA mission');
  put('mission',mission?.nextGame||'Play normally and collect decision evidence before a mission can be assigned.');
  show('missionBlock',true);
  put('winLabel','Remember');put('win',mission?.cues?.[0]||'');show('winBlock',Boolean(mission?.cues?.[0]));
  put('avoidLabel','Also remember');put('avoid',mission?.cues?.[1]||'');show('avoidBlock',Boolean(mission?.cues?.[1]));
  putList('actions',[]);show('actionsBlock',false);
  put('threat','');show('threatBlock',false);
 }

 function renderBuildGuide(next){
  const guide=next?.buildGuide||null,rows=[];
  const showing=Boolean(next?.buildsOpen)&&['LOL','TFT'].includes(next?.game);
  $('overlay').classList.toggle('builds-open',showing);
  show('buildGuidePanel',showing);
  if(guide?.game==='TFT'){
    put('buildGuideTitle','TFT COMP OPTIONS');
    const builds=Array.isArray(guide.builds)?guide.builds:[];
    const selected=builds.find(b=>b.id===guide.selectedId)||null;
    const ordered=selected?[selected,...builds.filter(b=>b.id!==selected.id)]:builds;
    for(const [index,row] of ordered.entries()){
      rows.push((index===0&&selected?'★ YOUR PREFERRED ROUTE':'OPTION '+(index+1))+' · '+row.title+' ['+row.tier+']');
      rows.push('Carry: '+row.primary+' · '+row.tempo);
      rows.push('Core items: '+(row.items||[]).join(' / '));
      if(row.secondaryItems?.length)rows.push('Second carry: '+row.secondaryItems.join(' / '));
      rows.push(row.rationale);rows.push('');
    }
    put('buildGuideHint','Three patch-labelled choices. Your preferred route was locked before this match.');
    put('buildGuidePatch','PATCH '+(guide.patch||'UNVERIFIED')+' · SOURCE SNAPSHOT '+(guide.asOf||'UNKNOWN'));
    const quick=selected||ordered[0];
    put('buildQuickCopy',quick?quick.title+' · '+(quick.items||[]).join(' → '):'');
    put('buildQuickPatch','PATCH '+(guide.patch||'—')+' · CTRL+SHIFT+B FOR ALTERNATIVES');
    show('buildQuick',Boolean(quick));
  }else if(guide?.game==='LOL'){
    put('buildGuideTitle',(guide.champion||'CHAMPION')+' · '+guide.role);
    if(guide.items?.length)rows.push('PREGAME ITEM PATH\n'+guide.items.join(' → ')+'\n');
    if(guide.runes?.length)rows.push('RUNES\n'+guide.runes.join(' · ')+'\n');
    if(guide.skillOrder?.length)rows.push('SKILL ORDER\n'+guide.skillOrder.join(' → ')+'\n');
    if(guide.summoners?.length)rows.push('SUMMONERS\n'+guide.summoners.join(' / '));
    if(guide.note)rows.push('\n'+guide.note);
    put('buildGuideHint','Current patch guide fetched in champion select, then frozen. Review alternatives yourself.');
    put('buildGuidePatch','PATCH '+(guide.patch||'UNVERIFIED')+' · '+(guide.source||'CURRENT PATCH DATA'));
    put('buildQuickCopy',guide.items?.length?guide.items.slice(0,3).join(' → '):'');
    put('buildQuickPatch','PATCH '+(guide.patch||'—')+' · CTRL+SHIFT+B FOR FULL GUIDE');
    show('buildQuick',Boolean(guide.items?.length));
  }else{
    put('buildGuideTitle','BUILD OPTIONS UNAVAILABLE');
    put('buildGuideHint','No pre-game build snapshot was loaded. Live gameplay will not generate replacement advice.');
    put('buildGuidePatch','NO LOCKED BUILD DATA');
    show('buildQuick',false);
  }
  put('buildGuideRows',rows.length?rows.join('\n'):'No pre-game build suggestions are available for this match.');
 }

 function coachTranscript(){
  const lines=['AI Coach: Ask about your locked mission or general game principles.'];
  for(const row of coachHistory.slice(-8)){
    lines.push((row.role==='user'?'You':'AI Coach')+': '+String(row.content||'').slice(0,1100));
  }
  $('coachThread').textContent=lines.join('\n\n');
  $('coachThread').scrollTop=$('coachThread').scrollHeight||0;
 }
 function renderCoachPanel(next){
  const open=Boolean(next?.assistantOpen)&&['LOL','TFT'].includes(next?.game);
  if(coachGame!==next?.game){coachHistory=[];coachGame=next?.game||'';coachTranscript()}
  $('overlay').classList.toggle('coach-open',open);
  show('coachPanel',open);
  if(open&&!coachWasOpen)$('coachInput').focus?.();
  coachWasOpen=open;
 }
 async function submitCoachQuestion(event){
  event?.preventDefault?.();
  const input=$('coachInput');
  const message=String(input?.value||'').trim().slice(0,350);
  if(!message||coachPending||!state?.assistantOpen)return;
  if(typeof window.opOverlay?.askCoach!=='function'){
    put('coachStatus','Update OP CLIMB Companion to activate AI Coach.');
    return;
  }
  const previous=coachHistory.slice(-6);
  coachHistory.push({role:'user',content:message});coachHistory=coachHistory.slice(-8);
  input.value='';coachPending=true;$('coachSend').disabled=true;
  put('coachStatus','COACH IS THINKING · GAME IS STILL RECORDING');
  coachTranscript();
  try{
    const result=await window.opOverlay.askCoach(message,previous);
    const answer=result?.ok?String(result.answer||'').slice(0,1100):String(result?.error||'Coach unavailable.').slice(0,300);
    coachHistory.push({role:'assistant',content:answer});coachHistory=coachHistory.slice(-8);
    put('coachStatus',result?.ok?'GENERAL LEARNING · NO LIVE SHOTCALLING':'SERVICE UNAVAILABLE · GAMEPLAY UNAFFECTED');
    coachTranscript();
  }catch{
    coachHistory.push({role:'assistant',content:'Coach temporarily unavailable. Your game continues to record normally.'});
    coachTranscript();put('coachStatus','OFFLINE · GAMEPLAY UNAFFECTED');
  }finally{coachPending=false;$('coachSend').disabled=false;if(state?.assistantOpen)$('coachInput').focus?.()}
 }

 function render(next){
  if(!next)return;
  state=next;
  // Live tracker updates must never reset the HUD mid-drag/mid-resize.
  if(!drag&&!resize)layout={...layout,...next.layout};
  const editing=Boolean(next.editing),preview=next.game==='PREVIEW';
  $('editor').hidden=!editing;
  $('overlay').classList.toggle('editing',editing);
  $('overlay').classList.toggle('preview',preview);
  $('overlay').classList.toggle('is-tft',next.game==='TFT');
  put('status',preview?'LAYOUT PREVIEW':next.game==='TFT'?'TFT RECORDING':'LEAGUE RECORDING');
  put('recordingStatus',preview?'● EDITOR PREVIEW':'● TRACKING ACTIVE');
  if(next.game==='TFT')renderTft(next.focus,next.tftMission);
  else if(next.plan)renderLeague(next.plan);
  else{
   // Preview without a match: show what each layout holds, clearly labelled.
   showChampion(null,'OP');
   put('hudBrandMode','PERFORMANCE HUD');
   put('identityTag','PLAYER / MATCH ID');
   show('tftSigil',false);
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
  renderCoachPanel(next);
  renderBuildGuide(next);
  place();
 }

 async function save(){
  const result=await window.opOverlay.saveLayout({...layout}).catch(()=>null);
  if(result?.layout){layout={...layout,...result.layout};place()}
  return result;
 }
 function setMode(mode){
  if(!MODES.includes(mode))return;
  layout.mode=mode;
  if(state?.game==='LOL'&&state.plan)renderLeague(state.plan);
  place();void save();
 }

 // Move: drag the header while editing.
 $('handle').addEventListener('pointerdown',event=>{
  if(!state?.editing||event.button!==0)return;
  event.preventDefault?.();
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
  event.preventDefault?.();
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
 const move=async(dx,dy)=>{
  if(!state?.editing)return;
  const result=await window.opOverlay.nudge?.(dx,dy).catch?.(()=>null);
  if(result?.ok&&result.layout){layout={...layout,...result.layout};place()}
 };
 const moveButtons=[['hudMoveLeft',-.02,0],['hudMoveRight',.02,0],['hudMoveUp',0,-.02],['hudMoveDown',0,.02]];
 for(const [id,dx,dy] of moveButtons)$(id).addEventListener('click',()=>{void move(dx,dy)});
 $('hudCentre').addEventListener('click',async()=>{
  if(!state?.editing)return;
  const result=await window.opOverlay.center?.().catch?.(()=>null);
  if(result?.ok&&result.layout){layout={...layout,...result.layout};place()}
 });
 $('done').addEventListener('click',async()=>{
  const saved=await save();
  if(saved?.ok===false)return;
  await window.opOverlay.finishEditing();
 });
 $('coachForm').addEventListener('submit',submitCoachQuestion);
 $('coachClose').addEventListener('click',()=>{void window.opOverlay.toggleAssistant?.()});
 $('buildGuideClose').addEventListener('click',()=>{void window.opOverlay.toggleBuilds?.()});
 document.addEventListener?.('keydown',event=>{
   if(state?.editing&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
     if(event.target?.matches?.('input,textarea,select,[contenteditable]'))return;
     event.preventDefault?.();
     const step=event.shiftKey?.05:.01;
     const moves={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
     void move(...moves[event.key]);
     return;
   }
   if(event.key==='Escape'&&(state?.assistantOpen||state?.buildsOpen)){
     event.preventDefault?.();
     if(state?.buildsOpen)void window.opOverlay.toggleBuilds?.();
     else void window.opOverlay.toggleAssistant?.();
   }
 });
 window.addEventListener('resize',place);
 window.opOverlay.onState(render);
 void window.opOverlay.getState().then(render);
})();
