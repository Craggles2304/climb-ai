(()=>{
  const $=id=>document.getElementById(id);
  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  const upper=value=>clean(value).toUpperCase();
  const normalRole=value=>{const r=upper(value);if(r==='BOTTOM')return'ADC';if(r==='UTILITY')return'SUPPORT';if(r==='MIDDLE')return'MID';return r||null};
  const clip=(value,max=74)=>{const text=clean(value);if(text.length<=max)return text;const cut=text.slice(0,max-1).replace(/\s+\S*$/,'');return`${cut||text.slice(0,max-1)}…`};
  const set=(id,value)=>{const node=$(id);if(node&&clean(value))node.textContent=upper(value)};
  const validOpponent=value=>{const name=clean(value);if(!name)return'';const u=upper(name);if(u==='OPPONENT'||u==='ENEMY'||u.includes('TBD')||u.includes('UNKNOWN')||u.includes('PENDING'))return'';return name};

  function opponentFromDraft(state,role){
    const current=Array.isArray(state?.teamPlan?.theirTeam)?state.teamPlan.theirTeam:[];
    const frozen=Array.isArray(state?.teamPlan?.rememberPlan?.draftTeams?.theirs)?state.teamPlan.rememberPlan.draftTeams.theirs:[];
    const enemies=current.length?current:frozen;
    const hit=enemies.find(enemy=>normalRole(enemy?.role)===role&&clean(enemy?.name));
    return clean(hit?.name);
  }

  function render(state){
    if(String(state?.phase||'')!=='RECORDING')return;
    queueMicrotask(()=>{
      const plan=state?.matchup?.plan||{};
      const role=normalRole(state?.matchup?.role||plan?.role||state?.teamPlan?.rememberPlan?.role);
      const opponent=validOpponent(state?.matchup?.opponent)||validOpponent(plan?.them?.name)||opponentFromDraft(state,role);
      if(!opponent)return;
      const edge=upper(plan?.laneEdge?.label);
      const lane=plan?.laneDuel||{};

      const laneDo=edge.includes('THEIR')
        ?`WAVE NEAR YOU · PRESERVE HP`
        :`FARM FIRST · MAKE ${opponent} STEP UP`;
      const tradeWhen=edge.includes('YOU')
        ?`${opponent} LAST-HITS · SHORT TRADE`
        :`${opponent} MISSES KEY SPELL`;
      const never=clean(lane?.never)||clean(plan?.trades?.avoid?.[0])||'FORCE A FULL-HP EXTENDED FIGHT FROM AN EVEN WAVE';

      set('opRemMatchTitle',`${state?.matchup?.champion||plan?.you?.name||'YOU'} VS ${opponent}`);
      set('opRemLaneDo',laneDo);
      set('opRemTradeWhen',tradeWhen);
      set('opRemNever',clip(never));
    });
  }

  window.opCompanion?.getState?.().then(render).catch(()=>{});
  window.opCompanion?.onState?.(render);
})();
