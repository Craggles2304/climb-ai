/* OP Climb — Game DNA.
   A rotating double helix on the Coach memory page. Each colour is a gene
   (one part of the game) made of four mission rungs. Learning rungs flicker,
   learned rungs light up, and a rung that holds again later becomes memory:
   thicker and glowing. Gene strands thicken as their genes fill up. */
(() => {
  'use strict';

  const CATS = [
    {id:'lane',   label:'Laning',       hint:'Trades, spacing, level spikes',    color:'#b6f66b'},
    {id:'wave',   label:'Waves & CS',   hint:'Wave states, recalls, farming',    color:'#56d9b8'},
    {id:'vision', label:'Vision & map', hint:'Wards, tracking, map checks',      color:'#b7a4ef'},
    {id:'obj',    label:'Objectives',   hint:'Dragons, Herald, towers, tempo',   color:'#e8c086'},
    {id:'fight',  label:'Teamfights',   hint:'Positioning, targets, engage',     color:'#f99594'},
    {id:'mind',   label:'Mindset',      hint:'Focus, tilt control, consistency', color:'#8fd3ff'}
  ];
  // [gene, mission, state] — 0 not started, 1 learning, 2 learned, 3 memory
  const START = [
    ['lane','Protect the first reset',3],['lane','Trade when their key spell is down',2],['lane','Respect the level-2 spike',1],['lane','Punish their last-hits',0],
    ['wave','Crash the wave before you recall',3],['wave','70 CS by 10:00',2],['wave','Freeze when you are ahead',1],['wave','Reset on the cannon wave',0],
    ['vision','Ward before you step forward',2],['vision','Track the jungler’s first clear',1],['vision','Sweep before objectives',0],['vision','Check the map every wave',0],
    ['obj','Vision 60s before dragon',1],['obj','Rotate after the first tower',0],['obj','Trade objectives cross-map',0],['obj','Play for Herald tempo',0],
    ['fight','Hit the closest safe target',2],['fight','Wait for your engage',1],['fight','Stay behind your frontline',0],['fight','Flash to survive, not to chase',0],
    ['mind','One focus per game',3],['mind','Mute after two deaths',2],['mind','Stop after two losses',1],['mind','Review before you requeue',0]
  ];
  const STATE = ['Not started','Learning','Learned','Memory'];
  const KEY = 'opclimb-dna-v1';
  const FLASH_MS = 1600;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const fresh = () => START.map(([c,n,s],i) => ({c, n, s, t: s >= 2 ? i : -1}));
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

  const catOf = id => CATS.find(c => c.id === id);
  const geneStrength = id => { const ms = missions.filter(m => m.c === id); return ms.reduce((a,m) => a + m.s, 0) / (ms.length * 3); };
  const totalStrength = () => missions.reduce((a,m) => a + m.s, 0) / (missions.length * 3);
  const count = s => missions.filter(m => m.s === s).length;
  const pct = v => Math.round(v * 100) + '%';
  function rgba(hex, a){
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
  }

  function evidence(m, i){
    const gene = catOf(m.c).label;
    if(m.s === 0) return `Not started. It joins your DNA once the current ${gene} mission is learned.`;
    if(m.s === 1) return `Learning now: held in ${1 + (i * 7) % 3} of your last 5 games. Complete it to light up this rung.`;
    if(m.s === 2) return 'Learned: completed in 5 of 5 games. When it holds again later without a reminder, it locks into memory.';
    return 'Memory: held without reminders in later games and a new matchup. If it slips, the coach brings it back for review.';
  }

  function sideHTML(){
    const m = missions[selected] || missions[0];
    const c = catOf(m.c);
    const total = totalStrength();
    const done = count(3) === missions.length;
    return `<div class="dna-strength"><b>${pct(total)}</b><div><span>DNA strength</span><div class="dna-bar"><i style="width:${pct(total)}"></i></div></div><small>${count(3)} memories · ${count(2)} learned · ${count(1)} learning · ${count(0)} to go</small></div>
      <div class="dna-genes">${CATS.map(g => {
        const ms = missions.filter(x => x.c === g.id), s = geneStrength(g.id);
        return `<button class="dna-gene" type="button" data-dna-gene="${g.id}" aria-pressed="${focusGene === g.id}" style="--c:${g.color};--s:${s.toFixed(2)}" aria-label="${g.label}: ${pct(s)} strength, ${ms.filter(x => x.s === 3).length} memories"><i class="dna-dot"></i><span class="dna-gene-name">${g.label}<small>${g.hint}</small></span><span class="dna-pips" aria-hidden="true">${ms.map(x => `<i class="s${x.s}"></i>`).join('')}</span><b>${pct(s)}</b></button>`;
      }).join('')}</div>
      <div class="dna-detail" style="--c:${c.color}" aria-live="polite"><div class="dna-detail-top"><span class="dna-chip">${c.label}</span><span class="dna-state s${m.s}">${STATE[m.s]}</span></div><h3>${m.n}</h3><p>${evidence(m, selected)}</p></div>
      <div class="dna-actions"><button class="btn primary" type="button" data-dna-act="complete"${done ? ' disabled' : ''}>${done ? 'DNA fully written' : 'Complete a mission <span class="dna-demo">demo</span>'}</button><button class="btn btn-small" type="button" data-dna-act="reset">Reset</button></div>`;
  }

  function panel(){
    return `<section class="panel dna-panel" data-dna aria-labelledby="dna-title">
      <div class="dna-visual">
        <canvas class="dna-canvas" role="img" aria-label="Game DNA helix: six coloured genes, one for each part of the game. Lit rungs are learned missions; glowing rungs are locked into memory."></canvas>
        <span class="dna-cap">KAI#EUW · GAME DNA</span>
        <div class="dna-legend" aria-hidden="true"><span><i class="s0"></i>Not started</span><span><i class="s1"></i>Learning</span><span><i class="s2"></i>Learned</span><span><i class="s3"></i>Memory</span></div>
        <div class="dna-tip" hidden></div>
      </div>
      <div class="dna-side">
        <div class="section-head"><span class="eyebrow accent">YOUR GAME DNA · MEMORY</span><span class="tag gold">Pro</span></div>
        <h2 id="dna-title">Every mission writes to memory.</h2>
        <p class="dna-intro">Each colour is a part of your game. Completing a mission lights up its rung. When it holds again in later games, it locks into memory and that part of the strand gets stronger.</p>
        <div data-dna-side>${sideHTML()}</div>
        <p class="footnote">Example missions for the demo player. In the full product, missions come from your own games.</p>
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
    const st = {W:0, H:0, geo:null, hover:-1, padBottom:52};

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
      tip.hidden = true;
    };
    const ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    ro ? ro.observe(canvas) : window.addEventListener('resize', resize);
    resize();

    function draw(now){
      const {W, H} = st;
      ctx.clearRect(0, 0, W, H);
      if(!W || !H) return;
      const top = 46, bottom = H - st.padBottom, N = missions.length;
      const gap = (bottom - top) / (N - 1);
      const cx = W / 2, A = Math.min(W * 0.3, 104);
      const k = (Math.PI * 2 * 2.25) / (bottom - top);
      const phi = reduce ? 0.9 : now * 0.00055;
      const geneSpan = gap * 4;
      const strength = {};
      CATS.forEach(c => { strength[c.id] = geneStrength(c.id); });
      st.geo = {top, gap, cx, A, k, phi};
      flashes = flashes.filter(f => now - f.at < FLASH_MS);
      const geneAt = y => Math.max(0, Math.min(CATS.length - 1, Math.floor((y - top + gap / 2) / geneSpan)));
      const pulse = y => {
        let b = 0;
        for(const f of flashes){
          const p = (now - f.at) / FLASH_MS;
          if(p < 0) continue;
          const d = Math.abs(Math.abs(y - (top + f.i * gap)) - p * Math.max(H, 420));
          if(d < 26) b = Math.max(b, (1 - d / 26) * (1 - p));
        }
        return b;
      };

      const segs = [];
      for(let s = 0; s < 2; s++){
        let prev = null;
        for(let y = top - 16; y <= bottom + 16; y += 5){
          const th = (y - top) * k + phi + s * Math.PI;
          const pt = {x: cx + A * Math.sin(th), y, z: Math.cos(th)};
          if(prev) segs.push({x1: prev.x, y1: prev.y, x2: pt.x, y2: pt.y, z: (pt.z + prev.z) / 2, g: geneAt(y)});
          prev = pt;
        }
      }
      ctx.lineCap = 'round';
      const drawSeg = sg => {
        const g = CATS[sg.g], str = strength[g.id], depth = (sg.z + 1) / 2;
        const dim = focusGene && focusGene !== g.id ? 0.25 : 1;
        const boost = reduce ? 0 : pulse((sg.y1 + sg.y2) / 2);
        const w = (1.4 + 2.8 * str) * (0.65 + 0.35 * depth) + boost * 2.5;
        if(depth > 0.55 && (str > 0.3 || boost > 0)){
          ctx.strokeStyle = rgba(g.color, (0.07 + 0.14 * str) * dim + boost * 0.3);
          ctx.lineWidth = w + 7 * str + boost * 8;
          ctx.beginPath(); ctx.moveTo(sg.x1, sg.y1); ctx.lineTo(sg.x2, sg.y2); ctx.stroke();
        }
        ctx.strokeStyle = rgba(g.color, ((0.18 + 0.82 * depth) * (0.3 + 0.7 * str)) * dim + boost * 0.8);
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(sg.x1, sg.y1); ctx.lineTo(sg.x2, sg.y2); ctx.stroke();
      };
      segs.filter(s => s.z < 0).forEach(drawSeg);

      missions.forEach((m, i) => {
        const y = top + i * gap, th = (y - top) * k + phi;
        const xa = cx + A * Math.sin(th), xb = cx - A * Math.sin(th), za = Math.cos(th);
        const g = catOf(m.c);
        const dim = focusGene && focusGene !== m.c ? 0.22 : 1;
        const f = flashes.find(fl => fl.i === i && now >= fl.at);
        const fp = f ? (now - f.at) / FLASH_MS : 1;
        const flash = f ? Math.max(0, 1 - fp) : 0;
        const look = [
          {a: 0.38, w: 2,   glow: 0},
          {a: 0.45 + (reduce ? 0 : 0.22 * Math.sin(now * 0.004 + i)), w: 2.6, glow: 0},
          {a: 0.95, w: 3.4, glow: 0.18},
          {a: 1,    w: 4.8, glow: 0.32}
        ][m.s];
        const col = m.s === 0 ? '#3a4a50' : g.color;
        const mid = (xa + xb) / 2, gapPx = Math.min(3, Math.abs(xa - xb) * 0.08), dir = xa < xb ? 1 : -1;
        const half = (x1, x2) => { ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); };
        if(look.glow || flash){
          ctx.setLineDash([]);
          ctx.strokeStyle = rgba(g.color, (look.glow + flash * 0.5) * dim);
          ctx.lineWidth = look.w + 8 + flash * 10;
          half(xa, xb);
        }
        ctx.setLineDash(m.s === 1 ? [3, 4] : []);
        ctx.strokeStyle = rgba(col, Math.min(1, look.a + flash) * dim);
        ctx.lineWidth = look.w + flash * 3;
        half(xa, mid - dir * gapPx);
        half(mid + dir * gapPx, xb);
        ctx.setLineDash([]);
        for(const [x, z] of [[xa, za], [xb, -za]]){
          const depth = (z + 1) / 2;
          ctx.fillStyle = rgba(m.s >= 2 ? g.color : '#4a5a60', (0.35 + 0.65 * depth) * dim + flash * 0.6);
          ctx.beginPath(); ctx.arc(x, y, 2 + 2 * depth + (m.s === 3 ? 1.5 : 0) + flash * 3, 0, Math.PI * 2); ctx.fill();
        }
        if(i === selected || i === st.hover){
          ctx.strokeStyle = rgba('#ffffff', i === selected ? 0.9 : 0.5);
          ctx.lineWidth = 1.2;
          for(const x of [xa, xb]){ ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke(); }
        }
        if(flash > 0 && !reduce){
          ctx.strokeStyle = rgba(g.color, flash * 0.8);
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx, y, 10 + 80 * fp, 0, Math.PI * 2); ctx.stroke();
        }
      });
      segs.filter(s => s.z >= 0).forEach(drawSeg);
    }

    (function loop(){
      if(!canvas.isConnected){ ro && ro.disconnect(); return; }
      draw(performance.now());
      requestAnimationFrame(loop);
    })();

    const rungAt = (px, py) => {
      const g = st.geo;
      if(!g) return -1;
      const i = Math.round((py - g.top) / g.gap);
      if(i < 0 || i >= missions.length || Math.abs(py - (g.top + i * g.gap)) > g.gap * 0.6) return -1;
      const th = i * g.gap * g.k + g.phi, dx = Math.abs(g.A * Math.sin(th));
      return Math.abs(px - g.cx) <= dx + 16 ? i : -1;
    };
    canvas.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      const i = rungAt(e.clientX - r.left, e.clientY - r.top);
      st.hover = i;
      canvas.style.cursor = i >= 0 ? 'pointer' : 'default';
      if(i < 0){ tip.hidden = true; return; }
      const m = missions[i], g = catOf(m.c);
      tip.style.setProperty('--c', g.color);
      tip.innerHTML = `<small>${g.label} · ${STATE[m.s]}</small><b>${m.n}</b>`;
      tip.hidden = false;
      tip.style.left = Math.min(e.clientX - r.left + 14, r.width - 230) + 'px';
      tip.style.top = Math.min(e.clientY - r.top + 14, r.height - 64) + 'px';
    });
    canvas.addEventListener('pointerleave', () => { st.hover = -1; tip.hidden = true; });
    canvas.addEventListener('click', e => {
      const r = canvas.getBoundingClientRect();
      const i = rungAt(e.clientX - r.left, e.clientY - r.top);
      if(i >= 0){ selected = i; refresh(); }
    });
    side.addEventListener('click', e => {
      const geneBtn = e.target.closest('[data-dna-gene]');
      if(geneBtn){
        const id = geneBtn.dataset.dnaGene;
        focusGene = focusGene === id ? null : id;
        if(focusGene){
          const ms = missions.map((m,i) => i).filter(i => missions[i].c === id);
          selected = ms.find(i => missions[i].s === 1) ?? ms.reduce((a,b) => missions[b].s > missions[a].s ? b : a);
        }
        refresh(`[data-dna-gene="${id}"]`);
        return;
      }
      const act = e.target.closest('[data-dna-act]')?.dataset.dnaAct;
      if(act === 'complete'){ complete(); refresh('[data-dna-act="complete"]'); }
      if(act === 'reset'){ reset(); refresh('[data-dna-act="reset"]'); }
    });
  }

  window.opDna = {panel};
  const content = document.getElementById('content');
  if(content){
    new MutationObserver(() => {
      const el = content.querySelector('[data-dna]:not([data-mounted])');
      if(el) mount(el);
    }).observe(content, {childList:true});
  }
})();
