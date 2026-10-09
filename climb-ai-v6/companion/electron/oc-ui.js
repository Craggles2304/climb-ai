/* OP CLIMB Companion — shared view helpers.
 *
 * Small, dependency-free builders used by the native views (Home, Champion
 * Select, Review). Every string that came from the server or the League
 * client goes through esc() before it reaches innerHTML.
 */
(()=>{
  'use strict';

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const text=value=>String(value??'').trim();
  const upper=value=>text(value).toUpperCase();
  const num=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?n:fallback};
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const titleCase=value=>text(value).toLowerCase().replace(/\b[a-z]/g,ch=>ch.toUpperCase()).replace(/\b(Ii|Iii|Iv)\b/g,m=>m.toUpperCase());
  const roleName=value=>({TOP:'Top',JUNGLE:'Jungle',MID:'Mid',MIDDLE:'Mid',ADC:'ADC',BOTTOM:'ADC',SUPPORT:'Support',UTILITY:'Support'})[upper(value)]||'';
  const roleKey=value=>({TOP:'TOP',JUNGLE:'JUNGLE',MID:'MID',MIDDLE:'MID',ADC:'ADC',BOTTOM:'ADC',SUPPORT:'SUPPORT',UTILITY:'SUPPORT'})[upper(value)]||'';

  /* ------------------------------------------------- champion artwork -- */
  // Data Dragon ids that are not just the name without punctuation.
  const SPECIAL_IDS={
    'Aurelion Sol':'AurelionSol',"Bel'Veth":'Belveth',"Cho'Gath":'Chogath','Dr. Mundo':'DrMundo',
    'Jarvan IV':'JarvanIV',"Kai'Sa":'Kaisa',"Kha'Zix":'Khazix',"K'Sante":'KSante','LeBlanc':'Leblanc',
    'Lee Sin':'LeeSin','Master Yi':'MasterYi','Miss Fortune':'MissFortune','Nunu & Willump':'Nunu',"Rek'Sai":'RekSai',
    'Renata Glasc':'Renata','Tahm Kench':'TahmKench','Twisted Fate':'TwistedFate',"Vel'Koz":'Velkoz','Wukong':'MonkeyKing','Xin Zhao':'XinZhao',
  };
  function championId(name){
    const clean=text(name);
    if(!clean||/pending|tbd|waiting|unknown|selecting|not revealed|picking|choosing/i.test(clean))return'';
    return SPECIAL_IDS[clean]||clean.replace(/[^A-Za-z0-9]/g,'');
  }
  const DDRAGON='https://ddragon.leagueoflegends.com/cdn/img/champion';
  const splashUrl=name=>{const id=championId(name);return id?`${DDRAGON}/splash/${encodeURIComponent(id)}_0.jpg`:''};
  const tileUrl=name=>{const id=championId(name);return id?`${DDRAGON}/tiles/${encodeURIComponent(id)}_0.jpg`:''};
  const initials=name=>text(name).replace(/[^A-Za-z ]/g,'').split(/\s+/).filter(Boolean).map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?';

  /** A champion portrait that falls back to initials, never to a guess. */
  function portrait(name,{size='',side='',you=false,hovering=false,label=''}={}){
    const url=tileUrl(name);
    const cls=['oc-portrait',size&&`oc-portrait--${size}`,side&&`oc-portrait--${side}`,you&&'oc-portrait--you',hovering&&'is-hovering',!url&&'oc-portrait--unknown'].filter(Boolean).join(' ');
    const alt=label||text(name)||'Unknown champion';
    return `<div class="${cls}" role="img" aria-label="${esc(alt)}">${url?`<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">${esc(initials(name))}`:'?'}</div>`;
  }

  /* ---------------------------------------------------------- graphics -- */
  /** Progress ring. value/prev are 0–100. A locked ring draws no fill. */
  function ring({value=0,prev=null,size='',center='',label='',locked=false,tone='',aria=''}={}){
    const v=clamp(Math.round(num(value)),0,100);
    const cls=['oc-ring',size&&`oc-ring--${size}`,locked&&'oc-ring--locked',!locked&&v===0&&'is-empty',tone&&`oc-tone-${tone}`].filter(Boolean).join(' ');
    const style=`--oc-value:${v}${prev!=null?`;--oc-prev:${clamp(Math.round(num(prev)),0,100)}`:''}`;
    const r=size==='sm'?50:size==='xl'?55:size==='lg'?54:52;
    const circle=c=>`<circle class="oc-ring__${c}" cx="60" cy="60" r="${r}" pathLength="100"/>`;
    return `<div class="${cls}" style="${style}" role="img" aria-label="${esc(aria||label||`${v}%`)}"><svg viewBox="0 0 120 120" aria-hidden="true">${circle('track')}${prev!=null?circle('ghost'):''}${circle('fill')}${prev!=null?circle('mark'):''}</svg><div class="oc-ring__center">${center}${label?`<span class="oc-ring__label">${esc(label)}</span>`:''}</div></div>`;
  }

  /** Discrete verified progress, e.g. 2 of 3 proven games. */
  function steps(done,total,{current=false,tone='',aria=''}={}){
    const count=clamp(Math.round(num(total,3)),1,12);
    const filled=clamp(Math.round(num(done)),0,count);
    let html='';
    for(let i=0;i<count;i++)html+=`<span class="${i<filled?'is-done':current&&i===filled?'is-current':''}"></span>`;
    return `<div class="oc-steps${tone?` oc-tone-${tone}`:''}" role="img" aria-label="${esc(aria||`${filled} of ${count}`)}">${html}</div>`;
  }

  const ICONS={
    lock:'<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    external:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    play:'<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
    dna:'<path d="M7 3c0 6 10 6 10 12s-10 3-10 6M17 3c0 6-10 6-10 12s10 3 10 6M8.6 7.5h6.8M8.6 16.5h6.8"/>',
    review:'<path d="M3 12h3l2.5-6 4 12 3-9 2 3H21"/>',
    target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    shield:'<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/>',
    sword:'<path d="M14.5 4H20v5.5L9 20.5 3.5 15zM7 13l4 4M4 20l2-2"/>',
    flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    bookmark:'<path d="M6 3.5h12v17l-6-4-6 4z"/>',
    clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  };
  const icon=(name,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||''}</svg>`;

  /* ---------------------------------------------------------- game DNA -- */
  // Summaries match lib/dnaDomain.ts DNA_DOMAIN_GUIDE on the website.
  const DNA=[
    {domain:'LANING',     short:'Laning',      tone:'laning',      summary:'How you create, protect and convert advantages before the map opens up.'},
    {domain:'WAVES_CS',   short:'Waves & CS',  tone:'waves',       summary:'How you control waves and turn safe resources into gold, recalls and item timings.'},
    {domain:'VISION_MAP', short:'Vision & Map',tone:'vision',      summary:'How well you gather and use information before you commit.'},
    {domain:'OBJECTIVES', short:'Objectives',  tone:'objectives',  summary:'How you prepare for and convert pressure around the things that win the map.'},
    {domain:'TEAMFIGHTS', short:'Teamfights',  tone:'teamfights',  summary:'How you position, survive and make decisions when teams collide.'},
    {domain:'CONSISTENCY',short:'Consistency', tone:'consistency', summary:'Whether good decisions become habits that survive different games and situations.'},
  ];
  const dnaMeta=domain=>DNA.find(item=>item.domain===upper(domain))||null;
  const dnaColor=domain=>`var(--oc-dna-${dnaMeta(domain)?.tone||'laning'})`;

  /** Merge the server strands onto the fixed six-domain order. */
  function dnaStrands(home){
    const rows=Array.isArray(home?.dna)?home.dna:[];
    return DNA.map(meta=>{
      const row=rows.find(item=>upper(item?.domain)===meta.domain)||{};
      return{...meta,label:text(row.label)||meta.short,level:Math.max(1,num(row.level,1)),levelProgress:clamp(num(row.levelProgress),0,100),
        xpIntoLevel:Math.max(0,num(row.xpIntoLevel)),xpForNextLevel:Math.max(1,num(row.xpForNextLevel,100)),mastered:Math.max(0,num(row.mastered)),totalXp:Math.max(0,num(row.totalXp))};
    });
  }

  /** The DNA state the player is in. Nothing is shown as progress until it is real. */
  function dnaStage(home){
    const baseline=home?.baseline||{};
    const required=Math.max(1,num(baseline.required,3));
    const games=clamp(num(baseline.games),0,required);
    const role=roleKey(home?.selectedRole||home?.player?.role);
    if(!baseline.ready)return{stage:'baseline',games,required,role};
    let revealed=false;
    try{revealed=Boolean(role)&&localStorage.getItem('op:dna-revealed:'+role)==='1'}catch{}
    return{stage:revealed?'active':'reveal',games:required,required,role};
  }
  function markRevealed(role){try{if(role)localStorage.setItem('op:dna-revealed:'+roleKey(role),'1')}catch{}}

  /** Hexagonal "player shape" from real strand levels. */
  function dnaRadar(strands,{size=300,revealed=true,center=''}={}){
    const c=size/2,R=size/2-46;
    const ang=i=>(-90+i*60)*Math.PI/180;
    const pt=(i,r)=>[c+Math.cos(ang(i))*r,c+Math.sin(ang(i))*r];
    const poly=r=>strands.map((_,i)=>pt(i,r).map(n=>n.toFixed(1)).join(',')).join(' ');
    // Side labels run outwards, so the viewBox has room either side of the hexagon.
    const pad=70;
    let svg=`<svg class="oc-radar" viewBox="${-pad} 0 ${size+pad*2} ${size}" role="img" aria-label="Game DNA shape">`;
    [1,.75,.5,.25].forEach((f,i)=>{svg+=`<polygon class="oc-radar__grid${i===0?' is-outer':''}" points="${poly(R*f)}"/>`});
    strands.forEach((_,i)=>{const [x,y]=pt(i,R);svg+=`<line class="oc-radar__axis" x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`});
    if(revealed){
      const values=strands.map(s=>(s.level-1)+s.levelProgress/100);
      const scale=Math.max(3,Math.ceil(Math.max(...values)+.25));
      const points=values.map((v,i)=>pt(i,R*clamp(v/scale,0,1)));
      svg+=`<g class="oc-radar__shape"><polygon class="oc-radar__fill" points="${points.map(p=>p.map(n=>n.toFixed(1)).join(',')).join(' ')}"/>`;
      points.forEach((p,i)=>{svg+=`<circle class="oc-radar__dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5" style="fill:${dnaColor(strands[i].domain)}"/>`});
      svg+='</g>';
    }
    strands.forEach((s,i)=>{
      const [x,y]=pt(i,R+(i%3===0?24:16));
      const anchor=Math.abs(x-c)<4?'middle':x>c?'start':'end';
      svg+=`<text class="oc-radar__label" x="${x.toFixed(1)}" y="${(y-4).toFixed(1)}" text-anchor="${anchor}">${esc(s.short.toUpperCase())}</text>`;
      svg+=`<text class="oc-radar__level" x="${x.toFixed(1)}" y="${(y+12).toFixed(1)}" text-anchor="${anchor}" style="fill:${revealed?dnaColor(s.domain):'var(--oc-text-3)'}">${revealed?`LV ${s.level}`:'—'}</text>`;
    });
    svg+='</svg>';
    return `<div class="oc-radar-wrap">${svg}${center?`<div class="oc-radar__center">${center}</div>`:''}</div>`;
  }

  /* ---------------------------------------------------- local memories -- */
  /** The last champion the player actually played or locked, for hero art. */
  function rememberChampion(state){
    const phase=upper(state?.phase);
    const locked=phase==='CHAMP_SELECT'&&state?.draft?.localLockedIn?text(state?.draft?.localChampionName):'';
    const name=text(state?.postGameReview?.match?.champion)||(phase==='RECORDING'?text(state?.matchup?.champion):'')||locked;
    if(!name||!championId(name))return;
    try{localStorage.setItem('oc:last-champion',JSON.stringify({name,at:Date.now()}))}catch{}
  }
  function lastChampion(){
    try{const value=JSON.parse(localStorage.getItem('oc:last-champion')||'null');return text(value?.name)?value:null}catch{return null}
  }

  /** Whether the player has opened this post-game review yet. */
  const reviewKey=review=>text(review?.sessionId||review?.matchId);
  function reviewSeen(review){const key=reviewKey(review);if(!key)return true;try{return localStorage.getItem('oc:review-seen')===key}catch{return true}}
  function markReviewSeen(review){const key=reviewKey(review);if(key)try{localStorage.setItem('oc:review-seen',key)}catch{}}
  const clock=seconds=>{const s=Math.max(0,Math.floor(num(seconds)));return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`};

  window.ocUI={esc,text,upper,num,clamp,titleCase,roleName,roleKey,championId,splashUrl,tileUrl,portrait,ring,steps,icon,
    DNA,dnaMeta,dnaColor,dnaStrands,dnaStage,markRevealed,dnaRadar,rememberChampion,lastChampion,reviewSeen,markReviewSeen,clock};
})();
