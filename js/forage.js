// Mycelium Lab · foraging paths (realistic)
// ------------------------------------------------------------------
// How a real fungus links food sources: it does not know where the food is.
//   colonise   every food source (a chip of wood) is colonised: a cottony mat and a ring of
//              exploring threads growing outward
//   forage     tips grow and branch, avoid ground their own colony already holds, and can only
//              smell food that is close (short-range chemotropism). Explorers keep setting out from
//              the young edge of each colony until every food source has been reached
//   fuse       when threads of two colonies meet, they fuse (anastomosis): the two foods are joined
//   transport  food flows between the joined sources along the shortest routes the network offers.
//              Those routes thicken into cords. With "Connections" toward web, more routes stay busy
//   prune      once everything is joined, the threads that carry nothing die back, leaving the
//              efficient network: a result of growth and pruning, not a plan
function createForageEngine(env, S) {
  const p = env.p, STEP = 2.4, HC = 8, MAX_NODES = 46000;
  let R, foods, nodes, adj, tips, hairs, cords, pulses, waves, hash, tipSeq, uf, phase, settleAt, lastFlow, lastPulse, lastWave, lastExplore, grown;
  const key = (x, y) => ((x / HC) | 0) + "," + ((y / HC) | 0);
  const near = (x, y, r, fn) => {
    const c0 = ((x - r) / HC) | 0, c1 = ((x + r) / HC) | 0, r0 = ((y - r) / HC) | 0, r1 = ((y + r) / HC) | 0;
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) { const b = hash.get(cx + "," + cy); if (b) for (const n of b) fn(n); }
  };
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const find = (i) => { while (uf[i] !== i) { uf[i] = uf[uf[i]]; i = uf[i]; } return i; };
  const comps = () => new Set(foods.map((f) => find(f.id))).size;

  function reset() {
    foods = []; nodes = []; adj = []; tips = []; hairs = []; cords = new Map(); pulses = []; waves = []; hash = new Map(); tipSeq = 0; uf = [];
    phase = "place"; settleAt = 0; lastFlow = 0; lastPulse = 0; lastWave = -9; lastExplore = 0; grown = false;
  }
  function makeFood(x, y) {
    const shape = []; for (let k = 0; k < 9; k++) shape.push(p.random(0.7, 1.25));
    const f = { x, y, id: foods.length, shape, r: p.random(5, 8), rot: p.random(Math.PI * 2) };
    uf.push(f.id); return f;
  }
  function recipe() {
    const v = S.variation ?? 0.5, j = (x, s = 0.25) => clamp(x + (Math.random() * 2 - 1) * s * v);
    const r = {
      wander: 0.04 + 0.3 * j(S.wander ?? 0.35), branch: 0.01 + 0.04 * j(S.branching ?? 0.4), explore: j(S.explore ?? 0.5),
      fluff: 0.15 + 1.45 * j(S.fluff ?? 0.5), strands: Math.max(1, Math.round((S.strands ?? 3) + (Math.random() * 2 - 1) * v)),
      twist: 0.2 * j(S.twist ?? 0.5), crowd: Math.round(2 + 3 * Math.random()), curl: 0.15 + 0.3 * Math.random(),
      sense: 90 + 70 * Math.random(), web: S.web ?? 0.3,
    };
    const w = [r.fluff > 1.1 ? "cottony" : r.fluff < 0.6 ? "fine" : "downy", r.wander > 0.24 ? "meandering" : r.wander < 0.12 ? "straight" : "searching",
      r.explore > 0.6 ? "far-foraging" : "foraging", r.branch > 0.035 ? "bushy" : "spare"];
    r.label = "#" + Math.floor(1000 + Math.random() * 9000) + " · " + w.join(", ");
    return r;
  }
  function addNode(x, y, parent, colony, tipId) {
    const n = { x, y, parent, colony, tipId, born: env.t, id: nodes.length, dieAt: 0, cord: 0 };
    nodes.push(n); adj.push([]);
    if (parent) { adj[n.id].push(parent.id); adj[parent.id].push(n.id); }
    const k = key(x, y); let b = hash.get(k); if (!b) hash.set(k, (b = [])); b.push(n);
    return n;
  }
  const newTip = (node, ang, max) => ({ node, ang, colony: node.colony, id: tipSeq++, len: 0, max, carry: 0 });
  function hypha(x, y, h, len, out) {
    const pts = [[x, y]];
    for (let s = 0; s < len; s++) {
      h += p.random(-R.curl, R.curl); x += Math.cos(h) * 1.8; y += Math.sin(h) * 1.8; pts.push([x, y]);
      if (s > 2 && len - s > 3 && p.random() < 0.08) hypha(x, y, h + (p.random() < 0.5 ? -1 : 1) * p.random(0.5, 1), Math.round((len - s) * 0.6), out);
    }
    out.push(pts);
  }
  function colonise(f) {
    const root = addNode(f.x, f.y, null, f.id, -1); root.root = true; f.root = root;
    let sp = 220; for (const g of foods) if (g !== f) sp = Math.min(sp, Math.hypot(g.x - f.x, g.y - f.y));
    f.space = sp; const room = Math.min(1, sp / 120);
    const n = Math.round(8 + 14 * R.explore);
    for (let k = 0; k < n; k++) tips.push(newTip(root, (k / n) * Math.PI * 2 + p.random(-0.25, 0.25), p.random(120, 260) * (0.6 + R.explore)));
    const m = Math.max(3, Math.round(100 * R.fluff * room * room)), spread = Math.min(9 + 9 * R.fluff, sp * 0.3);
    for (let k = 0; k < m; k++) {
      const a = p.random(Math.PI * 2), d = Math.abs(p.randomGaussian(0, spread)), out = [];
      hypha(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, a + p.random(-0.5, 0.5), Math.round(p.random(4, 6 + 10 * room)), out);
      for (const pts of out) hairs.push({ pts, born: env.t + p.random(0, 5) });
    }
  }
  function join(a, b) { const ra = find(a.colony), rb = find(b.colony); if (ra !== rb) uf[ra] = rb; }

  function grow(dt) {
    const alive = [], born = [];
    for (const tp of tips) {
      if (tp.node.dieAt) continue;
      tp.carry += dt * 40;
      let keep = true;
      while (tp.carry >= STEP && keep) {
        tp.carry -= STEP;
        const { x, y } = tp.node;
        let a = tp.ang + hyphaTurn(tp, R.wander);
        // short-range chemotropism: only food that is close and not yet joined to this colony
        let best = null, bd = R.sense; const mine = find(tp.colony);
        for (const f of foods) { if (find(f.id) === mine) continue; const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; best = f; } }
        if (best) { let da = Math.atan2(best.y - y, best.x - x) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * 0.16 * (1 - bd / R.sense); }
        // avoid ground its own colony holds
        let rx = 0, ry = 0;
        near(x, y, 14, (n) => { if (n.tipId === tp.id || n.colony !== tp.colony || n.dieAt) return; const dx = x - n.x, dy = y - n.y, d = Math.hypot(dx, dy) || 1; rx += dx / d / d; ry += dy / d / d; });
        if (rx || ry) { let da = Math.atan2(ry, rx) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * Math.min(0.22, Math.hypot(rx, ry) * 1.6); }
        tp.ang = a;
        const nx = x + Math.cos(a) * STEP, ny = y + Math.sin(a) * STEP;
        if (nx < 4 || ny < 4 || nx > env.W - 4 || ny > env.H - 4 || nodes.length >= MAX_NODES) { keep = false; break; }
        // reached another food source: it is joined
        if (best && bd < best.r + 6) { adj[tp.node.id].push(best.root.id); adj[best.root.id].push(tp.node.id); join(tp.node, best.root); keep = false; break; }
        // anastomosis
        let fuse = null;
        if (tp.len > 14) near(nx, ny, 2.8, (n) => { if (!fuse && !n.dieAt && n.tipId !== tp.id && n !== tp.node && n !== tp.node.parent && env.t - n.born > 0.6) fuse = n; });
        if (fuse) {
          adj[tp.node.id].push(fuse.id); adj[fuse.id].push(tp.node.id);
          const other = find(fuse.colony) !== find(tp.colony);
          join(tp.node, fuse);
          if (other || p.random() < 0.6) { keep = false; break; }
        }
        let crowd = 0;
        near(nx, ny, 6.5, (n) => { if (!n.dieAt && n.tipId !== tp.id) crowd++; });
        if (crowd > R.crowd && tp.len > 16) { keep = false; break; }
        const n = addNode(nx, ny, tp.node, tp.colony, tp.id);
        tp.node = n; tp.len += STEP;
        if (tips.length + born.length < 420 && p.random() < R.branch) born.push(newTip(n, a + (p.random() < 0.5 ? -1 : 1) * p.random(0.5, 1.1), tp.max * p.random(0.5, 0.9)));
        if (tp.len > tp.max) { keep = false; break; }
      }
      if (keep) alive.push(tp);
    }
    tips = alive.concat(born);
    // still unjoined food: explorers set out from the young edge of each colony, heading outward
    if (phase === "forage" && comps() > 1 && tips.length < 90 && env.t - lastExplore > 0.4 && nodes.length < MAX_NODES) {
      lastExplore = env.t;
      for (let k = 0; k < 8; k++) {
        const n = nodes[nodes.length - 1 - ((Math.random() * Math.min(nodes.length, 4000)) | 0)];
        if (!n || n.dieAt) continue;
        const f = foods[n.colony], out = Math.atan2(n.y - f.y, n.x - f.x);
        let c = 0; near(n.x, n.y, 8, (m) => { if (!m.dieAt) c++; });
        if (c > 10) continue;
        tips.push(newTip(n, out + p.random(-1, 1), p.random(100, 260) * (0.6 + R.explore)));
      }
    }
  }

  // ---- transport: the busiest routes between joined food sources become cords ----
  function transport() {
    if (foods.length < 2) return;
    const dist = new Map();   // "a-b" -> { d, path }
    for (const f of foods) {
      const seen = new Int32Array(nodes.length).fill(-2); seen[f.root.id] = -1;
      const q = [f.root.id], hop = new Map([[f.root.id, 0]]);
      for (let h = 0; h < q.length; h++) for (const j of adj[q[h]]) if (seen[j] === -2 && !nodes[j].dieAt) { seen[j] = q[h]; hop.set(j, hop.get(q[h]) + 1); q.push(j); }
      for (const g of foods) {
        if (g.id <= f.id || seen[g.root.id] === -2) continue;
        const path = []; let i = g.root.id; while (i >= 0) { path.push(nodes[i]); i = seen[i]; }
        dist.set(f.id + "-" + g.id, { a: f.id, b: g.id, d: hop.get(g.root.id), path });
      }
    }
    // the efficient backbone (shortest total network through the threads), plus extra routes toward "web"
    const pairs = [...dist.values()].sort((x, y) => x.d - y.d), u = foods.map((f) => f.id);
    const fd = (i) => { while (u[i] !== i) i = u[i] = u[u[i]]; return i; };
    const chosen = new Set();
    for (const e of pairs) { const a = fd(e.a), b = fd(e.b); if (a !== b) { u[a] = b; chosen.add(e.a + "-" + e.b); } }
    for (const f of foods) {
      const near2 = pairs.filter((e) => (e.a === f.id || e.b === f.id) && !chosen.has(e.a + "-" + e.b)).slice(0, 2);
      for (const e of near2) if (cords.has(e.a + "-" + e.b) || Math.random() < R.web * 0.5) chosen.add(e.a + "-" + e.b);
    }
    for (const n of nodes) n.cord = Math.max(0, n.cord - 1);
    for (const k of [...cords.keys()]) if (!chosen.has(k)) cords.delete(k);
    for (const k of chosen) {
      const e = dist.get(k), c = cords.get(k);
      for (const n of e.path) n.cord = 3;
      if (c) c.pts = e.path; else cords.set(k, { pts: e.path, t0: env.t, strands: R.strands + (p.random() < 0.35 ? 1 : 0), phase: p.random(Math.PI * 2) });
    }
    // everything joined: prune what carries nothing (food mats stay)
    if (comps() === 1 && phase === "forage") { phase = "settle"; settleAt = env.t; prune(); }
    if (phase === "settle" && env.t - settleAt > 8) tips = [];
  }
  // die-back: threads withdraw from their tips inward, toward the cords (food mats stay)
  function prune() {
    const d = new Int32Array(nodes.length).fill(-1), q = [];
    for (const n of nodes) if (!n.dieAt && (n.cord || n.root)) { d[n.id] = 0; q.push(n.id); }
    for (let h = 0; h < q.length; h++) for (const j of adj[q[h]]) if (d[j] < 0 && !nodes[j].dieAt) { d[j] = d[q[h]] + 1; q.push(j); }
    let maxD = 1; for (const v of d) maxD = Math.max(maxD, v);
    for (const n of nodes) {
      if (n.dieAt || n.cord || n.root) continue;
      let df = Infinity; for (const f of foods) df = Math.min(df, Math.hypot(f.x - n.x, f.y - n.y));
      if (df < 26 || (d[n.id] >= 0 && d[n.id] <= 5)) continue;   // mats and a little fuzz along the cords stay
      const k = d[n.id] < 0 ? 1 : d[n.id] / maxD;
      n.dieAt = env.t + 1 + (1 - k) * 12 + Math.random() * 1.5;
    }
  }

  // ---------- public ----------
  function save() { env.store.foods = foods.map((f) => [f.x / env.W, f.y / env.H]); }
  function start() {
    const pts = foods.map((f) => [f.x, f.y]);
    reset(); R = recipe();
    for (const [x, y] of pts) foods.push(makeFood(x, y));
    for (const f of foods) colonise(f);
    phase = "forage"; grown = true; env.store.grown = true;
  }
  reset(); R = recipe();
  if (env.store.foods && env.store.foods.length) { for (const [fx, fy] of env.store.foods) foods.push(makeFood(fx * env.W, fy * env.H)); if (env.store.grown) start(); }
  else { for (let k = 0; k < 6; k++) foods.push(makeFood(p.random(env.W * 0.15, env.W * 0.85), p.random(env.H * 0.15, env.H * 0.85))); save(); start(); }

  function sendWave() {
    let best = null, bd = 50;
    near(env.pointer.x, env.pointer.y, 50, (n) => { if (n.dieAt) return; const d = Math.hypot(n.x - env.pointer.x, n.y - env.pointer.y); if (d < bd) { bd = d; best = n; } });
    if (!best) return;
    const hop = new Map([[best.id, 0]]), q = [best.id];
    for (let h = 0; h < q.length && q.length < 15000; h++) for (const j of adj[q[h]]) if (!hop.has(j) && !nodes[j].dieAt) { hop.set(j, hop.get(q[h]) + 1); q.push(j); }
    waves.push({ hop, t0: env.t });
  }
  return {
    step(dt) {
      if (!grown) return;
      grow(dt);
      if (env.t - lastFlow > 1.2) { lastFlow = env.t; transport(); }
      const list = [...cords.values()];
      if (env.t - lastPulse > 0.3 && list.length) { lastPulse = env.t; pulses.push({ b: p.random(list), pos: 0, dir: p.random() < 0.5 ? 1 : -1 }); }
      pulses = pulses.filter((pl) => (pl.pos += dt * 60) < pl.b.pts.length);
      if (env.pointer.active && env.t - lastWave > 1.4) { lastWave = env.t; sendWave(); }
      waves = waves.filter((w) => (env.t - w.t0) * 90 < 4000);
    },
    command(c) {
      if (c === "connect") { if (foods.length) start(); }
      if (c === "clear") { reset(); R = recipe(); env.store.grown = false; save(); }
      if (c === "undo") { const pts = foods.slice(0, -1).map((f) => [f.x, f.y]); const was = grown; reset(); R = recipe(); for (const [x, y] of pts) foods.push(makeFood(x, y)); save(); env.store.grown = was && foods.length > 0; if (env.store.grown) start(); }
    },
    pointerDown(x, y) {
      const f = makeFood(x, y); foods.push(f); save();
      if (grown) { colonise(f); phase = "forage"; }
    },
    status() {
      if (!grown) return foods.length ? `${foods.length} food source${foods.length > 1 ? "s" : ""} placed · press Connect` : "click the canvas to place food sources";
      if (foods.length < 2) return R.label + " · add more food to connect";
      const c = comps();
      if (phase === "forage") return `${R.label} · foraging · ${foods.length - c + 1} of ${foods.length} joined`;
      return `${R.label} · all ${foods.length} joined · ${env.t - settleAt < 12 ? "pruning to the busy routes" : "settled"}`;
    },
    get grown() { return grown; },
    render(ctx, screen, ink) {
      const t = env.t, wt = S.weight ?? 1;
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = ink; ctx.fillStyle = ink;
      const fine = [], fading = [];
      for (const n of nodes) {
        if (!n.parent) continue;
        if (n.dieAt && t > n.dieAt) { const k = 1 - (t - n.dieAt) / 4; if (k > 0) fading.push([n, k]); continue; }
        if (!n.cord) fine.push(n);
      }
      ctx.beginPath(); for (const n of fine) { ctx.moveTo(n.parent.x, n.parent.y); ctx.lineTo(n.x, n.y); } ctx.lineWidth = wt; ctx.stroke();
      for (const [n, k] of fading) { ctx.beginPath(); ctx.moveTo(n.parent.x, n.parent.y); ctx.lineTo(n.x, n.y); ctx.lineWidth = Math.max(0.2, k * wt); ctx.stroke(); }
      ctx.beginPath();
      for (const h of hairs) { const g = Math.min(1, (t - h.born) / 2); if (g <= 0) continue; const m = Math.max(2, Math.round(h.pts.length * g)); ctx.moveTo(h.pts[0][0], h.pts[0][1]); for (let i = 1; i < m; i++) ctx.lineTo(h.pts[i][0], h.pts[i][1]); }
      ctx.lineWidth = 0.9 * wt; ctx.stroke();
      // cords: hyphae bundled side by side (Twist 0) or twisted like rope; they thicken as they mature
      for (const b of cords.values()) {
        const mature = Math.min(1, (t - b.t0) / 10), pts = [];
        for (let i = 0; i < b.pts.length; i += 2) pts.push(b.pts[i]);
        if (pts.length < 2) continue;
        const amp = 0.8 + 2.8 * mature;
        for (let k = 0; k < b.strands; k++) {
          ctx.beginPath(); let u = 0;
          const lane = b.strands > 1 ? (k / (b.strands - 1) - 0.5) * 2 : 0;
          for (let i = 0; i < pts.length; i++) {
            const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)];
            const tx = c.x - a.x, ty = c.y - a.y, tl = Math.hypot(tx, ty) || 1;
            if (i > 0) u += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
            const ease = Math.min(1, i / 4, (pts.length - 1 - i) / 4);
            const off = (R.twist > 0.01 ? Math.sin(u * R.twist + (k / b.strands) * Math.PI * 2 + b.phase) : lane * 0.8) * amp * ease;
            const x = pts[i].x - (ty / tl) * off, y = pts[i].y + (tx / tl) * off;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.lineWidth = (0.8 + 0.35 * mature) * wt; ctx.stroke();
        }
      }
      if (screen) {
        for (const tp of tips) { ctx.beginPath(); ctx.arc(tp.node.x, tp.node.y, 1.1, 0, 6.283); ctx.fill(); }
        for (const pl of pulses) { const L = pl.b.pts.length, i = Math.floor(pl.pos); const n = pl.b.pts[pl.dir > 0 ? i : L - 1 - i]; if (n) { ctx.beginPath(); ctx.arc(n.x, n.y, 2.4, 0, 6.283); ctx.fill(); } }
        for (const wv of waves) { const front = (t - wv.t0) * 90; ctx.beginPath(); for (const [id, h] of wv.hop) if (Math.abs(h - front) < 3) { const n = nodes[id]; ctx.moveTo(n.x + 1.6, n.y); ctx.arc(n.x, n.y, 1.6, 0, 6.283); } ctx.fill(); }
      }
      for (const f of foods) {
        const s = Math.min(1, Math.max(0.35, (f.space || 99) / 60));
        ctx.beginPath();
        for (let k = 0; k <= 9; k++) { const a = f.rot + (k / 9) * Math.PI * 2, r = f.r * f.shape[k % 9] * s; const x = f.x + Math.cos(a) * r, y = f.y + Math.sin(a) * r; if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.fill();
        if (screen && !grown) for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * 16, f.y + Math.sin(a) * 16, 1, 0, 6.283); ctx.fill(); }
      }
    },
  };
}
