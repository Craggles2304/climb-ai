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

  function apply(){
    if(!state)return;
    decorateRows('draftOurPicks',Array.isArray(state.draft?.allies)?state.draft.allies:[],{ours:true});
    decorateRows('draftTheirPicks',Array.isArray(state.draft?.enemies)?state.draft.enemies:[],{ours:false});
    decoratePlan();
    decorateReview();
  }

  // renderer.js redraws synchronously when a state arrives; decorate just after.
  const schedule=next=>{state=next||state;setTimeout(()=>{try{apply()}catch{}},0)};
  try{
    window.opCompanion?.getState?.().then(next=>{schedule(next);setTimeout(()=>schedule(),400)}).catch(()=>{});
    window.opCompanion?.onState?.(schedule);
  }catch{}
})();
