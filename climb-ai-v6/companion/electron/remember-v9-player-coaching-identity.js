(()=>{
  const STORE='opclimb.deep-locked-plan.v1';
  const $=id=>document.getElementById(id);
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const upper=value=>clean(value).toUpperCase();

  function load(){
    try{return JSON.parse(localStorage.getItem(STORE)||'null')?.playerCoachingIdentity||null}catch{return null}
  }
  function install(){
    if($('opPlayerCoachingIdentity'))return $('opPlayerCoachingIdentity');
    const panel=$('opRemFrozenPlaybook');if(!panel)return null;
    const style=document.createElement('style');
    style.id='op-player-coaching-identity-style';
    style.textContent=[
      '.pci{margin:10px 0;border:1px solid rgba(214,255,47,.22);background:linear-gradient(135deg,rgba(214,255,47,.045),rgba(100,169,255,.025));padding:12px 13px}',
      '.pci-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.pci-head span{display:block;font-size:7px;letter-spacing:.16em;color:#d6ff2f;font-weight:950}.pci-head strong{display:block;margin-top:4px;font-size:14px;color:#f4f7f8}.pci-head b{font-size:8px;letter-spacing:.09em;border:1px solid rgba(214,255,47,.25);color:#d6ff2f;padding:6px 8px}',
      '.pci-grid{display:grid;grid-template-columns:1.1fr 1fr 1fr 1fr;gap:7px;margin-top:9px}.pci-cell{min-width:0;border:1px solid rgba(255,255,255,.07);background:rgba(3,8,12,.68);padding:9px}.pci-cell span{display:block;font-size:6px;letter-spacing:.13em;color:#72818b;font-weight:900}.pci-cell strong{display:block;margin-top:5px;font-size:9px;line-height:1.38;color:#e8edef}.pci-cell.focus strong{color:#d6ff2f}',
      '.pci-brief{margin-top:8px;border-left:2px solid #64a9ff;padding:8px 10px;background:rgba(100,169,255,.035)}.pci-brief span{display:block;font-size:6px;letter-spacing:.14em;color:#64a9ff;font-weight:950}.pci-brief strong{display:block;margin-top:4px;font-size:9px;line-height:1.42;color:#eef2f4}.pci-meta{margin-top:7px;font-size:7px;color:#68767f;line-height:1.4}',
      '@media(max-width:900px){.pci-grid{grid-template-columns:1fr 1fr}}'
    ].join('');
    document.head.appendChild(style);
    const root=document.createElement('section');
    root.id='opPlayerCoachingIdentity';root.className='pci';
    root.innerHTML=[
      '<div class="pci-head"><div><span>PLAYER MODEL · COACHING IDENTITY</span><strong id="opPciHeadline">BUILDING YOUR COACHING MODEL</strong></div><b id="opPciStatus">BUILDING</b></div>',
      '<div class="pci-grid">',
      '<div class="pci-cell focus"><span>NEXT DEVELOPMENT</span><strong id="opPciFocus">BUILDING</strong></div>',
      '<div class="pci-cell"><span>ROOT CAUSE</span><strong id="opPciRoot">BUILDING</strong></div>',
      '<div class="pci-cell"><span>COACHING FORMAT</span><strong id="opPciMethod">TESTING METHODS</strong></div>',
      '<div class="pci-cell"><span>SUPPORT NEED</span><strong id="opPciSupport">BUILDING</strong></div>',
      '</div>',
      '<div class="pci-brief"><span>COACH BRIEF · ASK THIS FIRST</span><strong id="opPciBrief">WHAT DO YOU SEE, WHAT IS YOUR PRIORITY, AND WHY?</strong></div>',
      '<div id="opPciMeta" class="pci-meta">ONE GAME CANNOT REWRITE A STABLE PLAYER MODEL.</div>'
    ].join('');
    const strategy=$('opRemCausalRoute')||$('opRemStrategy');
    if(strategy?.parentNode)strategy.parentNode.insertBefore(root,strategy);else panel.prepend(root);
    return root;
  }
  function render(identity){
    const root=install();if(!root)return;
    const model=identity||load();
    root.hidden=!model;
    if(!model)return;
    $('opPciHeadline').textContent=upper(model.headline||'COACHING IDENTITY BUILDING');
    $('opPciStatus').textContent=upper((model.status||'BUILDING')+' · '+(model.confidence||'LOW'));
    $('opPciFocus').textContent=upper(model.coachBrief?.focus||model.development?.label||'BUILDING');
    $('opPciRoot').textContent=upper(model.rootCause?.label||model.rootCause?.status||'BUILDING');
    $('opPciMethod').textContent=upper(model.coachingResponse?.preferredMethodLabel||model.coachingResponse?.preferenceStatus||'TESTING METHODS');
    $('opPciSupport').textContent=upper(model.autonomy?.supportNeed||model.autonomy?.state||'BUILDING');
    $('opPciBrief').textContent=upper(model.coachBrief?.firstQuestion||'WHAT DO YOU SEE, WHAT IS YOUR PRIORITY, AND WHY?');
    $('opPciMeta').textContent=upper([
      model.stability?.score!=null?'MODEL STABILITY '+String(model.stability.score)+'/100':'',
      clean(model.change?.summary),
      clean(model.boundary),
    ].filter(Boolean).join(' · '));
    root.title=[clean(model.summary),clean(model.coachBrief?.delivery),clean(model.coachBrief?.support),...(Array.isArray(model.coachBrief?.avoid)?model.coachBrief.avoid:[])].filter(Boolean).join(' · ');
  }

  install();
  render(null);
  window.addEventListener('op-climb-player-identity',event=>render(event.detail||null));
  window.addEventListener('op-climb-live-roster',()=>render(null));
  window.addEventListener('op-climb-match-os',()=>render(null));
})();