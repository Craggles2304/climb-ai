/* Dev-only stand-in for overlay-preload.cjs, so the in-game HUD can be viewed
   in a browser. Plans mirror overlay-model.cjs freezeLeaguePlan output. */
(()=>{
  const plans={
    PLUS:{champion:'Ahri',role:'MID',winCondition:'Catch one target with Ahri and Vi before dragon, then take the objective 5v4.',
      job:'Shove first, then roam to bot when their jungler shows top.',mission:'Hold the wave before your first back',
      avoid:'Walking into river without vision after 20 minutes.',threat:'They poke you down from range and siege towers before you can engage.',
      actions:['Shove at level 3','Roam bot with Vi → Ward river before dragon','Charm the first target in range → Take dragon, then reset'],baseline:null},
    FREE:{champion:'Ahri',role:'MID',winCondition:'',job:'Shove first, then roam to bot when their jungler shows top.',mission:'Hold the wave before your first back',
      avoid:'',threat:'',actions:['Trade when Syndra spends Q on the wave','Shove at level 3, then look at river','Hold Charm for her E'],baseline:null},
    BASELINE:{champion:'Jinx',role:'ADC',winCondition:'',job:'Stay safe and hit the nearest safe target.',mission:'',avoid:'',threat:'',actions:[],baseline:{games:1,required:3}},
  };
  let current={show:true,editing:false,game:'LOL',status:'LEAGUE · RECORDING',layout:{x:.62,y:.06,scale:1,opacity:.96,mode:'FOCUS'},plan:plans.PLUS,focus:'ECONOMY'};
  const listeners=[];
  window.opOverlay={
    getState:()=>Promise.resolve(current),
    onState:fn=>{listeners.push(fn);return()=>{}},
    saveLayout:layout=>{current={...current,layout:{...current.layout,...layout}};return Promise.resolve({ok:true,layout:current.layout})},
    finishEditing:()=>{current={...current,editing:false};listeners.forEach(fn=>fn(current));return Promise.resolve({ok:true})},
  };
  window.__hud={
    set({plan='PLUS',mode,editing,game='LOL',x,y,scale,opacity}={}){
      current={...current,game,editing:Boolean(editing),plan:game==='LOL'?plans[plan]:null,
        layout:{...current.layout,...(mode?{mode}:{}),...(x!=null?{x}:{}),...(y!=null?{y}:{}),...(scale!=null?{scale}:{}),...(opacity!=null?{opacity}:{})}};
      listeners.forEach(fn=>fn(current));
    },
  };
  // A champion splash stands in for the game behind the click-through window.
  window.addEventListener('DOMContentLoaded',()=>{
    const backdrop=document.createElement('div');
    Object.assign(backdrop.style,{position:'fixed',inset:'0',zIndex:'-1',backgroundSize:'cover',backgroundPosition:'center',
      backgroundImage:'url("https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Jinx_0.jpg")'});
    document.body.prepend(backdrop);
  });
})();
