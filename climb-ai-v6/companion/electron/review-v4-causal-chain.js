(()=>{
  const $=id=>document.getElementById(id);
  const upper=value=>String(value??'').replace(/\s+/g,' ').trim().toUpperCase();
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();

  function install(){
    if($('opCausalChain'))return $('opCausalChain');
    const anchor=$('opReadCalibration')||$('op332MatchContract')||$('op332MissionReview');
    if(!anchor?.parentNode)return null;
    const style=document.createElement('style');
    style.id='op-causal-chain-style';
    style.textContent=[
      '.op-causal{margin:12px 0;border:1px solid rgba(214,255,47,.24);background:linear-gradient(135deg,rgba(214,255,47,.035),rgba(5,10,14,.98));padding:14px}',
      '.op-causal-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.op-causal-head span{display:block;font-size:7px;letter-spacing:.18em;color:#d6ff2f;font-weight:950}.op-causal-head strong{display:block;margin-top:5px;font-size:16px;color:#f5f8fa}.op-causal-head b{border:1px solid rgba(214,255,47,.25);padding:6px 8px;color:#d6ff2f;font-size:8px;letter-spacing:.08em}',
      '.op-causal-action{margin-top:10px;border-left:3px solid #d6ff2f;background:rgba(214,255,47,.035);padding:9px 11px}.op-causal-action span{display:block;font-size:6px;letter-spacing:.15em;color:#d6ff2f;font-weight:950}.op-causal-action strong{display:block;margin-top:5px;font-size:10px;color:#edf2f4;line-height:1.4}',
      '.op-causal-list{display:grid;gap:8px;margin-top:10px}.op-causal-item{border:1px solid rgba(255,255,255,.08);background:#071016;padding:10px}.op-causal-item.root{border-color:rgba(255,139,147,.28)}.op-causal-item.clean{border-color:rgba(214,255,47,.20)}',
      '.op-causal-flow{display:grid;grid-template-columns:1fr 28px 1fr 28px 1fr 28px 1.1fr;align-items:stretch;gap:4px}.op-causal-step{border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);padding:8px}.op-causal-step span{display:block;font-size:6px;letter-spacing:.13em;color:#77858e;font-weight:900}.op-causal-step strong{display:block;margin-top:5px;font-size:9px;color:#ecf1f3;line-height:1.35}.op-causal-arrow{display:flex;align-items:center;justify-content:center;color:#56636c;font-weight:950}',
      '.op-causal-diagnosis{margin-top:8px;display:grid;grid-template-columns:.8fr 2fr;gap:8px}.op-causal-diagnosis b{font-size:8px;color:#64a9ff}.op-causal-diagnosis p{margin:0;font-size:8px;color:#8b979f;line-height:1.45}.op-causal-evidence{margin-top:7px;font-size:7px;color:#66737c;line-height:1.45}',
      '.op-causal-boundary{display:block;margin-top:9px;font-size:7px;color:#606c74;line-height:1.45}',
      '@media(max-width:980px){.op-causal-flow{grid-template-columns:1fr}.op-causal-arrow{transform:rotate(90deg);height:18px}.op-causal-diagnosis{grid-template-columns:1fr}}'
    ].join('');
    document.head.appendChild(style);
    const root=document.createElement('section');
    root.id='opCausalChain';root.className='op-causal';
    root.innerHTML=[
      '<div class="op-causal-head"><div><span>DECISION ROOT CAUSE · READ → PRIORITY → ACTION → RESULT</span><strong id="opCausalHeadline">BUILDING CAUSAL CHAIN</strong></div><b id="opCausalLayer">BUILDING</b></div>',
      '<div class="op-causal-action"><span>NEXT COACHING LAYER</span><strong id="opCausalAction"></strong></div>',
      '<div id="opCausalList" class="op-causal-list"></div>',
      '<small id="opCausalBoundary" class="op-causal-boundary"></small>'
    ].join('');
    anchor.parentNode.insertBefore(root,anchor.nextSibling);
    return root;
  }

  function itemCard(item,index){
    const card=document.createElement('article');
    const diagnosis=upper(item?.diagnosis);
    card.className='op-causal-item '+(diagnosis==='CLEAN_CHAIN'?'clean':diagnosis==='NOT_VERIFIABLE'?'':'root');
    const actual=item?.actualState?upper(item.actualState):'NOT VERIFIED';
    const priority=upper(item?.priorityRead)||'NOT FROZEN';
    const alignment=upper(item?.priorityAlignment||'NOT VERIFIABLE').replaceAll('_',' ');
    const decision=(upper(item?.behaviourLabel)||upper(item?.decisionType)||'NO LINK')+(item?.decisionVerdict?' · '+upper(item.decisionVerdict):'');
    const result=upper(item?.outcome)||'NO VERIFIED RESULT LINK';
    card.innerHTML=[
      '<div class="op-causal-flow">',
      '<div class="op-causal-step"><span>READ · '+String(item?.checkpointMinute||'?')+' MIN</span><strong>'+upper(item?.stateRead)+' → '+actual+'</strong></div>',
      '<div class="op-causal-arrow">→</div>',
      '<div class="op-causal-step"><span>FROZEN PRIORITY</span><strong>'+priority+' · '+alignment+'</strong></div>',
      '<div class="op-causal-arrow">→</div>',
      '<div class="op-causal-step"><span>NEXT VERIFIED DECISION</span><strong>'+decision+'</strong></div>',
      '<div class="op-causal-arrow">→</div>',
      '<div class="op-causal-step"><span>OBSERVED RESULT</span><strong>'+result+'</strong></div>',
      '</div>',
      '<div class="op-causal-diagnosis"><b>'+upper(item?.title||diagnosis)+'</b><p>'+clean(item?.explanation)+'</p></div>',
      '<div class="op-causal-evidence">CONFIDENCE · '+upper(item?.confidence||'LOW')+' // '+clean(item?.readEvidence)+(item?.decisionEvidence?' // '+clean(item.decisionEvidence):'')+'</div>'
    ].join('');
    return card;
  }

  function render(review){
    const root=install();if(!root)return;
    const causal=review?.decisionGraph?.summary?.causalChain||null;
    root.hidden=!causal?.active;
    if(!causal?.active)return;
    $('opCausalHeadline').textContent=upper(causal.primaryHeadline);
    $('opCausalLayer').textContent=upper(String(causal.primaryCoachLayer||'BUILDING').replaceAll('_',' '));
    $('opCausalAction').textContent=upper(causal.primaryAction);
    $('opCausalBoundary').textContent=upper(causal.boundary);
    const list=$('opCausalList');if(!list)return;
    list.replaceChildren(...(Array.isArray(causal.chains)?causal.chains:[]).map(itemCard));
  }

  install();
  window.opCompanion?.getState?.().then(state=>render(state?.postGameReview||null)).catch(()=>{});
  window.opCompanion?.onState?.(state=>{if(state?.phase==='REVIEW')render(state?.postGameReview||null)});
})();