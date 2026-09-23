(()=>{
  const $=id=>document.getElementById(id);
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const upper=value=>clean(value).toUpperCase();

  function install(){
    if($('opPlayerIdentityReview'))return $('opPlayerIdentityReview');
    const anchor=$('opCausalCoachRouteReview')||$('opCausalChain')||$('opReadCalibration');
    if(!anchor?.parentNode)return null;
    const style=document.createElement('style');
    style.id='op-player-identity-review-style';
    style.textContent=[
      '.op-pci-review{margin:12px 0;border:1px solid rgba(214,255,47,.22);background:linear-gradient(135deg,rgba(6,12,17,.98),rgba(214,255,47,.025));padding:13px 14px}.op-pci-review-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.op-pci-review-head span{display:block;font-size:7px;letter-spacing:.16em;color:#d6ff2f;font-weight:950}.op-pci-review-head strong{display:block;margin-top:5px;font-size:14px;color:#f4f7f8}.op-pci-review-head b{font-size:8px;color:#64a9ff;border:1px solid rgba(100,169,255,.24);padding:6px 8px}',
      '.op-pci-review-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:7px;margin-top:9px}.op-pci-review-cell{border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.018);padding:9px}.op-pci-review-cell span{display:block;font-size:6px;letter-spacing:.13em;color:#74838d;font-weight:900}.op-pci-review-cell strong{display:block;margin-top:5px;color:#ebf0f2;font-size:9px;line-height:1.4}.op-pci-review-cell.change strong{color:#d6ff2f}',
      '.op-pci-review-brief{margin-top:8px;border-left:2px solid #d6ff2f;padding:8px 10px;background:rgba(214,255,47,.03)}.op-pci-review-brief span{display:block;font-size:6px;color:#d6ff2f;letter-spacing:.14em;font-weight:950}.op-pci-review-brief strong{display:block;margin-top:4px;color:#edf2f4;font-size:9px;line-height:1.42}.op-pci-review small{display:block;margin-top:7px;color:#65727a;font-size:7px;line-height:1.4}',
      '@media(max-width:900px){.op-pci-review-grid{grid-template-columns:1fr 1fr}}'
    ].join('');
    document.head.appendChild(style);
    const root=document.createElement('section');
    root.id='opPlayerIdentityReview';root.className='op-pci-review';
    root.innerHTML=[
      '<div class="op-pci-review-head"><div><span>PLAYER MODEL · UPDATED AFTER THIS GAME</span><strong id="opPciReviewHeadline">COACHING IDENTITY BUILDING</strong></div><b id="opPciReviewStatus">BUILDING</b></div>',
      '<div class="op-pci-review-grid">',
      '<div class="op-pci-review-cell change"><span>MODEL CHANGE</span><strong id="opPciReviewChange">UNCHANGED</strong></div>',
      '<div class="op-pci-review-cell"><span>ROOT CAUSE</span><strong id="opPciReviewRoot">BUILDING</strong></div>',
      '<div class="op-pci-review-cell"><span>NEXT DEVELOPMENT</span><strong id="opPciReviewFocus">BUILDING</strong></div>',
      '<div class="op-pci-review-cell"><span>SUPPORT NEED</span><strong id="opPciReviewSupport">BUILDING</strong></div>',
      '</div>',
      '<div class="op-pci-review-brief"><span>NEXT-GAME COACH BRIEF</span><strong id="opPciReviewBrief"></strong></div>',
      '<small id="opPciReviewMeta"></small>'
    ].join('');
    anchor.parentNode.insertBefore(root,anchor.nextSibling);
    return root;
  }

  function render(review){
    const root=install();if(!root)return;
    const model=review?.playerCoachingIdentity||null;
    root.hidden=!model;
    if(!model)return;
    $('opPciReviewHeadline').textContent=upper(model.headline||'COACHING IDENTITY BUILDING');
    $('opPciReviewStatus').textContent=upper((model.status||'BUILDING')+' · '+(model.confidence||'LOW'));
    $('opPciReviewChange').textContent=upper((model.change?.status||'UNCHANGED')+(model.change?.changedFields?.length?' · '+model.change.changedFields.join(' / ').replaceAll('_',' '):''));
    $('opPciReviewRoot').textContent=upper(model.rootCause?.label||model.rootCause?.status||'BUILDING');
    $('opPciReviewFocus').textContent=upper(model.coachBrief?.focus||model.development?.label||'BUILDING');
    $('opPciReviewSupport').textContent=upper(model.autonomy?.supportNeed||model.autonomy?.state||'BUILDING');
    $('opPciReviewBrief').textContent=upper(model.coachBrief?.oneSentence||model.coachBrief?.firstQuestion||'KEEP BUILDING VERIFIED DECISION EVIDENCE.');
    $('opPciReviewMeta').textContent=upper([
      clean(model.change?.summary),
      model.stability?.score!=null?'MODEL STABILITY '+String(model.stability.score)+'/100':'',
      clean(model.boundary),
    ].filter(Boolean).join(' · '));
    root.title=[clean(model.summary),clean(model.coachingResponse?.evidence),clean(model.autonomy?.evidence),clean(model.rootCause?.evidence)].filter(Boolean).join(' · ');
  }

  install();
  window.opCompanion?.getState?.().then(state=>render(state?.postGameReview||null)).catch(()=>{});
  window.opCompanion?.onState?.(state=>{if(state?.phase==='REVIEW')render(state?.postGameReview||null)});
})();