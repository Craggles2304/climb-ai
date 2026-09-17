(()=>{
  const $=id=>document.getElementById(id);
  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  const upper=value=>clean(value).toUpperCase();
  const normalRole=value=>{const r=upper(value);if(r==='BOTTOM')return'ADC';if(r==='UTILITY')return'SUPPORT';if(r==='MIDDLE')return'MID';return r||null};
  const clip=(value,max=118)=>{const text=clean(value);if(text.length<=max)return text;const cut=text.slice(0,max-1).replace(/\s+\S*$/,'');return`${cut||text.slice(0,max-1)}…`};
  const set=(id,value)=>{const node=$(id);if(node&&clean(value))node.textContent=upper(value)};

  function opponentFromDraft(state,role){
    const enemies=Array.isArray(state?.teamPlan?.theirTeam)?state.teamPlan.theirTeam:[];
    const hit=enemies.find(enemy=>normalRole(enemy?.role)===role&&clean(enemy?.name));
    return clean(hit?.name);
  }

  function render(state){
    if(String(state?.phase||'')!=='RECORDING')return;
    queueMicrotask(()=>{
      const plan=state?.matchup?.plan||{};
      const role=normalRole(state?.matchup?.role||plan?.role||state?.teamPlan?.rememberPlan?.role);
      const opponent=clean(state?.matchup?.opponent||plan?.them?.name)||opponentFromDraft(state,role);
      if(!opponent)return;
      const edge=upper(plan?.laneEdge?.label);
      const lane=plan?.laneDuel||{};

      const laneDo=edge.includes('YOU')
        ?`PUNISH ${opponent} WHEN THEY LAST-HIT → ONE SHORT TRADE → STEP OUT`
        :edge.includes('THEIR')
          ?`KEEP THE WAVE CLOSER TO YOU → PRESERVE HP → MAKE ${opponent} WALK UP FOR CS`
          :`FARM FIRST → KEEP THE WAVE PLAYABLE → MAKE ${opponent} STEP UP FOR CS`;
      const tradeWhen=`AFTER ${opponent} MISSES A KEY SPELL OR USES IT ON THE WAVE → SHORT TRADE → RESET`;
      const never=clean(lane?.never)||clean(plan?.trades?.avoid?.[0])||`DO NOT CHASE ${opponent} AFTER THE FIRST TRADE; TAKE THE WAVE WIN`;

      set('opRemLaneDo',laneDo);
      set('opRemTradeWhen',tradeWhen);
      set('opRemNever',clip(never));
    });
  }

  window.opCompanion?.getState?.().then(render).catch(()=>{});
  window.opCompanion?.onState?.(render);
})();