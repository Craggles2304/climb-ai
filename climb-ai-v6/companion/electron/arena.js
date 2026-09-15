(()=>{
  const $=id=>document.getElementById(id);
  const hud=document.createElement('link');hud.rel='stylesheet';hud.href='broadcast-v2.css';document.head.appendChild(hud);
  const brand=document.createElement('link');brand.rel='stylesheet';brand.href='brand-sync.css';document.head.appendChild(brand);
  const specialIds={
    'Aurelion Sol':'AurelionSol','Bel\'Veth':'Belveth','Cho\'Gath':'Chogath','Dr. Mundo':'DrMundo',
    'Jarvan IV':'JarvanIV','Kai\'Sa':'Kaisa','Kha\'Zix':'Khazix','K\'Sante':'KSante','LeBlanc':'Leblanc',
    'Lee Sin':'LeeSin','Master Yi':'MasterYi','Miss Fortune':'MissFortune','Nunu & Willump':'Nunu','Rek\'Sai':'RekSai',
    'Renata Glasc':'Renata','Tahm Kench':'TahmKench','Twisted Fate':'TwistedFate','Vel\'Koz':'Velkoz','Wukong':'MonkeyKing','Xin Zhao':'XinZhao'
  };

  function championId(name){
    const clean=String(name||'').trim();
    if(!clean||/pending|opponent tbd|waiting|unknown/i.test(clean))return'';
    return specialIds[clean]||clean.replace(/[^A-Za-z0-9]/g,'');
  }
  function iconUrl(name,patch){const id=championId(name);return id&&patch?`https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(patch)}/img/champion/${encodeURIComponent(id)}.png`:''}
  function splashUrl(name){const id=championId(name);return id?`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${encodeURIComponent(id)}_0.jpg`:''}
  function setImg(node,name,patch){if(!node)return;const url=iconUrl(name,patch);node.classList.remove('image-missing');node.alt=name||'Champion';node.onerror=()=>node.classList.add('image-missing');if(url)node.src=url;else{node.removeAttribute('src');node.classList.add('image-missing')}}
  function setSplash(node,name){if(!node)return;const url=splashUrl(name);node.style.backgroundImage=url?`url("${url}")`:'none';node.classList.toggle('pending',!url)}
  function cleanText(value){return String(value||'').replace(/\s+/g,' ').trim()}
  function firstSentence(value){const text=cleanText(value);if(!text)return'';const match=text.match(/^(.{1,150}?[.!?])(?:\s|$)/);return cleanText(match?match[1]:text.slice(0,150))}
  function stripStop(value){return cleanText(value).replace(/[.!?]+$/,'')}
  function callParts(value,fallback){
    const text=cleanText(value);if(!text)return{title:fallback,copy:''};
    const sentence=firstSentence(text),arrow=/→|->|—/.test(sentence),short=sentence.length<=82;
    if(arrow&&short){const title=stripStop(sentence).toUpperCase(),copy=cleanText(text.slice(sentence.length))||text;return{title,copy}}
    if(short&&sentence.length<=58){const title=stripStop(sentence).toUpperCase(),copy=cleanText(text.slice(sentence.length))||text;return{title,copy}}
    return{title:fallback,copy:text};
  }
  function setCall(titleId,copyId,value,fallback){const parts=callParts(value,fallback);if($(titleId))$(titleId).textContent=parts.title;if($(copyId))$(copyId).textContent=parts.copy;return parts}
  function hasOpponent(matchup){return Boolean(matchup?.opponent&&matchup?.source!=='CHAMPION_LOCK'&&!/pending|tbd/i.test(String(matchup.opponent)))}

  function ensureIdleArena(){
    let root=$('idleArena');if(root)return root;
    root=document.createElement('section');root.id='idleArena';root.className='broadcast-idle hidden';
    root.innerHTML=`
      <i class="idle-corner tl"></i><i class="idle-corner tr"></i><i class="idle-corner bl"></i><i class="idle-corner br"></i>
      <div class="idle-topline"><i></i><span>OP CLIMB MATCH INTELLIGENCE</span><b id="idleSignal">SYSTEM ARMED</b></div>
      <div class="idle-controls"><button id="idleOpenClimb" type="button">OPEN OP CLIMB</button><button id="idleSettings" type="button">SYSTEM SETTINGS</button></div>
      <div class="idle-stage">
        <div class="idle-radar"><span class="ring r1"></span><span class="ring r2"></span><span class="ring r3"></span><span class="cross-x"></span><span class="cross-y"></span><span class="scan"></span><span class="idle-core"></span></div>
        <div id="idleKicker" class="idle-kicker">QUEUE STATE // STANDBY</div>
        <h1 id="idleTitle">QUEUE UP. LOCK IN. CLIMB.</h1>
        <p id="idleCopy">Champ select detection is armed. Lock your champion and the analyst desk will take over with your power spikes, lane win condition, 2v2 plan and teamfight job.</p>
        <div class="idle-next"><span>NEXT SIGNAL</span><b id="idleNext">CHAMP SELECT → CHAMPION LOCK</b></div>
      </div>
      <div class="idle-system-grid">
        <div class="idle-system good"><span>PC LINK</span><strong id="idlePc">SECURE / CONNECTED</strong><div class="microbar"><i></i></div></div>
        <div class="idle-system good"><span>TRACKER</span><strong id="idleTracker">RUNNING</strong><div class="microbar"><i></i></div></div>
        <div class="idle-system wait"><span>RIOT CLIENT</span><strong id="idleRiot">WAITING FOR LEAGUE</strong><div class="microbar"><i></i></div></div>
        <div class="idle-system good"><span>COACHING PIPELINE</span><strong id="idleCoach">READY</strong><div class="microbar"><i></i></div></div>
      </div>`;
    const status=$('status');status?.insertAdjacentElement('afterend',root);
    $('idleOpenClimb')?.addEventListener('click',()=>window.opCompanion?.openClimb?.());
    $('idleSettings')?.addEventListener('click',()=>document.body.classList.toggle('broadcast-settings-open'));
    const settings=$('settings');if(settings)settings.classList.add('broadcast-settings');
    return root;
  }

  function renderIdle(state){
    const root=ensureIdleArena();
    const phase=String(state?.phase||'WAITING');
    const readyMatch=Boolean(state?.matchup&&['LOADING','READY','ERROR'].includes(state.matchup.status));
    const show=Boolean(state?.paired&&!readyMatch);
    root.classList.toggle('hidden',!show);
    if(!show){document.body.classList.remove('broadcast-settings-open');return}
    const presets={
      WAITING:{signal:'SYSTEM ARMED',kicker:'QUEUE STATE // STANDBY',title:'QUEUE UP. LOCK IN. CLIMB.',copy:'Champ select detection is armed. Lock your champion and the analyst desk will take over with your power spikes, lane win condition, 2v2 plan and teamfight job.',next:'CHAMP SELECT → CHAMPION LOCK',riot:'WAITING FOR LEAGUE'},
      CHAMP_SELECT:{signal:'DRAFT SIGNAL ACQUIRED',kicker:'CHAMP SELECT // LIVE',title:'LOCK YOUR CHAMPION.',copy:'Draft is detected. As soon as your champion locks, OP CLIMB deploys your personal power curve first, then enriches it as the enemy lane and full composition resolve.',next:'YOUR LOCK-IN → PREGAME BRIEFING',riot:'CHAMP SELECT LIVE'},
      RECORDING:{signal:'MATCH FEED LIVE',kicker:'GAME STATE // CAPTURE',title:'MATCH TELEMETRY ACTIVE.',copy:'Your game is being captured quietly. The pregame calls remain static while the post-game engine records the evidence it needs to build your review.',next:'GAME END → POST-GAME REVIEW',riot:'IN GAME'},
      UPLOADING:{signal:'ANALYSIS PIPELINE',kicker:'POST GAME // PROCESSING',title:'BUILDING YOUR REVIEW.',copy:'The match is complete. OP CLIMB is converting the recorded evidence into your OP Grade, repeated decision leak and next Fix Ladder.',next:'REVIEW READY → OP CLIMB',riot:'MATCH COMPLETE'},
      RESTARTING:{signal:'TRACKER RECOVERY',kicker:'SYSTEM // RECOVERING',title:'RECONNECTING TRACKER.',copy:'The Companion is restoring its League connection automatically. Your PC pairing remains intact.',next:'TRACKER ONLINE → STANDBY',riot:'RECONNECTING'},
      AUTH_ERROR:{signal:'PAIRING REQUIRED',kicker:'SYSTEM // ACCESS',title:'RE-PAIR THIS PC.',copy:'The secure pairing token needs refreshing before live match intelligence can resume.',next:'OPEN OP CLIMB → PAIR PC',riot:'AUTH REQUIRED'},
      ERROR:{signal:'SYSTEM CHECK',kicker:'SYSTEM // ATTENTION',title:'TRACKER NEEDS ATTENTION.',copy:cleanText(state?.detail)||'Open diagnostics or restart the tracker to restore match intelligence.',next:'DIAGNOSTICS → RESTART',riot:'CHECK REQUIRED'},
      STARTING:{signal:'BOOT SEQUENCE',kicker:'SYSTEM // INITIALISING',title:'MATCH INTELLIGENCE BOOTING.',copy:'Loading the tracker, secure pairing and updater services.',next:'SYSTEM ONLINE → STANDBY',riot:'STARTING'}
    };
    const p=presets[phase]||presets.WAITING;
    $('idleSignal').textContent=p.signal;$('idleKicker').textContent=p.kicker;$('idleTitle').textContent=p.title;$('idleCopy').textContent=p.copy;$('idleNext').textContent=p.next;$('idleRiot').textContent=p.riot;
    $('idlePc').textContent=state?.paired?'SECURE / CONNECTED':'PAIRING REQUIRED';
    $('idleTracker').textContent=state?.trackerRunning?'RUNNING':'OFFLINE';
    $('idleCoach').textContent=phase==='UPLOADING'?'ANALYSING':'READY';
    root.dataset.phase=phase.toLowerCase();
  }

  function openDeepDive(tab){const deep=$('deepDive');if(deep)deep.open=true;const button=document.querySelector(`[data-matchup-tab="${tab}"]`);if(button)button.click();if(deep)deep.scrollIntoView({behavior:'smooth',block:'start'})}
  function renderPowerTimeline(spikes){
    const root=$('powerTimeline');if(!root)return;root.replaceChildren();const values=Array.isArray(spikes)?spikes.filter(Boolean):[];
    for(const spike of values){const btn=document.createElement('button');const edge=String(spike.edge||'EVEN').toLowerCase();btn.type='button';btn.className=`power-node edge-${edge}${Number(spike.level)===2?' first-window':''}${Number(spike.level)===6?' major-window':''}`;btn.title=cleanText(spike.fight)||`Level ${spike.level}`;const level=document.createElement('b');level.textContent=`LV ${spike.level}`;const dot=document.createElement('i');const label=document.createElement('span');label.textContent=spike.label||'POWER WINDOW';btn.append(level,dot,label);btn.addEventListener('click',()=>openDeepDive('spikes'));root.appendChild(btn)}
  }
  function renderHero(matchup,teamPlan){
    if(matchup?.status!=='READY'||!matchup.plan)return;
    const plan=matchup.plan,patch=plan.patch||'',opponentKnown=hasOpponent(matchup),you=plan.you?.name||matchup.champion||'',them=opponentKnown?(plan.them?.name||matchup.opponent||''):'';
    setSplash($('youSplash'),you);setSplash($('themSplash'),them);setImg($('youPortrait'),you,patch);setImg($('themPortrait'),them,patch);
    if($('heroYouRole'))$('heroYouRole').textContent=plan.role?`${plan.role} · LOCKED`:'CHAMPION LOCKED';
    if($('heroThemRole'))$('heroThemRole').textContent=opponentKnown?'LANE OPPONENT':'WAITING FOR ROLE READ';
    const root=$('matchupReady');if(root){root.classList.toggle('opponent-known',opponentKnown);root.dataset.edge=String(plan.laneEdge?.edge||'EVEN').toLowerCase()}
    const bot=teamPlan?.botLane||null,duel=opponentKnown?plan.laneDuel:null;let heroSource='';
    if(bot?.laneCall?.label)heroSource=bot.laneCall.label;else if(duel?.yourPattern)heroSource=callParts(duel.yourPattern,'PLAY THE FIRST CLEAN EDGE').title;else heroSource=callParts(plan.trades?.safe?.[0]||plan.leadPlan?.create?.[0],'BUILD THE FIRST CLEAN ADVANTAGE').title;
    if($('heroCommand'))$('heroCommand').textContent=stripStop(heroSource).toUpperCase()||'BUILD THE FIRST CLEAN ADVANTAGE';
    const laneMode=bot?'2V2 BOT PLAN':opponentKnown?`${you.toUpperCase()} VS ${them.toUpperCase()}`:'CHAMPION POWER PLAN';if($('tacticalContext'))$('tacticalContext').textContent=laneMode;
    const trade=bot?.trade?.summary||duel?.yourPattern||plan.trades?.safe?.[0],commit=bot?.allIn?.summary||duel?.killWindow||plan.trades?.pressure?.[0],wave=bot?.wave?.summary||duel?.wave||plan.leadPlan?.create?.[0],never=bot?.danger?.summary||duel?.never||plan.trades?.avoid?.[0];
    setCall('tacticalTradeTitle','tacticalTradeCopy',trade,bot?.trade?.label||'SHORT TRADE → RESET');setCall('tacticalCommitTitle','tacticalCommitCopy',commit,bot?.allIn?.label||'CREATE THE EDGE FIRST');setCall('tacticalWaveTitle','tacticalWaveCopy',wave,bot?.wave?.label||'MAKE THEM WALK UP');setCall('tacticalNeverTitle','tacticalNeverCopy',never,bot?.danger?.label||"DON'T GIVE THEIR FIGHT");
    renderPowerTimeline(plan.powerSpikes);renderBotPortraits(bot,patch);enhanceTeamIcons(teamPlan,patch);
  }
  function renderBotPortraits(bot,patch){if(!bot)return;setImg($('botYourAdcImg'),bot.yourAdc,patch);setImg($('botYourSupportImg'),bot.yourSupport,patch);setImg($('botEnemyAdcImg'),bot.enemyAdc,patch);setImg($('botEnemySupportImg'),bot.enemySupport,patch)}
  function enhanceTeamIcons(teamPlan,patch){if(!teamPlan)return;enhanceRoster('ourTeamPicks',teamPlan.ourTeam||[],patch);enhanceRoster('theirTeamPicks',teamPlan.theirTeam||[],patch)}
  function enhanceRoster(rootId,picks,patch){
    const root=$(rootId);if(!root)return;const cards=[...root.querySelectorAll('.pick-chip')],values=Array.isArray(picks)?picks:[];
    values.forEach((pick,index)=>{const card=cards[index];if(!card)return;const badge=card.querySelector('b');if(!badge)return;const url=iconUrl(pick.name,patch);if(!url)return;badge.textContent='';badge.classList.add('champ-icon');const img=document.createElement('img');img.src=url;img.alt=pick.name||'Champion';img.onerror=()=>{img.remove();badge.textContent=String(pick.name||'?').slice(0,2).toUpperCase();badge.classList.remove('champ-icon')};badge.appendChild(img)});
  }
  function renderArena(state){if(!state?.paired)return;const matchup=state.matchup;if(matchup?.status!=='READY'||!matchup.plan)return;renderHero(matchup,state.teamPlan||null)}
  function schedule(state){requestAnimationFrame(()=>{renderIdle(state);renderArena(state)})}
  document.querySelectorAll('[data-open-tab]').forEach(node=>node.addEventListener('click',()=>openDeepDive(node.dataset.openTab||'overview')));
  ensureIdleArena();
  window.opCompanion?.getState?.().then(schedule).catch(()=>{});
  window.opCompanion?.onState?.(schedule);
})();
