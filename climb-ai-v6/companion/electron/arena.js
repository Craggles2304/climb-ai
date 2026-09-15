(()=>{
  const $=id=>document.getElementById(id);
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

  function iconUrl(name,patch){
    const id=championId(name);
    return id&&patch?`https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(patch)}/img/champion/${encodeURIComponent(id)}.png`:'';
  }

  function splashUrl(name){
    const id=championId(name);
    return id?`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${encodeURIComponent(id)}_0.jpg`:'';
  }

  function setImg(node,name,patch){
    if(!node)return;
    const url=iconUrl(name,patch);
    node.classList.remove('image-missing');
    node.alt=name||'Champion';
    node.onerror=()=>node.classList.add('image-missing');
    if(url)node.src=url;else{node.removeAttribute('src');node.classList.add('image-missing')}
  }

  function setSplash(node,name){
    if(!node)return;
    const url=splashUrl(name);
    node.style.backgroundImage=url?`url("${url}")`:'none';
    node.classList.toggle('pending',!url);
  }

  function cleanText(value){return String(value||'').replace(/\s+/g,' ').trim()}
  function firstSentence(value){
    const text=cleanText(value);
    if(!text)return'';
    const match=text.match(/^(.{1,150}?[.!?])(?:\s|$)/);
    return cleanText(match?match[1]:text.slice(0,150));
  }
  function stripStop(value){return cleanText(value).replace(/[.!?]+$/,'')}

  function callParts(value,fallback){
    const text=cleanText(value);
    if(!text)return{title:fallback,copy:''};
    const sentence=firstSentence(text);
    const arrow=/→|->|—/.test(sentence);
    const short=sentence.length<=82;
    if(arrow&&short){
      const title=stripStop(sentence).toUpperCase();
      const copy=cleanText(text.slice(sentence.length))||text;
      return{title,copy};
    }
    if(short&&sentence.length<=58){
      const title=stripStop(sentence).toUpperCase();
      const copy=cleanText(text.slice(sentence.length))||text;
      return{title,copy};
    }
    return{title:fallback,copy:text};
  }

  function setCall(titleId,copyId,value,fallback){
    const parts=callParts(value,fallback);
    if($(titleId))$(titleId).textContent=parts.title;
    if($(copyId))$(copyId).textContent=parts.copy;
    return parts;
  }

  function hasOpponent(matchup){
    return Boolean(matchup?.opponent&&matchup?.source!=='CHAMPION_LOCK'&&!/pending|tbd/i.test(String(matchup.opponent)));
  }

  function openDeepDive(tab){
    const deep=$('deepDive');
    if(deep)deep.open=true;
    const button=document.querySelector(`[data-matchup-tab="${tab}"]`);
    if(button)button.click();
    if(deep)deep.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function renderPowerTimeline(spikes){
    const root=$('powerTimeline');
    if(!root)return;
    root.replaceChildren();
    const values=Array.isArray(spikes)?spikes.filter(Boolean):[];
    for(const spike of values){
      const btn=document.createElement('button');
      const edge=String(spike.edge||'EVEN').toLowerCase();
      btn.type='button';
      btn.className=`power-node edge-${edge}${Number(spike.level)===2?' first-window':''}${Number(spike.level)===6?' major-window':''}`;
      btn.title=cleanText(spike.fight)||`Level ${spike.level}`;
      const level=document.createElement('b');level.textContent=`LV ${spike.level}`;
      const dot=document.createElement('i');
      const label=document.createElement('span');label.textContent=spike.label||'POWER WINDOW';
      btn.append(level,dot,label);
      btn.addEventListener('click',()=>openDeepDive('spikes'));
      root.appendChild(btn);
    }
  }

  function renderHero(matchup,teamPlan){
    if(matchup?.status!=='READY'||!matchup.plan)return;
    const plan=matchup.plan;
    const patch=plan.patch||'';
    const opponentKnown=hasOpponent(matchup);
    const you=plan.you?.name||matchup.champion||'';
    const them=opponentKnown?(plan.them?.name||matchup.opponent||''):'';
    setSplash($('youSplash'),you);
    setSplash($('themSplash'),them);
    setImg($('youPortrait'),you,patch);
    setImg($('themPortrait'),them,patch);
    if($('heroYouRole'))$('heroYouRole').textContent=plan.role?`${plan.role} · LOCKED`:'CHAMPION LOCKED';
    if($('heroThemRole'))$('heroThemRole').textContent=opponentKnown?'LANE OPPONENT':'WAITING FOR ROLE READ';
    const root=$('matchupReady');
    if(root){root.classList.toggle('opponent-known',opponentKnown);root.dataset.edge=String(plan.laneEdge?.edge||'EVEN').toLowerCase()}

    const bot=teamPlan?.botLane||null;
    const duel=opponentKnown?plan.laneDuel:null;
    let heroSource='';
    if(bot?.laneCall?.label)heroSource=bot.laneCall.label;
    else if(duel?.yourPattern)heroSource=callParts(duel.yourPattern,'PLAY THE FIRST CLEAN EDGE').title;
    else heroSource=callParts(plan.trades?.safe?.[0]||plan.leadPlan?.create?.[0],'BUILD THE FIRST CLEAN ADVANTAGE').title;
    if($('heroCommand'))$('heroCommand').textContent=stripStop(heroSource).toUpperCase()||'BUILD THE FIRST CLEAN ADVANTAGE';

    const laneMode=bot?'2V2 BOT PLAN':opponentKnown?`${you.toUpperCase()} VS ${them.toUpperCase()}`:'CHAMPION POWER PLAN';
    if($('tacticalContext'))$('tacticalContext').textContent=laneMode;

    const trade=bot?.trade?.summary||duel?.yourPattern||plan.trades?.safe?.[0];
    const commit=bot?.allIn?.summary||duel?.killWindow||plan.trades?.pressure?.[0];
    const wave=bot?.wave?.summary||duel?.wave||plan.leadPlan?.create?.[0];
    const never=bot?.danger?.summary||duel?.never||plan.trades?.avoid?.[0];
    setCall('tacticalTradeTitle','tacticalTradeCopy',trade,bot?.trade?.label||'SHORT TRADE → RESET');
    setCall('tacticalCommitTitle','tacticalCommitCopy',commit,bot?.allIn?.label||'CREATE THE EDGE FIRST');
    setCall('tacticalWaveTitle','tacticalWaveCopy',wave,bot?.wave?.label||'MAKE THEM WALK UP');
    setCall('tacticalNeverTitle','tacticalNeverCopy',never,bot?.danger?.label||"DON'T GIVE THEIR FIGHT");
    renderPowerTimeline(plan.powerSpikes);
    renderBotPortraits(bot,patch);
    enhanceTeamIcons(teamPlan,patch);
  }

  function renderBotPortraits(bot,patch){
    if(!bot)return;
    setImg($('botYourAdcImg'),bot.yourAdc,patch);
    setImg($('botYourSupportImg'),bot.yourSupport,patch);
    setImg($('botEnemyAdcImg'),bot.enemyAdc,patch);
    setImg($('botEnemySupportImg'),bot.enemySupport,patch);
  }

  function enhanceTeamIcons(teamPlan,patch){
    if(!teamPlan)return;
    enhanceRoster('ourTeamPicks',teamPlan.ourTeam||[],patch);
    enhanceRoster('theirTeamPicks',teamPlan.theirTeam||[],patch);
  }

  function enhanceRoster(rootId,picks,patch){
    const root=$(rootId);
    if(!root)return;
    const cards=[...root.querySelectorAll('.pick-chip')];
    const values=Array.isArray(picks)?picks:[];
    values.forEach((pick,index)=>{
      const card=cards[index];
      if(!card)return;
      const badge=card.querySelector('b');
      if(!badge)return;
      const url=iconUrl(pick.name,patch);
      if(!url)return;
      badge.textContent='';
      badge.classList.add('champ-icon');
      const img=document.createElement('img');
      img.src=url;img.alt=pick.name||'Champion';img.onerror=()=>{img.remove();badge.textContent=String(pick.name||'?').slice(0,2).toUpperCase();badge.classList.remove('champ-icon')};
      badge.appendChild(img);
    });
  }

  function renderArena(state){
    if(!state?.paired)return;
    const matchup=state.matchup;
    if(matchup?.status!=='READY'||!matchup.plan)return;
    renderHero(matchup,state.teamPlan||null);
  }

  function schedule(state){
    requestAnimationFrame(()=>renderArena(state));
  }

  document.querySelectorAll('[data-open-tab]').forEach(node=>node.addEventListener('click',()=>openDeepDive(node.dataset.openTab||'overview')));
  window.opCompanion?.getState?.().then(schedule).catch(()=>{});
  window.opCompanion?.onState?.(schedule);
})();