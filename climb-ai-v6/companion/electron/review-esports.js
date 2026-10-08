(()=>{
  const $=id=>document.getElementById(id);
  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  const safeArray=value=>Array.isArray(value)?value.filter(Boolean):[];
  const clock=seconds=>{const s=Math.max(0,Math.floor(Number(seconds)||0));return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`};
  const championAssetId=name=>{
    const raw=clean(name);
    const special={
      "Kai'Sa":'Kaisa',"Bel'Veth":'Belveth',"Cho'Gath":'ChoGath',"Kha'Zix":'Khazix',"K'Sante":'KSante',"LeBlanc":'Leblanc',"Nunu & Willump":'Nunu',"Rek'Sai":'RekSai',"Renata Glasc":'Renata',"Vel'Koz":'Velkoz',Wukong:'MonkeyKing'
    };
    return special[raw]||raw.replace(/[^A-Za-z0-9]/g,'');
  };

  function installStyle(){
    if($('op-review-esports-style'))return;
    const style=document.createElement('style');
    style.id='op-review-esports-style';
    style.textContent=`
#opPostGame332.op-esports-review{position:relative;overflow:hidden;min-height:calc(100vh - 118px);padding:0;background:radial-gradient(circle at 14% 8%,rgba(79,126,255,.08),transparent 31%),radial-gradient(circle at 88% 4%,rgba(214,255,47,.055),transparent 26%),linear-gradient(180deg,#080d11 0%,#06090c 100%);border:1px solid rgba(255,255,255,.09);box-shadow:0 30px 90px rgba(0,0,0,.35)}
#opPostGame332.op-esports-review:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.14;background-image:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);background-size:34px 34px;mask-image:linear-gradient(to bottom,#000,transparent 74%)}
#opPostGame332.op-esports-review>.op332-head{display:none!important}
.op-es-hero{position:relative;z-index:1;display:grid;grid-template-columns:minmax(290px,.72fr) minmax(0,1.28fr);min-height:255px;border-bottom:1px solid rgba(255,255,255,.08)}
.op-es-art{position:relative;min-height:255px;overflow:hidden;background-position:50% 21%;background-size:cover;background-image:linear-gradient(90deg,rgba(5,9,12,.05) 0%,rgba(5,9,12,.28) 50%,rgba(5,9,12,.96) 100%),linear-gradient(0deg,rgba(5,9,12,.96) 0%,rgba(5,9,12,.08) 58%),var(--op-champ-art,linear-gradient(135deg,#111a22,#070a0d))}
.op-es-art:after{content:"";position:absolute;inset:-20%;background:linear-gradient(115deg,transparent 35%,rgba(214,255,47,.11) 48%,transparent 56%);transform:translateX(-46%);animation:opEsSweep 7s ease-in-out infinite;pointer-events:none}
@keyframes opEsSweep{0%,72%{transform:translateX(-46%)}88%,100%{transform:translateX(58%)}}
.op-es-art-copy{position:absolute;inset:auto 24px 22px 26px;z-index:2}.op-es-overline{font-size:8px;letter-spacing:.23em;font-weight:950;color:#d6ff2f;text-transform:uppercase}.op-es-roleline{display:flex;gap:7px;align-items:center;margin-top:7px;color:#93a0aa;font-size:9px;letter-spacing:.12em;text-transform:uppercase}.op-es-roleline b{color:#f2f6f8}.op-es-champ{margin:5px 0 0;font-size:clamp(34px,5.3vw,62px);line-height:.92;letter-spacing:-.055em;text-transform:uppercase;text-shadow:0 10px 30px rgba(0,0,0,.45)}
.op-es-board{position:relative;padding:22px 25px 20px;background:linear-gradient(110deg,rgba(9,14,18,.98),rgba(8,12,15,.90))}.op-es-board:before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:linear-gradient(#d6ff2f,rgba(214,255,47,.05))}.op-es-board-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.op-es-board-head .eyebrow{font-size:8px;letter-spacing:.2em;font-weight:900;color:#65727d;text-transform:uppercase}.op-es-board-head h2{margin:5px 0 0;font-size:clamp(22px,3.2vw,37px);line-height:1;letter-spacing:-.035em;text-transform:uppercase}.op-es-ready{border:1px solid rgba(214,255,47,.3);background:rgba(214,255,47,.04);color:#d6ff2f;padding:8px 10px;font-size:8px;letter-spacing:.15em;font-weight:950;text-transform:uppercase;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
.op-es-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:19px}.op-es-stat{position:relative;padding:12px 11px 11px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(255,255,255,.032),rgba(255,255,255,.012));min-height:72px;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}.op-es-stat:before{content:"";position:absolute;left:0;top:0;width:28%;height:1px;background:#4f8cff}.op-es-stat.accent:before{background:#d6ff2f}.op-es-stat span{display:block;color:#66737e;font-size:7px;letter-spacing:.16em;font-weight:900;text-transform:uppercase}.op-es-stat strong{display:block;margin-top:7px;font-size:18px;line-height:1;color:#f2f6f8}.op-es-stat small{display:block;margin-top:5px;color:#7e8a94;font-size:8px}
.op-es-next-call{margin-top:12px;padding:12px 13px;border-left:2px solid #d6ff2f;background:linear-gradient(90deg,rgba(214,255,47,.075),rgba(214,255,47,.01));position:relative}.op-es-next-call span{font-size:7px;letter-spacing:.18em;color:#d6ff2f;font-weight:950;text-transform:uppercase}.op-es-next-call strong{display:block;margin-top:4px;font-size:15px;text-transform:uppercase;letter-spacing:.01em}.op-es-next-call p{margin:4px 0 0;color:#8f9ba5;font-size:9px;line-height:1.42;max-width:760px}
#opPostGame332.op-esports-review .op332-baseline,#opPostGame332.op-esports-review .op332-main,#opPostGame332.op-esports-review .op332-neutral,#opPostGame332.op-esports-review .op332-next,#opPostGame332.op-esports-review .op332-actions{position:relative;z-index:1;margin-left:22px;margin-right:22px}
#opPostGame332.op-esports-review .op332-baseline{margin-top:19px;padding-top:0;border-top:0}.op-esports-review .op332-section-label{display:flex;align-items:center;gap:9px;color:#7b8791}.op-esports-review .op332-section-label:before{content:"";width:24px;height:2px;background:#d6ff2f}.op-esports-review .op332-baseline-grid{grid-template-columns:1fr 1.25fr 1fr;gap:8px}.op-esports-review .op332-plan{position:relative;overflow:hidden;min-height:112px;background:linear-gradient(135deg,rgba(20,28,34,.74),rgba(9,14,18,.72));border:1px solid rgba(255,255,255,.085);clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}.op-esports-review .op332-plan:after{content:"";position:absolute;top:0;right:0;width:32px;height:2px;background:#4f8cff;opacity:.8}.op-esports-review .op332-plan.mission:after{background:#d6ff2f}.op-esports-review .op332-plan.op-es-locked{opacity:.52;background:repeating-linear-gradient(-45deg,rgba(255,255,255,.018),rgba(255,255,255,.018) 7px,rgba(255,255,255,.005) 7px,rgba(255,255,255,.005) 14px)}
.op-es-timeline{position:relative;z-index:1;margin:17px 22px 0;padding:14px 15px 16px;border:1px solid rgba(255,255,255,.08);background:rgba(5,10,13,.58)}.op-es-timeline-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.op-es-timeline-head b{font-size:10px;letter-spacing:.13em;text-transform:uppercase}.op-es-timeline-head span{font-size:7px;letter-spacing:.15em;color:#5f6c76;text-transform:uppercase}.op-es-rail{position:relative;height:47px;margin-top:11px}.op-es-rail:before{content:"";position:absolute;left:0;right:0;top:20px;height:2px;background:linear-gradient(90deg,#23303a,#4f8cff 44%,#d6ff2f 100%);opacity:.55}.op-es-rail:after{content:"";position:absolute;left:0;top:16px;width:1px;height:10px;background:#596671;box-shadow:calc(100% - 1px) 0 #596671}.op-es-marker{position:absolute;left:var(--pos);top:13px;transform:translateX(-50%);width:15px;height:15px;border:3px solid #071015;border-radius:50%;background:#d6ff2f;box-shadow:0 0 0 1px rgba(214,255,47,.48),0 0 15px rgba(214,255,47,.16)}.op-es-marker.fix{background:#ff765f;box-shadow:0 0 0 1px rgba(255,118,95,.45),0 0 15px rgba(255,118,95,.14)}.op-es-marker label{position:absolute;top:18px;left:50%;transform:translateX(-50%);white-space:nowrap;color:#7e8a94;font-size:7px;letter-spacing:.05em}.op-es-marker:hover:before{content:attr(data-title);position:absolute;bottom:22px;left:50%;transform:translateX(-50%);width:max-content;max-width:210px;padding:7px 8px;background:#111a20;border:1px solid rgba(255,255,255,.12);color:#e8edf0;font-size:8px;line-height:1.3;z-index:4}
.op-esports-review .op332-main{gap:8px;margin-top:14px}.op-esports-review .op332-column{background:linear-gradient(180deg,rgba(15,22,27,.68),rgba(8,13,16,.7));border:1px solid rgba(255,255,255,.08);padding:15px 16px;clip-path:polygon(11px 0,100% 0,100% calc(100% - 11px),calc(100% - 11px) 100%,0 100%,0 11px)}.op-esports-review .op332-column.good{border-top:2px solid #d6ff2f}.op-esports-review .op332-column.fix{border-top:2px solid #ff765f}.op-esports-review .op332-column h3{font-size:12px}.op-esports-review .op332-point{padding:10px 0}.op-esports-review .op332-point i{clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px);background:rgba(255,255,255,.025)}.op-esports-review .op332-point b{font-size:11px}.op-esports-review .op332-point p{font-size:9px;color:#7f8c96}.op-esports-review .op332-neutral{border:0;border-top:1px solid rgba(79,140,255,.26);background:linear-gradient(90deg,rgba(79,140,255,.055),transparent);padding:14px 15px;margin-top:12px}.op-esports-review .op332-observation{background:rgba(11,18,23,.64);border:1px solid rgba(79,140,255,.13)}.op-esports-review .op332-next{display:none}.op-esports-review .op332-actions{padding-bottom:20px}.op-esports-review .op332-actions button{clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px);background:rgba(255,255,255,.025)}
.op-es-marker.player{width:18px;height:18px;top:11px;background:#a88cff;border-radius:3px;transform:translateX(-50%) rotate(45deg);box-shadow:0 0 0 1px rgba(168,140,255,.5)}.op-es-marker.player label{transform:translateX(-50%) rotate(-45deg);top:20px}.op-es-marked{display:grid;gap:7px;margin-top:8px}.op-es-marked article{display:flex;gap:10px;align-items:baseline;color:#aeb9c2;font-size:9px}.op-es-marked b{color:#c6b5ff;min-width:38px}.op-es-marked .unmatched{color:#75818c}
@media(max-width:820px){.op-es-hero{grid-template-columns:1fr}.op-es-art{min-height:210px}.op-es-board{padding:18px}.op-es-stat-grid{grid-template-columns:1fr 1fr}.op-esports-review .op332-baseline-grid{grid-template-columns:1fr}.op-es-timeline{overflow:hidden}}
@media(max-width:520px){.op-es-stat-grid{grid-template-columns:1fr 1fr}.op-es-stat strong{font-size:15px}.op-es-marker:nth-of-type(n+5){display:none}}
`;
    document.head.appendChild(style);
  }

  function install(){
    installStyle();
    const section=$('opPostGame332');
    if(!section)return null;
    section.classList.add('op-esports-review');
    if(!$('opEsHero')){
      const hero=document.createElement('section');
      hero.id='opEsHero';hero.className='op-es-hero';
      hero.innerHTML=`
        <div id="opEsArt" class="op-es-art"><div class="op-es-art-copy"><div class="op-es-overline">POST MATCH // PERFORMANCE REVIEW</div><div class="op-es-roleline"><b id="opEsRole">ROLE</b><span>·</span><span id="opEsCoach">OP COACH</span></div><h1 id="opEsChamp" class="op-es-champ">CHAMPION</h1></div></div>
        <div class="op-es-board"><div class="op-es-board-head"><div><div class="eyebrow">MATCH INTELLIGENCE // VERIFIED REVIEW</div><h2>GAME DEBRIEF</h2></div><div class="op-es-ready">REVIEW READY</div></div><div class="op-es-stat-grid"><article class="op-es-stat accent"><span>KDA</span><strong id="opEsKda">—</strong><small>final line</small></article><article class="op-es-stat"><span>CS / MIN</span><strong id="opEsCs">—</strong><small>economy pace</small></article><article class="op-es-stat"><span>MATCH TIME</span><strong id="opEsTime">—</strong><small>recorded duration</small></article><article class="op-es-stat"><span>DECISIONS</span><strong id="opEsEvidence">—</strong><small>reviewed moments</small></article></div><div class="op-es-next-call"><span>NEXT GAME // ONE CALL</span><strong id="opEsNextTitle">REPEAT THE CLEAN DECISIONS</strong><p id="opEsNextRule"></p></div></div>`;
      const baseline=section.querySelector('.op332-baseline');
      section.insertBefore(hero,baseline||section.firstChild);
    }
    if(!$('opEsProof')){
      const proof=document.createElement('section');
      proof.id='opEsProof';proof.className='op-es-proof';
      proof.innerHTML='<div class="op-es-proof-intro"><span>YOUR DEVELOPMENT · VERIFIED PROGRESSION</span><h3>GAME DNA MISSION PROOF</h3><p id="opEsProofSub">Only timestamped and reliable mission evidence counts towards progression.</p></div><div id="opEsProofGrid" class="op-es-proof-grid"></div>';
      const timelineAnchor=section.querySelector('.op333-key');
      section.insertBefore(proof,timelineAnchor||section.querySelector('.op332-development'));
    }
    if(!$('opEsTimeline')){
      const timeline=document.createElement('section');timeline.id='opEsTimeline';timeline.className='op-es-timeline';timeline.innerHTML=`<div class="op-es-timeline-head"><div><span class="op-es-timeline-overline">MATCH EVIDENCE / GAME REVIEW</span><b>MATCH MOMENTS</b></div><span>GREEN = CLEAN CONVERSION · RED = LEAK · PURPLE = YOUR MARK</span></div><div id="opEsRail" class="op-es-rail"></div><div id="opEsRailAxis" class="op-es-rail-axis"><span>00:00</span><span id="opEsEndTime">—</span></div><div id="opEsMoments" class="op-es-moments" role="list" aria-label="Key reviewed decisions"></div><div id="opEsMarked" class="op-es-marked"></div>`;
      const main=section.querySelector('.op332-main');
      section.insertBefore(timeline,main||section.querySelector('.op332-neutral'));
    }
    return section;
  }

  // Render the same evidence that powers the server-authored review; never create
  // an invented grade, a success from NOT_OBSERVED, or a decision without a clock.
  function renderMissionProof(review){
    const grid=$('opEsProofGrid');if(!grid)return;
    grid.replaceChildren();
    const baseline=review?.dnaBaseline||null;
    const ready=baseline?.ready===true;
    const missions=safeArray(review?.missionEvidence).slice(0,2);
    const subtitle=$('opEsProofSub');
    if(subtitle){
      subtitle.textContent=!ready
        ?'BASELINE ACTIVE · Development missions are not graded until three games in this role.'
        :missions.length
          ?'Only BANKED results add a proven rep. NOT OBSERVED is neutral, never a failure.'
          :'No reliable mission evidence was available for this match.';
    }
    if(!ready||!missions.length){
      const card=document.createElement('article');card.className='op-es-proof-card pending';
      const label=document.createElement('span');label.textContent=ready?'NO EVIDENCE AVAILABLE':'BASELINE NOT COMPLETE';
      const title=document.createElement('strong');title.textContent=ready?'Mission grading unavailable':'Collect your three baseline games';
      const detail=document.createElement('p');detail.textContent='We do not guess DNA progress. Review the full mission panel when verified evidence is available.';
      card.append(label,title,detail);grid.appendChild(card);
      return;
    }
    for(const mission of missions){
      const raw=clean(mission?.evidenceState).toUpperCase();
      const result=['BANKED','MISSED','NOT_OBSERVED'].includes(raw)?raw:'NOT_OBSERVED';
      const count=Math.max(0,Number(mission?.confirmed??mission?.completedGames)||0);
      const required=Math.max(1,Number(mission?.required??mission?.requiredGames)||3);
      const progress=Math.min(100,Math.round((count/required)*100));
      const card=document.createElement('article');card.className='op-es-proof-card '+result.toLowerCase().replace('_','-');
      const label=document.createElement('span');label.textContent=clean(mission?.dnaDomain).replaceAll('_',' ')||'GAME DNA';
      const title=document.createElement('strong');title.textContent=clean(mission?.title)||'Your development mission';
      const status=document.createElement('div');status.className='op-es-proof-result';
      const chip=document.createElement('b');chip.textContent=result.replace('_',' ');
      const countElement=document.createElement('small');countElement.textContent=count+'/'+required+' PROVEN GAMES';
      status.append(chip,countElement);
      const track=document.createElement('div');track.className='op-es-proof-track';track.setAttribute('role','progressbar');
      track.setAttribute('aria-label',title.textContent+' proven games');
      track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(required));
      track.setAttribute('aria-valuenow',String(Math.min(required,count)));
      const fill=document.createElement('i');fill.style.width=progress+'%';track.appendChild(fill);
      const reason=document.createElement('p');reason.textContent=clean(mission?.evidenceReason)||
        (result==='BANKED'?'Verified target cleared in this match.'
          :result==='MISSED'?'Target was observed but not cleared.':'No reliable evidence to grade this attempt.');
      card.append(label,title,status,track,reason);grid.appendChild(card);
    }
  }

  function renderTimeline(review){
    const rail=$('opEsRail');if(!rail)return;rail.replaceChildren();
    const rawDuration=Number(review?.match?.durationSeconds);
    const duration=Number.isFinite(rawDuration)&&rawDuration>0?rawDuration:1;
    set('opEsEndTime',Number.isFinite(rawDuration)&&rawDuration>0?clock(rawDuration):'—');
    const good=safeArray(review?.doneWell||review?.good).filter(item=>item?.verified!==false&&Number.isFinite(Number(item?.atSeconds))).map(item=>({...item,kind:'good'}));
    const fix=safeArray(review?.improve||review?.critical).filter(item=>item?.verified!==false&&Number.isFinite(Number(item?.atSeconds))).map(item=>({...item,kind:'fix'}));
    const chosen=[...good,...fix].sort((a,b)=>Number(a.atSeconds)-Number(b.atSeconds).slice(0,7);
    chosen.forEach(item=>{
      const seconds=Math.max(0,Math.min(duration,Number(item.atSeconds)||0));
      const marker=document.createElement('div');marker.className=`op-es-marker ${item.kind==='fix'?'fix':''}`;marker.style.setProperty('--pos',`${Math.max(2,Math.min(98,(seconds/duration)*100))}%`);marker.dataset.title=clean(item.title)||'Reviewed moment';
      const label=document.createElement('label');label.textContent=clock(seconds);marker.appendChild(label);rail.appendChild(marker);
    });
    const moments=$('opEsMoments');if(moments){moments.replaceChildren();
      // Decision Graph is the evidence source behind the full review. No data
      // means an explicit empty state rather than made-up coaching.
      const nodes=safeArray(review?.decisionGraph?.nodes)
        .filter(node=>['GOOD','IMPROVE'].includes(clean(node?.verdict).toUpperCase()))
        .filter(node=>node?.atSeconds!=null&&Number.isFinite(Number(node.atSeconds)))
        .sort((a,b)=>Number(a.atSeconds)-Number(b.atSeconds)).slice(0,5);
      if(!nodes.length){
        const empty=document.createElement('p');empty.className='op-es-moments-empty';
        empty.textContent='No time-stamped reviewed decisions met the evidence requirement. Open the full review for observations.';
        moments.appendChild(empty);
      }
      nodes.forEach((node,index)=>{
        const verdict=clean(node.verdict).toUpperCase();
        const card=document.createElement('article');
        card.className='op-es-moment-card '+(verdict==='GOOD'?'good':'fix');
        card.setAttribute('role','listitem');
        const lead=document.createElement('div');lead.className='op-es-moment-lead';
        const number=document.createElement('span');number.textContent=String(index+1).padStart(2,'0');
        const time=document.createElement('b');time.textContent=clean(node.minuteLabel)||clock(node.atSeconds);
        const result=document.createElement('em');result.textContent=verdict==='GOOD'?'CLEAN':'REVIEW';
        lead.append(number,time,result);
        const copy=document.createElement('div');copy.className='op-es-moment-copy';
        const title=document.createElement('h4');title.textContent=clean(node.title||node.behaviourLabel)||'Decision moment';
        const actual=document.createElement('p');actual.textContent=clean(node.decisionRead||node.consequence)||'Decision recorded for review.';
        const next=document.createElement('small');next.textContent=verdict==='IMPROVE'
          ?(clean(node?.counterfactual?.alternative)||'See the full review for a possible better decision.')
          :(clean(node.consequence)||'Positive decision recorded; do not infer mastery from one game.');
        copy.append(title,actual,next);card.append(lead,copy);moments.appendChild(card);
      });
    }
    const marked=$('opEsMarked');if(marked)marked.replaceChildren();
    safeArray(review?.markedMoments).filter(item=>item?.atSeconds!=null&&Number.isFinite(Number(item.atSeconds))).slice(0,12).forEach(item=>{
      const seconds=Math.max(0,Math.min(duration,Number(item.atSeconds)));
      const marker=document.createElement('div');marker.className='op-es-marker player';marker.style.setProperty('--pos',`${Math.max(2,Math.min(98,(seconds/duration)*100))}%`);marker.dataset.title='Your mark: '+clean(item.detail);
      const label=document.createElement('label');label.textContent=clock(seconds);marker.appendChild(label);rail.appendChild(marker);
      if(marked){const row=document.createElement('article');const time=document.createElement('b');time.textContent=clock(seconds);const detail=document.createElement('span');detail.className=item.status==='MATCHED'?'':'unmatched';detail.textContent=clean(item.detail);row.append(time,detail);marked.appendChild(row)}
    });
  }

  function set(id,value,fallback='—'){const node=$(id);if(node)node.textContent=clean(value)||fallback}

  function render(state){
    const section=install();if(!section)return;
    const review=state?.postGameReview||null;
    const visible=String(state?.phase||'')==='REVIEW'&&Boolean(review);
    if(!visible)return;
    const match=review.match||{};
    const champion=clean(match.champion)||'Champion';
    const art=$('opEsArt');if(art){const asset=championAssetId(champion);art.style.setProperty('--op-champ-art',`url("https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${asset}_0.jpg")`)}
    set('opEsChamp',champion.toUpperCase(),'CHAMPION');
    set('opEsRole',clean(match.role).toUpperCase(),'ROLE');
    const accessTier=clean(state?.teamPlan?.strategyAccess?.tier||state?.playerHome?.tier).toUpperCase();
    set('opEsCoach',['FREE','PLUS','PRO'].includes(accessTier)?accessTier+' COACH':'OP CLIMB COACH','OP CLIMB COACH');
    set('opEsKda',match.kda,'—');
    set('opEsCs',Number.isFinite(match.csPerMin)?Number(match.csPerMin).toFixed(1):'—','—');
    set('opEsTime',Number.isFinite(match.durationSeconds)?clock(match.durationSeconds):'—','—');
    set('opEsEvidence',review.evidenceCount!=null&&Number.isFinite(Number(review.evidenceCount))&&Number(review.evidenceCount)>=0?String(Number(review.evidenceCount)):'—','—');
    set('opEsNextTitle',review?.nextFocus?.title,'REPEAT THE CLEAN DECISIONS');
    set('opEsNextRule',review?.nextFocus?.rule,'Keep the same CLIMB MISSION and build more evidence next game.');
    const vs=$('op332Vs');const vsCard=vs?.closest('.op332-plan');if(vsCard)vsCard.classList.toggle('op-es-locked',/unavailable|locked/i.test(clean(vs.textContent)));
    renderMissionProof(review);
    renderTimeline(review);
  }

  install();
  window.opCompanion?.getState?.().then(render).catch(()=>{});
  window.opCompanion?.onState?.(render);
})();
