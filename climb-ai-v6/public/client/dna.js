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
    {id:'mind',   label:'Mindset',      hud:'MINDSET',    hint:'Focus, tilt control, consistency', color:'#2ec7ff'}
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
        <canvas class="dna-canvas" role="img" aria-label="Game DNA helix: six neon genes, one for each part of the game. Lit rungs are learned missions; pulsing rungs are locked into memory."></canvas>
        <span class="dna-cap">GAME DNA <em>//</em> KAI#EUW</span>
        <span class="dna-seq"><i></i>${START.length} MISSIONS SEQUENCED</span>
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
          if(p < 0) continue;
          const d = Math.abs(Math.abs(y - (top + f.i * gap)) - p * Math.max(H, 420));
          if(d < 24) b = Math.max(b, (1 - d / 24) * (1 - p));
        }
        return b;
      };

      // HUD: gene sections, labels and readouts.
      ctx.lineCap = 'round';
      CATS.forEach((g, gi) => {
        const s = strength[g.id], dim = dimOf(g.id);
        const y0 = top + gi * geneSpan - gap / 2, yc = y0 + geneSpan / 2;
        if(gi){ ctx.strokeStyle = rgba('#2ec7ff', 0.07); ctx.lineWidth = 1; ctx.setLineDash([2, 6]); seg(10, y0, W - 10, y0); ctx.setLineDash([]); }
        ctx.fillStyle = rgba(g.color, (0.9 * s + 0.3) * 0.08 * dim);
        ctx.fillRect(4, y0 + 3, 2, geneSpan - 6);
        if(!hud) return;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
        ctx.fillStyle = rgba(g.color, (0.45 + 0.55 * s) * dim);
        ctx.fillText(`0${gi + 1} ${g.hud}`, 14, yc - 7);
        ctx.fillStyle = rgba('#ffffff', 0.08 * dim);
        ctx.fillRect(14, yc + 3, 56, 2);
        ctx.fillStyle = rgba(g.color, (0.6 + 0.4 * s) * dim);
        ctx.fillRect(14, yc + 3, 56 * s, 2);
        ctx.textAlign = 'right';
        ctx.font = '700 17px "Barlow Condensed", Impact, sans-serif';
        ctx.fillStyle = rgba(g.color, (0.35 + 0.65 * s) * dim);
        ctx.fillText(pct(s), W - 14, yc);
      });

      ctx.globalCompositeOperation = 'lighter';

      // Backbones, batched into runs of the same gene and depth band.
      const runs = [];
      for(let s = 0; s < 2; s++){
        let run = null, prev = null;
        for(let y = top - 16; y <= bottom + 16; y += 4){
          const th = (y - top) * k + phi + s * Math.PI;
          const pt = {x: cx + A * Math.sin(th), y, z: Math.cos(th)};
          const g = geneAt(y), q = Math.round((pt.z + 1) / 2 * 3), key = g * 10 + q;
          if(!run || run.key !== key){ if(run) runs.push(run); run = {key, g, q, pts: prev ? [prev] : []}; }
          run.pts.push(pt);
          prev = pt;
        }
        if(run) runs.push(run);
      }
      const drawRun = run => {
        if(run.pts.length < 2) return;
        const g = CATS[run.g], s = strength[g.id], depth = run.q / 3;
        neon(() => path(run.pts), g.color, (1.1 + 2.3 * s) * (0.6 + 0.4 * depth), (0.3 + 0.7 * s) * (0.28 + 0.72 * depth) * dimOf(g.id), depth > 0.5 ? 4 : 2);
      };
      runs.filter(r => r.q <= 1).forEach(drawRun);

      // Particles: ambient ones rise off the genes (stronger genes shed more); bursts fly from completed rungs.
      if(!reduce){
        const ambient = st.parts.filter(p => !p.burst).length;
        if(ambient < 14 + 34 * totalStrength() && Math.random() < 0.35){
          const weights = CATS.map(c => 0.12 + strength[c.id]);
          let r = Math.random() * weights.reduce((a, b) => a + b, 0), gi = 0;
          while(r > weights[gi] && gi < CATS.length - 1){ r -= weights[gi]; gi++; }
          st.parts.push({x: cx + (Math.random() * 2 - 1) * A * 1.15, y: top + (gi + Math.random()) * geneSpan - gap / 2, vx: (Math.random() - 0.5) * 0.008, vy: -(0.01 + Math.random() * 0.03), life: 0, max: 2200 + Math.random() * 2600, color: CATS[gi].color, size: 0.7 + Math.random() * 1.4});
        }
        for(const f of flashes){
          if(f.burst || now < f.at) continue;
          f.burst = true;
          const color = catOf(missions[f.i].c).color, y = top + f.i * gap;
          for(let n = 0; n < 22; n++){
            const a = Math.random() * Math.PI * 2, v = 0.05 + Math.random() * 0.16;
            st.parts.push({x: cx, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 700 + Math.random() * 500, color, size: 1 + Math.random() * 1.6, burst: true});
          }
        }
        st.parts = st.parts.filter(p => (p.life += dt) < p.max);
        for(const p of st.parts){
          p.x += p.vx * dt; p.y += p.vy * dt;
          if(p.burst){ p.vx *= 0.985; p.vy *= 0.985; }
          const a = Math.sin(Math.PI * p.life / p.max) * (p.burst ? 1 : 0.7);
          dot(p.x, p.y, p.size * 3.2, p.color, a * 0.16);
          dot(p.x, p.y, p.size, p.color, a);
        }
      }

      // Rungs: base pairs split in the middle, styled by mission state.
      missions.forEach((m, i) => {
        const y = top + i * gap, th = (y - top) * k + phi;
        const sx = A * Math.sin(th), xa = cx + sx, xb = cx - sx, za = Math.cos(th);
        const g = catOf(m.c), dim = dimOf(m.c);
        const f = flashes.find(fl => fl.i === i && now >= fl.at);
        const fp = f ? (now - f.at) / FLASH_MS : 1;
        const flash = f ? Math.max(0, 1 - fp) : 0;
        const sc = scan(y), len = Math.abs(xb - xa), dir = xa < xb ? 1 : -1, gp = Math.min(3, len * 0.08);
        const halves = [[xa, cx - dir * gp], [cx + dir * gp, xb]];
        if(m.s === 0){
          ctx.setLineDash([2, 5]);
          ctx.strokeStyle = rgba('#7fd8ff', (0.13 + 0.35 * sc + flash) * dim);
          ctx.lineWidth = 1;
          seg(xa, y, xb, y);
          ctx.setLineDash([]);
        }else if(m.s === 1){
          const flick = reduce ? 0.75 : 0.5 + 0.5 * Math.abs(Math.sin(now * 0.011 + i * 1.7) * Math.sin(now * 0.0047 + i));
          ctx.setLineDash([4, 5]);
          ctx.lineDashOffset = reduce ? 0 : -now * 0.03;
          halves.forEach(([a, b]) => neon(() => seg(a, y, b, y), g.color, 1.8, (0.55 * flick + 0.5 * sc + flash) * dim, 2));
          ctx.setLineDash([]);
          ctx.lineDashOffset = 0;
        }else{
          const mem = m.s === 3, breathe = mem && !reduce ? 0.86 + 0.14 * Math.sin(now * 0.004 + i) : 1;
          halves.forEach(([a, b]) => neon(() => seg(a, y, b, y), g.color, mem ? 3.6 : 2.5, ((mem ? 1.15 : 0.82) * breathe + 0.5 * sc + 1.2 * flash) * dim));
          if(!reduce && len > 10){
            for(let p = 0; p < (mem ? 2 : 1); p++){
              const t = (now * 0.0011 + i * 0.37 + p * 0.5) % 1, x = xa + (xb - xa) * t;
              dot(x, y, 4.5, g.color, 0.3 * dim);
              dot(x, y, 1.5, '#ffffff', 0.9 * dim);
            }
          }
        }
        for(const [x, z] of [[xa, za], [xb, -za]]){
          const depth = (z + 1) / 2;
          if(m.s === 0){ dot(x, y, 1.4 + 1.2 * depth, '#7fd8ff', (0.18 + 0.3 * depth) * dim + flash); continue; }
          const r = (1.8 + 2 * depth) * (m.s === 3 ? 1.35 : 1) + flash * 3;
          dot(x, y, r * 2.8, g.color, ((m.s >= 2 ? 0.14 : 0.08) + 0.1 * depth) * dim + flash * 0.3);
          dot(x, y, r, g.color, (0.5 + 0.5 * depth) * dim + flash * 0.5);
          if(m.s >= 2) dot(x, y, r * 0.45, '#ffffff', (0.45 + 0.55 * depth) * dim);
        }
        if(flash > 0 && !reduce){
          ctx.strokeStyle = rgba(g.color, flash * 0.9); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx, y, 10 + 95 * fp, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = rgba('#ffffff', flash * 0.55); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(cx, y, 6 + 60 * fp, 0, Math.PI * 2); ctx.stroke();
        }
      });

      runs.filter(r => r.q >= 2).forEach(drawRun);

      // Light travelling through the strand: the pulse from a completed mission and the scanner beam.
      if(!reduce){
        for(let s = 0; s < 2; s++){
          for(let y = top - 12; y <= bottom + 12; y += 4){
            const b = pulse(y) + 0.55 * scan(y);
            if(b < 0.06) continue;
            const th1 = (y - top) * k + phi + s * Math.PI, th2 = (y + 4 - top) * k + phi + s * Math.PI;
            const g = CATS[geneAt(y)];
            neon(() => seg(cx + A * Math.sin(th1), y, cx + A * Math.sin(th2), y + 4), g.color, 2.2, b * dimOf(g.id), 2);
          }
        }
        if(scanY > top - 40 && scanY < bottom + 40){
          const grad = ctx.createLinearGradient(0, 0, W, 0);
          grad.addColorStop(0, 'rgba(46,199,255,0)');
          grad.addColorStop(0.5, 'rgba(46,199,255,0.42)');
          grad.addColorStop(1, 'rgba(46,199,255,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, scanY - 0.75, W, 1.5);
          const band = ctx.createLinearGradient(0, scanY - 26, 0, scanY + 26);
          band.addColorStop(0, 'rgba(46,199,255,0)');
          band.addColorStop(0.5, 'rgba(46,199,255,0.05)');
          band.addColorStop(1, 'rgba(46,199,255,0)');
          ctx.fillStyle = band;
          ctx.fillRect(0, scanY - 26, W, 52);
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      for(const i of new Set([st.hover, selected])){
        if(i < 0 || i >= N) continue;
        const y = top + i * gap, sx = A * Math.sin((y - top) * k + phi);
        for(const x of [cx + sx, cx - sx]) reticle(x, y, i === selected ? 0.95 : 0.5, now);
      }
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
