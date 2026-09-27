const $=id=>document.getElementById(id);
let current=null;
let compact=false;
const safe=v=>String(v??'').replace(/\s+/g,' ').trim();
const one=(v,n=120)=>{const t=safe(Array.isArray(v)?v.find(Boolean):v);return t.length>n?t.slice(0,n-1).replace(/\s+\S*$/,'')+'…':t};
const hide=(id,value)=>$(id)?.classList.toggle('hidden',Boolean(value));
function phaseLabel(phase){return({SETUP:'SETUP',STARTING:'STARTING',WAITING:'READY',CHAMP_SELECT:'CHAMP SELECT',RECORDING:'IN GAME',UPLOADING:'PROCESSING',REVIEW:'REVIEW READY',RESTARTING:'RESTARTING',AUTH_ERROR:'RECONNECT',ERROR:'ERROR'})[phase]||phase||'READY'}
function buildData(state){return state?.teamPlan?.adaptiveBuild||state?.teamPlan?.rememberPlan?.adaptiveBuild||null}
function pathsFor(build){
  if(Array.isArray(build?.paths)&&build.paths.length)return build.paths;
  const fallback=[...(Array.isArray(build?.core)?build.core:[]),build?.draftItem,build?.finish,build?.boots].filter(Boolean);
  return fallback.length?[{key:'STANDARD',label:'STANDARD',reason:build?.read||'Draft-fit build.',items:fallback}]:[];
}
function itemIcon(build,item){return 'https://ddragon.leagueoflegends.com/cdn/'+encodeURIComponent(String(build?.patch||''))+'/img/item/'+String(item?.id)+'.png'}
function renderPaths(targetId,build){
  const root=$(targetId);if(!root)return;root.replaceChildren();
  for(const [index,path] of pathsFor(build).entries()){
    const card=document.createElement('article');card.className='build-path'+(index===0?' active':'');
    const head=document.createElement('div');head.className='path-head';
    const title=document.createElement('b');title.textContent=safe(path?.label||path?.key||'PATH').toUpperCase();
    const count=document.createElement('small');count.textContent=(path?.items?.length||0)+' ITEMS';
    head.append(title,count);
    const items=document.createElement('div');items.className='items';
    for(const item of (path?.items||[]).slice(0,5)){
      const slot=document.createElement('div');slot.className='item';slot.title=safe(item?.why);
      const img=document.createElement('img');img.alt=safe(item?.name);img.src=itemIcon(build,item);
      const label=document.createElement('em');label.textContent=safe(item?.name).toUpperCase();
      slot.append(img,label);items.appendChild(slot);
    }
    const reason=document.createElement('div');reason.className='path-reason';reason.textContent=one(path?.reason||'',120).toUpperCase();
    card.append(head,items,reason);root.appendChild(card);
  }
}
function missionCue(state){return one(state?.teamPlan?.missionTips?.[0]?.cue||state?.teamPlan?.rememberPlan?.missionCue||'STAY WITH YOUR CURRENT DEVELOPMENT FOCUS',120)}
function winCondition(state){return one(state?.teamPlan?.ourWinCondition||state?.teamPlan?.roleWinCondition?.title||state?.teamPlan?.rememberPlan?.ourWinCondition||'BUILD THE FIRST CLEAN ADVANTAGE, THEN CONVERT IT.',150)}
function dangerCue(state){return one(state?.teamPlan?.roleWinCondition?.lossCondition||state?.teamPlan?.theirWinCondition||state?.teamPlan?.biggestThrow||'DO NOT GIVE THEM THEIR CLEANEST ENGAGE.',150)}
function championLabel(state){const champ=safe(state?.matchup?.champion||state?.matchup?.plan?.you?.name||'YOUR');const role=safe(state?.matchup?.role||state?.matchup?.plan?.role);return (champ+(role?' · '+role:'')).toUpperCase()}
function render(state){
  current=state||{};const phase=safe(current.phase||'WAITING').toUpperCase();
  $('stateLabel').textContent=phaseLabel(phase);
  $('statusDetail').textContent=one(current.detail||'',120)||'Companion is running.';
  $('healthText').textContent=current.trackerRunning?'TRACKER HEALTHY':'TRACKER CHECKING';
  $('healthDot').style.background=(phase==='ERROR'||phase==='AUTH_ERROR')?'#ff8585':phase==='UPLOADING'?'#70b7ff':'#d6ff2f';
  $('diagPair').textContent=current.paired?'OK':'NEEDS PAIRING';
  $('diagTracker').textContent=current.trackerRunning?'READY':'CHECKING';

  const pre=phase==='CHAMP_SELECT',game=phase==='RECORDING',review=phase==='REVIEW',off=!pre&&!game&&!review;
  hide('pregame',!pre);hide('ingame',!game);hide('review',!review);hide('offline',!off);
  const build=buildData(current);
  if(pre){
    $('championTitle').textContent=championLabel(current);
    const enemy=(current?.teamPlan?.theirTeam||current?.draft?.enemies||[]).map(x=>safe(x?.name||x?.championName)).filter(Boolean);
    $('draftRead').textContent=enemy.length?'VS '+enemy.join(' · ').toUpperCase():'ENEMY DRAFT FORMING';
    $('missionCue').textContent=missionCue(current);
    $('winCondition').textContent=winCondition(current);
    $('dangerCue').textContent=dangerCue(current);
    $('patchLabel').textContent=build?.patch?('PATCH '+build.patch):'CURRENT PATCH';
    $('buildRead').textContent=one(build?.read||build?.boundary||'',150).toUpperCase();
    renderPaths('buildPaths',build);
    hide('buildSection',!pathsFor(build).length);
  }
  if(game){
    $('ingameChampion').textContent=championLabel(current);
    $('ingameMission').textContent=missionCue(current);
    $('ingameReminder').textContent=winCondition(current);
    renderPaths('ingamePaths',build);
    hide('ingameBuild',!pathsFor(build).length);
  }
  if(review){
    $('reviewText').textContent=one(current?.postGameReview?.headline||current?.detail||'Your coaching review is ready.',150);
  }
  if(off){
    $('offlineTitle').textContent=phase==='AUTH_ERROR'?'RECONNECT THIS PC':phase==='ERROR'?'COMPANION NEEDS ATTENTION':'READY FOR LEAGUE';
    $('offlineText').textContent=one(current.detail||'Open League. OP CLIMB will detect champ select automatically.',160);
  }
}
async function flashMarked(){
  const toast=$('markToast');toast?.classList.remove('hidden');setTimeout(()=>toast?.classList.add('hidden'),1600);
}
$('markBtn')?.addEventListener('click',async()=>{const r=await window.opCompanion.markMoment();if(r?.ok)flashMarked()});
$('openBtn')?.addEventListener('click',()=>window.opCompanion.openWindow());
$('reviewBtn')?.addEventListener('click',()=>window.opCompanion.openWindow());
$('repairBtn')?.addEventListener('click',async()=>{await window.opCompanion.restart();});
$('clickBtn')?.addEventListener('click',async()=>{const r=await window.opCompanion.toggleClickThrough();$('clickBtn').textContent=r?.enabled?'◉':'◎'});
$('compactBtn')?.addEventListener('click',()=>{compact=!compact;$('hud').classList.toggle('compact',compact);$('compactBtn').textContent=compact?'+':'−'});
window.opCompanion.getState().then(render).catch(()=>{});
window.opCompanion.onState(render);
