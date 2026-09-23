(()=>{
  const $=id=>document.getElementById(id);
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const upper=value=>clean(value).toUpperCase();
  const STORE='opclimb.deep-locked-plan.v1';
  let lastDetail={contract:null,intentProbe:null,intentSkipped:false,gameTime:0,phase:'',selectedBranch:'EVEN',selectedContingency:'PLAN_A'};

  function install(){
    if($('opMatchOs'))return $('opMatchOs');
    const hud=$('opRememberHud');if(!hud)return null;
    const style=document.createElement('style');
    style.id='op-match-os-style';
    style.textContent=[
      'body.op-match-os-active #opRememberHud{--match-os-green:#d6ff2f;--match-os-red:#ff5b66;--match-os-blue:#64a9ff}',
      '#opMatchOs{position:relative;margin:0 0 14px;border:1px solid rgba(214,255,47,.28);background:linear-gradient(135deg,rgba(5,10,14,.985),rgba(8,14,19,.94));box-shadow:0 20px 70px rgba(0,0,0,.38),inset 0 1px rgba(255,255,255,.04);overflow:hidden}',
      '#opMatchOs:before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:#d6ff2f;box-shadow:0 0 24px rgba(214,255,47,.45)}',
      '.matchos-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:14px 18px 12px 21px;border-bottom:1px solid rgba(255,255,255,.09);background:linear-gradient(90deg,rgba(214,255,47,.055),transparent 58%)}',
      '.matchos-kicker{display:block;font-size:8px;letter-spacing:.18em;color:#d6ff2f;font-weight:900}.matchos-title{display:block;margin-top:3px;font-size:18px;letter-spacing:-.025em;color:#f5f7f8;font-weight:950}',
      '.matchos-meta{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.matchos-chip{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.035);padding:6px 8px;font-size:8px;font-weight:900;letter-spacing:.1em;color:#aeb9c0}.matchos-chip.live{border-color:rgba(214,255,47,.32);color:#d6ff2f}',
      '.matchos-grid{display:grid;grid-template-columns:1.1fr 1fr 1.2fr;gap:1px;background:rgba(255,255,255,.07);border-bottom:1px solid rgba(255,255,255,.07)}.matchos-cell{min-width:0;background:rgba(4,8,11,.96);padding:13px 15px}',
      '.matchos-cell span,.matchos-now span,.matchos-learning span,.matchos-branch span,.matchos-proof span{display:block;font-size:7px;letter-spacing:.15em;font-weight:900;color:#7e8b94}.matchos-cell strong{display:block;margin-top:5px;font-size:12px;line-height:1.32;color:#e7edf0}.matchos-cell.win strong{color:#d6ff2f}.matchos-cell.loss strong{color:#ff8b93}.matchos-cell.job strong{font-size:14px;color:#fff}',
      '.matchos-now{padding:14px 18px 13px 21px;border-bottom:1px solid rgba(255,255,255,.08);background:radial-gradient(circle at 100% 0%,rgba(100,169,255,.08),transparent 28%)}.matchos-now-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.matchos-now b{font-size:8px;letter-spacing:.14em;color:#64a9ff}',
      '.matchos-now strong{display:block;margin-top:6px;font-size:18px;line-height:1.18;color:#fff;letter-spacing:-.02em}.matchos-now p{margin:5px 0 0;color:#b4bec5;font-size:11px;line-height:1.42}.matchos-now em{display:block;margin-top:7px;color:#ff8b93;font-size:9px;font-style:normal;font-weight:850}',
      '.matchos-learning{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:1px;background:rgba(255,255,255,.07);border-bottom:1px solid rgba(255,255,255,.07)}.matchos-learning>div{background:rgba(6,11,15,.97);padding:13px 15px}.matchos-learning .primary{padding-left:21px}',
      '.matchos-learning strong{display:block;margin-top:5px;font-size:13px;color:#d6ff2f}.matchos-learning b{display:block;margin-top:5px;font-size:11px;line-height:1.38;color:#f4f6f7}.matchos-learning p{margin:5px 0 0;font-size:10px;color:#8f9aa2;line-height:1.42}',
      '.matchos-memory{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,1.35fr);gap:12px;align-items:center;padding:10px 18px 10px 21px;border-bottom:1px solid rgba(255,255,255,.07);background:linear-gradient(90deg,rgba(100,169,255,.045),rgba(214,255,47,.025))}.matchos-memory>span{font-size:7px;letter-spacing:.16em;font-weight:950;color:#64a9ff}.matchos-memory div{min-width:0}.matchos-memory b{display:block;font-size:8px;letter-spacing:.1em;color:#7f8b94}.matchos-memory strong{display:block;margin-top:3px;font-size:10px;line-height:1.35;color:#dfe6e9}',
      '.matchos-branch{padding:12px 18px 13px 21px}.matchos-branch-head{display:flex;align-items:center;justify-content:space-between;gap:14px}.matchos-tabs{display:flex;gap:5px}.matchos-tab{border:1px solid rgba(255,255,255,.12);background:#091016;color:#93a0a8;padding:7px 10px;font-size:8px;font-weight:950;letter-spacing:.1em;cursor:pointer}.matchos-tab.active{border-color:#d6ff2f;color:#07100c;background:#d6ff2f}',
      '.matchos-branch-card{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:8px;margin-top:9px}.matchos-branch-card>div{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);padding:9px 10px}.matchos-branch-card strong{display:block;margin-top:4px;font-size:10px;line-height:1.36;color:#e8edf0}',
      '.matchos-proof{display:flex;gap:12px;align-items:flex-start;padding:10px 18px 11px 21px;border-top:1px solid rgba(255,255,255,.07);background:rgba(214,255,47,.025)}.matchos-proof strong{font-size:9px;color:#d6ff2f}.matchos-proof p{margin:1px 0 0;font-size:9px;color:#8d9aa1;line-height:1.4}',
      '.matchos-wait{padding:20px 21px}.matchos-wait strong{display:block;color:#f3f5f6;font-size:16px}.matchos-wait p{margin:7px 0 0;color:#8e9aa2;font-size:11px;line-height:1.45}',
      '@media(max-width:900px){.matchos-grid,.matchos-learning,.matchos-branch-card{grid-template-columns:1fr}.matchos-meta{display:none}}'
    ].join('');
    document.head.appendChild(style);

    const root=document.createElement('section');
    root.id='opMatchOs';
    root.innerHTML=[
      '<div class="matchos-head"><div><span class="matchos-kicker">OP CLIMB · MATCH OS</span><strong id="opMatchOsTitle" class="matchos-title">BUILDING YOUR MATCH CONTRACT</strong></div><div class="matchos-meta"><span id="opMatchOsClock" class="matchos-chip live">FROZEN PRE-GAME</span><span id="opMatchOsMode" class="matchos-chip">EXECUTE PLAN</span><span id="opMatchOsPlan" class="matchos-chip">PLAN A</span></div></div>',
      '<div id="opMatchOsWait" class="matchos-wait"><strong>ONE PLAN. ONE JOB. ONE LEARNING REP.</strong><p>OP CLIMB is resolving the draft and compressing the full coaching system into one match contract.</p></div>',
      '<div id="opMatchOsBody" hidden>',
      '<div class="matchos-grid"><div class="matchos-cell win"><span>HOW WE WIN</span><strong id="opMatchOsWin"></strong></div><div class="matchos-cell loss"><span>THEY WIN IF</span><strong id="opMatchOsLose"></strong></div><div class="matchos-cell job"><span>YOUR JOB</span><strong id="opMatchOsJob"></strong></div></div>',
      '<div class="matchos-now"><div class="matchos-now-head"><span>WHAT MATTERS NOW</span><b id="opMatchOsPhase"></b></div><strong id="opMatchOsNow"></strong><p id="opMatchOsNowWhy"></p><em id="opMatchOsGuard"></em></div>',
      '<div class="matchos-learning"><div class="primary"><span>ONE LEARNING REP</span><strong id="opMatchOsLearnTitle"></strong><b id="opMatchOsCue"></b><p id="opMatchOsTrigger"></p></div><div><span>WHAT PROVES IT</span><strong id="opMatchOsSuccess"></strong><p id="opMatchOsSupport"></p></div></div>',
      '<div id="opMatchOsMemory" class="matchos-memory" hidden><span>COACH MEMORY</span><div><b>LAST VERIFIED REP</b><strong id="opMatchOsLastRep"></strong></div><div><b>WHY THIS REP NOW</b><strong id="opMatchOsWhyNow"></strong></div></div>',
      '<div class="matchos-branch"><div class="matchos-branch-head"><div><span>YOU READ THE GAME STATE</span></div><div class="matchos-tabs"><button class="matchos-tab" data-matchos-branch="AHEAD">AHEAD</button><button class="matchos-tab" data-matchos-branch="EVEN">EVEN</button><button class="matchos-tab" data-matchos-branch="BEHIND">BEHIND</button></div></div><div class="matchos-branch-card"><div><span>YOUR CALL</span><strong id="opMatchOsBranchJob"></strong></div><div><span>FIGHT WHEN</span><strong id="opMatchOsBranchFight"></strong></div><div><span>STOP RULE</span><strong id="opMatchOsBranchStop"></strong></div></div></div>',
      '<div class="matchos-proof"><span>POST-GAME PROOF</span><div><strong id="opMatchOsProof"></strong><p id="opMatchOsNeutral"></p></div></div>',
      '</div>'
    ].join('');
    const anchor=$('opRemFrozenPlaybook');
    if(anchor?.parentNode)anchor.parentNode.insertBefore(root,anchor);else hud.prepend(root);
    document.body.classList.add('op-match-os-active');
    root.querySelectorAll('[data-matchos-branch]').forEach(button=>button.addEventListener('click',()=>{
      const key=upper(button.getAttribute('data-matchos-branch'));
      const legacy=document.querySelector('[data-op-branch="'+key+'"]');
      if(legacy instanceof HTMLElement)legacy.click();
      lastDetail={...lastDetail,selectedBranch:key};
      window.setTimeout(()=>render(lastDetail),0);
    }));
    return root;
  }

  function setText(id,value){const node=$(id);if(node)node.textContent=upper(value)}
  function clock(seconds){const n=Math.max(0,Number(seconds)||0),m=Math.floor(n/60),s=Math.floor(n%60);return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
  function phaseFor(contract,seconds){
    const deck=Array.isArray(contract?.phaseDeck)?contract.phaseDeck:[],t=Math.max(0,Number(seconds)||0);
    return deck.find(item=>t>=Number(item.fromSeconds||0)&&(item.toSeconds===null||item.toSeconds===undefined||t<Number(item.toSeconds)))||deck[deck.length-1]||null;
  }
  function branchFor(contract,key){return contract?.branches?.[upper(key)]||contract?.branches?.EVEN||null}
  function storedDetail(){
    try{const raw=JSON.parse(localStorage.getItem(STORE)||'null');return raw?.matchContract?{contract:raw.matchContract,intentProbe:raw.intentProbe||null,intentSkipped:false,gameTime:0,phase:'RECORDING',selectedBranch:raw.selectedBranch||'EVEN',selectedContingency:raw.selectedContingency||'PLAN_A'}:null}catch{return null}
  }

  function render(detail){
    install();lastDetail={...lastDetail,...(detail||{})};
    const contract=lastDetail.contract,wait=$('opMatchOsWait'),body=$('opMatchOsBody');
    if(!contract||contract.version!=='MATCH_OS_V1'){
      if(wait)wait.hidden=false;if(body)body.hidden=true;
      setText('opMatchOsClock',lastDetail.phase==='RECORDING'?clock(lastDetail.gameTime):'FROZEN PRE-GAME');return;
    }
    if(wait)wait.hidden=true;if(body)body.hidden=false;
    const phase=phaseFor(contract,lastDetail.gameTime),branch=branchFor(contract,lastDetail.selectedBranch);
    const intentAnswered=Boolean(lastDetail.intentProbe?.response?.selectedOptionId);
    const intentOpen=Boolean(contract.scaffolding?.intentRequiredBeforeCue&&!intentAnswered&&!lastDetail.intentSkipped);
    const delivery=upper(contract.scaffolding?.deliveryPolicy||'FULL');
    const autonomy=delivery==='NONE'||Boolean(contract.scaffolding?.autonomyTest);
    const revealSpecificCue=!intentOpen&&!autonomy&&contract.scaffolding?.revealSpecificCueAfterIntent!==false;
    const earlyLearningPhase=phase?.phase==='LOAD_IN'||phase?.phase==='LANE';
    const phasePrimary=(intentOpen||autonomy)&&earlyLearningPhase
      ?contract.strategic?.yourJob
      :(phase?.primary||contract.strategic?.yourJob);
    const phaseSecondary=intentOpen
      ?(contract.scaffolding?.intentPrompt||'ANSWER THE INTENT CHECK BEFORE THE COACHING CUE IS REVEALED.')
      :autonomy
        ?contract.scaffolding?.playerInstruction
        :(phase?.secondary||contract.learning?.cue);
    setText('opMatchOsTitle',(contract.champion||'YOU')+' · '+(contract.role||'ROLE')+' // MATCH CONTRACT');
    setText('opMatchOsClock',lastDetail.phase==='RECORDING'?clock(lastDetail.gameTime):'FROZEN PRE-GAME');
    setText('opMatchOsMode',String(contract.learning?.mode||'EXECUTE_PLAN').replaceAll('_',' '));
    setText('opMatchOsPlan',lastDetail.selectedContingency||'PLAN A');
    setText('opMatchOsWin',contract.strategic?.ourWinCondition);setText('opMatchOsLose',contract.strategic?.theirWinCondition);setText('opMatchOsJob',contract.strategic?.yourJob);
    setText('opMatchOsPhase',phase?.label||'LOCK THE CONTRACT');setText('opMatchOsNow',phasePrimary);setText('opMatchOsNowWhy',phaseSecondary);setText('opMatchOsGuard',phase?.guardrail||contract.strategic?.never);
    setText('opMatchOsLearnTitle',intentOpen?'READ FIRST · INTENT CHECK':autonomy?'AUTONOMY TEST · '+(contract.learning?.behaviour||'DECISION'):((contract.learning?.title||'EXECUTE PLAN')+(contract.learning?.behaviour?' · '+contract.learning.behaviour:'')));
    setText('opMatchOsCue',intentOpen?(contract.scaffolding?.intentPrompt||'COMMIT TO YOUR READ BEFORE THE COACHING CUE IS REVEALED.'):autonomy?(contract.scaffolding?.playerInstruction||'EXECUTE FROM YOUR OWN READ.'):revealSpecificCue?contract.learning?.cue:'ONE SHORT CUE ONLY · YOU OWN THE DECISION.');
    setText('opMatchOsTrigger','TRIGGER · '+(contract.learning?.trigger||'WHEN THE PLANNED WINDOW APPEARS.'));
    setText('opMatchOsSuccess',(intentOpen||autonomy)?'POST-GAME WILL SCORE THE VERIFIED DECISION · NO LIVE ANSWER REVEALED':(contract.learning?.success||contract.proof?.pass));
    setText('opMatchOsSupport',intentOpen?'COACHING CUE LOCKED UNTIL YOUR INTENT IS FROZEN':(contract.scaffolding?.playerInstruction||('COACH SUPPORT · '+(contract.learning?.supportMode||'FULL')))+(contract.learning?.experiment?' · '+contract.learning.experiment:''));
    const memory=$('opMatchOsMemory');
    if(memory)memory.hidden=!contract.continuity?.available;
    if(contract.continuity?.available){
      setText('opMatchOsLastRep',(contract.continuity.previousStatus||'')+(contract.continuity.previousBehaviour?' · '+contract.continuity.previousBehaviour:'')+' // '+contract.continuity.previousSummary);
      setText('opMatchOsWhyNow',contract.continuity.whyNow);
    }
    setText('opMatchOsBranchJob',branch?.job||branch?.headline||contract.strategic?.yourJob);setText('opMatchOsBranchFight',branch?.fightWhen||contract.strategic?.fightRule);setText('opMatchOsBranchStop',branch?.stop||contract.strategic?.never);
    setText('opMatchOsProof',contract.proof?.target||contract.proof?.pass);setText('opMatchOsNeutral',contract.proof?.notObserved||'NOT OBSERVED IS NEUTRAL.');
    document.querySelectorAll('[data-matchos-branch]').forEach(button=>button.classList.toggle('active',upper(button.getAttribute('data-matchos-branch'))===upper(lastDetail.selectedBranch||'EVEN')));
  }

  install();
  const stored=storedDetail();if(stored)render(stored);
  window.addEventListener('op-climb-match-os',event=>render(event.detail||{}));
})();