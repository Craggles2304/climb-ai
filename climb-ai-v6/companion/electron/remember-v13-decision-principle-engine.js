(()=>{
  const STORE='opclimb.deep-locked-plan.v1';
  const $=id=>document.getElementById(id);
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const upper=v=>clean(v).toUpperCase();
  function load(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}}
  function install(){
    if($('opDecisionPrinciple'))return $('opDecisionPrinciple');
    const anchor=$('opSkillTransferGraph')||$('opLearningVelocity')||$('opRemFrozenPlaybook');
    if(!anchor?.parentNode)return null;
    const style=document.createElement('style');style.id='op-decision-principle-style';
    style.textContent='.dpe{margin:10px 0;border:1px solid rgba(214,255,47,.28);background:linear-gradient(135deg,rgba(214,255,47,.045),rgba(100,169,255,.025));padding:12px 13px}.dpe span{font-size:7px;letter-spacing:.15em;color:#d6ff2f;font-weight:950}.dpe h3{margin:5px 0 0;font-size:14px;color:#f3f7f8}.dpe-grid{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin-top:9px}.dpe-card{border:1px solid rgba(255,255,255,.08);padding:9px;background:rgba(3,8,12,.7)}.dpe-card b{display:block;font-size:6px;color:#71808a;letter-spacing:.12em}.dpe-card strong{display:block;margin-top:4px;font-size:9px;color:#edf2f4}.dpe-arrow{color:#d6ff2f;font-size:18px}.dpe-rule{margin-top:8px;border-left:2px solid #d6ff2f;padding:8px 10px;background:rgba(214,255,47,.025);font-size:9px;line-height:1.42;color:#edf2f4}.dpe small{display:block;margin-top:7px;color:#68767f;font-size:7px;line-height:1.4}@media(max-width:900px){.dpe-grid{grid-template-columns:1fr}.dpe-arrow{text-align:center;transform:rotate(90deg)}}';
    document.head.appendChild(style);
    const root=document.createElement('section');root.id='opDecisionPrinciple';root.className='dpe';
    root.innerHTML='<span>DECISION PRINCIPLE ENGINE · CROSS-SKILL RULE</span><h3 id="opDpeTitle">PRINCIPLE BUILDING</h3><div class="dpe-grid"><div class="dpe-card"><b>FAMILIAR MANIFESTATION</b><strong id="opDpeSource">BUILDING</strong></div><div class="dpe-arrow">→</div><div class="dpe-card"><b>DIRECT TARGET MANIFESTATION</b><strong id="opDpeTarget">BUILDING</strong></div></div><div id="opDpeRule" class="dpe-rule">DIRECT TARGET EVIDENCE ONLY.</div><small id="opDpeMeta"></small>';
    anchor.parentNode.insertBefore(root,anchor.nextSibling);return root;
  }
  function render(){
    const root=install();if(!root)return;
    const plan=load(),engine=plan?.decisionPrincipleEngine||null,prime=plan?.decisionPrinciplePrime||null;
    root.hidden=!engine;if(!engine)return;
    $('opDpeTitle').textContent=upper(prime?.principleLabel||engine?.strongestPrinciple?.label||engine.status||'BUILDING');
    $('opDpeSource').textContent=upper(prime?.sourceLabel||'WAITING FOR CROSS-SKILL EVIDENCE');
    $('opDpeTarget').textContent=upper(prime?.targetLabel||'NO DIRECT TEST FROZEN');
    $('opDpeRule').textContent=upper(prime?.principleRule||engine?.strongestPrinciple?.rule||engine.summary);
    $('opDpeMeta').textContent=upper([prime?.targetQuestion,prime?.evidence,engine.summary,engine.boundary].filter(Boolean).join(' · '));
  }
  install();render();
  window.addEventListener('op-climb-decision-principle',render);
  window.addEventListener('op-climb-match-os',render);
})();