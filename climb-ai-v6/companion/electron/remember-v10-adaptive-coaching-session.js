(()=>{
  const STORE='opclimb.deep-locked-plan.v1';
  const $=id=>document.getElementById(id);
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const upper=value=>clean(value).toUpperCase();
  function load(){try{return JSON.parse(localStorage.getItem(STORE)||'null')?.adaptiveCoachingSession||null}catch{return null}}
  function install(){
    if($('opAdaptiveCoachingSession'))return $('opAdaptiveCoachingSession');
    const anchor=$('opPlayerCoachingIdentity')||$('opRemFrozenPlaybook');if(!anchor?.parentNode)return null;
    const style=document.createElement('style');style.id='op-adaptive-session-style';
    style.textContent=[
      '.acs{margin:10px 0;border:1px solid rgba(100,169,255,.24);background:linear-gradient(135deg,rgba(100,169,255,.045),rgba(214,255,47,.018));padding:12px 13px}',
      '.acs-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.acs-head span{display:block;font-size:7px;letter-spacing:.16em;color:#64a9ff;font-weight:950}.acs-head strong{display:block;margin-top:4px;font-size:14px;color:#f3f7f8}.acs-head b{font-size:8px;letter-spacing:.09em;color:#d6ff2f;border:1px solid rgba(214,255,47,.2);padding:6px 8px}',
      '.acs-steps{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-top:9px}.acs-step{border:1px solid rgba(255,255,255,.07);background:rgba(3,8,12,.72);padding:7px;min-width:0}.acs-step span{display:block;font-size:6px;color:#687780;letter-spacing:.11em;font-weight:900}.acs-step strong{display:block;margin-top:4px;font-size:8px;line-height:1.25;color:#9aa8b0}.acs-step.active{border-color:rgba(214,255,47,.42);background:rgba(214,255,47,.04)}.acs-step.active span,.acs-step.active strong{color:#d6ff2f}.acs-step.done{opacity:.58}',
      '.acs-brief{margin-top:8px;border-left:2px solid #64a9ff;background:rgba(100,169,255,.035);padding:9px 10px}.acs-brief span{display:block;font-size:6px;color:#64a9ff;letter-spacing:.14em;font-weight:950}.acs-brief strong{display:block;margin-top:4px;font-size:9px;line-height:1.42;color:#edf2f4}.acs-sub{margin-top:6px;font-size:7px;line-height:1.4;color:#738089}.acs-block{color:#ffcf66}',
      '@media(max-width:900px){.acs-steps{grid-template-columns:1fr 1fr 1fr}.acs-step:nth-child(4),.acs-step:nth-child(5){grid-column:auto}}'
    ].join('');document.head.appendChild(style);
    const root=document.createElement('section');root.id='opAdaptiveCoachingSession';root.className='acs';
    root.innerHTML=[
      '<div class="acs-head"><div><span>ADAPTIVE COACHING SESSION</span><strong id="opAcsTitle">SESSION BUILDING</strong></div><b id="opAcsStatus">BUILDING</b></div>',
      '<div id="opAcsSteps" class="acs-steps"></div>',
      '<div class="acs-brief"><span>NEXT GAME</span><strong id="opAcsBrief"></strong><div id="opAcsInstruction" class="acs-sub"></div><div id="opAcsBlocker" class="acs-sub acs-block"></div></div>',
      '<div id="opAcsMeta" class="acs-sub"></div>'
    ].join('');
    anchor.parentNode.insertBefore(root,anchor.nextSibling);return root;
  }
  function render(session){
    const root=install();if(!root)return;
    const model=session||load();root.hidden=!model;if(!model)return;
    $('opAcsTitle').textContent=upper(model.objectiveLabel?model.objectiveLabel+' · '+(model.currentStep?.label||model.status):'SESSION BUILDING');
    $('opAcsStatus').textContent=upper(model.status+' · '+(model.currentStepNumber?('STEP '+model.currentStepNumber+'/5'):'WAITING'));
    const steps=$('opAcsSteps');steps.innerHTML='';
    (model.blockPlan||[]).slice(0,5).forEach(step=>{
      const div=document.createElement('div');div.className='acs-step';
      if(Number(step.number)<Number(model.currentStepNumber||0))div.classList.add('done');
      if(Number(step.number)===Number(model.currentStepNumber||0))div.classList.add('active');
      div.innerHTML='<span>STEP '+String(step.number)+'</span><strong>'+upper(step.label)+'</strong>';
      div.title=clean(step.purpose)+' · '+clean(step.advanceRule);steps.appendChild(div);
    });
    $('opAcsBrief').textContent=upper(model.nextGameBrief?.title||'WAITING FOR NEXT GAME');
    $('opAcsInstruction').textContent=upper([model.nextGameBrief?.firstQuestion,model.nextGameBrief?.instruction,model.nextGameBrief?.support].filter(Boolean).join(' · '));
    $('opAcsBlocker').textContent=model.nextGameBrief?.blocker?upper('BLOCKER · '+model.nextGameBrief.blocker):'';
    $('opAcsMeta').textContent=upper([
      'OBSERVED '+String(model.observedGames||0),
      'NOT OBSERVED '+String(model.notObservedGames||0),
      'REPLANS '+String(model.replanCount||0),
      clean(model.boundary),
    ].join(' · '));
    root.title=[clean(model.summary),clean(model.nextGameBrief?.success)].filter(Boolean).join(' · ');
  }
  install();render(null);
  window.addEventListener('op-climb-adaptive-session',event=>render(event.detail||null));
  window.addEventListener('op-climb-live-roster',()=>render(null));
})();