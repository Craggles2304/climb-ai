(()=>{
  const $=id=>document.getElementById(id);
  const STORAGE_KEY='opclimb.remember-plan.v3';
  let previousPhase='';
  let flashTimer=null;

  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  const upper=value=>clean(value).toUpperCase();
  const safe=value=>Array.isArray(value)?value.filter(Boolean):[];
  const normalRole=value=>{const r=upper(value);if(r==='BOTTOM')return'ADC';if(r==='UTILITY')return'SUPPORT';if(r==='MIDDLE')return'MID';return r||null};
  const clip=(value,max=110)=>{const text=clean(value);if(text.length<=max)return text;const cut=text.slice(0,max-1).replace(/\s+\S*$/,'');return`${cut||text.slice(0,max-1)}…`};
  const firstSentence=value=>{const text=clean(value);const hit=text.match(/^.*?[.!?](?:\s|$)/);return clip(hit?hit[0]:text,105)};
  const namesFrom=(value,names,max=2)=>safe(names).map(n=>clean(n)).filter(Boolean).filter(name=>clean(value).toLowerCase().includes(name.toLowerCase())).slice(0,max);

  function install(){
    if($('opRememberHud'))return $('opRememberHud');
    const style=document.createElement('style');
    style.id='op-remember-v3-style';
    style.textContent=`
body.op-remember-live #status,body.op-remember-live #matchup,body.op-remember-live #opMissionReminders,body.op-remember-live #idleArena{display:none!important}
#opRememberHud{position:relative;overflow:hidden;margin-top:14px;padding:0;background:radial-gradient(circle at 86% 0%,rgba(214,255,47,.105),transparent 31%),linear-gradient(145deg,#0c1318,#060a0e 68%);border:1px solid rgba(255,255,255,.1);box-shadow:0 26px 80px rgba(0,0,0,.42)}#opRememberHud.hidden{display:none!important}#opRememberHud:before{content:'';position:absolute;left:0;top:0;width:4px;height:100%;background:#d6ff2f}.rem3-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:21px 24px 16px;border-bottom:1px solid rgba(255,255,255,.075)}.rem3-kicker{font-size:8px;letter-spacing:.2em;color:#d6ff2f;font-weight:950;text-transform:uppercase}.rem3-title{margin:6px 0 0;font-size:clamp(25px,3.8vw,39px);line-height:1;letter-spacing:-.045em;text-transform:uppercase}.rem3-live{display:flex;align-items:center;gap:7px;border:1px solid rgba(214,255,47,.3);color:#d6ff2f;padding:8px 11px;font-size:8px;letter-spacing:.15em;font-weight:900;text-transform:uppercase;white-space:nowrap}.rem3-live:before{content:'';width:6px;height:6px;border-radius:50%;background:#d6ff2f;box-shadow:0 0 14px rgba(214,255,47,.9)}.rem3-body{padding:17px 23px 22px}.rem3-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.rem3-chip{font-size:7px;letter-spacing:.13em;font-weight:900;text-transform:uppercase;padding:6px 8px;border:1px solid rgba(255,255,255,.08);color:#7f8d97;background:rgba(255,255,255,.018)}.rem3-chip b{color:#d7e0e6}.rem3-win{padding:18px 19px;border:1px solid rgba(214,255,47,.31);background:linear-gradient(100deg,rgba(214,255,47,.085),rgba(214,255,47,.012));clip-path:polygon(0 0,calc(100% - 15px) 0,100% 15px,100% 100%,0 100%)}.rem3-label{display:block;font-size:7px;letter-spacing:.18em;text-transform:uppercase;font-weight:950;color:#d6ff2f}.rem3-win strong{display:block;margin-top:7px;font-size:clamp(18px,2.45vw,27px);line-height:1.19;letter-spacing:-.02em}.rem3-match{margin-top:9px;padding:14px 15px;border:1px solid rgba(67,140,255,.25);background:linear-gradient(90deg,rgba(67,140,255,.07),rgba(67,140,255,.012));clip-path:polygon(0 0,calc(100% - 11px) 0,100% 11px,100% 100%,0 100%)}.rem3-match-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;padding-bottom:10px;border-bottom:1px solid rgba(67,140,255,.13)}.rem3-match-title{font-size:18px;line-height:1.1;font-weight:950;text-transform:uppercase}.rem3-match-edge{font-size:8px;letter-spacing:.1em;color:#7faeff;text-transform:uppercase;font-weight:900}.rem3-match-grid{display:grid;grid-template-columns:1.25fr 1.25fr 1fr;gap:8px;margin-top:10px}.rem3-call{padding:10px 11px;border:1px solid rgba(255,255,255,.065);background:rgba(255,255,255,.015)}.rem3-call span{display:block;font-size:7px;letter-spacing:.16em;font-weight:950;color:#768793;text-transform:uppercase}.rem3-call strong{display:block;margin-top:5px;font-size:10px;line-height:1.42;text-transform:uppercase}.rem3-call.danger{border-color:rgba(255,91,91,.17)}.rem3-call.danger span{color:#ff8585}.rem3-grid{display:grid;grid-template-columns:.78fr 1fr 1.55fr;gap:8px;margin-top:9px}.rem3-card{min-height:112px;padding:13px 14px;border:1px solid rgba(255,255,255,.075);background:rgba(255,255,255,.018);clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,0 100%)}.rem3-card span{display:block;font-size:7px;letter-spacing:.18em;text-transform:uppercase;font-weight:950;color:#77858f}.rem3-card strong{display:block;margin-top:7px;font-size:14px;line-height:1.28}.rem3-card small{display:block;margin-top:6px;color:#818e98;font-size:9px;line-height:1.42}.rem3-card.resource{border-color:rgba(214,255,47,.22)}.rem3-card.resource span,.rem3-card.resource strong{color:#d6ff2f}.rem3-card.focus{border-color:rgba(255,255,255,.13);background:linear-gradient(110deg,rgba(255,255,255,.026),rgba(255,255,255,.012))}.rem3-card.focus strong{font-size:17px}.rem3-danger{color:#ff8a8a!important}.rem3-lower{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.rem3-lower article{padding:12px 14px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.014)}.rem3-lower span{display:block;font-size:7px;letter-spacing:.18em;text-transform:uppercase;font-weight:950}.rem3-lower strong{display:block;margin-top:6px;font-size:11px;line-height:1.42}.rem3-behind{border-color:rgba(255,180,75,.2)!important}.rem3-behind span{color:#ffbc68}.rem3-mission{border-color:rgba(214,255,47,.18)!important}.rem3-mission span{color:#d6ff2f}.rem3-check{margin-top:10px;border-top:1px solid rgba(255,255,255,.07)}.rem3-check summary{cursor:pointer;list-style:none;padding:12px 2px 3px;color:#8997a1;font-size:8px;letter-spacing:.15em;font-weight:900;text-transform:uppercase}.rem3-check summary::-webkit-details-marker{display:none}.rem3-check summary:after{content:' +';color:#d6ff2f}.rem3-check[open] summary:after{content:' −'}.rem3-check-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:8px}.rem3-check-card{padding:11px;border:1px solid rgba(67,140,255,.15);background:rgba(67,140,255,.025)}.rem3-check-card b{display:block;color:#75a9ff;font-size:9px;letter-spacing:.1em}.rem3-check-card p{margin:6px 0 0;color:#b1bbc2;font-size:10px;line-height:1.4}.rem3-note{margin-top:10px;text-align:center;color:#4e5b65;font-size:7px;letter-spacing:.12em;text-transform:uppercase}.rem3-flash{position:absolute;z-index:5;inset:0;display:none;place-items:center;background:rgba(4,8,11,.95);font-size:clamp(30px,7vw,68px);font-weight:950;letter-spacing:.05em;color:#d6ff2f;text-transform:uppercase}.rem3-flash.on{display:grid;animation:rem3Lock 1.15s ease both}@keyframes rem3Lock{0%{opacity:0;transform:scale(1.04)}18%,72%{opacity:1;transform:scale(1)}100%{opacity:0}}#opPregameMatchup{display:none!important}@media(max-width:980px){.rem3-grid,.rem3-match-grid{grid-template-columns:1fr}.rem3-lower,.rem3-check-grid{grid-template-columns:1fr}}@media(max-width:580px){.rem3-title{font-size:27px}.rem3-top,.rem3-body{padding-left:15px;padding-right:15px}.rem3-match-head{align-items:flex-start;flex-direction:column}}
`;
    document.head.appendChild(style);

    const section=document.createElement('section');
    section.id='opRememberHud';section.className='card hidden';section.setAttribute('aria-live','polite');
    section.innerHTML=`
      <div id="opRememberFlash" class="rem3-flash">PLAN LOCKED</div>
      <div class="rem3-top"><div><div class="rem3-kicker">MATCH PLAN // LOCKED FROM CHAMP SELECT</div><h2 id="opRememberTitle" class="rem3-title">REMEMBER YOUR PLAN</h2></div><div class="rem3-live">LIVE · RECORDING</div></div>
      <div class="rem3-body">
        <div class="rem3-chips"><div class="rem3-chip">POWER · <b id="opRemPower">YOUR PLAN</b></div><div class="rem3-chip">SHAPE · <b id="opRemShape">TEAM PLAN</b></div></div>
        <article class="rem3-win"><span class="rem3-label">HOW WE WIN · DO THIS</span><strong id="opRemWin">FARM → PLAY WITH YOUR TEAM → WIN FIGHT → OBJECTIVE</strong></article>
        <article class="rem3-match">
          <div class="rem3-match-head"><div><span class="rem3-label" style="color:#6fa6ff">YOUR MATCHUP</span><div id="opRemMatchTitle" class="rem3-match-title">DETECTING LANE OPPONENT</div></div><div id="opRemMatchEdge" class="rem3-match-edge">MATCHUP READ</div></div>
          <div class="rem3-match-grid"><div class="rem3-call"><span>DO THIS</span><strong id="opRemLaneDo">PLAY THE WAVE FIRST</strong></div><div class="rem3-call"><span>TRADE WHEN</span><strong id="opRemTradeWhen">THEY GIVE YOU A CLEAR WINDOW</strong></div><div class="rem3-call danger"><span>NEVER</span><strong id="opRemNever">FORCE AN EVEN ALL-IN</strong></div></div>
        </article>
        <div class="rem3-grid">
          <article class="rem3-card resource"><span id="opRemTargetLabel">CS TARGET</span><strong id="opRemTargetHead">7.0 CS/MIN</strong><small id="opRemTargetSummary">70 @10 · 105 @15 · 140 @20</small></article>
          <article class="rem3-card"><span>PLAY WITH</span><strong id="opRemWith">YOUR SUPPORT</strong><small id="opRemWithWhy">THIS IS WHO MAKES YOUR PLAN EASIER TO EXECUTE.</small></article>
          <article class="rem3-card focus"><span>PRIMARY FIGHT TARGET</span><strong id="opRemFocus">ENEMY CARRY</strong><small id="opRemFight">HIT THEM ONLY WHEN THEY ARE SAFELY REACHABLE.</small><small id="opRemDanger" class="rem3-danger">DO NOT WALK THROUGH THE ENEMY ENGAGE TO REACH THEM.</small></article>
        </div>
        <div class="rem3-lower"><article class="rem3-behind"><span>IF BEHIND</span><strong id="opRemBehind">SAFE WAVES → BUY TIME → FIGHT ONLY FROM A CREATED ADVANTAGE</strong></article><article class="rem3-mission"><span>CLIMB MISSION</span><strong id="opRemMission">KEEP YOUR CURRENT DEVELOPMENT FOCUS</strong></article></div>
        <details class="rem3-check"><summary>5 / 10 / 15 MIN SELF-CHECK · READ THE BOARD YOURSELF</summary><div id="opRemChecks" class="rem3-check-grid"></div></details>
        <div class="rem3-note">STATIC MEMORY AID · YOU READ THE LIVE GAME STATE · NO REACTIVE SHOTCALLING</div>
      </div>`;
    const status=$('status');if(status)status.insertAdjacentElement('afterend',section);else document.querySelector('main')?.appendChild(section);
    return section;
  }

  function save(plan,champion){if(!plan)return;try{localStorage.setItem(STORAGE_KEY,JSON.stringify({plan,champion:clean(champion),savedAt:new Date().toISOString()}))}catch{}}
  function load(champion){try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(!parsed?.plan)return null;const wanted=clean(champion).toLowerCase(),stored=clean(parsed.champion).toLowerCase();if(wanted&&stored&&wanted!==stored)return null;return parsed.plan}catch{return null}}
  function set(id,value,fallback='—'){const node=$(id);if(node)node.textContent=clean(value)||fallback}
  function missionFor(state){return clean(safe(state?.teamPlan?.missionTips)[0]?.cue)||'KEEP YOUR CURRENT DEVELOPMENT FOCUS'}
  function roster(state,side){return safe(state?.teamPlan?.[side]).map(p=>({name:clean(p?.name),role:normalRole(p?.role)})).filter(p=>p.name)}
  function rolePick(players,role){return players.find(p=>p.role===role)?.name||''}
  function championFor(state){return clean(state?.matchup?.champion||state?.matchup?.plan?.you?.name||state?.teamPlan?.rememberPlan?.champion)}
  function draftOpponent(state,role){const enemies=roster(state,'theirTeam');return rolePick(enemies,role)||(enemies.length===1?enemies[0].name:'')}

  function matchupFor(state){
    const role=normalRole(state?.matchup?.role||state?.matchup?.plan?.role||state?.teamPlan?.rememberPlan?.role);
    const you=clean(state?.matchup?.champion||state?.matchup?.plan?.you?.name||state?.teamPlan?.rememberPlan?.champion)||'YOU';
    const opponent=clean(state?.matchup?.opponent||state?.matchup?.plan?.them?.name)||draftOpponent(state,role);
    const lane=state?.matchup?.plan?.laneDuel||{};
    const edge=clean(state?.matchup?.plan?.laneEdge?.label)||'MATCHUP READ';
    let laneDo=clean(lane.wave)||clean(state?.matchup?.plan?.laneEdge?.summary);
    let tradeWhen=clean(lane.yourPattern)||clean(safe(state?.matchup?.plan?.rules)[0]);
    let never=clean(lane.never)||clean(safe(state?.matchup?.plan?.trades?.avoid)[0]);
    if(opponent){
      const e=upper(edge);
      if(!laneDo)laneDo=e.includes('THEIR')?`KEEP THE WAVE CLOSER TO YOU → PRESERVE HP → MAKE ${opponent} OVERSTEP FOR CS`:`KEEP THE WAVE PLAYABLE → FARM FIRST → MAKE ${opponent} STEP UP FOR CS`;
      if(!tradeWhen)tradeWhen=e.includes('YOU')?`PUNISH ${opponent} ON A LAST-HIT → SHORT TRADE → RESET`:`AFTER ${opponent} MISSES A KEY SPELL OR USES IT ON THE WAVE → SHORT TRADE → RESET`;
      if(!never)never=`DO NOT START A FULL-HP EXTENDED FIGHT WITH ${opponent} FROM AN EVEN WAVE`;
    }
    return{role,you,opponent,edge,laneDo:firstSentence(laneDo),tradeWhen:firstSentence(tradeWhen),never:firstSentence(never)};
  }

  function pickSpecificPlayWith(state,plan,role,you){
    const allies=roster(state,'ourTeam').filter(p=>p.name.toLowerCase()!==clean(you).toLowerCase());
    const allyNames=allies.map(p=>p.name);
    const fromPlan=namesFrom(plan?.playWith,allyNames,2);
    if(fromPlan.length)return fromPlan.join(' / ');
    const read=safe(state?.teamPlan?.compositionRead?.protectors).filter(Boolean).slice(0,2);
    if(read.length)return read.join(' / ');
    const choices=role==='ADC'?[rolePick(allies,'SUPPORT'),rolePick(allies,'JUNGLE')]
      :role==='SUPPORT'?[rolePick(allies,'ADC'),rolePick(allies,'JUNGLE')]
      :role==='JUNGLE'?[rolePick(allies,'MID'),rolePick(allies,'SUPPORT')]
      :role==='MID'?[rolePick(allies,'JUNGLE'),rolePick(allies,'SUPPORT')]
      :[rolePick(allies,'JUNGLE'),rolePick(allies,'SUPPORT')];
    return choices.filter(Boolean).slice(0,2).join(' / ')||allyNames.slice(0,2).join(' / ')||'YOUR NEAREST TEAMMATE';
  }

  function pickFightTarget(state,plan,match){
    const enemies=roster(state,'theirTeam');
    const fromRead=safe(state?.teamPlan?.compositionRead?.enemyDamageCore).filter(Boolean)[0];
    if(fromRead)return clean(fromRead);
    const enemyNames=enemies.map(p=>p.name);
    const fromRule=namesFrom(plan?.fightRule,enemyNames,1)[0];
    if(fromRule)return fromRule;
    return rolePick(enemies,'ADC')||rolePick(enemies,'MID')||match.opponent||enemyNames[0]||'ENEMY CARRY';
  }

  function pickDanger(state,plan,role,focus){
    const enemies=roster(state,'theirTeam');
    const enemyNames=enemies.map(p=>p.name);
    const fromPlan=namesFrom(plan?.watch,enemyNames,2).filter(name=>name!==focus);
    if(fromPlan.length)return fromPlan.join(' / ');
    const fromRead=safe(state?.teamPlan?.compositionRead?.enemyThreats).filter(name=>clean(name)!==clean(focus)).slice(0,2);
    if(fromRead.length)return fromRead.join(' / ');
    const choices=role==='TOP'?[rolePick(enemies,'JUNGLE'),rolePick(enemies,'MID')]
      :role==='JUNGLE'?[rolePick(enemies,'SUPPORT'),rolePick(enemies,'MID')]
      :[rolePick(enemies,'SUPPORT'),rolePick(enemies,'JUNGLE'),rolePick(enemies,'TOP')];
    return choices.filter(Boolean).filter(name=>name!==focus).slice(0,2).join(' / ')||enemyNames.filter(name=>name!==focus).slice(0,2).join(' / ')||'THEIR ENGAGE';
  }

  function resourceFallback(role){if(role==='SUPPORT')return{label:'MAP TARGET',headline:'SET UP FIRST',summary:'MOVE WITH JUNGLE → VISION → OBJECTIVE',checkpoints:[]};if(role==='JUNGLE')return{label:'FARM TARGET',headline:'6.2 CS/MIN',summary:'60 @10 · 95 @15 · 125 @20',checkpoints:[{minute:20,target:125}]};return{label:'CS TARGET',headline:'7.0 CS/MIN',summary:'70 @10 · 105 @15 · 140 @20',checkpoints:[{minute:20,target:140}]}}
  function finalFarmCue(resource){const points=safe(resource?.checkpoints);const last=points[points.length-1];if(last?.target&&last?.minute)return`${last.target} ${upper(resource?.kind||'CS')} @${last.minute}`;return upper(resource?.headline||'PLAY CLEAN')}
  function conversionFor(shape){const s=upper(shape);if(s.includes('SIDE'))return'BARON / TOWER';return'DRAGON / BARON'}
  function specificWin(plan,role,resource,withName,focus,danger){
    const farm=finalFarmCue(resource);const shape=upper(plan?.draft?.teamShape);const convert=conversionFor(shape);
    if(role==='ADC')return`${farm} → STAY WITH ${withName} → SURVIVE ${danger} → HIT ${focus} IF SAFE → ${convert}`;
    if(role==='MID')return`${farm} → PUSH MID → MOVE WITH ${withName} → HIT ${focus} AFTER ENGAGE → ${convert}`;
    if(role==='JUNGLE')return`${farm} → MOVE WITH ${withName} → CREATE FIRST MOVE → LOCK ${focus} → ${convert}`;
    if(role==='SUPPORT')return`MOVE WITH ${withName} → SET VISION FIRST → STOP ${danger} → LOCK ${focus} IF THEY STEP IN → ${convert}`;
    if(role==='TOP'&&shape.includes('SIDE'))return`PUSH SIDE → FORCE A RESPONSE → MOVE FIRST → HIT ${focus} IF YOU JOIN → BARON / TOWER`;
    if(role==='TOP')return`${farm} → GROUP WITH ${withName} → CONTROL ${focus} → ${convert}`;
    return`${farm} → PLAY WITH ${withName} → FOCUS ${focus} → ${convert}`;
  }
  function specificFight(role,withName,focus,danger){
    if(role==='ADC')return`HIT ${focus} IF THEY ARE IN SAFE RANGE. IF NOT, HIT THE CLOSEST CHAMPION WITHOUT WALKING THROUGH ${danger}.`;
    if(role==='MID')return`FOLLOW ${withName}'S FIRST CC / ENGAGE → BURST ${focus} WHEN REACHABLE → DO NOT WALK THROUGH ${danger}.`;
    if(role==='JUNGLE')return`START WITH ${withName} → LOCK ${focus} → DO NOT SPLIT YOUR DAMAGE ACROSS TWO TARGETS.`;
    if(role==='SUPPORT')return`STOP ${danger} FROM REACHING YOUR CARRY → USE YOUR NEXT CC ON ${focus} IF THEY STEP IN.`;
    if(role==='TOP')return`ENTER AFTER ${withName} STARTS → PRESSURE ${focus} IF REACHABLE → OTHERWISE PEEL THE CLOSEST THREAT.`;
    return`FOCUS ${focus} WITH ${withName}; DO NOT CROSS ${danger} TO FORCE IT.`;
  }

  function fallbackPlan(state){const match=matchupFor(state);const role=match.role;return{champion:match.you,role,draft:{powerCurve:'YOUR PLAN',teamShape:'TEAM PLAN'},resourceTarget:resourceFallback(role),playWith:'',watch:'',fightRule:'',behindPlan:role==='ADC'?'SAFE FARM → STAY WITH PEEL → SCALE INTO THE NEXT FIGHT':'SAFE WAVES → BUY TIME → FIGHT ONLY FROM AN ADVANTAGE',checks:[{minute:5,title:'FIRST READ',questions:['WHO HAS THE FIRST USABLE LEAD?','IS THE ORIGINAL PLAN ON TRACK?']},{minute:10,title:'MAP READ',questions:['WHO IS STRONGEST NOW?','WHICH SIDE / OBJECTIVE MATTERS NEXT?']},{minute:15,title:'RECHECK',questions:['WHO IS THEIR BIGGEST THREAT NOW?','ORIGINAL PLAN OR RECOVERY PLAN?']}]}}
  function renderChecks(checks){const root=$('opRemChecks');if(!root)return;root.replaceChildren();safe(checks).slice(0,3).forEach(check=>{const card=document.createElement('article');card.className='rem3-check-card';const title=document.createElement('b');title.textContent=`${check.minute} MIN · ${upper(check.title)}`;const copy=document.createElement('p');copy.textContent=safe(check.questions).slice(0,2).map(upper).join(' · ');card.append(title,copy);root.appendChild(card)})}
  function flashLock(){const node=$('opRememberFlash');if(!node)return;node.classList.remove('on');void node.offsetWidth;node.classList.add('on');clearTimeout(flashTimer);flashTimer=setTimeout(()=>node.classList.remove('on'),1200)}

  function render(state){
    const section=install();const phase=String(state?.phase||'');const champion=championFor(state);const livePlan=state?.teamPlan?.rememberPlan||null;
    if(phase==='CHAMP_SELECT'&&livePlan)save(livePlan,champion);
    const plan=livePlan||load(champion)||fallbackPlan(state);const visible=phase==='RECORDING';section.classList.toggle('hidden',!visible);document.body.classList.toggle('op-remember-live',visible);if(!visible){previousPhase=phase;return}
    const match=matchupFor(state);const role=normalRole(plan?.role||match.role);const resource=plan?.resourceTarget||resourceFallback(role);const withName=pickSpecificPlayWith(state,plan,role,match.you);const focus=pickFightTarget(state,plan,match);const danger=pickDanger(state,plan,role,focus);const win=specificWin(plan,role,resource,withName,focus,danger);const fight=specificFight(role,withName,focus,danger);
    set('opRememberTitle',`${upper(plan.champion||champion||'YOU')} · ${upper(role||'ROLE')} // REMEMBER YOUR PLAN`);set('opRemPower',upper(plan?.draft?.powerCurve),'YOUR PLAN');set('opRemShape',upper(plan?.draft?.teamShape),'TEAM PLAN');set('opRemWin',upper(win),'PLAY THE LOCKED PLAN → OBJECTIVE');
    set('opRemMatchTitle',match.opponent?`${upper(match.you)} VS ${upper(match.opponent)}`:'DETECTING LANE OPPONENT');set('opRemMatchEdge',upper(match.edge),match.opponent?'MATCHUP READ':'WAITING FOR ROLE DATA');set('opRemLaneDo',upper(match.laneDo),'PLAY THE WAVE FIRST');set('opRemTradeWhen',upper(match.tradeWhen),'AFTER A MISSED KEY SPELL OR LAST-HIT');set('opRemNever',upper(match.never),'DO NOT FORCE AN EVEN ALL-IN');
    set('opRemTargetLabel',upper(resource?.label),'RESOURCE TARGET');set('opRemTargetHead',upper(resource?.headline),'PLAY CLEAN');set('opRemTargetSummary',upper(resource?.summary),'');set('opRemWith',upper(withName),'YOUR TEAMMATE');set('opRemWithWhy',role==='ADC'?'STAY IN THEIR PEEL / ENGAGE RANGE.':role==='SUPPORT'?'MOVE WITH THEM BEFORE THE OBJECTIVE.':'MAKE YOUR FIRST MOVE WITH THEM.');set('opRemFocus',upper(focus),'ENEMY CARRY');set('opRemFight',upper(fight),'FOCUS THE NAMED TARGET ONLY WHEN SAFE.');set('opRemDanger',`DANGER: ${upper(danger)} — DO NOT WALK THROUGH THEM JUST TO REACH ${upper(focus)}.`);set('opRemBehind',upper(plan?.behindPlan),'SAFE WAVES → BUY TIME → FIGHT ONLY FROM AN ADVANTAGE');set('opRemMission',upper(missionFor(state)),'KEEP YOUR CURRENT DEVELOPMENT FOCUS');renderChecks(plan?.checks);
    if(previousPhase&&previousPhase!=='RECORDING')flashLock();previousPhase=phase;
  }

  install();window.opCompanion?.getState?.().then(render).catch(()=>{});window.opCompanion?.onState?.(render);
})();