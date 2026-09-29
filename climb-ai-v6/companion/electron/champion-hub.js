(()=>{
  const $=id=>document.getElementById(id);
  const STORAGE_KEY='op-climb-champion-hub-v1';
  const assetHost='https://ddragon.leagueoflegends.com/';
  const roles=new Set(['TOP','JUNGLE','MID','ADC','SUPPORT']);
  let selection={champion:'',role:'MID'};
  let roster=[];
  let loadedKey='';
  let loadingKey='';
  let requestId=0;
  let rosterRequested=false;

  function clean(value){return String(value||'').replace(/\s+/g,' ').trim()}
  function readSelection(){
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      return{champion:clean(saved.champion).slice(0,32),role:roles.has(saved.role)?saved.role:'MID'};
    }catch{return{champion:'',role:'MID'}}
  }
  function saveSelection(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(selection))}catch{}}
  function safeImage(url){
    try{const parsed=new URL(String(url||''));return parsed.href.startsWith(assetHost)?parsed.href:''}catch{return''}
  }
  function message(copy){$('hubNotice').textContent=copy}
  function empty(node,copy){node.replaceChildren();const small=document.createElement('small');small.textContent=copy;small.className='hub-unavailable';node.appendChild(small)}
  function iconRow(root,values){
    root.replaceChildren();
    const rows=Array.isArray(values)?values.filter(Boolean):[];
    if(!rows.length){empty(root,'Current setup unavailable');return}
    for(const row of rows){
      const item=document.createElement('div');item.className='hub-icon';item.title=clean(row.name);
      const src=safeImage(row.icon);
      if(src){const image=document.createElement('img');image.src=src;image.alt='';item.appendChild(image)}
      const label=document.createElement('small');label.textContent=clean(row.name)||'Item';item.appendChild(label);root.appendChild(item);
    }
  }
  function renderBuild(build){
    const root=$('hubBuildItems');root.replaceChildren();
    const items=Array.isArray(build?.items)?build.items.slice(0,6):[];
    if(!items.length)empty(root,'Current build data is unavailable for this champion and role.');
    for(const item of items){
      const card=document.createElement('div');card.className='hub-build-item';
      const src=safeImage(item.icon);
      if(src){const image=document.createElement('img');image.src=src;image.alt='';card.appendChild(image)}
      const name=document.createElement('strong');name.textContent=clean(item.name)||'Item';card.appendChild(name);root.appendChild(card);
    }
    $('hubBuildSource').textContent=build?.ok?`${clean(build.source||'CURRENT DATA')} · PATCH ${clean(build.patch||'—')} · ${clean(build.lane||selection.role)}`:'CURRENT BUILD UNAVAILABLE';
    $('hubBuildNote').textContent=build?.ok?clean(build.note)||'Use this as a starting build. Your draft plan will account for the enemy team.':'';
  }
  function renderPlan(profile){
    const lane=$('hubLanePlan');lane.replaceChildren();
    const steps=Array.isArray(profile?.lanePlan)?profile.lanePlan.slice(0,3):[];
    if(!steps.length)empty(lane,'Champion plan unavailable.');
    for(const [index,step] of steps.entries()){
      const row=document.createElement('li');const number=document.createElement('b');number.textContent=String(index+1).padStart(2,'0');const copy=document.createElement('p');copy.textContent=clean(step);row.append(number,copy);lane.appendChild(row);
    }
    const spikes=$('hubSpikes');spikes.replaceChildren();
    const powers=Array.isArray(profile?.spikes)?profile.spikes.slice(0,4):[];
    if(!powers.length)empty(spikes,'Power spikes unavailable.');
    for(const spike of powers){
      const row=document.createElement('div');row.className='hub-spike';
      const level=document.createElement('b');level.textContent=`LV ${spike.level}`;
      const copy=document.createElement('span');copy.textContent=clean(spike.title).replace(/^Level \d+\s*[—–-]\s*/,'');
      row.append(level,copy);spikes.appendChild(row);
    }
  }
  function renderGuide(guide){
    const profile=guide.profile?.profile||null;
    const meta=guide.meta||null;
    const name=clean(profile?.name)||guide.champion;
    $('hubName').textContent=name.toUpperCase();
    $('hubIdentity').textContent=[clean(profile?.title),Array.isArray(profile?.tags)?profile.tags.join(' / '):'',guide.role].filter(Boolean).join(' · ')||'Your champion, your setup.';
    $('hubPatch').textContent=`YOUR MAIN · RIOT PATCH ${clean(guide.profile?.patch||meta?.patch||guide.build?.patch||'—')}`;
    const id=clean(profile?.id).replace(/[^A-Za-z0-9]/g,'');
    if(id)$('hubSplash').src=`${assetHost}cdn/img/champion/splash/${id}_0.jpg`;
    else $('hubSplash').removeAttribute('src');
    iconRow($('hubRunes'),meta?.runePage?.perks?.slice(0,6));
    iconRow($('hubSummoners'),meta?.summoners?.slice(0,2));
    iconRow($('hubStarters'),meta?.starters?.slice(0,3));
    $('hubRuneSource').textContent=meta?.ok?`${clean(meta.source||'CURRENT DATA')} · ${guide.role} · PATCH ${clean(meta.patch||'—')}`:'Rune data is temporarily unavailable.';
    const skills=Array.isArray(meta?.skillPriority)?meta.skillPriority:[];
    $('hubSkills').textContent=skills.length?skills.join(' → '):'—';
    $('hubSkillNote').textContent=skills.length?'Level these skills first when possible.':'Current skill order unavailable.';
    renderBuild(guide.build);
    renderPlan(profile);
    $('hubContent').classList.remove('hidden');
    const missing=[!profile&&'champion plan',!meta&&'runes',!guide.build&&'build'].filter(Boolean);
    message(missing.length?`${name} is ready. ${missing.join(', ')} ${missing.length===1?'is':'are'} temporarily unavailable.`:`${name} is ready. This page stays here until champion select starts.`);
  }
  async function loadGuide(refresh=false){
    const champion=selection.champion;
    if(!champion){$('hubContent').classList.add('hidden');message('Choose a champion to load your page.');return}
    const key=`${champion.toLowerCase()}|${selection.role}`;
    if(!refresh&&(loadedKey===key||loadingKey===key))return;
    const ownRequest=++requestId;
    loadingKey=key;
    message(`Loading ${champion} builds, runes and champion plan…`);
    $('hubChoose').disabled=true;
    try{
      const guide=await window.opCompanion.getChampionGuide({...selection,refresh});
      if(ownRequest!==requestId)return;
      if(!guide?.ok){$('hubContent').classList.add('hidden');message(guide?.error||'Could not load this champion. Try again.');return}
      loadedKey=key;
      renderGuide(guide);
    }catch{
      if(ownRequest===requestId)message('Could not reach champion data. Try again shortly.');
    }finally{if(ownRequest===requestId){loadingKey='';$('hubChoose').disabled=false}}
  }
  async function loadRoster(){
    if(rosterRequested)return;
    rosterRequested=true;
    try{
      const result=await window.opCompanion.getChampionRoster();
      if(!result?.ok)return;
      roster=result.names||[];
      const list=$('hubChampionList');list.replaceChildren();
      for(const name of roster){const option=document.createElement('option');option.value=name;list.appendChild(option)}
    }catch{}
  }
  function showForState(state){
    const visible=Boolean(state?.paired&&state.phase==='WAITING');
    $('championHub').classList.toggle('hidden',!visible);
    if(visible){void loadRoster();if(selection.champion)void loadGuide()}
  }
  function choose(){
    const typed=clean($('hubChampion').value);
    const champion=roster.find(name=>name.toLowerCase()===typed.toLowerCase())||typed;
    if(!champion||champion.length>32){message('Choose a champion from the list first.');return}
    selection={champion,role:$('hubRole').value};
    saveSelection();loadedKey='';
    void loadGuide();
  }
  selection=readSelection();
  $('hubChampion').value=selection.champion;
  $('hubRole').value=selection.role;
  $('hubChoose').addEventListener('click',choose);
  $('hubChampion').addEventListener('keydown',event=>{if(event.key==='Enter')choose()});
  $('hubRole').addEventListener('change',()=>{if(selection.champion){selection.role=$('hubRole').value;saveSelection();loadedKey='';void loadGuide()}});
  $('hubRefresh').addEventListener('click',()=>void loadGuide(true));
  $('hubOpenWeb').addEventListener('click',()=>window.opCompanion.openClimbPath('/champions/main'));
  window.opCompanion.getState().then(showForState).catch(()=>{});
  window.opCompanion.onState(showForState);
})();
