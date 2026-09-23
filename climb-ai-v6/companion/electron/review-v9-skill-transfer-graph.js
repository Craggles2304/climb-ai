(()=>{
  const $=id=>document.getElementById(id);
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const upper=v=>clean(v).toUpperCase();
  function install(){
    if($('opSkillBridgeReview'))return $('opSkillBridgeReview');
    const anchor=$('opLearningVelocityReview')||$('opAdaptiveSessionReview')||$('opPlayerIdentityReview')||$('opCausalCoachRouteReview');
    if(!anchor?.parentNode)return null;
    const style=document.createElement('style');style.id='op-skill-bridge-review-style';
    style.textContent=[
      '.stg-r{margin:12px 0;border:1px solid rgba(214,255,47,.22);background:linear-gradient(135deg,rgba(5,11,16,.98),rgba(214,255,47,.025));padding:13px 14px}.stg-r-head{display:flex;justify-content:space-between;gap:10px}.stg-r-head span{display:block;font-size:7px;letter-spacing:.16em;color:#d6ff2f;font-weight:950}.stg-r-head strong{display:block;margin-top:5px;font-size:14px;color:#f2f6f8}.stg-r-head b{font-size:8px;padding:6px 8px;border:1px solid rgba(100,169,255,.24);color:#64a9ff}',
      '.stg-r-grid{display:grid;grid-template-columns:1fr 1fr 1.5fr;gap:7px;margin-top:9px}.stg-r-cell{border:1px solid rgba(255,255,255,.07);padding:9px;background:rgba(255,255,255,.018)}.stg-r-cell span{display:block;font-size:6px;color:#71808a;letter-spacing:.13em;font-weight:900}.stg-r-cell strong{display:block;margin-top:5px;font-size:9px;line-height:1.4;color:#ecf1f3}.stg-r-note{margin-top:8px;border-left:2px solid #d6ff2f;padding:8px 10px;background:rgba(214,255,47,.03)}.stg-r-note strong{font-size:9px;line-height:1.4;color:#edf2f4}.stg-r small{display:block;margin-top:7px;font-size:7px;line-height:1.4;color:#68767f}',
      '@media(max-width:900px){.stg-r-grid{grid-template-columns:1fr}}'
    ].join('');document.head.appendChild(style);
    const root=document.createElement('section');root.id='opSkillBridgeReview';root.className='stg-r';
    root.innerHTML=[
      '<div class="stg-r-head"><div><span>SKILL BRIDGE · POST-GAME DIRECT EVIDENCE</span><strong id="opStgrTitle">NO TEST</strong></div><b id="opStgrStatus">NO TEST</b></div>',
      '<div class="stg-r-grid"><div class="stg-r-cell"><span>SOURCE</span><strong id="opStgrSource">NONE</strong></div><div class="stg-r-cell"><span>TARGET</span><strong id="opStgrTarget">NONE</strong></div><div class="stg-r-cell"><span>DIRECT TARGET MOMENTS</span><strong id="opStgrMoments">0</strong></div></div>',
      '<div class="stg-r-note"><strong id="opStgrNote"></strong></div><small id="opStgrMeta"></small>'
    ].join('');
    anchor.parentNode.insertBefore(root,anchor.nextSibling);
    return root;
  }
  function render(review){
    const root=install();if(!root)return;
    const bridge=review?.decisionGraph?.summary?.skillBridge||null,graph=review?.skillTransferGraph||null;
    root.hidden=!bridge&&!graph;if(!bridge&&!graph)return;
    $('opStgrStatus').textContent=upper(bridge?.status||'NO TEST');
    $('opStgrTitle').textContent=bridge?.active?upper('DIRECT TARGET CHECK · '+(bridge.status||'')):'NO FROZEN BRIDGE TEST';
    $('opStgrSource').textContent=upper(bridge?.source||graph?.nextBridge?.sourceLabel||'NONE');
    $('opStgrTarget').textContent=upper(bridge?.target||graph?.nextBridge?.targetLabel||'NONE');
    $('opStgrMoments').textContent=String(bridge?.matchedTargetMoments||0)+' MATCHED · '+String(bridge?.cleanTargetMoments||0)+' CLEAN · '+String(bridge?.improveTargetMoments||0)+' IMPROVE';
    $('opStgrNote').textContent=upper(bridge?.note||graph?.summary||'NO DIRECT TARGET EVIDENCE.');
    $('opStgrMeta').textContent=upper([bridge?.boundary,graph?.boundary].filter(Boolean).join(' · '));
  }
  install();
  window.opCompanion?.getState?.().then(s=>render(s?.postGameReview||null)).catch(()=>{});
  window.opCompanion?.onState?.(s=>{if(s?.phase==='REVIEW')render(s?.postGameReview||null)});
})();