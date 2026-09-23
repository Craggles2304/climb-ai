(()=>{
  const $=id=>document.getElementById(id);
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const upper=v=>clean(v).toUpperCase();
  function install(){
    if($('opDecisionPrincipleReview'))return $('opDecisionPrincipleReview');
    const anchor=$('opSkillBridgeReview')||$('opLearningVelocityReview')||$('opCausalCoachRouteReview');
    if(!anchor?.parentNode)return null;
    const style=document.createElement('style');style.id='op-decision-principle-review-style';
    style.textContent='.dpe-r{margin:12px 0;border:1px solid rgba(214,255,47,.28);background:linear-gradient(135deg,rgba(5,11,16,.98),rgba(214,255,47,.03));padding:13px 14px}.dpe-r span{font-size:7px;letter-spacing:.15em;color:#d6ff2f;font-weight:950}.dpe-r h3{margin:5px 0 0;font-size:14px;color:#f2f6f8}.dpe-r-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin-top:9px}.dpe-r-cell{border:1px solid rgba(255,255,255,.07);padding:9px}.dpe-r-cell b{display:block;font-size:6px;color:#71808a;letter-spacing:.12em}.dpe-r-cell strong{display:block;margin-top:5px;font-size:9px;color:#edf2f4}.dpe-r-note{margin-top:8px;border-left:2px solid #d6ff2f;padding:8px 10px;font-size:9px;line-height:1.4}.dpe-r small{display:block;margin-top:7px;color:#68767f;font-size:7px;line-height:1.4}@media(max-width:900px){.dpe-r-grid{grid-template-columns:1fr}}';
    document.head.appendChild(style);
    const root=document.createElement('section');root.id='opDecisionPrincipleReview';root.className='dpe-r';
    root.innerHTML='<span>DECISION PRINCIPLE · POST-GAME DIRECT EVIDENCE</span><h3 id="opDperTitle">NO TEST</h3><div class="dpe-r-grid"><div class="dpe-r-cell"><b>STATUS</b><strong id="opDperStatus">NO TEST</strong></div><div class="dpe-r-cell"><b>TARGET</b><strong id="opDperTarget">NONE</strong></div><div class="dpe-r-cell"><b>DIRECT MOMENTS</b><strong id="opDperMoments">0</strong></div></div><div id="opDperNote" class="dpe-r-note"></div><small id="opDperMeta"></small>';
    anchor.parentNode.insertBefore(root,anchor.nextSibling);return root;
  }
  function render(review){
    const root=install();if(!root)return;
    const result=review?.decisionGraph?.summary?.decisionPrinciple||null,engine=review?.decisionPrincipleEngine||null;
    root.hidden=!result&&!engine;if(!result&&!engine)return;
    $('opDperTitle').textContent=upper(result?.principleKey||engine?.strongestPrinciple?.label||'NO TEST');
    $('opDperStatus').textContent=upper(result?.status||'NO TEST');
    $('opDperTarget').textContent=upper(result?.targetBehaviour||'NONE');
    $('opDperMoments').textContent=String(result?.matchedTargetMoments||0)+' MATCHED · '+String(result?.cleanTargetMoments||0)+' CLEAN · '+String(result?.improveTargetMoments||0)+' IMPROVE';
    $('opDperNote').textContent=upper(result?.note||engine?.summary||'NO DIRECT TARGET EVIDENCE.');
    $('opDperMeta').textContent=upper([result?.boundary,engine?.boundary].filter(Boolean).join(' · '));
  }
  install();
  window.opCompanion?.getState?.().then(s=>render(s?.postGameReview||null)).catch(()=>{});
  window.opCompanion?.onState?.(s=>{if(s?.phase==='REVIEW')render(s?.postGameReview||null)});
})();