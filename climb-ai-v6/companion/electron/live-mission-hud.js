(()=>{
  const $=id=>document.getElementById(id);
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const short=(value,max=80)=>{const s=clean(value);return s.length<=max?s:s.slice(0,max).replace(/\s+\S*$/,'')+'…'};
  const role=value=>{const r=clean(value).toUpperCase();return r==='BOTTOM'?'ADC':r==='UTILITY'?'SUPPORT':r==='MIDDLE'?'MID':r};
  const rules={
    red_state_fights:['Check the state before fighting','Check health and levels','Leave red fights'],
    fight_selection:['Fight only from a playable state','Check numbers first','Keep an exit'],
    death_control:['Protect the next safe state','Reset after a bad trade','Do not re-engage'],
    reset_quality:['Reset before the next window','Spend your gold','Protect the next wave'],
    resource_conversion:['Spend gold before the fight','Take the useful buy','Skip the risky wave'],
    power_spike_conversion:['Use your next item window','Complete the item','Fight with the spike'],
    repeat_threat:['Name the missing threat first','Check the minimap','Track the repeat threat'],
    opponent_adaptation:['Change your route after the read','Track the pattern','Adjust spacing or timing'],
    objective_readiness:['Move before the objective setup','Choose the last wave','Reset before setup'],
    farm_fight_tradeoff:['Choose the final wave early','Stop farming on time','Move with the team'],
    survival_value:['Wait out the first threat','Track the engage','Keep a safe angle'],
    carry_preservation:['Hold position until the threat shows','Track the flank','Do not chase engage'],
    lead_protection:['Make them enter your threat','Hold the strong position','Do not chase blind'],
    historical_recovery:['Stabilise after the mistake','Collect safe resources','Rebuild vision first'],
  };
  const names={
    red_state_fights:'RED STATE DISCIPLINE',fight_selection:'FIGHT SELECTION',death_control:'DEATH CONTROL',
    reset_quality:'RESET QUALITY',resource_conversion:'RESOURCE CONVERSION',power_spike_conversion:'POWER SPIKE',
    repeat_threat:'THREAT TRACKING',opponent_adaptation:'THREAT ADAPTATION',objective_readiness:'OBJECTIVE SETUP',
    farm_fight_tradeoff:'FARM OR FIGHT',survival_value:'SURVIVAL VALUE',carry_preservation:'CARRY PRESERVATION',
    lead_protection:'LEAD PROTECTION',historical_recovery:'MISTAKE RECOVERY',
  };
  let state=null,lastEventId=null,lastDeaths=null,alertTimer=null;

  function missionFor(next){
    const missions=Array.isArray(next?.playerHome?.missions)?next.playerHome.missions:[];
    const matchRole=role(next?.matchup?.role||next?.teamPlan?.rememberPlan?.role);
    const homeRole=role(next?.playerHome?.selectedRole);
    const dna=(!matchRole||!homeRole||matchRole===homeRole)
      ?missions.filter(item=>item&&item.title).sort((a,b)=>(Number(a.focusOrder)||99)-(Number(b.focusOrder)||99))[0]
      :null;
    if(dna)return {...dna,source:'dna'};
    const frozen=next?.teamPlan?.climbMission;
    if(frozen?.status==='READY')return {...frozen,source:'frozen'};
    return null;
  }
  function metricFor(mission){
    const key=clean(mission?.metric);if(key)return key;
    const title=clean(mission?.title).toLowerCase();
    if(title.includes('carry alive'))return'carry_preservation';
    if(title.includes('first threat'))return'survival_value';
    if(title.includes('objective'))return'objective_readiness';
    if(title.includes('reset'))return'reset_quality';
    if(title.includes('power spike'))return'power_spike_conversion';
    if(title.includes('repeated threat')||title.includes('map'))return'repeat_threat';
    if(title.includes('advantage'))return'lead_protection';
    return'';
  }

  function ensure(){
    const hud=$('opRememberHud'),body=hud?.querySelector('.rem4-body');if(!body)return null;
    hud.setAttribute('aria-live','off');
    let live=$('opLiveMissionHud');
    if(!live){
      live=document.createElement('section');live.id='opLiveMissionHud';live.className='op-live-mission';
      live.innerHTML=`<div class="opm-top"><span class="opm-brand">MATCH HUD</span><span class="opm-signal">● LIVE</span></div>
        <div class="opm-card"><div class="opm-overline"><span id="opmDomain">GAME DNA</span><span id="opmRole"></span></div>
        <h2 id="opmTitle">CURRENT MISSION</h2><strong id="opmAction">Play your next decision well</strong>
        <div class="opm-cues"><span id="opmCueOne"></span><span id="opmCueTwo"></span></div></div>
        <div class="opm-metrics" aria-label="Live mission metrics"><div><span id="opmMetricOneLabel">Deaths</span><b id="opmMetricOne">—</b></div><div><span id="opmMetricTwoLabel">CS</span><b id="opmMetricTwo">—</b></div><div><span id="opmMetricThreeLabel">Proven games</span><b id="opmMetricThree">—</b></div></div>
        <div id="opmAlert" class="opm-alert" role="status" hidden></div>`;
      body.prepend(live);
    }
    let details=$('opLiveMissionDetails');
    if(!details){
      details=document.createElement('details');details.id='opLiveMissionDetails';
      details.innerHTML='<summary>DETAILS / WHY <span>OPEN</span></summary><div id="opLiveMissionDetailBody"></div>';
      live.insertAdjacentElement('afterend',details);
    }
    const detailBody=$('opLiveMissionDetailBody');
    [...body.children].forEach(node=>{if(node!==live&&node!==details)detailBody.appendChild(node)});
    return live;
  }

  function put(id,value){const node=$(id);if(node&&node.textContent!==String(value))node.textContent=String(value)}
  function score(value){return Number.isFinite(Number(value))?String(Math.max(0,Math.round(Number(value)))):'—'}
  function metricSet(metric,live){
    const s=live?.scores||{};
    if(['reset_quality','resource_conversion','power_spike_conversion','farm_fight_tradeoff'].includes(metric))return [['CS',score(s.creepScore)],['Deaths',score(s.deaths)]];
    if(['objective_readiness','repeat_threat','opponent_adaptation'].includes(metric))return [['Vision',score(s.wardScore)],['Deaths',score(s.deaths)]];
    if(['carry_preservation','survival_value','fight_selection'].includes(metric))return [['Deaths',score(s.deaths)],['Assists',score(s.assists)]];
    return [['Deaths',score(s.deaths)],['CS',score(s.creepScore)]];
  }
  function showAlert(message){
    const node=$('opmAlert');if(!node)return;
    node.textContent=message;node.hidden=false;
    clearTimeout(alertTimer);alertTimer=setTimeout(()=>{node.hidden=true},9000);
  }
  function checkEvents(live){
    if(!live)return;
    const deaths=Number(live.scores?.deaths);
    if(lastDeaths!==null&&Number.isFinite(deaths)&&deaths>lastDeaths)showAlert('DEATH RECORDED · RESET THE REP');
    if(Number.isFinite(deaths))lastDeaths=deaths;
    const events=Array.isArray(live.events)?live.events:[];
    const latest=events.at(-1);
    const id=latest?String(latest.id??`${latest.name}:${latest.time}`):null;
    if(lastEventId!==null&&id&&id!==lastEventId&&/DragonKill|BaronKill|HeraldKill/i.test(latest.name||''))showAlert('OBJECTIVE TAKEN · CHECK THE NEXT SETUP');
    lastEventId=id;
  }
  function render(next){
    state=next;
    if(!document.body.classList.contains('op-remember-live')){lastDeaths=null;lastEventId=null;return}
    if(!ensure())return;
    const mission=missionFor(next),metric=metricFor(mission),rule=rules[metric];
    const baseline=next?.playerHome?.baseline?.ready===false;
    const title=baseline?'BASELINE GAME':names[metric]||short(mission?.title||'PLAY THE FROZEN PLAN',32);
    const action=baseline?'Play normally. Build your baseline.':rule?.[0]||short(mission?.gameRule||mission?.action||mission?.cue||'Follow the frozen match plan.',72);
    put('opmDomain',clean(mission?.domain||mission?.dnaDomain||'GAME DNA').replace(/_/g,' '));
    put('opmRole',clean(next?.matchup?.role||next?.teamPlan?.rememberPlan?.role||''));
    put('opmTitle',title);put('opmAction',action);
    put('opmCueOne',rule?.[1]||'Watch the next decision');
    put('opmCueTwo',rule?.[2]||'Keep your safe position');
    const [first,second]=metricSet(metric,next?.liveHud);
    put('opmMetricOneLabel',first[0]);put('opmMetricOne',first[1]);
    put('opmMetricTwoLabel',second[0]);put('opmMetricTwo',second[1]);
    put('opmMetricThreeLabel','Proven games');
    put('opmMetricThree',mission?.source==='dna'?`${score(mission.confirmed)}/${score(mission.required||3)}`:'—');
    checkEvents(next?.liveHud);
  }
  const observer=new MutationObserver(()=>{if(document.body.classList.contains('op-remember-live'))render(state)});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.opCompanion?.getState?.().then(render).catch(()=>{});
  window.opCompanion?.onState?.(render);
})();
