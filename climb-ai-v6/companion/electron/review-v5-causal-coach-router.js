(()=>{
  const $=id=>document.getElementById(id);
  const upper=value=>String(value??'').replace(/\s+/g,' ').trim().toUpperCase();

  function install(){
    if($('opCausalCoachRouteReview'))return $('opCausalCoachRouteReview');
    const anchor=$('opCausalChain')||$('opReadCalibration');
    if(!anchor?.parentNode)return null;
    const style=document.createElement('style');
    style.id='op-causal-route-review-style';
    style.textContent=[
      '.op-router-review{margin:12px 0;border:1px solid rgba(100,169,255,.22);background:rgba(6,12,17,.96);padding:12px 14px}.op-router-review-head{display:flex;justify-content:space-between;gap:10px}.op-router-review-head span{display:block;font-size:7px;letter-spacing:.16em;color:#64a9ff;font-weight:950}.op-router-review-head strong{display:block;margin-top:5px;font-size:13px;color:#f2f6f8}.op-router-review-head b{font-size:8px;color:#d6ff2f;border:1px solid rgba(214,255,47,.24);padding:6px 8px}',
      '.op-router-review-grid{display:grid;grid-template-columns:.8fr .8fr 1.8fr;gap:8px;margin-top:9px}.op-router-review-cell{border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);padding:9px}.op-router-review-cell span{display:block;font-size:6px;color:#71808a;letter-spacing:.13em;font-weight:900}.op-router-review-cell strong{display:block;margin-top:5px;color:#e9eef0;font-size:9px;line-height:1.4}.op-router-review-next{margin-top:8px;border-left:2px solid #d6ff2f;padding:8px 10px;background:rgba(214,255,47,.03)}.op-router-review-next span{display:block;font-size:6px;color:#d6ff2f;letter-spacing:.14em;font-weight:950}.op-router-review-next strong{display:block;margin-top:4px;font-size:9px;color:#edf2f4;line-height:1.4}.op-router-review small{display:block;margin-top:7px;color:#626f78;font-size:7px;line-height:1.4}',
      '@media(max-width:900px){.op-router-review-grid{grid-template-columns:1fr}}'
    ].join('');
    document.head.appendChild(style);
    const root=document.createElement('section');
    root.id='opCausalCoachRouteReview';root.className='op-router-review';
    root.innerHTML=[
      '<div class="op-router-review-head"><div><span>CAUSAL COACH ROUTER · POST-GAME CHECK</span><strong id="opRouterReviewTitle">NO ROUTE REVIEW</strong></div><b id="opRouterReviewStatus">BUILDING</b></div>',
      '<div class="op-router-review-grid"><div class="op-router-review-cell"><span>ROUTED LAYER</span><strong id="opRouterReviewRouted"></strong></div><div class="op-router-review-cell"><span>OBSERVED LAYER</span><strong id="opRouterReviewObserved"></strong></div><div class="op-router-review-cell"><span>WHAT THE EVIDENCE SAYS</span><strong id="opRouterReviewNote"></strong></div></div>',
      '<div class="op-router-review-next"><span>NEXT ROUTER ACTION</span><strong id="opRouterReviewNext"></strong></div>',
      '<small id="opRouterReviewBoundary"></small>'
    ].join('');
    anchor.parentNode.insertBefore(root,anchor.nextSibling);
    return root;
  }

  function render(review){
    const root=install();if(!root)return;
    const routed=review?.decisionGraph?.summary?.causalCoachRoute||null;
    root.hidden=!routed;
    if(!routed)return;
    $('opRouterReviewStatus').textContent=upper(String(routed.status||'BUILDING').replaceAll('_',' '));
    $('opRouterReviewTitle').textContent=routed.active?'FROZEN ROUTE REVIEWED AGAINST VERIFIED CAUSAL EVIDENCE':'NO REPEATED ROOT CAUSE WAS STRONG ENOUGH TO ROUTE THIS GAME';
    $('opRouterReviewRouted').textContent=upper(String(routed.routedLayer||'NONE').replaceAll('_',' '));
    $('opRouterReviewObserved').textContent=upper(String(routed.observedLayer||'NOT OBSERVED').replaceAll('_',' '));
    $('opRouterReviewNote').textContent=upper(routed.note);
    $('opRouterReviewNext').textContent=upper(routed.nextAction);
    $('opRouterReviewBoundary').textContent=upper(routed.boundary);
  }

  install();
  window.opCompanion?.getState?.().then(state=>render(state?.postGameReview||null)).catch(()=>{});
  window.opCompanion?.onState?.(state=>{if(state?.phase==='REVIEW')render(state?.postGameReview||null)});
})();