(()=>{
  const $=id=>document.getElementById(id);
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const upper=value=>clean(value).toUpperCase();

  function install(){
    if($('opReadCalibration'))return $('opReadCalibration');
    const anchor=$('op332MatchContract')||$('op332MissionReview');
    if(!anchor?.parentNode)return null;
    const style=document.createElement('style');
    style.id='op-read-calibration-style';
    style.textContent=[
      '.op-readcal{margin:12px 0;border:1px solid rgba(100,169,255,.25);background:linear-gradient(135deg,rgba(33,78,137,.08),rgba(7,11,15,.96));padding:13px 14px}',
      '.op-readcal-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.op-readcal-head span{display:block;font-size:7px;letter-spacing:.16em;color:#64a9ff;font-weight:950}.op-readcal-head strong{display:block;margin-top:5px;color:#f3f7f9;font-size:14px}.op-readcal-head b{font-size:8px;color:#d6ff2f;border:1px solid rgba(214,255,47,.25);padding:6px 8px}',
      '.op-readcal-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:10px}.op-readcal-stat{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);padding:9px}.op-readcal-stat span{display:block;font-size:6px;color:#73808a;letter-spacing:.12em;font-weight:900}.op-readcal-stat strong{display:block;margin-top:5px;font-size:11px;color:#edf2f5}',
      '.op-readcal-list{display:grid;gap:7px;margin-top:10px}.op-readcal-item{display:grid;grid-template-columns:70px 1fr 1fr;gap:8px;border:1px solid rgba(255,255,255,.07);background:#071017;padding:9px 10px}.op-readcal-item.supported{border-color:rgba(214,255,47,.22)}.op-readcal-item.review{border-color:rgba(255,139,147,.24)}.op-readcal-item b{font-size:9px;color:#64a9ff}.op-readcal-item strong{font-size:9px;color:#eef3f5}.op-readcal-item p{margin:3px 0 0;font-size:8px;color:#7f8c94;line-height:1.35}',
      '.op-readcal-next{margin-top:10px;border-left:2px solid #d6ff2f;padding:8px 10px;background:rgba(214,255,47,.035)}.op-readcal-next span{display:block;font-size:6px;color:#d6ff2f;letter-spacing:.15em;font-weight:950}.op-readcal-next strong{display:block;margin-top:5px;font-size:9px;color:#e8edef}.op-readcal-boundary{display:block;margin-top:8px;font-size:7px;color:#66737c;line-height:1.4}',
      '@media(max-width:900px){.op-readcal-stats{grid-template-columns:repeat(2,1fr)}.op-readcal-item{grid-template-columns:1fr}}'
    ].join('');
    document.head.appendChild(style);
    const root=document.createElement('section');
    root.id='opReadCalibration';root.className='op-readcal';
    root.innerHTML=[
      '<div class="op-readcal-head"><div><span>GAME READ · CALIBRATION</span><strong id="opReadCalHeadline">NO VERIFIED READ CHECKPOINTS</strong></div><b id="opReadCalRate">BUILDING</b></div>',
      '<div class="op-readcal-stats"><div class="op-readcal-stat"><span>STATE PROFILE</span><strong id="opReadCalProfile"></strong></div><div class="op-readcal-stat"><span>CONFIDENCE PROFILE</span><strong id="opReadCalConfidence"></strong></div><div class="op-readcal-stat"><span>HIGH-CONFIDENCE ERRORS</span><strong id="opReadCalErrors"></strong></div><div class="op-readcal-stat"><span>LOW-CONFIDENCE CORRECT</span><strong id="opReadCalUnder"></strong></div></div>',
      '<div id="opReadCalList" class="op-readcal-list"></div>',
      '<div class="op-readcal-next"><span>NEXT READ FOCUS</span><strong id="opReadCalNext"></strong></div>',
      '<small id="opReadCalBoundary" class="op-readcal-boundary"></small>'
    ].join('');
    anchor.parentNode.insertBefore(root,anchor.nextSibling);
    return root;
  }

  function render(review){
    const root=install();if(!root)return;
    const cal=review?.decisionGraph?.summary?.readCalibration||null;
    root.hidden=!cal?.active;
    if(!cal?.active)return;
    $('opReadCalHeadline').textContent=upper(cal.headline);
    $('opReadCalRate').textContent=cal.supportRate===null?'BUILDING':String(cal.supportRate)+'% SUPPORTED';
    $('opReadCalProfile').textContent=upper(String(cal.profile||'BUILDING').replaceAll('_',' '));
    $('opReadCalConfidence').textContent=upper(String(cal.confidenceProfile||'BUILDING').replaceAll('_',' '));
    $('opReadCalErrors').textContent=String(Number(cal.highConfidenceErrors||0));
    $('opReadCalUnder').textContent=String(Number(cal.lowConfidenceCorrect||0));
    $('opReadCalNext').textContent=upper(cal.nextFocus);
    $('opReadCalBoundary').textContent=upper(cal.boundary);
    const list=$('opReadCalList');if(!list)return;
    list.replaceChildren(...(Array.isArray(cal.items)?cal.items:[]).map(item=>{
      const card=document.createElement('article');
      card.className='op-readcal-item '+String(item.status||'').toLowerCase();
      const actual=item.actualState?upper(item.actualState):'NOT VERIFIABLE';
      card.innerHTML='<b>'+String(item.checkpointMinute)+' MIN</b><div><strong>'+upper(item.stateRead)+' → '+actual+'</strong><p>'+upper(item.title)+' · CONFIDENCE '+upper(item.confidenceRead||'NOT SET')+'</p></div><div><strong>NEXT PRIORITY · '+upper(item.priorityRead||'NOT SET')+'</strong><p>'+upper(item.proof)+'</p></div>';
      return card;
    }));
  }

  install();
  window.opCompanion?.getState?.().then(state=>render(state?.postGameReview||null)).catch(()=>{});
  window.opCompanion?.onState?.(state=>{if(state?.phase==='REVIEW')render(state?.postGameReview||null)});
})();