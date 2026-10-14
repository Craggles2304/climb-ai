/* OP CLIMB Champion Select: real draft recommendations and a clearly
 * labelled composition-only outlook. No unmeasured "match win odds". */
(()=>{
  'use strict';
  const ui=window.ocUI;
  if(!ui)return;
  const {esc,text,num,portrait}=ui;
  const list=items=>Array.isArray(items)?items.filter(Boolean):[];
  const upper=value=>text(value).toUpperCase();
  function render(state){
    const info=state.draftAdvice,locked=Boolean(state?.draft?.localLockedIn);
    if(!info)return '<section class="oc-card oc-pick-advisor" aria-label="Best champion pick">'+
      '<span class="oc-eyebrow oc-tone-lime">OP CLIMB / LIVE DRAFT DESK</span>'+
      '<h2>Finding your strongest available pick…</h2><p class="oc-small">Waiting for your role and revealed picks.</p></section>';
    const picks=list(info.recommended).slice(0,3);
    if(!info.available||!picks.length)return '<section class="oc-card oc-pick-advisor">'+
      '<span class="oc-eyebrow oc-tone-lime">OP CLIMB / LIVE DRAFT DESK</span>'+
      '<h2>Waiting for your role and legal picks</h2><p class="oc-small">Recommendations start when your role and the available champions are known.</p></section>';
    const best=picks[0],role=upper(info.role||'role');
    const notes=list(best.reason).slice(0,3).map(item=>'<span>✓ '+esc(text(item))+'</span>').join('');
    const others=picks.slice(1).map((pick,i)=>
      '<div class="oc-pick-advisor__alt"><b>#'+(i+2)+'</b>'+
      portrait(text(pick.champion),{size:'sm',label:text(pick.champion)})+
      '<span>'+esc(text(pick.champion))+'</span><small>'+esc(text(list(pick.reason)[0]||'Alternative draft fit'))+'</small></div>').join('');
    const edge=info.edge||{},ours=Math.max(0,Math.min(100,Math.round(num(edge.ours,50)))),theirs=100-ours;
    const forming=upper(edge.confidence)==='FORMING'||!edge.confidence;
    const coverage=info.known||{};
    const note=forming
      ?'Insufficient picks for an advantage estimate. The bar stays neutral until more allies and opponents are revealed.'
      :'Composition-only estimate based on currently revealed picks. This is NOT a calibrated match win probability.';
    return '<section class="oc-card oc-pick-advisor" aria-label="Live champion recommendation and draft comparison">'+
      '<div class="oc-pick-advisor__heading"><div><span class="oc-eyebrow oc-tone-lime">OP CLIMB / LIVE DRAFT DESK</span>'+
      '<h2>'+(locked?'YOUR PICK IS LOCKED · DRAFT REVIEW':'BEST AVAILABLE '+esc(role)+' PICK')+'</h2>'+
      '<p class="oc-small">'+(locked?'Your champion is locked. Alternatives are for future games.':'Updates as your team, enemy picks and bans become visible.')+'</p></div>'+
      '<span class="oc-pick-advisor__patch">PATCH '+esc(text(info.patch||'—'))+'</span></div>'+
      '<div class="oc-pick-advisor__best">'+portrait(text(best.champion),{size:'lg',you:true,label:text(best.champion)})+
      '<div class="oc-pick-advisor__primary"><small>'+(locked?'MODEL TOP FIT':'#1 RECOMMENDED NOW')+'</small>'+
      '<strong>'+esc(text(best.champion))+'</strong><p>'+notes+'</p></div><span class="oc-pick-advisor__rank">#1</span></div>'+
      '<div class="oc-pick-advisor__alternatives">'+others+
      '<small class="oc-pick-advisor__pool">Compared '+Math.max(0,num(info.considered))+' available '+esc(role)+' choices · no auto-locking</small></div>'+
      '<div class="oc-pick-advisor__edge"><div class="oc-pick-advisor__edge-title">'+
      '<span>YOUR TEAM <b>'+(forming?'—':ours+'%')+'</b></span>'+
      '<span>'+(forming?'WAITING FOR MORE PICKS':'DRAFT EDGE INDEX')+'</span>'+
      '<span>ENEMY TEAM <b>'+(forming?'—':theirs+'%')+'</b></span></div>'+
      '<div class="oc-pick-advisor__meter" role="img" aria-label="'+
      esc(forming?'Insufficient draft information':'Composition model index: our team '+ours+', enemy team '+theirs+'. Not verified win odds.')+
      '" style="--oc-draft-ally:'+(forming?50:ours)+'%"><span class="oc-pick-advisor__meter-ally"></span><span class="oc-pick-advisor__meter-enemy"></span></div>'+
      '<div class="oc-pick-advisor__confidence"><span>'+esc(upper(edge.confidence||'FORMING'))+
      ' · '+Math.max(0,num(coverage.allies))+'/5 ALLIES · '+Math.max(0,num(coverage.enemies))+'/5 ENEMIES</span>'+
      '<span>NOT REAL WIN ODDS</span></div><p>'+esc(note)+'</p></div>'+
      '<p class="oc-pick-advisor__caveat">Draft fit is a heuristic, not a guarantee. Choose champions you can play confidently. Unknown enemy picks and banned champions are never guessed.</p>'+
      '</section>';
  }
  window.ocDraftAdvisor=Object.freeze({render});
})();
