(()=>{
  const STORE='opclimb.deep-locked-plan.v1';
  const CHECKPOINTS=[5,10,15];
  const STATE_OPTIONS=['AHEAD','EVEN','BEHIND'];
  const CONFIDENCE_OPTIONS=['HIGH','MEDIUM','LOW'];
  const PRIORITY_OPTIONS=['FIGHT','RESET','FARM','OBJECTIVE SETUP','STABILISE'];
  let latest={contract:null,gameTime:0,phase:'',selectedBranch:'EVEN'};
  let stateRead='',confidenceRead='',priorityRead='',saving=false;

  const $=id=>document.getElementById(id);
  const upper=value=>String(value??'').trim().toUpperCase();

  function load(){
    try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}
  }
  function saveLocal(read){
    const stored=load();if(!stored)return null;
    const existing=Array.isArray(stored.readCheckpoints)?stored.readCheckpoints.filter(item=>Number(item?.checkpointMinute)!==Number(read.checkpointMinute)):[];
    stored.readCheckpoints=[...existing,read].sort((a,b)=>Number(a.checkpointMinute)-Number(b.checkpointMinute)).slice(-6);
    stored.updatedAt=new Date().toISOString();
    try{localStorage.setItem(STORE,JSON.stringify(stored));return stored}catch{return null}
  }
  function reads(){return Array.isArray(load()?.readCheckpoints)?load().readCheckpoints:[]}
  function answered(minute){return reads().some(item=>Number(item?.checkpointMinute)===Number(minute))}
  function due(seconds){
    const t=Math.max(0,Number(seconds)||0);
    return CHECKPOINTS.find(minute=>t>=minute*60&&t<minute*60+120&&!answered(minute))||null;
  }
  function install(){
    if($('opReadCheckpoint'))return $('opReadCheckpoint');
    const body=$('opMatchOsBody');if(!body)return null;
    const style=document.createElement('style');
    style.id='op-read-checkpoint-style';
    style.textContent=[
      '.readcheck{display:none;padding:14px 18px 15px 21px;border-bottom:1px solid rgba(255,255,255,.08);background:linear-gradient(90deg,rgba(100,169,255,.08),rgba(214,255,47,.025));}',
      '.readcheck.active{display:block}.readcheck-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.readcheck-head span{display:block;font-size:7px;letter-spacing:.16em;font-weight:950;color:#64a9ff}.readcheck-head strong{display:block;margin-top:4px;font-size:14px;color:#fff}.readcheck-head small{font-size:8px;color:#7f8d96;letter-spacing:.08em}',
      '.readcheck-grid{display:grid;grid-template-columns:1fr .8fr 1.2fr;gap:10px;margin-top:11px}.readcheck-q{border:1px solid rgba(255,255,255,.08);background:rgba(3,8,12,.72);padding:10px}.readcheck-q>span{display:block;font-size:7px;letter-spacing:.13em;color:#85939c;font-weight:900;margin-bottom:7px}',
      '.readcheck-options{display:flex;gap:5px;flex-wrap:wrap}.readcheck-btn{appearance:none;border:1px solid rgba(255,255,255,.12);background:#071019;color:#aab6bd;padding:7px 9px;font:900 8px/1.2 system-ui;letter-spacing:.06em;cursor:pointer}.readcheck-btn:hover{border-color:rgba(100,169,255,.55)}.readcheck-btn.selected{border-color:#d6ff2f;background:rgba(214,255,47,.08);color:#eaff8d}',
      '.readcheck-foot{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:10px}.readcheck-foot p{margin:0;font-size:8px;color:#78858d;line-height:1.4}.readcheck-save{appearance:none;border:1px solid #d6ff2f;background:#d6ff2f;color:#07100c;padding:9px 12px;font:950 8px/1 system-ui;letter-spacing:.1em;cursor:pointer}.readcheck-save:disabled{opacity:.35;cursor:not-allowed}.readcheck-status{font-size:8px;color:#d6ff2f;font-weight:900;letter-spacing:.08em}',
      '@media(max-width:900px){.readcheck-grid{grid-template-columns:1fr}}'
    ].join('');
    document.head.appendChild(style);
    const root=document.createElement('section');
    root.id='opReadCheckpoint';root.className='readcheck';
    root.innerHTML=[
      '<div class="readcheck-head"><div><span>LIVE READ CHECK · NO ANSWER REVEALED</span><strong id="opReadCheckTitle">FREEZE YOUR OWN READ</strong></div><small id="opReadCheckClock"></small></div>',
      '<div class="readcheck-grid">',
      '<div class="readcheck-q"><span>1 · WHAT STATE ARE WE IN?</span><div id="opReadStateOptions" class="readcheck-options"></div></div>',
      '<div class="readcheck-q"><span>2 · HOW SURE ARE YOU?</span><div id="opReadConfidenceOptions" class="readcheck-options"></div></div>',
      '<div class="readcheck-q"><span>3 · WHAT IS YOUR NEXT PRIORITY?</span><div id="opReadPriorityOptions" class="readcheck-options"></div></div>',
      '</div>',
      '<div class="readcheck-foot"><p>THIS READ IS FROZEN BEFORE POST-GAME EVIDENCE. OP CLIMB WILL SCORE GAME-STATE CALIBRATION LATER.</p><div><span id="opReadCheckStatus" class="readcheck-status"></span><button id="opReadCheckSave" class="readcheck-save" disabled>LOCK MY READ</button></div></div>'
    ].join('');
    const branch=document.querySelector('#opMatchOs .matchos-branch');
    if(branch?.parentNode)branch.parentNode.insertBefore(root,branch);else body.appendChild(root);
    buildOptions('opReadStateOptions',STATE_OPTIONS,'state');
    buildOptions('opReadConfidenceOptions',CONFIDENCE_OPTIONS,'confidence');
    buildOptions('opReadPriorityOptions',PRIORITY_OPTIONS,'priority');
    $('opReadCheckSave')?.addEventListener('click',()=>void submit());
    return root;
  }
  function buildOptions(id,options,kind){
    const root=$(id);if(!root)return;
    root.replaceChildren(...options.map(value=>{
      const button=document.createElement('button');
      button.type='button';button.className='readcheck-btn';button.textContent=value;
      button.dataset.kind=kind;button.dataset.value=value;
      button.addEventListener('click',()=>select(kind,value));
      return button;
    }));
  }
  function select(kind,value){
    if(kind==='state')stateRead=value;
    if(kind==='confidence')confidenceRead=value;
    if(kind==='priority')priorityRead=value;
    document.querySelectorAll('.readcheck-btn').forEach(button=>{
      const active=(button.dataset.kind==='state'&&button.dataset.value===stateRead)||(button.dataset.kind==='confidence'&&button.dataset.value===confidenceRead)||(button.dataset.kind==='priority'&&button.dataset.value===priorityRead);
      button.classList.toggle('selected',active);
    });
    const save=$('opReadCheckSave');if(save)save.disabled=!(stateRead&&confidenceRead&&priorityRead)||saving;
  }
  function resetChoices(){stateRead='';confidenceRead='';priorityRead='';document.querySelectorAll('.readcheck-btn').forEach(button=>button.classList.remove('selected'))}
  async function submit(){
    const minute=due(latest.gameTime);if(!minute||!stateRead||!confidenceRead||!priorityRead||saving)return;
    saving=true;const save=$('opReadCheckSave');if(save)save.disabled=true;
    const read={checkpointMinute:minute,gameSeconds:Number(latest.gameTime)||minute*60,stateRead,confidenceRead,threatRead:null,priorityRead,createdAt:new Date().toISOString(),source:'PLAYER_CHECKPOINT',serverSynced:false};
    saveLocal(read);
    const legacy=document.querySelector('[data-op-branch="'+stateRead+'"]');if(legacy instanceof HTMLElement)legacy.click();
    let synced=false;
    try{
      const result=await window.opCompanion?.recordReadCheckpoint?.(read);
      synced=Boolean(result?.ok);
    }catch{}
    if(synced){
      const stored=load();if(stored&&Array.isArray(stored.readCheckpoints)){
        stored.readCheckpoints=stored.readCheckpoints.map(item=>Number(item?.checkpointMinute)===minute?{...item,serverSynced:true}:item);
        try{localStorage.setItem(STORE,JSON.stringify(stored))}catch{}
      }
    }
    const status=$('opReadCheckStatus');if(status)status.textContent=synced?'READ LOCKED · SERVER VERIFIED':'READ LOCKED · LOCAL COPY SAVED';
    saving=false;resetChoices();render(latest);
  }
  async function syncPending(){
    const stored=load();if(!stored||!Array.isArray(stored.readCheckpoints))return;
    let changed=false;
    for(const read of stored.readCheckpoints.filter(item=>!item?.serverSynced)){
      try{
        const result=await window.opCompanion?.recordReadCheckpoint?.(read);
        if(result?.ok){read.serverSynced=true;changed=true}
      }catch{}
    }
    if(changed)try{localStorage.setItem(STORE,JSON.stringify(stored))}catch{}
  }
  function render(detail){
    install();latest={...latest,...(detail||{})};
    const root=$('opReadCheckpoint');if(!root)return;
    if(latest.phase==='RECORDING')void syncPending();
    const minute=latest.phase==='RECORDING'?due(latest.gameTime):null;
    root.classList.toggle('active',Boolean(minute));
    if(!minute)return;
    $('opReadCheckTitle').textContent=minute+' MIN · FREEZE YOUR OWN GAME READ';
    $('opReadCheckClock').textContent='WINDOW '+minute+':00–'+(minute+2)+':00';
    const status=$('opReadCheckStatus');if(status)status.textContent='';

  }
  install();
  window.addEventListener('op-climb-match-os',event=>render(event.detail||{}));
})();