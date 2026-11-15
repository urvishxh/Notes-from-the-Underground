// Mycelium Lab · network
// ------------------------------------------------------------------
// A fungus on a blank page: how it spreads, communicates and connects.
//   germinate   spores sprout hyphae, threads that grow only at their tips
//   explore     tips wander, branch behind the tip, avoid crowding and bend toward food they sense
//   fuse        a tip meeting another thread joins it (anastomosis): trees become one network
//   exploit     a tip that finds food bursts into dense branching there
//   transport   food is carried back toward the spores; busy routes thicken into cords and
//               threads that find nothing die back
//   signal      pulses stream along the cords; hovering sends a wave through every connected thread
// Every "New network" is new: spore and food positions plus your settings nudged by "Variation".
// Click to drop food.
function createNetworkEngine(env, S) {
  const p = env.p, STEP = 2.6, HC = 8;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  let R, nodes, tips, foods, pulses, waves, hash, tipSeq, lastFlow, lastPulse, lastWave, adj, fusions, later;
  const key = (x, y) => ((x / HC) | 0) + "," + ((y / HC) | 0);
  const near = (x, y, r, fn) => {
    const c0 = ((x - r) / HC) | 0, c1 = ((x + r) / HC) | 0, r0 = ((y - r) / HC) | 0, r1 = ((y + r) / HC) | 0;
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) { const b = hash.get(cx + "," + cy); if (b) for (const n of b) fn(n); }
  };
  function recipe() {
    const v = S.variation ?? 0.5, j = (x, s = 0.25) => clamp(x + (Math.random() * 2 - 1) * s * v);
    const r = {
      branch: 0.01 + 0.05 * j(S.branching ?? 0.5), wander: 0.06 + 0.34 * j(S.wander ?? 0.5), crowd: Math.round(2 + 4 * j(S.density ?? 0.5)),
      reach: 160 + 520 * j(S.reach ?? 0.5), cord: 0.3 + 1.4 * j(S.cords ?? 0.5), maxNodes: Math.round(12000 + 30000 * j(S.density ?? 0.5)),
      dieback: S.prune === false ? 1e9 : 20 + 20 * Math.random(),
    };
    const w = [r.crowd >= 5 ? "dense" : r.crowd <= 2 ? "airy" : "even", r.wander > 0.3 ? "wandering" : r.wander < 0.15 ? "straight" : "curving",
      r.branch > 0.045 ? "bushy" : r.branch < 0.02 ? "sparse" : "branching", r.cord > 1.2 ? "corded" : "fine"];
    r.label = "#" + Math.floor(1000 + Math.random() * 9000) + " · " + w.join(", ");
    return r;
  }
  function addNode(x, y, parent, tipId) {
    const n = { x, y, parent, tipId, born: env.t, flow: 0, lastFlow: env.t, dead: 0, id: nodes.length };
    nodes.push(n); adj.push([]);
    if (parent) { adj[n.id].push(parent.id); adj[parent.id].push(n.id); }
    const k = key(x, y); let b = hash.get(k); if (!b) hash.set(k, (b = [])); b.push(n);
    return n;
  }
  const newTip = (node, ang, max) => ({ node, ang, id: tipSeq++, len: 0, max, carry: 0 });
  function spore(x, y, n) { const root = addNode(x, y, null, -1); root.root = true; for (let k = 0; k < n; k++) tips.push(newTip(root, (k / n) * Math.PI * 2 + p.random(-0.3, 0.3), R.reach * p.random(0.6, 1.2))); }
  function addFood(x, y, r) { foods.push({ x, y, r, amount: 1, found: false, contacts: [] }); }
  function setup() {
    R = recipe();
    nodes = []; tips = []; foods = []; pulses = []; waves = []; adj = []; fusions = []; hash = new Map(); tipSeq = 0; lastFlow = 0; lastPulse = 0; lastWave = -9; later = [];
    const m = Math.min(env.W, env.H) * 0.08;
    for (let k = 0; k < (S.food ?? 7); k++) addFood(p.random(m, env.W - m), p.random(m, env.H - m), p.random(14, 34));
    const n = S.spores ?? 3;
    for (let k = 0; k < n; k++) {
      const x = p.random(m * 2, env.W - m * 2), y = p.random(m * 2, env.H - m * 2);
      if (k === 0) spore(x, y, 7); else later.push({ at: k === 1 ? 0 : p.random(3, 12), x, y });   // later colonies sprout and fuse with the first
    }
  }
  function grow(dt) {
    for (const s of later) if (!s.done && env.t > s.at) { s.done = true; spore(s.x, s.y, 5); }
    const alive = [], born = [];
    for (const tp of tips) {
      if (tp.node.dead) continue;
      tp.carry += dt * 34;
      let keep = true;
      while (tp.carry >= STEP && keep) {
        tp.carry -= STEP;
        const { x, y } = tp.node;
        let a = tp.ang + p.random(-R.wander, R.wander);
        let best = null, bd = 220;
        for (const f of foods) { if (f.amount <= 0.05) continue; const d = Math.hypot(f.x - x, f.y - y) - f.r; if (d < bd) { bd = d; best = f; } }
        if (best) { let da = Math.atan2(best.y - y, best.x - x) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * 0.12 * (1 - bd / 220); }
        let rx = 0, ry = 0;
        near(x, y, 14, (n) => { if (n.tipId === tp.id || n.dead) return; const dx = x - n.x, dy = y - n.y, d = Math.hypot(dx, dy) || 1; rx += dx / d / d; ry += dy / d / d; });
        if (rx || ry) { let da = Math.atan2(ry, rx) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * Math.min(0.25, Math.hypot(rx, ry) * 1.5); }
        tp.ang = a;
        const nx = x + Math.cos(a) * STEP, ny = y + Math.sin(a) * STEP;
        if (nx < 6 || ny < 6 || nx > env.W - 6 || ny > env.H - 6) { keep = false; break; }
        let fuse = null;
        if (tp.len > 30) near(nx, ny, 3.2, (n) => { if (!fuse && !n.dead && n.tipId !== tp.id && n !== tp.node && n !== tp.node.parent && Math.abs(env.t - n.born) > 1.5) fuse = n; });
        if (fuse) { adj[tp.node.id].push(fuse.id); adj[fuse.id].push(tp.node.id); fusions.push([tp.node, fuse]); if (p.random() < 0.8) { keep = false; break; } }
        if (nodes.length >= R.maxNodes) { keep = false; break; }
        let crowd = 0;
        near(nx, ny, 7, (n) => { if (!n.dead && n.tipId !== tp.id) crowd++; });
        if (crowd > R.crowd && tp.len > 20 && !foods.some((f) => Math.hypot(f.x - nx, f.y - ny) < f.r)) { keep = false; break; }
        const n = addNode(nx, ny, tp.node, tp.id);
        tp.node = n; tp.len += STEP;
        for (const f of foods) if (f.amount > 0.05 && Math.hypot(f.x - nx, f.y - ny) < f.r) {
          f.contacts.push(n);
          if (!f.found) { f.found = true; for (let k = 0; k < 4; k++) born.push(newTip(n, p.random(Math.PI * 2), p.random(120, 300))); }
        }
        if (tips.length + born.length < 280 && p.random() < R.branch) born.push(newTip(n, a + (p.random() < 0.5 ? -1 : 1) * p.random(0.45, 1.0), tp.max * p.random(0.5, 0.9)));
        if (tp.len > tp.max) { keep = false; break; }
      }
      if (keep) alive.push(tp);
    }
    tips = alive.concat(born);
    // keep foraging: new explorers set out from the young margin and from food it has found
    if (tips.length < 70 && nodes.length < R.maxNodes) {
      const young = [];
      for (let k = nodes.length - 1; k >= 0 && young.length < 400; k -= 3) { const n = nodes[k]; if (!n.dead && env.t - n.born < 8) young.push(n); }
      const fed = foods.filter((f) => f.found && f.amount > 0.1).flatMap((f) => f.contacts.slice(-3));
      for (let k = 0; k < 6; k++) {
        const from = fed.length && p.random() < 0.35 ? p.random(fed) : young.length ? p.random(young) : null;
        if (!from) break;
        const a0 = from.parent ? Math.atan2(from.y - from.parent.y, from.x - from.parent.x) : p.random(Math.PI * 2);
        tips.push(newTip(from, a0 + p.random(-1, 1), R.reach * p.random(0.5, 1.1)));
      }
    }
  }
  function transport() {
    for (const n of nodes) n.flow = 0;
    for (const f of foods) {
      if (!f.found || f.amount <= 0) continue;
      for (const c of f.contacts.slice(-6)) { let n = c; while (n) { n.flow += f.amount; n.lastFlow = env.t; n = n.parent; } }
      f.amount = Math.max(0, f.amount - 0.004);
    }
    for (const n of nodes) if (!n.root && !n.dead && n.flow === 0 && env.t - Math.max(n.born, n.lastFlow) > R.dieback) n.dead = env.t;
  }
  function sendWave() {
    let best = null, bd = 40;
    near(env.pointer.x, env.pointer.y, 40, (n) => { if (n.dead) return; const d = Math.hypot(n.x - env.pointer.x, n.y - env.pointer.y); if (d < bd) { bd = d; best = n; } });
    if (!best) return;
    const hop = new Map([[best.id, 0]]), q = [best.id];
    for (let h = 0; h < q.length && q.length < 9000; h++) for (const j of adj[q[h]]) if (!hop.has(j) && !nodes[j].dead) { hop.set(j, hop.get(q[h]) + 1); q.push(j); }
    waves.push({ hop, t0: env.t });
  }
  setup();
  return {
    step(dt) {
      grow(dt);
      if (env.t - lastFlow > 0.5) { lastFlow = env.t; transport(); }
      if (env.t - lastPulse > 0.22) {
        lastPulse = env.t;
        const live = foods.filter((f) => f.found && f.amount > 0 && f.contacts.length);
        if (live.length) { let n = p.random(p.random(live).contacts); const path = []; while (n && path.length < 2000) { path.push(n); n = n.parent; } pulses.push({ path, pos: 0 }); }
      }
      pulses = pulses.filter((pl) => (pl.pos += dt * 70) < pl.path.length);
      if (env.pointer.active && env.t - lastWave > 1.4) { lastWave = env.t; sendWave(); }
      waves = waves.filter((w) => (env.t - w.t0) * 90 < 2500);
    },
    pointerDown(x, y) { addFood(x, y, p.random(16, 30)); },
    command() {},
    status() { return R.label + ` · ${foods.filter((f) => f.found).length} of ${foods.length} food found`; },
    render(ctx, screen, ink) {
      const wt = S.weight ?? 1;
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = ink; ctx.fillStyle = ink;
      if (S.showFood ?? true) for (const f of foods) {   // food: a dotted ring that shrinks as it is used up
        const r = f.r * (0.35 + 0.65 * f.amount);
        ctx.beginPath(); for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2, x = f.x + Math.cos(a) * r, y = f.y + Math.sin(a) * r; ctx.moveTo(x + 1.1, y); ctx.arc(x, y, 1.1, 0, 6.283); } ctx.fill();
      }
      const buckets = new Map();
      for (const n of nodes) {
        if (!n.parent) continue;
        let w = (1.0 + Math.min(5, Math.log2(1 + n.flow) * 0.9 * R.cord)) * wt;
        if (n.dead) { const k = 1 - (env.t - n.dead) / 6; if (k <= 0) continue; w *= k; }
        const q = Math.round(w * 4) / 4;
        let b = buckets.get(q); if (!b) buckets.set(q, (b = [])); b.push(n);
      }
      for (const [w, list] of buckets) { ctx.beginPath(); for (const n of list) { ctx.moveTo(n.parent.x, n.parent.y); ctx.lineTo(n.x, n.y); } ctx.lineWidth = w; ctx.stroke(); }
      ctx.beginPath(); for (const [a, b] of fusions) if (!a.dead && !b.dead) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } ctx.lineWidth = wt; ctx.stroke();
      if (screen) {
        for (const tp of tips) { ctx.beginPath(); ctx.arc(tp.node.x, tp.node.y, 1.3, 0, 6.283); ctx.fill(); }
        for (const pl of pulses) { const n = pl.path[Math.floor(pl.pos)]; if (n) { ctx.beginPath(); ctx.arc(n.x, n.y, 2.3, 0, 6.283); ctx.fill(); } }
        for (const wv of waves) { const front = (env.t - wv.t0) * 90; ctx.beginPath(); for (const [id, h] of wv.hop) if (Math.abs(h - front) < 3) { const n = nodes[id]; ctx.moveTo(n.x + 1.8, n.y); ctx.arc(n.x, n.y, 1.8, 0, 6.283); } ctx.fill(); }
      }
      for (const n of nodes) if (n.root) { ctx.beginPath(); ctx.arc(n.x, n.y, 3.2, 0, 6.283); ctx.fill(); }
    },
  };
}
