(()=>{
  const $=id=>document.getElementById(id);
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const upper=value=>clean(value).toUpperCase();
  function install(){
    if($('opAdaptiveSessionReview'))return $('opAdaptiveSessionReview');
    const anchor=$('opPlayerIdentityReview')||$('opCausalCoachRouteReview')||$('opCausalChain');if(!anchor?.parentNode)return null;
    const style=document.createElement('style');style.id='op-adaptive-session-review-style';
    style.textContent=[
      '.acs-r{margin:12px 0;border:1px solid rgba(100,169,255,.24);background:linear-gradient(135deg,rgba(5,11,16,.98),rgba(100,169,255,.03));padding:13px 14px}.acs-r-head{display:flex;justify-content:space-between;gap:10px}.acs-r-head span{display:block;font-size:7px;letter-spacing:.16em;color:#64a9ff;font-weight:950}.acs-r-head strong{display:block;margin-top:5px;font-size:14px;color:#f2f6f8}.acs-r-head b{font-size:8px;padding:6px 8px;border:1px solid rgba(214,255,47,.2);color:#d6ff2f}',
      '.acs-r-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:7px;margin-top:9px}.acs-r-cell{border:1px solid rgba(255,255,255,.07);padding:9px;background:rgba(255,255,255,.018)}.acs-r-cell span{display:block;font-size:6px;color:#71808a;letter-spacing:.13em;font-weight:900}.acs-r-cell strong{display:block;margin-top:5px;font-size:9px;line-height:1.4;color:#ecf1f3}.acs-r-cell.event strong{color:#d6ff2f}',
      '.acs-r-next{margin-top:8px;border-left:2px solid #64a9ff;padding:8px 10px;background:rgba(100,169,255,.035)}.acs-r-next span{display:block;font-size:6px;color:#64a9ff;letter-spacing:.14em;font-weight:950}.acs-r-next strong{display:block;margin-top:4px;font-size:9px;line-height:1.4;color:#edf2f4}.acs-r small{display:block;margin-top:7px;font-size:7px;line-height:1.4;color:#68767f}',
      '@media(max-width:900px){.acs-r-grid{grid-template-columns:1fr 1fr}}'
    ].join('');document.head.appendChild(style);
    const root=document.createElement('section');root.id='opAdaptiveSessionReview';root.className='acs-r';
    root.innerHTML=[
      '<div class="acs-r-head"><div><span>ADAPTIVE SESSION · POST-GAME</span><strong id="opAcsrTitle">SESSION UPDATE</strong></div><b id="opAcsrStatus">BUILDING</b></div>',
      '<div class="acs-r-grid">',
      '<div class="acs-r-cell event"><span>LAST EVENT</span><strong id="opAcsrEvent">NO EVENT</strong></div>',
      '<div class="acs-r-cell"><span>CURRENT STEP</span><strong id="opAcsrStep">BUILDING</strong></div>',
      '<div class="acs-r-cell"><span>SESSION RECORD</span><strong id="opAcsrRecord">0 OBSERVED</strong></div>',
      '<div class="acs-r-cell"><span>REPLANS</span><strong id="opAcsrReplans">0</strong></div>',
      '</div>',
      '<div class="acs-r-next"><span>NEXT GAME</span><strong id="opAcsrNext"></strong></div>',
      '<small id="opAcsrMeta"></small>'
    ].join('');
    anchor.parentNode.insertBefore(root,anchor.nextSibling);return root;
  }
  function render(review){
    const root=install();if(!root)return;
    const s=review?.adaptiveCoachingSession||null;root.hidden=!s;if(!s)return;
    const events=Array.isArray(s.events)?s.events:[];const last=events[events.length-1]||null;
    $('opAcsrTitle').textContent=upper((s.objectiveLabel||'COACHING SESSION')+' · '+(s.currentStep?.label||s.status));
    $('opAcsrStatus').textContent=upper(s.status+(s.currentStepNumber?' · '+s.currentStepNumber+'/5':''));
    $('opAcsrEvent').textContent=upper(last?last.action+' · '+last.note:'NO NEW SESSION EVENT');
    $('opAcsrStep').textContent=upper(s.currentStep?s.currentStep.label+' · '+s.currentStep.purpose:'SESSION COMPLETE / BUILDING');
    $('opAcsrRecord').textContent=upper(String(s.observedGames||0)+' OBSERVED · '+String(s.notObservedGames||0)+' NOT OBSERVED');
    $('opAcsrReplans').textContent=String(s.replanCount||0);
    $('opAcsrNext').textContent=upper([s.nextGameBrief?.title,s.nextGameBrief?.instruction,s.nextGameBrief?.blocker?('BLOCKER: '+s.nextGameBrief.blocker):''].filter(Boolean).join(' · '));
    $('opAcsrMeta').textContent=upper([clean(s.summary),clean(s.boundary)].filter(Boolean).join(' · '));
  }
  install();
  window.opCompanion?.getState?.().then(state=>render(state?.postGameReview||null)).catch(()=>{});
  window.opCompanion?.onState?.(state=>{if(state?.phase==='REVIEW')render(state?.postGameReview||null)});
})();