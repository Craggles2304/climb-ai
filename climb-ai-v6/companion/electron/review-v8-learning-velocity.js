(()=>{
  const $=id=>document.getElementById(id);
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const upper=value=>clean(value).toUpperCase();
  function install(){
    if($('opLearningVelocityReview'))return $('opLearningVelocityReview');
    const adaptive=$('opAdaptiveSessionReview');
    const identity=$('opPlayerIdentityReview');
    const anchor=adaptive||identity||$('opCausalCoachRouteReview');
    if(!anchor?.parentNode)return null;
    const style=document.createElement('style');style.id='op-learning-velocity-review-style';
    style.textContent=[
      '.lv-r{margin:12px 0;border:1px solid rgba(214,255,47,.22);background:linear-gradient(135deg,rgba(5,11,16,.98),rgba(214,255,47,.025));padding:13px 14px}.lv-r-head{display:flex;justify-content:space-between;gap:10px}.lv-r-head span{display:block;font-size:7px;letter-spacing:.16em;color:#d6ff2f;font-weight:950}.lv-r-head strong{display:block;margin-top:5px;font-size:14px;color:#f2f6f8}.lv-r-head b{font-size:8px;padding:6px 8px;border:1px solid rgba(100,169,255,.24);color:#64a9ff}',
      '.lv-r-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:9px}.lv-r-cell{border:1px solid rgba(255,255,255,.07);padding:9px;background:rgba(255,255,255,.018)}.lv-r-cell span{display:block;font-size:6px;color:#71808a;letter-spacing:.13em;font-weight:900}.lv-r-cell strong{display:block;margin-top:5px;font-size:9px;line-height:1.4;color:#ecf1f3}.lv-r-cell.change strong{color:#d6ff2f}',
      '.lv-r-next{margin-top:8px;border-left:2px solid #d6ff2f;padding:8px 10px;background:rgba(214,255,47,.03)}.lv-r-next span{display:block;font-size:6px;color:#d6ff2f;letter-spacing:.14em;font-weight:950}.lv-r-next strong{display:block;margin-top:4px;font-size:9px;line-height:1.4;color:#edf2f4}.lv-r small{display:block;margin-top:7px;font-size:7px;line-height:1.4;color:#68767f}',
      '@media(max-width:900px){.lv-r-grid{grid-template-columns:1fr 1fr}}'
    ].join('');document.head.appendChild(style);
    const root=document.createElement('section');root.id='opLearningVelocityReview';root.className='lv-r';
    root.innerHTML=[
      '<div class="lv-r-head"><div><span>LEARNING VELOCITY · POST-GAME</span><strong id="opLvrTitle">VELOCITY UPDATE</strong></div><b id="opLvrStatus">BUILDING</b></div>',
      '<div class="lv-r-grid">',
      '<div class="lv-r-cell change"><span>POLICY CHANGE</span><strong id="opLvrChange">UNCHANGED</strong></div>',
      '<div class="lv-r-cell"><span>PACE</span><strong id="opLvrPace">BUILDING</strong></div>',
      '<div class="lv-r-cell"><span>INDEPENDENT RATE</span><strong id="opLvrIndependent">BUILDING</strong></div>',
      '<div class="lv-r-cell"><span>METHOD SIGNAL</span><strong id="opLvrMethod">EXPLORE</strong></div>',
      '</div>',
      '<div class="lv-r-next"><span>NEXT BLOCK ADJUSTMENT</span><strong id="opLvrNext"></strong></div>',
      '<small id="opLvrMeta"></small>'
    ].join('');
    if(adaptive&&adaptive.parentNode===anchor.parentNode)adaptive.parentNode.insertBefore(root,adaptive);
    else anchor.parentNode.insertBefore(root,anchor.nextSibling);
    return root;
  }
  function render(review){
    const root=install();if(!root)return;
    const p=review?.learningVelocity||null;root.hidden=!p;if(!p)return;
    const card=p.activeCard||null,policy=p.policy||{},change=p.change||{};
    $('opLvrTitle').textContent=upper((p.activeBehaviourLabel||'ACTIVE DEVELOPMENT')+' · '+(policy.paceState||'BUILDING'));
    $('opLvrStatus').textContent=upper((p.status||'BUILDING')+' · '+(p.confidence||'LOW'));
    $('opLvrChange').textContent=upper((change.status||'UNCHANGED')+(Array.isArray(change.changedFields)&&change.changedFields.length?' · '+change.changedFields.join(' / ').replaceAll('_',' '):''));
    $('opLvrPace').textContent=upper(policy.paceState||'BUILDING');
    $('opLvrIndependent').textContent=card?.independentRate==null?'BUILDING':String(card.independentRate)+'% · '+String(card.independentCleanMissions||0)+' CLEAN';
    $('opLvrMethod').textContent=upper(policy.recommendedMethodLabel||policy.methodMode||'EXPLORE');
    $('opLvrNext').textContent=upper([
      policy.reason,
      'REINFORCE '+String(policy.reinforceCleanRepsRequired||2)+' CLEAN',
      'FADE '+String(policy.fadeCleanRepsRequired||1)+' INDEPENDENT',
    ].filter(Boolean).join(' · '));
    $('opLvrMeta').textContent=upper([clean(change.summary),clean(p.summary),clean(p.boundary)].filter(Boolean).join(' · '));
  }
  install();
  window.opCompanion?.getState?.().then(state=>render(state?.postGameReview||null)).catch(()=>{});
  window.opCompanion?.onState?.(state=>{if(state?.phase==='REVIEW')render(state?.postGameReview||null)});
})();