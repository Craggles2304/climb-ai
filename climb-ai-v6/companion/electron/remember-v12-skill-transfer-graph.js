(()=>{
  const STORE='opclimb.deep-locked-plan.v1';
  const $=id=>document.getElementById(id);
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const upper=v=>clean(v).toUpperCase();
  function load(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}}
  function install(){
    if($('opSkillTransferGraph'))return $('opSkillTransferGraph');
    const anchor=$('opLearningVelocity')||$('opAdaptiveCoachingSession')||$('opPlayerCoachingIdentity')||$('opRemFrozenPlaybook');
    if(!anchor?.parentNode)return null;
    const style=document.createElement('style');style.id='op-skill-transfer-graph-style';
    style.textContent=[
      '.stg{margin:10px 0;border:1px solid rgba(214,255,47,.22);background:linear-gradient(135deg,rgba(214,255,47,.035),rgba(100,169,255,.025));padding:12px 13px}',
      '.stg-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.stg-head span{display:block;font-size:7px;letter-spacing:.16em;color:#d6ff2f;font-weight:950}.stg-head strong{display:block;margin-top:4px;font-size:14px;color:#f3f7f8}.stg-head b{font-size:8px;color:#64a9ff;border:1px solid rgba(100,169,255,.24);padding:6px 8px}',
      '.stg-flow{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin-top:9px}.stg-node{border:1px solid rgba(255,255,255,.07);background:rgba(3,8,12,.7);padding:10px}.stg-node span{display:block;font-size:6px;color:#71808a;letter-spacing:.13em;font-weight:900}.stg-node strong{display:block;margin-top:5px;font-size:10px;color:#edf1f3}.stg-arrow{font-size:18px;color:#d6ff2f;font-weight:950}.stg-rule{margin-top:8px;border-left:2px solid #d6ff2f;padding:8px 10px;background:rgba(214,255,47,.025)}.stg-rule span{display:block;font-size:6px;color:#d6ff2f;letter-spacing:.14em;font-weight:950}.stg-rule strong{display:block;margin-top:4px;font-size:9px;line-height:1.42;color:#edf2f4}.stg-meta{margin-top:7px;font-size:7px;color:#68767f;line-height:1.4}',
      '@media(max-width:900px){.stg-flow{grid-template-columns:1fr}.stg-arrow{transform:rotate(90deg);text-align:center}}'
    ].join('');document.head.appendChild(style);
    const root=document.createElement('section');root.id='opSkillTransferGraph';root.className='stg';
    root.innerHTML=[
      '<div class="stg-head"><div><span>SKILL TRANSFER GRAPH · DIRECT BRIDGE TEST</span><strong id="opStgTitle">GRAPH BUILDING</strong></div><b id="opStgStatus">BUILDING</b></div>',
      '<div class="stg-flow"><div class="stg-node"><span>STABLE SOURCE</span><strong id="opStgSource">BUILDING</strong></div><div class="stg-arrow">→</div><div class="stg-node"><span>DIRECT TARGET TEST</span><strong id="opStgTarget">BUILDING</strong></div></div>',
      '<div class="stg-rule"><span>BRIDGE RULE</span><strong id="opStgRule">SOURCE MASTERY NEVER COUNTS AS TARGET MASTERY.</strong></div>',
      '<div id="opStgMeta" class="stg-meta"></div>'
    ].join('');
    anchor.parentNode.insertBefore(root,anchor.nextSibling);
    return root;
  }
  function render(){
    const root=install();if(!root)return;
    const plan=load(),graph=plan?.skillTransferGraph||null,prime=plan?.skillBridgePrime||null,bridge=prime||graph?.nextBridge||null;
    root.hidden=!graph;if(!graph)return;
    $('opStgStatus').textContent=upper(graph.status||'BUILDING');
    $('opStgTitle').textContent=bridge?upper('NEXT BRIDGE · '+(bridge.sourceLabel||bridge.source)+' → '+(bridge.targetLabel||bridge.target)):'NO BRIDGE TEST READY';
    $('opStgSource').textContent=upper(bridge?.sourceLabel||bridge?.source||'BUILDING');
    $('opStgTarget').textContent=upper(bridge?.targetLabel||bridge?.target||'BUILDING');
    $('opStgRule').textContent=upper(prime?.targetQuestion||bridge?.testRule||'SOURCE MASTERY NEVER COUNTS AS TARGET MASTERY.');
    $('opStgMeta').textContent=upper([prime?.exactDraftRead,bridge?.whyNow,graph.summary,graph.boundary].filter(Boolean).join(' · '));
    root.title=[clean(prime?.evidence),clean(bridge?.evidence)].filter(Boolean).join(' · ');
  }
  install();render();
  window.addEventListener('op-climb-skill-transfer-graph',()=>render());
  window.addEventListener('op-climb-match-os',()=>render());
})();