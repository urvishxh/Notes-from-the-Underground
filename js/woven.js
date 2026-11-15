// Mycelium Lab · woven type
// ------------------------------------------------------------------
// Letters grown like a lab culture: the letterform is the agar (food), spores land on it and
// the network fills it until the word appears.
//   grow       tips grow and branch, avoid crowded ground, bend toward rich spots, fuse when they meet
//   spill      how far threads may cross the outline into the space around the letter (0 = bound:
//              the outline is a wall). Counters (holes of a, o, e…) can be kept clear so the word reads.
//   fill gaps  the culture keeps checking for parts of the letters it hasn't reached yet and sends
//              threads into them from the nearest part of the network, so no holes are left
//   paint      dragging on the canvas lays down fresh agar: the network grows into it from the
//              nearest threads (a real network, not a dot)
//   cords      busy routes from rich spots thicken; escaped threads that carry nothing die back
function createWovenEngine(env, S, geo) {
  const p = env.p;
  let R, nodes, adj, tips, spots, pulses, waves, fusions, hash, tipSeq, later, lastFlow, lastPulse, lastWave, lastFill, fillDone, coverPts, paint;
  const STEP = Math.max(1.4, geo.fontPx / 95), HC = Math.max(6, STEP * 3), MAX_NODES = 70000;
  const PG = 4, pw = Math.ceil(env.W / PG), ph = Math.ceil(env.H / PG);
  const key = (x, y) => ((x / HC) | 0) + "," + ((y / HC) | 0);
  const near = (x, y, r, fn) => {
    const c0 = ((x - r) / HC) | 0, c1 = ((x + r) / HC) | 0, r0 = ((y - r) / HC) | 0, r1 = ((y + r) / HC) | 0;
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) { const b = hash.get(cx + "," + cy); if (b) for (const n of b) fn(n); }
  };
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const painted = (x, y) => { const gx = (x / PG) | 0, gy = (y / PG) | 0; return gx >= 0 && gy >= 0 && gx < pw && gy < ph && paint[gy * pw + gx] === 1; };
  const agar = (x, y) => geo.inside(x, y) || painted(x, y);
  const counter = (x, y) => (S.counters ?? true) && geo.inCounter(x, y) && !painted(x, y);

  function addNode(x, y, parent, tipId) {
    const n = { x, y, parent, tipId, born: env.t, flow: 0, lastFlow: env.t, dead: 0, id: nodes.length };
    nodes.push(n); adj.push([]);
    if (parent) { adj[n.id].push(parent.id); adj[parent.id].push(n.id); }
    const k = key(x, y); let b = hash.get(k); if (!b) hash.set(k, (b = [])); b.push(n);
    return n;
  }
  function newTip(node, ang, maxLen, target) { return { node, ang, id: tipSeq++, len: 0, max: maxLen, carry: 0, out: node.out || 0, exit: node.exit, target }; }
  function inoculate(x, y, n) {
    const root = addNode(x, y, null, -1); root.root = true;
    n = n || Math.round(p.random(3, 8));
    for (let k = 0; k < n; k++) tips.push(newTip(root, (k / n) * Math.PI * 2 + p.random(-0.4, 0.4), p.random(80, 260) * geo.fontPx / 200));
  }
  function randomInside(L) {
    for (let k = 0; k < 400; k++) { const x = p.random(L.minx, L.maxx), y = p.random(L.miny, L.maxy); if (geo.inside(x, y)) return [x, y]; }
    const c = p.random(L.cells); return [c.x, c.y];
  }

  // ---- a recipe: your settings, nudged at random by "Variation" ----
  function recipe() {
    const v = S.variation ?? 0.5, j = (x, s = 0.25) => clamp(x + (Math.random() * 2 - 1) * s * v);
    const spill = j(S.spill ?? 0.5, 0.15), dens = j(S.density ?? 0.6, 0.2);
    const r = {
      branch: 0.012 + 0.055 * j(S.branching ?? 0.5),
      wander: 0.03 + 0.27 * j(S.wander ?? 0.5),
      crowd: Math.round(3 + 5 * dens), density: dens,
      escape: spill < 0.03 ? 0 : 0.04 + 0.26 * spill,
      reachOut: 3 + 30 * spill, spill,
      thick: 1 + (Math.random() * 2 - 1) * 0.25 * v,
      cord: 0.3 + 1.2 * j(S.cords ?? 0.5),
      spots: Math.round(8 * j(S.cords ?? 0.5)),
      dieback: Math.random() < 0.5 ? p.random(18, 45) : 1e9,
      sporesExtra: Math.round(p.random(0, 5)),
      stagger: p.random(0, 6),
    };
    const w = [r.crowd >= 6 ? "dense" : r.crowd <= 3 ? "airy" : "even", r.wander > 0.22 ? "wandering" : r.wander < 0.1 ? "straight" : "curving",
      r.branch > 0.05 ? "bushy" : r.branch < 0.025 ? "sparse" : "branching", r.escape === 0 ? "bound" : r.reachOut > 24 ? "far-reaching" : r.reachOut > 14 ? "spilling" : "fraying"];
    if (r.spots >= 5) w.push("corded");
    r.label = "#" + Math.floor(1000 + Math.random() * 9000) + " · " + w.join(", ");
    return r;
  }

  function setup() {
    R = recipe();
    nodes = []; adj = []; tips = []; spots = []; pulses = []; waves = []; fusions = []; hash = new Map(); tipSeq = 0;
    lastFlow = 0; lastPulse = 0; lastWave = -9; lastFill = 0; fillDone = false;
    paint = new Uint8Array(pw * ph);
    // points the culture checks to find gaps (about one per small patch of letter)
    const stride = Math.max(1, Math.round((STEP * 3) / geo.cell));
    coverPts = [];
    for (const L of geo.letters) for (const c of L.cells) if (((c.x / geo.cell) | 0) % stride === 0 && ((c.y / geo.cell) | 0) % stride === 0) coverPts.push({ x: c.x, y: c.y });
    for (let k = 0; k < R.spots && geo.letters.length; k++) { const [x, y] = randomInside(p.random(geo.letters)); spots.push({ x, y, r: geo.fontPx * p.random(0.03, 0.07), amount: 1, found: false, contacts: [] }); }
    later = geo.letters.map((L) => { const [x, y] = randomInside(L); return { at: p.random(0, R.stagger), x, y }; });
    for (let k = 0; k < R.sporesExtra && geo.letters.length; k++) { const [x, y] = randomInside(p.random(geo.letters)); later.push({ at: p.random(2, 12), x, y }); }
  }

  // ---- send a thread toward a spot from the nearest part of the network (or start a spore there) ----
  function reach(x, y, radius) {
    let best = null, bd = radius;
    near(x, y, radius, (n) => { if (n.dead) return; const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } });
    if (best && bd > STEP * 1.5) tips.push(newTip(best, Math.atan2(y - best.y, x - best.x) + p.random(-0.3, 0.3), bd * 1.6 + geo.fontPx * 0.25, { x, y }));
    else if (!best) inoculate(x, y, 4);
  }
  function fillGaps(force) {
    if (!coverPts.length || nodes.length >= MAX_NODES) return;
    const r = STEP * (3.4 - 1.2 * R.density), sample = force ? coverPts : Array.from({ length: Math.min(500, coverPts.length) }, () => coverPts[(Math.random() * coverPts.length) | 0]);
    const empty = sample.filter((c) => { let hit = false; near(c.x, c.y, r, (n) => { if (!hit && !n.dead && Math.hypot(n.x - c.x, n.y - c.y) < r) hit = true; }); return !hit; });
    const target = 0.08 - 0.075 * R.density;   // denser setting = fewer gaps allowed
    if (!force && empty.length / sample.length < target) { fillDone = true; return; }
    fillDone = false;
    p.shuffle(empty, true);
    for (const c of empty.slice(0, force ? 30 : 8)) reach(c.x, c.y, geo.fontPx * 0.4);
  }
  function brush(x, y) {   // paint agar and grow into it
    const rad = S.brush ?? 18;
    for (let gy = Math.floor((y - rad) / PG); gy <= Math.ceil((y + rad) / PG); gy++) for (let gx = Math.floor((x - rad) / PG); gx <= Math.ceil((x + rad) / PG); gx++) {
      if (gx < 0 || gy < 0 || gx >= pw || gy >= ph) continue;
      if (Math.hypot(gx * PG + PG / 2 - x, gy * PG + PG / 2 - y) <= rad) paint[gy * pw + gx] = 1;
    }
    const n = Math.max(1, Math.round(rad / (STEP * 3)));
    for (let k = 0; k < n * n; k++) { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * rad; coverPts.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d }); }
    reach(x, y, Math.max(rad * 4, geo.fontPx * 0.5));
    fillDone = false;
  }

  function grow(dt) {
    for (const s of later) if (!s.done && env.t >= s.at) { s.done = true; inoculate(s.x, s.y); }
    const alive = [], born = [], speed = STEP * 13;
    for (const tp of tips) {
      if (tp.node.dead) continue;
      tp.carry += dt * speed;
      let keep = true;
      while (tp.carry >= STEP && keep) {
        tp.carry -= STEP;
        const { x, y } = tp.node;
        let a = tp.ang + p.random(-R.wander, R.wander);
        // a thread sent to fill a gap heads for it
        if (tp.target) {
          const d = Math.hypot(tp.target.x - x, tp.target.y - y);
          if (d < STEP * 2) tp.target = null;
          else { let da = Math.atan2(tp.target.y - y, tp.target.x - x) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * 0.3; }
        }
        // bend toward rich spots it can sense
        let best = null, bd = geo.fontPx * 0.5;
        for (const f of spots) { if (f.amount <= 0.05) continue; const d = Math.hypot(f.x - x, f.y - y) - f.r; if (d < bd) { bd = d; best = f; } }
        if (best && !tp.target) { let da = Math.atan2(best.y - y, best.x - x) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * 0.12 * (1 - bd / (geo.fontPx * 0.5)); }
        // avoid crowded ground
        let rx = 0, ry = 0;
        near(x, y, STEP * 5, (n) => { if (n.tipId === tp.id || n.dead) return; const dx = x - n.x, dy = y - n.y, d = Math.hypot(dx, dy) || 1; rx += dx / d / d; ry += dy / d / d; });
        if (rx || ry) { let da = Math.atan2(ry, rx) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * Math.min(tp.target ? 0.12 : 0.25, Math.hypot(rx, ry) * STEP * 1.5); }
        let nx = x + Math.cos(a) * STEP, ny = y + Math.sin(a) * STEP;
        // the edge of the agar: usually turn back along it; sometimes break out (Spill decides)
        if (!agar(nx, ny)) {
          if (R.escape > 0 && tp.out < R.reachOut && !counter(nx, ny) && (tp.out > 0 || p.random() < R.escape)) { if (tp.out === 0) tp.exit = a; tp.out++; }
          else {
            let found = false;
            const side = p.random() < 0.5 ? -1 : 1;
            for (let k = 1; k <= 8 && !found; k++) for (const sgn of [side, -side]) {
              const a2 = a + sgn * k * 0.25, tx = x + Math.cos(a2) * STEP, ty = y + Math.sin(a2) * STEP;
              if (agar(tx, ty)) { a = a2; nx = tx; ny = ty; found = true; break; }
            }
            if (!found) { keep = false; break; }
          }
        } else tp.out = 0;
        // off the agar a thread is hungry: the further it goes, the more it curls back
        if (tp.out > 0 && tp.exit !== undefined) { let da = tp.exit + Math.PI - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * Math.min(0.3, (tp.out / R.reachOut) * 0.3); }
        tp.ang = a;
        if (nx < 3 || ny < 3 || nx > env.W - 3 || ny > env.H - 3 || nodes.length >= MAX_NODES) { keep = false; break; }
        // fuse with threads it meets (once it has grown away from where it started)
        let fuse = null;
        if (tp.len > STEP * 10 && !tp.target) near(nx, ny, STEP * 1.25, (n) => { if (!fuse && !n.dead && n.tipId !== tp.id && n !== tp.node && n !== tp.node.parent && Math.abs(env.t - n.born) > 1.5) fuse = n; });
        if (fuse) { adj[tp.node.id].push(fuse.id); adj[fuse.id].push(tp.node.id); fusions.push([tp.node, fuse]); if (p.random() < 0.75) { keep = false; break; } }
        // ground already taken: stop (outside the letter is poor ground, so threads there stay sparse)
        let crowd = 0;
        near(nx, ny, STEP * 2.7, (n) => { if (!n.dead && n.tipId !== tp.id) crowd++; });
        if (!tp.target && crowd > (tp.out > 0 ? Math.max(2, R.crowd - 2) : R.crowd) && tp.len > STEP * 6) { keep = false; break; }
        const n = addNode(nx, ny, tp.node, tp.id);
        n.out = tp.out; n.exit = tp.exit;
        tp.node = n; tp.len += STEP;
        for (const f of spots) if (f.amount > 0.05 && Math.hypot(f.x - nx, f.y - ny) < f.r) {
          f.contacts.push(n);
          if (!f.found) { f.found = true; for (let k = 0; k < 3; k++) born.push(newTip(n, p.random(Math.PI * 2), tp.max)); }
        }
        if (tips.length + born.length < 360 && p.random() < R.branch * (tp.out > 0 ? 0.3 : 1)) born.push(newTip(n, a + (p.random() < 0.5 ? -1 : 1) * p.random(0.45, 1.1), (tp.target ? geo.fontPx * 0.3 : tp.max) * p.random(0.5, 0.95)));
        if (tp.len > tp.max) { keep = false; break; }
      }
      if (keep) alive.push(tp);
    }
    tips = alive.concat(born);
    // keep colonising: explorers set out from threads with free ground around them
    if (tips.length < 60 && nodes.length < MAX_NODES && !fillDone) {
      const young = [];
      for (let k = nodes.length - 1; k >= 0 && young.length < 300; k -= 3) {
        const n = nodes[k]; if (n.dead || (n.out > 0 && p.random() < 0.92) || (n.out || 0) >= R.reachOut) continue;
        let c = 0; near(n.x, n.y, STEP * 3, (m) => { if (!m.dead) c++; });
        if (c < R.crowd * 3) young.push(n);
      }
      for (let k = 0; k < 4 && young.length; k++) {
        const from = p.random(young), a0 = from.parent ? Math.atan2(from.y - from.parent.y, from.x - from.parent.x) : p.random(Math.PI * 2);
        tips.push(newTip(from, a0 + p.random(-1.2, 1.2), p.random(60, 220) * geo.fontPx / 200));
      }
    }
    // gaps: once the first growth has settled, look for unreached parts of the letters and reach into them
    if (env.t > R.stagger + 3 && env.t - lastFill > 0.8 && tips.length < 80) { lastFill = env.t; fillGaps(false); }
  }
  function transport() {
    for (const n of nodes) n.flow = 0;
    for (const f of spots) {
      if (!f.found || f.amount <= 0) continue;
      for (const c of f.contacts.slice(-5)) { let n = c; while (n) { n.flow += f.amount; n.lastFlow = env.t; n = n.parent; } }
      f.amount = Math.max(0, f.amount - 0.003);
    }
    for (const n of nodes) if (!n.root && !n.dead && n.flow === 0 && env.t - Math.max(n.born, n.lastFlow) > R.dieback && !agar(n.x, n.y)) n.dead = env.t;
  }
  function sendWave() {
    let best = null, bd = geo.fontPx * 0.2;
    near(env.pointer.x, env.pointer.y, bd, (n) => { if (n.dead) return; const d = Math.hypot(n.x - env.pointer.x, n.y - env.pointer.y); if (d < bd) { bd = d; best = n; } });
    if (!best) return;
    const hop = new Map([[best.id, 0]]), q = [best.id];
    for (let h = 0; h < q.length && q.length < 12000; h++) for (const j of adj[q[h]]) if (!hop.has(j) && !nodes[j].dead) { hop.set(j, hop.get(q[h]) + 1); q.push(j); }
    waves.push({ hop, t0: env.t });
  }

  setup();
  let dragFrom = null;
  return {
    step(dt) {
      grow(dt);
      if (env.t - lastFlow > 0.5) { lastFlow = env.t; transport(); }
      if (env.t - lastPulse > 0.25) {
        lastPulse = env.t;
        const live = spots.filter((f) => f.found && f.amount > 0 && f.contacts.length);
        if (live.length) { let n = p.random(p.random(live).contacts); const path = []; while (n && path.length < 3000) { path.push(n); n = n.parent; } pulses.push({ path, pos: 0 }); }
      }
      pulses = pulses.filter((pl) => (pl.pos += dt * 60) < pl.path.length);
      if (env.pointer.active && !env.pointer.down && env.t - lastWave > 1.4) { lastWave = env.t; sendWave(); }
      waves = waves.filter((w) => (env.t - w.t0) * 80 < 3000);
    },
    pointerDown(x, y) { dragFrom = { x, y }; brush(x, y); },
    pointerDrag(x, y) {
      if (!dragFrom) return;
      const d = Math.hypot(x - dragFrom.x, y - dragFrom.y), rad = S.brush ?? 18;
      if (d < rad * 0.6) return;
      dragFrom = { x, y }; brush(x, y);
    },
    pointerUp() { dragFrom = null; },
    command(c) { if (c === "fill") fillGaps(true); if (c === "clearPaint") { paint.fill(0); } },
    status() { return R.label + (tips.length ? " · growing" : fillDone ? " · filled" : ""); },
    render(ctx, screen, ink) {
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = ink; ctx.fillStyle = ink;
      if (screen && S.guide) { ctx.globalAlpha = 0.08; geo.drawText(ctx); ctx.globalAlpha = 1; }
      const buckets = new Map(), base = Math.max(0.8, STEP * 0.42) * R.thick * (S.weight ?? 1);
      for (const n of nodes) {
        if (!n.parent) continue;
        let w = base + Math.min(STEP * 2.5, Math.log2(1 + n.flow) * STEP * 0.35 * R.cord);
        if (n.dead) { const k = 1 - (env.t - n.dead) / 6; if (k <= 0) continue; w *= k; }
        const q = Math.round(w * 4) / 4;
        let b = buckets.get(q); if (!b) buckets.set(q, (b = [])); b.push(n);
      }
      for (const [w, list] of buckets) { ctx.beginPath(); for (const n of list) { ctx.moveTo(n.parent.x, n.parent.y); ctx.lineTo(n.x, n.y); } ctx.lineWidth = w; ctx.stroke(); }
      ctx.beginPath(); for (const [a, b] of fusions) if (!a.dead && !b.dead) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } ctx.lineWidth = base; ctx.stroke();
      if (screen) {
        for (const tp of tips) { ctx.beginPath(); ctx.arc(tp.node.x, tp.node.y, base * 0.9, 0, 6.283); ctx.fill(); }
        for (const pl of pulses) { const n = pl.path[Math.floor(pl.pos)]; if (n) { ctx.beginPath(); ctx.arc(n.x, n.y, base * 1.8, 0, 6.283); ctx.fill(); } }
        for (const wv of waves) {
          const front = (env.t - wv.t0) * 80;
          ctx.beginPath(); for (const [id, h] of wv.hop) if (Math.abs(h - front) < 3) { const n = nodes[id]; ctx.moveTo(n.x + base * 1.5, n.y); ctx.arc(n.x, n.y, base * 1.5, 0, 6.283); } ctx.fill();
        }
      }
    },
  };
}
