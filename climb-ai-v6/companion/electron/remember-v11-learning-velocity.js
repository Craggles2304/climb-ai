(()=>{
  const STORE='opclimb.deep-locked-plan.v1';
  const $=id=>document.getElementById(id);
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const upper=value=>clean(value).toUpperCase();
  function load(){try{return JSON.parse(localStorage.getItem(STORE)||'null')?.learningVelocity||null}catch{return null}}
  function metric(value){return value==null?'BUILDING':String(value)+' REPS'}
  function install(){
    if($('opLearningVelocity'))return $('opLearningVelocity');
    const adaptive=$('opAdaptiveCoachingSession');
    const identity=$('opPlayerCoachingIdentity');
    const anchor=adaptive||identity||$('opRemFrozenPlaybook');
    if(!anchor?.parentNode)return null;
    const style=document.createElement('style');style.id='op-learning-velocity-style';
    style.textContent=[
      '.lv{margin:10px 0;border:1px solid rgba(214,255,47,.22);background:linear-gradient(135deg,rgba(214,255,47,.038),rgba(100,169,255,.025));padding:12px 13px}',
      '.lv-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.lv-head span{display:block;font-size:7px;letter-spacing:.16em;color:#d6ff2f;font-weight:950}.lv-head strong{display:block;margin-top:4px;font-size:14px;color:#f3f7f8}.lv-head b{font-size:8px;letter-spacing:.09em;color:#64a9ff;border:1px solid rgba(100,169,255,.24);padding:6px 8px}',
      '.lv-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:9px}.lv-cell{border:1px solid rgba(255,255,255,.07);background:rgba(3,8,12,.7);padding:9px;min-width:0}.lv-cell span{display:block;font-size:6px;letter-spacing:.13em;color:#71808a;font-weight:900}.lv-cell strong{display:block;margin-top:5px;font-size:9px;line-height:1.38;color:#edf1f3}.lv-cell.pace strong{color:#d6ff2f}',
      '.lv-milestones{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:7px}.lv-milestones div{padding:7px 8px;border:1px solid rgba(255,255,255,.06)}.lv-milestones span{display:block;font-size:6px;color:#66757e;letter-spacing:.12em;font-weight:900}.lv-milestones strong{display:block;margin-top:4px;font-size:8px;color:#cbd5da}',
      '.lv-brief{margin-top:8px;border-left:2px solid #d6ff2f;padding:8px 10px;background:rgba(214,255,47,.025)}.lv-brief span{display:block;font-size:6px;color:#d6ff2f;letter-spacing:.14em;font-weight:950}.lv-brief strong{display:block;margin-top:4px;font-size:9px;line-height:1.42;color:#edf2f4}.lv-meta{margin-top:7px;font-size:7px;line-height:1.4;color:#68767f}',
      '@media(max-width:900px){.lv-grid{grid-template-columns:1fr 1fr}.lv-milestones{grid-template-columns:1fr 1fr 1fr}}'
    ].join('');document.head.appendChild(style);
    const root=document.createElement('section');root.id='opLearningVelocity';root.className='lv';
    root.innerHTML=[
      '<div class="lv-head"><div><span>LEARNING VELOCITY · COACH OPTIMISATION</span><strong id="opLvTitle">EVIDENCE BUILDING</strong></div><b id="opLvStatus">BUILDING</b></div>',
      '<div class="lv-grid">',
      '<div class="lv-cell pace"><span>PACE</span><strong id="opLvPace">BUILDING</strong></div>',
      '<div class="lv-cell"><span>REINFORCE TARGET</span><strong id="opLvReinforce">2 CLEAN REPS</strong></div>',
      '<div class="lv-cell"><span>FADE TARGET</span><strong id="opLvFade">1 INDEPENDENT REP</strong></div>',
      '<div class="lv-cell"><span>COACHING FORMAT</span><strong id="opLvMethod">EXPLORE</strong></div>',
      '</div>',
      '<div class="lv-milestones">',
      '<div><span>FIRST CLEAN</span><strong id="opLvClean">BUILDING</strong></div>',
      '<div><span>FIRST INDEPENDENT</span><strong id="opLvIndependent">BUILDING</strong></div>',
      '<div><span>FIRST TRANSFER</span><strong id="opLvTransfer">BUILDING</strong></div>',
      '</div>',
      '<div class="lv-brief"><span>NEXT COACHING CADENCE</span><strong id="opLvReason"></strong></div>',
      '<div id="opLvMeta" class="lv-meta"></div>'
    ].join('');
    if(adaptive&&adaptive.parentNode===anchor.parentNode)adaptive.parentNode.insertBefore(root,adaptive);
    else anchor.parentNode.insertBefore(root,anchor.nextSibling);
    return root;
  }
  function render(profile){
    const root=install();if(!root)return;
    const p=profile||load();root.hidden=!p;if(!p)return;
    const card=p.activeCard||null,policy=p.policy||{};
    $('opLvTitle').textContent=upper((p.activeBehaviourLabel||'ACTIVE DEVELOPMENT')+' · '+(policy.paceState||'BUILDING'));
    $('opLvStatus').textContent=upper((p.status||'BUILDING')+' · '+(p.confidence||'LOW'));
    $('opLvPace').textContent=upper(policy.paceState||'BUILDING');
    $('opLvReinforce').textContent=upper(String(policy.reinforceCleanRepsRequired||2)+' CLEAN REP'+((policy.reinforceCleanRepsRequired||2)===1?'':'S')+' BEFORE FADE');
    $('opLvFade').textContent=upper(String(policy.fadeCleanRepsRequired||1)+' INDEPENDENT REP'+((policy.fadeCleanRepsRequired||1)===1?'':'S')+' BEFORE TRANSFER TEST');
    $('opLvMethod').textContent=upper(policy.recommendedMethodLabel||policy.methodMode||'EXPLORE');
    $('opLvClean').textContent=upper(metric(card?.observedRepsToFirstClean));
    $('opLvIndependent').textContent=upper(metric(card?.observedRepsToFirstIndependent));
    $('opLvTransfer').textContent=upper(metric(card?.observedRepsToFirstTransfer));
    $('opLvReason').textContent=upper(policy.reason||'BUILD MORE VERIFIED LEARNING EVIDENCE.');
    $('opLvMeta').textContent=upper([
      'EXPLANATION '+clean(policy.explanationDensity||'STANDARD'),
      'EXPERIMENT '+clean(policy.experimentBias||'BALANCED'),
      card?'INDEPENDENT RATE '+String(card.independentRate??0)+'%':'',
      clean(p.boundary),
    ].filter(Boolean).join(' · '));
    root.title=[clean(p.summary),clean(card?.evidence),...(Array.isArray(card?.methodSignals)?card.methodSignals.filter(x=>x.observedGames>=3).map(x=>x.evidence):[])].filter(Boolean).join(' · ');
  }
  install();render(null);
  window.addEventListener('op-climb-learning-velocity',event=>render(event.detail||null));
  window.addEventListener('op-climb-live-roster',()=>render(null));
  window.addEventListener('op-climb-match-os',()=>render(null));
})();