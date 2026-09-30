/* OP CLIMB Companion · esports layer (champion art only).
   Reads the state the app already has and adds pictures and style hooks to
   screens that renderer.js drew. It never writes text, never changes a
   value and never calls a function that does anything. If an image cannot
   load, the screen looks exactly as it did before. */
(()=>{
  const $=id=>document.getElementById(id);
  const ART='https://ddragon.leagueoflegends.com/cdn/img/champion';
  const SPECIAL={
    'Aurelion Sol':'AurelionSol',"Bel'Veth":'Belveth',"Cho'Gath":'Chogath','Dr. Mundo':'DrMundo',
    'Jarvan IV':'JarvanIV',"Kai'Sa":'Kaisa',"Kha'Zix":'Khazix',"K'Sante":'KSante','LeBlanc':'Leblanc',
    'Lee Sin':'LeeSin','Master Yi':'MasterYi','Miss Fortune':'MissFortune','Nunu & Willump':'Nunu',"Rek'Sai":'RekSai',
    'Renata Glasc':'Renata','Tahm Kench':'TahmKench','Twisted Fate':'TwistedFate',"Vel'Koz":'Velkoz','Wukong':'MonkeyKing','Xin Zhao':'XinZhao',
  };
  const NOT_A_CHAMPION=/pending|selecting|waiting|unknown|tbd|opponent|^you\b/i;
  const championId=name=>{
    const clean=String(name||'').trim();
    if(!clean||NOT_A_CHAMPION.test(clean))return'';
    return SPECIAL[clean]||clean.replace(/[^A-Za-z0-9]/g,'');
  };
  const tileUrl=id=>`${ART}/tiles/${encodeURIComponent(id)}_0.jpg`;
  const splashUrl=id=>`${ART}/splash/${encodeURIComponent(id)}_0.jpg`;

  // A tile that has already been decoded paints instantly when cloned, so the
  // draft board does not flash every time the app redraws it.
  const tiles=new Map();
  function tileFor(id){
    if(!id){
      const empty=document.createElement('span');
      empty.className='es-tile es-empty';empty.textContent='?';
      return empty;
    }
    if(!tiles.has(id)){
      const img=new Image();
      img.className='es-tile';img.alt='';img.decoding='async';
      img.onerror=()=>img.classList.add('es-missing');
      img.src=tileUrl(id);
      tiles.set(id,img);
    }
    const copy=tiles.get(id).cloneNode(false);
    copy.onerror=()=>copy.classList.add('es-missing');
    return copy;
  }

  let state=null;

  /* ------------------------------------------------------- draft board -- */
  function decorateRows(containerId,people,{ours}){
    const root=$(containerId);
    if(!root)return;
    const localCell=Number(state?.draft?.localPlayerCellId);
    [...root.children].forEach((row,index)=>{
      if(row.dataset.es==='1')return;
      row.dataset.es='1';
      const name=row.querySelector('strong')?.textContent||'';
      const status=row.querySelector('span:last-child')?.textContent||'';
      row.prepend(tileFor(championId(name)));
      if(/locked/i.test(status))row.classList.add('es-locked');
      const person=people[index];
      if(ours&&person&&Number(person.cellId)===localCell)row.classList.add('es-you');
    });
  }

  /* ---------------------------------------------------------- plan hero -- */
  function decoratePlan(){
    const section=$('simplePregame');
    if(!section)return;
    const matchup=state?.matchup;
    const plan=matchup?.plan;
    const ready=matchup?.status==='READY'&&plan;
    const you=ready?championId(plan.you?.name||matchup.champion):'';
    const foeKnown=ready&&matchup.opponent&&['CHAMP_SELECT','IN_GAME'].includes(String(matchup.source||''));
    const them=foeKnown?championId(plan.them?.name||matchup.opponent):'';
    section.style.setProperty('--es-you-art',you?`url("${splashUrl(you)}")`:'none');
    section.style.setProperty('--es-them-art',them?`url("${splashUrl(them)}")`:'none');
    section.classList.toggle('es-art',Boolean(you));
    section.classList.toggle('es-foe',Boolean(them));
  }

  /* ------------------------------------------------------------ review -- */
  function decorateReview(){
    const section=$('simplePostgameReview');
    if(!section)return;
    const review=state?.postGameReview;
    const champion=championId(review?.match?.champion);
    section.style.setProperty('--es-review-art',champion?`url("${splashUrl(champion)}")`:'none');
    section.classList.toggle('es-art',Boolean(champion));

    // Scoreboard strip. Same numbers the review already shows, same gating by
    // coach level, just laid out like a post-match scoreboard.
    let strip=$('esStats');
    const match=review?.match||{};
    const depth=Number(review?.coachLevel?.depth??state?.teamPlan?.coachLevel?.depth)||3;
    const tiles=[];
    if(match.role)tiles.push(['ROLE',String(match.role).toUpperCase(),false]);
    if(depth>=2&&match.kda)tiles.push(['K / D / A',String(match.kda),true]);
    if(depth>=4&&Number.isFinite(Number(match.csPerMin)))tiles.push(['CS / MIN',String(match.csPerMin),false]);
    const signature=tiles.map(t=>t.join(':')).join('|');
    if(!tiles.length){strip?.remove();return}
    if(!strip){
      strip=document.createElement('div');strip.id='esStats';strip.className='es-stats';
      const head=section.querySelector('.coach-review-head');
      if(head)head.after(strip);else section.prepend(strip);
    }
    if(strip.dataset.signature===signature)return;
    strip.dataset.signature=signature;
    strip.replaceChildren(...tiles.map(([label,value,accent])=>{
      const cell=document.createElement('div');cell.className='es-stat'+(accent?' es-accent':'');
      const l=document.createElement('span');l.textContent=label;
      const v=document.createElement('b');v.textContent=value;
      cell.append(l,v);return cell;
    }));
  }

  /* -------------------------------------------------- match plan page ---- */
  // The page shown after you lock in (built by preload.cjs). This only adds a
  // squad strip and champion chips; the text preload writes is never touched.
  const ROLE_ORDER=['TOP','JUNGLE','MID','ADC','SUPPORT'];
  const roleKey=value=>{
    const role=String(value||'').trim().toUpperCase();
    return role==='BOTTOM'?'ADC':role==='UTILITY'?'SUPPORT':role==='MIDDLE'?'MID':role;
  };
  function rosterOf(side){
    const plan=state?.teamPlan;
    const live=Array.isArray(plan?.[side])?plan[side]:[];
    const frozenKey=side==='ourTeam'?'ours':'theirs';
    const frozenSource=plan?.rememberPlan?.draftTeams?.[frozenKey];
    const source=live.length?live:(Array.isArray(frozenSource)?frozenSource:[]);
    return source.map(p=>({name:String(p?.name||'').trim(),role:roleKey(p?.role)})).filter(p=>p.name);
  }
  function inRoleOrder(list){
    const placed=ROLE_ORDER.map(role=>list.find(p=>p.role===role)).filter(Boolean);
    return [...placed,...list.filter(p=>!placed.includes(p))].slice(0,5);
  }
  const escapeRegExp=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  // Whole-name match only: "Sion" must not be found inside "DECISION".
  const mentions=(text,name)=>new RegExp(`(^|[^A-Za-z])${escapeRegExp(name)}($|[^A-Za-z])`,'i').test(String(text||''));
  function namesIn(text,roster){
    return roster
      .filter(p=>mentions(text,p.name))
      .sort((a,b)=>String(text).toLowerCase().indexOf(a.name.toLowerCase())-String(text).toLowerCase().indexOf(b.name.toLowerCase()));
  }
  function portrait(name,className){
    const id=championId(name);
    const img=document.createElement(id?'img':'span');
    img.className=className;
    if(id){img.alt='';img.decoding='async';img.src=tileUrl(id);img.onerror=()=>img.classList.add('es-missing')}
    else img.textContent='?';
    return img;
  }
  function unit(person,tag,side){
    const card=document.createElement('div');
    card.className=`es-unit ${side}${tag?` es-${tag}`:''}`;
    const art=portrait(person.name,'es-unit-art');
    const role=document.createElement('span');role.className='es-unit-role';role.textContent=person.role||'—';
    const name=document.createElement('b');name.className='es-unit-name';name.textContent=person.name;
    card.append(art,role,name);
    if(tag){
      const badge=document.createElement('i');badge.className='es-unit-tag';
      badge.textContent=tag==='you'?'YOU':tag==='link'?'LINK':'THREAT';
      card.append(badge);
    }
    return card;
  }
  // The "OUR STYLE" / "THEIR STYLE" labels preload.cjs writes live in the tag
  // row. They describe one team each, so they are moved above that team's
  // portraits. The same nodes are moved, so preload keeps updating them.
  const chipOf=id=>$(id)?.closest?.('.op-chip')||null;
  function decorateSquad(section,ours,theirs,tagOf){
    let squad=$('esSquad');
    const styleChips={ours:chipOf('opOurIdentity'),theirs:chipOf('opTheirIdentity')};
    if(!ours.length&&!theirs.length){
      // No portraits to hang the labels on: give them back to the tag row.
      const row=section.querySelector('.op-draft');
      for(const chip of Object.values(styleChips))if(chip&&row)row.append(chip);
      squad?.remove();return;
    }
    if(!squad){
      squad=document.createElement('div');squad.id='esSquad';squad.className='es-squad';
      const head=section.querySelector('.op-head');
      if(head)head.after(squad);else section.prepend(squad);
    }
    const signature=JSON.stringify([ours.map(p=>[p.name,p.role,tagOf(p,'ours')]),theirs.map(p=>[p.name,p.role,tagOf(p,'theirs')])]);
    if(squad.dataset.signature===signature)return;
    squad.dataset.signature=signature;
    const side=(people,key)=>{
      const col=document.createElement('div');col.className=`es-col ${key}`;
      const caption=document.createElement('div');caption.className='es-caption';
      if(styleChips[key])caption.append(styleChips[key]);
      const units=document.createElement('div');units.className=`es-side ${key}`;
      units.append(...people.map(p=>unit(p,tagOf(p,key),key)));
      col.append(caption,units);
      return col;
    };
    const versus=document.createElement('div');versus.className='es-vs';versus.textContent='VS';
    squad.replaceChildren(side(ours,'ours'),versus,side(theirs,'theirs'));
  }
  // Champion chips inside a step / card, built once per set of names.
  const chipRows=new WeakMap();
  function setChips(host,people,kind){
    if(!host)return;
    let row=chipRows.get(host);
    if(!people.length){row?.remove();chipRows.delete(host);return}
    if(!row){
      row=document.createElement('div');chipRows.set(host,row);
      const label=host.querySelector('span');
      if(label)label.after(row);else host.prepend(row);
    }
    row.className=`es-chips ${kind}`;
    const signature=people.map(p=>p.name).join('|');
    if(row.dataset.signature===signature)return;
    row.dataset.signature=signature;
    row.replaceChildren(...people.map(p=>{
      const chip=document.createElement('span');chip.className='es-chip';chip.title=p.name;
      const name=document.createElement('b');name.textContent=p.name;
      chip.append(portrait(p.name,'es-chip-art'),name);
      return chip;
    }));
  }
  const onlyNames=(text,roster)=>{
    const words=String(text||'').split(/\s*[\/,&+]\s*|\s+and\s+/i).map(w=>w.trim().toLowerCase()).filter(Boolean);
    return words.length>0&&words.every(word=>roster.some(p=>p.name.toLowerCase()===word));
  };
  /* --------------------------------- long lines become separate pieces ---- */
  // "A → B → C" or "X, OR Y" reads as one block of text. Show each part as its own
  // piece with an arrow (or "OR") between. preload.cjs keeps writing the original
  // sentence, so it stays in the page, visually hidden, and is re-split when it changes.
  const flows=new WeakMap();
  function setFlow(host,segments,mode){
    let list=flows.get(host);
    if(segments.length<(mode==='rule'?1:2)){list?.remove();flows.delete(host);host.classList.remove('es-flowed');return false}
    if(!list){
      list=document.createElement('ol');flows.set(host,list);
      const text=host.querySelector('strong');
      if(text)text.after(list);else host.append(list);
    }
    list.className=`es-flow ${mode}`;
    host.classList.add('es-flowed');
    const signature=segments.join('\u0001');
    if(list.dataset.signature===signature)return true;
    list.dataset.signature=signature;
    list.replaceChildren(...segments.map(part=>{const item=document.createElement('li');item.textContent=part;return item}));
    return true;
  }
  const cut=(text,pattern)=>String(text||'').split(pattern).map(part=>part.trim().replace(/[.,]+$/,'')).filter(Boolean);
  const ARROW=/\s*(?:→|->)\s*/;
  function decorateFlows(theirs){
    for(let i=1;i<=5;i++){
      const node=$(`opRoleStep${i}`);
      const host=node?.closest('.op-role-step');
      if(!host)continue;
      const text=node.textContent;
      if(i===3){
        // "Yone / Pyke / Lux — DO NOT STEP OUT…": the names are already shown as
        // portraits, so the rule on its own is what is left to read.
        const parts=cut(text,/\s+[—–]\s+/);
        const rule=parts.length>1&&onlyNames(parts[0],theirs)?parts.slice(1):[];
        if(setFlow(host,rule,'rule'))continue;
      }
      setFlow(host,cut(text,ARROW),'down');
    }
    // The simple four-step plan (early / mid game / objective / fight) has the same kind of chains.
    for(const id of ['opEarly','opMid','opObjective','opFight']){
      const node=$(id);
      const host=node?.closest?.('.op-step');
      if(host)setFlow(host,cut(node.textContent,ARROW),'down');
    }
    const win=$('opPaidWin');
    if(win){
      const text=$('opYourWin')?.textContent||'';
      let parts=cut(text,ARROW);
      if(parts.length<2)parts=cut(text,/(?<=[.!?])\s+/);
      setFlow(win,parts,'inline');
    }
    const loss=$('opPaidLoss');
    if(loss)setFlow(loss,cut($('opVsTeam')?.textContent,/,?\s+OR\s+/),'or');
  }

  function decorateMatchPage(){
    const section=$('opMissionReminders');
    if(!section||section.classList.contains('hidden'))return;
    const plan=state?.teamPlan||{};
    const ours=inRoleOrder(rosterOf('ourTeam'));
    const theirs=inRoleOrder(rosterOf('theirTeam'));
    const you=String(state?.matchup?.champion||state?.matchup?.plan?.you?.name||'').trim().toLowerCase();
    const text=id=>$(id)?.textContent||'';
    const read=plan.compositionRead||{};
    const linkText=`${text('opRoleStep2')} ${(read.protectors||[]).join(' ')}`;
    const threatText=`${text('opRoleStep3')} ${(read.enemyThreats||[]).join(' ')} ${text('opVsTeam')}`;
    decorateSquad(section,ours,theirs,(person,side)=>{
      if(side==='ours')return person.name.toLowerCase()===you?'you':mentions(linkText,person.name)?'link':'';
      return mentions(threatText,person.name)?'threat':'';
    });

    // Step 2 (who to stay with) and step 3 (who to survive) get champion chips;
    // when the step is nothing but names, the chips replace the plain text.
    const step2=$('opRoleStep2')?.closest('.op-role-step');
    const step3=$('opRoleStep3')?.closest('.op-role-step');
    const links=namesIn(text('opRoleStep2'),ours);
    const threats=namesIn(text('opRoleStep3'),theirs);
    setChips(step2,links,'ally');
    setChips(step3,threats,'foe');
    step2?.classList.toggle('es-names-only',onlyNames(text('opRoleStep2'),ours));
    step3?.classList.toggle('es-names-only',onlyNames(text('opRoleStep3'),theirs));
    setChips($('opPaidLoss'),namesIn(text('opVsTeam'),theirs),'foe');
    decorateFlows(theirs);
  }

  /* ------------------------------------------------ in-game screen ------- */
  // While a match is recording, the coach board is a tall stack of tiny text
  // with the win path and build hidden in a drawer. This builds a one-screen
  // version from the values the board has already computed (it only READS the
  // board's elements; the board keeps updating them, and its drawers stay below
  // for the interactive tools). Long lines wrap into pieces instead of being clipped.
  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  const val=id=>clean($(id)?.textContent);
  const node=(tag,className,content)=>{
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(content!==undefined)el.textContent=content;
    return el;
  };
  const gameCard=(className,label,...kids)=>{
    const card=node('article',`es-g-card ${className}`);
    card.append(node('span','es-g-label',label),...kids);
    return card;
  };
  const pieceList=(parts,mode)=>{
    const list=node('ol',`es-flow ${mode}`);
    parts.forEach(part=>list.append(node('li','',part)));
    return list;
  };
  const itemIcon=(patch,id)=>`https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(patch)}/img/item/${encodeURIComponent(id)}.png`;
  function buildCards(build){
    const path=[...(build.core||[]).slice(0,2),build.draftItem,build.finish,build.boots].filter(Boolean);
    const swaps=(build.swaps||[]).filter(item=>item&&item.id).slice(0,3);
    const label=(item,index)=>item.slot==='CORE'?`CORE ${index+1}`:item.slot==='DRAFT'?'VS THIS TEAM':item.slot==='FINISH'?'FINISH':item.slot==='BOOTS'?'BOOTS':'ITEM';
    const card=(item,text,kind)=>{
      const el=node('article',`es-g-item ${kind}`);
      el.title=clean(item.why);
      const icon=document.createElement('img');icon.alt='';icon.src=itemIcon(build.patch,item.id);icon.onerror=()=>icon.classList.add('es-missing');
      el.append(icon,node('span','',text),node('b','',clean(item.name).toUpperCase()));
      return el;
    };
    return [...path.map((item,index)=>card(item,label(item,index),item.slot==='DRAFT'?'draft':item.slot==='BOOTS'?'boots':item.slot==='FINISH'?'finish':'core')),
      ...swaps.map(item=>card(item,'SWAP IF','swap'))];
  }
  function renderGame(){
    const hud=$('opRememberHud');
    const live=Boolean(hud)&&document.body.classList.contains('op-remember-live');
    let root=$('esGame');
    if(!live){root?.remove();return}
    // The board fills in its values as it renders; follow it (debounced, and it only
    // redraws when a value actually changed, so watching can never loop).
    if(!hud.dataset.esWatched&&typeof MutationObserver==='function'){
      hud.dataset.esWatched='1';
      let pending=0;
      new MutationObserver(()=>{clearTimeout(pending);pending=setTimeout(()=>{try{renderGame()}catch{}},30)})
        .observe(hud,{childList:true,subtree:true,characterData:true});
    }
    const plan=state?.teamPlan||{};
    const ours=inRoleOrder(rosterOf('ourTeam'));
    const theirs=inRoleOrder(rosterOf('theirTeam'));
    const build=plan.adaptiveBuild||plan.rememberPlan?.adaptiveBuild||null;
    const steps=[...($('opRemWinPath')?.children||[])].map(step=>[clean(step.querySelector('i')?.textContent),clean(step.querySelector('strong')?.textContent)]);
    const data={
      title:val('opRememberTitle'),shape:val('opRemOurShape'),curve:val('opRemEnemyCurve'),
      job:val('opRemGameCall'),why:val('opRemGameCallWhy'),threat:val('opRemThreat'),answer:val('opRemThreatAnswer'),
      carry:val('opRemCarryPrimary'),role:val('opRemCarryRole'),around:val('opRemCarryPlay'),
      mode:val('opRemDecisionCall'),when:val('opRemFightWhen'),stop:val('opRemStopRule'),
      mission:val('opMissionCue')||val('opRemMission'),win:val('opYourWin'),
      live:clean(hud.querySelector('.rem4-live')?.textContent)||'LIVE · RECORDING',
      you:clean(state?.matchup?.champion||state?.matchup?.plan?.you?.name),steps,ours,theirs,
      build:build?[build.patch,build.read,build.core,build.draftItem,build.finish,build.boots,build.swaps]:null,
    };
    const signature=JSON.stringify(data);
    if(!root){root=node('section','es-game');root.id='esGame';hud.before(root)}
    if(root.dataset.signature===signature)return;
    root.dataset.signature=signature;

    // header: who you are, and the shape of both teams
    const [titleMain,titleRest]=data.title.split('//').map(clean);
    const head=node('header','es-g-head');
    const heading=node('div','es-g-title');
    heading.append(node('span','es-g-live',`● ${data.live}`),node('h2','',titleMain||'YOUR GAME PLAN'));
    if(titleRest)heading.querySelector('h2').append(node('small','',` // ${titleRest}`));
    const tags=node('div','es-g-tags');
    if(data.shape)tags.append(node('span','ours',`OUR SHAPE · ${data.shape}`));
    if(data.curve)tags.append(node('span','theirs',`THEIR CURVE · ${data.curve}`));
    head.append(heading,tags);

    // both squads, tagged: you / who you play with / who to fear
    const you=data.you.toLowerCase();
    const linkText=`${steps[1]?.[1]||''} ${data.around}`;
    const threatText=`${data.threat} ${steps[2]?.[1]||''}`;
    const squad=node('div','es-g-squad');
    const side=(people,key)=>{
      const column=node('div',`es-side ${key}`);
      column.append(...people.map(p=>unit(p,key==='ours'?(p.name.toLowerCase()===you?'you':mentions(linkText,p.name)?'link':''):(mentions(threatText,p.name)?'threat':''),key)));
      return column;
    };
    squad.append(side(ours,'ours'),node('div','es-vs','VS'),side(theirs,'theirs'));

    // the two big calls: your job, and the threat to respect
    const jobParts=cut(data.job,ARROW);
    const job=gameCard('job','YOUR JOB');
    job.append(jobParts.length>1?pieceList(jobParts,'big'):node('p','es-g-line',data.job||'PLAY YOUR ROLE'));
    if(data.why)job.append(node('p','es-g-why',data.why));
    const threat=gameCard('threat','MAIN THREAT');
    const threatPerson=namesIn(data.threat,theirs)[0];
    const threatBody=node('div','es-g-threat-body');
    threatBody.append(node('h3','',data.threat||'THEIR ENGAGE'));
    const answers=cut(data.answer,/\s+·\s+/);
    if(answers.length){const list=node('ul','es-g-bullets');answers.forEach(a=>list.append(node('li','',a)));threatBody.append(list)}
    if(threatPerson)threat.append(portrait(threatPerson.name,'es-g-threat-art'));
    threat.append(threatBody);

    // six short rules
    const cells=node('div','es-g-cells');
    [['WHO CARRIES',data.carry,'lime'],['YOUR ROLE',data.role,'blue'],['PLAY AROUND',data.around,'blue'],
      ['FIGHT / FARM',data.mode,'gold'],['FIGHT WHEN',data.when,'lime'],["DON'T",data.stop,'red']]
      .filter(([,value])=>value).forEach(([label,value,tone])=>cells.append(gameCard(`cell ${tone}`,label,node('strong','',value))));

    // your path to winning, step by step
    const path=node('div','es-g-steps');
    steps.slice(0,5).forEach(([label,value])=>{
      const step=node('article','es-g-step');
      step.append(node('span','es-g-label',label),node('strong','',value));
      path.append(step);
    });

    // the team's win condition and your mission
    const winParts=(()=>{const arrows=cut(data.win,ARROW);return arrows.length>1?arrows:cut(data.win,/(?<=[.!?])\s+/)})();
    const win=gameCard('win','OUR WIN CONDITION');
    win.append(winParts.length>1?pieceList(winParts,'inline'):node('p','es-g-line small',data.win));
    const mission=gameCard('mission','YOUR CLIMB MISSION',node('strong','',data.mission));
    const goals=node('div','es-g-goals');
    if(data.win)goals.append(win);
    if(data.mission)goals.append(mission);

    const calls=node('div','es-g-calls');
    calls.append(job,threat);
    root.replaceChildren(head,squad,calls,cells,path,goals);
    if(build){
      const row=node('section','es-g-build');
      const heading2=node('div','es-g-build-head');
      heading2.append(node('span','es-g-label','BUILD FOR THIS GAME'),node('small','',clean(build.read)));
      const grid=node('div','es-g-items');
      grid.append(...buildCards(build));
      row.append(heading2,grid);
      root.append(row);
    }
  }

  function apply(){
    if(!state)return;
    decorateRows('draftOurPicks',Array.isArray(state.draft?.allies)?state.draft.allies:[],{ours:true});
    decorateRows('draftTheirPicks',Array.isArray(state.draft?.enemies)?state.draft.enemies:[],{ours:false});
    decoratePlan();
    decorateMatchPage();
    renderGame();
    decorateReview();
  }

  // renderer.js redraws synchronously when a state arrives; decorate just after.
  const schedule=next=>{state=next||state;setTimeout(()=>{try{apply()}catch{}},0)};
  try{
    window.opCompanion?.getState?.().then(next=>{schedule(next);setTimeout(()=>schedule(),400)}).catch(()=>{});
    window.opCompanion?.onState?.(schedule);
  }catch{}
})();
