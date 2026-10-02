/* OP Climb — Game DNA.
   A rotating neon double helix on the Coach memory page. Each colour is a gene
   (one part of the game) made of four mission rungs. Learning rungs flicker,
   learned rungs light up with energy running across them, and a rung that holds
   again later becomes memory: thicker, brighter and pulsing. Gene strands glow
   brighter and shed more particles as their genes fill up. */
(() => {
  'use strict';

  const CATS = [
    {id:'lane',   label:'Laning',       hud:'LANING',     hint:'Trades, spacing, level spikes',    color:'#b6ff2e'},
    {id:'wave',   label:'Waves & CS',   hud:'WAVES',      hint:'Wave states, recalls, farming',    color:'#00f5d4'},
    {id:'vision', label:'Vision & map', hud:'VISION',     hint:'Wards, tracking, map checks',      color:'#a46bff'},
    {id:'obj',    label:'Objectives',   hud:'OBJECTIVES', hint:'Dragons, Herald, towers, tempo',   color:'#ffb21e'},
    {id:'fight',  label:'Teamfights',   hud:'FIGHTS',     hint:'Positioning, targets, engage',     color:'#ff3d71'},
    {id:'mind',   label:'Consistency',  hud:'CONSISTENCY',hint:'Repeat, recovery, transfer, autonomy', color:'#2ec7ff'}
  ];
  // [gene, mission, state] — 0 not started, 1 learning, 2 learned, 3 memory
  const DEMO_START = [
    ['lane','Protect the first reset',3],['lane','Trade when their key spell is down',2],['lane','Respect the level-2 spike',1],['lane','Punish their last-hits',0],
    ['wave','Crash the wave before you recall',3],['wave','70 CS by 10:00',2],['wave','Freeze when you are ahead',1],['wave','Reset on the cannon wave',0],
    ['vision','Ward before you step forward',2],['vision','Track the jungler’s first clear',1],['vision','Sweep before objectives',0],['vision','Check the map every wave',0],
    ['obj','Vision 60s before dragon',1],['obj','Rotate after the first tower',0],['obj','Trade objectives cross-map',0],['obj','Play for Herald tempo',0],
    ['fight','Hit the closest safe target',2],['fight','Wait for your engage',1],['fight','Stay behind your frontline',0],['fight','Flash to survive, not to chase',0],
    ['mind','One focus per game',3],['mind','Mute after two deaths',2],['mind','Stop after two losses',1],['mind','Review before you requeue',0]
  ];
  let START = DEMO_START.map(row=>[...row]);
  let realMode = false;
  let previewMode = false;
  let previewTier = 'FREE';
  let playerLabel = 'KAI#EUW';
  let roleLabel = 'ADC';
  let baselineGames = 3;
  let baselineRequired = 3;
  let baselineMode = false;
  const STATE = ['Not started','Learning','Learned','Memory'];
  const stateLabel = s => previewMode ? (s===0?'Locked':s===1?'Current focus':s===2?'Current evidence':'Memory') : STATE[s];
  const KEY = 'opclimb-dna-v1';
  const FLASH_MS = 1600;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const fresh = () => START.map(([c,n,s,p,l,lp,xpi,xpn],i) => ({c, n, s, p: Number.isFinite(Number(p)) ? Math.max(0,Math.min(100,Number(p))) : Math.round((Number(s)||0)/3*100), l:Math.max(1,Math.round(Number(l)||1)), lp:Math.max(0,Math.min(100,Math.round(Number(lp)||0))), xpi:Math.max(0,Math.round(Number(xpi)||0)), xpn:Math.max(1,Math.round(Number(xpn)||100)), t: s >= 2 ? i : -1}));
  function load(){
    try{
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if(Array.isArray(saved) && saved.length === START.length && saved.every(m => m && typeof m.n === 'string' && CATS.some(c => c.id === m.c) && [0,1,2,3].includes(m.s) && typeof m.t === 'number')) return saved;
    }catch{}
    return fresh();
  }
  const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(missions)); }catch{} };

  let missions = load();
  let clock = Math.max(START.length, ...missions.map(m => m.t));
  let selected = missions.findIndex(m => m.s === 1);
  let focusGene = null;
  let flashes = [];

  function configure(input){
    if(!input||!Array.isArray(input.missions))return;
    const rows=input.missions
      .filter(m=>m&&CATS.some(cat=>cat.id===m.c)&&typeof m.n==='string'&&[0,1,2,3].includes(Number(m.s)))
      .map(m=>[m.c,String(m.n).slice(0,120),Number(m.s),Number.isFinite(Number(m.p))?Math.max(0,Math.min(100,Number(m.p))):Math.round(Number(m.s)/3*100),Math.max(1,Math.round(Number(m.level)||1)),Math.max(0,Math.min(100,Math.round(Number(m.levelProgress)||0))),Math.max(0,Math.round(Number(m.xpIntoLevel)||0)),Math.max(1,Math.round(Number(m.xpForNextLevel)||100))]);
    if(!rows.length)return;
    realMode=Boolean(input.real);
    previewMode=Boolean(input.preview);
    previewTier=String(input.tier||previewTier).toUpperCase().slice(0,12);
    playerLabel=String(input.player||playerLabel).slice(0,48);
    roleLabel=String(input.role||roleLabel).trim().toUpperCase().slice(0,16)||'ROLE';
    baselineRequired=Math.max(1,Math.round(Number(input.baselineRequired)||3));
    const incomingBaselineGames=Number(input.baselineGames);
    baselineGames=Number.isFinite(incomingBaselineGames)?Math.max(0,Math.round(incomingBaselineGames)):baselineRequired;
    baselineMode=baselineGames<baselineRequired;
    START=rows;
    missions=fresh();
    clock=Math.max(START.length,...missions.map(m=>m.t));
    selected=missions.findIndex(m=>m.s===1);
    if(selected<0)selected=missions.findIndex(m=>m.s>=2);
    if(selected<0)selected=0;
    focusGene=null;
    flashes=[];
  }

  const catOf = id => CATS.find(c => c.id === id);
  const geneLevel = id => missions.find(m=>m.c===id) || {l:1,lp:0,xpi:0,xpn:100};
  const geneStrength = id => {
    if(baselineMode)return 0;
    const m=geneLevel(id);
    const level=Math.max(1,Number(m.l)||1);
    const step=Math.max(0,Math.min(1,(Number(m.lp)||0)/100));
    return Math.min(.92,.18+Math.log2(level+1)*.12+step*.18);
  };
  const count = s => missions.filter(m => m.s === s).length;
  function rgba(hex, a){
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
  }

  function evidence(m, i){
    const gene = catOf(m.c).label;
    if(previewMode){
      if(m.s === 0) return `Preview only. ${gene} stays dim until PRO can carry evidence across games and situations.`;
      if(m.s === 1) return 'Current focus from your eligible coaching window. It is visible now, but it is not written into persistent memory.';
      if(m.s === 2) return 'Current-game evidence is strong here. PRO tests whether the read transfers and still holds later.';
      return 'Persistent memory is a PRO feature.';
    }
    if(m.s === 0) return `Not started. It joins your DNA once the current ${gene} mission is learned.`;
    if(m.s === 1) return `Learning now: held in ${1 + (i * 7) % 3} of your last 5 games. Complete it to light up this rung.`;
    if(m.s === 2) return 'Learned: completed in 5 of 5 games. When it holds again later without a reminder, it locks into memory.';
    return 'Memory: held without reminders in later games and a new matchup. If it slips, the coach brings it back for review.';
  }

  function sideHTML(){
    if(baselineMode){
      const completed=Math.min(baselineGames,baselineRequired);
      return `<div class="dna-strength"><b>LV 1</b><div><span>DNA levels</span><div class="dna-bar"><i style="width:0%"></i></div></div><small>${completed}/${baselineRequired} baseline games complete · levels unlock after baseline</small></div>
        <div class="dna-genes">${CATS.map(g => `<button class="dna-gene" type="button" disabled style="--c:#7e898d;--s:0"><i class="dna-dot"></i><span class="dna-gene-name">${g.label}<small>${g.hint}</small></span><span class="dna-pips" aria-hidden="true"><i class="s0"></i></span><b>LV 1</b></button>`).join('')}</div>
        <div class="dna-detail" style="--c:#7e898d"><div class="dna-detail-top"><span class="dna-chip">BASELINE</span><span class="dna-state s0">${completed}/${baselineRequired} GAMES</span></div><h3>${completed===0?'Start with three real games.':completed<baselineRequired?'Keep playing. OP CLIMB is still learning you.':'Baseline ready.'}</h3><p>The first three tracked games are observation only. Your DNA stays at zero while OP CLIMB learns what you already do well, what repeats, and which challenges should come first.</p></div>`;
    }
    const m = missions[selected] || missions[0];
    const c = catOf(m.c);
    const done = count(3) === missions.length;
    const liveSignals=count(1)+count(2);
    const selectedLevel=geneLevel(m.c);
    return `<div class="dna-strength"><b>UNCAPPED</b><div><span>DNA levels</span><div class="dna-bar"><i style="width:${Math.max(4,Number(selectedLevel.lp)||0)}%"></i></div></div><small>Every strand levels independently · mission progress never means the strand is finished</small></div>
      <div class="dna-genes">${CATS.map(g => {
        const ms = missions.filter(x => x.c === g.id), s = geneStrength(g.id), active = ms.some(x=>x.s>0), level=geneLevel(g.id);
        return `<button class="dna-gene" type="button" data-dna-gene="${g.id}" aria-pressed="${focusGene === g.id}" style="--c:${g.color};--s:${s.toFixed(2)}" aria-label="${g.label}: level ${level.l}, ${level.xpi} of ${level.xpn} XP to next level"><i class="dna-dot"></i><span class="dna-gene-name">${g.label}<small>${g.hint} · ${level.xpi}/${level.xpn} XP</small></span><span class="dna-pips" aria-hidden="true">${ms.map(x => `<i class="s${x.s}"></i>`).join('')}</span><b>LV ${level.l}</b></button>`;
      }).join('')}</div>
      <div class="dna-detail" style="--c:${c.color}" aria-live="polite"><div class="dna-detail-top"><span class="dna-chip">${c.label} · LV ${selectedLevel.l}</span><span class="dna-state s${m.s}">${Math.round(Number(m.p)||0)}% MISSION</span></div><h3>${m.n}</h3><p>${selectedLevel.xpi}/${selectedLevel.xpn} DNA XP to Level ${Number(selectedLevel.l)+1}. ${evidence(m, selected)}</p></div>
      ${realMode?'':`<div class="dna-actions"><button class="btn primary" type="button" data-dna-act="complete"${done ? ' disabled' : ''}>${done ? 'DNA fully written' : 'Complete a mission <span class="dna-demo">demo</span>'}</button><button class="btn btn-small" type="button" data-dna-act="reset">Reset</button></div>`}`;
  }

  function panel(input){
    if(input)configure(input);
    return `<section class="panel dna-panel${previewMode?' dna-is-preview':''}${baselineMode?' dna-baseline':''}" data-dna aria-labelledby="dna-title">
      <div class="dna-visual">
        <canvas class="dna-canvas" role="img" aria-label="${baselineMode?'Game DNA baseline at zero while the first three tracked games are observed.':previewMode?'Game DNA preview showing current eligible signals and locked future strands.':'Game DNA helix: six development strands that grow from proven learning evidence.'}"></canvas>
        <span class="dna-cap">${previewMode?roleLabel+' GAME DNA PREVIEW':roleLabel+' GAME DNA'} <em>//</em> ${playerLabel}</span>
        <span class="dna-seq"><i></i>${baselineMode?`BASELINE ${Math.min(baselineGames,baselineRequired)}/${baselineRequired}`:previewMode?`${count(1)+count(2)} LIVE · ${count(0)} LOCKED`:`${missions.length} CHALLENGES SEQUENCED`}</span>
        <div class="dna-legend" aria-hidden="true">${baselineMode?'<span><i class="s0"></i>Baseline building</span>':previewMode?'<span><i class="s0"></i>Locked</span><span><i class="s1"></i>Current focus</span><span><i class="s2"></i>Current evidence</span><span><i class="s3"></i>PRO memory</span>':'<span><i class="s0"></i>Not started</span><span><i class="s1"></i>Learning</span><span><i class="s2"></i>Learned</span><span><i class="s3"></i>Memory</span>'}</div>
        <div class="dna-tip" hidden></div>
      </div>
      <div class="dna-side">
        <div class="section-head"><span class="eyebrow accent">${baselineMode?roleLabel+' GAME DNA · BUILDING':previewMode?roleLabel+' GAME DNA · PREVIEW':roleLabel+' GAME DNA · MEMORY'}</span><span class="tag gold">${baselineMode?`${Math.min(baselineGames,baselineRequired)} / ${baselineRequired}`:previewMode?previewTier+' PREVIEW':'Pro'}</span></div>
        <h2 id="dna-title">${baselineMode?'Three games before your DNA begins.':previewMode?'See what your DNA could become.':'Your DNA levels never stop.'}</h2>
        <p class="dna-intro">${baselineMode?`This is your ${roleLabel} DNA only. Games 1–3 in this role are observation. Other roles build separate DNA profiles.`:previewMode?`This preview is for ${roleLabel}. Each role has its own separate DNA, levels, missions and history.`:`This is your ${roleLabel} DNA only. Each role has separate strands, levels, missions and history; only games played in ${roleLabel} progress this profile.`}</p>
        <div data-dna-side>${sideHTML()}</div>
        ${previewMode?'<p class="footnote">Preview only: no persistent memories are being created on this plan.</p>':realMode?'<p class="footnote">Your Game DNA is built from your authenticated coaching missions and their real evidence state.</p>':'<p class="footnote">Example missions for the demo player. In the full product, missions come from your own games.</p>'}
      </div>
    </section>`;
  }

  function toast(text){
    const el = document.getElementById('toast');
    if(!el) return;
    el.textContent = text;
    el.classList.add('visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('visible'), 3600);
  }

  function complete(){
    const now = performance.now();
    const learning = missions.map((m,i) => i).filter(i => missions[i].s === 1)
      .sort((a,b) => geneStrength(missions[a].c) - geneStrength(missions[b].c) || a - b);
    let msg = '';
    let target = -1;
    if(learning.length){
      target = learning[0];
      missions[target].s = 2;
      missions[target].t = ++clock;
      flashes.push({i:target, at:now});
      msg = `Mission complete: ${missions[target].n}.`;
    }
    // Spaced repetition: the oldest learned lesson is tested again and holds.
    const older = missions.map((m,i) => i).filter(i => missions[i].s === 2 && i !== target).sort((a,b) => missions[a].t - missions[b].t)[0];
    if(older !== undefined){
      missions[older].s = 3;
      flashes.push({i:older, at:now + 350});
      msg += ` ${missions[older].n} held again: locked into memory.`;
    }
    // The next mission in the same gene starts learning (or the next anywhere).
    const gene = target >= 0 ? missions[target].c : null;
    let next = missions.findIndex(m => m.s === 0 && m.c === gene);
    if(next < 0) next = missions.findIndex(m => m.s === 0);
    if(next >= 0) missions[next].s = 1;
    if(!msg) msg = 'Your DNA is fully written.';
    selected = target >= 0 ? target : (older !== undefined ? older : selected);
    save();
    toast(msg.trim());
  }

  function reset(){
    missions = fresh();
    clock = START.length;
    selected = missions.findIndex(m => m.s === 1);
    focusGene = null;
    flashes = [];
    save();
    toast('DNA reset to the example starting point.');
  }

  function mount(root){
    root.dataset.mounted = '1';
    const canvas = root.querySelector('.dna-canvas');
    const tip = root.querySelector('.dna-tip');
    const legend = root.querySelector('.dna-legend');
    const side = root.querySelector('[data-dna-side]');
    const ctx = canvas.getContext('2d');
    const st = {W:0, H:0, geo:null, hover:-1, padBottom:52, parts:[], last:0};

    const refresh = focusSel => {
      side.innerHTML = sideHTML();
      if(focusSel) side.querySelector(focusSel)?.focus({preventScroll:true});
    };
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const d = Math.min(2, window.devicePixelRatio || 1);
      st.W = r.width; st.H = r.height;
      canvas.width = Math.round(r.width * d);
      canvas.height = Math.round(r.height * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      // Keep the helix clear of the legend, which wraps to two lines on phones.
      st.padBottom = (legend ? legend.offsetHeight : 0) + 26;
      st.hover = -1;
      st.parts = [];
      tip.hidden = true;
    };
    const ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    ro ? ro.observe(canvas) : window.addEventListener('resize', resize);
    resize();

    // Neon primitives: a wide faint halo, a tighter glow, the coloured tube and a white-hot core.
    const path = pts => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for(let p = 1; p < pts.length; p++) ctx.lineTo(pts[p].x, pts[p].y); ctx.stroke(); };
    const seg = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    function neon(draw, color, w, i, layers = 4){
      if(i <= 0.01) return;
      if(layers > 2){ ctx.strokeStyle = rgba(color, 0.08 * i); ctx.lineWidth = w + 12; draw(); }
      ctx.strokeStyle = rgba(color, 0.24 * i); ctx.lineWidth = w + 4.5; draw();
      ctx.strokeStyle = rgba(color, Math.min(1, 0.92 * i)); ctx.lineWidth = w; draw();
      if(layers > 2){ ctx.strokeStyle = rgba('#ffffff', Math.min(0.9, 0.5 * i * i)); ctx.lineWidth = Math.max(0.6, w * 0.38); draw(); }
    }
    const dot = (x, y, r, color, a) => { if(a <= 0.01 || r <= 0) return; ctx.fillStyle = rgba(color, a); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    function reticle(x, y, a, now){
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(reduce ? Math.PI / 4 : Math.PI / 4 + now * 0.0016);
      ctx.strokeStyle = rgba('#ffffff', a);
      ctx.lineWidth = 1.3;
      const s = 9, l = 4;
      for(const [sx, sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
        ctx.beginPath(); ctx.moveTo(sx * s, sy * (s - l)); ctx.lineTo(sx * s, sy * s); ctx.lineTo(sx * (s - l), sy * s); ctx.stroke();
      }
      ctx.restore();
    }

    function draw(now){
      const {W, H} = st;
      const dt = Math.min(50, st.last ? now - st.last : 16);
      st.last = now;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);
      if(!W || !H) return;
      const top = 46, bottom = H - st.padBottom, N = missions.length;
      const gap = (bottom - top) / (N - 1);
      const hud = W >= 380;
      const cx = W / 2, A = Math.min(W * (hud ? 0.25 : 0.3), 100);
      const k = (Math.PI * 2 * 2.25) / (bottom - top);
      const phi = reduce ? 0.9 : now * 0.0007;
      const geneSpan = gap * 4;
      const strength = {};
      CATS.forEach(c => { strength[c.id] = geneStrength(c.id); });
      st.geo = {top, gap, cx, A, k, phi};
      flashes = flashes.filter(f => now - f.at < FLASH_MS);
      const geneAt = y => Math.max(0, Math.min(CATS.length - 1, Math.floor((y - top + gap / 2) / geneSpan)));
      const dimOf = id => focusGene && focusGene !== id ? 0.2 : 1;
      const scanY = reduce ? -9999 : top - 60 + ((now % 4600) / 3400) * (bottom - top + 120);
      const scan = y => reduce ? 0 : Math.max(0, 1 - Math.abs(y - scanY) / 38);
      const pulse = y => {
        let b = 0;
        for(const f of flashes){
          const p = (now - f.at) / FLASH_MS;