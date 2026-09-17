(()=>{
  const $=id=>document.getElementById(id);
  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  const upper=value=>clean(value).toUpperCase();
  const normRole=value=>{const role=upper(value);if(role==='BOTTOM')return'ADC';if(role==='UTILITY')return'SUPPORT';if(role==='MIDDLE')return'MID';return role};
  const ROLE_ORDER={TOP:0,JUNGLE:1,MID:2,ADC:3,SUPPORT:4};
  const ASSET_IDS={
    Wukong:'MonkeyKing','Nunu & Willump':'Nunu','Renata Glasc':'Renata',"K'Sante":'KSante',"Cho'Gath":'Chogath',"Kai'Sa":'Kaisa',"Vel'Koz":'Velkoz',LeBlanc:'Leblanc',"Bel'Veth":'Belveth',"Rek'Sai":'RekSai',"Kog'Maw":'KogMaw','Dr. Mundo':'DrMundo','Master Yi':'MasterYi','Miss Fortune':'MissFortune','Jarvan IV':'JarvanIV','Lee Sin':'LeeSin','Aurelion Sol':'AurelionSol','Twisted Fate':'TwistedFate','Tahm Kench':'TahmKench','Xin Zhao':'XinZhao'
  };
  const SCALERS=new Set(['Aphelios','Aurelion Sol','Azir',"Bel'Veth",'Cassiopeia','Gangplank','Jax','Jinx','Kassadin','Kayle','Kindred',"Kog'Maw",'Master Yi','Nasus','Senna','Smolder','Sona','Tristana','Twitch','Vayne','Veigar','Viktor','Vladimir']);
  const EARLY=new Set(['Darius','Draven','Elise','Jarvan IV','Jayce','Kalista','Kled','Lee Sin','LeBlanc','Lucian','Nidalee','Olaf','Pantheon','Pyke',"Rek'Sai",'Renekton','Rumble','Talon','Xin Zhao','Zed']);
  const ASSASSINS=new Set(['Akali','Diana','Ekko','Evelynn','Fizz','Katarina',"Kha'Zix",'Kayn','Naafiri','Nocturne','Qiyana','Rengar','Shaco','Talon','Zed']);
  const HARD_ENGAGE=new Set(['Alistar','Amumu','Blitzcrank','Galio','Hecarim','Jarvan IV','Leona','Malphite','Maokai','Nautilus','Nocturne','Ornn','Rakan','Rell','Sejuani','Skarner','Vi','Wukong','Zac']);
  const DIVERS=new Set(['Camille','Diana','Hecarim','Irelia','Jax','Jarvan IV','Kled','Nocturne','Olaf','Pantheon','Renekton','Vi','Volibear','Wukong','Xin Zhao','Yone']);
  const ZONE_CONTROL=new Set(['Anivia','Azir','Brand','Fiddlesticks','Gangplank','Heimerdinger','Hwei','Kennen','Orianna','Rumble','Taliyah','Veigar','Viktor','Ziggs','Zyra']);
  const AOE_CARRY=new Set(['Brand','Fiddlesticks','Karthus','Katarina','Kennen','Miss Fortune','Orianna','Rumble','Samira','Swain','Viktor']);
  const PICK=new Set(['Ahri','Ashe','Blitzcrank','Elise','Jhin','Leona','Lux','Morgana','Nautilus','Neeko','Pyke','Rakan','Thresh','Twisted Fate','Vi']);
  const PEEL=new Set(['Alistar','Annie','Braum','Janna','Karma','Lulu','Maokai','Milio','Nami','Nautilus','Poppy','Rakan','Renata Glasc','Shen','Tahm Kench','Thresh','Zilean']);
  let lastState=null;
  let lastRoster=null;
  let lastRosterSignature='';
  let lastCoachSignature='';
  let lastCoach=null;
  let coachInFlight=false;

  const assetId=name=>ASSET_IDS[clean(name)]||clean(name).replace(/[^A-Za-z0-9]/g,'');
  const splash=name=>`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${assetId(name)}_0.jpg`;
  const tile=name=>`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${assetId(name)}_0.jpg`;
  const set=(id,value)=>{const node=$(id);if(node&&clean(value))node.textContent=upper(value)};

  function installVisualLayer(){
    if($('op-v5-esports-style'))return;
    const style=document.createElement('style');
    style.id='op-v5-esports-style';
    style.textContent=`
body.op-remember-live{min-height:100vh!important;background:#04070a!important;overflow:auto!important}
body.op-remember-live:before{content:'';position:fixed;inset:0;z-index:-3;background-image:linear-gradient(90deg,rgba(3,6,9,.98) 0%,rgba(3,6,9,.92) 35%,rgba(3,6,9,.72) 69%,rgba(3,6,9,.96) 100%),var(--op-live-splash,none);background-size:cover;background-position:center 18%;filter:saturate(.82) contrast(1.08)}
body.op-remember-live:after{content:'';position:fixed;inset:0;z-index:-2;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.012) 0,rgba(255,255,255,.012) 1px,transparent 1px,transparent 4px),radial-gradient(circle at 76% 10%,rgba(214,255,47,.09),transparent 31%)}
body.op-remember-live .shell{width:100%!important;max-width:none!important;min-height:100vh!important;margin:0!important;padding:0 20px 18px!important;display:flex!important;flex-direction:column!important}
body.op-remember-live .brand{min-height:70px!important;margin:0 -20px!important;padding:12px 20px!important;background:rgba(3,6,9,.88)!important;backdrop-filter:blur(18px);border-bottom:1px solid rgba(214,255,47,.17)!important}
body.op-remember-live footer{display:none!important}
body.op-remember-live #opRememberHud{flex:1!important;min-height:calc(100vh - 94px)!important;margin:14px 0 0!important;border:1px solid rgba(214,255,47,.20)!important;border-radius:0!important;box-shadow:0 30px 90px rgba(0,0,0,.58),inset 0 1px rgba(255,255,255,.035)!important;background:linear-gradient(120deg,rgba(5,10,14,.94),rgba(4,8,11,.83))!important}
body.op-remember-live #opRememberHud:before{width:5px!important;box-shadow:0 0 28px rgba(214,255,47,.55)}
body.op-remember-live .rem4-top{min-height:88px!important;padding:20px 27px 17px!important;background:linear-gradient(90deg,rgba(214,255,47,.045),transparent 48%);border-bottom-color:rgba(255,255,255,.10)!important}
body.op-remember-live .rem4-kicker{font-size:8px!important;color:#d6ff2f!important}
body.op-remember-live .rem4-title{font-size:clamp(30px,3vw,48px)!important;letter-spacing:-.05em!important;text-shadow:0 8px 32px rgba(0,0,0,.55)}
body.op-remember-live .rem4-live{font-size:8px!important;padding:9px 13px!important;background:rgba(214,255,47,.035)!important}
body.op-remember-live .rem4-body{flex:1!important;min-height:0!important;padding:18px 25px 24px!important;display:grid!important;grid-template-rows:minmax(108px,.78fr) minmax(170px,1.28fr) minmax(145px,1fr) minmax(116px,.82fr) auto auto!important;gap:13px!important;align-content:stretch!important}
body.op-remember-live .rem4-body>section,body.op-remember-live .rem4-body>details{margin-top:0!important}
body.op-remember-live .rem4-draft{align-self:stretch!important;gap:14px!important}
body.op-remember-live .rem4-side{display:flex;flex-direction:column;min-width:0}
body.op-remember-live .rem4-side-label{font-size:8px!important;margin-bottom:8px!important;color:#9aa7af!important}
body.op-remember-live .rem4-side.enemy .rem4-side-label{color:#ff7d7d!important}
body.op-remember-live .rem4-team{flex:1!important;gap:8px!important}
body.op-remember-live .rem4-pick{height:auto!important;min-height:82px!important;border-color:rgba(255,255,255,.13)!important;background:#071018!important;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)!important;transition:transform .2s ease,border-color .2s ease}
body.op-remember-live .rem4-pick:hover{transform:translateY(-2px)}
body.op-remember-live .rem4-pick img{opacity:.82!important;filter:saturate(1.05) contrast(1.08)!important;object-position:center 22%!important}
body.op-remember-live .rem4-pick:after{background:linear-gradient(180deg,rgba(4,7,10,.02) 0%,rgba(4,7,10,.06) 33%,rgba(4,7,10,.96) 100%)!important}
body.op-remember-live .rem4-pick-copy{left:9px!important;right:7px!important;bottom:7px!important}
body.op-remember-live .rem4-pick-role{font-size:7px!important}body.op-remember-live .rem4-pick-name{font-size:11px!important}
body.op-remember-live .rem4-pick.threat{border-color:rgba(255,79,79,.75)!important;box-shadow:0 0 0 1px rgba(255,70,70,.15),inset 0 -30px 55px rgba(255,38,38,.18)!important}
body.op-remember-live .rem4-vs{font-size:11px!important;color:#d6ff2f!important;padding-bottom:34px!important}
body.op-remember-live .rem4-call-row{gap:13px!important}
body.op-remember-live .rem4-call,body.op-remember-live .rem4-threat{position:relative;overflow:hidden;padding:24px 25px!important;display:flex;flex-direction:column;justify-content:center;box-shadow:inset 0 1px rgba(255,255,255,.035)}
body.op-remember-live .rem4-call{border-color:rgba(214,255,47,.48)!important;background:linear-gradient(102deg,rgba(214,255,47,.15),rgba(12,21,18,.38) 58%,rgba(4,8,11,.72))!important}
body.op-remember-live .rem4-call:after{content:'GAME PLAN';position:absolute;right:20px;top:16px;font-size:7px;letter-spacing:.28em;color:rgba(214,255,47,.30);font-weight:950}
body.op-remember-live .rem4-call strong{font-size:clamp(38px,4.4vw,70px)!important;line-height:.94!important;max-width:90%;text-shadow:0 12px 40px rgba(0,0,0,.54)}
body.op-remember-live .rem4-call small{font-size:11px!important;letter-spacing:.04em!important;color:#d3dbdf!important;margin-top:12px!important}
body.op-remember-live .rem4-threat{border-color:rgba(255,75,75,.42)!important;background:linear-gradient(118deg,rgba(115,23,31,.34),rgba(9,9,13,.78))!important}
body.op-remember-live .rem4-threat:after{content:'';position:absolute;inset:0 0 0 45%;background:var(--op-threat-art,none) center 22%/cover no-repeat;opacity:.20;mask-image:linear-gradient(90deg,transparent,#000 45%);pointer-events:none}
body.op-remember-live .rem4-threat>*{position:relative;z-index:1}
body.op-remember-live .rem4-threat strong{font-size:clamp(25px,2.4vw,40px)!important;max-width:74%!important}body.op-remember-live .rem4-threat small{font-size:10px!important;max-width:72%!important}
body.op-remember-live .rem4-path-wrap{padding:17px 18px!important;border-color:rgba(214,255,47,.17)!important;background:linear-gradient(180deg,rgba(8,14,18,.86),rgba(5,9,13,.72))!important}
body.op-remember-live .rem4-path-head b{font-size:9px!important}body.op-remember-live .rem4-path-head span{font-size:7px!important}
body.op-remember-live .rem4-path{height:calc(100% - 27px)!important;gap:22px!important;align-items:stretch!important;margin-top:11px!important}
body.op-remember-live .rem4-step{display:flex!important;flex-direction:column;justify-content:center;padding:14px 13px!important;border-color:rgba(255,255,255,.12)!important;background:linear-gradient(135deg,rgba(15,24,31,.93),rgba(7,12,17,.96))!important;clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,0 100%)}
body.op-remember-live .rem4-step:first-child{border-color:rgba(214,255,47,.38)!important;background:linear-gradient(135deg,rgba(214,255,47,.10),rgba(7,12,17,.96))!important}
body.op-remember-live .rem4-step i{font-size:7px!important;color:#7d8b94!important}body.op-remember-live .rem4-step strong{font-size:clamp(12px,1.05vw,16px)!important;margin-top:8px!important}
body.op-remember-live .rem4-step:not(:last-child):after{font-size:30px!important;right:-18px!important;text-shadow:0 0 18px rgba(214,255,47,.42)}
body.op-remember-live .rem4-lane{height:100%!important;gap:10px!important;grid-template-columns:.72fr 1fr 1fr 1fr!important}
body.op-remember-live .rem4-lane-title,body.op-remember-live .rem4-lane-card{padding:16px!important;display:flex;flex-direction:column;justify-content:center;border-color:rgba(73,137,255,.25)!important;background:linear-gradient(135deg,rgba(35,78,151,.14),rgba(5,10,15,.73))!important}
body.op-remember-live .rem4-lane-title{border-color:rgba(77,147,255,.48)!important}body.op-remember-live .rem4-lane-title strong{font-size:17px!important}body.op-remember-live .rem4-lane-card strong{font-size:12px!important;line-height:1.35!important}body.op-remember-live .rem4-lane-card span{font-size:7px!important}
body.op-remember-live .rem4-lane-card.danger{border-color:rgba(255,75,75,.33)!important;background:linear-gradient(135deg,rgba(116,28,35,.16),rgba(5,10,15,.75))!important}
body.op-remember-live .rem4-footer{gap:10px!important}body.op-remember-live .rem4-footer article{padding:13px 15px!important;background:rgba(6,10,14,.70)!important}body.op-remember-live .rem4-footer strong{font-size:10px!important}
body.op-remember-live .rem4-check{align-self:end!important}body.op-remember-live .rem4-note{align-self:end!important}
@media(max-height:850px){body.op-remember-live #opRememberHud{min-height:760px!important}body.op-remember-live .rem4-body{grid-template-rows:94px 142px 125px 102px auto auto!important}body.op-remember-live .rem4-call strong{font-size:38px!important}}
@media(max-width:980px){body.op-remember-live #opRememberHud{min-height:auto!important}body.op-remember-live .rem4-body{display:block!important}body.op-remember-live .rem4-body>section,body.op-remember-live .rem4-body>details{margin-top:10px!important}body.op-remember-live .rem4-pick{min-height:70px!important}body.op-remember-live .rem4-call strong{font-size:38px!important}}
`;
    document.head.appendChild(style);
  }

  function playerRole(player){return normRole(player?.position||player?.role)}
  function sorted(players){return [...players].sort((a,b)=>(ROLE_ORDER[playerRole(a)]??9)-(ROLE_ORDER[playerRole(b)]??9))}
  function stateRoster(side){
    const direct=Array.isArray(lastState?.teamPlan?.[side])?lastState.teamPlan[side]:[];
    const frozen=side==='ourTeam'
      ?(Array.isArray(lastState?.teamPlan?.rememberPlan?.draftTeams?.ours)?lastState.teamPlan.rememberPlan.draftTeams.ours:[])
      :(Array.isArray(lastState?.teamPlan?.rememberPlan?.draftTeams?.theirs)?lastState.teamPlan.rememberPlan.draftTeams.theirs:[]);
    const source=direct.length?direct:frozen;
    return source.map(p=>({champion:clean(p?.champion||p?.name),role:normRole(p?.position||p?.role)})).filter(p=>p.champion);
  }
  function repairTeam(raw,side,champion,forcedRole){
    const frozen=stateRoster(side);
    const frozenRole=name=>playerRole(frozen.find(p=>clean(p.champion).toLowerCase()===clean(name).toLowerCase()));
    const map=new Map();
    for(const p of raw){
      const name=clean(p?.champion);if(!name)continue;
      const key=name.toLowerCase();
      const next={...p,champion:name,position:playerRole(p)||frozenRole(name)||''};
      const current=map.get(key);
      if(!current||(!playerRole(current)&&playerRole(next)))map.set(key,next);
    }
    for(const p of frozen){
      const key=clean(p.champion).toLowerCase();
      if(!map.has(key)&&map.size<5)map.set(key,{champion:p.champion,team:'',position:playerRole(p)});
    }
    const list=[...map.values()];
    if(side==='ourTeam'&&champion){
      const me=list.find(p=>clean(p.champion).toLowerCase()===clean(champion).toLowerCase());
      if(me&&forcedRole)me.position=forcedRole;
    }
    return list.slice(0,5);
  }
  function scoreThreat(player,userRole){
    const name=clean(player?.champion);const role=playerRole(player);let score=0;
    if(ASSASSINS.has(name))score+=8;
    if(HARD_ENGAGE.has(name))score+=7;
    if(DIVERS.has(name))score+=6;
    if(ZONE_CONTROL.has(name))score+=2;
    if(userRole==='ADC'&&role&&role!=='ADC')score+=1;
    return score;
  }
  function byRole(players,role){return players.find(p=>playerRole(p)===role)?.champion||''}
  function localCoach(champion,userRole,ours,enemies){
    const ordered=[...enemies].sort((a,b)=>scoreThreat(b,userRole)-scoreThreat(a,userRole));
    const access=ordered.filter(p=>scoreThreat(p,userRole)>=6).slice(0,3);
    const threats=(access.length?access:ordered.slice(0,1)).map(p=>p.champion);
    const zones=enemies.filter(p=>ZONE_CONTROL.has(clean(p.champion)));
    const aoe=enemies.filter(p=>AOE_CARRY.has(clean(p.champion)));
    const enemyAdc=byRole(enemies,'ADC');
    const laneOpponent=byRole(enemies,userRole)||((userRole==='ADC'||userRole==='SUPPORT')?enemyAdc:'');
    const protectors=ours.filter(p=>clean(p.champion)!==champion&&(PEEL.has(clean(p.champion))||playerRole(p)==='SUPPORT')).slice(0,2).map(p=>p.champion);
    const pickTools=ours.filter(p=>PICK.has(clean(p.champion))).map(p=>p.champion);
    const stayWith=protectors.length?protectors.join(' / '):'YOUR PEEL / FRONT LINE';
    if(userRole==='ADC'&&access.length>=2){
      const accessText=threats.join(' / ');
      const setup=[...new Set([...zones,...aoe].map(p=>p.champion).filter(name=>!threats.includes(name)))].slice(0,2);
      return{
        headline:SCALERS.has(champion)?'SCALE WITHOUT GIVING ACCESS':'SURVIVE ENTRY → DPS',
        why:`IF ${accessText} CANNOT REACH ${champion}, YOU GET TO PLAY THE LONG FIGHT`,
        threatLabel:'DIVE PACKAGE',
        threats,
        threatAnswer:`KITE BACK FIRST · STAY WITH ${stayWith} · HOLD FLASH / PEEL UNTIL THEY COMMIT`,
        laneOpponent,
        never:enemyAdc?`DO NOT WALK THROUGH THEIR THREAT LINE JUST TO REACH ${enemyAdc}`:'DO NOT WALK PAST YOUR FRONT LINE FOR A BACK-LINE TARGET',
        ifBehind:'CLEAR THE SAFEST WAVE → GROUP EARLY → MAKE THEM ENTER YOUR RANGE',
        steps:[
          {label:'1 · ECONOMY',value:SCALERS.has(champion)?'7+ CS/MIN → FIRST 2 ITEMS':'FARM CLEAN → NEXT DAMAGE ITEM'},
          {label:'2 · POSITION',value:`PLAY BEHIND ${stayWith}`},
          {label:'3 · SURVIVE',value:`TRACK ${accessText}`},
          {label:'4 · FIGHT',value:'KITE BACK → DPS CLOSEST SAFE TARGET'},
          {label:'5 · CONVERT',value:setup.length?`ARRIVE FIRST → DENY ${setup.join(' / ')} SETUP → OBJECTIVE`:'WIN FRONT-TO-BACK → DRAGON / BARON'},
        ],
      };
    }
    if(userRole==='ADC'&&pickTools.length>=2){
      return{
        headline:'PICK FIRST → DPS THE 5V4',
        why:`${pickTools.slice(0,2).join(' / ')} CREATE THE NUMBERS EDGE; YOU DO NOT NEED A FAIR 5V5`,
        threatLabel:'MAIN ACCESS THREAT',
        threats,
        threatAnswer:`STAY CONNECTED TO ${stayWith} · LET THE PICK HAPPEN BEFORE YOU WALK FORWARD`,
        laneOpponent,
        never:enemyAdc?`DO NOT STEP PAST THE SAFE DAMAGE LINE TO REACH ${enemyAdc}`:'DO NOT OPEN THE FIGHT BY WALKING INTO THEIR FRONT LINE',
        ifBehind:'SAFE WAVES → PLAY FOG WITH YOUR TEAM → TAKE THE FIRST CLEAN PICK',
        steps:[
          {label:'1 · ECONOMY',value:'FARM YOUR ITEM WINDOW'},
          {label:'2 · LINK',value:`PLAY WITH ${pickTools.slice(0,2).join(' / ')}`},
          {label:'3 · CREATE',value:'CONTROL VISION → CATCH ONE PLAYER'},
          {label:'4 · FIGHT',value:'DPS CLOSEST SAFE TARGET IN THE 5V4'},
          {label:'5 · CONVERT',value:'PICK → DRAGON / BARON / TOWER'},
        ],
      };
    }
    if(userRole==='ADC'){
      return{
        headline:SCALERS.has(champion)?'FARM SPIKE → FRONT-TO-BACK':'PLAY CONNECTED FRONT-TO-BACK',
        why:'YOUR DAMAGE WINS WHEN YOU SURVIVE FIRST CONTACT AND KEEP HITTING WHAT IS REACHABLE',
        threatLabel:'MAIN ACCESS THREAT',
        threats,
        threatAnswer:`STAY WITH ${stayWith} · PRESERVE RANGE · DPS AFTER FIRST CONTACT`,
        laneOpponent,
        never:enemyAdc?`DO NOT WALK PAST THE ENEMY FRONT LINE JUST TO REACH ${enemyAdc}`:'DO NOT TRADE POSITION FOR A BACK-LINE TARGET',
        ifBehind:'SAFE WAVES → GROUP ON YOUR NEXT ITEM → LET THEM WALK INTO YOUR RANGE',
        steps:[
          {label:'1 · ECONOMY',value:SCALERS.has(champion)?'7+ CS/MIN → FIRST 2 ITEMS':'FARM CLEAN → NEXT ITEM'},
          {label:'2 · POSITION',value:`STAY WITH ${stayWith}`},
          {label:'3 · SURVIVE',value:`TRACK ${threats.join(' / ')}`},
          {label:'4 · FIGHT',value:'DPS CLOSEST SAFE TARGET'},
          {label:'5 · CONVERT',value:'WON FIGHT → DRAGON / BARON / TOWER'},
        ],
      };
    }
    return{
      headline:pickTools.length>=2?'PICK FIRST → CONVERT':access.length>=2?'DENY THEIR DIVE → COUNTER':'WIN SETUP → TAKE THE FIGHT',
      why:access.length>=2?`THEIR CLEANEST WIN IS ${threats.join(' / ')} REACHING YOUR CARRIES BEFORE YOUR TEAM IS SET`:'WIN THE SPACE BEFORE THE FIGHT, THEN MAKE ONE CONNECTED CALL',
      threatLabel:access.length>=2?'ACCESS PACKAGE':'MAIN THREAT',
      threats,
      threatAnswer:access.length>=2?`MARK ${threats.join(' / ')} · HOLD CONTROL UNTIL THEY COMMIT`:'TRACK THEIR FIRST CLEAN ENGAGE BEFORE COMMITTING',
      laneOpponent,
      never:'DO NOT START A DISCONNECTED FIGHT YOUR TEAM CANNOT FOLLOW',
      ifBehind:'CLEAR SAFE RESOURCES → GROUP EARLY → FIGHT FROM NUMBERS / VISION / FIRST DAMAGE',
      steps:[
        {label:'1 · SETUP',value:'FARM / RESET CLEANLY BEFORE OBJECTIVE'},
        {label:'2 · LINK',value:'PLAY WITH YOUR STRONGEST ENGAGE / CARRY PAIR'},
        {label:'3 · DENY',value:`STOP ${threats.join(' / ')} GETTING THEIR FIGHT`},
        {label:'4 · EXECUTE',value:pickTools.length>=2?'CATCH ONE → COLLAPSE TOGETHER':'ONE FIRST-CONTACT CALL → FOCUS SAME FIGHT'},
        {label:'5 · CONVERT',value:'WON FIGHT / PICK → OBJECTIVE → RESET'},
      ],
    };
  }

  function renderTeam(rootId,players,threatName){
    const root=$(rootId);if(!root)return;
    root.replaceChildren();
    const dangerNames=(Array.isArray(threatName)?threatName:[threatName]).map(name=>clean(name).toLowerCase()).filter(Boolean);
    const list=sorted(players).slice(0,5);
    for(let i=0;i<5;i++){
      const p=list[i];
      const card=document.createElement('article');
      card.className=`rem4-pick${p&&dangerNames.includes(clean(p.champion).toLowerCase())?' threat':''}`;
      if(p){
        const img=document.createElement('img');img.src=tile(p.champion);img.alt='';img.loading='eager';
        const copy=document.createElement('div');copy.className='rem4-pick-copy';
        const role=document.createElement('span');role.className='rem4-pick-role';role.textContent=playerRole(p)||'ROLE';
        const name=document.createElement('b');name.className='rem4-pick-name';name.textContent=upper(p.champion);
        copy.append(role,name);card.append(img,copy);
      }else{
        const copy=document.createElement('div');copy.className='rem4-pick-copy';
        const role=document.createElement('span');role.className='rem4-pick-role';role.textContent='';
        const name=document.createElement('b');name.className='rem4-pick-name';name.textContent='DETECTING…';
        copy.append(role,name);card.append(copy);
      }
      root.appendChild(card);
    }
  }

  function renderCoachPath(steps){
    const cards=[...document.querySelectorAll('#opRememberHud .rem4-step')];
    const list=Array.isArray(steps)?steps.slice(0,5):[];
    for(let i=0;i<Math.min(cards.length,list.length);i++){
      const label=cards[i].querySelector('i');
      const value=cards[i].querySelector('strong');
      if(label&&clean(list[i]?.label))label.textContent=upper(list[i].label);
      if(value&&clean(list[i]?.value))value.textContent=upper(list[i].value);
    }
  }

  function applyCoach(coach,champion,userRole,ours,enemies){
    if(!coach)return;
    const threats=Array.isArray(coach?.threats)?coach.threats.map(clean).filter(Boolean).slice(0,3):[];
    const threatText=threats.join(' + ')||'THEIR ACCESS';
    set('opRememberTitle',`${champion||'YOU'} · ${userRole||'ROLE'} // WIN CONDITION`);
    set('opRemGameCall',coach?.headline||'WIN THE DRAFT');
    set('opRemGameCallWhy',coach?.why||'PLAY THE FIGHT YOUR COMPOSITION WANTS');
    const threatLabel=document.querySelector('#opRememberHud .rem4-threat .rem4-label');
    if(threatLabel&&clean(coach?.threatLabel))threatLabel.textContent=upper(coach.threatLabel);
    set('opRemThreat',threatText);
    set('opRemThreatAnswer',coach?.threatAnswer||'TRACK THEIR ENTRY BEFORE COMMITTING');
    if(threats[0])document.body.style.setProperty('--op-threat-art',`url("${splash(threats[0])}")`);
    renderTeam('opRemOurTeam',ours,'');
    renderTeam('opRemTheirTeam',enemies,threats);
    renderCoachPath(coach?.steps);
    const lane=clean(coach?.laneOpponent)||byRole(enemies,userRole);
    if(lane)set('opRemMatchTitle',`${champion||'YOU'} VS ${lane}`);
    else set('opRemMatchTitle',userRole?'MATCHUP DETECTING':'ROLE / MATCHUP DETECTING');
    if(clean(coach?.never))set('opRemNever',coach.never);
    if(clean(coach?.ifBehind))set('opRemBehind',coach.ifBehind);
  }

  async function requestCoach(signature,champion,userRole,ours,enemies){
    const fallback=localCoach(champion,userRole,ours,enemies);
    applyCoach(fallback,champion,userRole,ours,enemies);
    if(lastCoachSignature===signature&&lastCoach){
      applyCoach(lastCoach,champion,userRole,ours,enemies);
      return;
    }
    if(coachInFlight||typeof window.opCompanion?.draftCoach!=='function'||ours.length<3||enemies.length<3)return;
    coachInFlight=true;
    try{
      const response=await window.opCompanion.draftCoach({
        champion,
        role:userRole,
        ours:ours.map(p=>({champion:p.champion,role:playerRole(p)||null})),
        enemies:enemies.map(p=>({champion:p.champion,role:playerRole(p)||null})),
      });
      if(response?.ok&&response?.ready&&response?.coach){
        lastCoachSignature=signature;
        lastCoach=response.coach;
        applyCoach(lastCoach,champion,userRole,ours,enemies);
      }
    }catch{}finally{coachInFlight=false}
  }

  function applyRoster(payload){
    lastRoster=payload;
    if(!lastState||String(lastState?.phase||'')!=='RECORDING')return;
    const players=Array.isArray(payload?.players)?payload.players:[];
    if(players.length<2)return;
    const champion=clean(lastState?.matchup?.champion||lastState?.matchup?.plan?.you?.name||lastState?.teamPlan?.rememberPlan?.champion);
    const me=players.find(p=>clean(p.champion).toLowerCase()===champion.toLowerCase())||players.find(p=>clean(p.summonerName)===clean(payload?.activePlayer));
    if(!me?.team)return;
    const stateRole=normRole(lastState?.matchup?.role||lastState?.matchup?.plan?.role||lastState?.teamPlan?.rememberPlan?.role);
    const userRole=playerRole(me)||stateRole;
    const oursRaw=players.filter(p=>p.team===me.team);
    const enemiesRaw=players.filter(p=>p.team&&p.team!==me.team);
    const ours=repairTeam(oursRaw,'ourTeam',champion,userRole);
    const enemies=repairTeam(enemiesRaw,'theirTeam',champion,userRole);
    if(!enemies.length)return;
    const rosterSignature=[
      champion,userRole,
      ...sorted(ours).map(p=>`O:${playerRole(p)}:${p.champion}`),
      ...sorted(enemies).map(p=>`E:${playerRole(p)}:${p.champion}`),
    ].join('|').toLowerCase();

    if(rosterSignature!==lastRosterSignature){
      lastRosterSignature=rosterSignature;
      renderTeam('opRemOurTeam',ours,'');
      renderTeam('opRemTheirTeam',enemies,'');
    }
    if(champion)document.body.style.setProperty('--op-live-splash',`url("${splash(champion)}")`);
    void requestCoach(rosterSignature,champion,userRole,ours,enemies);
  }

  function onState(state){
    lastState=state;
    installVisualLayer();
    const champion=clean(state?.matchup?.champion||state?.matchup?.plan?.you?.name||state?.teamPlan?.rememberPlan?.champion);
    if(champion)document.body.style.setProperty('--op-live-splash',`url("${splash(champion)}")`);
    if(lastRoster)applyRoster(lastRoster);
  }

  installVisualLayer();
  window.addEventListener('op-climb-live-roster',event=>applyRoster(event.detail||{}));
  window.opCompanion?.getState?.().then(onState).catch(()=>{});
  window.opCompanion?.onState?.(onState);
})();
