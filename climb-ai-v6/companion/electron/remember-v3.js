(()=>{
  const $=id=>document.getElementById(id);
  const STORAGE_KEY='opclimb.remember-plan.v4';
  let previousPhase='';
  let flashTimer=null;

  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  const upper=value=>clean(value).toUpperCase();
  const safe=value=>Array.isArray(value)?value.filter(Boolean):[];
  const normalRole=value=>{const r=upper(value);if(r==='BOTTOM')return'ADC';if(r==='UTILITY')return'SUPPORT';if(r==='MIDDLE')return'MID';return r||null};
  const clip=(value,max=86)=>{const text=clean(value);if(text.length<=max)return text;const cut=text.slice(0,max-1).replace(/\s+\S*$/,'');return`${cut||text.slice(0,max-1)}…`};
  const firstSentence=value=>{const text=clean(value);const hit=text.match(/^.*?[.!?](?:\s|$)/);return clip(hit?hit[0]:text,82)};
  const namesFrom=(value,names,max=2)=>safe(names).map(n=>clean(n)).filter(Boolean).filter(name=>clean(value).toLowerCase().includes(name.toLowerCase())).slice(0,max);

  const SCALERS=new Set(['Aurelion Sol','Aphelios','Azir',"Bel'Veth",'Cassiopeia','Gangplank','Jax','Jinx','Kassadin','Kayle','Kindred',"Kog'Maw",'Master Yi','Nasus','Senna','Shyvana','Smolder','Sona','Tristana','Twitch','Vayne','Veigar','Viktor','Vladimir','Yone']);
  const HYPER_CARRY=new Set(['Aphelios','Aurelion Sol','Azir','Cassiopeia','Jinx',"Kog\'Maw",'Smolder','Twitch','Vayne','Viktor','Vladimir','Zeri']);
  const SIDE_CARRY=new Set(['Camille','Fiora','Gangplank','Gwen','Irelia','Jax','Kayle','Nasus','Tryndamere','Vayne','Yorick']);
  const CARRY_JUNGLE=new Set(["Bel'Veth",'Graves','Karthus','Kindred','Lillia','Master Yi','Nidalee','Nocturne','Shyvana','Viego']);
  const DENIAL=new Set(['Alistar','Braum','Galio','Gragas','Janna','Lulu','Maokai','Milio','Nautilus','Poppy','Rakan','Renata Glasc','Shen','Tahm Kench','Taric','Thresh','Zilean']);
  const FRONTLINE=new Set(['Alistar','Amumu','Braum',"Cho'Gath",'Dr. Mundo','Galio','Gragas',"K'Sante",'Leona','Maokai','Malphite','Nautilus','Ornn','Poppy','Rakan','Rell','Sejuani','Sett','Shen','Sion','Skarner','Tahm Kench','Taric','Volibear','Zac']);
  const EARLY=new Set(['Darius','Draven','Elise','Jarvan IV','Jayce','Kalista','Kled','Lee Sin','LeBlanc','Lucian','Nidalee','Olaf','Pantheon','Pyke',"Rek'Sai",'Renekton','Rumble','Talon','Xin Zhao','Zed']);
  const ASSET_IDS={
    'Wukong':'MonkeyKing','Nunu & Willump':'Nunu','Renata Glasc':'Renata',"K'Sante":'KSante',"Cho'Gath":'Chogath',"Kai'Sa":'Kaisa',"Vel'Koz":'Velkoz','LeBlanc':'Leblanc',"Bel'Veth":'Belveth',"Rek'Sai":'RekSai',"Kog'Maw":'KogMaw','Dr. Mundo':'DrMundo','Master Yi':'MasterYi','Miss Fortune':'MissFortune','Jarvan IV':'JarvanIV','Lee Sin':'LeeSin','Aurelion Sol':'AurelionSol','Twisted Fate':'TwistedFate','Tahm Kench':'TahmKench','Xin Zhao':'XinZhao'
  };

  function install(){
    if($('opRememberHud'))return $('opRememberHud');
    const style=document.createElement('style');
    style.id='op-remember-v4-style';
    style.textContent=`
body.op-remember-live #status,body.op-remember-live #matchup,body.op-remember-live #opMissionReminders,body.op-remember-live #idleArena{display:none!important}
#opRememberHud{position:relative;overflow:hidden;margin-top:14px;padding:0;background:radial-gradient(circle at 82% -12%,rgba(214,255,47,.13),transparent 30%),linear-gradient(145deg,#0a1015,#05080c 72%);border:1px solid rgba(255,255,255,.11);box-shadow:0 28px 86px rgba(0,0,0,.46)}#opRememberHud.hidden{display:none!important}#opRememberHud:before{content:'';position:absolute;left:0;top:0;width:4px;height:100%;background:#d6ff2f}.rem4-top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px 22px 14px;border-bottom:1px solid rgba(255,255,255,.07)}.rem4-kicker{font-size:7px;letter-spacing:.22em;color:#d6ff2f;font-weight:950;text-transform:uppercase}.rem4-title{margin:5px 0 0;font-size:clamp(23px,3vw,34px);line-height:1;letter-spacing:-.035em;text-transform:uppercase}.rem4-live{display:flex;align-items:center;gap:7px;border:1px solid rgba(214,255,47,.28);color:#d6ff2f;padding:7px 10px;font-size:7px;letter-spacing:.16em;font-weight:950;text-transform:uppercase;white-space:nowrap}.rem4-live:before{content:'';width:6px;height:6px;border-radius:50%;background:#d6ff2f;box-shadow:0 0 14px rgba(214,255,47,.85)}.rem4-body{padding:14px 20px 19px}.rem4-draft{display:grid;grid-template-columns:1fr auto 1fr;gap:9px;align-items:end}.rem4-side-label{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:7px;letter-spacing:.16em;font-weight:950;text-transform:uppercase;color:#87939d}.rem4-side.enemy .rem4-side-label{color:#ff8585}.rem4-team{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}.rem4-pick{position:relative;min-width:0;height:54px;overflow:hidden;border:1px solid rgba(255,255,255,.08);background:#0a0f14;clip-path:polygon(0 0,calc(100% - 7px) 0,100% 7px,100% 100%,0 100%)}.rem4-pick.threat{border-color:rgba(255,91,91,.48);box-shadow:inset 0 0 24px rgba(255,70,70,.09)}.rem4-pick img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.62;filter:saturate(.78) contrast(1.05)}.rem4-pick:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 12%,rgba(5,8,12,.18) 43%,rgba(5,8,12,.96) 100%)}.rem4-pick-copy{position:absolute;z-index:2;left:6px;right:5px;bottom:4px;min-width:0}.rem4-pick-role{display:block;font-size:6px;letter-spacing:.12em;color:#93a1aa;font-weight:900;text-transform:uppercase}.rem4-pick-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px;font-size:8px;font-weight:950;color:#f3f6f8;text-transform:uppercase}.rem4-vs{padding-bottom:17px;font-size:8px;letter-spacing:.14em;font-weight:950;color:#59656e}.rem4-call-row{display:grid;grid-template-columns:1.45fr .85fr;gap:8px;margin-top:10px}.rem4-call{padding:15px 17px;border:1px solid rgba(214,255,47,.31);background:linear-gradient(105deg,rgba(214,255,47,.095),rgba(214,255,47,.015));clip-path:polygon(0 0,calc(100% - 13px) 0,100% 13px,100% 100%,0 100%)}.rem4-label{display:block;font-size:7px;letter-spacing:.18em;text-transform:uppercase;font-weight:950;color:#7f8d97}.rem4-call .rem4-label{color:#d6ff2f}.rem4-call strong{display:block;margin-top:5px;font-size:clamp(24px,3.1vw,36px);line-height:1;letter-spacing:-.03em;text-transform:uppercase}.rem4-call small{display:block;margin-top:6px;font-size:9px;line-height:1.35;color:#b6c0c7;font-weight:800;text-transform:uppercase}.rem4-threat{padding:14px 15px;border:1px solid rgba(255,91,91,.28);background:linear-gradient(120deg,rgba(255,75,75,.08),rgba(255,75,75,.015));clip-path:polygon(0 0,calc(100% - 11px) 0,100% 11px,100% 100%,0 100%)}.rem4-threat .rem4-label{color:#ff8585}.rem4-threat strong{display:block;margin-top:5px;font-size:18px;line-height:1.05;text-transform:uppercase}.rem4-threat small{display:block;margin-top:7px;color:#d8dfe3;font-size:9px;line-height:1.35;font-weight:850;text-transform:uppercase}.rem4-carry-strip{display:grid;grid-template-columns:1fr .92fr 1.35fr;gap:7px;margin-top:8px}.rem4-carry-cell{padding:9px 11px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.012)}.rem4-carry-cell span{display:block;font-size:6px;letter-spacing:.16em;font-weight:950;color:#77858f;text-transform:uppercase}.rem4-carry-cell strong{display:block;margin-top:4px;font-size:10px;line-height:1.25;text-transform:uppercase}.rem4-carry-cell.primary{border-color:rgba(214,255,47,.22);background:rgba(214,255,47,.026)}.rem4-carry-cell.primary span,.rem4-carry-cell.primary strong{color:#d6ff2f}.rem4-carry-cell.role{border-color:rgba(120,170,255,.20)}.rem4-carry-cell.role span{color:#79adff}.rem4-command-strip{display:grid;grid-template-columns:.72fr 1.55fr 1.1fr;gap:7px;margin-top:8px}.rem4-command-cell{padding:10px 12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.014)}.rem4-command-cell span{display:block;font-size:6px;letter-spacing:.16em;font-weight:950;color:#74818b;text-transform:uppercase}.rem4-command-cell strong{display:block;margin-top:5px;font-size:10px;line-height:1.3;text-transform:uppercase}.rem4-command-cell.mode{border-color:rgba(214,255,47,.26);background:rgba(214,255,47,.035)}.rem4-command-cell.mode span,.rem4-command-cell.mode strong{color:#d6ff2f}.rem4-command-cell.trigger{border-color:rgba(67,140,255,.22)}.rem4-command-cell.trigger span{color:#79adff}.rem4-command-cell.stop{border-color:rgba(255,91,91,.20)}.rem4-command-cell.stop span{color:#ff8585}.rem4-path-wrap{margin-top:8px;padding:11px 12px 12px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.015)}.rem4-path-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.rem4-path-head b{font-size:8px;letter-spacing:.18em;color:#d6ff2f;text-transform:uppercase}.rem4-path-head span{font-size:7px;letter-spacing:.12em;color:#63717b;text-transform:uppercase}.rem4-path{display:grid;grid-template-columns:repeat(5,1fr);gap:18px;margin-top:9px}.rem4-step{position:relative;min-width:0;padding:10px 9px;border:1px solid rgba(255,255,255,.075);background:#091016}.rem4-step:not(:last-child):after{content:'›';position:absolute;right:-14px;top:50%;transform:translateY(-50%);font-size:22px;color:#d6ff2f;font-weight:300}.rem4-step i{display:block;font-style:normal;font-size:6px;letter-spacing:.15em;color:#6f7d87;text-transform:uppercase}.rem4-step strong{display:block;margin-top:5px;font-size:10px;line-height:1.25;text-transform:uppercase}.rem4-lane{display:grid;grid-template-columns:.7fr 1fr 1fr 1fr;gap:7px;margin-top:8px}.rem4-lane-title,.rem4-lane-card{padding:10px 11px;border:1px solid rgba(67,140,255,.16);background:rgba(67,140,255,.025)}.rem4-lane-title{border-color:rgba(67,140,255,.3);background:linear-gradient(110deg,rgba(67,140,255,.09),rgba(67,140,255,.02))}.rem4-lane-title .rem4-label{color:#79adff}.rem4-lane-title strong{display:block;margin-top:5px;font-size:13px;line-height:1.15;text-transform:uppercase}.rem4-lane-title small{display:block;margin-top:4px;color:#74838e;font-size:7px;letter-spacing:.09em;text-transform:uppercase}.rem4-lane-card span{display:block;font-size:6px;letter-spacing:.16em;font-weight:950;color:#75858f;text-transform:uppercase}.rem4-lane-card strong{display:block;margin-top:5px;font-size:9px;line-height:1.32;text-transform:uppercase}.rem4-lane-card.danger{border-color:rgba(255,91,91,.18)}.rem4-lane-card.danger span{color:#ff8585}.rem4-footer{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.rem4-footer article{padding:10px 12px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.012)}.rem4-footer span{display:block;font-size:6px;letter-spacing:.16em;font-weight:950;text-transform:uppercase}.rem4-footer strong{display:block;margin-top:5px;font-size:9px;line-height:1.35;text-transform:uppercase}.rem4-behind{border-color:rgba(255,180,75,.18)!important}.rem4-behind span{color:#ffbc68}.rem4-mission{border-color:rgba(214,255,47,.16)!important}.rem4-mission span{color:#d6ff2f}.rem4-check{margin-top:8px;border-top:1px solid rgba(255,255,255,.06)}.rem4-check summary{cursor:pointer;list-style:none;padding:9px 1px 2px;color:#64717b;font-size:7px;letter-spacing:.14em;font-weight:900;text-transform:uppercase}.rem4-check summary::-webkit-details-marker{display:none}.rem4-check summary:after{content:' +';color:#d6ff2f}.rem4-check[open] summary:after{content:' −'}.rem4-check-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:7px}.rem4-check-card{padding:9px;border:1px solid rgba(67,140,255,.13);background:rgba(67,140,255,.02)}.rem4-check-card b{display:block;color:#75a9ff;font-size:8px;letter-spacing:.09em}.rem4-check-card p{margin:5px 0 0;color:#aeb8bf;font-size:9px;line-height:1.35}.rem4-coach-detail{margin-top:9px;border:1px solid rgba(255,255,255,.08);background:rgba(4,8,12,.48)}.rem4-coach-detail>summary{cursor:pointer;list-style:none;padding:11px 12px;color:#8997a1;font-size:7px;letter-spacing:.15em;font-weight:950;text-transform:uppercase}.rem4-coach-detail>summary::-webkit-details-marker{display:none}.rem4-coach-detail>summary:after{content:' +';float:right;color:#d6ff2f}.rem4-coach-detail[open]>summary:after{content:' −'}.rem4-coach-detail-body{padding:0 9px 10px}.rem4-coach-detail .rem4-path-wrap,.rem4-coach-detail .rem4-lane,.rem4-coach-detail .rem4-footer{margin-top:8px}.rem4-note{margin-top:8px;text-align:center;color:#46525b;font-size:6px;letter-spacing:.12em;text-transform:uppercase}.rem4-flash{position:absolute;z-index:5;inset:0;display:none;place-items:center;background:rgba(4,8,11,.95);font-size:clamp(30px,7vw,68px);font-weight:950;letter-spacing:.05em;color:#d6ff2f;text-transform:uppercase}.rem4-flash.on{display:grid;animation:rem4Lock 1.05s ease both}@keyframes rem4Lock{0%{opacity:0;transform:scale(1.04)}18%,72%{opacity:1;transform:scale(1)}100%{opacity:0}}#opPregameMatchup{display:none!important}@media(max-width:980px){.rem4-draft{grid-template-columns:1fr}.rem4-carry-strip,.rem4-command-strip{grid-template-columns:1fr}.rem4-vs{display:none}.rem4-call-row{grid-template-columns:1fr}.rem4-path{grid-template-columns:1fr}.rem4-step:not(:last-child):after{content:'↓';right:9px;top:auto;bottom:-17px;transform:none;font-size:14px}.rem4-lane{grid-template-columns:1fr 1fr}.rem4-footer,.rem4-check-grid{grid-template-columns:1fr}}@media(max-width:580px){.rem4-team{grid-template-columns:repeat(5,minmax(54px,1fr));overflow-x:auto}.rem4-title{font-size:25px}.rem4-top,.rem4-body{padding-left:14px;padding-right:14px}.rem4-lane{grid-template-columns:1fr}}
`;
    document.head.appendChild(style);

    const section=document.createElement('section');
    section.id='opRememberHud';section.className='card hidden';section.setAttribute('aria-live','polite');
    section.innerHTML=`
      <div id="opRememberFlash" class="rem4-flash">PLAN LOCKED</div>
      <div class="rem4-top"><div><div class="rem4-kicker">OP CLIMB // COACH BOARD</div><h2 id="opRememberTitle" class="rem4-title">YOUR WIN CONDITION</h2></div><div class="rem4-live">LIVE · RECORDING</div></div>
      <div class="rem4-body">
        <section class="rem4-draft">
          <div class="rem4-side"><div class="rem4-side-label"><span>YOUR TEAM</span><span id="opRemOurShape">TEAM PLAN</span></div><div id="opRemOurTeam" class="rem4-team"></div></div>
          <div class="rem4-vs">VS</div>
          <div class="rem4-side enemy"><div class="rem4-side-label"><span>THEIR TEAM</span><span id="opRemEnemyCurve">DRAFT READ</span></div><div id="opRemTheirTeam" class="rem4-team"></div></div>
        </section>

        <section class="rem4-call-row">
          <article class="rem4-call"><span class="rem4-label">YOUR JOB</span><strong id="opRemGameCall">FARM TO SPIKE</strong><small id="opRemGameCallWhy">PROTECT CS / XP · FIGHT ON YOUR ITEM WINDOW</small></article>
          <article class="rem4-threat"><span class="rem4-label">MAIN THREAT</span><strong id="opRemThreat">THEIR ENGAGE</strong><small id="opRemThreatAnswer">TRACK THE ENTRY · STAY BEHIND PEEL</small></article>
        </section>

        <section class="rem4-carry-strip" aria-label="Draft carry map">
          <article class="rem4-carry-cell primary"><span>WHO CARRIES?</span><strong id="opRemCarryPrimary">DETECTING</strong></article>
          <article class="rem4-carry-cell role"><span>YOUR ROLE</span><strong id="opRemCarryRole">DETECTING</strong></article>
          <article class="rem4-carry-cell"><span>PLAY AROUND</span><strong id="opRemCarryPlay">YOUR TEAM PLAN</strong></article>
        </section>

        <section class="rem4-command-strip" aria-label="Decision command">
          <article class="rem4-command-cell mode"><span>FIGHT / FARM</span><strong id="opRemDecisionCall">FARM</strong></article>
          <article class="rem4-command-cell trigger"><span>FIGHT WHEN</span><strong id="opRemFightWhen">YOUR SETUP IS READY</strong></article>
          <article class="rem4-command-cell stop"><span>DON’T</span><strong id="opRemStopRule">FORCE THE WRONG FIGHT</strong></article>
        </section>

        <details class="rem4-coach-detail">
          <summary>COACH DETAIL · WIN PATH / LANE / SELF-CHECK</summary>
          <div class="rem4-coach-detail-body">
            <section class="rem4-path-wrap">
              <div class="rem4-path-head"><b>YOUR WIN CONDITION PATH</b><span>DO THESE IN ORDER</span></div>
              <div id="opRemWinPath" class="rem4-path"></div>
            </section>
            <section class="rem4-lane">
              <article class="rem4-lane-title"><span class="rem4-label">LANE</span><strong id="opRemMatchTitle">DETECTING OPPONENT</strong><small id="opRemMatchEdge">MATCHUP READ</small></article>
              <article class="rem4-lane-card"><span>WAVE</span><strong id="opRemLaneDo">FARM FIRST</strong></article>
              <article class="rem4-lane-card"><span>TRADE</span><strong id="opRemTradeWhen">WHEN KEY SPELL MISSES</strong></article>
              <article class="rem4-lane-card danger"><span>NEVER</span><strong id="opRemNever">FORCE EVEN ALL-IN</strong></article>
            </section>
            <section class="rem4-footer">
              <article class="rem4-behind"><span>IF BEHIND</span><strong id="opRemBehind">SAFE WAVES → BUY TIME → WAIT FOR ITEM WINDOW</strong></article>
              <article class="rem4-mission"><span>CLIMB MISSION</span><strong id="opRemMission">KEEP YOUR CURRENT DEVELOPMENT FOCUS</strong></article>
            </section>
            <details class="rem4-check"><summary>5 / 10 / 15 MIN SELF-CHECK</summary><div id="opRemChecks" class="rem4-check-grid"></div></details>
            <div class="rem4-note">STATIC PRE-GAME COACH PLAN · YOU READ THE LIVE GAME STATE · NO REACTIVE SHOTCALLING</div>
          </div>
        </details>
      </div>`;
    const status=$('status');if(status)status.insertAdjacentElement('afterend',section);else document.querySelector('main')?.appendChild(section);
    return section;
  }

  function save(plan,champion){if(!plan)return;try{localStorage.setItem(STORAGE_KEY,JSON.stringify({plan,champion:clean(champion),savedAt:new Date().toISOString()}))}catch{}}
  function load(champion){try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(!parsed?.plan)return null;const wanted=clean(champion).toLowerCase(),stored=clean(parsed.champion).toLowerCase();if(wanted&&stored&&wanted!==stored)return null;return parsed.plan}catch{return null}}
  function set(id,value,fallback='—'){const node=$(id);if(node)node.textContent=clean(value)||fallback}
  function missionFor(state){return clean(safe(state?.teamPlan?.missionTips)[0]?.cue)||'KEEP YOUR CURRENT DEVELOPMENT FOCUS'}
  function championFor(state){return clean(state?.matchup?.champion||state?.matchup?.plan?.you?.name||state?.teamPlan?.rememberPlan?.champion)}
  function planSnapshot(state){return state?.teamPlan?.rememberPlan||null}
  function roster(state,side){
    const current=safe(state?.teamPlan?.[side]);
    const frozen=side==='ourTeam'?safe(planSnapshot(state)?.draftTeams?.ours):safe(planSnapshot(state)?.draftTeams?.theirs);
    const source=current.length?current:frozen;
    return source.map(p=>({name:clean(p?.name),role:normalRole(p?.role)})).filter(p=>p.name);
  }
  function rolePick(players,role){return players.find(p=>p.role===role)?.name||''}
  function validOpponent(value){const name=clean(value);if(!name)return'';const u=upper(name);if(u==='OPPONENT'||u==='ENEMY'||u.includes('TBD')||u.includes('UNKNOWN')||u.includes('PENDING'))return'';return name}
  function draftOpponent(state,role){const enemies=roster(state,'theirTeam');return rolePick(enemies,role)||(enemies.length===1?enemies[0].name:'')}

  function matchupFor(state){
    const role=normalRole(state?.matchup?.role||state?.matchup?.plan?.role||planSnapshot(state)?.role);
    const you=clean(state?.matchup?.champion||state?.matchup?.plan?.you?.name||planSnapshot(state)?.champion)||'YOU';
    const opponent=validOpponent(state?.matchup?.opponent)||validOpponent(state?.matchup?.plan?.them?.name)||draftOpponent(state,role);
    const lane=state?.matchup?.plan?.laneDuel||{};
    const edgeRaw=clean(state?.matchup?.plan?.laneEdge?.label);
    const edge=edgeRaw&&upper(edgeRaw)!=='YOUR POWER CURVE'?edgeRaw:'MATCHUP READ';
    let laneDo=clean(lane.wave);
    let tradeWhen=clean(lane.yourPattern);
    let never=clean(lane.never)||clean(safe(state?.matchup?.plan?.trades?.avoid)[0]);
    if(opponent){
      const e=upper(edge);
      if(!laneDo)laneDo=e.includes('THEIR')?`WAVE NEAR YOU · PRESERVE HP`:`FARM FIRST · MAKE ${opponent} STEP UP`;
      if(!tradeWhen)tradeWhen=e.includes('YOU')?`${opponent} LAST-HITS · SHORT TRADE`:`${opponent} MISSES KEY SPELL`;
      if(!never)never=`FULL-HP EXTENDED FIGHT FROM EVEN WAVE`;
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
    return choices.filter(Boolean).slice(0,2).join(' / ')||allyNames.slice(0,2).join(' / ')||'YOUR TEAM';
  }

  function frozenThreats(state){return safe(state?.teamPlan?.compositionRead?.enemyThreats).length?safe(state.teamPlan.compositionRead.enemyThreats):safe(planSnapshot(state)?.draftThreats)}
  function frozenDamage(state){return safe(state?.teamPlan?.compositionRead?.enemyDamageCore).length?safe(state.teamPlan.compositionRead.enemyDamageCore):safe(planSnapshot(state)?.draftDamageCore)}
  function pickFightTarget(state,plan,match){
    const enemies=roster(state,'theirTeam');
    const fromRead=frozenDamage(state).filter(Boolean)[0];
    if(fromRead)return clean(fromRead);
    const enemyNames=enemies.map(p=>p.name);
    const fromRule=namesFrom(plan?.fightRule,enemyNames,1)[0];
    if(fromRule)return fromRule;
    return rolePick(enemies,'ADC')||rolePick(enemies,'MID')||match.opponent||enemyNames[0]||'ENEMY CARRY';
  }
  function pickMainThreat(state,plan,focus){
    const enemies=roster(state,'theirTeam');const enemyNames=enemies.map(p=>p.name);
    const fromFrozen=frozenThreats(state).map(clean).filter(Boolean).find(name=>name!==focus);if(fromFrozen)return fromFrozen;
    const fromPlan=namesFrom(plan?.watch,enemyNames,2).find(name=>name!==focus);if(fromPlan)return fromPlan;
    return rolePick(enemies,'SUPPORT')||rolePick(enemies,'JUNGLE')||rolePick(enemies,'TOP')||enemyNames.find(name=>name!==focus)||'THEIR ENGAGE';
  }

  function powerFor(players){let score=0;for(const pick of players){if(SCALERS.has(pick.name))score+=2;if(EARLY.has(pick.name))score-=2}if(score>=3)return'SCALING';if(score<=-3)return'EARLY';return'MID GAME'}
  function matchCall(state,plan){
    const ours=upper(plan?.draft?.powerCurve)||powerFor(roster(state,'ourTeam'));
    const theirs=powerFor(roster(state,'theirTeam'));
    if(ours==='SCALING'&&theirs==='EARLY')return{call:'FARM + SCALE',why:'THEY PEAK EARLIER · DON’T FLIP EARLY 5V5S',enemyCurve:theirs};
    if(ours==='EARLY'&&theirs==='SCALING')return{call:'FIGHT EARLY',why:'CREATE FIRST MOVE · STACK OBJECTIVES BEFORE THEY SCALE',enemyCurve:theirs};
    if(ours==='SCALING')return{call:'FARM TO SPIKE',why:'PROTECT CS / XP · FIGHT ON ITEM WINDOWS',enemyCurve:theirs};
    if(theirs==='SCALING'&&ours!=='SCALING')return{call:'PRESS TEMPO',why:'WIN FIRST MOVE · DENY THEIR FREE SCALE',enemyCurve:theirs};
    if(ours==='EARLY')return{call:'PRESS TEMPO',why:'CREATE THE LEAD FIRST · CONVERT BEFORE TEMPO FADES',enemyCurve:theirs};
    if(theirs==='EARLY')return{call:'FARM FIRST',why:'ABSORB THEIR FIRST PRESSURE · FIGHT WHEN SETUP IS YOURS',enemyCurve:theirs};
    return{call:'PLAY MID GAME',why:'FARM CLEAN · FIGHT WITH NUMBERS / SETUP',enemyCurve:theirs};
  }

  function localCarryScore(p){
    const role=normalRole(p?.role);const name=clean(p?.name);let score=role==='ADC'?48:role==='MID'?35:role==='JUNGLE'?29:role==='TOP'?27:role==='SUPPORT'?8:20;
    if(HYPER_CARRY.has(name))score+=28;
    if(SCALERS.has(name))score+=17;
    if(SIDE_CARRY.has(name))score+=17;
    if(role==='JUNGLE'&&CARRY_JUNGLE.has(name))score+=20;
    if(DENIAL.has(name))score-=14;
    if(FRONTLINE.has(name))score-=16;
    if(role==='SUPPORT')score-=8;
    return Math.max(0,Math.min(100,score));
  }
  function localCarryMap(ours,theirs,you,threat){
    const ranked=[...ours].sort((a,b)=>localCarryScore(b)-localCarryScore(a));
    const enemyRanked=[...theirs].sort((a,b)=>localCarryScore(b)-localCarryScore(a));
    const primary=ranked[0]||{name:you,role:null};
    const secondary=ranked.find(p=>clean(p?.name)!==clean(primary?.name))||null;
    const me=ranked.find(p=>clean(p?.name).toLowerCase()===clean(you).toLowerCase())||{name:you,role:null};
    let playerRole='ENABLER';
    if(clean(me?.name)===clean(primary?.name))playerRole='PRIMARY CARRY';
    else if(secondary&&clean(me?.name)===clean(secondary?.name)&&localCarryScore(me)>=46)playerRole='SECONDARY CARRY';
    else if(DENIAL.has(clean(me?.name))||FRONTLINE.has(clean(me?.name))||normalRole(me?.role)==='SUPPORT')playerRole='THREAT DENIAL';
    const mainThreat=clean(threat)||clean(enemyRanked[0]?.name)||'THEIR MAIN THREAT';
    const primaryName=clean(primary?.name)||clean(you)||'YOUR CARRY';
    const job=playerRole==='PRIMARY CARRY'
      ?'TAKE SAFE RESOURCES → HIT YOUR SPIKE → STAY ALIVE'
      :playerRole==='SECONDARY CARRY'
        ?'KEEP YOUR SPIKE → CONNECT TO '+primaryName
        :playerRole==='THREAT DENIAL'
          ?'KEEP '+primaryName+' SAFE → DENY '+mainThreat
          :'CREATE SPACE FOR '+primaryName+' → CONNECT FIRST';
    const playAround=playerRole==='THREAT DENIAL'?primaryName+' / DENY '+mainThreat:primaryName;
    return{primary:primaryName,playerRole,playAround,job,reason:playerRole==='PRIMARY CARRY'?'YOU ARE THE DRAFT RESOURCE PRIORITY':primaryName+' IS THE DRAFT RESOURCE PRIORITY'};
  }

  function decisionPriority(call){
    const value=upper(call);
    if(value.includes('FIGHT'))return'FIGHT';
    if(value.includes('PRESS'))return'PRESSURE';
    if(value.includes('FARM')||value.includes('SCALE'))return'FARM';
    return'SET UP';
  }
  function localFightWhen(role,threat,withName,call){
    const mode=decisionPriority(call);
    if(mode==='FIGHT'||mode==='PRESSURE')return role==='JUNGLE'?'YOUR LANES CAN MOVE · '+threat+' IS TRACKED':withName+' CAN CONNECT · '+threat+' CANNOT START CLEANLY';
    return role==='ADC'?threat+' COMMITS · YOU STILL HAVE PEEL / RANGE':threat+' SHOWS / SPENDS ENTRY · YOUR TEAM CAN FOLLOW';
  }
  function localStopRule(plan,match,threat){
    return upper(firstSentence(match?.never||plan?.never||plan?.fightRule))||'CHASE THROUGH '+threat;
  }

  function resourceFallback(role){if(role==='SUPPORT')return{label:'MAP',headline:'SET UP FIRST',summary:'VISION → OBJECTIVE',checkpoints:[]};if(role==='JUNGLE')return{label:'FARM',headline:'6.2 CS/MIN',summary:'125 @20',checkpoints:[{minute:20,target:125}]};return{label:'CS',headline:'7.0 CS/MIN',summary:'140 @20',checkpoints:[{minute:20,target:140}]}}
  function finalFarmCue(resource){const points=safe(resource?.checkpoints);const last=points[points.length-1];if(last?.target&&last?.minute)return`${last.target} ${upper(resource?.kind||'CS')} @${last.minute}`;return upper(resource?.headline||'PLAY CLEAN')}
  function conversionFor(shape){const s=upper(shape);if(s.includes('SIDE'))return'BARON / TOWER';return'DRAGON / BARON'}
  function threatAnswer(role,threat){if(role==='ADC')return`KEEP FLASH FOR ENTRY · STAY BEHIND PEEL`;if(role==='MID')return`TRACK ${threat} · ENTER AFTER FIRST CONTACT`;if(role==='SUPPORT')return`MARK ${threat} · PEEL YOUR CARRY FIRST`;if(role==='JUNGLE')return`TRACK ${threat} · DON’T FACE-CHECK FIRST`;if(role==='TOP')return`TRACK ${threat} FLANK · ENTER SECOND`;return`TRACK ${threat} BEFORE COMMITTING`}
  function winSteps(plan,role,resource,withName,focus,threat,call){
    const convert=conversionFor(plan?.draft?.teamShape);const farm=finalFarmCue(resource);
    const step1=call.includes('FIGHT')||call.includes('PRESS')?'CREATE FIRST MOVE':farm;
    const step2=`WITH ${withName}`;
    const step3=`DENY ${threat}`;
    const step4=role==='ADC'?`HIT ${focus} IF SAFE`:`LOCK ${focus}`;
    return[{label:'1 · TEMPO',value:step1},{label:'2 · LINK',value:step2},{label:'3 · SURVIVE',value:step3},{label:'4 · FIGHT',value:step4},{label:'5 · CASH OUT',value:convert}];
  }

  function assetId(name){return ASSET_IDS[name]||clean(name).replace(/[^A-Za-z0-9]/g,'')}
  function championTile(name){const id=assetId(name);return id?`https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${id}_0.jpg`:''}
  function renderTeam(rootId,players,threat){
    const root=$(rootId);if(!root)return;root.replaceChildren();
    const ordered=['TOP','JUNGLE','MID','ADC','SUPPORT'].map(role=>players.find(p=>p.role===role)).filter(Boolean);
    const extras=players.filter(p=>!ordered.includes(p));const picks=[...ordered,...extras].slice(0,5);
    picks.forEach(pick=>{
      const card=document.createElement('article');card.className=`rem4-pick${clean(pick.name)===clean(threat)?' threat':''}`;
      const img=document.createElement('img');img.alt='';img.src=championTile(pick.name);img.addEventListener('error',()=>img.remove());
      const copy=document.createElement('div');copy.className='rem4-pick-copy';
      const role=document.createElement('span');role.className='rem4-pick-role';role.textContent=pick.role||'—';
      const name=document.createElement('strong');name.className='rem4-pick-name';name.textContent=pick.name;
      copy.append(role,name);card.append(img,copy);root.appendChild(card);
    });
    while(root.children.length<5){const card=document.createElement('article');card.className='rem4-pick';const copy=document.createElement('div');copy.className='rem4-pick-copy';const role=document.createElement('span');role.className='rem4-pick-role';role.textContent='—';const name=document.createElement('strong');name.className='rem4-pick-name';name.textContent='PENDING';copy.append(role,name);card.appendChild(copy);root.appendChild(card)}
  }
  function renderWinPath(steps){const root=$('opRemWinPath');if(!root)return;root.replaceChildren();safe(steps).slice(0,5).forEach(step=>{const card=document.createElement('article');card.className='rem4-step';const label=document.createElement('i');label.textContent=upper(step.label);const value=document.createElement('strong');value.textContent=upper(clip(step.value,44));card.append(label,value);root.appendChild(card)})}
  function renderChecks(checks){const root=$('opRemChecks');if(!root)return;root.replaceChildren();safe(checks).slice(0,3).forEach(check=>{const card=document.createElement('article');card.className='rem4-check-card';const title=document.createElement('b');title.textContent=`${check.minute} MIN · ${upper(check.title)}`;const copy=document.createElement('p');copy.textContent=safe(check.questions).slice(0,2).map(upper).join(' · ');card.append(title,copy);root.appendChild(card)})}
  function flashLock(){const node=$('opRememberFlash');if(!node)return;node.classList.remove('on');void node.offsetWidth;node.classList.add('on');clearTimeout(flashTimer);flashTimer=setTimeout(()=>node.classList.remove('on'),1100)}
  function fallbackPlan(state){const match=matchupFor(state);const role=match.role;return{champion:match.you,role,draft:{powerCurve:'MID GAME',teamShape:'TEAM PLAN'},resourceTarget:resourceFallback(role),playWith:'',watch:'',fightRule:'',behindPlan:role==='ADC'?'SAFE FARM → STAY WITH PEEL → WAIT FOR ITEM WINDOW':'SAFE WAVES → BUY TIME → FIGHT ONLY FROM AN ADVANTAGE',checks:[]}}

  function render(state){
    const section=install();const phase=String(state?.phase||'');const champion=championFor(state);const livePlan=planSnapshot(state);
    if(phase==='CHAMP_SELECT'&&livePlan)save(livePlan,champion);
    const plan=livePlan||load(champion)||fallbackPlan(state);const visible=phase==='RECORDING';section.classList.toggle('hidden',!visible);document.body.classList.toggle('op-remember-live',visible);if(!visible){previousPhase=phase;return}

    const match=matchupFor(state);const role=normalRole(plan?.role||match.role);const resource=plan?.resourceTarget||resourceFallback(role);const withName=pickSpecificPlayWith(state,plan,role,match.you);const focus=pickFightTarget(state,plan,match);const threat=pickMainThreat(state,plan,focus);const call=matchCall(state,plan);const answer=threatAnswer(role,threat);const ours=roster(state,'ourTeam');const theirs=roster(state,'theirTeam');const carryMap=localCarryMap(ours,theirs,match.you,threat);

    set('opRememberTitle',`${upper(plan.champion||champion||'YOU')} · ${upper(role||'ROLE')} // WIN CONDITION`);
    set('opRemOurShape',upper(plan?.draft?.teamShape),'TEAM PLAN');set('opRemEnemyCurve',`${call.enemyCurve} DRAFT`,'DRAFT READ');
    renderTeam('opRemOurTeam',ours,'');renderTeam('opRemTheirTeam',theirs,threat);
    set('opRemCarryPrimary',carryMap.primary,'YOUR CARRY');
    set('opRemCarryRole',carryMap.playerRole,'ENABLER');
    set('opRemCarryPlay',carryMap.playAround,'YOUR TEAM PLAN');
    set('opRemGameCall',carryMap.job||call.call,'PLAY MID GAME');set('opRemGameCallWhy',carryMap.reason||call.why,'FARM CLEAN · FIGHT WITH SETUP');
    set('opRemDecisionCall',decisionPriority(call.call),'SET UP');
    set('opRemFightWhen',localFightWhen(role,threat,withName,call.call),'YOUR SETUP IS READY');
    set('opRemStopRule',localStopRule(plan,match,threat),'FORCE THE WRONG FIGHT');
    set('opRemThreat',threat,'THEIR ENGAGE');set('opRemThreatAnswer',answer,'TRACK THE ENTRY · STAY BEHIND PEEL');
    renderWinPath(winSteps(plan,role,resource,withName,focus,threat,call.call));
    set('opRemMatchTitle',match.opponent?`${upper(match.you)} VS ${upper(match.opponent)}`:'LANE OPPONENT PENDING');set('opRemMatchEdge',upper(match.edge),'MATCHUP READ');set('opRemLaneDo',upper(match.laneDo),'FARM FIRST');set('opRemTradeWhen',upper(match.tradeWhen),'WHEN KEY SPELL MISSES');set('opRemNever',upper(match.never),'FORCE EVEN ALL-IN');
    set('opRemBehind',upper(plan?.behindPlan),'SAFE WAVES → BUY TIME → WAIT FOR ITEM WINDOW');set('opRemMission',upper(missionFor(state)),'KEEP YOUR CURRENT DEVELOPMENT FOCUS');renderChecks(plan?.checks);
    if(previousPhase&&previousPhase!=='RECORDING')flashLock();previousPhase=phase;
  }

  install();window.opCompanion?.getState?.().then(render).catch(()=>{});window.opCompanion?.onState?.(render);
})();
