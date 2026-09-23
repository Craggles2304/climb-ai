(()=>{
  const STORE='opclimb.deep-locked-plan.v1';
  const $=id=>document.getElementById(id);
  const upper=value=>String(value??'').replace(/\s+/g,' ').trim().toUpperCase();

  function load(){
    try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}
  }
  function install(){
    if($('opCausalCoachRoute'))return $('opCausalCoachRoute');
    const body=$('opMatchOsBody');if(!body)return null;
    const style=document.createElement('style');
    style.id='op-causal-coach-route-style';
    style.textContent=[
      '.causalroute{border-bottom:1px solid rgba(255,255,255,.08);background:linear-gradient(90deg,rgba(214,255,47,.055),rgba(100,169,255,.035));padding:12px 18px 13px 21px}',
      '.causalroute-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.causalroute-head span{display:block;font-size:7px;letter-spacing:.16em;color:#d6ff2f;font-weight:950}.causalroute-head strong{display:block;margin-top:4px;font-size:14px;color:#f4f7f8}.causalroute-head b{font-size:8px;letter-spacing:.08em;padding:6px 8px;border:1px solid rgba(100,169,255,.25);color:#64a9ff}',
      '.causalroute-grid{display:grid;grid-template-columns:1fr 1.5fr 1fr;gap:8px;margin-top:9px}.causalroute-cell{border:1px solid rgba(255,255,255,.07);background:rgba(4,9,13,.68);padding:9px 10px}.causalroute-cell span{display:block;font-size:6px;letter-spacing:.13em;color:#71808a;font-weight:900}.causalroute-cell strong{display:block;margin-top:5px;font-size:9px;color:#e7edf0;line-height:1.38}.causalroute-cell.focus strong{color:#d6ff2f}',
      '.causalroute-foot{margin-top:8px;font-size:7px;color:#68757e;line-height:1.4}.causalroute.safety .causalroute-foot:before{content:"SAFETY CONSTRAINT ACTIVE · ";color:#ffb45e;font-weight:950}',
      '@media(max-width:900px){.causalroute-grid{grid-template-columns:1fr}}'
    ].join('');
    document.head.appendChild(style);
    const root=document.createElement('section');
    root.id='opCausalCoachRoute';root.className='causalroute';
    root.innerHTML=[
      '<div class="causalroute-head"><div><span>CAUSAL COACH ROUTER · NEXT-GAME LAYER</span><strong id="opCausalRouteTitle">EVIDENCE BUILDING</strong></div><b id="opCausalRouteMode">STANDARD</b></div>',
      '<div class="causalroute-grid">',
      '<div class="causalroute-cell focus"><span>COACHING LAYER</span><strong id="opCausalRouteLayer">BUILDING</strong></div>',
      '<div class="causalroute-cell"><span>LIVE DIRECTIVE</span><strong id="opCausalRouteDirective"></strong></div>',
      '<div class="causalroute-cell"><span>CHECKPOINT PLAN</span><strong id="opCausalRouteCheckpoints"></strong></div>',
      '</div>',
      '<div id="opCausalRouteEvidence" class="causalroute-foot"></div>'
    ].join('');
    const read=$('opReadCheckpoint');
    if(read?.parentNode)read.parentNode.insertBefore(root,read);else body.prepend(root);
    return root;
  }
  function render(){
    const root=install();if(!root)return;
    const route=load()?.causalCoachRoute||null;
    root.hidden=!route;
    if(!route)return;
    root.classList.toggle('safety',Boolean(route.safetyConstrained));
    $('opCausalRouteTitle').textContent=upper(route.pregameDirective||'ROOT-CAUSE MEMORY IS BUILDING.');
    $('opCausalRouteMode').textContent=upper(String(route.mode||'EVIDENCE_BUILD').replaceAll('_',' '));
    $('opCausalRouteLayer').textContent=upper(route.sourceLayerLabel||'EVIDENCE BUILDING');
    $('opCausalRouteDirective').textContent=upper(route.liveDirective||route.checkpointPrompt||'KEEP THE STANDARD SELF-READ PROCESS.');
    const minutes=Array.isArray(route.checkpointMinutes)?route.checkpointMinutes:[5,10,15];
    $('opCausalRouteCheckpoints').textContent=minutes.map(value=>String(value)+' MIN').join(' · ')+' · '+upper(String(route.checkpointFocus||'CALIBRATION').replaceAll('_',' '));
    $('opCausalRouteEvidence').textContent=upper(route.evidence||'CAUSAL MEMORY IS STILL BUILDING.');
  }

  install();
  render();
  window.addEventListener('op-climb-match-os',()=>render());
})();