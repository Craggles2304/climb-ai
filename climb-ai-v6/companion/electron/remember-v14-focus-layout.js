(()=>{
  const $=id=>document.getElementById(id);
  const STORE='opclimb.deep-locked-plan.v1';
  const TWO_ITEM_CARRIES=new Set(['Aphelios','Jinx',"Kog'Maw",'Smolder','Twitch','Vayne','Zeri',"Kai'Sa",'Xayah','Sivir','Caitlyn','Jhin','Miss Fortune','Tristana']);
  const BASE_BOOT_BY_UPGRADE={
    'ARMORED ADVANCE':{id:3047,name:'Plated Steelcaps'},
    'CHAINLACED CRUSHERS':{id:3111,name:"Mercury's Treads"},
    'GUNMETAL GREAVES':{id:3006,name:"Berserker's Greaves"},
    "SPELLSLINGER'S SHOES":{id:3020,name:"Sorcerer's Shoes"},
    'CRIMSON LUCIDITY':{id:3158,name:'Ionian Boots of Lucidity'},
    'FOREVER FORWARD':{id:3009,name:'Boots of Swiftness'},
  };

  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const upper=value=>clean(value).toUpperCase();
  const role=value=>{const raw=upper(value);if(raw==='BOTTOM')return'ADC';if(raw==='UTILITY')return'SUPPORT';if(raw==='MIDDLE')return'MID';return raw||'UNKNOWN'};
  const clip=(value,max=110)=>{const v=clean(value);if(v.length<=max)return v;const cut=v.slice(0,max-1).replace(/\s+\S*$/,'');return (cut||v.slice(0,max-1))+'…'};
  function stored(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}}

  function installStyle(){
    if($('op-live-focus-layout-style'))return;
    const style=document.createElement('style');style.id='op-live-focus-layout-style';
    style.textContent=[
      'body.op-remember-live .rem4-carry-strip{grid-template-columns:.9fr .8fr 1.2fr!important}',
      'body.op-remember-live .rem4-carry-cell{padding:8px 10px!important;min-height:0!important}',
      'body.op-remember-live .rem4-carry-cell span{font-size:6px!important}',
      'body.op-remember-live .rem4-carry-cell strong{font-size:10px!important;margin-top:4px!important}',
      '.opf-focus{display:grid;gap:8px;margin:10px 0 0;padding:12px;border:1px solid rgba(214,255,47,.22);background:linear-gradient(120deg,rgba(214,255,47,.05),rgba(6,11,15,.76))}',
      '.opf-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.opf-head span{font-size:7px;letter-spacing:.18em;color:#d6ff2f;font-weight:950;text-transform:uppercase}.opf-head small{font-size:6px;letter-spacing:.11em;color:#66747e;text-transform:uppercase}',
      '.opf-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.opf-card{position:relative;min-width:0;border:1px solid rgba(255,255,255,.09);background:rgba(4,8,12,.68);padding:10px 11px}.opf-card.primary{border-color:rgba(214,255,47,.32)}.opf-card.objective{border-color:rgba(100,169,255,.26)}',
      '.opf-card span{display:block;font-size:6px;letter-spacing:.14em;color:#74818b;font-weight:950;text-transform:uppercase}.opf-card.primary span{color:#d6ff2f}.opf-card.objective span{color:#75b3ff}.opf-card strong{display:block;margin-top:5px;font-size:13px;line-height:1.2;color:#f2f6f8;text-transform:uppercase}.opf-card p{margin:5px 0 0;font-size:8px;line-height:1.35;color:#8f9ba4;text-transform:uppercase}',
      '.opf-build{border-top:1px solid rgba(255,255,255,.07);padding-top:8px}.opf-build-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.opf-build-head span{font-size:6px;letter-spacing:.15em;color:#75b3ff;font-weight:950;text-transform:uppercase}.opf-build-head small{font-size:6px;letter-spacing:.1em;color:#66747e;text-transform:uppercase}.opf-build-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:7px}.opf-build-item{display:grid;grid-template-columns:30px minmax(0,1fr);gap:7px;align-items:center;border:1px solid rgba(255,255,255,.08);background:rgba(4,8,12,.6);padding:7px;min-width:0}.opf-build-item img{width:30px;height:30px;object-fit:cover}.opf-build-item span{display:block;font-size:6px;letter-spacing:.1em;color:#70808a;text-transform:uppercase}.opf-build-item strong{display:block;margin-top:2px;font-size:8px;line-height:1.2;color:#edf2f4;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.opf-build-flex{margin-top:6px;padding:6px 8px;border:1px dashed rgba(214,255,47,.2);color:#b3c47a;font-size:7px;line-height:1.35;text-transform:uppercase}.opf-build-read{margin-top:5px;font-size:7px;line-height:1.35;color:#65727b;text-transform:uppercase}.opf-personal{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;border-top:1px solid rgba(255,255,255,.07);padding-top:8px}.opf-personal span{font-size:6px;letter-spacing:.15em;color:#d6ff2f;font-weight:950;text-transform:uppercase;white-space:nowrap}.opf-personal strong{font-size:9px;line-height:1.35;color:#e9eff2;text-transform:uppercase}',
      '#opDeepCoachDrawer{margin:10px 0 0;border:1px solid rgba(100,169,255,.18);background:rgba(4,8,12,.48)}#opDeepCoachDrawer>summary{cursor:pointer;list-style:none;padding:11px 12px;color:#91b9ff;font-size:7px;letter-spacing:.15em;font-weight:950;text-transform:uppercase}#opDeepCoachDrawer>summary::-webkit-details-marker{display:none}#opDeepCoachDrawer>summary:after{content:" +";float:right;color:#d6ff2f}#opDeepCoachDrawer[open]>summary:after{content:" −"}#opDeepCoachBody{padding:0 9px 9px;display:grid;gap:8px}',
      '#opRemFrozenPlaybook{margin-top:10px!important;padding:10px 11px!important;gap:7px!important}.rem5-playbook-head{margin-bottom:0!important}.rem5-playbook-title{font-size:7px!important}',
      '#opRemFrozenPlaybook>.rem5-trap,#opRemFrozenPlaybook>.rem10-strategy{display:none!important}',
      '#opRemFrozenPlaybook .rem5-coach-detail-body>.rem5-trap,#opRemFrozenPlaybook .rem5-coach-detail-body>.rem10-strategy{display:grid!important}',
      '#opRemFrozenPlaybook .rem5-coach-detail>summary{padding:9px 10px!important}',
      '@media(max-width:900px){.opf-grid,.opf-build-grid{grid-template-columns:1fr}.opf-personal{grid-template-columns:1fr}.opf-personal span{white-space:normal}}'
    ].join('');
    document.head.appendChild(style);
  }

  function ensureFocus(){
    const hud=$('opRememberHud');if(!hud)return null;
    let root=$('opLiveFocusDeck');if(root)return root;
    root=document.createElement('section');root.id='opLiveFocusDeck';root.className='opf-focus';
    root.innerHTML=[
      '<div class="opf-head"><span>YOUR 3 GAME TARGETS</span><small>MEASURABLE · READ ONCE · PLAY</small></div>',
      '<div class="opf-grid">',
      '<article class="opf-card primary"><span>FARM / RESOURCE MISSION</span><strong id="opfFarm">BUILDING TARGET</strong><p id="opfFarmWhy">ONE NUMBER TO CHASE THIS GAME.</p></article>',
      '<article class="opf-card"><span>YOUR POWER SPIKE</span><strong id="opfSpike">BUILDING SPIKE</strong><p id="opfSpikeWhy">THE POINT WHERE YOUR FIGHT GETS STRONGER.</p></article>',
      '<article class="opf-card objective"><span>OBJECTIVE MISSION</span><strong id="opfObjective">SET UP EARLY</strong><p id="opfObjectiveWhy">BE READY BEFORE THE FIGHT STARTS.</p></article>',
      '</div>',
      '<div class="opf-build"><div class="opf-build-head"><span>BUILD</span><small>CURRENT PATCH · DRAFT-AWARE</small></div><div id="opfBuildGrid" class="opf-build-grid"></div><div id="opfBuildFlex" class="opf-build-flex"></div><div id="opfBuildRead" class="opf-build-read"></div></div>',
      '<div class="opf-personal"><span>PERSONAL CLIMB MISSION</span><strong id="opfPersonal">EXECUTE THE FROZEN GAME PLAN.</strong></div>'
    ].join('');
    const path=hud.querySelector('.rem4-path-wrap');
    if(path)path.insertAdjacentElement('afterend',root);
    else{
      const lane=hud.querySelector('.rem4-lane');
      if(lane)lane.insertAdjacentElement('beforebegin',root);
      else hud.querySelector('.rem4-body')?.appendChild(root);
    }
    return root;
  }

  function ensureDeepDrawer(){
    const hud=$('opRememberHud');if(!hud)return null;
    let drawer=$('opDeepCoachDrawer');
    if(!drawer){
      drawer=document.createElement('details');drawer.id='opDeepCoachDrawer';
      drawer.innerHTML='<summary>DEEP COACH · WHY / MEMORY / EVIDENCE / LEARNING</summary><div id="opDeepCoachBody"></div>';
      const frozen=$('opRemFrozenPlaybook');
      if(frozen)frozen.insertAdjacentElement('afterend',drawer);
      else hud.querySelector('.rem4-body')?.appendChild(drawer);
    }
    return drawer;
  }

  function compactFrozenPlaybook(){
    const panel=$('opRemFrozenPlaybook');if(!panel)return;
    const detail=panel.querySelector('.rem5-coach-detail');
    const body=detail?.querySelector('.rem5-coach-detail-body');
    if(body){
      const summary=detail.querySelector('summary');
      // Only write when it differs: this runs inside a MutationObserver, and a
      // write (even of identical text) is a page change that re-triggers it.
      if(summary&&summary.textContent!=='DEEP COACH · WHY THIS FITS YOU')summary.textContent='DEEP COACH · WHY THIS FITS YOU';
      ['opRemPersonalTrap','opRemStrategy','opRemCausalRoute','opRemExperiment'].forEach(id=>{
        const node=$(id);if(node&&node.parentElement===panel)body.prepend(node);
      });
    }
  }

  function collectDeepSections(){
    const drawer=ensureDeepDrawer();const body=$('opDeepCoachBody');if(!drawer||!body)return;
    const ids=['opMatchOs','opPlayerCoachingIdentity','opAdaptiveCoachingSession','opLearningVelocity','opSkillTransferGraph','opDecisionPrinciple'];
    ids.forEach(id=>{const node=$(id);if(node&&node.parentElement!==body)body.appendChild(node)});
  }

  function farmTarget(state,data){
    const r=role(state?.matchup?.role||data?.role);
    const target=state?.teamPlan?.rememberPlan?.resourceTarget||data?.resourceTarget||null;
    const headline=upper(target?.headline);
    const summary=upper(target?.summary);
    const at15=summary.match(/(\d{2,3})\s*@\s*15/);
    if(r==='SUPPORT')return{head:'VISION READY BEFORE DRAKE',why:'RESET + REFILL WARDS BEFORE THE OBJECTIVE SETUP.'};
    if(at15)return{head:at15[1]+' CS BY 15',why:headline?headline+' · '+summary:summary};
    if(r==='JUNGLE')return{head:'95 CS BY 15',why:'CLEAR TOWARD THE NEXT OBJECTIVE · SKIP LOW-VALUE CROSS-MAP DETOURS.'};
    return{head:'90+ CS BY 15',why:'USE THIS AS THE FLOOR UNLESS OBJECTIVE SETUP CORRECTLY COSTS A WAVE.'};
  }

  function powerSpike(state,data){
    const champ=clean(state?.matchup?.champion||state?.matchup?.plan?.you?.name||data?.champion);
    const r=role(state?.matchup?.role||state?.matchup?.plan?.role||data?.role);
    const spikes=Array.isArray(state?.matchup?.plan?.powerSpikes)?state.matchup.plan.powerSpikes:Array.isArray(data?.powerSpikes)?data.powerSpikes:[];
    const major=spikes.find(item=>Number(item?.level)>=6)||spikes.find(item=>Number(item?.level)>=3)||null;
    if(r==='ADC'&&TWO_ITEM_CARRIES.has(champ)){
      return{head:'2 COMPLETED ITEMS',why:(major?('ALSO: LV '+String(major.level)+' · '+upper(major.label||'CHAMPION POWER')):'')||'THIS IS YOUR FIRST BIG TEAMFIGHT DAMAGE WINDOW.'};
    }
    if(major)return{head:'LV '+String(major.level)+' · '+upper(major.label||'POWER WINDOW'),why:clip(upper(major.fight||major.createLead||'USE THE LEVEL BEFORE THE ENEMY CAN ANSWER IT.'),105)};
    return{head:r==='SUPPORT'?'LV 6 · ULTIMATE WINDOW':'FIRST COMPLETED ITEM',why:'SPEND YOUR GOLD BEFORE THE NEXT VOLUNTARY FIGHT.'};
  }

  function objectiveMission(state,data){
    const r=role(state?.matchup?.role||state?.matchup?.plan?.role||data?.role);
    if(r==='JUNGLE')return{head:'RESET 60S BEFORE DRAGON',why:'BE MOVING TO RIVER BY 40S · KEEP SMITE READY.'};
    if(r==='SUPPORT')return{head:'VISION DOWN 45S BEFORE',why:'RESET / REFILL FIRST · MOVE WITH JUNGLE · DO NOT FACE-CHECK ALONE.'};
    if(r==='TOP')return{head:'DECIDE JOIN OR SIDE BY 60S',why:'DO NOT MAKE THE TELEPORT / SIDE-LANE DECISION AFTER THE FIGHT STARTS.'};
    return{head:'LEAVE FARM 45S BEFORE',why:'BE WITH YOUR TEAM ABOUT 20S BEFORE DRAGON · DO NOT START ANOTHER LONG WAVE.'};
  }

  function personalMission(state,data){
    const mission=data?.climbMission||state?.teamPlan?.climbMission||null;
    const intervention=data?.coachIntervention||null;
    if(intervention?.primaryCue)return clip(upper(intervention.primaryCue),135);
    if(mission?.status==='READY')return clip(upper(mission.action||mission.cue||mission.trigger),135);
    const existing=clean($('opRemMission')?.textContent);
    return existing?clip(upper(existing),135):'ONE GAME · ONE FOCUS · LET THE POST-GAME REVIEW SCORE IT.';
  }

  function normaliseBoot(item){
    if(!item)return null;
    const replacement=BASE_BOOT_BY_UPGRADE[upper(item?.name)];
    return replacement?{...item,id:replacement.id,name:replacement.name,slot:'BOOTS',why:'Buy the standard tier-2 boot first; the upgrade is conditional later.'}:item;
  }

  function flexIsRelevant(build,item){
    if(!item)return false;
    const profile=build?.enemyProfile||{};
    const flags=new Set(Array.isArray(item?.flags)?item.flags:[]);
    const name=upper(item?.name);
    if(name.includes('MAW OF MALMORTIUS')){
      const magic=Number(profile?.magicThreat)||0,physical=Number(profile?.physicalThreat)||0;
      return magic>=2.5&&magic>=physical*.8;
    }
    if(flags.has('CLEANSE'))return Number(profile?.suppressions)>=1||Number(profile?.cleanseableCc)>=3;
    if(flags.has('ANTI_TANK'))return Number(profile?.tanks)>=2;
    if(flags.has('ANTI_HEAL'))return Number(profile?.healing)>=2;
    if(flags.has('ANTI_SHIELD'))return Number(profile?.shielding)>=2;
    return true;
  }

  function renderBuild(state,data){
    const live=state?.teamPlan?.adaptiveBuild||null;
    const frozen=state?.teamPlan?.rememberPlan?.adaptiveBuild||null;
    const build=live||frozen||data?.adaptiveBuild||null;
    const grid=$('opfBuildGrid'),read=$('opfBuildRead'),flex=$('opfBuildFlex');if(!grid)return;

    const core=Array.isArray(build?.core)?build.core.slice(0,2):[];
    const boot=normaliseBoot(build?.boots||null);
    const finish=build?.finish||null;
    const items=[...core,boot,finish].filter(Boolean);
    const flexItem=flexIsRelevant(build,build?.draftItem)?build.draftItem:null;
    const signature=items.map(item=>String(item?.id||'')+':'+String(item?.slot||'')).join('|')+'#'+String(flexItem?.id||'')+'#'+String(build?.read||'');
    if(grid.dataset.signature===signature)return;
    grid.dataset.signature=signature;
    grid.replaceChildren();

    if(!items.length){
      const empty=document.createElement('div');empty.className='opf-build-item';
      empty.innerHTML='<div></div><div><span>BUILD</span><strong>WAITING FOR CURRENT PLAN</strong></div>';
      grid.appendChild(empty);
      if(flex)flex.textContent='NO TECH DECISION YET';
      if(read)read.textContent='BUILD LOCKS FROM CURRENT-PATCH CHAMP SELECT DATA.';
      return;
    }

    let coreIndex=0;
    items.forEach(item=>{
      const card=document.createElement('article');card.className='opf-build-item';card.title=clean(item?.why);
      const img=document.createElement('img');img.alt='';img.src='https://ddragon.leagueoflegends.com/cdn/'+encodeURIComponent(String(build?.patch||''))+'/img/item/'+String(item?.id)+'.png';
      const copy=document.createElement('div');
      const label=document.createElement('span');
      if(item?.slot==='CORE'){coreIndex+=1;label.textContent='CORE '+String(coreIndex)}
      else if(item?.slot==='BOOTS')label.textContent='BOOTS';
      else if(item?.slot==='FINISH')label.textContent='NEXT';
      else label.textContent=upper(item?.slot||'ITEM');
      const name=document.createElement('strong');name.textContent=upper(item?.name||'ITEM');
      copy.append(label,name);card.append(img,copy);grid.appendChild(card);
    });

    if(flex){
      flex.textContent=flexItem
        ?'FLEX IF NEEDED · '+upper(flexItem?.name)+' — '+clip(upper(flexItem?.why),95)
        :'NO FORCED TECH ITEM · KEEP THE CORE PATH';
    }
    if(read){
      const source=clean(build?.read).match(/CORE · ([^·]+)/i)?.[1]?.trim();
      read.textContent=(source?'CORE DATA · '+upper(source):'CURRENT-PATCH CORE')+' · TECH IS CONDITIONAL, NOT A FIXED THIRD ITEM';
    }
  }

  function replaceVagueSpikeCopy(spike){
    const replacement=upper(spike?.head);
    if(!replacement)return;
    ['opRemCarryPlay','opMatchOsJob','opMatchOsNow'].forEach(id=>{
      const node=$(id);if(!node)return;
      const current=clean(node.textContent);
      if(/YOUR SPIKE/i.test(current))node.textContent=current.replace(/YOUR SPIKE/gi,replacement);
    });
  }

  function render(state){
    installStyle();ensureFocus();compactFrozenPlaybook();collectDeepSections();
    const data=stored()||{};
    const farm=farmTarget(state,data),spike=powerSpike(state,data),objective=objectiveMission(state,data);
    const put=(id,value)=>{const node=$(id);const next=upper(value);if(node&&next&&upper(node.textContent)!==next)node.textContent=next};
    put('opfFarm',farm.head);put('opfFarmWhy',farm.why);
    put('opfSpike',spike.head);put('opfSpikeWhy',spike.why);
    put('opfObjective',objective.head);put('opfObjectiveWhy',objective.why);
    put('opfPersonal',personalMission(state,data));
    renderBuild(state,data);
    replaceVagueSpikeCopy(spike);
  }

  let lastState=null;
  const observer=new MutationObserver(()=>{if(document.body.classList.contains('op-remember-live'))render(lastState)});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.opCompanion?.getState?.().then(state=>{lastState=state;render(state)}).catch(()=>render(null));
  window.opCompanion?.onState?.(state=>{lastState=state;render(state)});
})();
