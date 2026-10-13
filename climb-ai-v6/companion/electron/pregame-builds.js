'use strict';
/* Compact Companion pre-game picker. Data fetched only while out of game. */
(function(){
 const $=id=>document.getElementById(id);
 let current=null,choice='',busy=false;
 const section=document.createElement('section');
 section.id='tftBuildPicker';section.className='card tft-build-picker hidden';
 section.innerHTML='<div class="tft-build-picker__top"><div class="eyebrow">TFT · PRE-GAME BUILDS</div><h2>THREE VIABLE ROUTES. YOU DECIDE.</h2><p>Compare patch-labelled comps and item packages before queue. Your preferred route is frozen in the game overlay; nothing changes based on live shops, boards or opponents.</p></div><div class="tft-build-picker__meta" id="buildPickerPatch"></div><div class="tft-build-picker__grid" id="buildPickerGrid"></div><p class="tft-build-picker__notice" id="buildPickerNotice" role="status">Loading reference options…</p>';
 $('status').after(section);
 const write=(node,copy)=>{node.textContent=String(copy||'')};
 const add=(element,tag,className,copy)=>{const n=document.createElement(tag);n.className=className;write(n,copy);element.appendChild(n);return n};
 function render(state){
   if(state)current=state;
   const connected=Boolean(current?.paired);
   section.classList.toggle('hidden',!connected);
   if(!connected)return;
   const builds=current.tftBuilds?.builds||[];
   const recording=current.tftRecorder?.state==='RECORDING';
   const selected=current.tftBuildId||'';
   write($('buildPickerPatch'),current.tftBuilds?.patch?'PATCH '+current.tftBuilds.patch+' · VERIFIED SOURCE PACK '+current.tftBuilds.asOf:'SOURCE PACK UNAVAILABLE');
   const grid=$('buildPickerGrid');grid.replaceChildren();
   for(const row of builds){
     const card=add(grid,'article','tft-build-picker__card'+(selected===row.id?' selected':''),'');
     add(card,'span','tft-build-picker__tier',row.tier+' · '+row.tempo);
     add(card,'h3','',row.title);
     add(card,'p','tft-build-picker__carry',row.primary+' · '+row.style);
     add(card,'p','tft-build-picker__items','CORE ITEMS: '+row.items.join(' · '));
     if(row.secondaryItems?.length)add(card,'p','tft-build-picker__secondary','SECONDARY: '+row.secondaryItems.join(' · '));
     add(card,'p','tft-build-picker__reason',row.rationale);
     const button=add(card,'button','tft-build-picker__choose',recording?'FROZEN FOR MATCH':selected===row.id?'YOUR PREFERRED ROUTE ✓':'PREFER THIS ROUTE');
     button.type='button';button.disabled=recording||busy;
     button.addEventListener('click',async()=>{
       busy=true;button.disabled=true;
       try{const answer=await window.opCompanion.setTftBuild(row.id);
         write($('buildPickerNotice'),answer?.ok?'Preference saved. Reference frozen when your next TFT game begins.':answer?.error||'Could not save selection.');
       }catch{write($('buildPickerNotice'),'Cannot save preference right now.')}finally{busy=false}
     });
   }
   write($('buildPickerNotice'),current.tftBuildError||
     (!builds.length?'Loading build routes from OP CLIMB…':
     recording?'REFERENCE FROZEN · NO LIVE BUILD CALLS':
     selected?'PREFERRED ROUTE SAVED · STATIC OPTIONS STILL AVAILABLE':
     'PICK A PREFERRED ROUTE BEFORE QUEUE · OR LEAVE OPEN'));
 }
 window.opCompanion.onState(render);
 window.opCompanion.getState().then(render).catch(()=>{});
})();
