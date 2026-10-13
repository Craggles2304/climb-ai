'use strict';
/* Compact Companion pre-game picker. Data fetched only while out of game. */
(function(){
 const $=id=>document.getElementById(id);
 let current=null,choice='',busy=false;
 const section=document.createElement('section');
 section.id='tftBuildPicker';section.className='card tft-build-picker hidden';
 section.innerHTML='<div class="tft-build-picker__top"><div class="eyebrow">TFT · PRE-GAME BUILDS</div><h2>THREE VIABLE ROUTES. YOU DECIDE.</h2><p>Compare patch-labelled comps and item packages before queue. Your preferred route is frozen in the game overlay; nothing changes based on live shops, boards or opponents.</p></div><div class="tft-build-picker__meta" id="buildPickerPatch"></div><div class="tft-build-picker__grid" id="buildPickerGrid"></div><p class="tft-build-picker__notice" id="buildPickerNotice" role="status">Loading reference options…</p>';
 $('status').after(section);
 const league=document.createElement('section');league.id='leagueBuildPanel';league.className='card tft-build-picker hidden';
 league.innerHTML='<div class="eyebrow">LEAGUE · CURRENT-PATCH PREGAME GUIDE</div><h2 id="leagueBuildTitle">CHAMPION BUILD</h2><p id="leagueBuildIntro">Item, rune and skill builds are fetched during champion select. The in-game HUD receives only the locked pre-game reference.</p><div id="leagueBuildContent" class="tft-build-picker__league"></div><small id="leagueBuildPatch"></small>';
 section.after(league);
 const write=(node,copy)=>{node.textContent=String(copy||'')};
 const add=(element,tag,className,copy)=>{const n=document.createElement(tag);n.className=className;write(n,copy);element.appendChild(n);return n};
 function render(state){
   if(state)current=state;
   const connected=Boolean(current?.paired);
   const leagueOpen=connected&&['CHAMP_SELECT','RECORDING'].includes(current?.phase);
   league.classList.toggle('hidden',!leagueOpen);
   section.classList.toggle('hidden',!connected||leagueOpen);
   if(leagueOpen){
     const snapshot=current?.leagueBuild;
     write($('leagueBuildTitle'),snapshot?.champion?snapshot.champion.toUpperCase()+' · '+snapshot.role:'FETCHING CHAMPION DATA…');
     const rows=$('leagueBuildContent');rows.replaceChildren();
     if(snapshot){
       if(snapshot.items?.length)add(rows,'p','','ITEM PATH  ·  '+snapshot.items.join(' → '));
       if(snapshot.runes?.length)add(rows,'p','','RUNES  ·  '+snapshot.runes.join(' / '));
       if(snapshot.skillOrder?.length)add(rows,'p','','SKILLS  ·  '+snapshot.skillOrder.join(' → '));
       if(snapshot.summoners?.length)add(rows,'p','','SPELLS  ·  '+snapshot.summoners.join(' / '));
     }
     if(!rows.childNodes?.length)add(rows,'p','','No verified current-patch build loaded for this champion. Your game continues normally.');
     write($('leagueBuildPatch'),snapshot?.patch?'PATCH '+snapshot.patch+' · '+snapshot.source+' · '+(current.phase==='RECORDING'?'LOCKED FROM CHAMP SELECT':'CHAMP SELECT PREVIEW'):'UNVERIFIED · NO GUESSED BUILD');
   }
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
